import { TwitterApi } from "twitter-api-v2";
import type { TwitterCredentials } from "../types.js";

let client: TwitterApi | null = null;

/**
 * Initialize the Twitter/X client
 */
export function initTwitter(credentials: TwitterCredentials): void {
  client = new TwitterApi({
    appKey: credentials.apiKey,
    appSecret: credentials.apiSecret,
    accessToken: credentials.accessToken,
    accessSecret: credentials.accessSecret,
  });
}

interface TweetResponse {
  data: {
    id: string;
    text?: string;
  };
}

/**
 * Post a tweet with an image
 */
export async function postTweetWithImage(
  text: string,
  imageBuffer: Buffer
): Promise<TweetResponse> {
  if (!client) {
    throw new Error("Twitter client not initialized. Call initTwitter() first.");
  }

  console.log("🐦 Posting to X...");
  console.log("   Tweet:", text.substring(0, 50) + "...");

  try {
    // Upload the media first
    const mediaId = await client.v1.uploadMedia(imageBuffer, {
      mimeType: "image/png",
    });

    // Post the tweet with the media
    const tweet = await client.v2.tweet({
      text: text,
      media: {
        media_ids: [mediaId],
      },
    });

    console.log("   ✅ Tweet posted successfully!");
    console.log("   Tweet ID:", tweet.data.id);

    return tweet;
  } catch (error) {
    console.error("Error posting tweet:", error);
    throw error;
  }
}

/**
 * Post a text-only tweet
 */
export async function postTweet(text: string): Promise<TweetResponse> {
  if (!client) {
    throw new Error("Twitter client not initialized. Call initTwitter() first.");
  }

  try {
    const tweet = await client.v2.tweet(text);
    console.log("   ✅ Tweet posted successfully!");
    return tweet;
  } catch (error) {
    console.error("Error posting tweet:", error);
    throw error;
  }
}

/**
 * Verify Twitter credentials
 */
export async function verifyCredentials(): Promise<boolean> {
  if (!client) {
    return false;
  }

  try {
    const me = await client.v2.me();
    console.log("   ✅ Twitter authenticated as:", me.data.username);
    return true;
  } catch (error) {
    console.error("Twitter authentication failed:", error);
    return false;
  }
}

