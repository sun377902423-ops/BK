# 构建阶段
FROM node:22-bullseye-slim AS builder

WORKDIR /app

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list \
    && apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY src/prisma ./src/prisma/

RUN npm install

RUN npx prisma generate

COPY . .

RUN npm run build

# 生产阶段
FROM node:22-bullseye-slim

WORKDIR /app

ENV NODE_ENV=production

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list \
    && apt-get update && apt-get install -y python3 make g++ postgresql-client sshpass unzip && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/src/prisma ./src/prisma

EXPOSE 3001

CMD ["node", "dist/index.js"]
