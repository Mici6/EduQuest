# EduQuest container: runs anywhere Docker does (Render, Railway, Fly.io, a VPS).
# Data lives in /data, so mount a persistent disk/volume there to keep it.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    EDUQUEST_DATA_DIR=/data \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app ./
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 3000
CMD ["npm", "start"]
