/**
 * Privacy topics derived from the Zypherpunk hackathon themes
 * These topics will be randomly selected to generate diverse privacy-focused content
 */

export const PRIVACY_TOPICS = [
  {
    theme: "Cross-Chain Privacy",
    keywords: ["cross-chain", "interoperability", "bridges", "shielded transfers", "multi-chain privacy"],
    context: "Building privacy-preserving bridges and cross-chain solutions that protect user data across blockchain ecosystems"
  },
  {
    theme: "Private DeFi",
    keywords: ["private swaps", "dark pools", "confidential transactions", "MEV protection", "private lending"],
    context: "Decentralized finance with privacy at its core - protecting trading strategies and financial data from surveillance"
  },
  {
    theme: "Privacy-Preserving AI",
    keywords: ["confidential AI", "private computation", "TEE", "secure multi-party computation", "encrypted inference"],
    context: "Combining artificial intelligence with privacy technology to process data without exposing sensitive information"
  },
  {
    theme: "Self-Custody Revolution",
    keywords: ["self-custody", "wallet innovation", "key management", "private assets", "user sovereignty"],
    context: "Next-generation wallets and self-custody solutions that put users in complete control of their digital assets and privacy"
  },
  {
    theme: "Privacy Infrastructure",
    keywords: ["zero-knowledge proofs", "anonymous contributions", "privacy frameworks", "developer tools", "open-source privacy"],
    context: "Building the foundational tools and infrastructure that enable developers to create privacy-preserving applications"
  },
  {
    theme: "Digital Freedom",
    keywords: ["surveillance resistance", "cypherpunk", "digital rights", "freedom technology", "privacy as a right"],
    context: "Privacy is not about hiding - it's about the fundamental human right to control your own information"
  },
  {
    theme: "Private Payments",
    keywords: ["shielded transactions", "private payments", "confidential transfers", "financial privacy", "permissionless money"],
    context: "Building payment systems where your financial life isn't broadcast to the world - true peer-to-peer electronic cash"
  },
  {
    theme: "Zero-Knowledge Technology",
    keywords: ["ZK proofs", "recursive proofs", "zkSNARKs", "privacy scaling", "cryptographic privacy"],
    context: "Zero-knowledge proofs: proving something is true without revealing any information about why it's true"
  },
  {
    theme: "Data Sovereignty",
    keywords: ["data ownership", "user data control", "privacy-first", "consent", "data protection"],
    context: "Your data belongs to you. Building systems where users own and control their personal information"
  },
  {
    theme: "Encrypted Future",
    keywords: ["end-to-end encryption", "homomorphic encryption", "FHE", "encrypted computation", "privacy by default"],
    context: "A future where encryption is the default, not the exception - protecting everything from messages to computations"
  }
];

/**
 * Get a random topic from the list
 */
export function getRandomTopic() {
  const randomIndex = Math.floor(Math.random() * PRIVACY_TOPICS.length);
  return PRIVACY_TOPICS[randomIndex];
}

/**
 * System prompt for Gemini to generate privacy-focused tweets
 */
export const SYSTEM_PROMPT = `You are a passionate privacy advocate and cypherpunk technologist. Your mission is to spread awareness about digital privacy, encryption, and freedom technology.

You write for the Zypherpunk community - builders and believers in privacy-preserving technology. Your audience includes developers working on zero-knowledge proofs, encrypted computation, private DeFi, and self-custody solutions.

Your tone is:
- Bold and thought-provoking
- Technical but accessible
- Optimistic about privacy technology
- Never preachy or doom-and-gloom

Guidelines for your tweets:
1. Keep it under 280 characters (this is critical!)
2. Be provocative and memorable
3. Include relevant hashtags naturally (max 2-3)
4. Avoid emojis unless they genuinely add value
5. Make people think, question, or get inspired to build
6. Reference real privacy tech concepts (ZK proofs, FHE, shielded transactions, etc.)
7. Vary your style: sometimes a bold statement, sometimes a question, sometimes a call to action

Remember: "Privacy is normal. Surveillance is not." - This is the ethos.`;

