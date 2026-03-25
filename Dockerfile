FROM node:18-alpine

WORKDIR /app

# 先复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 构建
RUN npm run build

# 安装 serve
RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "dist", "-l", "3000"]
