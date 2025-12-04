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
    "Zcash cryptocurrency news this week",
    "Starknet network updates",
    "zero knowledge rollup developments",
    "NEAR Protocol privacy features",
    "Aztec Network news",
    "Miden VM developments",
    "Fhenix FHE blockchain news",
    "Nillion confidential compute news",
    "zkSNARKs zkSTARKs technology news",
    "private DeFi protocol launches",
    "Mina Protocol updates",
    "Arcium encrypted compute news",
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

Write a punchy news update. TWO PARAGRAPHS only:
- Paragraph 1: What happened (2-3 short sentences)
- Paragraph 2: Why it matters (2-3 short sentences, end strong)

Keep total length 250-400 chars MAX. Short sentences. Direct.

STYLE:
- Punchy and engaging, not dry
- Simple words, short sentences
- NO hashtags, NO emojis, NO em dashes (—)
- NO academic language ("utilizing", "significant", "infrastructure")

Also describe an image scene for Zeke (retro Vault Boy mascot with black censored bar over eyes, olive-green monochromatic, yellow Z logo shirt).

JSON format only:
{"tweet": "Paragraph 1.\\n\\nParagraph 2.\\n\\nParagraph 3.", "imageScene": "Zeke [action related to news]"}`,
      config: {
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(tweetResponse.text ?? "{}") as GeminiTweetResponse;

    // Clean up tweet (no truncation - user prefers longer posts)
    let cleanTweet = (result.tweet || "")
      .replace(/#\w+/g, "") // Remove hashtags
      .replace(/[\u{1F600}-\u{1F6FF}]/gu, "") // Remove emojis
      .replace(/—/g, ", ") // Replace em dashes
      .replace(/–/g, ", ") // Replace en dashes
      .replace(/\s+/g, " ")
      .trim();

    // Add source URL to the tweet
    if (sourceUrl) {
      cleanTweet += `\n\n📰 ${sourceUrl}`;
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

Write a punchy take on this topic. TWO PARAGRAPHS only:
- Paragraph 1: The problem or observation (2-3 short sentences)
- Paragraph 2: The insight or solution (2-3 sentences, end with punch)

Keep total length 250-400 chars MAX. Short sentences. Direct.
NO hashtags, NO emojis, NO em dashes (—). NO academic words.

Also describe an image scene for Zeke (retro Vault Boy mascot with black censored bar over eyes, olive-green monochromatic, yellow Z logo shirt).

JSON format:
{"tweet": "Paragraph 1.\\n\\nParagraph 2.\\n\\nParagraph 3.", "imageScene": "Zeke [action]"}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const result = JSON.parse(response.text ?? "{}") as GeminiTweetResponse;

    // Clean up: remove hashtags, emojis, and em dashes
    const cleanTweet = result.tweet
      .replace(/#\w+/g, "") // Remove hashtags
      .replace(/[\u{1F600}-\u{1F6FF}]/gu, "") // Remove emojis
      .replace(/—/g, ", ") // Replace em dashes with commas
      .replace(/–/g, ", ") // Replace en dashes too
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

  const prompt = `Provide analysis on this topic requested via Zcash payment:

TOPIC: "${memoTopic}"

Analyze it. TWO PARAGRAPHS:
- Paragraph 1: The key insight (2-3 sentences)
- Paragraph 2: What it means (2-3 sentences)

Keep total length 250-400 chars MAX. Sharp and direct.
NO hashtags, NO emojis, NO em dashes (—).

Describe an image scene for Zeke (retro Vault Boy mascot with black censored bar over eyes, olive-green monochromatic, yellow Z logo shirt).
Show Zeke investigating or analyzing something related to the topic.

