// 种子数据：示例文章
module.exports = {
  up: async sequelize => {
    const posts = [
      {
        title: 'Node.js 后端开发入门指南',
        content: `# Node.js 后端开发入门指南

Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行环境，让开发者能够使用 JavaScript 编写服务器端程序。

## 为什么选择 Node.js？

1. **统一语言栈**：前端和后端都使用 JavaScript
2. **高性能**：基于事件驱动的非阻塞I/O模型
3. **丰富的生态系统**：npm包管理器提供大量模块
4. **快速开发**：简化的开发流程和工具链

## 核心概念

### 事件循环
Node.js 使用事件循环来处理异步操作，这使得它能够高效处理并发请求。

### 模块系统
Node.js 使用 CommonJS 模块系统，可以通过 require() 和 module.exports 来导入和导出模块。

## 开始你的第一个项目

\`\`\`javascript
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hello, Node.js!');
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
\`\`\`

这篇文章将帮助你快速上手 Node.js 后端开发。`,
        excerpt:
          'Node.js 是一个强大的 JavaScript 运行环境，本文介绍了 Node.js 的核心概念和基础用法。',
        slug: 'nodejs-backend-guide',
        status: 'published',
        tags: JSON.stringify(['Node.js', '后端开发', '入门教程']),
        viewCount: 245,
        authorId: 1, // admin用户
        categoryId: 4, // Node.js分类
        publishedAt: new Date('2025-01-15'),
        createdAt: new Date('2025-01-15'),
        updatedAt: new Date('2025-01-15'),
      },
      {
        title: 'Express.js 中间件深度解析',
        content: `# Express.js 中间件深度解析

中间件是 Express.js 的核心概念，它是一个函数，可以访问请求对象(req)、响应对象(res)和应用程序请求-响应循环中的下一个中间件函数。

## 中间件的类型

### 应用级中间件
应用级中间件绑定到 app 对象的实例上。

\`\`\`javascript
app.use((req, res, next) => {
  console.log('Time:', Date.now());
  next();
});
\`\`\`

### 路由级中间件
路由级中间件的工作方式与应用级中间件基本相同，只是它绑定的对象为 express.Router() 的实例。

### 错误处理中间件
错误处理中间件总是需要四个参数：err、req、res 和 next。

\`\`\`javascript
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});
\`\`\`

## 自定义中间件示例

\`\`\`javascript
const logger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(\`\${req.method} \${req.originalUrl} - \${res.statusCode} (\${duration}ms)\`);
  });
  next();
};

app.use(logger);
\`\`\`

通过合理使用中间件，可以构建出高效、可维护的 Express.js 应用程序。`,
        excerpt:
          '深入理解 Express.js 中间件的工作原理和使用方法，包括应用级、路由级和错误处理中间件。',
        slug: 'express-middleware-deep-dive',
        status: 'published',
        tags: JSON.stringify(['Express.js', '中间件', 'Node.js']),
        viewCount: 189,
        authorId: 2, // janedoe用户
        categoryId: 4, // Node.js分类
        publishedAt: new Date('2025-01-20'),
        createdAt: new Date('2025-01-20'),
        updatedAt: new Date('2025-01-20'),
      },
      {
        title: 'RESTful API 设计最佳实践',
        content: `# RESTful API 设计最佳实践

REST（Representational State Transfer）是一种软件架构风格，定义了一组用于创建Web服务的约束。

## RESTful API 的基本原则

### 1. 无状态性
每个请求都必须包含处理该请求所需的所有信息，服务器不能存储任何关于客户端会话的信息。

### 2. 统一接口
RESTful API 应该有一致的接口设计，包括：
- 资源标识
- 通过表示来操作资源
- 自描述消息
- 超媒体作为应用状态的引擎

### 3. 分层系统
REST允许在客户端和服务器之间使用分层系统架构。

## HTTP 方法的正确使用

- **GET**: 获取资源
- **POST**: 创建新资源
- **PUT**: 完全更新资源
- **PATCH**: 部分更新资源
- **DELETE**: 删除资源

## URL 设计规范

\`\`\`
GET    /api/users          # 获取用户列表
GET    /api/users/123      # 获取特定用户
POST   /api/users          # 创建新用户
PUT    /api/users/123      # 完全更新用户
PATCH  /api/users/123      # 部分更新用户
DELETE /api/users/123      # 删除用户
\`\`\`

## 状态码的使用

- **200 OK**: 请求成功
- **201 Created**: 资源创建成功
- **400 Bad Request**: 客户端请求错误
- **401 Unauthorized**: 未授权
- **404 Not Found**: 资源不存在
- **500 Internal Server Error**: 服务器内部错误

遵循这些最佳实践，可以设计出易于理解和使用的 RESTful API。`,
        excerpt:
          '了解 RESTful API 设计的核心原则和最佳实践，包括HTTP方法使用、URL设计和状态码规范。',
        slug: 'restful-api-best-practices',
        status: 'published',
        tags: JSON.stringify(['RESTful API', 'API设计', '后端开发']),
        viewCount: 312,
        authorId: 1, // admin用户
        categoryId: 3, // 后端开发分类
        publishedAt: new Date('2025-01-25'),
        createdAt: new Date('2025-01-25'),
        updatedAt: new Date('2025-01-25'),
      },
      {
        title: '数据库优化策略与技巧',
        content: `# 数据库优化策略与技巧

数据库性能优化是后端开发中的重要环节，本文将介绍一些常用的优化策略和技巧。

## 查询优化

### 1. 使用索引
索引是提高查询性能的最有效方法之一。

\`\`\`sql
-- 创建单列索引
CREATE INDEX idx_user_email ON users(email);

-- 创建复合索引
CREATE INDEX idx_post_status_date ON posts(status, created_at);
\`\`\`

### 2. 避免SELECT *
只查询需要的字段，减少数据传输量。

\`\`\`sql
-- 不好的做法
SELECT * FROM users WHERE status = 'active';

-- 好的做法
SELECT id, username, email FROM users WHERE status = 'active';
\`\`\`

### 3. 使用LIMIT限制结果集
对于大量数据的查询，使用LIMIT限制返回的记录数。

## 数据库设计优化

### 1. 规范化vs反规范化
根据查询模式选择合适的规范化程度。

### 2. 选择合适的数据类型
使用最小的数据类型来存储数据。

### 3. 分区表
对于大表，可以考虑使用分区来提高查询性能。

## 连接池优化

\`\`\`javascript
const pool = new Pool({
  host: 'localhost',
  user: 'username',
  password: 'password',
  database: 'mydb',
  max: 20,        // 最大连接数
  min: 5,         // 最小连接数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
\`\`\`

## 缓存策略

1. **查询缓存**: 缓存查询结果
2. **对象缓存**: 缓存对象数据
3. **页面缓存**: 缓存整个页面

通过合理的优化策略，可以显著提升数据库性能和应用响应速度。`,
        excerpt:
          '探讨数据库性能优化的各种策略，包括查询优化、索引使用、连接池配置和缓存策略。',
        slug: 'database-optimization-strategies',
        status: 'draft', // 草稿状态
        tags: JSON.stringify(['数据库', '性能优化', 'SQL']),
        viewCount: 0,
        authorId: 3, // bobsmith用户
        categoryId: 5, // 数据库分类
        publishedAt: null,
        createdAt: new Date('2025-01-28'),
        updatedAt: new Date('2025-01-28'),
      },
    ];

    await sequelize.bulkInsert('Posts', posts);
  },

  down: async sequelize => {
    await sequelize.bulkDelete('Posts', {
      slug: [
        'nodejs-backend-guide',
        'express-middleware-deep-dive',
        'restful-api-best-practices',
        'database-optimization-strategies',
      ],
    });
  },
};
