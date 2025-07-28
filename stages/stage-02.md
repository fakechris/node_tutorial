# 阶段二：中间件开发与实践

## 学习目标

- 深入理解Express中间件的执行机制
- 学会编写自定义中间件
- 掌握错误处理中间件的开发
- 理解中间件的执行顺序和最佳实践

## 理论讲解

### 什么是中间件？

中间件（Middleware）是Express的核心概念，它是一个函数，可以访问请求对象（req）、响应对象（res）和应用程序请求-响应周期中的下一个中间件函数（next）。

### 中间件的作用

1. **执行代码** - 在请求处理过程中执行特定逻辑
2. **修改请求和响应对象** - 添加属性、方法或数据
3. **结束请求-响应循环** - 发送响应给客户端
4. **调用下一个中间件** - 通过`next()`传递控制权

### 中间件类型

1. **应用级中间件** - `app.use()`
2. **路由级中间件** - `router.use()`
3. **错误处理中间件** - 带有4个参数的函数
4. **内置中间件** - Express自带的中间件
5. **第三方中间件** - npm包提供的中间件

### 中间件执行顺序

```javascript
app.use(middleware1);  // 1. 首先执行
app.use(middleware2);  // 2. 然后执行
app.get('/', handler); // 3. 最后执行路由处理器
app.use(errorHandler); // 4. 错误处理（如果有错误）
```

## 代码实现

### 1. 自定义日志中间件

**文件位置**: `src/middleware/logger.js`

```javascript
const logger = (req, res, next) => {
  const startTime = Date.now();
  const clientIP = req.headers['x-forwarded-for'] || 
                   req.connection.remoteAddress || 
                   req.ip || 'unknown';
  
  const logInfo = {
    method: req.method,
    url: req.originalUrl,
    ip: clientIP,
    userAgent: req.get('User-Agent') || 'unknown',
    timestamp: new Date().toISOString()
  };
  
  console.log(`📥 [${logInfo.timestamp}] ${logInfo.method} ${logInfo.url} - IP: ${logInfo.ip}`);
  
  // 监听响应完成事件
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    let statusIcon = '✅';
    if (statusCode >= 400 && statusCode < 500) {
      statusIcon = '⚠️ ';
    } else if (statusCode >= 500) {
      statusIcon = '❌';
    }
    
    console.log(`📤 [${new Date().toISOString()}] ${statusIcon} ${logInfo.method} ${logInfo.url} - ${statusCode} - ${duration}ms`);
  });
  
  next(); // 调用下一个中间件
};

module.exports = logger;
```

**关键知识点**：
- `req.originalUrl` - 完整的请求URL
- `res.on('finish')` - 监听响应完成事件
- `Date.now()` - 计算请求处理时间
- `next()` - 传递控制权给下一个中间件

### 2. 错误处理中间件

**文件位置**: `src/middleware/errorHandler.js`

```javascript
const errorHandler = (err, req, res, next) => {
  console.error('🚨 服务器错误详情:');
  console.error('时间:', new Date().toISOString());
  console.error('路径:', req.originalUrl);
  console.error('方法:', req.method);
  console.error('错误:', err.message);
  console.error('堆栈:', err.stack);
  
  let status = 500;
  let message = '服务器内部错误';
  
  // 区分不同类型的错误
  if (err.name === 'ValidationError') {
    status = 400;
    message = '请求参数验证失败';
  } else if (err.name === 'UnauthorizedError') {
    status = 401;
    message = '未授权访问';
  } else if (err.name === 'NotFoundError') {
    status = 404;
    message = '请求的资源不存在';
  } else if (process.env.NODE_ENV === 'development') {
    message = err.message;
  }
  
  res.status(status).json({
    status: 'error',
    message: message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
```

**关键知识点**：
- 错误处理中间件必须有4个参数：`(err, req, res, next)`
- 错误处理中间件必须放在所有其他中间件之后
- 根据环境变量决定是否返回错误堆栈信息

### 3. 请求验证中间件

**文件位置**: `src/middleware/requestValidator.js`

```javascript
const validateRequest = (validationRules) => {
  return (req, res, next) => {
    const errors = [];
    
    // 验证请求体
    if (validationRules.body) {
      for (const [field, rules] of Object.entries(validationRules.body)) {
        const value = req.body[field];
        
        // 必填字段检查
        if (rules.required && (value === undefined || value === null || value === '')) {
          errors.push(`字段 '${field}' 是必填的`);
          continue;
        }
        
        if (value === undefined || value === null) continue;
        
        // 类型检查
        if (rules.type && typeof value !== rules.type) {
          errors.push(`字段 '${field}' 必须是 ${rules.type} 类型`);
        }
        
        // 长度检查
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`字段 '${field}' 长度不能少于 ${rules.minLength} 个字符`);
        }
        
        // 正则表达式验证
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`字段 '${field}' 格式不正确`);
        }
      }
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: '请求参数验证失败',
        errors: errors,
        timestamp: new Date().toISOString()
      });
    }
    
    next();
  };
};

module.exports = validateRequest;
```

