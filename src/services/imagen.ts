import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "../..");

let ai: GoogleGenAI | null = null;

/**
 * Initialize the Google AI client for Imagen
 */
export function initImagen(apiKey: string): void {
  ai = new GoogleGenAI({ apiKey });
}

/**
 * Load the Zeke sprite as base64
 */
function loadSpriteBase64(): string | null {
  const spritePath = path.join(PROJECT_ROOT, "sprite.png");
  if (!fs.existsSync(spritePath)) {
    console.warn("sprite.png not found at:", spritePath);
    return null;
  }
  const spriteBuffer = fs.readFileSync(spritePath);
  return spriteBuffer.toString("base64");
}

interface ImageContent {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface ImageResponsePart {
  text?: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
}

/**
 * Generate an image using Gemini 3 Pro Image with Zeke character
 */
export async function generateImage(
  sceneDescription: string,
  outputPath: string | null = null
): Promise<Buffer> {
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
- ENTIRE CHARACTER HAS A GREEN/OLIVE TINT (monochromatic greenish color scheme)
- DARK ROUND SUNGLASSES (black/dark green, always wearing them)
- Slicked back dark hair (vintage 1950s style)
- GREENISH/OLIVE skin tone (not pink or beige - GREEN tinted!)
- Olive/army GREEN JACKET (open, unbuttoned)
- Darker green T-SHIRT underneath with yellow/gold "Z" logo
- Olive/army green pants
- Dark green/olive boots
- Friendly smile, confident pose
- Retro/vintage mascot style (like Vault Boy from Fallout but ALL GREEN)

STYLE RULES:
- THE WHOLE CHARACTER MUST BE GREEN-TINTED (monochromatic olive/green palette)
- Match the reference image color scheme - everything is shades of green/olive
- MUST have the dark round sunglasses
- Clean retro cartoon mascot style
- Colorful background is OK but CHARACTER stays in green tones
- No text in the image
- Friendly and engaging scene`;

  try {
    let contents: string | ImageContent[];

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
    let imageBuffer: Buffer | null = null;

    const parts = response.candidates?.[0]?.content?.parts as ImageResponsePart[] | undefined;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          const imageData = part.inlineData.data;
          imageBuffer = Buffer.from(imageData, "base64");
          break;
        }
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

