// 认证系统集成测试
const testDatabase = require('../helpers/testDatabase');
const ApiHelper = require('../helpers/apiHelper');

// 创建测试应用实例
let app;
let apiHelper;

describe('Authentication Integration Tests', () => {
  beforeAll(async () => {
    // 初始化测试数据库
    await testDatabase.initialize();
    
    // 动态导入应用
    const appModule = require('../../src/index');
    app = appModule.app || appModule;
    
    // 初始化 API 助手
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
      
      apiHelper.expectUserFormat(response.body.data.user);
      expect(response.body.data.user.username).toBe(userData.username);
      expect(response.body.data.user.email).toBe(userData.email);
      
      expect(response.body.data.token).toBeValidJWT();
    });

    it('should reject registration with duplicate username', async () => {
      const userData = {
        username: 'duplicateuser',
        email: 'duplicate@example.com',
        password: 'SecurePassword123!'
      };

      // 第一次注册应该成功
      await apiHelper.post('/api/auth/register', userData)
        .expect(201);

      // 第二次注册应该失败
      const response = await apiHelper.post('/api/auth/register', {
        ...userData,
        email: 'different@example.com' // 不同的邮箱
      });

      apiHelper.expectErrorResponse(response, 409);
      expect(response.body.message).toContain('用户名或邮箱已存在');
    });

    it('should reject registration with duplicate email', async () => {
      const userData = {
        username: 'user1',
        email: 'duplicate@example.com',
        password: 'SecurePassword123!'
      };

      // 第一次注册应该成功
      await apiHelper.post('/api/auth/register', userData)
        .expect(201);

      // 第二次注册应该失败
      const response = await apiHelper.post('/api/auth/register', {
        username: 'user2', // 不同的用户名
        email: userData.email,
        password: 'SecurePassword123!'
      });

      apiHelper.expectErrorResponse(response, 409);
      expect(response.body.message).toContain('用户名或邮箱已存在');
    });

    it('should reject registration with invalid email format', async () => {
      const userData = {
        username: 'testuser',
        email: 'invalid-email-format',
        password: 'SecurePassword123!'
      };

      const response = await apiHelper.post('/api/auth/register', userData);

      apiHelper.expectErrorResponse(response, 400);
      expect(response.body.message).toContain('请求参数验证失败');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: '123' // 太弱的密码
      };

      const response = await apiHelper.post('/api/auth/register', userData);

      apiHelper.expectErrorResponse(response, 400);
      expect(response.body.message).toContain('请求参数验证失败');
    });

    it('should reject registration with missing required fields', async () => {
      const incompleteData = {
        username: 'testuser'
        // 缺少 email 和 password
      };

      const response = await apiHelper.post('/api/auth/register', incompleteData);

      apiHelper.expectErrorResponse(response, 400);
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser;

    beforeEach(async () => {
      // 创建测试用户
      testUser = await testDatabase.createTestUser({
        username: 'loginuser',
        email: 'login@example.com',
        password: 'TestPassword123!'
      });
    });

    it('should login with valid username and password', async () => {
      const loginData = {
        username: 'loginuser',
        password: 'TestPassword123!'
      };

      const response = await apiHelper.post('/api/auth/login', loginData);

      apiHelper.expectSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      
      apiHelper.expectUserFormat(response.body.data.user);
      expect(response.body.data.user.id).toBe(testUser.id);
      expect(response.body.data.token).toBeValidJWT();
    });

    it('should login with valid email and password', async () => {
      const loginData = {
        username: 'login@example.com', // Email can be passed in the username field
        password: 'TestPassword123!'
      };

      const response = await apiHelper.post('/api/auth/login', loginData);

      apiHelper.expectSuccessResponse(response, 200);
      expect(response.body.data.user.id).toBe(testUser.id);
    });

    it('should reject login with invalid username', async () => {
      const loginData = {
        username: 'nonexistentuser',
        password: 'TestPassword123!'
      };

      const response = await apiHelper.post('/api/auth/login', loginData);

      apiHelper.expectErrorResponse(response, 401);
      expect(response.body.message).toContain('用户名或密码错误');
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        username: 'loginuser',
        password: 'WrongPassword'
      };

      const response = await apiHelper.post('/api/auth/login', loginData);

      apiHelper.expectErrorResponse(response, 401);
      expect(response.body.message).toContain('用户名或密码错误');
    });

    it('should reject login with missing credentials', async () => {
      const response = await apiHelper.post('/api/auth/login', {});

      apiHelper.expectErrorResponse(response, 400);
    });
  });

  describe('POST /api/auth/logout', () => {
    let authData;

    beforeEach(async () => {
      authData = await apiHelper.registerAndLogin();
    });

    it('should logout successfully with valid token', async () => {
      const response = await apiHelper.post('/api/auth/logout', {}, {
        token: authData.token
      });

      apiHelper.expectSuccessResponse(response, 200);
    });

    it('should reject logout without token', async () => {
      const response = await apiHelper.post('/api/auth/logout', {});

      apiHelper.expectErrorResponse(response, 401);
    });

    it('should reject logout with invalid token', async () => {
      const response = await apiHelper.post('/api/auth/logout', {}, {
        token: 'invalid-token'
      });

      apiHelper.expectErrorResponse(response, 401);
    });
  });

  describe('GET /api/auth/profile', () => {
    let authData;

    beforeEach(async () => {
      authData = await apiHelper.registerAndLogin();
    });

    it('should return current user info with valid token', async () => {
      const response = await apiHelper.get('/api/auth/profile', {
        token: authData.token
      });

      apiHelper.expectSuccessResponse(response, 200);
      expect(response.body.data).toHaveProperty('user');
      
      apiHelper.expectUserFormat(response.body.data.user);
      expect(response.body.data.user.id).toBe(authData.user.id);
    });

    it('should reject request without token', async () => {
      const response = await apiHelper.get('/api/auth/profile');

      apiHelper.expectErrorResponse(response, 401);
    });

    it('should reject request with expired token', async () => {
      // 生成过期的 token
      const expiredToken = apiHelper.generateToken(
        { userId: authData.user.id },
        process.env.JWT_SECRET,
        '-1h' // 过期时间
      );

      const response = await apiHelper.get('/api/auth/profile', {
        token: expiredToken
      });

      apiHelper.expectErrorResponse(response, 401);
    });
  });

  describe('PUT /api/auth/profile', () => {
    let authData;

    beforeEach(async () => {
      authData = await apiHelper.registerAndLogin();
    });

    it('should update user profile successfully', async () => {
      const updateData = {
        bio: 'Updated bio',
        firstName: 'John',
        lastName: 'Doe'
      };

      const response = await apiHelper.put('/api/auth/profile', updateData, {
        token: authData.token
      });

      apiHelper.expectSuccessResponse(response, 200);
      expect(response.body.data.user.bio).toBe(updateData.bio);
      expect(response.body.data.user.firstName).toBe(updateData.firstName);
      expect(response.body.data.user.lastName).toBe(updateData.lastName);
    });

    it('should not allow updating password without current password', async () => {
      const updateData = {
        password: 'NewPassword123!' // Missing currentPassword
      };

      const response = await apiHelper.put('/api/auth/profile', updateData, {
        token: authData.token
      });

      apiHelper.expectErrorResponse(response, 400);
      expect(response.body.message).toContain('更新密码时必须提供当前密码');
    });

    it('should reject update without authentication', async () => {
      const updateData = {
        bio: 'Updated bio'
      };

      const response = await apiHelper.put('/api/auth/profile', updateData);

      apiHelper.expectErrorResponse(response, 401);
    });
  });

  describe('POST /api/auth/change-password', () => {
    let authData;

    beforeEach(async () => {
      authData = await apiHelper.registerAndLogin({
        password: 'OldPassword123!'
      });
    });

    it('should change password successfully', async () => {
      const passwordData = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!'
      };

      const response = await apiHelper.post('/api/auth/change-password', passwordData, {
        token: authData.token
      });

      apiHelper.expectSuccessResponse(response, 200);

      // 验证可以用新密码登录
      const loginResponse = await apiHelper.post('/api/auth/login', {
        username: authData.user.username,
        password: 'NewPassword123!'
      });

      apiHelper.expectSuccessResponse(loginResponse, 200);
    });

    it('should reject change with wrong current password', async () => {
      const passwordData = {
        currentPassword: 'WrongPassword',
        newPassword: 'NewPassword123!'
      };

      const response = await apiHelper.post('/api/auth/change-password', passwordData, {
        token: authData.token
      });

      apiHelper.expectErrorResponse(response, 400);
    });

    it('should reject weak new password', async () => {
      const passwordData = {
        currentPassword: 'OldPassword123!',
        newPassword: '123' // 太弱
      };

      const response = await apiHelper.post('/api/auth/change-password', passwordData, {
        token: authData.token
      });

      apiHelper.expectErrorResponse(response, 400);
    });
  });

  describe('Token Validation', () => {
    let authData;

    beforeEach(async () => {
      authData = await apiHelper.registerAndLogin();
    });

    it('should validate JWT token structure', async () => {
      const token = authData.token;
      const decoded = apiHelper.verifyToken(token);
      
      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('exp');
      expect(decoded.userId).toBe(authData.user.id);
    });

    it('should reject tampered token', async () => {
      const token = authData.token;
      const tamperedToken = token.slice(0, -10) + 'tampered123';

      const response = await apiHelper.get('/api/auth/profile', {
        token: tamperedToken
      });

      apiHelper.expectErrorResponse(response, 401);
    });

    it('should handle malformed token', async () => {
      const malformedToken = 'not.a.valid.jwt.token';

      const response = await apiHelper.get('/api/auth/profile', {
        token: malformedToken
      });

      apiHelper.expectErrorResponse(response, 401);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to login attempts', async () => {
      const loginData = {
        username: 'nonexistent',
        password: 'wrongpassword'
      };

      // 发送多个失败的登录请求
      const requests = Array.from({ length: 10 }, () =>
        apiHelper.post('/api/auth/login', loginData)
      );

      const responses = await Promise.all(requests);

      // 应该有一些请求被速率限制
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});