JSON format:
{"tweet": "Current state.\\n\\nInsights.\\n\\nOutlook.", "imageScene": "Zeke [investigating action]"}`;

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
      .replace(/#\w+/g, "") // Remove hashtags
      .replace(/[\u{1F600}-\u{1F6FF}]/gu, "") // Remove emojis
      .replace(/—/g, ", ") // Replace em dashes
      .replace(/–/g, ", ") // Replace en dashes
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
 * Generate a privacy Tip tweet - ZK/Zcash focused
 */
export async function generateTipTweet(): Promise<TweetData> {
  if (!ai) throw new Error("Gemini not initialized");

  const tipTopics = [
    "using Zcash shielded transactions",
    "protecting transaction metadata",
    "avoiding address reuse in crypto",
    "setting up a hardware wallet for Zcash",
    "using viewing keys for auditing",
    "choosing between transparent and shielded pools",
    "private DeFi best practices",
    "cross-chain privacy when bridging",
    "securing your seed phrase",
    "using encrypted memos in Zcash",
    "privacy when using DEXs",
    "ZK wallet security tips",
  ];
  const topic = tipTopics[Math.floor(Math.random() * tipTopics.length)];

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Give a practical crypto privacy tip about: ${topic}

Write a quick, useful tip. TWO PARAGRAPHS:
- Paragraph 1: The tip (1-2 direct sentences)
- Paragraph 2: Why it works (1-2 sentences)

Keep total length 150-300 chars MAX. Be direct.
NO hashtags, NO emojis, NO em dashes (—).

Also describe an image scene for Zeke (retro Vault Boy mascot with black censored bar over eyes, olive-green monochromatic) demonstrating the tip.

JSON: {"tweet": "Paragraph 1.\\n\\nParagraph 2.", "imageScene": "Zeke [demonstrating tip]"}`,
    config: { responseMimeType: "application/json" },
  });

  const result = JSON.parse(response.text ?? "{}");
  return {
    text: cleanText(result.tweet),
    topic: { theme: `Tip: ${topic}`, context: topic },
    imagePrompt: result.imageScene || "",
    postType: "tip",
  };
}

/**
 * Generate a Question tweet - ZK/privacy focused discussion
 */
export async function generateQuestionTweet(): Promise<TweetData> {
  if (!ai) throw new Error("Gemini not initialized");

  const questionThemes = [
    "ZK rollups vs privacy chains",
    "Zcash shielded adoption",
    "cross-chain privacy tradeoffs",
    "FHE vs ZK proofs",
    "privacy in DeFi",
    "regulatory compliance vs privacy",
    "future of private transactions",
    "Starknet vs Aztec approaches",
    "self-custody challenges",
    "private AI computation",
  ];
  const theme = questionThemes[Math.floor(Math.random() * questionThemes.length)];

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Ask a thought-provoking question about: ${theme}

Ask a thought-provoking question. TWO PARAGRAPHS:
- Paragraph 1: Quick context (1 sentence)
- Paragraph 2: The question (make people think)

Keep total length 100-200 chars MAX. Short and punchy.
NO hashtags, NO emojis, NO em dashes (—).

Also describe an image scene for Zeke (retro Vault Boy mascot with black censored bar over eyes, olive-green monochromatic) looking curious or thinking.

JSON: {"tweet": "Context.\\n\\nThe question?", "imageScene": "Zeke [thinking/curious pose]"}`,
    config: { responseMimeType: "application/json" },
  });

  const result = JSON.parse(response.text ?? "{}");
  return {
    text: cleanText(result.tweet),
    topic: { theme: "Community Question", context: theme },
    imagePrompt: result.imageScene || "",
    postType: "question",
  };
}

/**
 * Generate a Quote tweet - cypherpunk/ZK community focused
 */
export async function generateQuoteTweet(): Promise<TweetData> {
  if (!ai) throw new Error("Gemini not initialized");

  const quoteSources = [
    "Zooko Wilcox quotes about privacy",
    "cypherpunk manifesto quotes",
    "Eric Hughes privacy quotes",
    "Vitalik Buterin on ZK proofs",
    "Eli Ben-Sasson on zero knowledge",
    "Edward Snowden on privacy",
    "Tim May crypto anarchy quotes",
    "Nick Szabo on cryptography",
    "Balaji Srinivasan on privacy tech",
  ];
  const source = quoteSources[Math.floor(Math.random() * quoteSources.length)];

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Search for a real quote: ${source}

Must be a REAL quote. TWO PARAGRAPHS:
- Paragraph 1: The quote with attribution
- Paragraph 2: One punchy sentence on why it matters now

Keep total length 200-350 chars MAX.
NO hashtags, NO emojis, NO em dashes (—).

Also describe an image scene for Zeke (retro Vault Boy mascot with black censored bar over eyes, olive-green monochromatic) inspired by the quote.

JSON: {"tweet": "\\"The quote here.\\" - Author Name\\n\\nWhy this matters today.", "imageScene": "Zeke [action related to quote]"}`,
    config: { 
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
    },
  });

  const result = JSON.parse(response.text ?? "{}");
  return {
    text: cleanText(result.tweet),
    topic: { theme: "Quote", context: source },
    imagePrompt: result.imageScene || "",
    postType: "quote",
  };
}

