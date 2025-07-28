# 阶段三：路由设计与参数处理

## 学习目标

- 掌握RESTful API设计原则
- 学会路由参数和查询参数的处理
- 理解路由级中间件的应用
- 实现完整的CRUD操作
- 掌握分页、过滤、排序等高级功能

## 理论讲解

### RESTful API设计原则

REST（Representational State Transfer）是一种架构风格，定义了一组设计网络应用的约束：

| HTTP方法 | 路径 | 描述 | 示例 |
|---------|------|------|------|
| GET | /users | 获取资源列表 | 获取所有用户 |
| GET | /users/:id | 获取单个资源 | 获取ID为1的用户 |
| POST | /users | 创建新资源 | 创建新用户 |
| PUT | /users/:id | 完整更新资源 | 更新用户所有信息 |
| PATCH | /users/:id | 部分更新资源 | 只更新用户角色 |
| DELETE | /users/:id | 删除资源 | 删除指定用户 |

### 路由参数类型

1. **路径参数（Path Parameters）**: `/users/:id`
2. **查询参数（Query Parameters）**: `/users?page=1&limit=10`
3. **请求体参数（Body Parameters）**: POST/PUT请求中的JSON数据

### 路由模块化

```javascript
// 主路由文件
const express = require('express');
const router = express.Router();

// 子路由
router.use('/users', userRouter);
router.use('/posts', postRouter);
```

## 代码实现

### 1. 用户路由模块

**文件位置**: `src/routes/users.js`

#### 基础CRUD操作

```javascript
const express = require('express');
const router = express.Router();

// GET /api/users - 获取用户列表
router.get('/', (req, res) => {
  const { page = 1, limit = 10, role, search } = req.query;
  
  // 参数验证
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({
      status: 'error',
      message: 'page参数必须是大于0的整数'
    });
  }
  
  // 过滤和分页逻辑...
});
```

#### 路由级中间件

```javascript
// 参数验证中间件
const validateUserId = (req, res, next) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      status: 'error',
      message: '用户ID必须是正整数'
    });
  }
  req.userId = userId;
  next();
};

// 用户存在性检查中间件
const checkUserExists = (req, res, next) => {
  const user = users.find(u => u.id === req.userId);
  if (!user) {
    return res.status(404).json({
      status: 'error',
      message: `用户ID ${req.userId} 不存在`
    });
  }
  req.user = user;
  next();
};

// 在路由中使用中间件
router.get('/:id', validateUserId, checkUserExists, (req, res) => {
  res.json({
    status: 'success',
    data: req.user
  });
});
```

### 2. 文章路由模块（嵌套资源）

**文件位置**: `src/routes/posts.js`

#### 高级查询功能

```javascript
// GET /api/posts - 支持排序和过滤
router.get('/', (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    status, 
    authorId, 
    tag,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;
  
  // 验证排序参数
  const validSortFields = ['createdAt', 'title', 'id'];
  const validSortOrders = ['asc', 'desc'];
  
  if (!validSortFields.includes(sortBy)) {
    return res.status(400).json({
      status: 'error',
      message: `sortBy必须是以下之一: ${validSortFields.join(', ')}`
    });
  }
  
  // 过滤和排序逻辑...
});
```

#### 嵌套资源路由

```javascript
// GET /api/posts/:postId/comments - 获取文章评论
router.get('/:postId/comments', validatePostId, checkPostExists, (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  
  const postComments = comments.filter(c => c.postId === req.postId);
  
  // 分页处理...
  
  res.json({
    status: 'success',
    data: {
      comments: paginatedComments,
      postInfo: {
        id: req.post.id,
        title: req.post.title
      }
    }
  });
});

// POST /api/posts/:postId/comments - 创建评论
router.post('/:postId/comments', validatePostId, checkPostExists, (req, res) => {
  // 创建评论逻辑...
});
```

### 3. 路由汇总模块

**文件位置**: `src/routes/index.js`

```javascript
const express = require('express');
const router = express.Router();

// 导入子路由
const usersRouter = require('./users');
const postsRouter = require('./posts');

// API信息路由
router.get('/', (req, res) => {
  res.json({
    status: 'success',
    endpoints: {
      users: {
        'GET /api/users': '获取用户列表',
        'POST /api/users': '创建新用户'
        // ...其他端点
      }
    }
  });
});

// 挂载子路由
router.use('/users', usersRouter);
router.use('/posts', postsRouter);

module.exports = router;
```

## 调试实践

### 1. 启动服务器

```bash
npm run dev
```

### 2. 测试用户路由

#### 获取用户列表（基础查询）

```bash
curl http://localhost:3000/api/users
```

**预期响应**：
```json
{
  "status": "success",
  "data": {
    "users": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 3,
      "totalPages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

#### 分页查询

```bash
curl "http://localhost:3000/api/users?page=1&limit=2"
```

#### 条件过滤

```bash
# 按角色过滤
curl "http://localhost:3000/api/users?role=admin"

# 按用户名搜索
curl "http://localhost:3000/api/users?search=user"
```

#### 获取单个用户

```bash
curl http://localhost:3000/api/users/1
```

**预期响应**：
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

#### 创建新用户

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newuser",
    "email": "newuser@example.com",
    "role": "user"
  }'
```

#### 更新用户信息

```bash
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{
    "username": "updateduser",
    "email": "updated@example.com"
  }'
```

#### 更新用户角色（PATCH）

