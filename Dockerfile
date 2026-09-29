# Executive PA API - single container (Railway auto-detects this Dockerfile).
FROM node:20-alpine
RUN apk add --no-cache openssl

WORKDIR /app/server

# Install dependencies first (better layer caching).
COPY server/package*.json ./
RUN npm ci

# App source + prisma schema, then generate the client.
COPY server/ ./
RUN npx prisma generate

# Set production mode only at runtime (prisma is a devDependency).
# Railway does not inject PORT for Dockerfile deploys - pin it to match EXPOSE
# so the container and Railway's domain routing always agree on the port.
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["node", "src/index.js"]
