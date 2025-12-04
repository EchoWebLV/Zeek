/**
 * Zcash Light Client - Pure Node.js Implementation
 * 
 * Connects to lightwalletd via gRPC and scans for shielded transactions
 * using a viewing key.
 */

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { 
  tryDecryptNote, 
  decryptFullNote,
  parseIncomingViewingKey,
  type SaplingOutput,
  type DecryptedNote,
  type IncomingViewingKey 
} from "../crypto/sapling.js";
import type { ShieldedTransaction, ZcashConfig } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "../..");
const PROTO_PATH = path.join(PROJECT_ROOT, "proto", "service.proto");

// ============================================================
// TYPES
// ============================================================

interface BlockID {
  height: number;
  hash: Buffer;
}

interface CompactBlock {
  protoVersion: number;
  height: number;
  hash: Buffer;
  prevHash: Buffer;
  time: number;
  vtx: CompactTx[];
}

interface CompactTx {
  index: number;
  hash: Buffer;
  fee: number;
  spends: CompactSpend[];
  outputs: CompactOutput[];
  actions: CompactAction[];
}

interface CompactSpend {
  nf: Buffer;
}

interface CompactOutput {
  cmu: Buffer;
  ephemeralKey: Buffer;
  ciphertext: Buffer;
}

interface CompactAction {
  nullifier: Buffer;
  cmx: Buffer;
  ephemeralKey: Buffer;
  ciphertext: Buffer;
}

interface RawTransaction {
  data: Buffer;
  height: number;
}

interface LightdInfo {
  version: string;
  vendor: string;
  chainName: string;
  saplingActivationHeight: number;
  blockHeight: number;
  estimatedHeight: number;
}

// gRPC client type
interface CompactTxStreamerClient {
  getLatestBlock: (request: object, callback: (err: Error | null, response: BlockID) => void) => void;
  getBlock: (request: BlockID, callback: (err: Error | null, response: CompactBlock) => void) => void;
  getBlockRange: (request: { start: BlockID; end: BlockID }) => grpc.ClientReadableStream<CompactBlock>;
  getTransaction: (request: { hash: Buffer }, callback: (err: Error | null, response: RawTransaction) => void) => void;
  getLightdInfo: (request: object, callback: (err: Error | null, response: LightdInfo) => void) => void;
}

// ============================================================
// LIGHT CLIENT CLASS
// ============================================================

export class ZcashLightClient {
  private client: CompactTxStreamerClient | null = null;
  private config: ZcashConfig;
  private ivk: IncomingViewingKey | null = null;
  private lastScannedHeight: number = 0;
  private isConnected: boolean = false;

  constructor(config: ZcashConfig) {
    this.config = config;
    
    if (config.viewingKey) {
      this.ivk = parseIncomingViewingKey(config.viewingKey);
    }
  }

  /**
   * Connect to lightwalletd server
   */
  async connect(): Promise<boolean> {
    console.log("🔌 Connecting to lightwalletd...");
    console.log(`   Server: ${this.config.lightwalletdUrl}`);

    try {
      // Check if proto files exist
      if (!fs.existsSync(PROTO_PATH)) {
        console.error(`   ❌ Proto file not found: ${PROTO_PATH}`);
        return false;
      }

      // Load proto definitions
      const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [path.join(PROJECT_ROOT, "proto")],
      });

      const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as unknown as {
        cash: { z: { wallet: { sdk: { rpc: { CompactTxStreamer: grpc.ServiceClientConstructor } } } } }
      };

      const CompactTxStreamer = protoDescriptor.cash?.z?.wallet?.sdk?.rpc?.CompactTxStreamer;
      
      if (!CompactTxStreamer) {
        console.error("   ❌ Could not load CompactTxStreamer from proto");
        return false;
      }

      // Determine credentials based on URL
      const useSSL = !this.config.lightwalletdUrl.includes("localhost") && 
                     !this.config.lightwalletdUrl.includes("127.0.0.1");
      
      const credentials = useSSL 
        ? grpc.credentials.createSsl()
        : grpc.credentials.createInsecure();

      this.client = new CompactTxStreamer(
        this.config.lightwalletdUrl,
        credentials
      ) as unknown as CompactTxStreamerClient;

