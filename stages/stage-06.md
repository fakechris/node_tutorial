# 阶段六：数据库ORM与CRUD操作

## 本阶段目标

在这个阶段，我们将学习如何集成数据库ORM（Object-Relational Mapping），构建完整的数据模型，实现全面的CRUD操作，以及数据库管理功能。

## 学习目标

- 理解ORM的概念和优势
- 学会使用Sequelize ORM
- 设计和实现数据模型
- 掌握模型关联关系
- 实现完整的CRUD操作
- 掌握数据验证和约束
- 学习数据库管理和维护

## 技术要点

### 1. Sequelize ORM集成

#### 安装依赖
```bash
npm install sequelize sqlite3
```

#### 数据库配置
```javascript
// src/config/database.js
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: './database/tutorial.db',
  logging: console.log,
  define: {
    timestamps: true,
    underscored: true,
    paranoid: true // 启用软删除
  }
});
```

### 2. 数据模型设计

#### 用户模型 (User)
```javascript
// src/models/User.js
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 30],
      isAlphanumeric: true
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: [6, 255]
    }
  },
  role: {
    type: DataTypes.ENUM('user', 'moderator', 'admin'),
    allowNull: false,
    defaultValue: 'user'
  },
  firstName: DataTypes.STRING(50),
  lastName: DataTypes.STRING(50),
  bio: DataTypes.TEXT,
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLoginAt: DataTypes.DATE
});
```

#### 文章模型 (Post)
```javascript
// src/models/Post.js
const Post = sequelize.define('Post', {
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      len: [1, 200]
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  summary: DataTypes.STRING(500),
  status: {
    type: DataTypes.ENUM('draft', 'published', 'archived', 'private'),
    defaultValue: 'draft'
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  viewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  likeCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  allowComments: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  publishedAt: DataTypes.DATE
});
```

### 3. 模型关联关系

```javascript
// src/models/index.js
// 用户和文章的关联 (一对多)
User.hasMany(Post, {
  foreignKey: 'authorId',
  as: 'posts',
  onDelete: 'CASCADE'
});

Post.belongsTo(User, {
  foreignKey: 'authorId',
  as: 'author'
});

// 文章和评论的关联 (一对多)
Post.hasMany(Comment, {
  foreignKey: 'postId',
  as: 'comments',
  onDelete: 'CASCADE'
});

Comment.belongsTo(Post, {
  foreignKey: 'postId',
  as: 'post'
});

// 评论的自关联 (一对多，用于回复)
Comment.hasMany(Comment, {
  foreignKey: 'parentId',
  as: 'replies',
  onDelete: 'CASCADE'
});

Comment.belongsTo(Comment, {
  foreignKey: 'parentId',
  as: 'parent'
});
```

### 4. 模型方法和钩子

#### 实例方法
```javascript
// User模型实例方法
User.prototype.getPublicInfo = function() {
  const { password, ...publicInfo } = this.toJSON();
  return publicInfo;
};

User.prototype.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// Post模型实例方法
Post.prototype.publish = async function() {
  this.status = 'published';
  this.publishedAt = new Date();
  await this.save();
};

Post.prototype.incrementViewCount = async function() {
  this.viewCount += 1;
  await this.save(['viewCount'], { silent: true });
};
```

#### 模型钩子
```javascript
// 用户密码自动加密
User.addHook('beforeCreate', async (user) => {
  if (user.password) {
    user.password = await bcrypt.hash(user.password, 12);
  }
});

User.addHook('beforeUpdate', async (user) => {
  if (user.changed('password')) {
    user.password = await bcrypt.hash(user.password, 12);
  }
});
```

### 5. CRUD控制器实现

#### 用户CRUD控制器
```javascript
// src/controllers/userController.js
const userController = {
  // 获取用户列表（支持分页、搜索、过滤）
  getUsers: async (req, res) => {
    const {
      page = 1,
      limit = 10,
      role,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const whereConditions = {};
    
    if (role) whereConditions.role = role;
    if (status !== undefined) whereConditions.isActive = status === 'active';
    
    if (search) {
      whereConditions[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { firstName: { [Op.like]: `%${search}%` } },
        { lastName: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows: users } = await User.findAndCountAll({
      where: whereConditions,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [[sortBy, sortOrder]],
      attributes: { exclude: ['password'] }
    });

    statusCode.success.ok(res, {
      users: users.map(user => user.getPublicInfo()),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit))
      }
    }, '获取用户列表成功');
  },

  // 创建用户
  createUser: async (req, res) => {
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

    // 检查唯一性
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }]
      }
    });

    if (existingUser) {
      return statusCode.clientError.conflict(res, '用户名或邮箱已存在');
    }

    const newUser = await User.create({
      username,
      email,
      password,
      role,
      firstName,
      lastName,
      bio,
      isActive
    });

    statusCode.success.created(res, newUser.getPublicInfo(), '用户创建成功');
  }
};
```

