import type { PrivacyTopic } from "../types.js";

/**
 * Privacy & ZK topics focused on the Zypherpunk Hackathon ecosystem
 * Sponsors: NEAR, Starknet, Mina, Aztec, Miden, Fhenix, Zcash, Arcium, Nillion, etc.
 */
export const PRIVACY_TOPICS: PrivacyTopic[] = [
  // Cross-Chain Privacy (Main Track)
  {
    theme: "Zcash to NEAR Bridges",
    context: "Using NEAR intents to connect Zcash with DeFi across chains while keeping transactions private.",
  },
  {
    theme: "Shielded Cross-Chain Swaps",
    context: "Atomic swaps between Zcash and other chains without exposing transaction history.",
  },
  {
    theme: "ZEC-Backed Stablecoins",
    context: "Building stablecoins collateralized by shielded Zcash on networks like Aztec or Starknet.",
  },
  {
    theme: "Private Bridge Design",
    context: "How to build bridges where assets move between chains but transaction history stays private.",
  },

  // Private DeFi (Arcium, Aztec, Starknet)
  {
    theme: "Dark Pools on Starknet",
    context: "Trading venues using ZK proofs where orders stay hidden until execution. No MEV, no front-running.",
  },
  {
    theme: "Private Perpetuals with Arcium",
    context: "Leveraged trading on Solana where your position size and strategy remain confidential.",
  },
  {
    theme: "Confidential Lending Protocols",
    context: "Borrow and lend without your credit activity becoming public on transparent blockchains.",
  },
  {
    theme: "ZumpFun Concept",
    context: "A privacy-enabled meme launchpad where trading and creator identity stay shielded.",
  },

  // Privacy-Preserving AI (NEAR, Nillion)
  {
    theme: "NEAR AI TEE Inference",
    context: "Running AI models inside trusted execution environments where servers compute but never see your data.",
  },
  {
    theme: "Nillion Private LLMs",
    context: "Using nilAI to build AI apps where your prompts and data stay encrypted throughout.",
  },
  {
    theme: "Agentic Privacy with NEAR",
    context: "AI agents that manage your ZEC privately, spending and trading without knowing your secrets.",
  },
  {
    theme: "FHE for AI Training",
    context: "Training models on encrypted data using Fhenix. The model learns without data exposure.",
  },

  // Self-Custody & Wallets (Core Track)
  {
    theme: "Zcash + Aztec Unified Wallet",
    context: "One wallet interface for both Zcash shielded pools and Aztec private transactions.",
  },
  {
    theme: "Miden WebSDK Integration",
    context: "Bringing Zcash signing capabilities directly into browser wallets via Miden.",
  },
  {
    theme: "Viewing Keys for Compliance",
    context: "Prove your transactions to auditors you choose, when you choose. Selective transparency.",
  },
  {
    theme: "Mobile-First Privacy Wallets",
    context: "Building Zashi-compatible mobile experiences that don't compromise on privacy.",
  },

  // Privacy Infrastructure (Developer Tools)
  {
    theme: "PCZT - Partially Constructed Transactions",
    context: "Building shielded Zcash transactions piece by piece across different parties and devices.",
  },
  {
    theme: "Noir Contracts on Ztarknet",
    context: "Using Noir and Garaga to bring Zcash-level privacy to Starknet applications.",
  },
  {
    theme: "Mina Recursive ZK Proofs",
    context: "Proofs that verify other proofs. Infinite compression of trust for privacy applications.",
  },
  {
    theme: "Anonymous Contribution Systems",
    context: "Open source development where contributors can remain private. Code speaks, identity optional.",
  },

  // FHE & Advanced Crypto (Fhenix, Nillion)
  {
    theme: "Fully Homomorphic Encryption DeFi",
    context: "Fhenix enables computation on encrypted DeFi data. The protocol processes what it cannot read.",
  },
  {
    theme: "Private Analytics with FHE",
    context: "Aggregate insights from encrypted Zcash datasets. Statistics without surveillance.",
  },
  {
    theme: "Proof of Innocence",
    context: "Using FHE to prove you're not on sanctions lists without revealing who you are.",
  },
  {
    theme: "Nillion Confidential Compute",
    context: "nilCC enables secure multi-party computation for private data processing.",
  },

  // Zcash Ecosystem Specific
  {
    theme: "Shielded Memo Applications",
    context: "Creative uses of Zcash memo fields for private messaging, NFTs, and meme creation.",
  },
  {
    theme: "Zcash Block Explorer Innovation",
    context: "Client-side viewing key decryption so shielded transactions stay private during exploration.",
  },
  {
    theme: "Project Tachyon Development",
    context: "Contributing to Zcash core development and the future of shielded transactions.",
  },
  {
    theme: "Transparent to Shielded Migration",
    context: "Tools helping users move from transparent Bitcoin-derived addresses to shielded pools.",
  },

  // Philosophy & Vision
  {
    theme: "Privacy as Protocol",
    context: "Freedom isn't granted by institutions. It's encoded in mathematics and enforced by cryptography.",
  },
  {
    theme: "Beyond the Panopticon",
    context: "Building machinery of freedom. Privacy is normal, surveillance is not.",
  },
  {
    theme: "The Cypherpunk Mandate",
    context: "We build tools of freedom not because they're needed today, but because they'll be essential tomorrow.",
  },
  {
    theme: "Data Sovereignty",
    context: "Your information belongs to you. No terms of service, no data harvesting, no exceptions.",
  },

  // Real Use Cases
  {
    theme: "Private Philanthropy",
    context: "Donate to causes you believe in without broadcasting your beliefs to the world.",
  },
  {
    theme: "Shielded Remittances",
    context: "Send money home without creating a surveillance trail. Family support as private data.",
  },
  {
    theme: "Confidential Voting",
    context: "On-chain governance where votes are private but results are verifiable.",
  },
  {
    theme: "Private Identity Verification",
    context: "Prove you're over 18 without revealing your birthday. Prove citizenship without showing passport.",
  },
];

