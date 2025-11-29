import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

import {
  initZcash,
  addDemoTransaction,
  getUnprocessedTransactions,
  markTransactionProcessed,
  createBlogRequest,
  getWalletInfo,
  watchForTransactions as watchDemo,
  stopWatching,
  loadDemoTransactionsFromFile,
} from "./services/zcash.js";
import {
  initBlogGenerator,
  processRequest,
  listBlogPosts,
  getBlogStats,
} from "./services/blog.js";
import {
  initZingo,
  isZingoInstalled,
  getZingoVersion,
  syncWallet,
  scanForNewTransactions,
  watchForTransactions as watchZingo,
  markProcessed,
  getAddresses,
  getBalance,
} from "./services/zingo.js";
import type { BlogConfig, ShieldedTransaction } from "./types.js";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "..");

// Configuration
const CONFIG: BlogConfig = {
  googleApiKey: process.env.GOOGLE_AI_API_KEY || "",
  outputDir: path.join(PROJECT_ROOT, "testBlog"),
  zcash: {
    lightwalletdUrl: process.env.LIGHTWALLETD_URL || "https://mainnet.lightwalletd.com:9067",
    network: (process.env.ZCASH_NETWORK as "mainnet" | "testnet") || "mainnet",
    viewingKey: process.env.ZCASH_VIEWING_KEY,
    pollInterval: parseInt(process.env.POLL_INTERVAL || "30000"),
  },
  minPaymentZec: parseFloat(process.env.MIN_PAYMENT_ZEC || "0.001"),
};

// Command line flags
const isDemo = process.argv.includes("--demo");
const isWatch = process.argv.includes("--watch");
const isLive = process.argv.includes("--live");
const isInteractive = !isDemo && !isWatch && !isLive;

// Get start height from command line if provided
const startHeightArg = process.argv.find(arg => arg.startsWith("--start="));
const startHeight = startHeightArg ? parseInt(startHeightArg.split("=")[1]) : undefined;

/**
 * Process a transaction and generate a blog post
 */
async function handleTransaction(tx: ShieldedTransaction): Promise<void> {
  console.log("\n" + "─".repeat(60));
  console.log("💰 Processing shielded payment...");
  console.log(`   TxID: ${tx.txid}`);
  console.log(`   Amount: ${tx.amountZec} ZEC`);
  console.log(`   Memo: "${tx.memo}"`);

  // Check minimum payment
  if (tx.amountZec < CONFIG.minPaymentZec) {
    console.log(`   ⚠️  Payment below minimum (${CONFIG.minPaymentZec} ZEC). Skipping.`);
    return;
  }

  // Skip if memo is empty or placeholder
  if (!tx.memo || tx.memo.startsWith("[Memo not available")) {
    console.log(`   ⚠️  No memo in transaction. Skipping.`);
    return;
  }

  // Create blog request
  const request = createBlogRequest(tx);
  console.log(`   📋 Created request: ${request.id}`);

  try {
    // Generate and save blog post
    const { post, filepath } = await processRequest(request, CONFIG.outputDir);

    console.log("\n" + "─".repeat(60));
    console.log("✨ BLOG POST GENERATED");
    console.log("─".repeat(60));
    console.log(`   Title: ${post.title}`);
    console.log(`   Words: ${post.wordCount}`);
    console.log(`   File: ${filepath}`);
    console.log(`   Paid: ${post.amountPaid} ZEC`);
  } catch (error) {
    console.error("   ❌ Error generating blog post:", error);
  }
}

/**
 * Interactive mode - accept topic inputs from command line
 */
