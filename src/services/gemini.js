import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT, getRandomTopic } from "../config/topics.js";

let ai = null;

/**
 * Initialize the Google AI client
 */
export function initGemini(apiKey) {
  ai = new GoogleGenAI({ apiKey });
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

Today's topic: ${topic.theme}
Context: ${topic.context}
Keywords to potentially incorporate: ${topic.keywords.join(", ")}

Generate a single tweet about this topic. The tweet must be under 280 characters.
Also provide a brief image description (1-2 sentences) that would visually complement this tweet - something abstract, futuristic, or symbolic that represents the privacy theme.

Respond in this exact JSON format:
{
  "tweet": "your tweet text here",
  "imagePrompt": "description for the accompanying image"
}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const result = JSON.parse(response.text);
    
    // Validate tweet length
    if (result.tweet.length > 280) {
      console.warn("Tweet exceeded 280 chars, truncating...");
      result.tweet = result.tweet.substring(0, 277) + "...";
    }

    return {
      text: result.tweet,
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

