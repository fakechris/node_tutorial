// 阶段六：认证控制器（集成数据库）
const auth = require('../middleware/auth');
const statusCode = require('../middleware/statusCode');
const { User } = require('../models');
const { Op } = require('sequelize');

const authController = {
  // 用户注册
  register: async (req, res) => {
    try {
      const { username, email, password, firstName, lastName, bio, role = 'user' } = req.body;
      
      // 检查用户名和邮箱是否已存在
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { username },
            { email }
          ]
        }
      });
      
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
      
      // 创建新用户（密码会在模型的钩子中自动加密）
      const newUser = await User.create({
        username,
        email,
        password,
        role,
        firstName: firstName || '',
        lastName: lastName || '',
        bio: bio || null,
        isActive: true
      });
      
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
      
      // 获取用户公开信息
      const userPublicInfo = newUser.getPublicInfo();
      
      statusCode.success.created(res, {
        user: userPublicInfo,
        token: tokenResult.token,
        expiresIn: tokenResult.expiresIn
      }, '用户注册成功');
      
    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message);
        return statusCode.clientError.badRequest(res, `数据验证失败: ${validationErrors.join(', ')}`);
      }
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        return statusCode.clientError.conflict(res, '用户名或邮箱已存在');
      }
      
      statusCode.serverError.internalError(res, '注册过程中发生错误', error);
    }
  },

  // 用户登录
  login: async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // 查找用户（支持用户名或邮箱登录）
      const user = await User.findOne({
        where: {
          [Op.or]: [
            { username },
            { email: username }
          ]
        }
      });
      
      if (!user) {
        return statusCode.clientError.unauthorized(res, '用户名或密码错误');
      }
      
      // 检查账户状态
      if (!user.isActive) {
        return statusCode.clientError.forbidden(res, '账户已被禁用');
      }
      
      // 验证密码
      const isPasswordValid = await user.validatePassword(password);
      if (!isPasswordValid) {
        return statusCode.clientError.unauthorized(res, '用户名或密码错误');
      }
      
      // 更新最后登录时间
      await user.update({
        lastLoginAt: new Date()
      });
      
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
      
      // 获取用户公开信息
      const userPublicInfo = user.getPublicInfo();
      
      statusCode.success.ok(res, {
        user: userPublicInfo,
        token: tokenResult.token,
        expiresIn: tokenResult.expiresIn
      }, '登录成功');
      
    } catch (error) {
      statusCode.serverError.internalError(res, '登录过程中发生错误', error);
    }
  },

  // 获取当前用户信息
  getProfile: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.userId);
      if (!user) {
        return statusCode.clientError.notFound(res, '用户不存在');
      }
      
      // 获取用户公开信息
      const userPublicInfo = user.getPublicInfo();
      
      statusCode.success.ok(res, {
        user: userPublicInfo,
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
      const { username, email, firstName, lastName, bio, currentPassword, newPassword } = req.body;
      const userId = req.user.userId;
      
      const user = await User.findByPk(userId);
      if (!user) {
        return statusCode.clientError.notFound(res, '用户不存在');
      }
      
      // 如果要更新用户名或邮箱，检查唯一性
      if (username || email) {
        const existingUser = await User.findOne({
          where: {
            [Op.and]: [
              { id: { [Op.ne]: userId } },
              {
                [Op.or]: [
                  { username: username || '' },
                  { email: email || '' }
                ]
              }
            ]
          }
        });
        
        if (existingUser) {
          return statusCode.clientError.conflict(res, '用户名或邮箱已被其他用户使用');
        }
      }
      
      // 如果要更新密码，验证当前密码
      if (newPassword) {
        if (!currentPassword) {
          return statusCode.clientError.badRequest(res, '更新密码时必须提供当前密码');
        }
        
        const isCurrentPasswordValid = await user.validatePassword(currentPassword);
        if (!isCurrentPasswordValid) {
          return statusCode.clientError.unauthorized(res, '当前密码错误');
        }
      }
      
      // 准备更新数据
      const updateData = {};
      if (username) updateData.username = username;
      if (email) updateData.email = email;
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (bio !== undefined) updateData.bio = bio;
      if (newPassword) updateData.password = newPassword; // 密码会在模型钩子中自动加密
      
      // 更新用户信息
      await user.update(updateData);
      
      // 重新获取更新后的用户信息
      await user.reload();
      
      // 获取用户公开信息
      const userPublicInfo = user.getPublicInfo();
      
      statusCode.success.ok(res, userPublicInfo, '用户信息更新成功');
      
    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message);
        return statusCode.clientError.badRequest(res, `数据验证失败: ${validationErrors.join(', ')}`);
      }
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        return statusCode.clientError.conflict(res, '用户名或邮箱已被其他用户使用');
      }
      
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
      
      const user = await User.findByPk(parseInt(userId));
      if (!user) {
        return statusCode.clientError.notFound(res, '用户不存在');
      }
      
      // 不能修改自己的角色
      if (parseInt(userId) === req.user.userId) {
        return statusCode.clientError.badRequest(res, '不能修改自己的角色');
      }
      
      await user.update({ role });
      
      // 获取用户公开信息
      const userPublicInfo = user.getPublicInfo();
      
      statusCode.success.ok(res, userPublicInfo, '用户角色更新成功');
      
    } catch (error) {
      statusCode.serverError.internalError(res, '更新用户角色失败', error);
    }
  },

  // 禁用/启用用户（仅管理员）
  toggleUserStatus: async (req, res) => {
    try {
      const { userId } = req.params;
      
      const user = await User.findByPk(parseInt(userId));
      if (!user) {
        return statusCode.clientError.notFound(res, '用户不存在');
      }
      
      // 不能禁用自己
      if (parseInt(userId) === req.user.userId) {
        return statusCode.clientError.badRequest(res, '不能禁用自己的账户');
      }
      
      await user.update({ isActive: !user.isActive });
      
      // 获取用户公开信息
      const userPublicInfo = user.getPublicInfo();
      const action = user.isActive ? '启用' : '禁用';
      
      statusCode.success.ok(res, userPublicInfo, `用户账户${action}成功`);
      
    } catch (error) {
      statusCode.serverError.internalError(res, '更新用户状态失败', error);
    }
  },

  // 获取所有用户（仅管理员和版主）
  getAllUsers: async (req, res) => {
    try {
      const { page = 1, limit = 10, role, status, search } = req.query;
      
      // 构建查询条件
      const whereConditions = {};
      
      if (role) {
        whereConditions.role = role;
      }
      
      if (status !== undefined) {
        whereConditions.isActive = status === 'active';
      }
      
      if (search) {
        whereConditions[Op.or] = [
          { username: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { firstName: { [Op.like]: `%${search}%` } },
          { lastName: { [Op.like]: `%${search}%` } }
        ];
      }
      
      // 分页查询
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      
      const { count, rows: users } = await User.findAndCountAll({
        where: whereConditions,
        limit: limitNum,
        offset: offset,
        order: [['createdAt', 'DESC']],
        attributes: { exclude: ['password'] } // 排除密码字段
      });
      
      // 获取用户统计信息
      const userStats = await User.getStats();
      
      statusCode.success.ok(res, {
        users: users.map(user => user.getPublicInfo()),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count,
          totalPages: Math.ceil(count / limitNum)
        },
        filters: { role, status, search },
        stats: userStats
      }, '获取用户列表成功');
      
    } catch (error) {
      statusCode.serverError.internalError(res, '获取用户列表失败', error);
    }
  }
};

module.exports = authController;