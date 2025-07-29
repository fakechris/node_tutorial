// 阶段五：认证路由
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/requestValidator');
const statusCode = require('../middleware/statusCode');

// 公开路由（无需认证）

// POST /api/auth/register - 用户注册
router.post(
  '/register',
  validateRequest({
    body: {
      username: {
        required: true,
        type: 'string',
        minLength: 3,
        maxLength: 20,
        pattern: /^[a-zA-Z0-9_]+$/,
      },
      email: {
        required: true,
        type: 'string',
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },
      password: {
        required: true,
        type: 'string',
        minLength: 6,
        maxLength: 50,
      },
      role: {
        required: false,
        type: 'string',
      },
    },
  }),
  auth.optionalAuth,
  authController.register
);

// POST /api/auth/login - 用户登录
router.post(
  '/login',
  validateRequest({
    body: {
      username: {
        required: true,
        type: 'string',
        minLength: 1,
      },
      password: {
        required: true,
        type: 'string',
        minLength: 1,
      },
    },
  }),
  authController.login
);

// 需要认证的路由

// GET /api/auth/profile - 获取当前用户信息
router.get('/profile', auth.authenticate, authController.getProfile);

// PUT /api/auth/profile - 更新用户资料
router.put(
  '/profile',
  auth.authenticate,
  validateRequest({
    body: {
      username: {
        required: false,
        type: 'string',
        minLength: 3,
        maxLength: 20,
        pattern: /^[a-zA-Z0-9_]+$/,
      },
      email: {
        required: false,
        type: 'string',
        pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      },
      currentPassword: {
        required: false,
        type: 'string',
        minLength: 1,
      },
      newPassword: {
        required: false,
        type: 'string',
        minLength: 6,
        maxLength: 50,
      },
    },
  }),
  authController.updateProfile
);

// POST /api/auth/refresh - 刷新令牌
router.post('/refresh', auth.authenticate, auth.refreshToken);

// POST /api/auth/logout - 登出
router.post('/logout', auth.authenticate, auth.logout);

// 管理员路由

// GET /api/auth/users - 获取所有用户（管理员和版主）
router.get(
  '/users',
  auth.authenticate,
  auth.authorize(['admin', 'moderator']),
  authController.getAllUsers
);

// PUT /api/auth/users/:userId/role - 修改用户角色（仅管理员）
router.put(
  '/users/:userId/role',
  auth.authenticate,
  auth.authorize(['admin']),
  validateRequest({
    body: {
      role: {
        required: true,
        type: 'string',
      },
    },
  }),
  authController.changeUserRole
);

// PATCH /api/auth/users/:userId/status - 禁用/启用用户（仅管理员）
router.patch(
  '/users/:userId/status',
  auth.authenticate,
  auth.authorize(['admin']),
  authController.toggleUserStatus
);

// 认证演示路由

// GET /api/auth/demo/public - 公开访问
router.get('/demo/public', (req, res) => {
  statusCode.success.ok(
    res,
    {
      message: '这是一个公开的端点',
      userInfo: req.user
        ? {
            authenticated: true,
            username: req.user.username,
            role: req.user.role,
          }
        : {
            authenticated: false,
          },
    },
    '公开端点访问成功'
  );
});

// GET /api/auth/demo/protected - 需要认证
router.get('/demo/protected', auth.authenticate, (req, res) => {
  statusCode.success.ok(
    res,
    {
      message: '这是一个受保护的端点',
      user: {
        id: req.user.userId,
        username: req.user.username,
        role: req.user.role,
      },
      tokenInfo: {
        issuedAt: new Date(req.user.iat * 1000).toISOString(),
        expiresAt: new Date(req.user.exp * 1000).toISOString(),
      },
    },
    '受保护端点访问成功'
  );
});

// GET /api/auth/demo/admin-only - 仅管理员
router.get(
  '/demo/admin-only',
  auth.authenticate,
  auth.authorize(['admin']),
  (req, res) => {
    statusCode.success.ok(
      res,
      {
        message: '这是一个仅管理员可访问的端点',
        user: {
          id: req.user.userId,
          username: req.user.username,
          role: req.user.role,
        },
        adminPrivileges: ['用户管理', '系统配置', '数据导出', '日志查看'],
      },
      '管理员端点访问成功'
    );
  }
);

// GET /api/auth/demo/moderator-plus - 版主及以上
router.get(
  '/demo/moderator-plus',
  auth.authenticate,
  auth.authorize(['admin', 'moderator']),
  (req, res) => {
    statusCode.success.ok(
      res,
      {
        message: '这是一个版主及以上可访问的端点',
        user: {
          id: req.user.userId,
          username: req.user.username,
          role: req.user.role,
        },
        privileges:
          req.user.role === 'admin'
            ? ['内容管理', '用户管理', '系统管理']
            : ['内容管理', '用户审核'],
      },
      '版主端点访问成功'
    );
  }
);

// GET /api/auth/demo/own-resource/:userId - 只能访问自己的资源
router.get(
  '/demo/own-resource/:userId',
  auth.authenticate,
  auth.authorize(['user', 'moderator', 'admin'], { checkOwnership: true }),
  (req, res) => {
    const userId = parseInt(req.params.userId);

    statusCode.success.ok(
      res,
      {
        message: '成功访问自己的资源',
        resourceOwner: userId,
        currentUser: req.user.userId,
        canAccess: userId === req.user.userId || req.user.role === 'admin',
        accessReason: userId === req.user.userId ? '资源所有者' : '管理员权限',
      },
      '资源访问成功'
    );
  }
);

// 认证信息路由
router.get('/info', (req, res) => {
  statusCode.success.ok(
    res,
    {
      endpoints: {
        public: {
          'POST /api/auth/register': '用户注册',
          'POST /api/auth/login': '用户登录',
          'GET /api/auth/demo/public': '公开访问演示',
        },
        authenticated: {
          'GET /api/auth/profile': '获取用户信息',
          'PUT /api/auth/profile': '更新用户资料',
          'POST /api/auth/refresh': '刷新令牌',
          'POST /api/auth/logout': '用户登出',
          'GET /api/auth/demo/protected': '认证访问演示',
        },
        admin: {
          'GET /api/auth/users': '获取所有用户',
          'PUT /api/auth/users/:userId/role': '修改用户角色',
          'PATCH /api/auth/users/:userId/status': '禁用/启用用户',
          'GET /api/auth/demo/admin-only': '管理员专用演示',
        },
        moderator: {
          'GET /api/auth/users': '获取所有用户（只读）',
          'GET /api/auth/demo/moderator-plus': '版主权限演示',
        },
      },
      authFlow: {
        '1. 注册': 'POST /api/auth/register',
        '2. 登录': 'POST /api/auth/login（获取token）',
        '3. 认证': 'Header: Authorization: Bearer <token>',
        '4. 访问': '使用token访问受保护的API',
        '5. 刷新': 'POST /api/auth/refresh（可选）',
        '6. 登出': 'POST /api/auth/logout',
      },
      testAccounts: {
        admin: {
          username: 'admin',
          password: 'admin123',
          role: 'admin',
        },
        user: {
          username: 'user1',
          password: 'password123',
          role: 'user',
        },
        moderator: {
          username: 'moderator',
          password: 'mod123',
          role: 'moderator',
        },
      },
    },
    'JWT认证系统信息'
  );
});

module.exports = router;
