# 阶段五：JWT认证与权限控制

## 学习目标

- 理解JWT（JSON Web Token）的工作原理
- 掌握用户注册和登录流程的实现
- 学会使用bcrypt进行密码安全存储
- 实现基于角色的权限控制系统
- 掌握认证中间件的开发
- 理解令牌的生成、验证和刷新机制

## 理论讲解

### JWT（JSON Web Token）简介

JWT是一种开放标准（RFC 7519），用于在各方之间安全地传输信息作为JSON对象。

#### JWT结构

JWT由三部分组成，用点（.）分隔：
```
头部.载荷.签名
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

1. **头部（Header）**：包含令牌类型和签名算法
   ```json
   {
     "alg": "HS256",
     "typ": "JWT"
   }
   ```

2. **载荷（Payload）**：包含声明（claims）
   ```json
   {
     "userId": 123,
     "username": "john",
     "role": "user",
     "exp": 1640995200
   }
   ```

3. **签名（Signature）**：用于验证令牌的完整性
   ```
   HMACSHA256(
     base64UrlEncode(header) + "." +
     base64UrlEncode(payload),
     secret
   )
   ```

#### JWT优势

- **无状态**：服务器不需要存储会话信息
- **可扩展**：适合微服务架构
- **跨域支持**：可以在不同域名间使用
- **自包含**：包含所有必要的用户信息

### 密码安全存储

#### bcrypt算法特点

- **单向哈希**：无法反向计算出原密码
- **自适应**：可以调整计算复杂度
- **随机盐值**：防止彩虹表攻击
- **时间成本**：增加暴力破解难度

#### 盐值轮数（Salt Rounds）

```javascript
const saltRounds = 12; // 推荐值，2^12 = 4096次迭代
const hash = await bcrypt.hash(password, saltRounds);
```

### 权限控制模型

#### 基于角色的访问控制（RBAC）

1. **用户（User）**：系统的使用者
2. **角色（Role）**：权限的集合
3. **权限（Permission）**：对资源的操作权限

#### 权限层级

```
admin（管理员）
├── 用户管理
├── 内容管理
├── 系统配置
└── 数据导出

moderator（版主）
├── 内容管理
└── 用户审核

