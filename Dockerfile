# ZEKE Privacy Bot
# Production Dockerfile

FROM node:20-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including typescript for build)
RUN npm ci

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-slim AS production

# Install runtime dependencies for sharp
RUN apt-get update && apt-get install -y \
    libvips42 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy sprite image
COPY sprite.png ./sprite.png

# Create data directories
RUN mkdir -p /app/test

# Set environment
ENV NODE_ENV=production

# Run the bot
CMD ["node", "dist/index.js"]
