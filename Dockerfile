# ZEKE Privacy Bot with Zingo CLI
# Production Dockerfile - enables shielded message analytics

# =============================================================================
# Stage 1: Build Zingo CLI from source
# =============================================================================
FROM rust:1.75-bookworm AS zingo-builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    git \
    cmake \
    libssl-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Clone and build zingo-cli
RUN git clone --depth 1 https://github.com/zingolabs/zingolib.git
WORKDIR /build/zingolib
RUN cargo build --release --bin zingo-cli

# =============================================================================
# Stage 2: Build Node.js application
# =============================================================================
FROM node:20-slim AS node-builder

# Install build dependencies for native modules (sharp)
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

# =============================================================================
# Stage 3: Production runtime
# =============================================================================
FROM node:20-slim AS production

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libvips42 \
    libssl3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy zingo-cli binary from builder
COPY --from=zingo-builder /build/zingolib/target/release/zingo-cli /usr/local/bin/zingo-cli
RUN chmod +x /usr/local/bin/zingo-cli

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built files from node builder
COPY --from=node-builder /app/dist ./dist

# Copy proto files (needed for lightclient gRPC)
COPY proto ./proto

# Copy sprite image
COPY sprite.png ./sprite.png

# Create data directories
RUN mkdir -p /app/test /app/testBlog /app/.zingo

# Set environment
ENV NODE_ENV=production
ENV PATH="/usr/local/bin:${PATH}"

# Verify zingo-cli is available
RUN zingo-cli --version || echo "Warning: zingo-cli version check failed"

# Run the bot
CMD ["node", "dist/index.js"]
