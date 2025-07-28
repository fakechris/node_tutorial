// 阶段六：用户路由模块（集成数据库）
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/requestValidator');

// 路由级中间件：用户ID验证
const validateUserId = (req, res, next) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      status: 'error',
      message: '用户ID必须是正整数',
      timestamp: new Date().toISOString()
    });
  }
  req.params.id = userId;
  next();
};

// GET /api/users - 获取用户列表（支持分页、搜索、过滤、排序）
// 需要认证，管理员和版主可以访问
router.get('/', 
  auth.authenticate, 
  auth.authorize(['admin', 'moderator']), 
  userController.getUsers
);

// GET /api/users/:id - 获取单个用户详情
// 需要认证，管理员和版主可以访问，普通用户只能查看自己的信息
router.get('/:id', 
  validateUserId,
  auth.authenticate,
  (req, res, next) => {
    // 普通用户只能查看自己的信息
    if (req.user.role === 'user' && req.user.userId !== parseInt(req.params.id)) {
      return res.status(403).json({
        status: 'error',
        message: '权限不足：只能查看自己的用户信息',
        timestamp: new Date().toISOString()
      });
    }
    next();
  },
  userController.getUserById
);

// POST /api/users - 创建新用户（仅管理员）
router.post('/', 
  auth.authenticate,
  auth.authorize(['admin']),
  validateRequest({
    body: {
      username: { 
        required: true, 
        type: 'string', 
        minLength: 3, 
        maxLength: 30,
        pattern: /^[a-zA-Z0-9_]+$/
      },
      email: { 
        required: true, 
        type: 'string', 
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ 
      },
      password: {
        required: true,
        type: 'string',
        minLength: 6,
        maxLength: 50
      },
      role: { 
        required: false, 
        type: 'string'
      },
      firstName: {
        required: false,
        type: 'string',
        maxLength: 50
      },
      lastName: {
        required: false,
        type: 'string',
        maxLength: 50
      },
      bio: {
        required: false,
        type: 'string',
        maxLength: 500
      },
      isActive: {
        required: false,
        type: 'boolean'
      }
    }
  }), 
  userController.createUser
);

// PUT /api/users/:id - 更新用户信息（仅管理员）
router.put('/:id', 
  validateUserId,
  auth.authenticate,
  auth.authorize(['admin']),
  validateRequest({
    body: {
      username: { 
        required: false, 
        type: 'string', 
        minLength: 3, 
        maxLength: 30,
        pattern: /^[a-zA-Z0-9_]+$/
      },
      email: { 
        required: false, 
        type: 'string', 
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ 
      },
      role: { 
        required: false, 
        type: 'string'
      },
      firstName: {
        required: false,
        type: 'string',
        maxLength: 50
      },
      lastName: {
        required: false,
        type: 'string',
        maxLength: 50
      },
      bio: {
        required: false,
        type: 'string',
        maxLength: 500
      },
      isActive: {
        required: false,
        type: 'boolean'
      }
    }
  }), 
  userController.updateUser
);

// DELETE /api/users/:id - 删除用户（仅管理员）
router.delete('/:id', 
  validateUserId,
  auth.authenticate,
  auth.authorize(['admin']),
  userController.deleteUser
);

// POST /api/users/:id/restore - 恢复已删除的用户（仅管理员）
router.post('/:id/restore', 
  validateUserId,
  auth.authenticate,
  auth.authorize(['admin']),
  userController.restoreUser
);

// POST /api/users/:id/reset-password - 重置用户密码（仅管理员）
router.post('/:id/reset-password', 
  validateUserId,
  auth.authenticate,
  auth.authorize(['admin']),
  validateRequest({
    body: {
      newPassword: {
        required: true,
        type: 'string',
        minLength: 6,
        maxLength: 50
      }
    }
  }),
  userController.resetPassword
);

// GET /api/users/:id/stats - 获取用户统计信息
router.get('/:id/stats', 
  validateUserId,
  auth.authenticate,
  auth.authorize(['admin', 'moderator']),
  userController.getUserStats
);

// POST /api/users/batch - 批量操作用户（仅管理员）
router.post('/batch', 
  auth.authenticate,
  auth.authorize(['admin']),
  validateRequest({
    body: {
      operation: {
        required: true,
        type: 'string'
      },
      userIds: {
        required: true,
        type: 'array',
        minItems: 1
      },
      data: {
        required: false,
        type: 'object'
      }
    }
  }),
  userController.batchOperation
);

// PATCH /api/users/:id/role - 更新用户角色（仅管理员）
router.patch('/:id/role', 
  validateUserId,
  auth.authenticate,
  auth.authorize(['admin']),
  validateRequest({
    body: {
      role: { 
        required: true, 
        type: 'string'
      }
    }
  }),
  (req, res, next) => {
    // 使用现有 auth controller 的 changeUserRole 方法
    const authController = require('../controllers/authController');
    authController.changeUserRole(req, res);
  }
);

// PATCH /api/users/:id/status - 切换用户状态（仅管理员）
router.patch('/:id/status', 
  validateUserId,
  auth.authenticate,
  auth.authorize(['admin']),
  (req, res, next) => {
    // 使用现有 auth controller 的 toggleUserStatus 方法
    const authController = require('../controllers/authController');
    authController.toggleUserStatus(req, res);
  }
);

module.exports = router;