# ZakOps Dashboard - Docker Build
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (use install instead of ci for more flexibility)
RUN npm install --legacy-peer-deps

# Build the application
FROM base AS builder
WORKDIR /app

# Build-time environment variables for Next.js
ARG NEXT_PUBLIC_API_URL=http://localhost:8091
ARG NEXT_PUBLIC_AGENT_API_URL=http://localhost:8095
ARG API_URL=http://localhost:8091
ARG BACKEND_URL=http://localhost:8091
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AGENT_API_URL=$NEXT_PUBLIC_AGENT_API_URL
ENV API_URL=$API_URL
ENV BACKEND_URL=$BACKEND_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js with environment variables
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3003

ENV PORT=3003
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
