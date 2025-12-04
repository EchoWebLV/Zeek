/**
 * Test script to trigger a fake memo analysis
 * 
 * Run with: npx tsx test-analysis.ts
 * Or build first: npm run build && node dist/test-analysis.js
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initGemini, generateAnalysisTweet, checkTopicRelevance } from "./src/services/gemini.js";
import { initImagen, generateImage } from "./src/services/imagen.js";
import { initTwitter, postTweetWithImage, verifyCredentials } from "./src/services/twitter.js";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FAKE_MEMO = "Will Zcash become the number 1, privacy coin?";

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 TEST: Triggering Fake Memo Analysis");
  console.log("=".repeat(60));
  console.log(`📝 Memo: "${FAKE_MEMO}"`);
  console.log("");

  // Check for required env vars
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error("❌ GOOGLE_AI_API_KEY not set");
    process.exit(1);
  }

  // Initialize services
  console.log("🔧 Initializing services...");
  initGemini(apiKey);
  initImagen(apiKey);

  // Check if we should post to Twitter or run locally
  const isLocalMode = process.argv.includes("--local");
  
  let canPostToTwitter = false;
  
  if (!isLocalMode) {
    const twitter = {
      apiKey: process.env.X_API_KEY || "",
      apiSecret: process.env.X_API_SECRET || "",
      accessToken: process.env.X_ACCESS_TOKEN || "",
      accessSecret: process.env.X_ACCESS_SECRET || "",
    };

    if (!twitter.apiKey || !twitter.accessToken) {
      console.log("⚠️  Twitter credentials not set - will save locally only");
    } else {
      initTwitter(twitter);
      canPostToTwitter = await verifyCredentials();
      if (!canPostToTwitter) {
        console.log("⚠️  Twitter auth failed - will save locally only");
      }
    }
  } else {
    console.log("📍 Running in LOCAL mode (no Twitter posting)\n");
  }

  // Check relevance and generate the analysis
  try {
    // Step 1: Check topic relevance
    console.log("\n🔎 Checking topic relevance...");
    const relevance = await checkTopicRelevance(FAKE_MEMO);
    
    if (!relevance.isRelevant) {
      console.log(`   ❌ Topic rejected: ${relevance.reason}`);
      console.log(`   Confidence: ${(relevance.confidence * 100).toFixed(0)}%`);
      console.log("\n" + "=".repeat(60));
      console.log("⏭️  SKIPPED - Topic not relevant to ZK/privacy/crypto");
      console.log("=".repeat(60));
      console.log("\nTry a relevant topic like:");
      console.log('  - "Will Zcash become the number 1 privacy coin?"');
      console.log('  - "How do zkSNARKs work?"');
      console.log('  - "What is the future of DeFi privacy?"');
      process.exit(0);
    }
    
    console.log(`   ✅ Topic approved: ${relevance.reason}`);
    console.log(`   Confidence: ${(relevance.confidence * 100).toFixed(0)}%`);
    if (relevance.suggestedCategory) {
      console.log(`   Category: ${relevance.suggestedCategory}`);
    }

    // Step 2: Generate analysis
    console.log("\n📝 Generating analysis with Gemini...");
    const tweetData = await generateAnalysisTweet(FAKE_MEMO);
    
    // Format tweet with paid memo attribution (same as postAnalysis in index.ts)
    const tweetText = `🔍 A ZK paid memo asks: ${FAKE_MEMO}\n\n${tweetData.text}`;
    console.log("   ✅ Analysis generated!");
    console.log(`   Tweet: "${tweetText.substring(0, 100)}..."`);
    console.log(`   Length: ${tweetText.length} chars`);

    // Generate image
    console.log("\n🎨 Generating image...");
    console.log(`   Scene: ${tweetData.imagePrompt}`);
    
    // Save locally
    const testDir = path.join(__dirname, "test");
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    const timestamp = Date.now();
    const imagePath = path.join(testDir, `analysis-${timestamp}.jpg`);
    const textPath = path.join(testDir, `analysis-${timestamp}.txt`);
    
    const imageBuffer = await generateImage(tweetData.imagePrompt, imagePath);
    console.log(`   ✅ Image saved to: ${imagePath}`);
    
    // Save tweet text
    const textContent = `🔍 ZK PAID MEMO ANALYSIS TEST
Memo: ${FAKE_MEMO}
Tweet: ${tweetText}
Length: ${tweetText.length} chars
Image Scene: ${tweetData.imagePrompt}

Generated: ${new Date().toISOString()}`;
    
    fs.writeFileSync(textPath, textContent);
    console.log(`   ✅ Text saved to: ${textPath}`);

    // Post to Twitter if possible
    if (canPostToTwitter && !isLocalMode) {
      console.log("\n🚀 Posting to X...");
      const result = await postTweetWithImage(tweetText, imageBuffer);
      
      console.log("\n" + "=".repeat(60));
      console.log("✅ ANALYSIS POSTED TO X");
      console.log("=".repeat(60));
      console.log(`Tweet ID: ${result.data.id}`);
      console.log(`URL: https://x.com/i/status/${result.data.id}`);
    } else {
      console.log("\n" + "=".repeat(60));
      console.log("✅ TEST COMPLETE (Local Only)");
      console.log("=".repeat(60));
      console.log(`📁 Files saved to: ${testDir}`);
    }
    
    console.log(`\n📄 Full Tweet:\n${tweetText}`);
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

main();
