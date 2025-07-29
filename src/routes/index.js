// 阶段三：路由汇总模块
const express = require('express');
const router = express.Router();

// 导入各个路由模块
const usersRouter = require('./users');
const postsRouter = require('./posts');
const demoRouter = require('./demo');
const authRouter = require('./auth');
const databaseRouter = require('./database');
const categoriesRouter = require('./categories');
const debugRouter = require('./debug');

// API信息路由
router.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Node.js后端开发教程 - API接口',
    version: '1.0.0',
    stage: '阶段七：调试和日志系统',
    endpoints: {
      users: {
        'GET /api/users': '获取用户列表（支持分页、过滤、搜索）',
        'GET /api/users/:id': '获取单个用户信息',
        'POST /api/users': '创建新用户',
        'PUT /api/users/:id': '更新用户信息',
        'DELETE /api/users/:id': '删除用户',
        'PATCH /api/users/:id/role': '更新用户角色'
      },
      posts: {
        'GET /api/posts': '获取文章列表（支持分页、过滤、排序）',
        'GET /api/posts/:id': '获取单篇文章',
        'POST /api/posts': '创建新文章',
        'PUT /api/posts/:id': '更新文章',
        'DELETE /api/posts/:id': '删除文章',
        'GET /api/posts/:postId/comments': '获取文章评论',
        'POST /api/posts/:postId/comments': '创建文章评论'
      },
      demo: {
        'GET /api/demo/status-codes': 'HTTP状态码演示',
        'GET /api/demo/headers-demo': 'HTTP头部演示',
        'GET /api/demo/status/*': '各种状态码示例',
        'GET /api/demo/headers/*': '各种头部设置示例'
      },
      auth: {
        'POST /api/auth/register': '用户注册',
        'POST /api/auth/login': '用户登录',
        'GET /api/auth/profile': '获取用户信息（需认证）',
        'PUT /api/auth/profile': '更新用户资料（需认证）',
        'POST /api/auth/refresh': '刷新令牌（需认证）',
        'POST /api/auth/logout': '用户登出（需认证）',
        'GET /api/auth/users': '获取所有用户（管理员）',
        'GET /api/auth/demo/*': '权限演示端点'
      },
      database: {
        'GET /api/db/health': '数据库健康检查',
        'GET /api/db/stats': '数据库统计信息（需认证）',
        'GET /api/db/info': '数据库信息概览',
        'POST /api/db/init': '初始化数据库（管理员）',
        'POST /api/db/init-dev': '初始化数据库（开发模式，无需认证）',
        'POST /api/db/sample-data': '创建示例数据（管理员）',
        'DELETE /api/db/clear-all': '清空所有数据（管理员）'
      },
      categories: {
        'GET /api/categories': '获取分类列表（支持分页、搜索、层级）',
        'GET /api/categories/tree': '获取分类树结构',
        'GET /api/categories/popular': '获取热门分类',
        'GET /api/categories/search': '搜索分类',
        'GET /api/categories/stats': '分类统计信息（需认证）',
        'GET /api/categories/:id': '获取单个分类详情',
        'POST /api/categories': '创建新分类（管理员/版主）',
        'PUT /api/categories/:id': '更新分类（管理员/版主）',
        'DELETE /api/categories/:id': '删除分类（管理员）',
        'POST /api/categories/batch': '批量操作分类（管理员/版主）'
      },
      debug: {
        'GET /api/debug/health': '系统健康检查（公开）',
        'GET /api/debug/overview': '系统概览（需认证）',
        'GET /api/debug/performance': '性能指标（需认证）',
        'GET /api/debug/requests': '活跃请求监控（需认证）',
        'GET /api/debug/requests/:traceId': '请求详情（需认证）',
        'GET /api/debug/errors': '错误统计（需认证）',
        'GET /api/debug/logs': '日志查看（需认证）',
        'GET /api/debug/config': '系统配置（需认证）',
        'POST /api/debug/reset': '重置统计（需认证）',
        'GET /api/debug/dashboard': '调试面板（开发环境）'
      }
    },
    features: {
      pagination: '分页查询支持',
      filtering: '条件过滤支持',
      sorting: '排序功能支持',
      validation: '参数验证支持',
      errorHandling: '统一错误处理',
      nestedResources: '嵌套资源路由',
      httpHeaders: 'HTTP头部处理',
      statusCodes: '语义化状态码',
      contentNegotiation: '内容协商',
      caching: '缓存控制',
      security: '安全头部',
      authentication: 'JWT认证系统',
      authorization: '基于角色的权限控制',
      passwordHashing: '密码安全存储',
      tokenManagement: '令牌生成与验证',
      database: 'Sequelize ORM集成',
      dataModeling: '数据模型和关联关系',
      migrations: '数据库同步和迁移',
      validation: '数据验证和约束',
      logging: 'Winston统一日志系统',
      requestTracking: '请求跟踪和关联ID',
      performanceMonitoring: '实时性能监控',
      errorMonitoring: '错误监控和统计',
      debugTools: '调试工具和开发辅助',
      healthChecks: '系统健康检查'
    },
    documentation: 'https://github.com/back-tutor/node-backend-tutorial',
    timestamp: new Date().toISOString()
  });
});

// 路由统计信息
router.get('/stats', (req, res) => {
  // 这里可以添加一些统计逻辑
  res.json({
    status: 'success',
    data: {
      totalRoutes: 12,
      userRoutes: 6,
      postRoutes: 6,
      features: ['CRUD', 'Pagination', 'Filtering', 'Sorting', 'Validation'],
      registeredAt: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
});

// 挂载子路由
router.use('/users', usersRouter);
router.use('/posts', postsRouter);
router.use('/demo', demoRouter);
router.use('/auth', authRouter);
router.use('/db', databaseRouter);
router.use('/categories', categoriesRouter);
router.use('/debug', debugRouter);

module.exports = router;