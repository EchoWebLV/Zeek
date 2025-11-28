import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "../..");

let ai = null;

/**
 * Initialize the Google AI client for Imagen
 */
export function initImagen(apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

/**
 * Load the Zeke sprite as base64
 */
function loadSpriteBase64() {
  const spritePath = path.join(PROJECT_ROOT, "sprite.png");
  if (!fs.existsSync(spritePath)) {
    console.warn("sprite.png not found at:", spritePath);
    return null;
  }
  const spriteBuffer = fs.readFileSync(spritePath);
  return spriteBuffer.toString("base64");
}

/**
 * Generate an image using Gemini 3 Pro Image with Zeke character
 * @param {string} sceneDescription - Description of the scene (tightly connected to post)
 * @param {string} outputPath - Optional path to save the image
 * @returns {Promise<Buffer>} The generated image as a buffer
 */
export async function generateImage(sceneDescription, outputPath = null) {
  if (!ai) {
    throw new Error("Imagen not initialized. Call initImagen() first.");
  }

  console.log("🎨 Generating image with Gemini 3 Pro Image...");
  console.log("   Scene:", sceneDescription.substring(0, 80) + "...");

  // Load the Zeke sprite
  const spriteBase64 = loadSpriteBase64();
  
  const prompt = `Create a cartoon illustration featuring this EXACT character in this scene: ${sceneDescription}

CHARACTER DETAILS (MUST MATCH EXACTLY):
- Name: Zeke
- Face/skin: BEIGE/CREAM color (NOT green, NOT colorful)
- Hoodie: Olive/army GREEN color
- Yellow "Z" logo on the chest
- White cartoon gloves
- Brown boots
- Round friendly face with simple smile
- Hood up on his head

STYLE RULES:
- Match the reference image EXACTLY - same character design
- Clean cartoon mascot style
- Colorful background but character colors stay consistent
- No text in the image
- Friendly and engaging scene`;

  try {
    let contents;
    
    if (spriteBase64) {
      // Use sprite as reference image
      contents = [
        { text: prompt },
        {
          inlineData: {
            mimeType: "image/png",
            data: spriteBase64,
          },
        },
      ];
    } else {
      // Fallback if no sprite
      contents = prompt;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: contents,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "2K",
        },
      },
    });

    // Extract the image from response
    let imageBuffer = null;
    
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const imageData = part.inlineData.data;
        imageBuffer = Buffer.from(imageData, "base64");
        break;
      }
    }

    if (!imageBuffer) {
      throw new Error("No image generated in response");
    }

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
    console.error("Error generating image:", error);
    throw error;
  }
}