### 6. 数据库管理功能

#### 数据库健康检查
```javascript
// src/config/database.js
const healthCheck = async () => {
  try {
    await sequelize.authenticate();
    return {
      status: 'healthy',
      message: '数据库连接正常',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: '数据库连接失败',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

const getStats = async () => {
  const stats = await sequelize.query(`
    SELECT 
      name,
      (SELECT COUNT(*) FROM sqlite_master WHERE type='table') as table_count,
      (SELECT COUNT(*) FROM sqlite_master WHERE type='index') as index_count
    FROM sqlite_master 
    WHERE type='table' AND name='sqlite_sequence'
  `, { type: sequelize.QueryTypes.SELECT });

  return {
    database: 'SQLite',
    tables: stats,
    timestamp: new Date().toISOString()
  };
};
```

#### 数据库初始化
```javascript
const initDatabase = async (options = {}) => {
  try {
    console.log('🔄 正在初始化数据库...');
    
    const connectionSuccess = await testConnection();
    if (!connectionSuccess) {
      throw new Error('数据库连接失败');
    }
    
    const syncSuccess = await syncDatabase(options);
    if (!syncSuccess) {
      throw new Error('数据库同步失败');
    }
    
    console.log('✅ 数据库初始化完成');
    return true;
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    return false;
  }
};
```

### 7. 数据验证和约束

#### 模型级验证
```javascript
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: {
      name: 'unique_username',
      msg: '用户名已存在'
    },
    validate: {
      len: {
        args: [3, 30],
        msg: '用户名长度必须在3-30个字符之间'
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
  }
});
```

#### 自定义验证器
```javascript
// 自定义验证函数
const validatePassword = (password) => {
  if (password.length < 6) {
    throw new Error('密码长度至少6个字符');
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    throw new Error('密码必须包含大小写字母和数字');
  }
};

const User = sequelize.define('User', {
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      customValidator: validatePassword
    }
  }
});
```

## 实践练习

### 练习1：基础CRUD操作

1. **用户管理**
   - 实现用户的创建、读取、更新、删除
   - 添加用户搜索和过滤功能
   - 实现用户状态管理

2. **文章管理**
   - 实现文章的CRUD操作
   - 添加文章状态管理（草稿、发布、归档）
   - 实现文章标签系统

### 练习2：关联关系操作

1. **一对多关系**
   - 获取用户及其所有文章
   - 获取文章及其所有评论
   - 实现级联删除

2. **多对多关系**
   - 实现文章标签关联
   - 用户角色权限关联

### 练习3：数据库管理

1. **数据迁移**
   - 创建数据库迁移脚本
   - 实现版本控制

2. **数据备份**
   - 实现数据导出功能
   - 创建数据恢复机制

## 测试验证

### 使用数据库测试脚本

```bash
# 运行数据库CRUD测试
./test-database.sh
```

### 测试内容包括：

1. **基础功能测试**
   - 数据库连接健康检查
   - 数据库初始化和示例数据创建
   - 模型创建和关联关系验证

2. **CRUD操作测试**
   - 用户CRUD操作
   - 文章CRUD操作
   - 评论CRUD操作
   - 分类CRUD操作

3. **高级功能测试**
   - 分页、搜索、过滤
   - 批量操作
   - 权限控制
   - 数据验证

4. **性能测试**
   - 查询优化
   - 索引效果验证
   - 并发操作测试

## API接口文档

### 用户管理接口

```
GET    /api/users              # 获取用户列表
GET    /api/users/:id          # 获取用户详情
POST   /api/users              # 创建用户
PUT    /api/users/:id          # 更新用户
DELETE /api/users/:id          # 删除用户
POST   /api/users/batch        # 批量操作用户
```

### 文章管理接口

```
GET    /api/posts              # 获取文章列表
GET    /api/posts/:id          # 获取文章详情
POST   /api/posts              # 创建文章
PUT    /api/posts/:id          # 更新文章
DELETE /api/posts/:id          # 删除文章
POST   /api/posts/:id/publish  # 发布文章
POST   /api/posts/:id/like     # 点赞文章
```