/**
 * Generate a Prediction tweet - ZK/privacy future focused
 */
export async function generatePredictionTweet(): Promise<TweetData> {
  if (!ai) throw new Error("Gemini not initialized");

  const predictionTopics = [
    "Zcash shielded adoption",
    "ZK rollup dominance",
    "privacy by default in crypto",
    "Starknet ecosystem growth",
    "FHE mainstream adoption",
    "cross-chain privacy bridges",
    "private DeFi market size",
    "NEAR privacy features",
    "Aztec and Miden development",
    "regulatory approach to privacy coins",
  ];
  const topic = predictionTopics[Math.floor(Math.random() * predictionTopics.length)];
  
  const timeframes = ["by end of 2025", "in the next 2 years", "by 2027"];
  const timeframe = timeframes[Math.floor(Math.random() * timeframes.length)];

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Search for current trends about ${topic}, then make a prediction for ${timeframe}.

Make a bold prediction. TWO PARAGRAPHS:
- Paragraph 1: The prediction (direct, confident)
- Paragraph 2: Why you believe this (1-2 sentences)

Keep total length 200-350 chars MAX. Be confident.
NO hashtags, NO emojis, NO em dashes (—).

Also describe an image scene for Zeke (retro Vault Boy mascot with black censored bar over eyes, olive-green monochromatic) looking into the future.

JSON: {"tweet": "Current state.\\n\\nPrediction.\\n\\nReasoning.", "imageScene": "Zeke [futuristic/visionary pose]"}`,
    config: { 
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
    },
  });

  const result = JSON.parse(response.text ?? "{}");
  return {
    text: cleanText(result.tweet),
    topic: { theme: "Prediction", context: `${topic} ${timeframe}` },
    imagePrompt: result.imageScene || "",
    postType: "prediction",
  };
}

/**
 * Generate a Fact tweet - ZK/Zcash statistics focused
 */
export async function generateFactTweet(): Promise<TweetData> {
  if (!ai) throw new Error("Gemini not initialized");

  const factTopics = [
    "Zcash shielded transaction percentage",
    "ZK rollup transaction volume statistics",
    "Starknet network activity data",
    "blockchain analysis company tracking rates",
    "cryptocurrency privacy adoption statistics",
    "NEAR Protocol usage statistics",
    "zero knowledge proof computation costs",
    "Ethereum L2 privacy features",
    "private DeFi total value locked",
    "Chainalysis cryptocurrency surveillance data",
  ];
  const topic = factTopics[Math.floor(Math.random() * factTopics.length)];

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Search for a real, current statistic about: ${topic}

Share a surprising fact. TWO PARAGRAPHS:
- Paragraph 1: The fact/stat (short and punchy)
- Paragraph 2: What it means (1-2 sentences)

Keep total length 150-300 chars MAX.
NO hashtags, NO emojis, NO em dashes (—).

Also describe an image scene for Zeke (retro Vault Boy mascot with black censored bar over eyes, olive-green monochromatic) reacting to the fact.

JSON: {"tweet": "The fact.\\n\\nThe implication.", "imageScene": "Zeke [reaction to surprising info]"}`,
    config: { 
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
    },
  });

  const result = JSON.parse(response.text ?? "{}");
  return {
    text: cleanText(result.tweet),
    topic: { theme: "Fact", context: topic },
    imagePrompt: result.imageScene || "",
    postType: "fact",
  };
}

