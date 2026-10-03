FROM oven/bun:1 as builder

WORKDIR /app

# Copy source files
COPY package.json .
COPY backend-api.ts .
COPY index.html .

# Install dependencies (bun lockfile will be created)
RUN bun install

# Runtime stage
FROM oven/bun:1

WORKDIR /app

# Copy from builder
COPY --from=builder /app /app

# Expose port 3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the server
CMD ["bun", "backend-api.ts"]

