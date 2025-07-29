// 阶段七：调试和日志系统整合
// 加载环境变量
require('dotenv').config();

const express = require('express');
const app = express();

// 导入系统级组件
const logger = require('./config/logger');

// 导入中间件
const requestTracker = require('./middleware/requestTracker');
const { performanceMonitor } = require('./middleware/performanceMonitor');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const validateRequest = require('./middleware/requestValidator');
const cors = require('./middleware/cors');
const headers = require('./middleware/headers');

// 🔧 中间件顺序至关重要！

// 1. 请求跟踪（最早，用于生成traceId）
app.use(requestTracker);

// 2. 性能监控（紧随其后，监控整个请求周期）
app.use(performanceMonitor);

// 3. CORS中间件
app.use(cors());

// 4. 安全头部中间件
app.use(headers.security);

// 5. 请求追踪头部
app.use(headers.requestTracking);

// 6. 基础解析中间件
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // 添加原始body用于某些特殊场景
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 健康检查路由
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Node.js后端服务正常运行',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 导入路由模块
const apiRoutes = require('./routes/index');

// 挂载API路由
app.use('/api', apiRoutes);

// 根路由
app.get('/', (req, res) => {
  res.json({
    message: '欢迎来到Node.js后端开发教程',
    version: '1.0.0',
    stage: '阶段七：调试和日志系统',
    monitoring: '实时监控和调试工具',
    features: {
      middleware: '中间件系统',
      routing: 'RESTful路由设计',
      validation: '参数验证',
      pagination: '分页查询',
      filtering: '条件过滤',
      sorting: '排序功能',
      httpHeaders: 'HTTP头部处理',
      statusCodes: '语义化状态码',
      security: '安全头部',
      caching: '缓存控制',
      authentication: 'JWT认证系统',
      authorization: '基于角色的权限控制',
      passwordSecurity: '密码加密存储',
      database: 'Sequelize ORM集成',
      dataModeling: '数据模型和关联关系',
      logging: 'Winston日志系统',
      requestTracking: '请求追踪和关联ID',
      performanceMonitoring: '性能监控和指标收集',
      errorMonitoring: '错误监控和统计',
      debugDashboard: '实时调试面板'
    },
    apiEndpoint: '/api',
    authEndpoint: '/api/auth',
    demoEndpoint: '/api/demo',
    databaseEndpoint: '/api/db',
    debugEndpoint: '/api/debug',
    debugDashboard: '/api/debug/dashboard',
    documentation: 'https://github.com/back-tutor/node-backend-tutorial'
  });
});

// 测试中间件的演示路由
app.post('/api/test/validation', validateRequest({
  body: {
    username: { required: true, type: 'string', minLength: 3, maxLength: 20 },
    email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    age: { required: false, type: 'number' }
  }
}), (req, res) => {
  res.json({
    status: 'success',
    message: '参数验证通过',
    data: req.body,
    timestamp: new Date().toISOString()
  });
});

// 测试错误处理的路由
app.get('/api/test/error', (req, res, next) => {
  const error = new Error('这是一个测试错误');
  error.name = 'TestError';
  next(error);
});

// 测试异步错误
app.get('/api/test/async-error', async (req, res, next) => {
  try {
    // 模拟异步操作错误
    await new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error('异步操作失败')), 100);
    });
  } catch (error) {
    next(error);
  }
});

// 404处理（使用增强版处理器）
app.use('*', notFoundHandler);

// 全局错误处理中间件（必须放在最后）
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    baseUrl: `http://localhost:${PORT}`,
    debugEnabled: process.env.NODE_ENV !== 'production',
    startTime: new Date().toISOString()
  });
  
  console.log(`🚀 服务器启动成功！`);
  console.log(`📍 本地地址: http://localhost:${PORT}`);
  console.log(`🌍 环境模式: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ 启动时间: ${new Date().toLocaleString('zh-CN')}`);
  
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🔍 调试面板: http://localhost:${PORT}/api/debug/dashboard`);
  }
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal, shutting down gracefully');
  console.log('💤 收到SIGTERM信号，准备关闭服务器...');
  
  server.close(() => {
    logger.info('Server closed successfully');
    console.log('✅ 服务器已安全关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT signal, shutting down gracefully');
  console.log('💤 收到SIGINT信号，准备关闭服务器...');
  
  server.close(() => {
    logger.info('Server closed successfully');
    console.log('✅ 服务器已安全关闭');
    process.exit(0);
  });
});

module.exports = app;