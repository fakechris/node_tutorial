# Node.js 后端开发教程 - API 文档

## 🌟 概述

本API提供了一个完整的内容管理系统后端，包括用户管理、文章发布、评论系统、分类管理等功能。采用RESTful设计规范，支持JWT认证和基于角色的权限控制。

## 🔧 基础信息

- **基础URL**: `http://localhost:3000/api`
- **认证方式**: Bearer Token (JWT)
- **数据格式**: JSON
- **字符编码**: UTF-8

## 📋 通用响应格式

### 成功响应
```json
{
  "status": "success",
  "data": {},
  "message": "操作成功",
  "timestamp": "2025-07-29T01:30:00.000Z"
}
```

### 错误响应
```json
{
  "status": "error",
  "message": "错误描述",
  "code": "ERROR_CODE",
  "timestamp": "2025-07-29T01:30:00.000Z"
}
```

### 分页响应
```json
{
  "status": "success",
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

## 🔐 认证端点

### 用户注册
```http
POST /api/auth/register
```

**请求体:**
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "Password123!",
  "firstName": "张",
  "lastName": "三"
}
```

**响应:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": 1,
      "username": "testuser",
      "email": "test@example.com",
      "firstName": "张",
      "lastName": "三",
      "role": "user",
      "isActive": true
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### 用户登录
```http
POST /api/auth/login
```

**请求体:**
```json
{
  "username": "testuser",
  "password": "Password123!"
}
```

