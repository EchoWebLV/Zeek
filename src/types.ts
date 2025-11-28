/**
 * Core types for ZEKE Privacy Bot & Shielded Blog Service
 */

// ============================================================
// TWITTER BOT TYPES
// ============================================================

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

// ============================================================
// ZCASH / SHIELDED BLOG TYPES
// ============================================================

/** Zcash wallet configuration */
export interface ZcashConfig {
  /** Light wallet server URL (e.g., lightwalletd.electriccoin.co:9067) */
  lightwalletdUrl: string;
  /** Network: mainnet or testnet */
  network: "mainnet" | "testnet";
  /** Viewing key for scanning incoming transactions */
  viewingKey?: string;
  /** Spending key (only if you need to send) */
  spendingKey?: string;
  /** Poll interval in milliseconds */
  pollInterval: number;
}

/** A shielded transaction with memo */
export interface ShieldedTransaction {
  /** Transaction ID (txid) */
  txid: string;
  /** Block height */
  blockHeight: number;
  /** Timestamp */
  timestamp: Date;
  /** Amount in zatoshis (1 ZEC = 100,000,000 zatoshis) */
  amountZatoshis: bigint;
  /** Amount in ZEC */
  amountZec: number;
  /** Decoded memo (the blog topic request) */
  memo: string;
  /** Whether this transaction has been processed */
  processed: boolean;
}

/** Blog post request extracted from a shielded memo */
export interface BlogRequest {
  /** Unique ID for this request */
  id: string;
  /** The topic/prompt from the memo */
  topic: string;
  /** Source transaction */
  transaction: ShieldedTransaction;
  /** When the request was received */
  receivedAt: Date;
  /** Processing status */
  status: "pending" | "generating" | "completed" | "failed";
  /** Error message if failed */
  error?: string;
}

/** Generated blog post */
export interface BlogPost {
  /** Unique ID matching the request */
  id: string;
  /** The original topic/prompt */
  topic: string;
  /** Generated title */
  title: string;
  /** Generated content (markdown) */
  content: string;
  /** Word count */
  wordCount: number;
  /** Generation timestamp */
  generatedAt: Date;
  /** Source transaction ID */
  txid: string;
  /** Amount paid in ZEC */
  amountPaid: number;
}

/** Blog service configuration */
export interface BlogConfig {
  googleApiKey: string;
  outputDir: string;
  zcash: ZcashConfig;
  /** Minimum payment in ZEC to generate a blog post */
  minPaymentZec: number;
}

/** Gemini response for blog generation */
export interface GeminiBlogResponse {
  title: string;
  content: string;
  summary?: string;
}

/** Lightwalletd gRPC response types */
export interface CompactBlock {
  height: number;
  hash: Uint8Array;
  prevHash: Uint8Array;
  time: number;
  vtx: CompactTx[];
}

export interface CompactTx {
  index: number;
  hash: Uint8Array;
  fee: number;
  spends: CompactSpend[];
  outputs: CompactOutput[];
  actions: CompactAction[];
}

export interface CompactSpend {
  nf: Uint8Array;
}

export interface CompactOutput {
  cmu: Uint8Array;
  epk: Uint8Array;
  ciphertext: Uint8Array;
}

export interface CompactAction {
  nullifier: Uint8Array;
  cmx: Uint8Array;
  ephemeralKey: Uint8Array;
  ciphertext: Uint8Array;
}
