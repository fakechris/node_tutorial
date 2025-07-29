# Node.js 后端教程项目 - 生产级 Dockerfile
FROM node:18-alpine

# 设置作者信息
LABEL maintainer="Back Tutor <back-tutor@example.com>"
LABEL description="Node.js Backend Tutorial - Production Ready Container"
LABEL version="1.0.0"

# 设置工作目录
WORKDIR /app

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 复制package文件并安装依赖
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# 复制应用代码
COPY . .

# 创建必要的目录并设置权限
RUN mkdir -p /app/logs /app/database /app/uploads && \
    chown -R nodejs:nodejs /app

# 切换到非root用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# 启动命令
CMD ["npm", "start"]