// 阶段六：数据库配置（模拟版本）
// 用于演示目的，避免SQLite安装问题

// 模拟Sequelize操作符
const Op = {
  or: Symbol('or'),
  and: Symbol('and'),
  like: Symbol('like'),
  ne: Symbol('ne'),
  overlap: Symbol('overlap'),
  notIn: Symbol('notIn'),
};

// 模拟数据存储
const mockData = {
  users: [
    {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      password: '$2b$12$s1zhD9RK2b8JUD/jyJLSfO232EjPSl4njJpCsPxpu1hHVfjW9Tw7.', // admin123
      role: 'admin',
      firstName: '管理员',
      lastName: '',
      bio: '系统管理员',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      lastLoginAt: null,
    },
  ],
  posts: [],
  comments: [],
  categories: [
    {
      id: 1,
      name: '技术分享',
      slug: 'tech',
      description: '技术相关的文章分享',
      parentId: null,
      sortOrder: 0,
      postCount: 0,
      isActive: true,
      color: '#007bff',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ],
};

// 模拟Sequelize实例
const sequelize = {
  authenticate: async () => {
    console.log('✅ 数据库连接模拟成功');
    return Promise.resolve();
  },
  sync: async (options = {}) => {
    console.log('✅ 数据库同步模拟成功');
    return Promise.resolve();
  },
  query: async (sql, options = {}) => {
    console.log('✅ 数据库查询模拟:', sql.substring(0, 50) + '...');
    return Promise.resolve([{ health_check: 1 }]);
  },
  getQueryInterface: () => ({
    showAllTables: async () => ['users', 'posts', 'comments', 'categories'],
  }),
  QueryTypes: {
    SELECT: 'SELECT',
  },
  options: {
    pool: { max: 5, min: 0 },
  },
  connectionManager: {
    pool: { size: 1 },
  },
  models: {},
  Op,
};

// 测试数据库连接
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功！');

    const dbInfo = {
      dialect: 'sqlite',
      version: '3.x (mock)',
      config: {
        host: 'local file',
        database: './database/tutorial.db',
        pool: { max: 5, min: 0 },
      },
    };

    console.log('📊 数据库信息:', JSON.stringify(dbInfo, null, 2));
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    return false;
  }
};

// 同步数据库模型
const syncDatabase = async (options = {}) => {
  try {
    const defaultOptions = {
      force: false,
      alter: false,
    };

    const syncOptions = { ...defaultOptions, ...options };

    console.log('🔄 开始同步数据库模型...');
    await sequelize.sync(syncOptions);

    if (syncOptions.force) {
      console.log('⚠️  数据库表已重建（所有数据已清空）');
      // 重置模拟数据
      mockData.users = [mockData.users[0]]; // 保留管理员
      mockData.posts = [];
      mockData.comments = [];
      mockData.categories = [mockData.categories[0]]; // 保留默认分类
    } else {
      console.log('✅ 数据库模型同步完成');
    }

    return true;
  } catch (error) {
    console.error('❌ 数据库同步失败:', error.message);
    return false;
  }
};

// 关闭数据库连接
const closeConnection = async () => {
  try {
    console.log('🔒 数据库连接已关闭');
  } catch (error) {
    console.error('❌ 关闭数据库连接失败:', error.message);
  }
};

// 数据库健康检查
const healthCheck = async () => {
  try {
    await sequelize.authenticate();

    return {
      status: 'healthy',
      connection: 'active',
      timestamp: new Date().toISOString(),
      test_query: true,
      mode: 'mock',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      connection: 'failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

// 获取数据库统计信息
const getStats = async () => {
  try {
    const stats = {
      tables: 4,
      tableNames: ['users', 'posts', 'comments', 'categories'],
      models: ['User', 'Post', 'Comment', 'Category'],
      connections: {
        max: 5,
        min: 0,
        active: 1,
      },
      uptime: process.uptime(),
      recordCounts: {
        users: mockData.users.length,
        posts: mockData.posts.length,
        comments: mockData.comments.length,
        categories: mockData.categories.length,
      },
      mode: 'mock',
      timestamp: new Date().toISOString(),
    };

    return stats;
  } catch (error) {
    return {
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

// 模拟Sequelize类
const Sequelize = {
  QueryTypes: {
    SELECT: 'SELECT',
  },
  Op,
};

module.exports = {
  sequelize,
  testConnection,
  syncDatabase,
  closeConnection,
  healthCheck,
  getStats,
  Sequelize,
  mockData, // 导出模拟数据供控制器使用
};
