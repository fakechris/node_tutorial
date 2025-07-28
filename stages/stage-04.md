# 阶段四：HTTP头部与状态码处理

## 学习目标

- 深入理解HTTP头部的作用和分类
- 掌握语义化HTTP状态码的使用
- 学会设置安全相关的响应头
- 实现缓存控制和条件请求
- 理解内容协商机制
- 掌握API版本控制策略

## 理论讲解

### HTTP头部分类

HTTP头部字段根据其作用可以分为以下几类：

#### 1. 通用头部（General Headers）
适用于请求和响应的头部字段：
- `Cache-Control` - 缓存控制指令
- `Connection` - 连接管理
- `Date` - 消息发送的日期和时间
- `Transfer-Encoding` - 传输编码方式

#### 2. 请求头部（Request Headers）
客户端发送给服务器的头部字段：
- `Accept` - 客户端可接受的内容类型
- `Accept-Encoding` - 客户端支持的内容编码
- `Authorization` - 身份验证信息
- `User-Agent` - 用户代理信息
- `If-None-Match` - 条件请求（ETag）
- `If-Modified-Since` - 条件请求（时间）

#### 3. 响应头部（Response Headers）
服务器发送给客户端的头部字段：
- `Server` - 服务器软件信息
- `Location` - 重定向地址
- `WWW-Authenticate` - 身份验证方式
- `Set-Cookie` - 设置Cookie

#### 4. 实体头部（Entity Headers）
描述消息体的头部字段：
- `Content-Type` - 内容类型
- `Content-Length` - 内容长度
- `Content-Encoding` - 内容编码
- `Last-Modified` - 最后修改时间
- `ETag` - 实体标签

### HTTP状态码分类

#### 1xx 信息响应
- `100 Continue` - 继续请求
- `101 Switching Protocols` - 切换协议

#### 2xx 成功响应
- `200 OK` - 请求成功
- `201 Created` - 资源创建成功
- `202 Accepted` - 请求已接受，正在处理
- `204 No Content` - 成功但无内容返回

#### 3xx 重定向
- `301 Moved Permanently` - 永久重定向
- `302 Found` - 临时重定向
- `304 Not Modified` - 资源未修改

#### 4xx 客户端错误
- `400 Bad Request` - 请求语法错误
- `401 Unauthorized` - 未授权
- `403 Forbidden` - 禁止访问
- `404 Not Found` - 资源不存在
- `405 Method Not Allowed` - 方法不被允许
- `409 Conflict` - 资源冲突
- `422 Unprocessable Entity` - 语义错误
- `429 Too Many Requests` - 请求过多

#### 5xx 服务器错误
- `500 Internal Server Error` - 服务器内部错误
- `502 Bad Gateway` - 网关错误
- `503 Service Unavailable` - 服务不可用

## 代码实现

### 1. HTTP头部处理中间件

**文件位置**: `src/middleware/headers.js`

#### 安全头部中间件

```javascript
const security = (req, res, next) => {
  // 防止点击劫持攻击
  res.header('X-Frame-Options', 'DENY');
  
  // 防止MIME类型嗅探
  res.header('X-Content-Type-Options', 'nosniff');
  
  // 启用XSS保护
  res.header('X-XSS-Protection', '1; mode=block');
  
  // 内容安全策略
  res.header('Content-Security-Policy', "default-src 'self'");
  
  // 引用者策略
  res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
};
```

**关键知识点**：
- `X-Frame-Options` - 防止页面被嵌入iframe
- `X-Content-Type-Options` - 防止浏览器MIME类型嗅探
- `X-XSS-Protection` - 启用浏览器XSS过滤
- `Content-Security-Policy` - 控制资源加载策略

#### 缓存控制中间件

```javascript
const cache = (options = {}) => {
  const defaultOptions = {
    maxAge: 0,
    mustRevalidate: true,
    noCache: false,
    private: false
  };
  
  const config = { ...defaultOptions, ...options };
  
  return (req, res, next) => {
    if (config.noCache) {
      res.header('Cache-Control', 'no-cache, must-revalidate');
    } else {
      let cacheControl = [];
      
      if (config.private) {
        cacheControl.push('private');
      } else {
        cacheControl.push('public');
      }
      
      cacheControl.push(`max-age=${config.maxAge}`);
      
      if (config.mustRevalidate) {
        cacheControl.push('must-revalidate');
      }
      
      res.header('Cache-Control', cacheControl.join(', '));
    }
    
    // 设置ETag
    res.header('ETag', `"${Date.now()}-${Math.random().toString(36).substr(2, 9)}"`);
    
    next();
  };
};
```

**关键知识点**：
- `Cache-Control` - 缓存指令控制
- `max-age` - 资源有效时间（秒）
- `public/private` - 缓存可见性
- `ETag` - 资源唯一标识符

#### 内容协商中间件

