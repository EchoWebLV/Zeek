/**
 * Zingo CLI Wrapper - Production-ready Zcash scanning
 * 
 * Uses the zingo-cli binary to scan the blockchain for shielded transactions.
 * This is the most reliable approach for Node.js as it uses the battle-tested
 * Rust implementation directly.
 */

import { spawn, execSync, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { ShieldedTransaction, ZcashConfig } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "../..");

// Zingo data directory
const ZINGO_DATA_DIR = path.join(PROJECT_ROOT, ".zingo");

// Track processed transactions (persisted across restarts)
const processedTxids = new Set<string>();
const PROCESSED_TXIDS_FILE = "processed_txids.json";

let zingoProcess: ChildProcess | null = null;
let config: ZcashConfig | null = null;
let lastSyncHeight = 0;
let isWatching = false;

/**
 * Load processed transaction IDs from disk (for persistence across restarts)
 */
function loadProcessedTxids(): void {
  const filePath = path.join(ZINGO_DATA_DIR, PROCESSED_TXIDS_FILE);
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (Array.isArray(data)) {
        data.forEach(txid => processedTxids.add(txid));
        console.log(`   📋 Loaded ${data.length} processed transaction IDs`);
      }
    }
  } catch (error) {
    console.warn("   ⚠️  Could not load processed txids:", error);
  }
}

/**
 * Save processed transaction IDs to disk
 */
function saveProcessedTxids(): void {
  const filePath = path.join(ZINGO_DATA_DIR, PROCESSED_TXIDS_FILE);
  try {
    fs.writeFileSync(filePath, JSON.stringify([...processedTxids], null, 2));
  } catch (error) {
    console.warn("   ⚠️  Could not save processed txids:", error);
  }
}

/**
 * Check if zingo-cli is installed
 */
export function isZingoInstalled(): boolean {
  try {
    execSync("zingo-cli --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get zingo-cli version
 */
export function getZingoVersion(): string | null {
  try {
    const output = execSync("zingo-cli --version", { encoding: "utf-8" });
    return output.trim();
  } catch {
    return null;
  }
}

/**
 * Initialize Zingo with configuration
 */
export function initZingo(zcashConfig: ZcashConfig): void {
  config = zcashConfig;
  
  // Create data directory if it doesn't exist
  if (!fs.existsSync(ZINGO_DATA_DIR)) {
    fs.mkdirSync(ZINGO_DATA_DIR, { recursive: true });
  }

  console.log("🦎 Zingo CLI wrapper initialized");
  console.log(`   Network: ${config.network}`);
  console.log(`   Data dir: ${ZINGO_DATA_DIR}`);
  
  const version = getZingoVersion();
  if (version) {
    console.log(`   Version: ${version}`);
  } else {
    console.log("   ⚠️  zingo-cli not found in PATH");
  }

  // Load processed transaction IDs from previous runs
  loadProcessedTxids();
}

/**
 * Check if wallet already exists
 */
export function walletExists(): boolean {
  const walletFile = path.join(ZINGO_DATA_DIR, "zingo-wallet.dat");
  const walletDir = path.join(ZINGO_DATA_DIR, "wallet");
  return fs.existsSync(walletFile) || fs.existsSync(walletDir);
}

/**
 * Run a zingo-cli command and return the output
 * @param command - The command to run
 * @param args - Additional arguments
 * @param stdinInput - Optional input to write to stdin (for interactive commands)
 */
async function runZingoCommand(
  command: string, 
  args: string[] = [],
  stdinInput?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const serverArg = config?.lightwalletdUrl 
      ? ["--server", config.lightwalletdUrl] 
      : [];
    
    const networkArg = config?.network === "testnet" 
      ? ["--chain", "testnet"] 
      : ["--chain", "mainnet"];

    const fullArgs = [
      ...serverArg,
      ...networkArg,
      "--data-dir", ZINGO_DATA_DIR,
      command,
      ...args
    ];

    console.log(`   Running: zingo-cli ${command}`);

    const proc = spawn("zingo-cli", fullArgs, {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        // Extract JSON from output (zingo-cli adds preamble text)
        const jsonMatch = stdout.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        if (jsonMatch) {
          resolve(jsonMatch[0]);
        } else {
          resolve(stdout);
        }
      } else {
        reject(new Error(`zingo-cli exited with code ${code}: ${stderr || stdout}`));
      }
    });

    proc.on("error", (err) => {
      reject(err);
    });

    // Write to stdin if input is provided (for commands like restore that need seed phrase)
    if (stdinInput !== undefined) {
      proc.stdin.write(stdinInput);
      proc.stdin.end();
    }
  });
}