```bash
curl -X PATCH http://localhost:3000/api/users/1/role \
  -H "Content-Type: application/json" \
  -d '{"role": "moderator"}'
```

#### 删除用户

```bash
curl -X DELETE http://localhost:3000/api/users/1
```

### 3. 测试文章路由

#### 获取文章列表（高级查询）

```bash
# 基础查询
curl http://localhost:3000/api/posts

# 分页查询
curl "http://localhost:3000/api/posts?page=1&limit=5"

# 条件过滤
curl "http://localhost:3000/api/posts?status=published&authorId=1"

# 按标签过滤
curl "http://localhost:3000/api/posts?tag=nodejs"

# 排序
curl "http://localhost:3000/api/posts?sortBy=title&sortOrder=asc"

# 组合查询
curl "http://localhost:3000/api/posts?status=published&sortBy=createdAt&sortOrder=desc&limit=5"
```

#### 创建新文章

```bash
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -d '{
    "title": "我的第一篇文章",
    "content": "这是文章内容...",
    "authorId": 1,
    "tags": ["nodejs", "express"],
    "status": "published"
  }'
```

### 4. 测试嵌套资源路由

#### 获取文章评论

```bash
curl http://localhost:3000/api/posts/1/comments
```

#### 创建文章评论

```bash
curl -X POST http://localhost:3000/api/posts/1/comments \
  -H "Content-Type: application/json" \
  -d '{
    "content": "很棒的文章！",
    "authorId": 2
  }'
```

### 5. 测试错误处理

#### 无效的用户ID

```bash
curl http://localhost:3000/api/users/abc
```

**预期响应**：
```json
{
  "status": "error",
  "message": "用户ID必须是正整数",
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

#### 用户不存在

```bash
curl http://localhost:3000/api/users/999
```

#### 参数验证失败

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "ab",
    "email": "invalid-email"
  }'
```

## 实践练习

### 练习1：添加用户搜索功能

扩展用户列表API，支持更复杂的搜索：

```javascript
// 支持多字段搜索
const { search, searchFields = 'username,email' } = req.query;

if (search) {
  const fields = searchFields.split(',');
  filteredUsers = filteredUsers.filter(user => 
    fields.some(field => 
      user[field] && 
      user[field].toLowerCase().includes(search.toLowerCase())
    )
  );
}
```

### 练习2：添加批量操作

实现批量删除用户：

```javascript
// DELETE /api/users/batch
router.delete('/batch', validateRequest({
  body: {
    ids: { required: true, type: 'object' }
  }
}), (req, res) => {
  const { ids } = req.body;
  
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      status: 'error',
      message: 'ids必须是非空数组'
    });
  }
  
  // 批量删除逻辑...
});
```

### 练习3：添加数据统计路由

```javascript
// GET /api/users/stats
router.get('/stats', (req, res) => {
  const stats = {
    total: users.length,
    byRole: users.reduce((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {}),
    recentlyCreated: users.filter(user => 
      new Date(user.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length
  };
  
  res.json({ status: 'success', data: stats });
});
```

## 关键概念总结

### RESTful设计原则

1. **统一接口** - 标准化的HTTP方法
2. **无状态** - 每个请求包含所有必要信息
3. **可缓存** - 响应应该明确是否可缓存
4. **分层系统** - 客户端无需了解服务器架构
5. **按需代码**（可选）- 服务器可以发送代码到客户端

### 路由设计最佳实践

1. **使用复数名词** - `/users` 而不是 `/user`
2. **嵌套资源** - `/posts/:id/comments`
3. **版本控制** - `/api/v1/users`
4. **一致的响应格式** - 统一的success/error结构
5. **合理的HTTP状态码** - 200, 201, 400, 404, 500等

### 参数处理技巧

1. **类型转换** - `parseInt(req.params.id)`
2. **默认值** - `const { page = 1 } = req.query`
3. **参数验证** - 使用中间件统一验证
4. **错误处理** - 提供清晰的错误信息

### 性能优化考虑

1. **分页** - 限制单次查询数据量
2. **过滤** - 只返回必要的数据
3. **排序** - 在数据库层面进行排序
4. **缓存** - 对频繁查询的数据进行缓存

## 阶段验收

完成以下检查项：

**用户管理功能**：
- [ ] 获取用户列表（支持分页）
- [ ] 按角色过滤用户
- [ ] 按关键词搜索用户
- [ ] 获取单个用户信息
- [ ] 创建新用户（参数验证）
- [ ] 更新用户信息
- [ ] 删除用户
- [ ] 更新用户角色

**文章管理功能**：
- [ ] 获取文章列表（支持排序）
- [ ] 按状态过滤文章
- [ ] 按标签过滤文章
- [ ] 创建新文章
- [ ] 更新文章信息
- [ ] 删除文章

**评论功能**：
- [ ] 获取文章评论列表
- [ ] 创建文章评论

**错误处理**：
- [ ] 无效参数返回400错误
- [ ] 资源不存在返回404错误
- [ ] 参数验证失败返回详细错误信息

**响应格式**：
- [ ] 成功响应包含status和data字段
- [ ] 错误响应包含status、message和timestamp
- [ ] 分页响应包含pagination信息

## 下一阶段预告

阶段四将学习HTTP头部与状态码处理，包括：
- 自定义请求头和响应头
- 缓存控制头
- 安全相关头部
- 内容协商
- HTTP状态码的语义化使用