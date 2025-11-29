import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { initGemini, generatePrivacyTweet, generateZKNewsPost, generateAnalysisTweet } from "./services/gemini.js";
import { initImagen, generateImage } from "./services/imagen.js";
import { initTwitter, postTweetWithImage, verifyCredentials } from "./services/twitter.js";
import type { AppConfig, GenerationResult, TweetData } from "./types.js";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "..");

// Configuration
const CONFIG: AppConfig = {
  googleApiKey: process.env.GOOGLE_AI_API_KEY || "",
  twitter: {
    apiKey: process.env.X_API_KEY || "",
    apiSecret: process.env.X_API_SECRET || "",
    accessToken: process.env.X_ACCESS_TOKEN || "",
    accessSecret: process.env.X_ACCESS_SECRET || "",
  },
  isLocalMode: process.argv.includes("--local") || process.env.MODE === "local",
  testDir: path.join(PROJECT_ROOT, "test"),
};

/**
 * Get the appropriate prefix for a tweet based on its type
 */
function getTweetPrefix(tweetData: TweetData): string {
  if (tweetData.isAnalysis) return "🔍 Analysis: ";
  if (tweetData.isNews) return "📰 News: ";
  return "💭 Thoughts: ";
}

/**
 * Post an Analysis tweet based on a Zcash memo
 */
export async function postAnalysis(memoTopic: string): Promise<GenerationResult> {
  console.log("\n" + "=".repeat(60));
  console.log("🔍 ZEKE Analysis - Processing Paid Request");
  console.log("=".repeat(60));
  console.log(`Topic: ${memoTopic}`);
  console.log("");

  try {
    // Generate analysis
    console.log("📝 Generating analysis with Gemini...");
    const tweetData = await generateAnalysisTweet(memoTopic);
    console.log("   ✅ Analysis generated!");

    const tweetText = getTweetPrefix(tweetData) + tweetData.text;
    console.log(`   Tweet: "${tweetText.substring(0, 100)}..."`);

    // Generate image
    const imageScene = tweetData.imagePrompt;
    console.log("\n🎨 Scene:", imageScene);
    const imageBuffer = await generateImage(imageScene);

    // Post to X
    console.log("\n🚀 Posting Analysis to X...");
    const result = await postTweetWithImage(tweetText, imageBuffer);

    console.log("\n" + "=".repeat(60));
    console.log("✨ ANALYSIS POSTED");
    console.log("=".repeat(60));
    console.log(`Tweet ID: ${result.data.id}`);
    console.log(`URL: https://x.com/i/status/${result.data.id}`);

    return {
      success: true,
      tweet: tweetText,
      topic: memoTopic,
      imagePath: null,
      tweetId: result.data.id,
      tweetUrl: `https://x.com/i/status/${result.data.id}`,
    };
  } catch (error) {
    console.error("❌ Error posting analysis:", error);
    throw error;
  }
}

/**
 * Main bot function - generates and posts privacy content
 */