/**
 * Initialize wallet from seed phrase
 * 
 * The seed phrase is passed via stdin to the zingo-cli restore command.
 * If a wallet already exists, it will be loaded instead of restored.
 * 
 * @param seedPhrase - BIP39 mnemonic seed phrase (typically 24 words)
 * @param birthday - Optional wallet birthday (block height) for faster sync
 */
export async function initWalletFromSeed(seedPhrase: string, birthday?: number): Promise<boolean> {
  // Validate seed phrase
  if (!seedPhrase || seedPhrase.trim().length === 0) {
    console.error("   ❌ Seed phrase is required");
    return false;
  }

  const words = seedPhrase.trim().split(/\s+/);
  if (words.length !== 24 && words.length !== 12) {
    console.warn(`   ⚠️  Seed phrase has ${words.length} words (expected 12 or 24)`);
  }

  try {
    // Check if wallet already exists
    if (walletExists()) {
      console.log("   📂 Existing wallet found, loading...");
      // Try to sync to verify wallet is working
      try {
        await syncWallet();
        console.log("   ✅ Existing wallet loaded successfully");
        return true;
      } catch (syncError) {
        console.log("   ⚠️  Existing wallet failed to sync, will try to restore");
        // Delete existing wallet data to allow restore
        const walletFile = path.join(ZINGO_DATA_DIR, "zingo-wallet.dat");
        const walletDir = path.join(ZINGO_DATA_DIR, "wallet");
        if (fs.existsSync(walletFile)) fs.unlinkSync(walletFile);
        if (fs.existsSync(walletDir)) fs.rmSync(walletDir, { recursive: true });
      }
    }

    // Build restore arguments
    const restoreArgs: string[] = [];
    if (birthday) {
      restoreArgs.push("--birthday", birthday.toString());
    }

    console.log("   🔐 Restoring wallet from seed phrase...");
    
    // Pass the seed phrase via stdin
    // zingo-cli restore expects the seed phrase on stdin followed by newline
    await runZingoCommand("restore", restoreArgs, seedPhrase.trim() + "\n");
    
    console.log("   ✅ Wallet restored from seed phrase");
    
    // Initial sync after restore
    console.log("   🔄 Performing initial sync...");
    await syncWallet();
    
    // Get and display wallet addresses
    const addresses = await getAddresses();
    if (addresses.unified) {
      console.log(`   📬 Unified Address: ${addresses.unified.substring(0, 20)}...`);
    }
    
    return true;
  } catch (error) {
    console.error("   ❌ Failed to initialize wallet:", error);
    return false;
  }
}

/**
 * Initialize wallet from viewing key (Unified Full Viewing Key)
 * 
 * This allows watch-only wallet functionality - you can scan for incoming
 * transactions but cannot spend.
 * 
 * @param ufvk - Unified Full Viewing Key
 * @param birthday - Optional wallet birthday (block height) for faster sync
 */
export async function initWalletFromUfvk(ufvk: string, birthday?: number): Promise<boolean> {
  if (!ufvk || ufvk.trim().length === 0) {
    console.error("   ❌ UFVK is required");
    return false;
  }

  try {
    // Check if wallet already exists
    if (walletExists()) {
      console.log("   📂 Existing wallet found, loading...");
      try {
        await syncWallet();
        console.log("   ✅ Existing wallet loaded successfully");
        return true;
      } catch {
        console.log("   ⚠️  Existing wallet failed, will try to create new");
      }
    }

    // Use zingo-cli import-ufvk command if available
    const birthdayArg = birthday ? birthday.toString() : "419200"; // Sapling activation default
    
    console.log("   🔑 Importing UFVK...");
    await runZingoCommand("import", ["ufvk", ufvk.trim(), birthdayArg]);
    
    console.log("   ✅ Wallet configured with viewing key");
    
    // Initial sync
    await syncWallet();
    
    return true;
  } catch (error) {
    console.error("   ❌ Failed to configure wallet:", error);
    return false;
  }
}

