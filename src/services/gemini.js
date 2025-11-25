import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT, getRandomTopic } from "../config/topics.js";

let ai = null;

// Track post count for alternating between regular and news posts
let postCount = 0;

/**
 * Initialize the Google AI client
 */
export function initGemini(apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

/**
 * Check if next post should be a news post
 */
export function shouldBeNewsPost() {
  postCount++;
  return postCount % 2 === 0; // Every 2nd post is news
}

/**
 * Generate a ZK news post using Google Search grounding
 * @returns {Promise<{text: string, topic: object, imagePrompt: string, sourceUrl: string}>}
 */
export async function generateZKNewsPost() {
  if (!ai) {
    throw new Error("Gemini not initialized. Call initGemini() first.");
  }

  const newsTopics = [
    "zero knowledge proof technology news",
    "ZK rollups blockchain news",
    "privacy blockchain technology updates",
    "Zcash cryptocurrency news",
    "zkSNARKs zkSTARKs developments",
    "private blockchain transactions news",
    "homomorphic encryption blockchain",
    "Starknet ZK technology news",
    "Mina Protocol updates",
    "Aztec Network privacy news"
  ];

  const randomTopic = newsTopics[Math.floor(Math.random() * newsTopics.length)];

  console.log("   🔍 Searching for ZK news:", randomTopic);

  try {
    // Step 1: Search for news with Gemini 3
    const searchResponse = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Search for news from THE PAST 7 DAYS about: ${randomTopic}

Find ONE specific news item from this week (last 7 days only). 
Must be recent - within the past week.
Include the date if possible.`,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    // Get source URL from grounding metadata
    let sourceUrl = null;
    const groundingChunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks && groundingChunks.length > 0) {
      sourceUrl = groundingChunks[0]?.web?.uri || null;
    }

    const newsContext = searchResponse.text;

    // Step 2: Generate the tweet based on the news (without tools, so we can use JSON)
    const tweetResponse = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Based on this news:
${newsContext}

Write a post with EXACTLY TWO PARAGRAPHS:
- First paragraph: What happened (the news)
- Second paragraph: Why it matters for privacy/ZK

RULES:
- Total 200-270 characters
- NO hashtags, NO emojis
- Be specific about the actual news
- Sound like a knowledgeable insider

Also provide a cinematic image description (1 sentence) - abstract, dark, futuristic.

JSON format only:
{"tweet": "First paragraph.\\n\\nSecond paragraph.", "imagePrompt": "image description"}`,
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = JSON.parse(tweetResponse.text);

    // Clean up tweet
    let cleanTweet = (result.tweet || "")
      .replace(/#\w+/g, '')
      .replace(/[\u{1F600}-\u{1F6FF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanTweet.length > 280) {
      cleanTweet = cleanTweet.substring(0, 277) + "...";
    }

    // For news posts, we'll keep the source URL separate (for the text file)
    // but add a note that it's sourced news
    if (sourceUrl) {
      cleanTweet += "\n\n📰 Source in replies";
    }

    return {
      text: cleanTweet,
      topic: { theme: "📰 ZK News (This Week)" },
      imagePrompt: result.imagePrompt || "Abstract zero-knowledge proof visualization",
      sourceUrl: sourceUrl,
      isNews: true
    };
  } catch (error) {
    console.error("Error generating ZK news post:", error);
    throw error;
  }
}

/**
 * Generate a privacy-focused tweet using Gemini 3.0
 * @returns {Promise<{text: string, topic: object, imagePrompt: string}>}
 */
export async function generatePrivacyTweet() {
  if (!ai) {
    throw new Error("Gemini not initialized. Call initGemini() first.");
  }

  const topic = getRandomTopic();
  
  const prompt = `${SYSTEM_PROMPT}

TOPIC: ${topic.theme}
CONTEXT: ${topic.context}

Write a post with EXACTLY TWO PARAGRAPHS (separated by blank line). 
Total length 200-270 characters. No hashtags, no emojis.
Also provide a cinematic image description (1 sentence) - abstract, dark, futuristic.

JSON format:
{"tweet": "First paragraph here.\\n\\nSecond paragraph here.", "imagePrompt": "image description"}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = JSON.parse(response.text);
    
    // Clean up: remove any hashtags and emojis that slipped through
    let cleanTweet = result.tweet
      .replace(/#\w+/g, '')  // Remove hashtags
      .replace(/[\u{1F600}-\u{1F6FF}]/gu, '')  // Remove emojis
      .replace(/\s+/g, ' ')  // Clean up extra spaces
      .trim();
    
    // Validate length
    if (cleanTweet.length > 280) {
      cleanTweet = cleanTweet.substring(0, 277) + "...";
    }

    return {
      text: cleanTweet,
      topic: topic,
      imagePrompt: result.imagePrompt
    };
  } catch (error) {
    console.error("Error generating tweet with Gemini:", error);
    throw error;
  }
}

/**
 * Enhance an image prompt for better Imagen results
 * @param {string} basePrompt - The base image description
 * @param {object} topic - The topic object for context
 * @returns {string} Enhanced prompt for image generation
 */
export function enhanceImagePrompt(basePrompt, topic) {
  const styleModifiers = [
    "cyberpunk aesthetic",
    "neon glow",
    "digital art",
    "futuristic",
    "abstract geometric",
    "dark theme with vibrant accents",
    "high contrast",
    "mysterious atmosphere"
  ];
  
  const randomStyle = styleModifiers[Math.floor(Math.random() * styleModifiers.length)];
  
  return `${basePrompt}. Style: ${randomStyle}, privacy and encryption theme, ${topic.theme.toLowerCase()} concept, professional quality, 4K, dramatic lighting`;
}