async function generateAndPost(): Promise<GenerationResult> {
  console.log("\n" + "=".repeat(60));
  console.log("🔐 ZEKE Privacy Bot - Generating Post");
  console.log("=".repeat(60));
  console.log(`Mode: ${CONFIG.isLocalMode ? "LOCAL (test)" : "PRODUCTION"}`);
  console.log("");

  try {
    // Track post count for alternating between regular and news posts
    const counterFile = path.join(PROJECT_ROOT, ".post_counter");
    let postCount = 1;
    
    if (fs.existsSync(counterFile)) {
      try {
        postCount = parseInt(fs.readFileSync(counterFile, "utf-8").trim(), 10) || 1;
      } catch {
        postCount = 1;
      }
    }
    
    // Every 2nd post is a news post (posts 2, 4, 6, etc.)
    const isNewsPost = postCount % 2 === 0;
    
    // Increment counter for next run
    fs.writeFileSync(counterFile, String(postCount + 1));
    
    console.log(`📊 Post #${postCount} (${isNewsPost ? "NEWS" : "Regular"})`);

    // Step 1: Generate tweet text with Gemini
    let tweetData;
    if (isNewsPost) {
      console.log("\n📰 Generating ZK NEWS post with Google Search...");
      tweetData = await generateZKNewsPost();
      console.log("   ✅ News post generated!");
    } else {
      console.log("\n📝 Generating tweet with Gemini 3.0...");
      tweetData = await generatePrivacyTweet();
      console.log("   ✅ Tweet generated!");
    }

    // Add prefix based on post type
    const tweetText = getTweetPrefix(tweetData) + tweetData.text;

    console.log(`   Topic: ${tweetData.topic.theme}`);
    console.log(`   Tweet: "${tweetText}"`);
    console.log(`   Length: ${tweetText.length}/280 chars`);
    if (tweetData.sourceUrl) {
      console.log(`   Source: ${tweetData.sourceUrl}`);
    }

    // Step 2: Use the scene description directly (will be combined with sprite)
    const imageScene = tweetData.imagePrompt;
    console.log("\n🎨 Scene:", imageScene);

    // Step 3: Generate image with Imagen
    let imageBuffer: Buffer;
    let imagePath: string | null = null;

    if (CONFIG.isLocalMode) {
      // Create test directory and save files
      if (!fs.existsSync(CONFIG.testDir)) {
        fs.mkdirSync(CONFIG.testDir, { recursive: true });
      }

      // Find the next post number
      const existingFiles = fs.readdirSync(CONFIG.testDir);
      const postNumbers = existingFiles
        .filter((f) => f.startsWith("post") && f.endsWith(".jpg"))
        .map((f) => parseInt(f.match(/post(\d+)/)?.[1] || "0"));
      const nextNumber = Math.max(0, ...postNumbers) + 1;

      imagePath = path.join(CONFIG.testDir, `post${nextNumber}.jpg`);
      const textPath = path.join(CONFIG.testDir, `post${nextNumber}.txt`);

      imageBuffer = await generateImage(imageScene, imagePath);

      // Save tweet text
      const textContent = `${tweetData.isNews ? "📰 NEWS POST" : "📝 REGULAR POST"}
Topic: ${tweetData.topic.theme}
Tweet: ${tweetText}
Length: ${tweetText.length} chars
${tweetData.sourceUrl ? `Source: ${tweetData.sourceUrl}` : ""}
Image Scene: ${imageScene}

Generated: ${new Date().toISOString()}`;

      fs.writeFileSync(textPath, textContent);
      console.log(`   ✅ Text saved to: ${textPath}`);

      console.log("\n" + "=".repeat(60));
      console.log("✨ LOCAL TEST COMPLETE");
      console.log("=".repeat(60));
      console.log(`📁 Output saved to: ${CONFIG.testDir}`);
      console.log(`   - ${path.basename(imagePath)}`);
      console.log(`   - ${path.basename(textPath)}`);

      return {
        success: true,
        tweet: tweetText,
        topic: tweetData.topic.theme,
        imagePath: imagePath,
      };
    } else {
      // Production mode - generate and post
      imageBuffer = await generateImage(imageScene);

      // Step 4: Post to X
      console.log("\n🚀 Posting to X...");
      const result = await postTweetWithImage(tweetText, imageBuffer);

      console.log("\n" + "=".repeat(60));
      console.log("✨ PRODUCTION POST COMPLETE");
      console.log("=".repeat(60));
      console.log(`Tweet ID: ${result.data.id}`);
      console.log(`URL: https://x.com/i/status/${result.data.id}`);

      return {
        success: true,
        tweet: tweetText,
        topic: tweetData.topic.theme,
        imagePath: null,
        tweetId: result.data.id,
        tweetUrl: `https://x.com/i/status/${result.data.id}`,
      };
    }
  } catch (error) {
    console.error("\n❌ Error during generation:", error);
    throw error;
  }
}

