// 阶段五：JWT认证中间件
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const auth = {
  // 生成JWT令牌
  generateToken: (payload, options = {}) => {
    const defaultOptions = {
      expiresIn: '24h',
      issuer: 'node-backend-tutorial',
      audience: 'api-users'
    };
    
    const tokenOptions = { ...defaultOptions, ...options };
    
    try {
      const token = jwt.sign(payload, process.env.JWT_SECRET, tokenOptions);
      return {
        success: true,
        token,
        expiresIn: tokenOptions.expiresIn
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  // 验证JWT令牌
  verifyToken: (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return {
        success: true,
        payload: decoded
      };
    } catch (error) {
      let message = '令牌验证失败';
      
      if (error.name === 'TokenExpiredError') {
        message = '令牌已过期';
      } else if (error.name === 'JsonWebTokenError') {
        message = '无效的令牌';
      } else if (error.name === 'NotBeforeError') {
        message = '令牌尚未生效';
      }
      
      return {
        success: false,
        error: message,
        code: error.name
      };
    }
  },

  // 密码哈希
  hashPassword: async (password) => {
    try {
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      return {
        success: true,
        hash: hashedPassword
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  // 密码验证
  verifyPassword: async (password, hash) => {
    try {
      const isValid = await bcrypt.compare(password, hash);
      return {
        success: true,
        isValid
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  },

  // 认证中间件
  authenticate: (req, res, next) => {
    // 从请求头获取令牌
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        status: 'error',
        message: '缺少授权头部',
        code: 'MISSING_AUTH_HEADER',
        timestamp: new Date().toISOString()
      });
    }
    
    // 检查Bearer格式
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        status: 'error',
        message: '授权头部格式错误，应为 "Bearer <token>"',
        code: 'INVALID_AUTH_FORMAT',
        timestamp: new Date().toISOString()
      });
    }
    
    const token = parts[1];
    const verification = auth.verifyToken(token);
    
    if (!verification.success) {
      return res.status(401).json({
        status: 'error',
        message: verification.error,
        code: verification.code,
        timestamp: new Date().toISOString()
      });
    }
    
    // 将用户信息添加到请求对象
    req.user = verification.payload;
    req.token = token;
    
    next();
  },

  // 可选认证中间件（用户可能已登录也可能未登录）
  optionalAuth: (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      // 没有授权头部，继续处理但不设置用户信息
      return next();
    }
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      // 格式错误，继续处理但不设置用户信息
      return next();
    }
    
    const token = parts[1];
    const verification = auth.verifyToken(token);
    
    if (verification.success) {
      // 令牌有效，设置用户信息
      req.user = verification.payload;
      req.token = token;
    }
    
    // 无论令牌是否有效都继续处理
    next();
  },

  // 权限检查中间件
  authorize: (requiredRoles = [], options = {}) => {
    // 如果传入的是字符串，转换为数组
    if (typeof requiredRoles === 'string') {
      requiredRoles = [requiredRoles];
    }
    
    return (req, res, next) => {
      // 检查用户是否已认证
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: '用户未认证',
          code: 'NOT_AUTHENTICATED',
          timestamp: new Date().toISOString()
        });
      }
      
      // 如果没有指定角色要求，只需要认证即可
      if (requiredRoles.length === 0) {
        return next();
      }
      
      const userRole = req.user.role;
      
      // 检查用户角色是否在允许的角色列表中
      if (!requiredRoles.includes(userRole)) {
        return res.status(403).json({
          status: 'error',
          message: '权限不足',
          required: requiredRoles,
          current: userRole,
          code: 'INSUFFICIENT_PERMISSIONS',
          timestamp: new Date().toISOString()
        });
      }
      
      // 可选：检查资源所有权
      if (options.checkOwnership && req.params.id) {
        const resourceId = parseInt(req.params.id);
        const userId = req.user.userId;
        
        // 管理员可以访问任何资源
        if (userRole === 'admin') {
          return next();
        }
        
        // 其他用户只能访问自己的资源
        if (resourceId !== userId) {
          return res.status(403).json({
            status: 'error',
            message: '只能访问自己的资源',
            code: 'RESOURCE_ACCESS_DENIED',
            timestamp: new Date().toISOString()
          });
        }
      }
      
      next();
    };
  },

  // 刷新令牌
  refreshToken: (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: '用户未认证',
        timestamp: new Date().toISOString()
      });
    }
    
    // 生成新令牌（移除过期时间等敏感信息）
    const { iat, exp, ...payload } = req.user;
    const newTokenResult = auth.generateToken(payload);
    
    if (!newTokenResult.success) {
      return res.status(500).json({
        status: 'error',
        message: '令牌刷新失败',
        error: newTokenResult.error,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      status: 'success',
      message: '令牌刷新成功',
      data: {
        token: newTokenResult.token,
        expiresIn: newTokenResult.expiresIn,
        user: {
          userId: payload.userId,
          username: payload.username,
          role: payload.role
        }
      },
      timestamp: new Date().toISOString()
    });
  },

  // 登出中间件（可以实现令牌黑名单功能）
  logout: (req, res, next) => {
    // 在实际应用中，这里可以将令牌加入黑名单
    // 目前只是简单地返回成功响应
    
    res.json({
      status: 'success',
      message: '登出成功',
      note: '令牌将在过期时间后自动失效',
      timestamp: new Date().toISOString()
    });
  },

  // 用户信息提取中间件
  extractUserInfo: (req, res, next) => {
    if (req.user) {
      // 提取常用的用户信息
      req.currentUser = {
        id: req.user.userId,
        username: req.user.username,
        role: req.user.role,
        isAdmin: req.user.role === 'admin',
        isModerator: ['admin', 'moderator'].includes(req.user.role)
      };
    }
    
    next();
  }
};

module.exports = auth;