// 阶段三：用户路由模块
const express = require('express');
const router = express.Router();
const validateRequest = require('../middleware/requestValidator');

// 模拟用户数据库
let users = [
  { id: 1, username: 'admin', email: 'admin@example.com', role: 'admin', createdAt: '2024-01-01T00:00:00.000Z' },
  { id: 2, username: 'user1', email: 'user1@example.com', role: 'user', createdAt: '2024-01-02T00:00:00.000Z' },
  { id: 3, username: 'user2', email: 'user2@example.com', role: 'user', createdAt: '2024-01-03T00:00:00.000Z' }
];

// 路由级中间件：参数验证
const validateUserId = (req, res, next) => {
  const userId = parseInt(req.params.id);
  if (isNaN(userId) || userId <= 0) {
    return res.status(400).json({
      status: 'error',
      message: '用户ID必须是正整数',
      timestamp: new Date().toISOString()
    });
  }
  req.userId = userId;
  next();
};

// 路由级中间件：用户存在性检查
const checkUserExists = (req, res, next) => {
  const user = users.find(u => u.id === req.userId);
  if (!user) {
    return res.status(404).json({
      status: 'error',
      message: `用户ID ${req.userId} 不存在`,
      timestamp: new Date().toISOString()
    });
  }
  req.user = user;
  next();
};

// GET /api/users - 获取用户列表（支持查询参数）
router.get('/', (req, res) => {
  const { page = 1, limit = 10, role, search } = req.query;
  
  // 转换分页参数
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  // 参数验证
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({
      status: 'error',
      message: 'page参数必须是大于0的整数',
      timestamp: new Date().toISOString()
    });
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({
      status: 'error',
      message: 'limit参数必须是1-100之间的整数',
      timestamp: new Date().toISOString()
    });
  }
  
  // 过滤数据
  let filteredUsers = [...users];
  
  // 按角色过滤
  if (role) {
    filteredUsers = filteredUsers.filter(user => user.role === role);
  }
  
  // 按用户名搜索
  if (search) {
    filteredUsers = filteredUsers.filter(user => 
      user.username.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  // 分页处理
  const total = filteredUsers.length;
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
  
  res.json({
    status: 'success',
    data: {
      users: paginatedUsers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: endIndex < total,
        hasPrev: pageNum > 1
      },
      filters: {
        role: role || null,
        search: search || null
      }
    },
    timestamp: new Date().toISOString()
  });
});

// GET /api/users/:id - 获取单个用户
router.get('/:id', validateUserId, checkUserExists, (req, res) => {
  res.json({
    status: 'success',
    data: req.user,
    timestamp: new Date().toISOString()
  });
});

// POST /api/users - 创建新用户
router.post('/', validateRequest({
  body: {
    username: { 
      required: true, 
      type: 'string', 
      minLength: 3, 
      maxLength: 20,
      pattern: /^[a-zA-Z0-9_]+$/
    },
    email: { 
      required: true, 
      type: 'string', 
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ 
    },
    role: { 
      required: false, 
      type: 'string'
    }
  }
}), (req, res) => {
  const { username, email, role = 'user' } = req.body;
  
  // 检查用户名唯一性
  const existingUser = users.find(u => u.username === username || u.email === email);
  if (existingUser) {
    return res.status(409).json({
      status: 'error',
      message: '用户名或邮箱已存在',
      timestamp: new Date().toISOString()
    });
  }
  
  // 验证角色
  const validRoles = ['admin', 'user', 'moderator'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      status: 'error',
      message: `角色必须是以下之一: ${validRoles.join(', ')}`,
      timestamp: new Date().toISOString()
    });
  }
  
  // 创建新用户
  const newUser = {
    id: Math.max(...users.map(u => u.id)) + 1,
    username,
    email,
    role,
    createdAt: new Date().toISOString()
  };
  
  users.push(newUser);
  
  res.status(201).json({
    status: 'success',
    message: '用户创建成功',
    data: newUser,
    timestamp: new Date().toISOString()
  });
});

// PUT /api/users/:id - 更新用户信息
router.put('/:id', validateUserId, checkUserExists, validateRequest({
  body: {
    username: { 
      required: false, 
      type: 'string', 
      minLength: 3, 
      maxLength: 20,
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
    }
  }
}), (req, res) => {
  const { username, email, role } = req.body;
  const user = req.user;
  
  // 检查是否有更新内容
  if (!username && !email && !role) {
    return res.status(400).json({
      status: 'error',
      message: '至少需要提供一个要更新的字段',
      timestamp: new Date().toISOString()
    });
  }
  
  // 检查用户名/邮箱唯一性（排除当前用户）
  if (username || email) {
    const existingUser = users.find(u => 
      u.id !== user.id && (u.username === username || u.email === email)
    );
    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        message: '用户名或邮箱已被其他用户使用',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // 验证角色
  if (role) {
    const validRoles = ['admin', 'user', 'moderator'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        status: 'error',
        message: `角色必须是以下之一: ${validRoles.join(', ')}`,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // 更新用户信息
  const userIndex = users.findIndex(u => u.id === user.id);
  users[userIndex] = {
    ...user,
    ...(username && { username }),
    ...(email && { email }),
    ...(role && { role }),
    updatedAt: new Date().toISOString()
  };
  
  res.json({
    status: 'success',
    message: '用户信息更新成功',
    data: users[userIndex],
    timestamp: new Date().toISOString()
  });
});

// DELETE /api/users/:id - 删除用户
router.delete('/:id', validateUserId, checkUserExists, (req, res) => {
  const userIndex = users.findIndex(u => u.id === req.userId);
  const deletedUser = users.splice(userIndex, 1)[0];
  
  res.json({
    status: 'success',
    message: '用户删除成功',
    data: deletedUser,
    timestamp: new Date().toISOString()
  });
});

// PATCH /api/users/:id/role - 更新用户角色（部分更新示例）
router.patch('/:id/role', validateUserId, checkUserExists, validateRequest({
  body: {
    role: { 
      required: true, 
      type: 'string'
    }
  }
}), (req, res) => {
  const { role } = req.body;
  const validRoles = ['admin', 'user', 'moderator'];
  
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      status: 'error',
      message: `角色必须是以下之一: ${validRoles.join(', ')}`,
      timestamp: new Date().toISOString()
    });
  }
  
  const userIndex = users.findIndex(u => u.id === req.userId);
  users[userIndex].role = role;
  users[userIndex].updatedAt = new Date().toISOString();
  
  res.json({
    status: 'success',
    message: '用户角色更新成功',
    data: users[userIndex],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;