// Track used topics to avoid repetition
const usedTopicIndices = new Set<number>();

/**
 * Get a random topic, avoiding recently used ones
 */
export function getRandomTopic(): PrivacyTopic {
  // Reset if we've used most topics
  if (usedTopicIndices.size >= PRIVACY_TOPICS.length - 5) {
    usedTopicIndices.clear();
  }

  let randomIndex: number;
  do {
    randomIndex = Math.floor(Math.random() * PRIVACY_TOPICS.length);
  } while (usedTopicIndices.has(randomIndex));

  usedTopicIndices.add(randomIndex);
  return PRIVACY_TOPICS[randomIndex];
}

/**
 * System prompt for Gemini - HUMAN, CONVERSATIONAL, ZK-FOCUSED
 */
export const SYSTEM_PROMPT = `You're a privacy tech enthusiast sharing thoughts about ZK technology, Zcash, and crypto privacy. Write like you're talking to a friend who's curious about this space.

FOCUS AREAS:
- Zero-knowledge proofs (zkSNARKs, zkSTARKs)
- Zcash and shielded transactions
- Privacy in DeFi and cross-chain
- Projects: NEAR, Starknet, Mina, Aztec, Miden, Fhenix, Nillion, Arcium
- The Zypherpunk movement and cypherpunk values

FORMAT:
- TWO short paragraphs (3-4 sentences each)
- Keep it around 400-600 characters total
- Blank line between paragraphs

STYLE:
- Write like a real person, not a press release
- Use "you" and "we" to make it personal
- Simple words, short sentences
- Passionate about privacy but not preachy
- NO hashtags, NO emojis
- NO em dashes (—), use commas or periods instead

NEVER USE:
- Em dashes (—)
- Academic language
- Marketing buzzwords
- Hashtags or emojis`;

/**
 * Search topics for real-time data
 */
export const SEARCH_TOPICS = {
  news: [
    "Zcash cryptocurrency news this week",
    "zero knowledge proof technology news",
    "ZK rollups blockchain developments",
    "Starknet ZK technology updates",
    "NEAR Protocol privacy news",
    "Mina Protocol updates",
    "Aztec Network privacy developments",
    "Fhenix FHE blockchain news",
    "Nillion privacy compute news",
    "privacy blockchain technology updates",
  ],
  facts: [
    "Zcash shielded transaction statistics",
    "zero knowledge proof adoption rates",
    "blockchain privacy statistics",
    "cryptocurrency surveillance data",
    "Starknet transaction volume",
    "NEAR Protocol usage statistics",
  ],
  celebrations: [
    "Zcash ecosystem achievements",
    "ZK rollup milestones",
    "Starknet network upgrades",
    "privacy crypto adoption milestones",
    "zero knowledge technology breakthroughs",
  ],
  recommendations: [
    "best privacy cryptocurrency wallets",
    "top ZK rollup projects",
    "privacy focused DeFi protocols",
    "encrypted messaging apps crypto",
    "self custody wallet solutions",
  ],
  shoutouts: [
    "Zcash developers contributors",
    "zero knowledge proof researchers",
    "privacy technology advocates crypto",
    "Starknet ecosystem builders",
    "cypherpunk movement leaders",
  ],
};
