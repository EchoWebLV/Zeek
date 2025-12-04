/**
 * Test script to demonstrate the relevance filter
 */

import dotenv from "dotenv";
import { initGemini, checkTopicRelevance } from "./src/services/gemini.js";

dotenv.config();

const testTopics = [
  // Should be APPROVED ✅
  "Will Zcash become the number 1 privacy coin?",
  "How do zkSNARKs work?",
  "What's the future of DeFi privacy?",
  "Monero vs Zcash - which is better?",
  "How does shielded pool adoption affect ZEC price?",
  
  // Should be REJECTED ❌
  "What's the best recipe for chocolate cake?",
  "Who will win the Super Bowl?",
  "Dating advice for introverts",
  "Best movies of 2024",
  "How to lose weight fast",
];

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("🧪 RELEVANCE FILTER TEST");
  console.log("=".repeat(60));

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    console.error("❌ GOOGLE_AI_API_KEY not set");
    process.exit(1);
  }

  initGemini(apiKey);

  console.log("\nTesting relevance filter with various topics...\n");

  for (const topic of testTopics) {
    console.log(`📝 "${topic}"`);
    const result = await checkTopicRelevance(topic);
    
    const icon = result.isRelevant ? "✅" : "❌";
    console.log(`   ${icon} ${result.isRelevant ? "APPROVED" : "REJECTED"} (${(result.confidence * 100).toFixed(0)}%)`);
    console.log(`   Reason: ${result.reason}`);
    if (result.suggestedCategory) {
      console.log(`   Category: ${result.suggestedCategory}`);
    }
    console.log("");
  }

  console.log("=".repeat(60));
  console.log("✅ Relevance filter test complete!");
  console.log("=".repeat(60));
}

main();


