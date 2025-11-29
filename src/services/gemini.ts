import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT, getRandomTopic } from "../config/topics.js";
import type { TweetData, PrivacyTopic, GeminiTweetResponse } from "../types.js";

let ai: GoogleGenAI | null = null;

/**
 * Initialize the Google AI client
 */
export function initGemini(apiKey: string): void {
  ai = new GoogleGenAI({ apiKey });
}

/**
 * Follow a redirect URL to get the actual destination
 */
async function resolveRedirectUrl(redirectUrl: string): Promise<string> {
  try {
    const response = await fetch(redirectUrl, {
      method: "HEAD",
      redirect: "follow",
    });
    return response.url;
  } catch (error) {
    // If HEAD fails, try GET
    try {
      const response = await fetch(redirectUrl, {
        redirect: "follow",
      });
      return response.url;
    } catch {
      console.warn(
        "Could not resolve redirect URL:",
        error instanceof Error ? error.message : "Unknown error"
      );
      return redirectUrl;
    }
  }
}

/**
 * Generate a ZK news post using Google Search grounding
 */
export async function generateZKNewsPost(): Promise<TweetData> {
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
    "Aztec Network privacy news",
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
      },
    });

    // Get source URL from grounding metadata and resolve redirect
    let sourceUrl: string | undefined;
    const groundingChunks = (
      searchResponse.candidates?.[0] as {
        groundingMetadata?: {
          groundingChunks?: Array<{ web?: { uri?: string } }>;
        };
      }
    )?.groundingMetadata?.groundingChunks;

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
      },
    });

    const result = JSON.parse(tweetResponse.text ?? "{}") as GeminiTweetResponse;

    // Clean up tweet (no truncation - user prefers longer posts)
    let cleanTweet = (result.tweet || "")
      .replace(/#\w+/g, "")
      .replace(/[\u{1F600}-\u{1F6FF}]/gu, "")
      .replace(/\s+/g, " ")
      .trim();

    // For news posts, we'll keep the source URL separate (for the text file)
    // but add a note that it's sourced news
    if (sourceUrl) {
      cleanTweet += "\n\n📰 Source in replies";
    }

    return {
      text: cleanTweet,
      topic: { theme: "📰 ZK News (This Week)", context: "" },
      imagePrompt: result.imageScene || result.imagePrompt || "Zeke celebrating with confetti",
      sourceUrl: sourceUrl,
      isNews: true,
    };
  } catch (error) {
    console.error("Error generating ZK news post:", error);
    throw error;
  }
}

/**
 * Generate a privacy-focused tweet using Gemini 3.0
 */
export async function generatePrivacyTweet(): Promise<TweetData> {
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
      },
    });

    const result = JSON.parse(response.text ?? "{}") as GeminiTweetResponse;

    // Clean up: remove any hashtags and emojis that slipped through
    // No character limit - user has X Premium (35k chars allowed)
    const cleanTweet = result.tweet
      .replace(/#\w+/g, "") // Remove hashtags
      .replace(/[\u{1F600}-\u{1F6FF}]/gu, "") // Remove emojis
      .trim();

    return {
      text: cleanTweet,
      topic: topic,
      imagePrompt: result.imageScene || result.imagePrompt || "",
    };
  } catch (error) {
    console.error("Error generating tweet with Gemini:", error);
    throw error;
  }
}

/**
 * Generate an Analysis tweet based on a memo/topic from a Zcash payment
 */
export async function generateAnalysisTweet(memoTopic: string): Promise<TweetData> {
  if (!ai) {
    throw new Error("Gemini not initialized. Call initGemini() first.");
  }

  const prompt = `You are a privacy technology analyst. A user has paid with shielded Zcash to request an analysis on this topic:

REQUESTED TOPIC: "${memoTopic}"

Write a focused ANALYSIS in TWO PARAGRAPHS (400-600 chars total):
- First paragraph: Current state/problem analysis
- Second paragraph: Your insight/prediction/recommendation

Be analytical and insightful. This is a paid analysis, so provide real value.
No hashtags, no emojis. Professional but accessible tone.

Also provide an image scene description for a cartoon mascot (Zeke in olive-green vintage style).
Show Zeke as an analyst - examining data, reading charts, investigating, etc.

JSON format:
{"tweet": "First paragraph analysis.\\n\\nSecond paragraph insight.", "imageScene": "Zeke analyzing/investigating something related to the topic"}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }], // Use search for up-to-date analysis
      },
    });

    const result = JSON.parse(response.text ?? "{}") as GeminiTweetResponse;

    const cleanTweet = result.tweet
      .replace(/#\w+/g, "")
      .replace(/[\u{1F600}-\u{1F6FF}]/gu, "")
      .trim();

    return {
      text: cleanTweet,
      topic: { theme: `Analysis: ${memoTopic}`, context: memoTopic },
      imagePrompt: result.imageScene || result.imagePrompt || "",
      isAnalysis: true,
    };
  } catch (error) {
    console.error("Error generating analysis tweet:", error);
    throw error;
  }
}

/**
 * Zeke character description for consistent image generation
 */
const ZEKE_CHARACTER = `Retro cartoon mascot "Zeke" in MUTED OLIVE/SEPIA monochromatic style like a vintage military poster: round black sunglasses, slicked-back dark olive hair, olive-tan skin, dark olive leather jacket (open), black t-shirt with yellow "Z", giving thumbs up, confident smile. ENTIRE image uses ONLY muted olive-green and sepia tones - NO bright colors, NO vibrant greens`;

/**
 * Enhance an image prompt for better Imagen results
 * Always includes Zeke character in a consistent cartoon style
 */
export function enhanceImagePrompt(basePrompt: string, _topic: PrivacyTopic): string {
  // Create scene-specific prompt with Zeke as the main character
  return `${ZEKE_CHARACTER}. Scene: ${basePrompt}. Style: vintage propaganda poster, muted olive-sepia color palette, retro cartoon illustration, monochromatic green tones, Fallout Vault Boy inspired, 1950s atomic age aesthetic, NO bright colors`;
}

