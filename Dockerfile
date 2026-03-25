FROM node:18-alpine

WORKDIR /app

# 复制所有文件
COPY . .

# 安装依赖
RUN npm install

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npx", "serve", "dist", "-l", "3000"]
