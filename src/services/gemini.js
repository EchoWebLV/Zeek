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
 * Follow a redirect URL to get the actual destination
 * @param {string} redirectUrl - The Google grounding redirect URL
 * @returns {Promise<string>} The actual destination URL
 */
async function resolveRedirectUrl(redirectUrl) {
  try {
    const response = await fetch(redirectUrl, {
      method: 'HEAD',
      redirect: 'follow'
    });
    return response.url;
  } catch (error) {
    // If HEAD fails, try GET
    try {
      const response = await fetch(redirectUrl, {
        redirect: 'follow'
      });
      return response.url;
    } catch {
      console.warn("Could not resolve redirect URL:", error.message);
      return redirectUrl;
    }
  }
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

    // Get source URL from grounding metadata and resolve redirect
    let sourceUrl = null;
    const groundingChunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (groundingChunks && groundingChunks.length > 0) {
      const redirectUrl = groundingChunks[0]?.web?.uri;
      if (redirectUrl) {
        console.log("   🔗 Resolving source URL...");
        sourceUrl = await resolveRedirectUrl(redirectUrl);
        console.log("   ✅ Source:", sourceUrl);
      }
    }

    const newsContext = searchResponse.text;

    // Step 2: Generate the tweet based on the news (without tools, so we can use JSON)
    const tweetResponse = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Based on this news:
${newsContext}

Write an accessible post with TWO PARAGRAPHS (400-600 chars total):
- First paragraph: What happened - the key facts, explained simply
- Second paragraph: Why it matters - what this means for privacy tech

RULES:
- Explain any technical terms simply
- NO hashtags, NO emojis
- Sound excited but not overly technical
- Make it interesting for newcomers AND experts

Also provide an image scene for a cartoon mascot (Zeke in green hoodie).
The scene should be DIRECTLY related to the news - show Zeke reacting to or celebrating the news.
Examples: "Zeke reading a newspaper with excitement", "Zeke connecting two puzzle pieces", "Zeke planting a flag on a mountain"

JSON format only:
{"tweet": "First paragraph.\\n\\nSecond paragraph.", "imageScene": "Zeke doing something related to the news"}`,
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = JSON.parse(tweetResponse.text);

    // Clean up tweet (no truncation - user prefers longer posts)
    let cleanTweet = (result.tweet || "")
      .replace(/#\w+/g, '')
      .replace(/[\u{1F600}-\u{1F6FF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();

    // For news posts, we'll keep the source URL separate (for the text file)
    // but add a note that it's sourced news
    if (sourceUrl) {
      cleanTweet += "\n\n📰 Source in replies";
    }

    return {
      text: cleanTweet,
      topic: { theme: "📰 ZK News (This Week)" },
      imagePrompt: result.imageScene || result.imagePrompt || "Zeke celebrating with confetti",
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

Write a clear, accessible post with TWO PARAGRAPHS (400-600 chars total).
Explain concepts simply - like talking to a smart friend who's new to crypto.
No hashtags, no emojis.

Also provide an image scene description for a cartoon mascot character (Zeke in a green hoodie).
The scene should be DIRECTLY related to the post topic - show Zeke doing something that illustrates the concept.
Examples: "Zeke building a shield around a treasure chest", "Zeke running through a maze of transparent walls", "Zeke holding a key that unlocks invisible doors"

JSON format:
{"tweet": "First paragraph here.\\n\\nSecond paragraph here.", "imageScene": "Zeke doing something related to the topic"}`;

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
    // No character limit - user has X Premium (35k chars allowed)
    let cleanTweet = result.tweet
      .replace(/#\w+/g, '')  // Remove hashtags
      .replace(/[\u{1F600}-\u{1F6FF}]/gu, '')  // Remove emojis
      .trim();

    return {
      text: cleanTweet,
      topic: topic,
      imagePrompt: result.imageScene || result.imagePrompt
    };
  } catch (error) {
    console.error("Error generating tweet with Gemini:", error);
    throw error;
  }
}

/**
 * Zeke character description for consistent image generation
 */
const ZEKE_CHARACTER = `A cute cartoon mascot character named Zeke: round friendly face, olive/army green hoodie with a yellow "Z" logo on the chest, cream-colored skin, brown boots, friendly smile, simple cartoon style like a classic mascot`;

/**
 * Enhance an image prompt for better Imagen results
 * Always includes Zeke character in a consistent cartoon style
 * @param {string} basePrompt - The base image description
 * @param {object} topic - The topic object for context
 * @returns {string} Enhanced prompt for image generation
 */
export function enhanceImagePrompt(basePrompt, topic) {
  // Create scene-specific prompt with Zeke as the main character
  return `${ZEKE_CHARACTER}. Scene: ${basePrompt}. Style: cute cartoon illustration, vibrant colors, clean lines, friendly and approachable, digital art, professional mascot art style, consistent character design`;
}

