FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    STOREFRONT_RENDERED_SCAN_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      chromium \
      dumb-init \
      fonts-liberation \
      gosu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY . .
RUN mkdir -p /app/assets \
    && chown -R node:node /app \
    && chmod 0755 /app/docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["dumb-init", "--", "/app/docker-entrypoint.sh"]
CMD ["npm", "start"]