/**
 * Sync wallet with the blockchain
 * 
 * @param retries - Number of retry attempts on failure (default 3)
 */
export async function syncWallet(retries: number = 3): Promise<{ height: number; synced: boolean }> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`   🔄 Syncing wallet (attempt ${attempt}/${retries})...`);
      } else {
        console.log("   🔄 Syncing wallet...");
      }
      
      const output = await runZingoCommand("sync");
      
      // Parse sync output to get height
      const heightMatch = output.match(/height[:\s]+(\d+)/i);
      const height = heightMatch ? parseInt(heightMatch[1]) : 0;
      
      lastSyncHeight = height;
      console.log(`   ✅ Synced to height ${height}`);
      
      return { height, synced: true };
    } catch (error) {
      lastError = error as Error;
      console.error(`   ⚠️  Sync attempt ${attempt} failed:`, (error as Error).message);
      
      if (attempt < retries) {
        // Wait before retry (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`   ⏳ Waiting ${waitTime / 1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  console.error("   ❌ Sync failed after all retries:", lastError?.message);
  return { height: lastSyncHeight, synced: false };
}

/**
 * Get list of notes (incoming transactions)
 */
export async function getNotes(): Promise<ShieldedTransaction[]> {
  try {
    const output = await runZingoCommand("notes");
    
    // Parse the notes output (JSON format)
    const notes = parseNotesOutput(output);
    return notes;
  } catch (error) {
    console.error("   ❌ Failed to get notes:", error);
    return [];
  }
}

/**
 * Parse notes output from zingo-cli
 */
function parseNotesOutput(output: string): ShieldedTransaction[] {
  const transactions: ShieldedTransaction[] = [];
  
  try {
    // Zingo outputs JSON
    const data = JSON.parse(output);
    
    // Parse unspent notes
    if (data.unspent_sapling_notes) {
      for (const note of data.unspent_sapling_notes) {
        if (!processedTxids.has(note.txid)) {
          transactions.push({
            txid: note.txid,
            blockHeight: note.height || 0,
            timestamp: new Date(note.datetime || Date.now()),
            amountZatoshis: BigInt(note.value || 0),
            amountZec: (note.value || 0) / 100_000_000,
            memo: decodeMemo(note.memo || ""),
            processed: false,
          });
        }
      }
    }
    
    // Parse unspent orchard notes
    if (data.unspent_orchard_notes) {
      for (const note of data.unspent_orchard_notes) {
        if (!processedTxids.has(note.txid)) {
          transactions.push({
            txid: note.txid,
            blockHeight: note.height || 0,
            timestamp: new Date(note.datetime || Date.now()),
            amountZatoshis: BigInt(note.value || 0),
            amountZec: (note.value || 0) / 100_000_000,
            memo: decodeMemo(note.memo || ""),
            processed: false,
          });
        }
      }
    }
  } catch {
    // Try to parse as plain text if JSON fails
    console.log("   Parsing notes as text...");
  }
  
  return transactions;
}

/**
 * Decode memo from hex or base64
 */
function decodeMemo(memo: string): string {
  if (!memo) return "";
  
  try {
    // Try hex decoding
    if (/^[0-9a-fA-F]+$/.test(memo)) {
      const bytes = Buffer.from(memo, "hex");
      // Remove null bytes and decode as UTF-8
      const text = bytes.toString("utf-8").replace(/\x00/g, "").trim();
      return text;
    }
    
    // Try base64 decoding
    const bytes = Buffer.from(memo, "base64");
    const text = bytes.toString("utf-8").replace(/\x00/g, "").trim();
    return text;
  } catch {
    return memo; // Return as-is if decoding fails
  }
}

/**
 * Mark a transaction as processed and persist to disk
 */
export function markProcessed(txid: string): void {
  processedTxids.add(txid);
  saveProcessedTxids();
}

/**
 * Get wallet balance
 */
export async function getBalance(): Promise<{ 
  total: number; 
  sapling: number; 
  orchard: number;
  transparent: number;
}> {
  try {
    const output = await runZingoCommand("balance");
    const data = JSON.parse(output);
    
    return {
      total: (data.total || 0) / 100_000_000,
      sapling: (data.sapling || 0) / 100_000_000,
      orchard: (data.orchard || 0) / 100_000_000,
      transparent: (data.transparent || 0) / 100_000_000,
    };
  } catch (error) {
    console.error("   ❌ Failed to get balance:", error);
    return { total: 0, sapling: 0, orchard: 0, transparent: 0 };
  }
}

/**
 * Get wallet addresses
 */
export async function getAddresses(): Promise<{
  unified?: string;
  sapling?: string;
  transparent?: string;
}> {
  try {
    const output = await runZingoCommand("addresses");
    const data = JSON.parse(output);
    
    return {
      unified: data.unified_address,
      sapling: data.sapling_address,
      transparent: data.transparent_address,
    };
  } catch (error) {
    console.error("   ❌ Failed to get addresses:", error);
    return {};
  }
}

/**
 * Get wallet info
 */
export async function getWalletInfo(): Promise<{
  birthday: number;
  height: number;
  network: string;
}> {
  try {
    const output = await runZingoCommand("info");
    const data = JSON.parse(output);
    
    return {
      birthday: data.birthday || 0,
      height: data.height || 0,
      network: data.chain || "mainnet",
    };
  } catch (error) {
    console.error("   ❌ Failed to get wallet info:", error);
    return { birthday: 0, height: 0, network: "mainnet" };
  }
}

/**
 * Scan for new transactions and return those with memos
 */
export async function scanForNewTransactions(): Promise<ShieldedTransaction[]> {
  // Sync first
  await syncWallet();
  
  // Get notes
  const notes = await getNotes();
  
  // Filter for notes with memos (blog requests)
  const withMemos = notes.filter(tx => tx.memo && tx.memo.length > 0);
  
  console.log(`   📬 Found ${withMemos.length} transactions with memos`);
  
  return withMemos;
}

/**
 * Watch for new transactions continuously
 * 
 * @param onTransaction - Callback function to handle each new transaction
 * @param pollInterval - Polling interval in milliseconds (default 30s)
 */
export async function watchForTransactions(
  onTransaction: (tx: ShieldedTransaction) => Promise<void>,
  pollInterval: number = 30000
): Promise<void> {
  if (isWatching) {
    console.log("   ⚠️  Already watching for transactions");
    return;
  }

  isWatching = true;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 5;

  console.log(`\n👁️  Watching for incoming shielded transactions...`);
  console.log(`   Poll interval: ${pollInterval / 1000}s`);
  console.log(`   Press Ctrl+C to stop\n`);

  const poll = async () => {
    if (!isWatching) {
      console.log("   🛑 Transaction watching stopped");
      return;
    }

    try {
      const transactions = await scanForNewTransactions();
      consecutiveErrors = 0; // Reset on success
      
      for (const tx of transactions) {
        if (!processedTxids.has(tx.txid)) {
          console.log(`\n💰 New transaction detected!`);
          console.log(`   TxID: ${tx.txid.substring(0, 16)}...`);
          console.log(`   Amount: ${tx.amountZec} ZEC`);
          console.log(`   Memo: "${tx.memo.substring(0, 50)}${tx.memo.length > 50 ? '...' : ''}"`);
          
          try {
            await onTransaction(tx);
            markProcessed(tx.txid);
            console.log(`   ✅ Transaction processed successfully`);
          } catch (txError) {
            console.error(`   ❌ Failed to process transaction:`, txError);
            // Don't mark as processed so it will be retried
          }
        }
      }
    } catch (error) {
      consecutiveErrors++;
      console.error(`   ❌ Error during poll (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, error);
      
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error(`   🛑 Too many consecutive errors, stopping watcher`);
        isWatching = false;
        return;
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
  if (isWatching) {
    isWatching = false;
    console.log("   🛑 Stopping transaction watcher...");
  }
}

/**
 * Check if currently watching for transactions
 */
export function isCurrentlyWatching(): boolean {
  return isWatching;
}

