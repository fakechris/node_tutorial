# 阶段一：项目初始化与框架搭建

## 学习目标

- 理解为什么使用Express.js框架
- 掌握Node.js项目的标准结构
- 学会环境变量的管理
- 理解Express基础中间件的作用

## 理论讲解

### 为什么选择Express.js？

Express.js是Node.js最流行的Web框架，它提供了：
1. **简洁的API** - 用最少的代码实现强大功能
2. **中间件系统** - 模块化处理请求和响应
3. **路由系统** - 灵活的URL处理机制
4. **丰富的生态** - 庞大的第三方插件库

### 项目结构设计原则

```
node-backend/
├── .env                 # 环境变量配置
├── .gitignore          # Git忽略文件
├── package.json        # 项目配置与依赖
├── README.md           # 项目说明
└── src/                # 源代码目录
    ├── index.js        # 应用入口
    ├── config/         # 配置文件
    ├── middleware/     # 自定义中间件
    ├── routes/         # 路由定义
    ├── controllers/    # 业务逻辑控制器
    └── models/         # 数据模型
```

这种结构的优势：
- **职责分离** - 每个目录负责特定功能
- **易于维护** - 代码组织清晰
- **团队协作** - 统一的代码结构

## 代码实现

### 1. 项目初始化

```bash
# 创建项目目录
mkdir node-backend && cd node-backend

# 初始化package.json
npm init -y

# 创建目录结构
mkdir -p src/{config,middleware,routes,controllers,models}
```

### 2. 安装依赖

```bash
# 生产依赖
npm install express dotenv

# 开发依赖
npm install -D nodemon
```

### 3. 环境变量配置 (.env)

```env
# 服务器配置
PORT=3000

# 数据库配置（后续使用）
DB_HOST=localhost
DB_NAME=todo_db
DB_USER=root
DB_PASS=password

# JWT配置（后续使用）
JWT_SECRET=your_super_secret_jwt_key_here

# 环境设置
NODE_ENV=development
```

### 4. 应用入口文件 (src/index.js)

```javascript
// 阶段一：项目初始化与框架搭建
require('dotenv').config();

const express = require('express');
const app = express();

// 基础中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查路由
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Node.js后端服务正常运行',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 根路由
app.get('/', (req, res) => {
  res.json({
    message: '欢迎来到Node.js后端开发教程',
    version: '1.0.0',
    stage: '阶段一：项目初始化与框架搭建'
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 服务器启动成功！`);
  console.log(`📍 本地地址: http://localhost:${PORT}`);
  console.log(`🌍 环境模式: ${process.env.NODE_ENV || 'development'}`);
});
```

## 调试实践

### 1. 启动服务器

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

### 2. 测试接口

使用curl或Postman测试：

```bash
# 测试根路由
curl http://localhost:3000/

# 测试健康检查
curl http://localhost:3000/health

# 测试404处理
curl http://localhost:3000/nonexistent
```

### 3. 观察服务器输出

启动后应该看到：
```
🚀 服务器启动成功！
📍 本地地址: http://localhost:3000
🌍 环境模式: development
⏰ 启动时间: 2024-01-01 10:00:00
```

## 关键概念理解

### 1. 中间件（Middleware）

```javascript
app.use(express.json());        // 解析JSON请求体
app.use(express.urlencoded()); // 解析表单数据
```

中间件是Express的核心概念，它们按顺序执行，每个中间件都能：
- 执行代码
- 修改请求和响应对象
- 结束请求-响应循环
- 调用下一个中间件

### 2. 路由处理

```javascript
app.get('/', (req, res) => {
  // req: 请求对象
  // res: 响应对象
});
```

### 3. 环境变量管理

使用`dotenv`包管理敏感配置：
- 开发环境使用`.env`文件
- 生产环境使用系统环境变量
- 敏感信息不提交到版本控制

## 阶段验收

完成以下检查项：

- [ ] 服务器成功启动在3000端口
- [ ] GET `/` 返回欢迎信息
- [ ] GET `/health` 返回健康状态
- [ ] 访问不存在路由返回404
- [ ] 控制台输出包含启动信息
- [ ] 修改代码后nodemon自动重启
- [ ] 环境变量正确加载

## 下一阶段预告

阶段二将学习中间件的深入原理，包括：
- 自定义日志中间件
- 错误处理中间件
- 中间件执行顺序
- 条件中间件