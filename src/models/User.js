// 阶段六：用户数据模型
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: {
      name: 'unique_username',
      msg: '用户名已存在'
    },
    validate: {
      len: {
        args: [3, 50],
        msg: '用户名长度必须在3-50个字符之间'
      },
      isAlphanumeric: {
        msg: '用户名只能包含字母和数字'
      }
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: {
      name: 'unique_email',
      msg: '邮箱已存在'
    },
    validate: {
      isEmail: {
        msg: '邮箱格式不正确'
      }
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: {
        args: [6, 255],
        msg: '密码长度必须至少6个字符'
      }
    }
  },
  role: {
    type: DataTypes.ENUM('user', 'moderator', 'admin'),
    allowNull: false,
    defaultValue: 'user'
  },
  firstName: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      len: {
        args: [1, 50],
        msg: '姓名长度必须在1-50个字符之间'
      }
    }
  },
  lastName: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      len: {
        args: [1, 50],
        msg: '姓名长度必须在1-50个字符之间'
      }
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  emailVerifiedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  avatarUrl: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isUrl: {
        msg: '头像URL格式不正确'
      }
    }
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 500],
        msg: '个人简介不能超过500个字符'
      }
    }
  }
}, {
  tableName: 'users',
  indexes: [
    {
      unique: true,
      fields: ['username']
    },
    {
      unique: true,
      fields: ['email']
    },
    {
      fields: ['role']
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['created_at']
    }
  ],
  hooks: {
    // 创建用户前加密密码
    beforeCreate: async (user, options) => {
      if (user.password) {
        const saltRounds = 12;
        user.password = await bcrypt.hash(user.password, saltRounds);
      }
    },
    // 更新用户前加密密码（如果密码被修改）
    beforeUpdate: async (user, options) => {
      if (user.changed('password')) {
        const saltRounds = 12;
        user.password = await bcrypt.hash(user.password, saltRounds);
      }
    }
  }
});

// 实例方法：验证密码
User.prototype.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// 实例方法：获取完整姓名
User.prototype.getFullName = function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.firstName || this.lastName || this.username;
};

// 实例方法：获取公开信息（不包含敏感数据）
User.prototype.getPublicInfo = function() {
  const userData = this.toJSON();
  delete userData.password;
  delete userData.deleted_at;
  return userData;
};

// 实例方法：更新最后登录时间
User.prototype.updateLastLogin = async function() {
  this.lastLoginAt = new Date();
  await this.save();
};

// 类方法：按角色查找用户
User.findByRole = function(role) {
  return this.findAll({
    where: { role },
    attributes: { exclude: ['password'] }
  });
};

// 类方法：查找活跃用户
User.findActiveUsers = function() {
  return this.findAll({
    where: { isActive: true },
    attributes: { exclude: ['password'] }
  });
};

// 类方法：按用户名或邮箱查找
User.findByUsernameOrEmail = function(identifier) {
  const { Op } = require('sequelize');
  return this.findOne({
    where: {
      [Op.or]: [
        { username: identifier },
        { email: identifier }
      ]
    }
  });
};

// 类方法：创建管理员用户
User.createAdmin = async function(userData) {
  return await this.create({
    ...userData,
    role: 'admin'
  });
};

// 类方法：用户统计
User.getStats = async function() {
  const { Op } = require('sequelize');
  
  const totalUsers = await this.count();
  const activeUsers = await this.count({ where: { isActive: true } });
  const usersByRole = await this.findAll({
    attributes: [
      'role',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['role'],
    raw: true
  });
  
  const recentUsers = await this.count({
    where: {
      created_at: {
        [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 最近7天
      }
    }
  });
  
  return {
    total: totalUsers,
    active: activeUsers,
    inactive: totalUsers - activeUsers,
    byRole: usersByRole.reduce((acc, item) => {
      acc[item.role] = parseInt(item.count);
      return acc;
    }, {}),
    recentRegistrations: recentUsers
  };
};

module.exports = User;