// Posting interval in hours
const POST_INTERVAL_HOURS = parseInt(process.env.POST_INTERVAL_HOURS || "4", 10);
const POST_INTERVAL_MS = POST_INTERVAL_HOURS * 60 * 60 * 1000;

// Zcash monitoring interval in seconds
const ZCASH_POLL_INTERVAL = parseInt(process.env.ZCASH_POLL_INTERVAL || "60", 10) * 1000;

/**
 * Start Zcash payment monitoring (if configured)
 */
async function startZcashMonitoring(): Promise<void> {
  const seedPhrase = process.env.ZCASH_SEED_PHRASE;
  
  if (!seedPhrase) {
    console.log("💤 Zcash monitoring disabled (no ZCASH_SEED_PHRASE set)");
    return;
  }

  try {
    // Dynamic import to avoid issues if zingo isn't available
    const { isZingoInstalled, initZingo, initWalletFromSeed, watchForTransactions } = 
      await import("./services/zingo.js");

    if (!isZingoInstalled()) {
      console.log("⚠️  Zingo CLI not installed - Zcash monitoring disabled");
      return;
    }

    console.log("\n🔗 Starting Zcash payment monitoring...");
    
    // Initialize Zingo
    initZingo({
      network: (process.env.ZCASH_NETWORK as "mainnet" | "testnet") || "mainnet",
      lightwalletdUrl: process.env.LIGHTWALLETD_URL || "https://mainnet.lightwalletd.com:9067",
      pollInterval: ZCASH_POLL_INTERVAL,
    });

    // Initialize wallet
    await initWalletFromSeed(seedPhrase);
    console.log("   ✅ Zcash wallet initialized");

    // Start watching for transactions
    watchForTransactions(async (tx) => {
      console.log(`\n💰 Payment received! Amount: ${tx.amountZec} ZEC`);
      console.log(`   Memo: "${tx.memo}"`);

      if (tx.memo && tx.memo.length > 0) {
        try {
          await postAnalysis(tx.memo);
        } catch (error) {
          console.error("   ❌ Failed to post analysis:", error);
        }
      }
    }, ZCASH_POLL_INTERVAL);

  } catch (error) {
    console.error("❌ Failed to start Zcash monitoring:", error);
  }
}

/**
 * Run the bot continuously
 */
async function main(): Promise<void> {
  console.log("🚀 ZEKE Bot starting in continuous mode...");
  console.log(`📅 Scheduled posts every ${POST_INTERVAL_HOURS} hours`);
  console.log("");

  // Initialize services once
  if (!CONFIG.googleApiKey) {
    console.error("❌ Error: GOOGLE_AI_API_KEY not set");
    process.exit(1);
  }
  initGemini(CONFIG.googleApiKey);
  initImagen(CONFIG.googleApiKey);
  
  if (!CONFIG.isLocalMode) {
    initTwitter(CONFIG.twitter);
    const isAuth = await verifyCredentials();
    if (!isAuth) {
      console.error("❌ Error: Twitter authentication failed");
      process.exit(1);
    }
  }

  // Start Zcash payment monitoring (for Analysis posts)
  await startZcashMonitoring();

  // Post immediately on startup
  try {
    await generateAndPost();
  } catch (error) {
    console.error("Error on initial post:", error);
  }

  // Then post on schedule
  setInterval(async () => {
    console.log("\n⏰ Scheduled post triggered...");
    try {
      await generateAndPost();
    } catch (error) {
      console.error("Error during scheduled post:", error);
    }
  }, POST_INTERVAL_MS);

  // Keep the process alive
  console.log("\n💤 Bot is running...");
  console.log(`   📝 Thoughts/News: every ${POST_INTERVAL_HOURS} hours`);
  console.log(`   🔍 Analysis: when ZEC payment received`);
}

// Execute
main();

