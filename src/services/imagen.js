import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

let ai = null;

/**
 * Initialize the Google AI client for Imagen
 */
export function initImagen(apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

/**
 * Generate an image using Imagen based on the prompt
 * @param {string} prompt - The image generation prompt
 * @param {string} outputPath - Optional path to save the image
 * @returns {Promise<Buffer>} The generated image as a buffer
 */
export async function generateImage(prompt, outputPath = null) {
  if (!ai) {
    throw new Error("Imagen not initialized. Call initImagen() first.");
  }

  console.log("🎨 Generating image with Imagen...");
  console.log("   Prompt:", prompt.substring(0, 100) + "...");

  try {
    const response = await ai.models.generateImages({
      model: "imagen-4.0-generate-001",
      prompt: prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: "16:9", // Good for Twitter/X
      },
    });

    if (!response.generatedImages || response.generatedImages.length === 0) {
      throw new Error("No images generated");
    }

    const imageBytes = response.generatedImages[0].image.imageBytes;
    const imageBuffer = Buffer.from(imageBytes, "base64");

    // Save to file if path provided
    if (outputPath) {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(outputPath, imageBuffer);
      console.log("   ✅ Image saved to:", outputPath);
    }

    return imageBuffer;
  } catch (error) {
    console.error("Error generating image with Imagen:", error);
    throw error;
  }
}

/**
 * Generate a privacy-themed image with predefined style
 * @param {string} concept - The core concept to visualize
 * @returns {Promise<Buffer>} The generated image buffer
 */
export async function generatePrivacyImage(concept, outputPath = null) {
  const prompt = `A visually striking digital art representation of ${concept}. 
Style: Cyberpunk aesthetic with neon accents on dark background, 
featuring abstract geometric shapes, glowing circuits, encrypted data streams, 
and symbols of privacy and security. 
High quality, professional, dramatic lighting, mysterious atmosphere.
No text or words in the image.`;

  return generateImage(prompt, outputPath);
}

