# 🔐 ZEKE - Privacy Bot with Shielded Memo Analytics

An AI-powered privacy advocacy bot on X (Twitter) with a unique feature: **pay with shielded ZEC to request on-demand analysis posts**.

Built for the [Zypherpunk Hackathon](https://zypherpunk.com) - "Build the Machinery of Freedom"

## 🚀 Features

### Automated Privacy Content
- **AI-Powered Tweets**: Uses Gemini 3.0 to create engaging posts about privacy technology
- **AI-Generated Images**: Uses Google's Imagen to create visuals with the Zeke mascot
- **ZK News Posts**: Automated news about zero-knowledge technology using Google Search
- **10+ Post Types**: Tips, facts, predictions, hot takes, quotes, shoutouts, recommendations, and more

### Shielded Memo Analytics
- **Pay with Shielded ZEC**: Send a shielded transaction with your topic in the memo
- **On-Demand Analysis**: Your memo topic triggers a public analysis tweet on X
- **Privacy-First**: Your payment and identity remain shielded, only the insight goes public
- **Topic Filtering**: AI validates topics are relevant to ZK/privacy/crypto

## 📋 Prerequisites

- Node.js 18+
- Google AI API Key (for Gemini)
- Twitter/X API credentials
- Zcash wallet seed phrase (for receiving payments)

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
# =============================================================================
# GOOGLE AI (required)
# =============================================================================
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# =============================================================================
# TWITTER/X API (required for posting)
# =============================================================================
X_API_KEY=your_x_api_key
X_API_SECRET=your_x_api_secret
X_ACCESS_TOKEN=your_x_access_token
X_ACCESS_SECRET=your_x_access_secret

# =============================================================================
# ZCASH SHIELDED MESSAGES (for paid analysis feature)
# =============================================================================
# Your 24-word seed phrase (keep this SECRET!)
ZCASH_SEED_PHRASE="word1 word2 word3 ... word24"

# Block height when wallet was created (speeds up initial sync)
ZCASH_WALLET_BIRTHDAY=3163243

# Network: mainnet or testnet
ZCASH_NETWORK=mainnet

# Lightwalletd server
LIGHTWALLETD_URL=https://zec.rocks:443

# Minimum ZEC payment to trigger analysis (default: 0.001)
MIN_PAYMENT_ZEC=0.001

# =============================================================================
# INTERVALS
# =============================================================================
# How often to post tweets (hours)
POST_INTERVAL_HOURS=2

# How often to check for Zcash payments (seconds)
ZCASH_POLL_INTERVAL=60

# =============================================================================
# MODE
# =============================================================================
MODE=production
```

## 🎮 Usage

### Run the Bot

```bash
# Local testing (generates content without posting)
npm run dev

# Production (posts to X + monitors Zcash payments)
npm start
```

### Docker

```bash
# Build and run with Docker Compose
docker-compose up zeke
```

## 💸 How to Request an Analysis

### Step 1: Get ZEKE's Receiving Address

When ZEKE starts, it displays the wallet address:

```
📬 Send ZEC with memo to request analysis:
   u1hrc63764stp5k5e7mcxfwwupuyxte6cvt3p7p5p8x5l3p90shhnafwvey2a4n3epwuy0mcwxwed2j0n0vedjdrygerqkx4ayvqdx490q
```

### Step 2: Send Shielded ZEC with Your Topic

Using **Zashi**, **YWallet**, or any shielded-capable wallet:

1. Open your wallet
2. Tap **Send**
3. Enter ZEKE's **Unified Address**
4. Enter amount: **minimum 0.001 ZEC**
5. Add a **Memo** with your topic:
   - `"What is your opinion about Starknet?"`
   - `"Explain how zero-knowledge proofs work"`
   - `"The future of privacy in AI"`
6. Send the transaction

### Step 3: Analysis Gets Posted to X

```
┌─────────────────────────────────────────────────────────────┐
│  1. Your shielded payment is sent (identity hidden)         │
│  2. ZEKE detects the transaction via Zingo CLI              │
│  3. Decrypts the memo using wallet keys                     │
│  4. Checks topic relevance (ZK, privacy, crypto)            │
│  5. Gemini AI generates analysis + image                    │
│  6. Posts to X: "🔍 A ZK paid memo asks: [topic]"           │
└─────────────────────────────────────────────────────────────┘
```

**Your payment and identity stay shielded—only the insight goes public!**

## 🔒 How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                 SHIELDED MEMO ANALYTICS FLOW                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User sends shielded ZEC with topic in memo                 │
│  └── Payment is private, identity is shielded              │
│                                                             │
│  ZEKE monitors via Zingo CLI + lightwalletd                 │
│  └── Syncs with Zcash blockchain every 60 seconds          │
│                                                             │
│  Decrypts incoming transactions automatically               │
│  └── Only ZEKE can see transactions sent to it             │
│                                                             │
│  Extracts memo (topic request) from transaction             │
│                                                             │
│  Validates topic is relevant to ZK/privacy/crypto           │
│  └── Off-topic requests are politely declined              │
│                                                             │
│  Generates analysis with Gemini AI + image                  │
│                                                             │
│  Posts to X with attribution                                │
│  └── "🔍 A ZK paid memo asks: [topic]"                     │
│                                                             │
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

### Zingo CLI Integration

Production uses [Zingo CLI](https://github.com/zingolabs/zingo-cli) for full wallet functionality:
- Transaction detection and decryption
- Memo extraction from shielded outputs
- Balance monitoring
- Automatic sync with lightwalletd

### Lightwalletd Servers

| Network | Server |
|---------|--------|
| Mainnet | `zec.rocks:443` |
| Mainnet (backup) | `na.lightwalletd.com:9067` |
| Testnet | `lightwalletd.testnet.electriccoin.co:9067` |

## 🚀 Deploying to Railway

### 1. Set Environment Variables

In Railway dashboard or via CLI:

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_AI_API_KEY` | Google AI API key | `AIza...` |
| `X_API_KEY` | Twitter API key | `pKqt...` |
| `X_API_SECRET` | Twitter API secret | `dWej...` |
| `X_ACCESS_TOKEN` | Twitter access token | `1994...` |
| `X_ACCESS_SECRET` | Twitter access secret | `XPBL...` |
| `ZCASH_SEED_PHRASE` | 24-word wallet seed | `"word1 word2..."` |
| `ZCASH_WALLET_BIRTHDAY` | Block height when wallet created | `3163243` |
| `ZCASH_NETWORK` | Network to use | `mainnet` |
| `LIGHTWALLETD_URL` | Lightwalletd server | `https://zec.rocks:443` |
| `MIN_PAYMENT_ZEC` | Minimum payment | `0.001` |
| `POST_INTERVAL_HOURS` | Tweet interval | `2` |
| `ZCASH_POLL_INTERVAL` | Payment check interval (seconds) | `60` |

### 2. Deploy

```bash
railway up
```

Or push to GitHub - Railway will auto-deploy.

### 3. Verify Deployment

Check logs for:
```
🚀 ZEKE Bot starting in continuous mode...
📬 Send ZEC with memo to request analysis:
   u1...  (your wallet address)
💤 Polling for payments every 60s...
```

**Note**: First build takes ~15-20 minutes (compiles Zingo CLI from Rust source).

## ⚠️ Important Notes

- **Keep your seed phrase SECRET** - anyone with it can spend your funds
- The initial Zcash sync may take several minutes
- Minimum payment is 0.001 ZEC by default
- Off-topic requests are rejected (must be ZK/privacy/crypto related)

## 📄 License

MIT

---

**"Privacy is normal. Surveillance is not."**

Built for Zypherpunk 2025 🔐
