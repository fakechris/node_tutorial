// 阶段二：中间件开发与实践
// 加载环境变量
require('dotenv').config();

const express = require('express');
const app = express();

// 导入自定义中间件
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const validateRequest = require('./middleware/requestValidator');
const cors = require('./middleware/cors');
const headers = require('./middleware/headers');

// 1. CORS中间件（必须在其他中间件之前）
app.use(cors());

// 2. 安全头部中间件
app.use(headers.security);

// 3. 请求追踪中间件
app.use(headers.requestTracking);

// 4. 日志中间件
app.use(logger);

// 5. 基础解析中间件
app.use(express.json({ limit: '10mb' }));
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
    stage: '阶段六：数据库ORM与CRUD操作',
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
      dataModeling: '数据模型和关联关系'
    },
    apiEndpoint: '/api',
    authEndpoint: '/api/auth',
    demoEndpoint: '/api/demo',
    databaseEndpoint: '/api/db',
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

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `路由 ${req.originalUrl} 未找到`,
    timestamp: new Date().toISOString()
  });
});

// 全局错误处理中间件（必须放在最后）
app.use(errorHandler);

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