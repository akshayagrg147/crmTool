FROM node:20-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src
RUN mkdir -p /data && chown -R node:node /app /data

USER node
EXPOSE 3001
VOLUME ["/data"]

CMD ["node", "src/index.js"]
