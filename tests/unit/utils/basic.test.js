// 基础功能测试 - 验证测试环境是否正常工作
describe('Basic Test Environment', () => {
  describe('Jest Configuration', () => {
    it('should run basic test', () => {
      expect(true).toBe(true);
    });

    it('should have test environment variables set', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should have custom matchers available', () => {
      // 测试自定义的 JWT 匹配器
      const validJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      expect(validJWT).toBeValidJWT();

      const invalidJWT = 'not.a.valid.jwt';
      expect(invalidJWT).not.toBeValidJWT();
    });

    it('should have UUID matcher available', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      expect(validUUID).toBeValidUUID();

      const invalidUUID = 'not-a-uuid';
      expect(invalidUUID).not.toBeValidUUID();
    });

    it('should have response time matcher available', () => {
      const fastResponse = 100;
      const slowResponse = 2000;

      expect(fastResponse).toRespondWithin(1000);
      expect(slowResponse).not.toRespondWithin(1000);
    });
  });

  describe('Test Helpers', () => {
    it('should have global test helpers available', () => {
      expect(global.testHelpers).toBeDefined();
      expect(typeof global.testHelpers.delay).toBe('function');
      expect(typeof global.testHelpers.generateUserData).toBe('function');
      expect(typeof global.testHelpers.generateCategoryData).toBe('function');
      expect(typeof global.testHelpers.generatePostData).toBe('function');
      expect(typeof global.testHelpers.generateCommentData).toBe('function');
    });

    it('should generate test user data', () => {
      const userData = global.testHelpers.generateUserData();
      
      expect(userData).toHaveProperty('username');
      expect(userData).toHaveProperty('email');
      expect(userData).toHaveProperty('password');
      expect(userData.username).toMatch(/^testuser_\d+$/);
      expect(userData.email).toMatch(/^test_\d+@example\.com$/);
      expect(userData.password).toBe('TestPassword123!');
    });

    it('should generate test user data with overrides', () => {
      const overrides = {
        username: 'customuser',
        email: 'custom@example.com'
      };
      
      const userData = global.testHelpers.generateUserData(overrides);
      
      expect(userData.username).toBe('customuser');
      expect(userData.email).toBe('custom@example.com');
      expect(userData.password).toBe('TestPassword123!'); // 默认值保持不变
    });

    it('should generate test category data', () => {
      const categoryData = global.testHelpers.generateCategoryData();
      
      expect(categoryData).toHaveProperty('name');
      expect(categoryData).toHaveProperty('description');
      expect(categoryData.name).toMatch(/^Test Category \d+$/);
      expect(categoryData.description).toBe('Test category description');
    });

    it('should generate test post data', () => {
      const postData = global.testHelpers.generatePostData();
      
      expect(postData).toHaveProperty('title');
      expect(postData).toHaveProperty('content');
      expect(postData).toHaveProperty('status');
      expect(postData.title).toMatch(/^Test Post \d+$/);
      expect(postData.content).toBe('This is test post content');
      expect(postData.status).toBe('published');
    });

    it('should generate test comment data', () => {
      const commentData = global.testHelpers.generateCommentData();
      
      expect(commentData).toHaveProperty('content');
      expect(commentData.content).toBe('This is a test comment');
    });

    it('should support delay helper', async () => {
      const start = Date.now();
      await global.testHelpers.delay(50);
      const end = Date.now();
      const duration = end - start;
      
      expect(duration).toBeGreaterThanOrEqual(45); // 允许一些误差
      expect(duration).toBeLessThan(100); // 但不应该太慢
    });
  });

  describe('Node.js Environment', () => {
    it('should have required Node.js globals', () => {
      expect(global.process).toBeDefined();
      expect(global.Buffer).toBeDefined();
      expect(global.console).toBeDefined();
      expect(typeof require).toBe('function');
      expect(typeof module).toBe('object');
    });

    it('should be running in test environment', () => {
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.SQLITE_DATABASE_PATH).toBe(':memory:');
      expect(process.env.JWT_SECRET).toBe('test-jwt-secret-key-for-testing-only');
      expect(process.env.SESSION_SECRET).toBe('test-session-secret-for-testing-only');
      expect(process.env.LOG_LEVEL).toBe('error');
    });
  });

  describe('JavaScript Features', () => {
    it('should support modern JavaScript features', () => {
      // 测试 async/await
      const asyncFunction = async () => {
        return 'async result';
      };
      
      expect(asyncFunction()).toBeInstanceOf(Promise);
      
      // 测试箭头函数
      const arrowFunction = (x) => x * 2;
      expect(arrowFunction(5)).toBe(10);
      
      // 测试解构赋值
      const obj = { a: 1, b: 2 };
      const { a, b } = obj;
      expect(a).toBe(1);
      expect(b).toBe(2);
      
      // 测试扩展运算符
      const arr1 = [1, 2, 3];
      const arr2 = [...arr1, 4, 5];
      expect(arr2).toEqual([1, 2, 3, 4, 5]);
    });

    it('should support Promises', async () => {
      const promise = new Promise((resolve) => {
        setTimeout(() => resolve('resolved'), 10);
      });
      
      const result = await promise;
      expect(result).toBe('resolved');
    });

    it('should handle Promise rejections', async () => {
      const rejectingPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Test error')), 10);
      });
      
      await expect(rejectingPromise).rejects.toThrow('Test error');
    });
  });

  describe('Math and Utilities', () => {
    it('should perform basic math operations', () => {
      expect(2 + 2).toBe(4);
      expect(10 - 5).toBe(5);
      expect(3 * 4).toBe(12);
      expect(15 / 3).toBe(5);
      expect(10 % 3).toBe(1);
    });

    it('should handle string operations', () => {
      const str = 'Hello World';
      expect(str.length).toBe(11);
      expect(str.toUpperCase()).toBe('HELLO WORLD');
      expect(str.toLowerCase()).toBe('hello world');
      expect(str.includes('World')).toBe(true);
      expect(str.split(' ')).toEqual(['Hello', 'World']);
    });

    it('should handle array operations', () => {
      const arr = [1, 2, 3, 4, 5];
      expect(arr.length).toBe(5);
      expect(arr.includes(3)).toBe(true);
      expect(arr.map(x => x * 2)).toEqual([2, 4, 6, 8, 10]);
      expect(arr.filter(x => x % 2 === 0)).toEqual([2, 4]);
      expect(arr.reduce((sum, x) => sum + x, 0)).toBe(15);
    });

    it('should handle object operations', () => {
      const obj = { name: 'Test', age: 25, active: true };
      
      expect(Object.keys(obj)).toEqual(['name', 'age', 'active']);
      expect(Object.values(obj)).toEqual(['Test', 25, true]);
      expect(Object.entries(obj)).toEqual([
        ['name', 'Test'],
        ['age', 25],
        ['active', true]
      ]);
      
      expect(obj.hasOwnProperty('name')).toBe(true);
      expect(obj.hasOwnProperty('missing')).toBe(false);
    });
  });

  describe('Date and Time', () => {
    it('should handle date operations', () => {
      const now = new Date();
      expect(now).toBeInstanceOf(Date);
      expect(typeof now.getTime()).toBe('number');
      expect(now.getTime()).toBeGreaterThan(0);
    });

    it('should handle time measurements', () => {
      const start = Date.now();
      // 模拟一些处理时间
      for (let i = 0; i < 1000; i++) {
        Math.random();
      }
      const end = Date.now();
      const duration = end - start;
      
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(1000); // 应该很快完成
    });
  });

  describe('Error Handling', () => {
    it('should handle thrown errors', () => {
      const throwError = () => {
        throw new Error('Test error');
      };
      
      expect(throwError).toThrow('Test error');
      expect(throwError).toThrow(Error);
    });

    it('should handle different error types', () => {
      const throwTypeError = () => {
        throw new TypeError('Type error');
      };
      
      const throwRangeError = () => {
        throw new RangeError('Range error');
      };
      
      expect(throwTypeError).toThrow(TypeError);
      expect(throwRangeError).toThrow(RangeError);
    });

    it('should handle async errors', async () => {
      const asyncError = async () => {
        throw new Error('Async error');
      };
      
      await expect(asyncError()).rejects.toThrow('Async error');
    });
  });
});