/**
 * Core types for ZEKE Privacy Bot
 */

/** A privacy topic for content generation */
export interface PrivacyTopic {
  theme: string;
  context: string;
}

/** Generated tweet data */
export interface TweetData {
  text: string;
  topic: PrivacyTopic;
  imagePrompt: string;
  sourceUrl?: string;
  isNews?: boolean;
}

/** Twitter API credentials */
export interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

/** Application configuration */
export interface AppConfig {
  googleApiKey: string;
  twitter: TwitterCredentials;
  isLocalMode: boolean;
  testDir: string;
}

/** Result from posting or generating content */
export interface GenerationResult {
  success: boolean;
  tweet: string;
  topic: string;
  imagePath: string | null;
  tweetId?: string;
  tweetUrl?: string;
}

/** Gemini JSON response for tweet generation */
export interface GeminiTweetResponse {
  tweet: string;
  imageScene?: string;
  imagePrompt?: string;
}

