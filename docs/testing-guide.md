# 测试系统完整指南

本项目使用 Jest 和 Supertest 构建了完整的测试体系，覆盖单元测试、集成测试和端到端测试。

## 📋 目录

- [测试架构概览](#测试架构概览)
- [测试环境配置](#测试环境配置)
- [单元测试](#单元测试)
- [集成测试](#集成测试)
- [端到端测试](#端到端测试)
- [测试工具和辅助函数](#测试工具和辅助函数)
- [运行测试](#运行测试)
- [代码覆盖率](#代码覆盖率)
- [最佳实践](#最佳实践)

## 🏗️ 测试架构概览

### 测试层次结构

```
tests/
├── unit/                    # 单元测试
│   ├── models/             # 模型测试
│   ├── controllers/        # 控制器测试
│   ├── middleware/         # 中间件测试
│   └── utils/              # 工具函数测试
├── integration/            # 集成测试
│   ├── auth.test.js        # 认证系统集成测试
│   ├── api.test.js         # API 集成测试
│   └── database.test.js    # 数据库集成测试
├── e2e/                    # 端到端测试
│   ├── user-workflow.test.js # 用户工作流测试
│   └── admin-workflow.test.js # 管理员工作流测试
├── helpers/                # 测试辅助函数
│   ├── testDatabase.js     # 数据库测试助手
│   └── apiHelper.js        # API 测试助手
├── fixtures/               # 测试数据
├── setup.js               # 测试环境设置
├── globalSetup.js         # 全局测试设置
└── globalTeardown.js      # 全局测试清理
```

### 测试类型对比

| 测试类型 | 范围 | 速度 | 可靠性 | 维护成本 |
|---------|------|------|--------|---------|
| 单元测试 | 单个函数/类 | 快 | 高 | 低 |
| 集成测试 | 多个组件 | 中等 | 中等 | 中等 |
| 端到端测试 | 完整流程 | 慢 | 高 | 高 |

## ⚙️ 测试环境配置

### Jest 配置

```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js'
};
```

### 环境变量设置

测试环境使用以下环境变量：

```javascript
process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = ':memory:';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.SESSION_SECRET = 'test-session-secret-for-testing-only';
process.env.LOG_LEVEL = 'error';
```

## 🔬 单元测试

### 模型测试示例

```javascript
// tests/unit/models/User.test.js
describe('User Model', () => {
  beforeAll(async () => {
    await testDatabase.initialize();
  });

  beforeEach(async () => {
    await testDatabase.cleanup();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  describe('User Creation', () => {
    it('should create a user with valid data', async () => {
      const { User } = testDatabase.getModels();
      
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      const user = await User.create(userData);

      expect(user.id).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.password).not.toBe(userData.password); // 应该被哈希
    });

    it('should hash password before saving', async () => {
      const { User } = testDatabase.getModels();
      
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'PlainTextPassword'
      };

      const user = await User.create(userData);

      expect(user.password).not.toBe(userData.password);
      expect(user.password).toMatch(/^\$2[ayb]\$[0-9]{2}\$/); // bcrypt 格式
    });
  });
});
```

### 控制器测试模式

```javascript
// tests/unit/controllers/AuthController.test.js
describe('AuthController', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      user: null
    };
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      cookie: jest.fn().mockReturnThis(),
      clearCookie: jest.fn().mockReturnThis()
    };
    next = jest.fn();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      req.body = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'SecurePassword123!'
      };

      await AuthController.register(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.any(Object),
            token: expect.any(String)
          })
        })
      );
    });
  });
});
```

## 🔗 集成测试

### API 集成测试

```javascript
// tests/integration/auth.test.js
describe('Authentication Integration Tests', () => {
  let app, apiHelper;

  beforeAll(async () => {
    await testDatabase.initialize();
    app = require('../../src/index');
    apiHelper = new ApiHelper(app);
  });

  beforeEach(async () => {
    await testDatabase.cleanup();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'SecurePassword123!'
      };

      const response = await apiHelper.post('/api/auth/register', userData);

      apiHelper.expectSuccessResponse(response, 201);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.token).toBeValidJWT();
    });
  });
});
```

### 数据库集成测试

```javascript
// tests/integration/database.test.js
describe('Database Integration Tests', () => {
  describe('Model Relationships', () => {
    it('should handle user-post relationships correctly', async () => {
      const user = await testDatabase.createTestUser();
      const category = await testDatabase.createTestCategory();
      
      const post = await testDatabase.createTestPost({
        authorId: user.id,
        categoryId: category.id
      });

      // 测试关联查询
      const userWithPosts = await user.getPosts();
      expect(userWithPosts).toHaveLength(1);
      expect(userWithPosts[0].id).toBe(post.id);

      const postWithAuthor = await post.getAuthor();
      expect(postWithAuthor.id).toBe(user.id);
    });
  });
});
```

## 🌐 端到端测试

### 完整用户工作流测试

```javascript
// tests/e2e/user-workflow.test.js
describe('User Workflow E2E Tests', () => {
  it('should handle complete user registration to content creation workflow', async () => {
    // 1. 用户注册
    const registerResponse = await apiHelper.post('/api/auth/register', userData);
    const { user, token } = registerResponse.body.data;

    // 2. 登录验证
    const loginResponse = await apiHelper.post('/api/auth/login', loginData);
    
    // 3. 获取用户信息
    const profileResponse = await apiHelper.get('/api/auth/me', { token });
    
    // 4. 创建内容
    const postResponse = await apiHelper.post('/api/posts', postData, { token });
    
    // 5. 添加评论
    const commentResponse = await apiHelper.post(`/api/posts/${post.id}/comments`, commentData, { token });
    
    // 6. 验证完整流程
    expect(/* 各种断言 */).toBe(/* 期望值 */);
  });
});
```

### 性能测试

```javascript
describe('Performance Tests', () => {
  it('should maintain reasonable response times', async () => {
    const { response, responseTime } = await apiHelper.measureResponseTime(async () => {
      return await apiHelper.post('/api/posts', postData, { token });
    });

    apiHelper.expectSuccessResponse(response, 201);
    expect(responseTime).toRespondWithin(1000); // 应该在1秒内完成
  });

  it('should handle concurrent operations', async () => {
    const concurrentRequests = Array.from({ length: 10 }, () =>
      apiHelper.post('/api/auth/register', generateUniqueUserData())
    );

    const results = await Promise.all(concurrentRequests);
    
    results.forEach(response => {
      apiHelper.expectSuccessResponse(response, 201);
    });
  });
});
```

## 🛠️ 测试工具和辅助函数

### 测试数据库助手 (TestDatabase)

```javascript
// tests/helpers/testDatabase.js
class TestDatabase {
  // 初始化测试数据库
  async initialize() { /* ... */ }
  
  // 清理数据
  async cleanup() { /* ... */ }
  
  // 创建测试数据
  async createTestUser(userData = {}) { /* ... */ }
  async createTestPost(postData = {}) { /* ... */ }
  async createTestCategory(categoryData = {}) { /* ... */ }
  
  // 批量创建测试数据
  async seedTestData() { /* ... */ }
}
```

### API 测试助手 (ApiHelper)

```javascript
// tests/helpers/apiHelper.js
class ApiHelper {
  // HTTP 请求方法
  async get(url, options = {}) { /* ... */ }
  async post(url, data = {}, options = {}) { /* ... */ }
  async put(url, data = {}, options = {}) { /* ... */ }
  async delete(url, options = {}) { /* ... */ }
  
  // 认证相关
  async registerAndLogin(userData = {}) { /* ... */ }
  getAuthHeader(token) { /* ... */ }
  
  // 响应验证
  expectSuccessResponse(response, statusCode = 200) { /* ... */ }
  expectErrorResponse(response, statusCode = 400) { /* ... */ }
  expectPaginatedResponse(response, statusCode = 200) { /* ... */ }
  
  // 数据格式验证
  expectUserFormat(user) { /* ... */ }
  expectPostFormat(post) { /* ... */ }
  expectCategoryFormat(category) { /* ... */ }
  
  // 性能测试
  async measureResponseTime(requestFn) { /* ... */ }
  async batchRequests(requests) { /* ... */ }
}
```

### 自定义匹配器

```javascript
// tests/setup.js
expect.extend({
  toBeValidJWT(received) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    const pass = typeof received === 'string' && jwtRegex.test(received);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid JWT token`,
      pass,
    };
  },
  
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = typeof received === 'string' && uuidRegex.test(received);
    
    return {
      message: () => `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
      pass,
    };
  },
  
  toRespondWithin(received, expected) {
    const pass = received <= expected;
    
    return {
      message: () => `expected response time ${received}ms to be ${pass ? 'greater than' : 'within'} ${expected}ms`,
      pass,
    };
  }
});
```

## 🚀 运行测试

### NPM 脚本

```bash
# 运行所有测试
npm test

# 按类型运行测试
npm run test:unit           # 只运行单元测试
npm run test:integration    # 只运行集成测试
npm run test:e2e           # 只运行端到端测试

# 开发模式
npm run test:watch         # 监听模式，文件改变时自动运行测试

# 覆盖率报告
npm run test:coverage      # 生成覆盖率报告

# CI/CD 环境
npm run test:ci           # 适合 CI/CD 的测试运行模式
```

### 命令行选项

```bash
# 运行特定测试文件
npx jest tests/unit/models/User.test.js

# 运行匹配模式的测试
npx jest --testNamePattern="should create user"

# 详细输出
npx jest --verbose

# 监听模式
npx jest --watch

# 并行运行
npx jest --maxWorkers=4

# 失败时停止
npx jest --bail

# 更新快照
npx jest --updateSnapshot
```

## 📊 代码覆盖率

### 覆盖率阈值

```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 70,     // 分支覆盖率
    functions: 75,    // 函数覆盖率
    lines: 80,        // 行覆盖率
    statements: 80    // 语句覆盖率
  },
  './src/controllers/': {
    branches: 60,
    functions: 70,
    lines: 75,
    statements: 75
  },
  './src/models/': {
    branches: 80,
    functions: 85,
    lines: 85,
    statements: 85
  }
}
```

### 覆盖率报告

```bash
# 生成 HTML 覆盖率报告
npm run test:coverage

# 查看报告
open coverage/lcov-report/index.html
```

### 覆盖率排除

```javascript
// jest.config.js
collectCoverageFrom: [
  'src/**/*.js',
  '!src/**/*.test.js',
  '!src/**/*.spec.js',
  '!src/config/database-mock.js',
  '!src/models-mock/**',
  '!coverage/**',
  '!node_modules/**'
]
```

## 📋 最佳实践

### 测试组织

1. **按功能模块组织测试**
   ```
   tests/
   ├── unit/auth/
   ├── unit/posts/
   ├── unit/users/
   └── integration/auth/
   ```

2. **使用描述性的测试名称**
   ```javascript
   describe('User registration', () => {
     it('should create user with valid email and password', () => {});
     it('should reject registration with duplicate email', () => {});
     it('should hash password before storing', () => {});
   });
   ```

3. **遵循 AAA 模式 (Arrange, Act, Assert)**
   ```javascript
   it('should calculate total price correctly', () => {
     // Arrange - 准备测试数据
     const items = [{ price: 10 }, { price: 20 }];
     
     // Act - 执行被测试的操作
     const total = calculateTotal(items);
     
     // Assert - 验证结果
     expect(total).toBe(30);
   });
   ```

### 测试数据管理

1. **使用工厂函数创建测试数据**
   ```javascript
   const createUserData = (overrides = {}) => ({
     username: `user_${Date.now()}`,
     email: `test_${Date.now()}@example.com`,
     password: 'TestPassword123!',
     ...overrides
   });
   ```

2. **在每个测试后清理数据**
   ```javascript
   beforeEach(async () => {
     await testDatabase.cleanup();
   });
   ```

3. **模拟外部依赖**
   ```javascript
   jest.mock('nodemailer', () => ({
     createTransport: jest.fn(() => ({
       sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' })
     }))
   }));
   ```

### 异步测试

1. **使用 async/await**
   ```javascript
   it('should create user asynchronously', async () => {
     const user = await User.create(userData);
     expect(user.id).toBeDefined();
   });
   ```

2. **处理异步错误**
   ```javascript
   it('should reject invalid data', async () => {
     await expect(User.create(invalidData)).rejects.toThrow();
   });
   ```

3. **设置合适的超时时间**
   ```javascript
   it('should complete within reasonable time', async () => {
     // 设置测试超时为 5 秒
   }, 5000);
   ```

### 错误处理测试

1. **测试错误场景**
   ```javascript
   it('should handle database connection error', async () => {
     // 模拟数据库错误
     jest.spyOn(sequelize, 'authenticate').mockRejectedValue(new Error('Connection failed'));
     
     await expect(connectToDatabase()).rejects.toThrow('Connection failed');
   });
   ```

2. **验证错误类型**
   ```javascript
   it('should throw ValidationError for invalid input', async () => {
     await expect(validateInput(invalidData)).rejects.toBeInstanceOf(ValidationError);
   });
   ```

### 性能测试建议

1. **设置性能基准**
   ```javascript
   it('should respond within acceptable time', async () => {
     const start = Date.now();
     await performOperation();
     const duration = Date.now() - start;
     
     expect(duration).toBeLessThan(1000); // 1秒内完成
   });
   ```

2. **测试内存使用**
   ```javascript
   it('should not cause memory leaks', async () => {
     const initialMemory = process.memoryUsage().heapUsed;
     
     // 执行操作
     for (let i = 0; i < 1000; i++) {
       await performOperation();
     }
     
     // 强制垃圾回收
     if (global.gc) global.gc();
     
     const finalMemory = process.memoryUsage().heapUsed;
     const memoryIncrease = finalMemory - initialMemory;
     
     expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 内存增长小于10MB
   });
   ```

### CI/CD 集成

1. **GitHub Actions 配置**
   ```yaml
   # .github/workflows/test.yml
   name: Tests
   
   on: [push, pull_request]
   
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: '18'
             cache: 'npm'
         - run: npm ci
         - run: npm run test:ci
         - uses: codecov/codecov-action@v4
           with:
             file: ./coverage/lcov.info
   ```

2. **测试并行化**
   ```javascript
   // jest.config.js
   module.exports = {
     maxWorkers: '50%', // 使用 50% 的 CPU 核心
     testTimeout: 30000, // 30秒超时
   };
   ```

## 🔧 故障排除

### 常见问题

1. **测试数据库连接问题**
   ```javascript
   // 确保在测试前初始化数据库
   beforeAll(async () => {
     await testDatabase.initialize();
   });
   ```

2. **异步操作未完成**
   ```javascript
   // 使用 await 等待异步操作完成
   await expect(asyncOperation()).resolves.toEqual(expectedValue);
   ```

3. **模拟函数没有被调用**
   ```javascript
   // 检查模拟函数的调用
   expect(mockFunction).toHaveBeenCalledTimes(1);
   expect(mockFunction).toHaveBeenCalledWith(expectedArgs);
   ```

4. **内存泄漏问题**
   ```javascript
   // 在测试后清理资源
   afterEach(() => {
     jest.clearAllMocks();
     // 清理其他资源
   });
   ```

### 调试技巧

1. **使用 console.log 调试**
   ```javascript
   it('should debug test', () => {
     console.log('Debug info:', testData);
     expect(result).toBe(expected);
   });
   ```

2. **使用 Jest 调试模式**
   ```bash
   node --inspect-brk node_modules/.bin/jest --runInBand --no-cache tests/specific.test.js
   ```

3. **检查测试覆盖率缺失**
   ```bash
   npm run test:coverage
   # 查看 coverage/lcov-report/index.html
   ```

---

通过遵循这个测试指南，你可以构建一个健壮、可维护的测试体系，确保代码质量和系统可靠性。记住，好的测试不仅能发现 bug，还能作为代码的活文档，帮助团队理解系统行为。