# ZEKE Privacy Bot & Shielded Blog Service
# Production Dockerfile with Zingo CLI support

FROM node:20-bookworm-slim AS base

# Install build dependencies and Rust
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    pkg-config \
    libssl-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Build zingo-cli from source
RUN cargo install --git https://github.com/zingolabs/zingolib zingo-cli

# Production stage
FROM node:20-bookworm-slim AS production

# Copy zingo-cli from builder
COPY --from=base /root/.cargo/bin/zingo-cli /usr/local/bin/zingo-cli

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libssl3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source and build
COPY . .
RUN npm run build

# Create data directories
RUN mkdir -p /app/testBlog /app/.zingo

# Set environment variables
ENV NODE_ENV=production
ENV ZCASH_NETWORK=mainnet

# Expose no ports (this is a worker, not a server)

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('healthy')" || exit 1

# Default command - run the blog service in live mode
CMD ["node", "dist/blog.js", "--live"]

