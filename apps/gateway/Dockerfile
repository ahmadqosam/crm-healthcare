FROM node:18-slim
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /usr/src/app

COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY apps/gateway apps/gateway

# Build
RUN npm run build gateway

EXPOSE 3000

CMD ["node", "dist/apps/gateway/main"]
