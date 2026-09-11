# =======================================================
# Production Dockerfile for EM Furniture & Interior API
# =======================================================
FROM node:20-bookworm-slim AS base

# Install Chromium dependencies for Puppeteer PDF rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    ca-certificates \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to use the installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    PORT=10000

WORKDIR /app

# Copy root workspace configurations
COPY package*.json ./
COPY .puppeteerrc.cjs ./

# Copy packages and API app
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Install production dependencies across workspaces
RUN npm ci --omit=dev

# Non-root user for security
RUN chown -R node:node /app
USER node

EXPOSE 10000

# dumb-init handles PID 1 and gracefully forwards SIGTERM/SIGINT signals
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Launch server
CMD ["npm", "run", "start"]
