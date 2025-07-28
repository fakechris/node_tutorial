// 阶段五：认证控制器
const auth = require('../middleware/auth');
const statusCode = require('../middleware/statusCode');

// 模拟用户数据库（在实际应用中应该使用真实数据库）
let users = [
  { 
    id: 1, 
    username: 'admin', 
    email: 'admin@example.com', 
    password: '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LCJksb6df1cw0.W3O', // 密码: admin123
    role: 'admin', 
    createdAt: '2024-01-01T00:00:00.000Z',
    lastLoginAt: null,
    isActive: true
  },
  { 
    id: 2, 
    username: 'user1', 
    email: 'user1@example.com', 
    password: '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 密码: password123
    role: 'user', 
    createdAt: '2024-01-02T00:00:00.000Z',
    lastLoginAt: null,
    isActive: true
  },
  { 
    id: 3, 
    username: 'moderator', 
    email: 'mod@example.com', 
    password: '$2a$12$6BEXzElFGDie7EKYs8EKNe1TLk0/EHzISjHgHDzQd4s0rYoMtMKkW', // 密码: mod123
    role: 'moderator', 
    createdAt: '2024-01-03T00:00:00.000Z',
    lastLoginAt: null,
    isActive: true
  }
];

const authController = {
  // 用户注册
  register: async (req, res) => {
    try {
      const { username, email, password, role = 'user' } = req.body;
      
      // 检查用户名和邮箱是否已存在
      const existingUser = users.find(u => u.username === username || u.email === email);
      if (existingUser) {
        return statusCode.clientError.conflict(res, '用户名或邮箱已存在');
      }
      
      // 验证角色
      const validRoles = ['user', 'moderator', 'admin'];
      if (!validRoles.includes(role)) {
        return statusCode.clientError.badRequest(res, `角色必须是以下之一: ${validRoles.join(', ')}`);
      }
      
      // 只有管理员可以创建管理员和版主账户
      if ((role === 'admin' || role === 'moderator') && (!req.user || req.user.role !== 'admin')) {
        return statusCode.clientError.forbidden(res, '只有管理员可以创建管理员或版主账户');
      }
      
      // 密码哈希
      const hashResult = await auth.hashPassword(password);
      if (!hashResult.success) {
        return statusCode.serverError.internalError(res, '密码加密失败', new Error(hashResult.error));
      }
      
      // 创建新用户
      const newUser = {
        id: Math.max(...users.map(u => u.id), 0) + 1,
        username,
        email,
        password: hashResult.hash,
        role,
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
        isActive: true
      };
      
      users.push(newUser);
      
      // 自动登录新注册的用户（生成令牌）
      const tokenPayload = {
        userId: newUser.id,
        username: newUser.username,
        role: newUser.role
      };
      
      const tokenResult = auth.generateToken(tokenPayload);
      if (!tokenResult.success) {
        return statusCode.serverError.internalError(res, '令牌生成失败', new Error(tokenResult.error));
      }
      
      // 返回用户信息（不包含密码）
      const { password: _, ...userWithoutPassword } = newUser;
      
      statusCode.success.created(res, {
        user: userWithoutPassword,
        token: tokenResult.token,
        expiresIn: tokenResult.expiresIn
      }, '用户注册成功');
      
    } catch (error) {
      statusCode.serverError.internalError(res, '注册过程中发生错误', error);
    }
  },

  // 用户登录
  login: async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // 查找用户（支持用户名或邮箱登录）
      const user = users.find(u => u.username === username || u.email === username);
      if (!user) {
        return statusCode.clientError.unauthorized(res, '用户名或密码错误');
      }
      
      // 检查账户状态
      if (!user.isActive) {
        return statusCode.clientError.forbidden(res, '账户已被禁用');
      }
      
      // 验证密码
      const passwordResult = await auth.verifyPassword(password, user.password);
      if (!passwordResult.success) {
        return statusCode.serverError.internalError(res, '密码验证失败', new Error(passwordResult.error));
      }
      
      if (!passwordResult.isValid) {
        return statusCode.clientError.unauthorized(res, '用户名或密码错误');
      }
      
      // 更新最后登录时间
      const userIndex = users.findIndex(u => u.id === user.id);
      users[userIndex].lastLoginAt = new Date().toISOString();
      
      // 生成JWT令牌
      const tokenPayload = {
        userId: user.id,
        username: user.username,
        role: user.role
      };
      
      const tokenResult = auth.generateToken(tokenPayload);
      if (!tokenResult.success) {
        return statusCode.serverError.internalError(res, '令牌生成失败', new Error(tokenResult.error));
      }
      
      // 返回登录信息（不包含密码）
      const { password: _, ...userWithoutPassword } = users[userIndex];
      
      statusCode.success.ok(res, {
        user: userWithoutPassword,
        token: tokenResult.token,
        expiresIn: tokenResult.expiresIn
      }, '登录成功');
      
    } catch (error) {
      statusCode.serverError.internalError(res, '登录过程中发生错误', error);
    }
  },

  // 获取当前用户信息
  getProfile: (req, res) => {
    try {
      const user = users.find(u => u.id === req.user.userId);
      if (!user) {
        return statusCode.clientError.notFound(res, '用户不存在');
      }
      
      // 返回用户信息（不包含密码）
      const { password: _, ...userWithoutPassword } = user;
      
      statusCode.success.ok(res, {
        user: userWithoutPassword,
        tokenInfo: {
          issuedAt: new Date(req.user.iat * 1000).toISOString(),
          expiresAt: new Date(req.user.exp * 1000).toISOString(),
          issuer: req.user.iss,
          audience: req.user.aud
        }
      }, '获取用户信息成功');
      
    } catch (error) {
      statusCode.serverError.internalError(res, '获取用户信息失败', error);
    }
  },

  // 更新用户资料
  updateProfile: async (req, res) => {
    try {
      const { username, email, currentPassword, newPassword } = req.body;
      const userId = req.user.userId;
      
      const userIndex = users.findIndex(u => u.id === userId);
      if (userIndex === -1) {
        return statusCode.clientError.notFound(res, '用户不存在');
      }
      
      const user = users[userIndex];
      
      // 如果要更新用户名或邮箱，检查唯一性
      if (username || email) {
        const existingUser = users.find(u => 
          u.id !== userId && (u.username === username || u.email === email)
        );
        if (existingUser) {
          return statusCode.clientError.conflict(res, '用户名或邮箱已被其他用户使用');
        }
      }
      
      // 如果要更新密码，验证当前密码
      if (newPassword) {
        if (!currentPassword) {
          return statusCode.clientError.badRequest(res, '更新密码时必须提供当前密码');
        }
        
        const passwordResult = await auth.verifyPassword(currentPassword, user.password);
        if (!passwordResult.success) {
          return statusCode.serverError.internalError(res, '密码验证失败', new Error(passwordResult.error));
        }
        
        if (!passwordResult.isValid) {
          return statusCode.clientError.unauthorized(res, '当前密码错误');
        }
        
        // 加密新密码
        const hashResult = await auth.hashPassword(newPassword);
        if (!hashResult.success) {
          return statusCode.serverError.internalError(res, '新密码加密失败', new Error(hashResult.error));
        }
        
        user.password = hashResult.hash;
      }
      
      // 更新其他字段
      if (username) user.username = username;
      if (email) user.email = email;
      user.updatedAt = new Date().toISOString();
      
      users[userIndex] = user;
      
      // 返回更新后的用户信息（不包含密码）
      const { password: _, ...userWithoutPassword } = user;
      
      statusCode.success.ok(res, userWithoutPassword, '用户信息更新成功');
      
    } catch (error) {
      statusCode.serverError.internalError(res, '更新用户信息失败', error);
    }
  },

  // 修改用户角色（仅管理员）
  changeUserRole: async (req, res) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      
      const validRoles = ['user', 'moderator', 'admin'];
      if (!validRoles.includes(role)) {
        return statusCode.clientError.badRequest(res, `角色必须是以下之一: ${validRoles.join(', ')}`);
      }
      
      const userIndex = users.findIndex(u => u.id === parseInt(userId));
      if (userIndex === -1) {
        return statusCode.clientError.notFound(res, '用户不存在');
      }
      
      // 不能修改自己的角色
      if (parseInt(userId) === req.user.userId) {
        return statusCode.clientError.badRequest(res, '不能修改自己的角色');
      }
      
      users[userIndex].role = role;
      users[userIndex].updatedAt = new Date().toISOString();
      
      const { password: _, ...userWithoutPassword } = users[userIndex];
      
      statusCode.success.ok(res, userWithoutPassword, '用户角色更新成功');
      
    } catch (error) {
      statusCode.serverError.internalError(res, '更新用户角色失败', error);
    }
  },

  // 禁用/启用用户（仅管理员）
  toggleUserStatus: (req, res) => {
    try {
      const { userId } = req.params;
      
      const userIndex = users.findIndex(u => u.id === parseInt(userId));
      if (userIndex === -1) {
        return statusCode.clientError.notFound(res, '用户不存在');
      }
      
      // 不能禁用自己
      if (parseInt(userId) === req.user.userId) {
        return statusCode.clientError.badRequest(res, '不能禁用自己的账户');
      }
      
      users[userIndex].isActive = !users[userIndex].isActive;
      users[userIndex].updatedAt = new Date().toISOString();
      
      const { password: _, ...userWithoutPassword } = users[userIndex];
      const action = userWithoutPassword.isActive ? '启用' : '禁用';
      
      statusCode.success.ok(res, userWithoutPassword, `用户账户${action}成功`);
      
    } catch (error) {
      statusCode.serverError.internalError(res, '更新用户状态失败', error);
    }
  },

  // 获取所有用户（仅管理员和版主）
  getAllUsers: (req, res) => {
    try {
      const { page = 1, limit = 10, role, status } = req.query;
      
      let filteredUsers = users.map(({ password, ...user }) => user);
      
      // 按角色过滤
      if (role) {
        filteredUsers = filteredUsers.filter(user => user.role === role);
      }
      
      // 按状态过滤
      if (status !== undefined) {
        const isActive = status === 'active';
        filteredUsers = filteredUsers.filter(user => user.isActive === isActive);
      }
      
      // 分页
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const total = filteredUsers.length;
      const startIndex = (pageNum - 1) * limitNum;
      const paginatedUsers = filteredUsers.slice(startIndex, startIndex + limitNum);
      
      statusCode.success.ok(res, {
        users: paginatedUsers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: total,
          totalPages: Math.ceil(total / limitNum)
        },
        filters: { role, status }
      }, '获取用户列表成功');
      
    } catch (error) {
      statusCode.serverError.internalError(res, '获取用户列表失败', error);
    }
  }
};

module.exports = authController;