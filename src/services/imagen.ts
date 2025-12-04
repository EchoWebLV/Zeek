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

  const prompt = `Create a colorful cartoon illustration featuring this character in this scene: ${sceneDescription}

CHARACTER "ZEKE" (MATCH THE REFERENCE IMAGE EXACTLY):
- BLACK CENSORED BAR across eyes (scribbled/scratched out style - privacy symbol, NOT sunglasses)
- Slicked-back dark olive hair (1950s pompadour style)
- Olive-green skin tone (muted, monochromatic)
- Dark olive-green JACKET (open/unbuttoned)
- Dark olive t-shirt with yellow/cream "Z" logo on chest
- Olive-green pants
- Dark boots
- Friendly smile showing teeth
- ENTIRE CHARACTER is monochromatic olive-green tones
- Retro Vault Boy / 1950s atomic age mascot style

BACKGROUND & SCENE:
- Background can be COLORFUL and VIBRANT
- Use any colors that fit the scene (blues, purples, oranges, neons, etc.)
- Be creative with lighting, atmosphere, and mood
- Contrast Zeke's muted olive tones against colorful environments

STYLE: Clean cartoon illustration, Vault Boy inspired, retro 1950s mascot aesthetic

Text is OK when it fits the scene (warning signs, labels, symbols).`;

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

