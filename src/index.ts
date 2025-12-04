import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { 
  initGemini, 
  generatePrivacyTweet, 
  generateZKNewsPost, 
  generateAnalysisTweet,
  generateTipTweet,
  generateQuestionTweet,
  generateQuoteTweet,
  generatePredictionTweet,
  generateFactTweet,
  generateCelebrationTweet,
  generateHotTakeTweet,
  generateRecommendationTweet,
  generateShoutoutTweet,
  checkTopicRelevance,
} from "./services/gemini.js";
import { initImagen, generateImage } from "./services/imagen.js";
import { initTwitter, postTweetWithImage, verifyCredentials } from "./services/twitter.js";
import type { AppConfig, GenerationResult, TweetData, PostType } from "./types.js";

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

/** All non-news post types that rotate */
const ROTATING_POST_TYPES: PostType[] = [
  "thoughts", "tip", "question", "quote", "prediction", 
  "fact", "celebration", "hottake", "recommendation", "shoutout"
];

/** Prefix map for each post type */
const POST_PREFIXES: Record<PostType, string> = {
  thoughts: "💭 Thoughts: ",
  news: "📰 News: ",
  analysis: "🔍 Analysis: ",
  tip: "💡 Tip: ",
  question: "❓ Question: ",
  quote: "📖 Quote: ",
  prediction: "🔮 Prediction: ",
  fact: "⚡ Fact: ",
  celebration: "🎉 Celebration: ",
  hottake: "🤔 Hot Take: ",
  recommendation: "📚 Recommendation: ",
  shoutout: "🙏 Shoutout: ",
};

/**
 * Get the appropriate prefix for a tweet based on its type
 */
function getTweetPrefix(tweetData: TweetData): string {
  if (tweetData.isAnalysis) return POST_PREFIXES.analysis;
  if (tweetData.isNews) return POST_PREFIXES.news;
  if (tweetData.postType) return POST_PREFIXES[tweetData.postType];
  return POST_PREFIXES.thoughts;
}

/**
 * Load rotation state from file
 */
function loadRotationState(): { postCount: number; remainingTypes: PostType[] } {
  const stateFile = path.join(PROJECT_ROOT, ".rotation_state.json");
  try {
    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    }
  } catch {
    // Ignore errors
  }
  return { postCount: 1, remainingTypes: [...ROTATING_POST_TYPES] };
}

/**
 * Save rotation state to file
 */