      // Test connection
      return new Promise((resolve) => {
        this.client!.getLightdInfo({}, (err, info) => {
          if (err) {
            console.error("   ❌ Connection failed:", err.message);
            resolve(false);
          } else {
            console.log("   ✅ Connected to lightwalletd");
            console.log(`   Chain: ${info.chainName}`);
            console.log(`   Block height: ${info.blockHeight}`);
            console.log(`   Sapling activated at: ${info.saplingActivationHeight}`);
            this.isConnected = true;
            
            // Set initial scan height to Sapling activation if not set
            if (this.lastScannedHeight === 0) {
              this.lastScannedHeight = info.saplingActivationHeight;
            }
            
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error("   ❌ Error connecting:", error);
      return false;
    }
  }

  /**
   * Get the current blockchain height
   */
  async getLatestBlock(): Promise<BlockID | null> {
    if (!this.client) return null;

    return new Promise((resolve) => {
      this.client!.getLatestBlock({}, (err, block) => {
        if (err) {
          console.error("Error getting latest block:", err.message);
          resolve(null);
        } else {
          resolve(block);
        }
      });
    });
  }

  /**
   * Get lightwalletd server info
   */
  async getServerInfo(): Promise<LightdInfo | null> {
    if (!this.client) return null;

    return new Promise((resolve) => {
      this.client!.getLightdInfo({}, (err, info) => {
        if (err) {
          resolve(null);
        } else {
          resolve(info);
        }
      });
    });
  }

  /**
   * Scan blocks for incoming transactions
   */
  async scanBlocks(startHeight: number, endHeight: number): Promise<ShieldedTransaction[]> {
    if (!this.client || !this.ivk) {
      console.error("Client not connected or viewing key not set");
      return [];
    }

    const transactions: ShieldedTransaction[] = [];
    
    console.log(`   📦 Scanning blocks ${startHeight} to ${endHeight}...`);

    return new Promise((resolve, reject) => {
      const stream = this.client!.getBlockRange({
        start: { height: startHeight, hash: Buffer.alloc(0) },
        end: { height: endHeight, hash: Buffer.alloc(0) },
      });

      let blocksScanned = 0;
      let outputsScanned = 0;

      stream.on("data", (block: CompactBlock) => {
        blocksScanned++;
        
        // Scan each transaction in the block
        for (const tx of block.vtx) {
          // Scan Sapling outputs
          for (const output of tx.outputs) {
            outputsScanned++;
            
            const saplingOutput: SaplingOutput = {
              cmu: Buffer.from(output.cmu),
              ephemeralKey: Buffer.from(output.ephemeralKey),
              ciphertext: Buffer.from(output.ciphertext),
            };

            const decrypted = tryDecryptNote(saplingOutput, this.ivk!);
            
            if (decrypted) {
              console.log(`\n   🎉 Found transaction at height ${block.height}!`);
              console.log(`   Value: ${Number(decrypted.value) / 100_000_000} ZEC`);
              
              // Note: For compact blocks, we can't get the full memo
              // We'd need to fetch the full transaction
              transactions.push({
                txid: Buffer.from(tx.hash).reverse().toString("hex"),
                blockHeight: block.height,
                timestamp: new Date(block.time * 1000),
                amountZatoshis: decrypted.value,
                amountZec: Number(decrypted.value) / 100_000_000,
                memo: decrypted.memoText,
                processed: false,
              });
            }
          }
        }
      });

      stream.on("error", (err) => {
        console.error("   ❌ Error scanning blocks:", err.message);
        reject(err);
      });

      stream.on("end", () => {
        console.log(`   ✅ Scanned ${blocksScanned} blocks, ${outputsScanned} outputs`);
        console.log(`   Found ${transactions.length} transactions for this viewing key`);
        this.lastScannedHeight = endHeight;
        resolve(transactions);
      });
    });
  }

  /**
   * Get full transaction to extract memo
   */
  async getFullTransaction(txid: string): Promise<RawTransaction | null> {
    if (!this.client) return null;

    const hashBuffer = Buffer.from(txid, "hex").reverse();

    return new Promise((resolve) => {
      this.client!.getTransaction({ hash: hashBuffer }, (err, tx) => {
        if (err) {
          console.error("Error getting transaction:", err.message);
          resolve(null);
        } else {
          resolve(tx);
        }
      });
    });
  }

  /**
   * Sync wallet and find new transactions
   */
  async sync(): Promise<ShieldedTransaction[]> {
    if (!this.isConnected) {
      const connected = await this.connect();
      if (!connected) return [];
    }

    const latestBlock = await this.getLatestBlock();
    if (!latestBlock) return [];

    const currentHeight = latestBlock.height;
    
    if (this.lastScannedHeight >= currentHeight) {
      console.log("   Already synced to latest block");
      return [];
    }

    // Scan in batches to avoid memory issues
    const BATCH_SIZE = 1000;
    const allTransactions: ShieldedTransaction[] = [];

    for (let start = this.lastScannedHeight + 1; start <= currentHeight; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE - 1, currentHeight);
      const txs = await this.scanBlocks(start, end);
      allTransactions.push(...txs);
    }

    return allTransactions;
  }

  /**
   * Set the viewing key
   */
  setViewingKey(viewingKeyHex: string): void {
    this.ivk = parseIncomingViewingKey(viewingKeyHex);
    console.log("   🔑 Viewing key set");
  }

  /**
   * Set the starting height for scanning
   */
  setStartHeight(height: number): void {
    this.lastScannedHeight = height;
    console.log(`   📍 Start height set to ${height}`);
  }

  /**
   * Get current sync status
   */
  getStatus(): { connected: boolean; lastScannedHeight: number; hasViewingKey: boolean } {
    return {
      connected: this.isConnected,
      lastScannedHeight: this.lastScannedHeight,
      hasViewingKey: this.ivk !== null,
    };
  }

  /**
   * Close the connection
   */
  close(): void {
    if (this.client) {
      grpc.closeClient(this.client as unknown as grpc.Client);
      this.client = null;
      this.isConnected = false;
      console.log("   🔌 Disconnected from lightwalletd");
    }
  }
}

/**
 * Create and initialize a light client
 */
export async function createLightClient(config: ZcashConfig): Promise<ZcashLightClient | null> {
  const client = new ZcashLightClient(config);
  const connected = await client.connect();
  
  if (!connected) {
    return null;
  }
  
  return client;
}


