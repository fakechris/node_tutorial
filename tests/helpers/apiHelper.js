// API 测试辅助函数
const request = require('supertest');
const jwt = require('jsonwebtoken');

class ApiHelper {
  constructor(app) {
    this.app = app;
    this.request = request(app);
    this.authTokens = new Map();
  }

  // 生成 JWT Token
  generateToken(payload, secret = process.env.JWT_SECRET, expiresIn = '1h') {
    return jwt.sign(payload, secret, { expiresIn });
  }

  // 验证 JWT Token
  verifyToken(token, secret = process.env.JWT_SECRET) {
    return jwt.verify(token, secret);
  }

  // 注册用户并获取 token
  async registerAndLogin(userData = {}) {
    const uniqueId = Math.random().toString(36).substring(2, 15); // 生成12位随机字符串
    const defaultUserData = {
      username: `user${uniqueId}`, // 保持在20字符限制内
      email: `test${uniqueId}@example.com`,
      password: 'TestPassword123!',
      ...userData
    };

    // 注册用户
    const registerResponse = await this.request
      .post('/api/auth/register')
      .send(defaultUserData)
      .expect(201);

    // 登录获取 token
    const loginResponse = await this.request
      .post('/api/auth/login')
      .send({
        username: defaultUserData.username,
        password: defaultUserData.password
      })
      .expect(200);

    const token = loginResponse.body.data.token;
    const user = loginResponse.body.data.user;

    // 缓存 token
    this.authTokens.set(user.id, token);

    return { user, token, registerResponse, loginResponse };
  }

  // 获取认证头
  getAuthHeader(token) {
    return { Authorization: `Bearer ${token}` };
  }

  // 发送认证请求
  authenticatedRequest(method, url, token) {
    return this.request[method.toLowerCase()](url)
      .set('Authorization', `Bearer ${token}`);
  }

  // GET 请求
  get(url, options = {}) {
    let req = this.request.get(url);
    
    if (options.token) {
      req = req.set('Authorization', `Bearer ${options.token}`);
    }
    
    if (options.query) {
      req = req.query(options.query);
    }

    return req;
  }

  // POST 请求
  post(url, data = {}, options = {}) {
    let req = this.request.post(url).send(data);
    
    if (options.token) {
      req = req.set('Authorization', `Bearer ${options.token}`);
    }

    return req;
  }

  // PUT 请求
  put(url, data = {}, options = {}) {
    let req = this.request.put(url).send(data);
    
    if (options.token) {
      req = req.set('Authorization', `Bearer ${options.token}`);
    }

    return req;
  }

  // DELETE 请求
  delete(url, options = {}) {
    let req = this.request.delete(url);
    
    if (options.token) {
      req = req.set('Authorization', `Bearer ${options.token}`);
    }

    return req;
  }

  // 上传文件请求
  async upload(url, fieldName, filePath, options = {}) {
    let req = this.request.post(url).attach(fieldName, filePath);
    
    if (options.token) {
      req = req.set('Authorization', `Bearer ${options.token}`);
    }

    if (options.fields) {
      Object.entries(options.fields).forEach(([key, value]) => {
        req = req.field(key, value);
      });
    }

    return req;
  }

  // 测试 API 响应格式
  expectSuccessResponse(response, statusCode = 200) {
    expect(response.status).toBe(statusCode);
    expect(response.body).toHaveProperty('status', 'success');
    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('timestamp');
    
    if (response.body.data) {
      expect(response.body.data).toBeDefined();
    }
  }

  // 测试 API 错误响应格式
  expectErrorResponse(response, statusCode = 400) {
    expect(response.status).toBe(statusCode);
    expect(response.body).toHaveProperty('status', 'error');
    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('timestamp');
  }

  // 测试分页响应格式
  expectPaginatedResponse(response, statusCode = 200, itemsKey = 'items') {
    this.expectSuccessResponse(response, statusCode);
    
    // 支持不同的数据项键名（如posts, categories等）
    const actualItemsKey = response.body.data.posts ? 'posts' : 
                          response.body.data.categories ? 'categories' :
                          response.body.data.comments ? 'comments' :
                          itemsKey;
    
    expect(response.body.data).toHaveProperty(actualItemsKey);
    expect(response.body.data).toHaveProperty('pagination');
    expect(response.body.data.pagination).toHaveProperty('page');
    expect(response.body.data.pagination).toHaveProperty('limit');
    expect(response.body.data.pagination).toHaveProperty('total');
    expect(response.body.data.pagination).toHaveProperty('totalPages');
    
    expect(Array.isArray(response.body.data[actualItemsKey])).toBe(true);
  }

  // 测试用户数据格式
  expectUserFormat(user) {
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('username');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('createdAt');
    expect(user).toHaveProperty('updatedAt');
    
    // 确保敏感信息不会泄露
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('passwordHash');
  }

  // 测试文章数据格式
  expectPostFormat(post) {
    expect(post).toHaveProperty('id');
    expect(post).toHaveProperty('title');
    expect(post).toHaveProperty('content');
    expect(post).toHaveProperty('status');
    expect(post).toHaveProperty('authorId');
    expect(post).toHaveProperty('createdAt');
    expect(post).toHaveProperty('updatedAt');
  }

  // 测试分类数据格式
  expectCategoryFormat(category) {
    expect(category).toHaveProperty('id');
    expect(category).toHaveProperty('name');
    expect(category).toHaveProperty('description');
    expect(category).toHaveProperty('createdAt');
    expect(category).toHaveProperty('updatedAt');
  }

  // 测试评论数据格式
  expectCommentFormat(comment) {
    expect(comment).toHaveProperty('id');
    expect(comment).toHaveProperty('content');
    expect(comment).toHaveProperty('authorId');
    expect(comment).toHaveProperty('postId');
    expect(comment).toHaveProperty('createdAt');
    expect(comment).toHaveProperty('updatedAt');
  }

  // 性能测试辅助函数
  async measureResponseTime(requestFn) {
    const startTime = Date.now();
    const response = await requestFn();
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    return { response, responseTime };
  }

  // 批量请求测试
  async batchRequests(requests) {
    const startTime = Date.now();
    const results = await Promise.all(requests);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    return { results, totalTime };
  }

  // 清理认证缓存
  clearAuthCache() {
    this.authTokens.clear();
  }

  // 获取缓存的 token
  getCachedToken(userId) {
    return this.authTokens.get(userId);
  }

  // 设置缓存的 token
  setCachedToken(userId, token) {
    this.authTokens.set(userId, token);
  }
}

module.exports = ApiHelper;