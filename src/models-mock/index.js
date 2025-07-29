// 阶段六：模型关联关系定义（模拟版本）
const { mockData } = require('../config/database-mock');

// 模拟模型工具函数
const models = {
  User: {
    findAll: async (options = {}) => mockData.users,
    findByPk: async id => mockData.users.find(u => u.id === parseInt(id)),
    create: async data => {
      const newUser = {
        id: Math.max(...mockData.users.map(u => u.id), 0) + 1,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockData.users.push(newUser);
      return newUser;
    },
    count: async () => mockData.users.length,
  },
  Post: {
    findAll: async (options = {}) => mockData.posts,
    findByPk: async id => mockData.posts.find(p => p.id === parseInt(id)),
    create: async data => {
      const newPost = {
        id: Math.max(...mockData.posts.map(p => p.id), 0) + 1,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockData.posts.push(newPost);
      return newPost;
    },
    count: async () => mockData.posts.length,
  },
  Comment: {
    findAll: async (options = {}) => mockData.comments,
    findByPk: async id => mockData.comments.find(c => c.id === parseInt(id)),
    create: async data => {
      const newComment = {
        id: Math.max(...mockData.comments.map(c => c.id), 0) + 1,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockData.comments.push(newComment);
      return newComment;
    },
    count: async () => mockData.comments.length,
  },
  Category: {
    findAll: async (options = {}) => mockData.categories,
    findByPk: async id => mockData.categories.find(c => c.id === parseInt(id)),
    create: async data => {
      const newCategory = {
        id: Math.max(...mockData.categories.map(c => c.id), 0) + 1,
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockData.categories.push(newCategory);
      return newCategory;
    },
    count: async () => mockData.categories.length,
  },
};

// 初始化数据库
models.initDatabase = async (options = {}) => {
  try {
    const { testConnection, syncDatabase } = require('../config/database-mock');

    console.log('🔄 正在初始化数据库...');

    // 测试连接
    const connectionSuccess = await testConnection();
    if (!connectionSuccess) {
      throw new Error('数据库连接失败');
    }

    // 同步模型
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

// 创建示例数据
models.createSampleData = async () => {
  try {
    console.log('🌱 开始创建示例数据...');

    // 创建更多分类
    const webCategory = await models.Category.create({
      name: 'Web开发',
      slug: 'web-dev',
      description: 'Web开发相关技术',
      parentId: 1,
      color: '#17a2b8',
    });

    // 创建普通用户
    const normalUser = await models.User.create({
      username: 'john_doe',
      email: 'john@example.com',
      password: '$2b$12$092UBOyxRvcCGAcwPf7iYunkO.71LaIrhJNGOJp.8o3/SzzzD0lB.',
      role: 'user',
      firstName: 'John',
      lastName: 'Doe',
      bio: '一个热爱技术的开发者',
      isActive: true,
    });

    // 创建文章
    const post1 = await models.Post.create({
      title: 'Node.js后端开发入门',
      content: '这是一篇关于Node.js后端开发的详细教程...',
      summary: '学习Node.js后端开发的基础知识',
      status: 'published',
      authorId: 1,
      categoryId: webCategory.id,
      tags: ['nodejs', 'backend', 'javascript'],
      publishedAt: new Date(),
      viewCount: 150,
      likeCount: 25,
      allowComments: true,
    });

    // 创建评论
    const comment1 = await models.Comment.create({
      content: '非常好的文章，学到了很多！',
      authorId: normalUser.id,
      postId: post1.id,
      isApproved: true,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
    });

    console.log('✅ 示例数据创建完成');
    console.log(`创建了 ${await models.User.count()} 个用户`);
    console.log(`创建了 ${await models.Category.count()} 个分类`);
    console.log(`创建了 ${await models.Post.count()} 篇文章`);
    console.log(`创建了 ${await models.Comment.count()} 条评论`);

    return true;
  } catch (error) {
    console.error('❌ 创建示例数据失败:', error.message);
    return false;
  }
};

// 获取所有模型的统计信息
models.getAllStats = async () => {
  try {
    return {
      users: {
        total: await models.User.count(),
        active: mockData.users.filter(u => u.isActive).length,
        roles: {
          admin: mockData.users.filter(u => u.role === 'admin').length,
          moderator: mockData.users.filter(u => u.role === 'moderator').length,
          user: mockData.users.filter(u => u.role === 'user').length,
        },
      },
      posts: {
        total: await models.Post.count(),
        published: mockData.posts.filter(p => p.status === 'published').length,
        draft: mockData.posts.filter(p => p.status === 'draft').length,
      },
      comments: {
        total: await models.Comment.count(),
        approved: mockData.comments.filter(c => c.isApproved).length,
      },
      categories: {
        total: await models.Category.count(),
        active: mockData.categories.filter(c => c.isActive).length,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

// 清空所有数据
models.clearAllData = async () => {
  try {
    console.log('🗑️  开始清空所有数据...');

    // 清空所有数组，但保留管理员用户和默认分类
    const adminUser = mockData.users.find(u => u.role === 'admin');
    const defaultCategory = mockData.categories.find(c => c.id === 1);

    mockData.comments = [];
    mockData.posts = [];
    mockData.categories = defaultCategory ? [defaultCategory] : [];
    mockData.users = adminUser ? [adminUser] : [];

    console.log('✅ 所有数据已清空');
    return true;
  } catch (error) {
    console.error('❌ 清空数据失败:', error.message);
    return false;
  }
};

module.exports = models;
