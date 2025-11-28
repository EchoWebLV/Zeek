import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { initGemini, generatePrivacyTweet, generateZKNewsPost } from "./services/gemini.js";
import { initImagen, generateImage } from "./services/imagen.js";
import { initTwitter, postTweetWithImage, verifyCredentials } from "./services/twitter.js";
import type { AppConfig, GenerationResult } from "./types.js";

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
 * Main bot function - generates and posts privacy content
 */
async function generateAndPost(): Promise<GenerationResult> {
  console.log("\n" + "=".repeat(60));
  console.log("🔐 ZEKE Privacy Bot - Starting Generation");
  console.log("=".repeat(60));
  console.log(`Mode: ${CONFIG.isLocalMode ? "LOCAL (test)" : "PRODUCTION"}`);
  console.log("");

  // Validate API key
  if (!CONFIG.googleApiKey) {
    console.error("❌ Error: GOOGLE_AI_API_KEY not set in environment variables");
    process.exit(1);
  }

  // Initialize services
  console.log("📡 Initializing services...");
  initGemini(CONFIG.googleApiKey);
  initImagen(CONFIG.googleApiKey);

  if (!CONFIG.isLocalMode) {
    initTwitter(CONFIG.twitter);
    const isAuthenticated = await verifyCredentials();
    if (!isAuthenticated) {
      console.error("❌ Error: Twitter authentication failed");
      process.exit(1);
    }
  }

  try {
    // Get next post number to determine if this should be a news post
    let nextPostNumber = 1;
    if (fs.existsSync(CONFIG.testDir)) {
      const existingFiles = fs.readdirSync(CONFIG.testDir);
      const postNumbers = existingFiles
        .filter((f) => f.startsWith("post") && f.endsWith(".jpg"))
        .map((f) => parseInt(f.match(/post(\d+)/)?.[1] || "0"));
      nextPostNumber = Math.max(0, ...postNumbers) + 1;
    }

    // Every 2nd post is a news post (posts 2, 4, 6, etc.)
    const isNewsPost = nextPostNumber % 2 === 0;

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

    console.log(`   Topic: ${tweetData.topic.theme}`);
    console.log(`   Tweet: "${tweetData.text}"`);
    console.log(`   Length: ${tweetData.text.length}/280 chars`);
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
Tweet: ${tweetData.text}
Length: ${tweetData.text.length} chars
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
        tweet: tweetData.text,
        topic: tweetData.topic.theme,
        imagePath: imagePath,
      };
    } else {
      // Production mode - generate and post
      imageBuffer = await generateImage(imageScene);

      // Step 4: Post to X
      console.log("\n🚀 Posting to X...");
      const result = await postTweetWithImage(tweetData.text, imageBuffer);

      console.log("\n" + "=".repeat(60));
      console.log("✨ PRODUCTION POST COMPLETE");
      console.log("=".repeat(60));
      console.log(`Tweet ID: ${result.data.id}`);
      console.log(`URL: https://x.com/i/status/${result.data.id}`);

      return {
        success: true,
        tweet: tweetData.text,
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

/**
 * Run the bot
 */
async function main(): Promise<void> {
  try {
    await generateAndPost();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Execute
main();

