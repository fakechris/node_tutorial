// 阶段六：用户管理CRUD控制器
const { User, Post, Comment } = require('../models');
const { Op } = require('sequelize');
const statusCode = require('../middleware/statusCode');

const userController = {
  // 获取用户列表（支持分页、搜索、过滤）
  getUsers: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        role,
        status,
        search,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = req.query;

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

      // 验证排序字段
      const validSortFields = ['createdAt', 'updatedAt', 'username', 'email', 'role'];
      const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
      const actualSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) 
        ? sortOrder.toUpperCase() 
        : 'DESC';

      // 分页参数
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      // 查询用户
      const { count, rows: users } = await User.findAndCountAll({
        where: whereConditions,
        limit: limitNum,
        offset: offset,
        order: [[actualSortBy, actualSortOrder]],
        attributes: { exclude: ['password'] }, // 排除密码字段
        include: [
          {
            model: Post,
            as: 'posts',
            attributes: ['id'],
            required: false
          },
          {
            model: Comment,
            as: 'comments',
            attributes: ['id'],
            required: false
          }
        ]
      });

      // 处理用户数据
      const processedUsers = users.map(user => {
        const userInfo = user.getPublicInfo();
        return {
          ...userInfo,
          postsCount: user.posts ? user.posts.length : 0,
          commentsCount: user.comments ? user.comments.length : 0
        };
      });

      statusCode.success.ok(res, {
        users: processedUsers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count,
          totalPages: Math.ceil(count / limitNum),
          hasNext: pageNum < Math.ceil(count / limitNum),
          hasPrev: pageNum > 1
        },
        filters: { role, status, search },
        sorting: { sortBy: actualSortBy, sortOrder: actualSortOrder }
      }, '获取用户列表成功');

    } catch (error) {
      statusCode.serverError.internalError(res, '获取用户列表失败', error);
    }
  },

  // 获取单个用户详情
  getUserById: async (req, res) => {
    try {
      const { id } = req.params;
      const { includeStats = false } = req.query;

      const user = await User.findByPk(id, {
        attributes: { exclude: ['password'] },
        include: includeStats === 'true' ? [
          {
            model: Post,
            as: 'posts',
            attributes: ['id', 'title', 'status', 'createdAt', 'viewCount'],
            limit: 5,
            order: [['createdAt', 'DESC']]
          },
          {
            model: Comment,
            as: 'comments',
            attributes: ['id', 'content', 'createdAt'],
            limit: 5,
            order: [['createdAt', 'DESC']]
          }
        ] : []
      });

      if (!user) {
        return statusCode.clientError.notFound(res, '用户不存在');
      }

      const userInfo = user.getPublicInfo();
      
      // 如果需要统计信息
      if (includeStats === 'true') {
        const stats = await user.getStats();
        userInfo.stats = stats;
        userInfo.recentPosts = user.posts || [];
        userInfo.recentComments = user.comments || [];
      }

      statusCode.success.ok(res, userInfo, '获取用户信息成功');

    } catch (error) {
      statusCode.serverError.internalError(res, '获取用户信息失败', error);
    }
  },

  // 创建用户（管理员功能）
  createUser: async (req, res) => {
    try {
      const {
        username,
        email,
        password,
        role = 'user',
        firstName,
        lastName,
        bio,
        isActive = true
      } = req.body;

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

      // 创建用户
      const newUser = await User.create({
        username,
        email,
        password, // 密码会在模型钩子中自动加密
        role,
        firstName: firstName || '',
        lastName: lastName || '',
        bio: bio || null,
        isActive
      });

      // 获取用户公开信息
      const userPublicInfo = newUser.getPublicInfo();

      statusCode.success.created(res, userPublicInfo, '用户创建成功');

    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message);
        return statusCode.clientError.badRequest(res, `数据验证失败: ${validationErrors.join(', ')}`);
      }

      if (error.name === 'SequelizeUniqueConstraintError') {
        return statusCode.clientError.conflict(res, '用户名或邮箱已存在');
      }

      statusCode.serverError.internalError(res, '创建用户失败', error);
    }
  },

  // 更新用户信息（管理员功能）
  updateUser: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        username,
        email,
        role,
        firstName,
        lastName,
        bio,
        isActive
      } = req.body;

      const user = await User.findByPk(id);
      if (!user) {
        return statusCode.clientError.notFound(res, '用户不存在');
      }

      // 检查用户名和邮箱的唯一性（如果要更新的话）
      if (username || email) {
        const existingUser = await User.findOne({
          where: {
            [Op.and]: [
              { id: { [Op.ne]: id } },
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

      // 验证角色
      if (role) {
        const validRoles = ['user', 'moderator', 'admin'];
        if (!validRoles.includes(role)) {
          return statusCode.clientError.badRequest(res, `角色必须是以下之一: ${validRoles.join(', ')}`);
        }
      }

      // 准备更新数据
      const updateData = {};
      if (username !== undefined) updateData.username = username;
      if (email !== undefined) updateData.email = email;
      if (role !== undefined) updateData.role = role;
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (bio !== undefined) updateData.bio = bio;
      if (isActive !== undefined) updateData.isActive = isActive;

      // 更新用户
      await user.update(updateData);

      // 重新获取更新后的用户信息
      await user.reload();
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

  // 删除用户（软删除）
  deleteUser: async (req, res) => {
    try {
      const { id } = req.params;
      const { permanent = false } = req.query;

      const user = await User.findByPk(id);
      if (!user) {
        return statusCode.clientError.notFound(res, '用户不存在');
      }

      // 不能删除自己
      if (parseInt(id) === req.user.userId) {
        return statusCode.clientError.badRequest(res, '不能删除自己的账户');
      }

      if (permanent === 'true') {
        // 永久删除（物理删除）
        await user.destroy({ force: true });
        statusCode.success.ok(res, null, '用户已永久删除');
      } else {
        // 软删除
        await user.destroy();
        statusCode.success.ok(res, null, '用户已删除');
      }

    } catch (error) {
      statusCode.serverError.internalError(res, '删除用户失败', error);
    }
  },

  // 恢复已删除的用户
  restoreUser: async (req, res) => {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id, { paranoid: false });
      if (!user) {
        return statusCode.clientError.notFound(res, '用户不存在');
      }

      if (!user.deletedAt) {
        return statusCode.clientError.badRequest(res, '用户未被删除，无需恢复');
      }

      await user.restore();

      const userPublicInfo = user.getPublicInfo();
      statusCode.success.ok(res, userPublicInfo, '用户恢复成功');

    } catch (error) {
      statusCode.serverError.internalError(res, '恢复用户失败', error);
    }
  },

  // 重置用户密码（管理员功能）
  resetPassword: async (req, res) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword) {
        return statusCode.clientError.badRequest(res, '新密码不能为空');
      }

      const user = await User.findByPk(id);
      if (!user) {
        return statusCode.clientError.notFound(res, '用户不存在');
      }

      // 更新密码（会在模型钩子中自动加密）
      await user.update({ password: newPassword });

      statusCode.success.ok(res, null, '密码重置成功');

    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message);
        return statusCode.clientError.badRequest(res, `密码验证失败: ${validationErrors.join(', ')}`);
      }

      statusCode.serverError.internalError(res, '重置密码失败', error);
    }
  },

  // 获取用户统计信息
  getUserStats: async (req, res) => {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id);
      if (!user) {
        return statusCode.clientError.notFound(res, '用户不存在');
      }

      const stats = await user.getStats();
      statusCode.success.ok(res, stats, '获取用户统计信息成功');

    } catch (error) {
      statusCode.serverError.internalError(res, '获取用户统计信息失败', error);
    }
  },

  // 批量操作用户
  batchOperation: async (req, res) => {
    try {
      const { operation, userIds, data = {} } = req.body;

      if (!operation || !Array.isArray(userIds) || userIds.length === 0) {
        return statusCode.clientError.badRequest(res, '操作类型和用户ID列表不能为空');
      }

      const validOperations = ['activate', 'deactivate', 'delete', 'changeRole'];
      if (!validOperations.includes(operation)) {
        return statusCode.clientError.badRequest(res, `操作类型必须是以下之一: ${validOperations.join(', ')}`);
      }

      // 不能操作自己
      if (userIds.includes(req.user.userId)) {
        return statusCode.clientError.badRequest(res, '不能对自己执行批量操作');
      }

      const results = [];

      for (const userId of userIds) {
        try {
          const user = await User.findByPk(userId);
          if (!user) {
            results.push({ userId, success: false, message: '用户不存在' });
            continue;
          }

          switch (operation) {
            case 'activate':
              await user.update({ isActive: true });
              results.push({ userId, success: true, message: '用户已激活' });
              break;

            case 'deactivate':
              await user.update({ isActive: false });
              results.push({ userId, success: true, message: '用户已禁用' });
              break;

            case 'delete':
              await user.destroy();
              results.push({ userId, success: true, message: '用户已删除' });
              break;

            case 'changeRole':
              if (!data.role) {
                results.push({ userId, success: false, message: '角色参数缺失' });
                continue;
              }
              const validRoles = ['user', 'moderator', 'admin'];
              if (!validRoles.includes(data.role)) {
                results.push({ userId, success: false, message: '无效的角色' });
                continue;
              }
              await user.update({ role: data.role });
              results.push({ userId, success: true, message: '角色更新成功' });
              break;
          }
        } catch (error) {
          results.push({ userId, success: false, message: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      statusCode.success.ok(res, {
        operation,
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: failCount
        }
      }, `批量操作完成：成功 ${successCount} 个，失败 ${failCount} 个`);

    } catch (error) {
      statusCode.serverError.internalError(res, '批量操作失败', error);
    }
  }
};

module.exports = userController;