function saveRotationState(state: { postCount: number; remainingTypes: PostType[] }): void {
  const stateFile = path.join(PROJECT_ROOT, ".rotation_state.json");
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

/**
 * Get next post type based on rotation
 */
function getNextPostType(): { type: PostType | "news"; isNews: boolean } {
  const state = loadRotationState();
  
  // Every 2nd post is news
  const isNewsPost = state.postCount % 2 === 0;
  
  if (isNewsPost) {
    state.postCount++;
    saveRotationState(state);
    return { type: "news", isNews: true };
  }
  
  // For non-news posts, pick randomly from remaining types
  if (state.remainingTypes.length === 0) {
    // Reset the pool
    state.remainingTypes = [...ROTATING_POST_TYPES];
  }
  
  const randomIndex = Math.floor(Math.random() * state.remainingTypes.length);
  const selectedType = state.remainingTypes[randomIndex];
  
  // Remove from remaining
  state.remainingTypes.splice(randomIndex, 1);
  state.postCount++;
  saveRotationState(state);
  
  return { type: selectedType, isNews: false };
}

/**
 * Generate tweet based on type
 */
async function generateTweetByType(postType: PostType | "news"): Promise<TweetData> {
  switch (postType) {
    case "news":
      return generateZKNewsPost();
    case "thoughts":
      return generatePrivacyTweet();
    case "tip":
      return generateTipTweet();
    case "question":
      return generateQuestionTweet();
    case "quote":
      return generateQuoteTweet();
    case "prediction":
      return generatePredictionTweet();
    case "fact":
      return generateFactTweet();
    case "celebration":
      return generateCelebrationTweet();
    case "hottake":
      return generateHotTakeTweet();
    case "recommendation":
      return generateRecommendationTweet();
    case "shoutout":
      return generateShoutoutTweet();
    default:
      return generatePrivacyTweet();
  }
}

/**
 * Post an Analysis tweet based on a Zcash memo
 * 
 * The tweet format includes:
 * - Attribution to ZK paid memo request
 * - The original question/topic
 * - Zeke's analysis response
 * 
 * Topics are filtered for relevance to ZK, privacy, Zcash, etc.
 * Irrelevant topics are rejected with a reason.
 */
export async function postAnalysis(memoTopic: string): Promise<GenerationResult> {
  console.log("\n" + "=".repeat(60));
  console.log("🔍 ZEKE Analysis - Processing Paid Request");
  console.log("=".repeat(60));
  console.log(`Topic: ${memoTopic}`);
  console.log("");

  try {
    // Step 1: Check if topic is relevant to ZK/privacy/crypto
    console.log("🔎 Checking topic relevance...");
    const relevance = await checkTopicRelevance(memoTopic);
    
    if (!relevance.isRelevant) {
      console.log(`   ❌ Topic rejected: ${relevance.reason}`);
      console.log(`   Confidence: ${(relevance.confidence * 100).toFixed(0)}%`);
      console.log("\n" + "=".repeat(60));
      console.log("⏭️  SKIPPED - Topic not relevant to ZK/privacy/crypto");
      console.log("=".repeat(60));
      
      return {
        success: false,
        tweet: "",
        topic: memoTopic,
        imagePath: null,
      };
    }
    
    console.log(`   ✅ Topic approved: ${relevance.reason}`);
    console.log(`   Confidence: ${(relevance.confidence * 100).toFixed(0)}%`);
    if (relevance.suggestedCategory) {
      console.log(`   Category: ${relevance.suggestedCategory}`);
    }

    // Step 2: Generate analysis
    console.log("\n📝 Generating analysis with Gemini...");
    const tweetData = await generateAnalysisTweet(memoTopic);
    console.log("   ✅ Analysis generated!");

    // Format tweet with paid memo attribution
    // Format: "🔍 A ZK paid memo asks: [question]\n\n[Zeke's analysis]"
    const tweetText = `🔍 A ZK paid memo asks: ${memoTopic}\n\n${tweetData.text}`;
    console.log(`   Tweet: "${tweetText.substring(0, 100)}..."`);
    console.log(`   Length: ${tweetText.length} chars`);

    // Step 3: Generate image
    const imageScene = tweetData.imagePrompt;
    console.log("\n🎨 Scene:", imageScene);
    const imageBuffer = await generateImage(imageScene);

    // Step 4: Post to X
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
    // Get next post type from rotation
    const { type: postType, isNews } = getNextPostType();
    const state = loadRotationState();
    
    console.log(`📊 Post #${state.postCount - 1}`);
    console.log(`📝 Type: ${POST_PREFIXES[postType as PostType] || postType}`);
    console.log(`🔄 Remaining in rotation: ${state.remainingTypes.length}/${ROTATING_POST_TYPES.length}`);

    // Generate tweet based on type
    console.log(`\n🎯 Generating ${postType.toUpperCase()} post...`);
    const tweetData = await generateTweetByType(postType);
    console.log("   ✅ Generated!")

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

// Posting interval in hours (default 2 hours)
const POST_INTERVAL_HOURS = parseInt(process.env.POST_INTERVAL_HOURS || "2", 10);
const POST_INTERVAL_MS = POST_INTERVAL_HOURS * 60 * 60 * 1000;

// Zcash monitoring interval in seconds
const ZCASH_POLL_INTERVAL = parseInt(process.env.ZCASH_POLL_INTERVAL || "60", 10) * 1000;

/**
 * Start Zcash payment monitoring (if configured)
 * 
 * This enables the "pay with ZEC for analysis" feature.
 * When a payment with a memo is received, an analysis tweet is generated and posted.
 */
async function startZcashMonitoring(): Promise<void> {
  const seedPhrase = process.env.ZCASH_SEED_PHRASE;
  const walletBirthday = process.env.ZCASH_WALLET_BIRTHDAY 
    ? parseInt(process.env.ZCASH_WALLET_BIRTHDAY, 10) 
    : undefined;
  
  if (!seedPhrase) {
    console.log("💤 Zcash monitoring disabled (no ZCASH_SEED_PHRASE set)");
    console.log("   To enable: set ZCASH_SEED_PHRASE environment variable");
    return;
  }

  try {
    // Dynamic import to avoid issues if zingo isn't available
    const { isZingoInstalled, getZingoVersion, initZingo, initWalletFromSeed, watchForTransactions, getAddresses } = 
      await import("./services/zingo.js");

    if (!isZingoInstalled()) {
      console.log("⚠️  Zingo CLI not installed - Zcash monitoring disabled");
      console.log("   Install zingo-cli from: https://github.com/zingolabs/zingo-cli");
      return;
    }

    console.log("\n🔗 Starting Zcash payment monitoring...");
    console.log(`   Zingo version: ${getZingoVersion()}`);
    
    // Initialize Zingo
    const network = (process.env.ZCASH_NETWORK as "mainnet" | "testnet") || "mainnet";
    const lightwalletdUrl = process.env.LIGHTWALLETD_URL || "https://mainnet.lightwalletd.com:9067";
    
    initZingo({
      network,
      lightwalletdUrl,
      pollInterval: ZCASH_POLL_INTERVAL,
    });

    // Initialize wallet from seed phrase
    const walletInitialized = await initWalletFromSeed(seedPhrase, walletBirthday);
    
    if (!walletInitialized) {
      console.error("❌ Failed to initialize Zcash wallet - monitoring disabled");
      return;
    }

    // Display wallet addresses for receiving payments
    const addresses = await getAddresses();
    if (addresses.unified) {
      console.log("\n📬 Send ZEC with memo to request analysis:");
      console.log(`   ${addresses.unified}`);
    }

    // Start watching for transactions
    console.log(`\n💤 Polling for payments every ${ZCASH_POLL_INTERVAL / 1000}s...`);
    
    watchForTransactions(async (tx) => {
      console.log(`\n💰 Payment received! Amount: ${tx.amountZec} ZEC`);
      console.log(`   Memo: "${tx.memo}"`);

      if (tx.memo && tx.memo.trim().length > 0) {
        try {
          await postAnalysis(tx.memo.trim());
        } catch (error) {
          console.error("   ❌ Failed to post analysis:", error);
        }
      } else {
        console.log("   ⚠️  No memo found - skipping (send ZEC with a memo to request analysis)");
      }
    }, ZCASH_POLL_INTERVAL);

  } catch (error) {
    console.error("❌ Failed to start Zcash monitoring:", error);
    console.error("   Zcash payment feature will be unavailable");
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
  console.log(`   ⏰ Posts every ${POST_INTERVAL_HOURS} hours`);
  console.log(`   📰 News: every 2nd post`);
  console.log(`   🔄 Rotating: ${ROTATING_POST_TYPES.join(", ")}`);
  console.log(`   🔍 Analysis: when ZEC payment received`);
}

// Execute
main();