/**
 * Generate a Celebration tweet - ZK/Zcash ecosystem wins
 */
export async function generateCelebrationTweet(): Promise<TweetData> {
  if (!ai) throw new Error("Gemini not initialized");

  const celebrationTopics = [
    "Zcash network upgrade news",
    "Starknet ecosystem milestone",
    "ZK rollup adoption achievement",
    "NEAR Protocol privacy feature launch",
    "Aztec network development progress",
    "Mina Protocol update",
    "zero knowledge technology breakthrough",
    "privacy DeFi protocol launch",
    "Fhenix FHE development",
    "Nillion confidential compute news",
  ];
  const topic = celebrationTopics[Math.floor(Math.random() * celebrationTopics.length)];

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Search for recent positive news about: ${topic}

Celebrate a win. TWO PARAGRAPHS:
- Paragraph 1: What happened (1-2 sentences)
- Paragraph 2: Why it matters (1-2 sentences)

Keep total length 150-300 chars MAX. Positive energy.
NO hashtags, NO emojis, NO em dashes (—).

Also describe an image scene for Zeke (retro Vault Boy mascot with black censored bar over eyes, olive-green monochromatic) celebrating.

JSON: {"tweet": "The achievement.\\n\\nThe significance.", "imageScene": "Zeke [celebrating/excited pose]"}`,
    config: { 
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
    },
  });

  const result = JSON.parse(response.text ?? "{}");
  return {
    text: cleanText(result.tweet),
    topic: { theme: "Celebration", context: "" },
    imagePrompt: result.imageScene || "",
    postType: "celebration",
  };
}

/**
 * Generate a Hot Take tweet - ZK/privacy controversial opinions
 */
export async function generateHotTakeTweet(): Promise<TweetData> {
  if (!ai) throw new Error("Gemini not initialized");

  const hotTakeTopics = [
    "privacy coins vs transparent chains",
    "ZK rollups vs optimistic rollups",
    "Zcash vs Monero approach",
    "DeFi privacy requirements",
    "L1 vs L2 privacy solutions",
    "compliant privacy vs true privacy",
    "centralized exchanges and privacy",
    "stablecoin transparency requirements",
    "privacy as a feature vs default",
    "Ethereum privacy roadmap",
  ];
  const topic = hotTakeTopics[Math.floor(Math.random() * hotTakeTopics.length)];

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Share a strong opinion about: ${topic}

State your opinion boldly. TWO PARAGRAPHS:
- Paragraph 1: The take (direct, no hedging)
- Paragraph 2: Why (1-2 sentences)

Keep total length 150-300 chars MAX. Be bold.
NO hashtags, NO emojis, NO em dashes (—).

Also describe an image scene for Zeke (retro Vault Boy mascot with black censored bar over eyes, olive-green monochromatic) looking bold/confident.

JSON: {"tweet": "The position.\\n\\nThe reasoning.", "imageScene": "Zeke [confident/bold pose]"}`,
    config: { responseMimeType: "application/json" },
  });

  const result = JSON.parse(response.text ?? "{}");
  return {
    text: cleanText(result.tweet),
    topic: { theme: "Hot Take", context: topic },
    imagePrompt: result.imageScene || "",
    postType: "hottake",
  };
}

/**
 * Generate a Recommendation tweet - ZK/privacy tools and projects
 */
