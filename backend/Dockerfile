FROM node:20-bookworm-slim

WORKDIR /app

# Install only production dependencies.
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source.
COPY . .

ENV NODE_ENV=production
ENV PORT=1145

EXPOSE 1145

CMD ["node", "server.js"]