async function runInteractive(): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("📝 ZEKE Shielded Blog Service - Interactive Mode");
  console.log("=".repeat(60));
  console.log("\nEnter a topic to generate a blog post.");
  console.log("Format: [amount:]topic");
  console.log("Examples:");
  console.log('  "zero knowledge proofs explained"');
  console.log('  "0.05:how shielded transactions work"');
  console.log("\nType 'quit' to exit, 'stats' for statistics.\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (): void => {
    rl.question("📥 Topic: ", async (input) => {
      const trimmed = input.trim();

      if (trimmed.toLowerCase() === "quit" || trimmed.toLowerCase() === "exit") {
        console.log("\n👋 Goodbye!");
        rl.close();
        process.exit(0);
      }

      if (trimmed.toLowerCase() === "stats") {
        const stats = getBlogStats(CONFIG.outputDir);
        console.log("\n📊 Blog Statistics:");
        console.log(`   Total Posts: ${stats.totalPosts}`);
        console.log(`   Total Words: ${stats.totalWords.toLocaleString()}`);
        console.log(`   Total Revenue: ${stats.totalRevenue.toFixed(4)} ZEC\n`);
        prompt();
        return;
      }

      if (trimmed.toLowerCase() === "list") {
        const posts = listBlogPosts(CONFIG.outputDir);
        if (posts.length === 0) {
          console.log("\n📚 No blog posts yet.\n");
        } else {
          console.log("\n📚 Generated Blog Posts:");
          for (const post of posts) {
            console.log(`   ${post.date} - ${post.title}`);
          }
          console.log();
        }
        prompt();
        return;
      }

      if (!trimmed) {
        prompt();
        return;
      }

      // Parse amount and topic
      let amount = 0.01;
      let topic = trimmed;

      if (trimmed.includes(":")) {
        const colonIndex = trimmed.indexOf(":");
        const maybeAmount = trimmed.substring(0, colonIndex);
        const parsedAmount = parseFloat(maybeAmount);
        
        if (!isNaN(parsedAmount) && parsedAmount > 0) {
          amount = parsedAmount;
          topic = trimmed.substring(colonIndex + 1).trim();
        }
      }

      // Simulate receiving a shielded transaction
      const tx = addDemoTransaction(topic, amount);

      // Process it
      await handleTransaction(tx);
      markTransactionProcessed(tx.txid);

      console.log();
      prompt();
    });
  };

  prompt();
}

/**
 * Demo mode - process sample topics
 */
async function runDemo(): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("📝 ZEKE Shielded Blog Service - Demo Mode");
  console.log("=".repeat(60));

  // Sample topics for demo
  const demoTopics = [
    { topic: "How zero-knowledge proofs enable private transactions", amount: 0.05 },
    { topic: "The future of privacy-preserving AI computation", amount: 0.03 },
    { topic: "Self-custody wallets: why your keys matter", amount: 0.02 },
  ];

  console.log("\n🎭 Running demo with sample topics...\n");

  // Check if there's a demo file
  const demoFile = path.join(PROJECT_ROOT, "demo-topics.txt");
  if (fs.existsSync(demoFile)) {
    console.log(`📄 Loading topics from ${demoFile}`);
    loadDemoTransactionsFromFile(demoFile);
  } else {
    // Add demo transactions
    for (const { topic, amount } of demoTopics) {
      addDemoTransaction(topic, amount);
    }
  }

  // Process all unprocessed transactions
  const transactions = getUnprocessedTransactions();
  console.log(`\n📋 Found ${transactions.length} pending requests\n`);

  for (const tx of transactions) {
    await handleTransaction(tx);
    markTransactionProcessed(tx.txid);
  }

  // Show final stats
  const stats = getBlogStats(CONFIG.outputDir);
  console.log("\n" + "=".repeat(60));
  console.log("✨ DEMO COMPLETE");
  console.log("=".repeat(60));
  console.log(`   Total Posts: ${stats.totalPosts}`);
  console.log(`   Total Words: ${stats.totalWords.toLocaleString()}`);
  console.log(`   Output Dir: ${CONFIG.outputDir}`);
}

/**
 * Watch mode - continuously poll for new transactions (demo/file-based)
 */