export async function generateRecommendationTweet(): Promise<TweetData> {
  if (!ai) throw new Error("Gemini not initialized");

  const categories = [
    "Zcash wallet like Zashi or YWallet",
    "ZK development framework",
    "privacy-focused DEX",
    "shielded transaction tool",
    "zero knowledge learning resource",
    "privacy browser for crypto",
    "encrypted communication for crypto teams",
    "hardware wallet with Zcash support",
    "ZK rollup explorer or tool",
    "private DeFi protocol",
  ];
  const category = categories[Math.floor(Math.random() * categories.length)];

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Search for and recommend: ${category}

Recommend it. TWO PARAGRAPHS:
- Paragraph 1: What it is (1-2 sentences)
- Paragraph 2: Why use it (1-2 sentences)

Keep total length 150-300 chars MAX. Be specific.
NO hashtags, NO emojis, NO em dashes (—).

Also describe an image scene for Zeke (retro Vault Boy mascot with black censored bar over eyes, olive-green monochromatic) using or recommending the tool.

JSON: {"tweet": "What it is.\\n\\nWhy it's useful.", "imageScene": "Zeke [using/showing tool]"}`,
    config: { 
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
    },
  });

  const result = JSON.parse(response.text ?? "{}");
  return {
    text: cleanText(result.tweet),
    topic: { theme: `Recommendation: ${category}`, context: category },
    imagePrompt: result.imageScene || "",
    postType: "recommendation",
  };
}

/**
 * Generate a Shoutout tweet - ZK/Zcash ecosystem builders
 */
export async function generateShoutoutTweet(): Promise<TweetData> {
  if (!ai) throw new Error("Gemini not initialized");

  const shoutoutTargets = [
    "Zcash core developers and contributors",
    "Starknet ecosystem builders",
    "ZK proof researchers",
    "NEAR Protocol privacy team",
    "Aztec Labs developers",
    "Miden team progress",
    "Electric Coin Company work",
    "Project Tachyon contributors",
    "Fhenix FHE developers",
    "privacy crypto educators",
    "Zcash Community Grants recipients",
  ];
  const target = shoutoutTargets[Math.floor(Math.random() * shoutoutTargets.length)];

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Search for: ${target}

Give a shoutout. TWO PARAGRAPHS:
- Paragraph 1: Who they are (1-2 sentences)
- Paragraph 2: Why they matter (1-2 sentences)

Keep total length 150-300 chars MAX. Be genuine.
NO hashtags, NO emojis, NO em dashes (—).

Also describe an image scene for Zeke (retro Vault Boy mascot with black censored bar over eyes, olive-green monochromatic) giving props/applauding.

JSON: {"tweet": "Who and what.\\n\\nWhy it matters.", "imageScene": "Zeke [applauding/showing respect]"}`,
    config: { 
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
    },
  });

  const result = JSON.parse(response.text ?? "{}");
  return {
    text: cleanText(result.tweet),
    topic: { theme: "Shoutout", context: target },
    imagePrompt: result.imageScene || "",
    postType: "shoutout",
  };
}

/**
 * Clean up tweet text
 */
function cleanText(text: string): string {
  return (text || "")
    .replace(/#\w+/g, "")
    .replace(/[\u{1F600}-\u{1F6FF}]/gu, "")
    .replace(/—/g, ", ")
    .replace(/–/g, ", ")
    .trim();
}

/**
 * Zeke character description for consistent image generation
 */
const ZEKE_CHARACTER = `Retro cartoon mascot "Zeke": BLACK CENSORED BAR across eyes (scribbled privacy symbol), slicked-back dark olive hair, monochromatic olive-green skin and clothes, dark olive jacket (open), olive t-shirt with yellow "Z" logo, olive pants, dark boots, friendly smile. Vault Boy style`;

/**
 * Enhance an image prompt for better Imagen results
 * Always includes Zeke character in a consistent cartoon style
 */
export function enhanceImagePrompt(basePrompt: string, _topic: PrivacyTopic): string {
  // Create scene-specific prompt with Zeke as the main character
  return `${ZEKE_CHARACTER}. Scene: ${basePrompt}. Style: colorful cartoon illustration, Zeke stays monochromatic olive-green but background is vibrant and creative`;
}

