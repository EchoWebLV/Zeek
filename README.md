# 🔐 ZEKE - Privacy Bot & Shielded Blog Service

A privacy-focused platform with two components:
1. **Twitter Bot**: AI-powered privacy advocacy posts using Gemini 3.0
2. **Shielded Blog Service**: Pay with shielded ZEC to generate long-form privacy articles

Built for the [Zypherpunk Hackathon](https://zypherpunk.com) - "Build the Machinery of Freedom"

## 🚀 Features

### Twitter Bot
- **AI-Powered Text Generation**: Uses Gemini 3.0 to create engaging tweets about privacy technology
- **AI-Generated Images**: Uses Google's Imagen to create visuals with the Zeke mascot
- **ZK News Posts**: Automated news about zero-knowledge technology using Google Search

### Shielded Blog Service (NEW!)
- **Pay with Shielded ZEC**: Send a shielded transaction with your topic in the memo
- **Pure Node.js Light Client**: Connects to lightwalletd via gRPC - no Rust required
- **AI Blog Generation**: Generates 1500-2500 word articles using Gemini 3.0
- **Privacy-First**: Your payment and topic request remain private

## 📋 Prerequisites

- Node.js 18+
- Google AI API Key (for Gemini)
- For Live Mode: Zcash Incoming Viewing Key (IVK)

## 🛠️ Setup

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/zeke.git
cd zeke
npm install
```

### 2. Configure Environment Variables

Create a `.env` file:

```env
# Required: Google AI
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# Twitter Bot (Optional)
X_API_KEY=your_x_api_key
X_API_SECRET=your_x_api_secret
X_ACCESS_TOKEN=your_x_access_token
X_ACCESS_SECRET=your_x_access_secret
MODE=local

# Shielded Blog Service (for --live mode)
ZCASH_VIEWING_KEY=your_32_byte_hex_ivk
LIGHTWALLETD_URL=mainnet.lightwalletd.com:9067
ZCASH_NETWORK=mainnet
MIN_PAYMENT_ZEC=0.001
POLL_INTERVAL=30000
```

## 🎮 Usage

### Twitter Bot

```bash
# Generate tweet locally
npm run dev

# Post to X (production)
npm start
```

### Shielded Blog Service

```bash
# Interactive mode - type topics manually
npm run blog

# Demo mode - generate sample posts
npm run blog:demo

# Watch mode - file-based simulation
npm run blog:watch

# LIVE mode - real Zcash network
npm run blog:live
```

#### Live Mode with Real ZEC

1. **Export your Incoming Viewing Key** from Zashi or Ywallet
2. **Add to .env**: `ZCASH_VIEWING_KEY=your_ivk_hex`
3. **Run**: `npm run blog:live`
4. **Send shielded ZEC** with your topic in the memo field
5. **Blog post generated** automatically in `testBlog/`

```bash
# Start from a specific block height
npm run blog:live -- --start=2500000
```

## 📁 Project Structure

```
zeke/
├── src/
│   ├── index.ts              # Twitter bot entry point
│   ├── blog.ts               # Shielded blog service entry point
│   ├── types.ts              # TypeScript types
│   ├── config/
│   │   └── topics.ts         # Privacy topics & prompts
│   ├── crypto/
│   │   └── sapling.ts        # Sapling note decryption (pure JS)
│   └── services/
│       ├── gemini.ts         # Gemini text generation
│       ├── imagen.ts         # Imagen image generation
│       ├── twitter.ts        # X/Twitter posting
│       ├── zcash.ts          # Zcash wallet (demo mode)
│       ├── lightclient.ts    # Zcash light client (live mode)
│       └── blog.ts           # Blog post generation
├── proto/                    # Lightwalletd gRPC protos
├── test/                     # Twitter bot test output
├── testBlog/                 # Blog service output
└── package.json
```

## 🔒 How Shielded Blog Works

```
┌─────────────────────────────────────────────────────────────┐
│                    SHIELDED BLOG FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User sends shielded ZEC with topic in memo               │
│     └── Transaction is private, topic is private             │
│                                                              │
│  2. ZEKE light client syncs via lightwalletd                 │
│     └── Pure Node.js - gRPC + Jubjub crypto                  │
│                                                              │
│  3. Trial decrypts outputs using your viewing key            │
│     └── Only you can see transactions sent to you            │
│                                                              │
│  4. Extracts memo (blog topic) from decrypted note           │
│                                                              │
│  5. Generates 1500-2500 word article with Gemini             │
│                                                              │
│  6. Saves to testBlog/ as .md and .txt                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 🎨 Privacy Topics

The bot covers themes including:
- Zero-Knowledge Proofs
- Cross-Chain Privacy
- Private DeFi & Dark Pools
- Privacy-Preserving AI
- Self-Custody & Wallets
- Homomorphic Encryption
- Shielded Transactions
- Data Sovereignty

## 🔧 Technical Details

### Pure Node.js Zcash Light Client

The light client is implemented entirely in TypeScript/Node.js:

- **gRPC**: Connects to lightwalletd using `@grpc/grpc-js`
- **Jubjub Curve**: Elliptic curve operations for key agreement
- **ChaCha20-Poly1305**: Note decryption using `@noble/ciphers`
- **Blake2b**: Key derivation using `@noble/hashes`

No Rust, no WASM, no CLI tools required!

### Lightwalletd Servers

| Network | Server |
|---------|--------|
| Mainnet | `mainnet.lightwalletd.com:9067` |
| Mainnet (backup) | `na.lightwalletd.com:9067` |
| Testnet | `lightwalletd.testnet.electriccoin.co:9067` |

## ⚠️ Important Notes

- Always test with demo mode first
- Keep your viewing key secure
- The viewing key can only see incoming transactions, not spend funds
- Minimum payment is 0.001 ZEC by default

## 📄 License

MIT

---

**"Privacy is normal. Surveillance is not."**

Built for Zypherpunk 2025 🔐