```javascript
const contentNegotiation = (req, res, next) => {
  const acceptHeader = req.headers.accept || '*/*';
  const supportedTypes = ['application/json', 'text/plain'];
  
  let contentType = 'application/json';
  
  if (acceptHeader.includes('text/plain')) {
    contentType = 'text/plain';
  } else if (!acceptHeader.includes('application/json') && !acceptHeader.includes('*/*')) {
    return res.status(406).json({
      status: 'error',
      message: '不支持的内容类型',
      supportedTypes: supportedTypes
    });
  }
  
  res.header('Content-Type', contentType + '; charset=utf-8');
  req.negotiatedContentType = contentType;
  
  next();
};
```

### 2. HTTP状态码处理中间件

**文件位置**: `src/middleware/statusCode.js`

#### 成功响应辅助函数

```javascript
const success = {
  // 200 OK
  ok: (res, data, message = '请求成功') => {
    return res.status(200).json({
      status: 'success',
      message,
      data,
      timestamp: new Date().toISOString()
    });
  },

  // 201 Created
  created: (res, data, message = '资源创建成功') => {
    return res.status(201).json({
      status: 'success',
      message,
      data,
      timestamp: new Date().toISOString()
    });
  },

  // 204 No Content
  noContent: (res) => {
    return res.status(204).end();
  }
};
```

#### 客户端错误响应辅助函数

```javascript
const clientError = {
  // 400 Bad Request
  badRequest: (res, message = '请求参数错误', details = null) => {
    return res.status(400).json({
      status: 'error',
      message,
      ...(details && { details }),
      timestamp: new Date().toISOString()
    });
  },

  // 404 Not Found
  notFound: (res, message = '请求的资源不存在') => {
    return res.status(404).json({
      status: 'error',
      message,
      timestamp: new Date().toISOString()
    });
  },

  // 429 Too Many Requests
  tooManyRequests: (res, retryAfter = 60) => {
    res.header('Retry-After', retryAfter.toString());
    return res.status(429).json({
      status: 'error',
      message: '请求过于频繁，请稍后再试',
      retryAfter,
      timestamp: new Date().toISOString()
    });
  }
};
```

### 3. 演示路由实现

**文件位置**: `src/routes/demo.js`

```javascript
// 状态码演示
router.get('/status/200', (req, res) => {
  statusCode.success.ok(res, { message: 'Hello World' }, '获取数据成功');
});

router.get('/status/404', (req, res) => {
  statusCode.clientError.notFound(res, '请求的用户不存在');
});

// 条件请求演示
router.get('/headers/conditional', (req, res) => {
  const etag = '"conditional-demo-123"';
  res.header('ETag', etag);
  
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
  
  res.json({
    status: 'success',
    message: '条件请求演示',
    headers: { 'ETag': etag }
  });
});
```

## 调试实践

### 1. 启动服务器

```bash
npm run dev
```

### 2. 测试HTTP状态码

#### 成功状态码测试

```bash
# 200 OK
curl -i http://localhost:3000/api/demo/status/200

# 201 Created
curl -i -X POST http://localhost:3000/api/demo/status/201

# 204 No Content
curl -i http://localhost:3000/api/demo/status/204
```

**预期响应（200 OK）**：
```
HTTP/1.1 200 OK
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Type: application/json; charset=utf-8

{
  "status": "success",
  "message": "获取数据成功",
  "data": {"message": "Hello World"},
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

#### 客户端错误状态码测试

```bash
# 400 Bad Request
curl -i http://localhost:3000/api/demo/status/400

# 401 Unauthorized
curl -i http://localhost:3000/api/demo/status/401

# 404 Not Found
curl -i http://localhost:3000/api/demo/status/404

# 429 Too Many Requests（需要多次请求）
curl -i http://localhost:3000/api/demo/status/429
curl -i http://localhost:3000/api/demo/status/429
curl -i http://localhost:3000/api/demo/status/429
curl -i http://localhost:3000/api/demo/status/429
```

**预期响应（429 Too Many Requests）**：
```
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 3
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1640995260
Retry-After: 60