### 评论管理接口

```
GET    /api/posts/:postId/comments            # 获取文章评论
POST   /api/posts/:postId/comments            # 创建评论
GET    /api/posts/:postId/comments/:commentId # 获取评论详情
PUT    /api/posts/:postId/comments/:commentId # 更新评论
DELETE /api/posts/:postId/comments/:commentId # 删除评论
```

### 分类管理接口

```
GET    /api/categories         # 获取分类列表
GET    /api/categories/tree    # 获取分类树
GET    /api/categories/:id     # 获取分类详情
POST   /api/categories         # 创建分类
PUT    /api/categories/:id     # 更新分类
DELETE /api/categories/:id     # 删除分类
```

### 数据库管理接口

```
GET    /api/db/health          # 数据库健康检查
GET    /api/db/stats           # 数据库统计信息
GET    /api/db/info            # 数据库信息概览
POST   /api/db/init            # 初始化数据库
POST   /api/db/sample-data     # 创建示例数据
DELETE /api/db/clear-all       # 清空所有数据
```

## 调试技巧

### 1. SQL日志记录

```javascript
const sequelize = new Sequelize({
  // ...其他配置
  logging: (sql, timing) => {
    console.log(`[${new Date().toISOString()}] ${sql}`);
    if (timing) {
      console.log(`Executed in ${timing}ms`);
    }
  },
  benchmark: true
});
```

### 2. 查询优化

```javascript
// 使用索引
const users = await User.findAll({
  where: { isActive: true },
  order: [['createdAt', 'DESC']],
  limit: 10
});

// N+1查询优化
const posts = await Post.findAll({
  include: [{
    model: User,
    as: 'author',
    attributes: ['id', 'username']
  }]
});
```

### 3. 错误处理

```javascript
try {
  const user = await User.create(userData);
} catch (error) {
  if (error.name === 'SequelizeValidationError') {
    const validationErrors = error.errors.map(err => err.message);
    return statusCode.clientError.badRequest(res, `数据验证失败: ${validationErrors.join(', ')}`);
  }
  
  if (error.name === 'SequelizeUniqueConstraintError') {
    return statusCode.clientError.conflict(res, '数据已存在');
  }
  
  throw error;
}
```

## 常见问题解决

### 1. 外键约束错误

**问题**：删除记录时出现外键约束错误

**解决方案**：
```javascript
// 设置正确的级联删除
User.hasMany(Post, {
  foreignKey: 'authorId',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// 或者先删除关联记录
await Post.destroy({ where: { authorId: userId } });
await User.destroy({ where: { id: userId } });
```

### 2. 查询性能问题

**问题**：复杂查询响应缓慢

**解决方案**：
```javascript
// 添加适当的索引
User.addIndex(['email']);
Post.addIndex(['status', 'publishedAt']);
Comment.addIndex(['postId', 'isApproved']);

// 优化查询
const posts = await Post.findAll({
  attributes: ['id', 'title', 'createdAt'], // 只选择需要的字段
  where: { status: 'published' },
  include: [{
    model: User,
    as: 'author',
    attributes: ['id', 'username']
  }],
  limit: 20
});
```

### 3. 数据迁移问题

**问题**：数据结构变更导致的兼容性问题

**解决方案**：
```javascript
// 创建迁移脚本
const migration = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'bio', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },
  
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'bio');
  }
};
```

## 总结

在这个阶段，我们成功实现了：

1. **完整的ORM集成**：使用Sequelize实现了数据库抽象层
2. **数据模型设计**：创建了用户、文章、评论、分类等完整模型
3. **关联关系管理**：实现了一对多、多对多等复杂关联
4. **CRUD操作**：完整的增删改查功能
5. **数据验证**：模型级和应用级双重验证
6. **数据库管理**：健康检查、统计信息、维护功能
7. **性能优化**：索引、查询优化、N+1问题解决

**下一阶段预告**：在阶段七中，我们将学习调试与日志系统，包括错误追踪、性能监控、日志管理等内容。

## 扩展学习

1. **数据库设计模式**
   - 仓储模式 (Repository Pattern)
   - 工作单元模式 (Unit of Work)
   - 数据映射器模式 (Data Mapper)

2. **高级ORM特性**
   - 事务管理
   - 连接池优化
   - 读写分离

3. **数据库优化**
   - 查询计划分析
   - 索引优化策略  
   - 数据库分区

通过本阶段的学习，你已经掌握了现代Node.js后端开发中数据库操作的核心技能，能够构建稳定、高效的数据持久化层。