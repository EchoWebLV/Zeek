import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { ZcashConfig, ShieldedTransaction, BlogRequest } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "../..");

// Track processed transactions to avoid duplicates
const processedTxids = new Set<string>();

// Store for pending blog requests
const pendingRequests: BlogRequest[] = [];

// Demo mode transactions for testing
const demoTransactions: ShieldedTransaction[] = [];

let config: ZcashConfig | null = null;
let isWatching = false;

/**
 * Initialize the Zcash light client
 */
export function initZcash(zcashConfig: ZcashConfig): void {
  config = zcashConfig;
  console.log("🔐 Zcash light client initialized");
  console.log(`   Network: ${config.network}`);
  console.log(`   Server: ${config.lightwalletdUrl}`);
}

/**
 * Add a demo transaction for testing
 * This simulates receiving a shielded payment with a memo
 */
export function addDemoTransaction(memo: string, amountZec: number = 0.01): ShieldedTransaction {
  const tx: ShieldedTransaction = {
    txid: `demo_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    blockHeight: 2000000 + demoTransactions.length,
    timestamp: new Date(),
    amountZatoshis: BigInt(Math.floor(amountZec * 100_000_000)),
    amountZec: amountZec,
    memo: memo,
    processed: false,
  };

  demoTransactions.push(tx);
  console.log(`\n📥 Demo transaction received!`);
  console.log(`   TxID: ${tx.txid}`);
  console.log(`   Amount: ${tx.amountZec} ZEC`);
  console.log(`   Memo: "${tx.memo}"`);

  return tx;
}

/**
 * Load demo transactions from a file (for testing)
 */
export function loadDemoTransactionsFromFile(filePath: string): ShieldedTransaction[] {
  const fullPath = path.isAbsolute(filePath) ? filePath : path.join(PROJECT_ROOT, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`   No demo file found at: ${fullPath}`);
    return [];
  }

  const content = fs.readFileSync(fullPath, "utf-8");
  const lines = content.split("\n").filter(line => line.trim() && !line.startsWith("#"));

  const transactions: ShieldedTransaction[] = [];
  
  for (const line of lines) {
    // Format: "topic text here" or "amount:topic text here"
    let memo = line.trim();
    let amount = 0.01;

    if (memo.includes(":")) {
      const [amountStr, ...rest] = memo.split(":");
      const parsedAmount = parseFloat(amountStr);
      if (!isNaN(parsedAmount)) {
        amount = parsedAmount;
        memo = rest.join(":").trim();
      }
    }

    if (memo) {
      transactions.push(addDemoTransaction(memo, amount));
    }
  }

  return transactions;
}

/**
 * Get unprocessed transactions (new payments with memos)
 */
export function getUnprocessedTransactions(): ShieldedTransaction[] {
  // In demo mode, return demo transactions
  const unprocessed = demoTransactions.filter(tx => !tx.processed && !processedTxids.has(tx.txid));
  
  return unprocessed;
}

/**
 * Mark a transaction as processed
 */
export function markTransactionProcessed(txid: string): void {
  processedTxids.add(txid);
  
  const tx = demoTransactions.find(t => t.txid === txid);
  if (tx) {
    tx.processed = true;
  }
}

/**
 * Create a blog request from a transaction
 */
export function createBlogRequest(tx: ShieldedTransaction): BlogRequest {
  const request: BlogRequest = {
    id: `blog_${tx.txid}`,
    topic: tx.memo,
    transaction: tx,
    receivedAt: new Date(),
    status: "pending",
  };

  pendingRequests.push(request);
  return request;
}

/**
 * Get all pending blog requests
 */
export function getPendingRequests(): BlogRequest[] {
  return pendingRequests.filter(r => r.status === "pending");
}

/**
 * Update request status
 */
export function updateRequestStatus(
  id: string,
  status: BlogRequest["status"],
  error?: string
): void {
  const request = pendingRequests.find(r => r.id === id);
  if (request) {
    request.status = status;
    if (error) {
      request.error = error;
    }
  }
}

/**
 * Watch for incoming transactions (demo mode)
 * In production, this would connect to lightwalletd via gRPC
 */
export async function watchForTransactions(
  onTransaction: (tx: ShieldedTransaction) => Promise<void>,
  pollInterval: number = 5000
): Promise<void> {
  if (isWatching) {
    console.log("   Already watching for transactions");
    return;
  }

  isWatching = true;
  console.log(`\n👁️  Watching for incoming shielded transactions...`);
  console.log(`   Poll interval: ${pollInterval}ms`);
  console.log(`   Press Ctrl+C to stop\n`);

  const poll = async () => {
    if (!isWatching) return;

    const unprocessed = getUnprocessedTransactions();
    
    for (const tx of unprocessed) {
      try {
        await onTransaction(tx);
        markTransactionProcessed(tx.txid);
      } catch (error) {
        console.error(`   Error processing transaction ${tx.txid}:`, error);
      }
    }

    if (isWatching) {
      setTimeout(poll, pollInterval);
    }
  };

  await poll();
}

/**
 * Stop watching for transactions
 */
export function stopWatching(): void {
  isWatching = false;
  console.log("\n🛑 Stopped watching for transactions");
}

/**
 * Get wallet info (demo mode)
 */
export function getWalletInfo(): {
  address: string;
  network: string;
  balance: number;
  pendingRequests: number;
  processedCount: number;
} {
  return {
    // Demo shielded address format
    address: config?.network === "mainnet" 
      ? "zs1zekedemowallet..." 
      : "ztestsapling1zekedemowallet...",
    network: config?.network || "testnet",
    balance: 0, // Would query from lightwalletd
    pendingRequests: getPendingRequests().length,
    processedCount: processedTxids.size,
  };
}

/**
 * Format ZEC amount for display
 */
export function formatZec(zatoshis: bigint): string {
  const zec = Number(zatoshis) / 100_000_000;
  return `${zec.toFixed(8)} ZEC`;
}

/**
 * Parse a memo from encrypted ciphertext
 * In production, this would use the viewing key to decrypt
 */
export function parseMemo(ciphertext: Uint8Array, _viewingKey?: string): string {
  // In demo mode, memos are already decrypted
  // In production, this would use librustzcash or similar to decrypt
  return new TextDecoder().decode(ciphertext);
}

// ============================================================
// LIGHTWALLETD gRPC CONNECTION (Production)
// ============================================================

// Proto definition path (would need to download from lightwalletd repo)
const PROTO_PATH = path.join(PROJECT_ROOT, "proto", "service.proto");

interface LightwalletClient {
  getLatestBlock: (request: object, callback: grpc.requestCallback<{ height: number }>) => void;
  getBlockRange: (request: object) => grpc.ClientReadableStream<unknown>;
}

let grpcClient: LightwalletClient | null = null;

/**
 * Connect to lightwalletd via gRPC (production mode)
 * Requires proto files from: https://github.com/zcash/lightwalletd/tree/master/walletrpc
 */
export async function connectToLightwalletd(): Promise<boolean> {
  if (!config) {
    throw new Error("Zcash not initialized. Call initZcash() first.");
  }

  // Check if proto file exists
  if (!fs.existsSync(PROTO_PATH)) {
    console.log("   ⚠️  Proto files not found. Running in demo mode.");
    console.log(`   To enable production mode, download proto files to: ${PROTO_PATH}`);
    return false;
  }

  try {
    const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as {
      cash?: { z?: { wallet?: { sdk?: { rpc?: { CompactTxStreamer?: grpc.ServiceClientConstructor } } } } }
    };
    const CompactTxStreamer = protoDescriptor.cash?.z?.wallet?.sdk?.rpc?.CompactTxStreamer;

    if (!CompactTxStreamer) {
      console.log("   ⚠️  Could not load CompactTxStreamer from proto");
      return false;
    }

    grpcClient = new CompactTxStreamer(
      config.lightwalletdUrl,
      grpc.credentials.createSsl()
    ) as unknown as LightwalletClient;

    // Test connection by getting latest block
    return new Promise((resolve) => {
      grpcClient!.getLatestBlock({}, (err, response) => {
        if (err) {
          console.log("   ⚠️  Could not connect to lightwalletd:", err.message);
          resolve(false);
        } else {
          console.log(`   ✅ Connected to lightwalletd at block ${response?.height}`);
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.log("   ⚠️  Error connecting to lightwalletd:", error);
    return false;
  }
}

/**
 * Sync wallet with blockchain (production mode)
 * This would scan for incoming transactions using the viewing key
 */
export async function syncWallet(): Promise<ShieldedTransaction[]> {
  if (!grpcClient || !config?.viewingKey) {
    console.log("   Running in demo mode - no real sync performed");
    return [];
  }

  // In production, this would:
  // 1. Get the current block height
  // 2. Scan blocks since last sync
  // 3. Try to decrypt outputs using viewing key
  // 4. Extract memos from successful decryptions
  // 5. Return new transactions

  console.log("   Syncing wallet with blockchain...");
  
  // Placeholder for production implementation
  return [];
}