async function runWatch(): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("📝 ZEKE Shielded Blog Service - Watch Mode");
  console.log("=".repeat(60));

  const walletInfo = getWalletInfo();
  console.log(`\n🔐 Wallet Info:`);
  console.log(`   Address: ${walletInfo.address}`);
  console.log(`   Network: ${walletInfo.network}`);

  console.log(`\n💡 To simulate a payment, create a file: demo-topics.txt`);
  console.log(`   Add one topic per line. The watcher will pick them up.`);
  console.log(`   Format: amount:topic (e.g., "0.05:explain ZK proofs")\n`);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    stopWatching();
    process.exit(0);
  });

  // Check for demo file periodically
  const checkDemoFile = (): void => {
    const demoFile = path.join(PROJECT_ROOT, "demo-topics.txt");
    if (fs.existsSync(demoFile)) {
      const content = fs.readFileSync(demoFile, "utf-8").trim();
      if (content) {
        loadDemoTransactionsFromFile(demoFile);
        // Clear the file after loading
        fs.writeFileSync(demoFile, "");
      }
    }
  };

  // Start watching with demo file check
  setInterval(checkDemoFile, CONFIG.zcash.pollInterval);

  await watchDemo(handleTransaction, CONFIG.zcash.pollInterval);
}

/**
 * Live mode - connect to real Zcash network via Zingo CLI
 */
async function runLive(): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("📝 ZEKE Shielded Blog Service - LIVE MODE");
  console.log("=".repeat(60));
  console.log("\n🔴 Connecting to real Zcash network via Zingo CLI...\n");

  // Check if Zingo is installed
  if (!isZingoInstalled()) {
    console.error("❌ Error: zingo-cli not found in PATH");
    console.error("\n📦 To install zingo-cli:");
    console.error("   1. Download from: https://github.com/zingolabs/zingo-cli/releases");
    console.error("   2. Or build from source: cargo install --git https://github.com/zingolabs/zingolib zingo-cli");
    console.error("\n💡 Alternatively, use --demo mode for testing:");
    console.error("   npm run blog:demo");
    process.exit(1);
  }

  const version = getZingoVersion();
  console.log(`   ✅ Found zingo-cli: ${version}`);

  // Initialize Zingo
  initZingo(CONFIG.zcash);

  // Show wallet info
  try {
    const addresses = await getAddresses();
    console.log("\n🔐 Wallet Addresses:");
    if (addresses.unified) console.log(`   Unified: ${addresses.unified}`);
    if (addresses.sapling) console.log(`   Sapling: ${addresses.sapling}`);
    if (addresses.transparent) console.log(`   Transparent: ${addresses.transparent}`);

    const balance = await getBalance();
    console.log("\n💰 Wallet Balance:");
    console.log(`   Total: ${balance.total} ZEC`);
    console.log(`   Sapling: ${balance.sapling} ZEC`);
    console.log(`   Orchard: ${balance.orchard} ZEC`);
  } catch (error) {
    console.log("   ⚠️  Could not load wallet info (wallet may need initialization)");
  }

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n\n🛑 Shutting down...");
    process.exit(0);
  });

  // Initial sync and scan
  console.log("\n🔄 Syncing with blockchain...\n");
  const transactions = await scanForNewTransactions();

  if (transactions.length > 0) {
    console.log(`\n🎉 Found ${transactions.length} transactions with memos!`);
    for (const tx of transactions) {
      await handleTransaction(tx);
      markProcessed(tx.txid);
    }
  } else {
    console.log("\n📭 No transactions with memos found yet.");
  }

  // Continue watching for new transactions
  console.log(`\n👁️  Watching for new transactions (polling every ${CONFIG.zcash.pollInterval / 1000}s)...`);
  console.log("   Press Ctrl+C to stop\n");

  await watchZingo(handleTransaction, CONFIG.zcash.pollInterval);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("🔐 ZEKE Shielded Blog Service");
  console.log("=".repeat(60));

  // Validate API key
  if (!CONFIG.googleApiKey) {
    console.error("❌ Error: GOOGLE_AI_API_KEY not set in environment variables");
    process.exit(1);
  }

  // Initialize services
  console.log("\n📡 Initializing services...");
  initZcash(CONFIG.zcash);
  initBlogGenerator(CONFIG.googleApiKey);

  // Create output directory
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    console.log(`   📁 Created output directory: ${CONFIG.outputDir}`);
  }

  // Run appropriate mode
  if (isLive) {
    await runLive();
  } else if (isDemo) {
    await runDemo();
  } else if (isWatch) {
    await runWatch();
  } else {
    await runInteractive();
  }
}

// Execute
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
