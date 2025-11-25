# 🔐 ZEKE - Privacy Bot

A privacy-focused X (Twitter) bot that generates and posts content about digital privacy, encryption, and cypherpunk technology using **Gemini 3.0** for text and **Imagen** for images.

Built for the [Zypherpunk Hackathon](https://zypherpunk.com) - "Build the Machinery of Freedom"

## 🚀 Features

- **AI-Powered Text Generation**: Uses Gemini 3.0 to create engaging, thought-provoking tweets about privacy technology
- **AI-Generated Images**: Uses Google's Imagen to create stunning visuals that complement each tweet
- **Privacy-Focused Topics**: Covers themes like ZK proofs, encrypted computation, private DeFi, self-custody, and more
- **Local Testing Mode**: Generate content locally without posting to X
- **Railway Ready**: Configured for easy deployment on Railway

## 📋 Prerequisites

- Node.js 18+
- Google AI API Key (for Gemini and Imagen)
- X (Twitter) Developer Account with API credentials

## 🛠️ Setup

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/zeke.git
cd zeke
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Google AI API Key (for Gemini 3.0 and Imagen)
GOOGLE_AI_API_KEY=your_google_ai_api_key_here

# X (Twitter) API Credentials
X_API_KEY=your_x_api_key
X_API_SECRET=your_x_api_secret
X_ACCESS_TOKEN=your_x_access_token
X_ACCESS_SECRET=your_x_access_secret

# Mode: "production" or "local"
MODE=local
```

### 3. Get Your API Keys

#### Google AI API Key
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create an API key
3. Enable the Gemini API

#### X (Twitter) API
1. Go to [X Developer Portal](https://developer.twitter.com/)
2. Create a project and app
3. Generate API keys and access tokens
4. Ensure your app has Read and Write permissions

## 🎮 Usage

### Local Testing (Recommended First Step)

Generate a tweet and image locally without posting:

```bash
npm run dev
# or
npm run generate
```

This will:
- Generate a privacy-focused tweet using Gemini
- Create a matching image using Imagen
- Save both to the `/test` folder as `post1.txt` and `post1.jpg`

### Production Mode

Post directly to X:

```bash
npm start
```

Or set `MODE=production` in your `.env` file.

## 🚂 Deploy to Railway

### 1. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Deploy on Railway

1. Go to [Railway](https://railway.app/)
2. Create a new project
3. Connect your GitHub repository
4. Add environment variables in the Railway dashboard:
   - `GOOGLE_AI_API_KEY`
   - `X_API_KEY`
   - `X_API_SECRET`
   - `X_ACCESS_TOKEN`
   - `X_ACCESS_SECRET`
   - `MODE=production`
5. Deploy!

### 3. Set Up Cron (Optional)

For automated posting, use Railway's cron feature or set up a cron trigger:

```bash
# Post every 6 hours
0 */6 * * * npm start
```

## 📁 Project Structure

```
zeke/
├── src/
│   ├── index.js              # Main entry point
│   ├── config/
│   │   └── topics.js         # Privacy topics & prompts
│   └── services/
│       ├── gemini.js         # Gemini 3.0 text generation
│       ├── imagen.js         # Imagen image generation
│       └── twitter.js        # X/Twitter posting
├── test/                     # Local test output (gitignored)
├── .env                      # Environment variables (gitignored)
├── package.json
├── railway.json              # Railway deployment config
└── README.md
```

## 🎨 Privacy Topics

The bot randomly selects from these privacy-focused themes:

- Cross-Chain Privacy
- Private DeFi
- Privacy-Preserving AI
- Self-Custody Revolution
- Privacy Infrastructure
- Digital Freedom
- Private Payments
- Zero-Knowledge Technology
- Data Sovereignty
- Encrypted Future

## 🔧 Customization

### Add New Topics

Edit `src/config/topics.js` to add new themes:

```javascript
{
  theme: "Your Theme",
  keywords: ["keyword1", "keyword2"],
  context: "Description of this privacy topic"
}
```

### Modify Tweet Style

Adjust the `SYSTEM_PROMPT` in `src/config/topics.js` to change the bot's voice and style.

## ⚠️ Important Notes

- Always test locally first with `npm run dev`
- Keep your API keys secure and never commit them
- Respect X's rate limits and terms of service
- The bot generates content about privacy advocacy - ensure compliance with platform policies

## 📄 License

MIT

---

**"Privacy is normal. Surveillance is not."**

Built for Zypherpunk 2025 🔐

