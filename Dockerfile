# 第一阶段：构建
FROM node:18-alpine AS builder

WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 第二阶段：运行
FROM node:18-alpine

WORKDIR /app

# 复制 package.json
COPY package*.json ./

# 只安装生产依赖
RUN npm ci --only=production

# 从构建阶段复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npx", "serve@latest", "dist", "-l", "3000"]
