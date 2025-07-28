// 阶段三：路由汇总模块
const express = require('express');
const router = express.Router();

// 导入各个路由模块
const usersRouter = require('./users');
const postsRouter = require('./posts');

// API信息路由
router.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Node.js后端开发教程 - API接口',
    version: '1.0.0',
    stage: '阶段三：路由设计与参数处理',
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
      }
    },
    features: {
      pagination: '分页查询支持',
      filtering: '条件过滤支持',
      sorting: '排序功能支持',
      validation: '参数验证支持',
      errorHandling: '统一错误处理',
      nestedResources: '嵌套资源路由'
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

module.exports = router;