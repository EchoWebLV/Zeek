/**
 * Privacy topics derived from the Zypherpunk hackathon - HIGHLY SPECIFIC
 * Each topic is unique to avoid repetition
 */

export const PRIVACY_TOPICS = [
  // Cross-Chain Privacy
  {
    theme: "Shielded Cross-Chain Bridges",
    context: "Building bridges where assets move between chains but transaction history stays private. Unlike glass tunnels, cryptographic wormholes."
  },
  {
    theme: "NEAR Intents for Private DeFi",
    context: "Using NEAR's intent system to let Zcash holders access DeFi across chains without exposing their transaction graph."
  },
  {
    theme: "ZEC-Backed Stablecoins",
    context: "Creating stablecoins backed by shielded Zcash - private collateral for a private stablecoin."
  },
  
  // Private DeFi
  {
    theme: "Dark Pools on Chain",
    context: "Trading venues where orders remain hidden until execution. No front-running, no MEV extraction, no surveillance."
  },
  {
    theme: "Private Perpetuals",
    context: "Leveraged trading without broadcasting your position to the world. Your strategy stays yours."
  },
  {
    theme: "Confidential Lending",
    context: "Borrow and lend without your credit activity becoming public record on a transparent blockchain."
  },
  
  // Privacy-Preserving AI
  {
    theme: "TEE-Based AI Inference",
    context: "Running AI models inside trusted execution environments where the server computes but never sees your data."
  },
  {
    theme: "Agentic Privacy",
    context: "AI agents that manage your finances privately - they act on your behalf without knowing your secrets."
  },
  {
    theme: "Encrypted Model Training",
    context: "Training AI on private data using homomorphic encryption. The model learns without the data ever being exposed."
  },
  
  // Self-Custody & Wallets
  {
    theme: "Shielded Multi-Chain Wallets",
    context: "One wallet interface for both Zcash shielded pools and other chains. Privacy across ecosystems."
  },
  {
    theme: "Atomic Swaps Without Traces",
    context: "Exchange assets directly between chains without intermediaries or on-chain footprints."
  },
  {
    theme: "Viewing Keys for Auditability",
    context: "Prove your transactions to who you choose, when you choose. Selective transparency on your terms."
  },
  
  // Privacy Infrastructure
  {
    theme: "Recursive ZK Proofs",
    context: "Proofs that verify other proofs. Infinite compression of trust without revealing the underlying data."
  },
  {
    theme: "Anonymous Contribution Systems",
    context: "Open source development where contributors can remain private. Code speaks, identity optional."
  },
  {
    theme: "PCZT - Partially Constructed Transactions",
    context: "Building shielded transactions piece by piece across different parties. Collaborative privacy."
  },
  
  // FHE & Advanced Crypto
  {
    theme: "Fully Homomorphic Encryption",
    context: "Compute on encrypted data without decrypting. The server processes what it cannot read."
  },
  {
    theme: "Private Analytics with FHE",
    context: "Aggregate insights from encrypted datasets. Statistics without surveillance."
  },
  {
    theme: "Proof of Innocence",
    context: "Prove you're not on a sanctions list without revealing who you are. Compliance without doxxing."
  },
  
  // Specific Tech
  {
    theme: "Ztarknet - Privacy on Starknet",
    context: "Bringing Zcash-level privacy to Starknet using Noir contracts and recursive proofs."
  },
  {
    theme: "Miden Private Compute",
    context: "Client-side proving with Miden VM. Your transactions are proven locally before broadcast."
  },
  {
    theme: "Pasta Curves Cryptography",
    context: "The mathematical foundation powering both Zcash and Mina. Curves designed for recursive privacy."
  },
  
  // Philosophy & Vision
  {
    theme: "Privacy as Protocol",
    context: "Freedom isn't granted by institutions. It's encoded in mathematics and enforced by cryptography."
  },
  {
    theme: "Surveillance Resistance",
    context: "Every transaction you make tells a story. Privacy tech lets you choose who reads it."
  },
  {
    theme: "The Cypherpunk Mandate",
    context: "We build the tools of freedom. Not because they're needed today, but because they'll be essential tomorrow."
  },
  {
    theme: "Data Sovereignty",
    context: "Your information belongs to you. Full stop. No terms of service, no data harvesting, no exceptions."
  },
  {
    theme: "Permissionless Privacy",
    context: "Privacy shouldn't require approval. It should be the default state of digital existence."
  },
  
  // Use Cases
  {
    theme: "Private Philanthropy",
    context: "Donate to causes you believe in without broadcasting your beliefs to the world."
  },
  {
    theme: "Confidential Payroll",
    context: "Pay your team without everyone knowing everyone's salary. Business privacy is personal privacy."
  },
  {
    theme: "Shielded Remittances",
    context: "Send money home without creating a surveillance trail. Family support shouldn't be public record."
  },
  {
    theme: "Private Identity Verification",
    context: "Prove you're over 18 without revealing your birthday. Prove citizenship without showing your passport."
  },
  {
    theme: "Confidential Voting",
    context: "Onchain governance where votes are private but results are verifiable. Democracy without coercion."
  }
];

// Track used topics to avoid repetition
let usedTopicIndices = new Set();

/**
 * Get a random topic, avoiding recently used ones
 */
export function getRandomTopic() {
  // Reset if we've used most topics
  if (usedTopicIndices.size >= PRIVACY_TOPICS.length - 5) {
    usedTopicIndices.clear();
  }
  
  let randomIndex;
  do {
    randomIndex = Math.floor(Math.random() * PRIVACY_TOPICS.length);
  } while (usedTopicIndices.has(randomIndex));
  
  usedTopicIndices.add(randomIndex);
  return PRIVACY_TOPICS[randomIndex];
}

/**
 * System prompt for Gemini - ACCESSIBLE, TWO PARAGRAPHS
 */
export const SYSTEM_PROMPT = `You are a privacy advocate making complex tech accessible. Write for curious newcomers AND builders.

FORMAT:
- Write TWO clear paragraphs (3-4 sentences each)
- First paragraph: The problem or observation - explain why this matters
- Second paragraph: The solution or insight - what's being built to fix it
- Keep it around 400-600 characters total
- Separate paragraphs with a blank line

STYLE:
- Explain technical concepts simply (like explaining to a smart friend)
- Use analogies when helpful
- Be bold but accessible
- NO hashtags, NO emojis
- Sound passionate, not academic

Example:
"Most blockchains are like sending postcards - everyone along the way can read your message. Your transactions, balances, and who you're paying are all visible to anyone who looks. That's not freedom, that's a surveillance system with extra steps.

Zero-knowledge proofs change everything. They let you prove a transaction is valid without revealing any details. Think of it like proving you're over 21 without showing your ID. We're building financial privacy that actually works."

Avoid:
- Jargon without explanation
- Overly academic tone
- Hashtags or emojis`;