user（普通用户）
└── 个人资料管理
```

## 代码实现

### 1. JWT认证中间件

**文件位置**: `src/middleware/auth.js`

#### 令牌生成函数

```javascript
const generateToken = (payload, options = {}) => {
  const defaultOptions = {
    expiresIn: '24h',
    issuer: 'node-backend-tutorial',
    audience: 'api-users'
  };
  
  const tokenOptions = { ...defaultOptions, ...options };
  
  try {
    const token = jwt.sign(payload, process.env.JWT_SECRET, tokenOptions);
    return {
      success: true,
      token,
      expiresIn: tokenOptions.expiresIn
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};
```

**关键知识点**：
- `expiresIn`: 令牌有效期
- `issuer`: 令牌颁发者
- `audience`: 令牌受众
- `process.env.JWT_SECRET`: 签名密钥（必须保密）

#### 令牌验证函数

```javascript
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return {
      success: true,
      payload: decoded
    };
  } catch (error) {
    let message = '令牌验证失败';
    
    if (error.name === 'TokenExpiredError') {
      message = '令牌已过期';
    } else if (error.name === 'JsonWebTokenError') {
      message = '无效的令牌';
    }
    
    return {
      success: false,
      error: message,
      code: error.name
    };
  }
};
```

#### 认证中间件

```javascript
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      status: 'error',
      message: '缺少授权头部',
      code: 'MISSING_AUTH_HEADER'
    });
  }
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      status: 'error',
      message: '授权头部格式错误，应为 "Bearer <token>"',
      code: 'INVALID_AUTH_FORMAT'
    });
  }
  
  const token = parts[1];
  const verification = verifyToken(token);
  
  if (!verification.success) {
    return res.status(401).json({
      status: 'error',
      message: verification.error,
      code: verification.code
    });
  }
  
  req.user = verification.payload;
  req.token = token;
  
  next();
};
```

#### 权限控制中间件

```javascript
const authorize = (requiredRoles = [], options = {}) => {
  if (typeof requiredRoles === 'string') {
    requiredRoles = [requiredRoles];
  }
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: '用户未认证',
        code: 'NOT_AUTHENTICATED'
      });
    }
    
    if (requiredRoles.length === 0) {
      return next();
    }
    
    const userRole = req.user.role;
    
    if (!requiredRoles.includes(userRole)) {
      return res.status(403).json({
        status: 'error',
        message: '权限不足',
        required: requiredRoles,
        current: userRole,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }
    
    // 资源所有权检查
    if (options.checkOwnership && req.params.id) {
      const resourceId = parseInt(req.params.id);
      const userId = req.user.userId;
      
      if (userRole !== 'admin' && resourceId !== userId) {
        return res.status(403).json({
          status: 'error',
          message: '只能访问自己的资源',
          code: 'RESOURCE_ACCESS_DENIED'
        });
      }
    }
    
    next();
  };
};
```

### 2. 认证控制器

**文件位置**: `src/controllers/authController.js`

#### 用户注册

```javascript
const register = async (req, res) => {
  try {
    const { username, email, password, role = 'user' } = req.body;
    
    // 检查用户名和邮箱唯一性
    const existingUser = users.find(u => u.username === username || u.email === email);
    if (existingUser) {
      return statusCode.clientError.conflict(res, '用户名或邮箱已存在');
    }
    
    // 密码哈希
    const hashResult = await auth.hashPassword(password);
    if (!hashResult.success) {
      return statusCode.serverError.internalError(res, '密码加密失败');
    }
    
    // 创建新用户
    const newUser = {
      id: Math.max(...users.map(u => u.id), 0) + 1,
      username,
      email,
      password: hashResult.hash,
      role,
      createdAt: new Date().toISOString(),
      isActive: true
    };
    
    users.push(newUser);
    
    // 生成JWT令牌
    const tokenPayload = {
      userId: newUser.id,
      username: newUser.username,
      role: newUser.role
    };
    
    const tokenResult = auth.generateToken(tokenPayload);
    
    const { password: _, ...userWithoutPassword } = newUser;
    
    statusCode.success.created(res, {
      user: userWithoutPassword,
      token: tokenResult.token,
      expiresIn: tokenResult.expiresIn
    }, '用户注册成功');
    
  } catch (error) {
    statusCode.serverError.internalError(res, '注册过程中发生错误', error);
  }
};
```

#### 用户登录

```javascript
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // 查找用户
    const user = users.find(u => u.username === username || u.email === username);
    if (!user) {
      return statusCode.clientError.unauthorized(res, '用户名或密码错误');
    }
    
    // 验证密码
    const passwordResult = await auth.verifyPassword(password, user.password);
    if (!passwordResult.isValid) {
      return statusCode.clientError.unauthorized(res, '用户名或密码错误');
    }
    
    // 生成JWT令牌
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };
    
    const tokenResult = auth.generateToken(tokenPayload);
    
    const { password: _, ...userWithoutPassword } = user;
    
    statusCode.success.ok(res, {
      user: userWithoutPassword,
      token: tokenResult.token,
      expiresIn: tokenResult.expiresIn
    }, '登录成功');
    
  } catch (error) {
    statusCode.serverError.internalError(res, '登录过程中发生错误', error);
  }
};
```

### 3. 认证路由

**文件位置**: `src/routes/auth.js`

```javascript
// 用户注册
router.post('/register', validateRequest({
  body: {
    username: { required: true, type: 'string', minLength: 3, maxLength: 20 },
    email: { required: true, type: 'string', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    password: { required: true, type: 'string', minLength: 6, maxLength: 50 }
  }
}), authController.register);

// 用户登录
router.post('/login', validateRequest({
  body: {
    username: { required: true, type: 'string' },
    password: { required: true, type: 'string' }
  }
}), authController.login);

// 受保护的路由
router.get('/profile', auth.authenticate, authController.getProfile);

// 管理员专用路由
router.get('/users', 
  auth.authenticate, 
  auth.authorize(['admin', 'moderator']), 
  authController.getAllUsers
);
```

## 调试实践

### 1. 启动服务器

```bash
npm run dev
```

### 2. 测试用户注册

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

**预期响应**：
```json
{
  "status": "success",
  "message": "用户注册成功",
  "data": {
    "user": {
      "id": 4,
      "username": "testuser",
      "email": "test@example.com",
      "role": "user",
      "createdAt": "2024-01-01T10:00:00.000Z",
      "isActive": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "24h"
  },
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

### 3. 测试用户登录

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

### 4. 测试受保护的路由

首先登录获取令牌，然后使用令牌访问受保护的路由：

```bash
# 1. 登录获取令牌
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# 2. 使用令牌访问受保护的路由
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/auth/profile
```

### 5. 测试权限控制

#### 管理员访问

```bash
# 管理员令牌
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# 访问管理员专用端点
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/api/auth/demo/admin-only
```

#### 普通用户访问（应该被拒绝）

```bash
# 普通用户令牌
USER_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user1","password":"password123"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# 尝试访问管理员端点（应该返回403）
curl -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:3000/api/auth/demo/admin-only
```

**预期响应（403 Forbidden）**：
```json
{
  "status": "error",
  "message": "权限不足",
  "required": ["admin"],
  "current": "user",
  "code": "INSUFFICIENT_PERMISSIONS",
  "timestamp": "2024-01-01T10:00:00.000Z"
}
```

### 6. 测试令牌刷新

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Authorization: Bearer $TOKEN"
```

### 7. 测试错误情况

#### 无效令牌

```bash
curl -H "Authorization: Bearer invalid_token" \
  http://localhost:3000/api/auth/profile
```

#### 缺少授权头

```bash
curl http://localhost:3000/api/auth/profile
```

#### 过期令牌（手动修改JWT）

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE2NDA5OTUyMDB9.invalid" \
  http://localhost:3000/api/auth/profile
```

### 8. 测试不同权限演示端点

```bash
# 公开端点（无需认证）
curl http://localhost:3000/api/auth/demo/public

# 需要认证的端点
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/auth/demo/protected

# 版主及以上权限
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3000/api/auth/demo/moderator-plus

# 资源所有权检查
curl -H "Authorization: Bearer $USER_TOKEN" \
  http://localhost:3000/api/auth/demo/own-resource/2
```

## 实践练习

### 练习1：实现密码复杂度验证

```javascript
const validatePasswordStrength = (password) => {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('密码长度至少8位');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('密码必须包含大写字母');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('密码必须包含小写字母');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('密码必须包含数字');
  }
  
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('密码必须包含特殊字符');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
```

### 练习2：实现令牌黑名单

```javascript
const tokenBlacklist = new Set();

const logout = (req, res, next) => {
  const token = req.token;
  
  // 将令牌加入黑名单
  tokenBlacklist.add(token);
  
  res.json({
    status: 'success',
    message: '登出成功'
  });
};

const checkBlacklist = (req, res, next) => {
  const token = req.token;
  
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({
      status: 'error',
      message: '令牌已失效',
      code: 'TOKEN_BLACKLISTED'
    });
  }
  
  next();
};
```

### 练习3：实现登录尝试限制

```javascript
const loginAttempts = new Map();

const rateLimitLogin = (req, res, next) => {
  const { username } = req.body;
  const key = `login_${username}`;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15分钟
  const maxAttempts = 5;
  
  const attempts = loginAttempts.get(key) || [];
  const recentAttempts = attempts.filter(time => now - time < windowMs);
  
  if (recentAttempts.length >= maxAttempts) {
    return res.status(429).json({
      status: 'error',
      message: '登录尝试次数过多，请稍后再试',
      retryAfter: Math.ceil(windowMs / 1000)
    });
  }
  
  // 记录本次尝试
  recentAttempts.push(now);
  loginAttempts.set(key, recentAttempts);
  
  next();
};
```

## 安全最佳实践

### 1. JWT密钥管理

- 使用强随机密钥（至少256位）
- 定期轮换密钥
- 在环境变量中存储密钥
- 不同环境使用不同密钥

### 2. 令牌安全

- 设置合理的过期时间
- 使用HTTPS传输令牌
- 在客户端安全存储令牌
- 实现令牌刷新机制

### 3. 密码安全

- 使用足够的盐值轮数（12+）
- 实施密码复杂度要求
- 限制登录尝试次数
- 提供密码重置功能

### 4. 权限控制

- 遵循最小权限原则
- 实现细粒度权限控制
- 定期审查用户权限
- 记录敏感操作日志

## 关键概念总结

### JWT工作流程

1. **用户登录** → 验证凭据
2. **生成令牌** → 包含用户信息和权限
3. **客户端存储** → 安全保存令牌
4. **请求认证** → 在请求头中发送令牌
5. **服务器验证** → 解析和验证令牌
6. **授权检查** → 根据角色检查权限

### 认证 vs 授权

- **认证（Authentication）**：验证用户身份
- **授权（Authorization）**：检查用户权限

### 安全考虑

- **令牌泄露**：使用HTTPS和安全存储
- **重放攻击**：使用随机数和时间戳
- **权限提升**：严格验证角色权限
- **会话劫持**：定期刷新令牌

## 阶段验收

完成以下检查项：

**认证功能测试**：
- [ ] 用户注册成功并返回令牌
- [ ] 用户登录验证正确的凭据
- [ ] 错误凭据返回401状态码
- [ ] 密码正确加密存储

**JWT功能测试**：
- [ ] 令牌包含正确的用户信息
- [ ] 令牌签名验证正确
- [ ] 过期令牌被正确拒绝
- [ ] 无效令牌返回适当错误

**权限控制测试**：
- [ ] 未认证用户无法访问受保护路由
- [ ] 普通用户无法访问管理员路由
- [ ] 管理员可以访问所有路由
- [ ] 版主权限正确控制

**安全性测试**：
- [ ] 密码使用bcrypt哈希
- [ ] 令牌在HTTP头中正确传输
- [ ] 敏感信息不在响应中暴露
- [ ] 错误消息不泄露系统信息

**API端点测试**：
- [ ] 注册端点工作正常
- [ ] 登录端点工作正常
- [ ] 用户资料获取和更新
- [ ] 令牌刷新和登出功能

## 下一阶段预告

阶段六将学习数据库ORM与CRUD操作，包括：
- Sequelize ORM框架使用
- 数据库连接和配置
- 模型定义和关联关系
- 数据迁移和种子数据
- 复杂查询和事务处理