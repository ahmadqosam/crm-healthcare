FROM node:18-slim
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /usr/src/app

COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install dependencies
RUN npm ci

# Copy source
# Copy source
COPY apps/chat-service apps/chat-service


# Generate Prisma Client
RUN npx prisma generate --schema apps/chat-service/prisma/schema.prisma

# Build
RUN npm run build chat-service

EXPOSE 3002

CMD ["node", "dist/apps/chat-service/main"]