{
  "status": "error",
  "message": "请求过于频繁，请稍后再试",
  "retryAfter": 60,
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

### 3. 测试HTTP头部

#### 安全头部测试

```bash
curl -i http://localhost:3000/api/demo/headers/security
```

**预期响应头**：
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
```

#### 缓存控制测试

```bash
curl -i http://localhost:3000/api/demo/headers/cache
```

**预期响应头**：
```
Cache-Control: public, max-age=300, must-revalidate
ETag: "1640995200000-abc123def"
```

#### 内容协商测试

```bash
# 请求JSON格式
curl -i -H "Accept: application/json" http://localhost:3000/api/demo/headers/content-negotiation

# 请求纯文本格式
curl -i -H "Accept: text/plain" http://localhost:3000/api/demo/headers/content-negotiation

# 请求不支持的格式
curl -i -H "Accept: text/xml" http://localhost:3000/api/demo/headers/content-negotiation
```

### 4. 测试条件请求

```bash
# 第一次请求，获取ETag
curl -i http://localhost:3000/api/demo/headers/conditional

# 使用ETag进行条件请求
curl -i -H "If-None-Match: \"conditional-demo-123\"" http://localhost:3000/api/demo/headers/conditional
```

**预期响应（第二次请求）**：
```
HTTP/1.1 304 Not Modified
ETag: "conditional-demo-123"
Last-Modified: Mon, 01 Jan 2024 00:00:00 GMT
```

### 5. 测试API版本控制

```bash
# 正确版本
curl -i -H "API-Version: v1" http://localhost:3000/api/demo/headers/version

# 不支持的版本
curl -i -H "API-Version: v2" http://localhost:3000/api/demo/headers/version
```

### 6. 查看请求头信息

```bash
curl -i -H "User-Agent: MyApp/1.0" \
       -H "Accept: application/json" \
       -H "Accept-Language: zh-CN,en" \
       http://localhost:3000/api/demo/headers/all
```

## 实践练习

### 练习1：实现自定义缓存策略

为不同类型的资源设置不同的缓存策略：

```javascript
const resourceCache = (req, res, next) => {
  const path = req.path;
  let cacheOptions = {};
  
  if (path.includes('/users')) {
    // 用户数据缓存5分钟
    cacheOptions = { maxAge: 300, private: true };
  } else if (path.includes('/posts')) {
    // 文章数据缓存10分钟
    cacheOptions = { maxAge: 600, private: false };
  } else if (path.includes('/demo')) {
    // 演示数据不缓存
    cacheOptions = { noCache: true };
  }
  
  // 应用缓存设置
  headers.cache(cacheOptions)(req, res, next);
};
```

### 练习2：实现请求统计头部

添加请求统计信息到响应头：

```javascript
let requestStats = {
  total: 0,
  byMethod: {},
  byPath: {}
};

const requestStats = (req, res, next) => {
  requestStats.total++;
  requestStats.byMethod[req.method] = (requestStats.byMethod[req.method] || 0) + 1;
  requestStats.byPath[req.path] = (requestStats.byPath[req.path] || 0) + 1;
  
  res.header('X-Total-Requests', requestStats.total.toString());
  res.header('X-Method-Count', requestStats.byMethod[req.method].toString());
  res.header('X-Path-Count', requestStats.byPath[req.path].toString());
  
  next();
};
```

### 练习3：实现健康检查状态码

根据系统状态返回不同的状态码：

```javascript
router.get('/health/detailed', (req, res) => {
  const health = {
    database: Math.random() > 0.1 ? 'healthy' : 'unhealthy',
    redis: Math.random() > 0.05 ? 'healthy' : 'unhealthy',
    external_api: Math.random() > 0.2 ? 'healthy' : 'unhealthy'
  };
  
  const isHealthy = Object.values(health).every(status => status === 'healthy');
  
  if (isHealthy) {
    statusCode.success.ok(res, health, '系统健康');
  } else {
    // 503 Service Unavailable
    statusCode.serverError.serviceUnavailable(res, 30);
  }
});
```

## 关键概念总结

### HTTP头部最佳实践

1. **安全头部** - 必须设置的安全相关头部
2. **缓存控制** - 合理的缓存策略提升性能
3. **内容协商** - 支持多种内容格式
4. **条件请求** - 减少不必要的数据传输
5. **请求追踪** - 便于调试和监控

### 状态码使用原则

1. **语义化** - 状态码应准确反映请求结果
2. **一致性** - 相同情况使用相同状态码
3. **客户端友好** - 提供清晰的错误信息
4. **标准遵循** - 遵循HTTP标准定义

### 性能优化考虑

1. **缓存策略** - 合理设置缓存时间
2. **条件请求** - 使用ETag和Last-Modified
3. **压缩** - 启用Gzip压缩
4. **连接管理** - 适当的连接保持策略

## 阶段验收

完成以下检查项：

**HTTP状态码测试**：
- [ ] 2xx成功状态码正确返回
- [ ] 4xx客户端错误状态码正确返回
- [ ] 5xx服务器错误状态码正确返回
- [ ] 状态码与响应内容匹配

**HTTP头部测试**：
- [ ] 安全头部正确设置
- [ ] 缓存控制头部工作正常
- [ ] 内容协商功能正确
- [ ] 条件请求返回304状态
- [ ] 请求追踪头部存在

**API功能测试**：
- [ ] 版本控制正确工作
- [ ] 速率限制功能正常
- [ ] 错误响应格式统一
- [ ] 响应时间头部正确

**安全性检查**：
- [ ] XSS保护头部存在
- [ ] 点击劫持保护启用
- [ ] MIME类型嗅探防护
- [ ] 内容安全策略设置

## 下一阶段预告

阶段五将学习JWT认证与权限控制，包括：
- JWT令牌的生成和验证
- 用户注册和登录流程
- 基于角色的权限控制
- 认证中间件实现
- 密码加密和安全存储