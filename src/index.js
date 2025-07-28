// 阶段一：项目初始化与框架搭建
// 加载环境变量
require('dotenv').config();

const express = require('express');
const app = express();

// 基础中间件：解析JSON请求体
app.use(express.json());

// 基础中间件：解析URL编码请求体
app.use(express.urlencoded({ extended: true }));

// 健康检查路由
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Node.js后端服务正常运行',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 根路由
app.get('/', (req, res) => {
  res.json({
    message: '欢迎来到Node.js后端开发教程',
    version: '1.0.0',
    stage: '阶段一：项目初始化与框架搭建',
    documentation: 'https://github.com/back-tutor/node-backend-tutorial'
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `路由 ${req.originalUrl} 未找到`,
    timestamp: new Date().toISOString()
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.stack);
  res.status(500).json({
    status: 'error',
    message: '服务器内部错误',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`🚀 服务器启动成功！`);
  console.log(`📍 本地地址: http://localhost:${PORT}`);
  console.log(`🌍 环境模式: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ 启动时间: ${new Date().toLocaleString('zh-CN')}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('💤 收到SIGTERM信号，准备关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已安全关闭');
    process.exit(0);
  });
});

module.exports = app;