**响应:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "id": 1,
      "username": "testuser",
      "email": "test@example.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "24h"
  }
}
```

### 获取用户信息
```http
GET /api/auth/profile
Authorization: Bearer {token}
```

### 更新用户资料
```http
PUT /api/auth/profile
Authorization: Bearer {token}
```

**请求体:**
```json
{
  "firstName": "新名字",
  "lastName": "新姓氏",
  "email": "newemail@example.com"
}
```

## 👥 用户管理

### 获取用户列表
```http
GET /api/users?page=1&limit=10&search=keyword&role=user&sortBy=createdAt&order=desc
Authorization: Bearer {token} (需要admin或moderator权限)
```

**查询参数:**
- `page`: 页码 (默认: 1)
- `limit`: 每页数量 (默认: 10)
- `search`: 搜索关键词
- `role`: 角色过滤 (user|moderator|admin)
- `sortBy`: 排序字段 (createdAt|username|email)
- `order`: 排序方向 (asc|desc)

### 获取单个用户
```http
GET /api/users/:id
Authorization: Bearer {token} (需要admin或moderator权限)
```

### 创建用户
```http
POST /api/users
Authorization: Bearer {token} (需要admin权限)
```

### 更新用户
```http
PUT /api/users/:id
Authorization: Bearer {token} (需要admin权限)
```

### 删除用户
```http
DELETE /api/users/:id
Authorization: Bearer {token} (需要admin权限)
```

## 📝 文章管理

### 获取文章列表
```http
GET /api/posts?page=1&limit=10&search=keyword&status=published&categoryId=1&authorId=1
```

**查询参数:**
- `page`: 页码
- `limit`: 每页数量
- `search`: 搜索标题和内容
- `status`: 状态过滤 (draft|published|archived)
- `categoryId`: 分类ID
- `authorId`: 作者ID
- `sortBy`: 排序字段 (createdAt|title|viewCount)
- `order`: 排序方向

### 获取单篇文章
```http
GET /api/posts/:id
```

### 创建文章
```http
POST /api/posts
Authorization: Bearer {token}
```

**请求体:**
```json
{
  "title": "文章标题",
  "content": "文章内容",
  "excerpt": "文章摘要",
  "status": "published",
  "categoryId": 1,
  "tags": ["标签1", "标签2"]
}
```

### 更新文章
```http
PUT /api/posts/:id
Authorization: Bearer {token} (作者本人或admin)
```

### 删除文章
```http
DELETE /api/posts/:id
Authorization: Bearer {token} (作者本人或admin)
```

## 💬 评论系统

### 获取文章评论
```http
GET /api/posts/:postId/comments?page=1&limit=20
```

### 创建评论
```http
POST /api/posts/:postId/comments
Authorization: Bearer {token}
```

**请求体:**
```json
{
  "content": "评论内容",
  "parentId": null
}
```

### 更新评论
```http
PUT /api/posts/:postId/comments/:commentId
Authorization: Bearer {token} (评论作者或admin)
```

### 删除评论
```http
DELETE /api/posts/:postId/comments/:commentId
Authorization: Bearer {token} (评论作者或admin)
```

## 🏷️ 分类管理

### 获取分类列表
```http
GET /api/categories?page=1&limit=50&search=keyword&isActive=true
```

### 获取分类树结构
```http
GET /api/categories/tree
```

### 获取热门分类
```http
GET /api/categories/popular?limit=10
```

### 创建分类
```http
POST /api/categories
Authorization: Bearer {token} (需要admin或moderator权限)
```

**请求体:**
```json
{
  "name": "分类名称",
  "description": "分类描述",
  "parentId": null,
  "isActive": true
}
```

### 更新分类
```http
PUT /api/categories/:id
Authorization: Bearer {token} (需要admin或moderator权限)
```

### 删除分类
```http
DELETE /api/categories/:id
Authorization: Bearer {token} (需要admin权限)
```

## 🔍 调试和监控

### 系统健康检查
```http
GET /api/debug/health
```

**响应:**
```json
{
  "status": "success",
  "data": {
    "status": "healthy",
    "timestamp": "2025-07-29T01:30:00.000Z",
    "uptime": 3600,
    "checks": {
      "memory": {"status": "healthy"},
      "database": {"status": "healthy"},
      "logs": {"status": "healthy"},
      "disk": {"status": "healthy"}
    }
  }
}
```

### 系统概览
```http
GET /api/debug/overview
Authorization: Bearer {token}
```

### 性能指标
```http
GET /api/debug/performance
Authorization: Bearer {token}
```

### 活跃请求
```http
GET /api/debug/requests
Authorization: Bearer {token}
```

### 错误统计
```http
GET /api/debug/errors?limit=20
Authorization: Bearer {token}
```

### 系统日志
```http
GET /api/debug/logs?level=all&limit=100&offset=0
Authorization: Bearer {token}
```

### 调试面板
```http
GET /api/debug/dashboard
```
访问实时调试面板 (仅开发环境)

## 📊 数据库管理

### 数据库健康检查
```http
GET /api/db/health
```

### 数据库统计信息
```http
GET /api/db/stats
Authorization: Bearer {token}
```

### 初始化数据库
```http
POST /api/db/init
Authorization: Bearer {token} (需要admin权限)
```

### 创建示例数据
```http
POST /api/db/sample-data
Authorization: Bearer {token} (需要admin权限)
```

## 🚨 错误代码

| 错误代码 | HTTP状态码 | 描述 |
|---------|-----------|------|
| `VALIDATION_ERROR` | 400 | 请求参数验证失败 |
| `UNAUTHORIZED` | 401 | 未提供认证信息 |
| `INVALID_TOKEN` | 401 | 无效的认证令牌 |
| `TOKEN_EXPIRED` | 401 | 认证令牌已过期 |
| `FORBIDDEN` | 403 | 权限不足 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `CONFLICT` | 409 | 资源冲突 |
| `RATE_LIMIT_EXCEEDED` | 429 | 请求频率超限 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |

## 🔄 请求头

### 必需头部
```http
Content-Type: application/json
```

### 认证头部
```http
Authorization: Bearer {your-jwt-token}
```

### 可选头部
```http
X-Trace-ID: {custom-trace-id}  # 自定义请求跟踪ID
Accept: application/json
User-Agent: YourApp/1.0.0
```

## 📈 响应头

### 标准响应头
```http
Content-Type: application/json; charset=utf-8
X-Trace-ID: {request-trace-id}
X-Response-Time: {response-time}ms
X-Cache: HIT|MISS|SKIP
```

### 分页响应头
```http
X-Total-Count: {total-items}
X-Page: {current-page}
X-Per-Page: {items-per-page}
```

## 🔧 开发工具

### 请求示例 (curl)
```bash
# 用户注册
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Password123!",
    "firstName": "张",
    "lastName": "三"
  }'

# 获取文章列表
curl -X GET "http://localhost:3000/api/posts?page=1&limit=10"

# 创建文章 (需要认证)
curl -X POST http://localhost:3000/api/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "我的第一篇文章",
    "content": "这是文章的内容...",
    "status": "published"
  }'
```

## 🧪 测试脚本

项目提供了多个测试脚本来验证API功能：

```bash
# 运行综合测试套件
./test-comprehensive.sh

# 运行数据库测试
./test-database.sh

# 运行Stage 7监控测试
./test-stage7.sh
```

## 📞 技术支持

如有问题，请查看：
1. 服务器日志: `./logs/`
2. 调试面板: `http://localhost:3000/api/debug/dashboard`
3. 健康检查: `http://localhost:3000/api/debug/health`

---

**最后更新**: 2025-07-29  
**API版本**: 1.0.0  
**文档版本**: 1.0.0