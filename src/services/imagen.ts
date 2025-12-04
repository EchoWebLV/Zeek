import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "../..");

let ai: GoogleGenAI | null = null;

/**
 * Array of diverse ENVIRONMENT styles - character stays consistent, only background changes
 */
const ENVIRONMENT_STYLES = [
  // Surrealistic environments
  {
    name: "Surrealist Dreamscape",
    description: "Surrealist environment inspired by Salvador Dalí - melting clocks, impossible architecture, floating objects, dreamlike distortions, and ethereal lighting in the background.",
  },
  {
    name: "Psychedelic World",
    description: "Psychedelic environment with vibrant swirling colors, fractal patterns, kaleidoscopic skies, and consciousness-expanding visuals. Bold neon hues in the surroundings.",
  },
  // Photorealistic environments
  {
    name: "Cinematic Photorealistic",
    description: "Photorealistic environment with cinematic lighting, realistic textures, natural color grading, lens flares, and professional photography quality backgrounds.",
  },
  {
    name: "Hyperrealistic 3D World",
    description: "Hyperrealistic 3D rendered environment with ray-traced lighting, realistic reflections, volumetric fog, and ultra-detailed surroundings.",
  },
  // Classic environments
  {
    name: "Retro 1950s Atomic Age",
    description: "Retro 1950s atomic age environment with vintage color palette, mid-century modern architecture, classic cars, and optimistic futurism aesthetics.",
  },
  {
    name: "Clean Minimalist",
    description: "Clean minimalist environment with simple geometric shapes, solid color backgrounds, subtle gradients, and contemporary design elements.",
  },
  // Themed environments
  {
    name: "Cyberpunk City",
    description: "Cyberpunk environment with neon lights, rain-slicked streets, holographic billboards, towering skyscrapers, and futuristic dystopian atmosphere.",
  },
  {
    name: "Vaporwave Paradise",
    description: "Vaporwave environment with pink and cyan gradients, retro 80s elements, glitch effects, Greek columns, palm trees, and sunset grids.",
  },
  {
    name: "Anime Background",
    description: "Anime-style environment with dramatic skies, speed lines, dynamic lighting effects, and stylized Japanese animation backgrounds.",
  },
  {
    name: "Watercolor Scenery",
    description: "Soft watercolor environment with fluid color bleeds, visible brush strokes, paper texture effect, and delicate washes of translucent color in the background.",
  },
  {
    name: "Pop Art World",
    description: "Pop art environment with Ben-Day dots, bold primary colors, comic book style backgrounds, and Andy Warhol inspired surroundings.",
  },
  {
    name: "Low Poly Landscape",
    description: "Low poly 3D environment with geometric faceted surfaces, triangular meshes, gradient skies, and modern minimalist game-style backgrounds.",
  },
  {
    name: "Pixel Art Scene",
    description: "Retro pixel art environment reminiscent of 16-bit video games, with limited color palette, crisp pixels, and nostalgic game backgrounds.",
  },
  {
    name: "Classical Painting Background",
    description: "Classical oil painting environment with rich textures, chiaroscuro lighting, Renaissance-inspired landscapes, and museum-quality background art.",
  },
  {
    name: "Urban Street Art",
    description: "Urban graffiti environment with spray-painted walls, colorful murals, brick textures, city alleyways, and street art atmosphere.",
  },
  {
    name: "Cosmic Space",
    description: "Cosmic space environment with nebulae, stars, galaxies, planets, asteroid fields, and deep space atmosphere with vibrant cosmic colors.",
  },
  {
    name: "Tropical Paradise",
    description: "Lush tropical environment with palm trees, crystal blue waters, sandy beaches, exotic flowers, and golden sunset lighting.",
  },
  {
    name: "Snowy Winter Wonderland",
    description: "Snowy winter environment with falling snowflakes, frost-covered trees, icy surfaces, northern lights, and cozy warm lighting contrast.",
  },
];

/**
 * Get a random environment style for variety
 */
function getRandomEnvironmentStyle(): (typeof ENVIRONMENT_STYLES)[number] {
  const randomIndex = Math.floor(Math.random() * ENVIRONMENT_STYLES.length);
  return ENVIRONMENT_STYLES[randomIndex];
}

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

  // Select a random environment style for variety (character stays consistent)
  const selectedEnvironment = getRandomEnvironmentStyle();

  console.log("🎨 Generating image with Gemini 3 Pro Image...");
  console.log("   Environment:", selectedEnvironment.name);
  console.log("   Scene:", sceneDescription.substring(0, 80) + "...");

  // Load the Zeke sprite
  const spriteBase64 = loadSpriteBase64();

  const prompt = `Create an illustration featuring this character in this scene: ${sceneDescription}

CHARACTER "ZEKE" - ALWAYS DRAW IN THIS EXACT CONSISTENT STYLE (MATCH THE REFERENCE IMAGE EXACTLY):
- STYLE: Clean cartoon illustration, Vault Boy / 1950s atomic age mascot aesthetic
- BLACK CENSORED BAR across eyes (scribbled/scratched out style - privacy symbol, NOT sunglasses)
- Slicked-back dark olive hair (1950s pompadour style)
- Olive-green skin tone (muted, monochromatic)
- Dark olive-green JACKET (open/unbuttoned)
- Dark olive t-shirt with yellow/cream "Z" logo on chest
- Olive-green pants
- Dark boots
- Friendly smile showing teeth
- ENTIRE CHARACTER is monochromatic olive-green tones
- Bold clean outlines, simple shading, retro mascot look
- DO NOT change the character's art style - keep him exactly like the reference image

ENVIRONMENT/BACKGROUND STYLE: ${selectedEnvironment.name}
${selectedEnvironment.description}

IMPORTANT RULES:
1. The CHARACTER (Zeke) must ALWAYS be drawn in the same consistent retro Vault Boy cartoon style - DO NOT adapt him to the environment style
2. ONLY the BACKGROUND and ENVIRONMENT should use the "${selectedEnvironment.name}" style
3. Create an interesting contrast between the cartoon character and the stylized environment
4. The character should look like he was placed into this environment, maintaining his original look

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