**关键知识点**：
- 高阶函数 - 返回一个中间件函数
- 参数验证逻辑
- 提前返回响应，不调用`next()`

### 4. CORS跨域中间件

**文件位置**: `src/middleware/cors.js`

```javascript
const cors = (options = {}) => {
  const defaultOptions = {
    origin: process.env.NODE_ENV === 'development' ? '*' : false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: false,
    maxAge: 86400
  };
  
  const config = { ...defaultOptions, ...options };
  
  return (req, res, next) => {
    if (config.origin === '*') {
      res.header('Access-Control-Allow-Origin', '*');
    } else if (config.origin) {
      res.header('Access-Control-Allow-Origin', config.origin);
    }
    
    res.header('Access-Control-Allow-Methods', config.methods.join(', '));
    res.header('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
    
    if (config.credentials) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    
    // 处理预检请求
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    next();
  };
};

module.exports = cors;
```

## 调试实践

### 1. 启动服务器

```bash
npm run dev
```

### 2. 测试日志中间件

访问任意路由，观察控制台输出：

```bash
curl http://localhost:3000/
```

**预期输出**：
```
📥 [2024-01-01T10:00:00.000Z] GET / - IP: ::1
📤 [2024-01-01T10:00:00.100Z] ✅ GET / - 200 - 15ms
```

### 3. 测试参数验证中间件

**正确的请求**：
```bash
curl -X POST http://localhost:3000/api/test/validation \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "age": 25
  }'
```

**预期响应**：
```json
{
  "status": "success",
  "message": "参数验证通过",
  "data": {
    "username": "testuser",
    "email": "test@example.com",
    "age": 25
  },
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

**错误的请求**：
```bash
curl -X POST http://localhost:3000/api/test/validation \
  -H "Content-Type: application/json" \
  -d '{
    "username": "ab",
    "email": "invalid-email"
  }'
```

**预期响应**：
```json
{
  "status": "error",
  "message": "请求参数验证失败",
  "errors": [
    "字段 'username' 长度不能少于 3 个字符",
    "字段 'email' 格式不正确"
  ],
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

### 4. 测试错误处理中间件

```bash
curl http://localhost:3000/api/test/error
```

**预期响应**：
```json
{
  "status": "error",
  "message": "这是一个测试错误",
  "timestamp": "2024-01-01T10:00:00.000Z",
  "path": "/api/test/error",
  "stack": "Error: 这是一个测试错误\n    at ..."
}
```

### 5. 测试异步错误处理

```bash
curl http://localhost:3000/api/test/async-error
```

观察服务器日志中的错误详情。

## 实践练习

### 练习1：性能监控中间件

创建一个中间件，记录慢请求（超过1秒的请求）：

```javascript
const performanceMonitor = (threshold = 1000) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      if (duration > threshold) {
        console.warn(`🐌 慢请求警告: ${req.method} ${req.url} - ${duration}ms`);
      }
    });
    
    next();
  };
};
```

### 练习2：请求频率限制中间件

实现一个简单的请求频率限制：

```javascript
const rateLimit = (windowMs = 60000, max = 100) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // 清理过期记录
    if (requests.has(ip)) {
      const timestamps = requests.get(ip).filter(time => time > windowStart);
      requests.set(ip, timestamps);
    }
    
    const currentRequests = requests.get(ip) || [];
    
    if (currentRequests.length >= max) {
      return res.status(429).json({
        status: 'error',
        message: '请求过于频繁，请稍后再试'
      });
    }
    
    currentRequests.push(now);
    requests.set(ip, currentRequests);
    
    next();
  };
};
```

## 关键概念总结

### 中间件设计原则

1. **单一职责** - 每个中间件只做一件事
2. **可配置性** - 通过参数自定义行为
3. **错误处理** - 适当的错误处理和传递
4. **性能考虑** - 避免阻塞操作
5. **调用next()** - 确保控制权传递

### 中间件执行顺序

```
请求 → CORS → 日志 → 解析 → 验证 → 路由处理 → 错误处理 → 响应
```

### 常见错误

1. **忘记调用next()** - 导致请求挂起
2. **错误处理中间件位置错误** - 应该放在最后
3. **同步错误未捕获** - 使用try-catch包装
4. **内存泄漏** - 清理事件监听器和定时器

## 阶段验收

完成以下检查项：

- [ ] 服务器启动后能看到详细的请求日志
- [ ] 参数验证测试通过（正确和错误情况）
- [ ] 错误处理测试返回规范的错误响应
- [ ] CORS头部正确设置
- [ ] 异步错误能被正确捕获和处理
- [ ] 控制台输出包含彩色的日志信息
- [ ] 404路由返回标准格式响应

## 下一阶段预告

阶段三将学习路由设计与参数处理，包括：
- RESTful API设计原则
- 路由参数和查询参数
- 路由级中间件
- 路由分组和模块化