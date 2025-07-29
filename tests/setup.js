// Jest 测试环境设置文件
const path = require('path');

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.SQLITE_DATABASE_PATH = ':memory:';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.SESSION_SECRET = 'test-session-secret-for-testing-only';
process.env.LOG_LEVEL = 'error'; // 减少测试期间的日志输出

// 动态分配端口以避免冲突
const net = require('net');

const getAvailablePort = () => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = server.address().port;
      server.close(() => {
        resolve(port);
      });
    });
  });
};

// 同步设置端口（使用简单的随机端口）
process.env.PORT = Math.floor(Math.random() * (65535 - 30000) + 30000).toString();

// 设置超时时间
jest.setTimeout(10000);

// 模拟控制台方法以减少测试输出噪音
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // 在测试期间静默某些控制台输出
  console.error = (...args) => {
    // 只显示真正的错误，过滤掉预期的错误消息
    const message = args[0];
    if (typeof message === 'string') {
      // 过滤掉预期的错误消息
      if (
        message.includes('ValidationError') ||
        message.includes('SequelizeValidationError') ||
        message.includes('Test error') ||
        message.includes('Expected error for testing')
      ) {
        return;
      }
    }
    originalConsoleError.apply(console, args);
  };

  console.warn = (...args) => {
    const message = args[0];
    if (typeof message === 'string') {
      // 过滤掉预期的警告消息
      if (
        message.includes('Warning') ||
        message.includes('Deprecation') ||
        message.includes('Test warning')
      ) {
        return;
      }
    }
    originalConsoleWarn.apply(console, args);
  };
});

afterAll(() => {
  // 恢复原始的控制台方法
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// 全局测试工具函数
global.testHelpers = {
  // 等待指定时间
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // 生成测试用户数据
  generateUserData: (overrides = {}) => ({
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'TestPassword123!',
    ...overrides
  }),
  
  // 生成测试分类数据
  generateCategoryData: (overrides = {}) => ({
    name: `Test Category ${Date.now()}`,
    description: 'Test category description',
    ...overrides
  }),
  
  // 生成测试文章数据
  generatePostData: (overrides = {}) => ({
    title: `Test Post ${Date.now()}`,
    content: 'This is test post content',
    status: 'published',
    ...overrides
  }),
  
  // 生成测试评论数据
  generateCommentData: (overrides = {}) => ({
    content: 'This is a test comment',
    ...overrides
  }),
  
  // 清理测试数据的辅助函数
  cleanDatabase: async () => {
    // 这个函数将在具体测试中实现
    // 用于清理测试数据库
  }
};

// 自定义匹配器
expect.extend({
  // 检查是否为有效的JWT token
  toBeValidJWT(received) {
    const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    const pass = typeof received === 'string' && jwtRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid JWT token`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid JWT token`,
        pass: false,
      };
    }
  },
  
  // 检查是否为有效的UUID
  toBeValidUUID(received) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = typeof received === 'string' && uuidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },
  
  // 检查响应时间
  toRespondWithin(received, expected) {
    const pass = received <= expected;
    
    if (pass) {
      return {
        message: () => `expected response time ${received}ms to be greater than ${expected}ms`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected response time ${received}ms to be within ${expected}ms`,
        pass: false,
      };
    }
  }
});

// 处理未捕获的Promise拒绝
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // 在测试环境中，我们可能想要终止进程
  if (process.env.NODE_ENV === 'test') {
    process.exit(1);
  }
});

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // 在测试环境中，我们可能想要终止进程
  if (process.env.NODE_ENV === 'test') {
    process.exit(1);
  }
});