FROM node:18-slim
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /usr/src/app

COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY apps/auth-service apps/auth-service

# Note: we might not need apps/crm-healthcare but copying root context is safer for monorepo quirks unless scoped

COPY apps/gateway apps/gateway
COPY apps/chat-service apps/chat-service
# In a real monorepo build we would only copy what's needed, but for simplicity in this setup we copy all for now or scope it. 
# actually let's stick to copying everything to ensure simple build:
COPY . .

# Generate Prisma Client
RUN npx prisma generate --schema apps/auth-service/prisma/schema.prisma

# Build
RUN npm run build auth-service

EXPOSE 3001

CMD ["node", "dist/apps/auth-service/main"]
