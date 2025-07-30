// 测试数据库辅助函数
const path = require('path');
const fs = require('fs');

class TestDatabase {
  constructor() {
    this.sequelize = null;
    this.models = null;
    this.isInitialized = false;
  }

  // 初始化测试数据库
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // 设置测试环境变量
      process.env.NODE_ENV = 'test';
      process.env.SQLITE_DATABASE_PATH = ':memory:';
      
      // 动态导入数据库配置
      delete require.cache[require.resolve('../../src/models')];
      const { sequelize, models } = require('../../src/models');
      this.sequelize = sequelize;
      this.models = models;

      // 同步数据库结构，强制重新创建
      await this.sequelize.sync({ force: true, logging: false });
      
      this.isInitialized = true;
      console.log('📦 Test database initialized');
    } catch (error) {
      console.error('❌ Failed to initialize test database:', error);
      // 如果初始化失败，尝试不使用 force 选项
      try {
        await this.sequelize.sync({ logging: false });
        this.isInitialized = true;
        console.log('📦 Test database initialized (fallback)');
      } catch (fallbackError) {
        console.error('❌ Fallback initialization also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }

  // 清理所有数据
  async cleanup() {
    if (!this.isInitialized) {
      return;
    }

    try {
      const { User, Category, Post, Comment } = this.models;
      
      // 按照依赖关系顺序删除数据
      await Comment.destroy({ where: {}, force: true });
      await Post.destroy({ where: {}, force: true });
      await Category.destroy({ where: {}, force: true });
      await User.unscoped().destroy({ where: {}, force: true });
      
      console.log('🧹 Test database cleaned');
    } catch (error) {
      console.warn('⚠️  Database cleanup warning:', error.message);
    }
  }

  // 关闭数据库连接
  async close() {
    if (this.sequelize) {
      await this.sequelize.close();
      this.isInitialized = false;
      console.log('🔒 Test database connection closed');
    }
  }

  // 创建测试用户
  async createTestUser(userData = {}) {
    const { User } = this.models;
    const uniqueId = Math.random().toString(36).substring(2, 15); // 生成字母数字ID
    const defaultData = {
      username: `testuser${uniqueId}`, // 移除下划线，符合alphanumeric要求
      email: `test${uniqueId}@example.com`,
      password: 'TestPassword123!',
      ...userData
    };

    return await User.create(defaultData);
  }

  // 创建测试分类
  async createTestCategory(categoryData = {}) {
    const { Category } = this.models;
    const uniqueId = Math.random().toString(36).substring(2, 15);
    const defaultData = {
      name: `TestCategory${uniqueId}`,
      slug: `testcategory${uniqueId}`, // 提供slug避免null错误
      description: 'Test category description',
      ...categoryData
    };

    return await Category.create(defaultData);
  }

  // 创建测试文章
  async createTestPost(postData = {}) {
    const { Post } = this.models;
    
    // 如果没有提供 authorId，创建一个测试用户
    if (!postData.authorId) {
      const testUser = await this.createTestUser();
      postData.authorId = testUser.id;
    }

    // 如果没有提供 categoryId，创建一个测试分类
    if (!postData.categoryId) {
      const testCategory = await this.createTestCategory();
      postData.categoryId = testCategory.id;
    }

    const defaultData = {
      title: `Test Post ${Date.now()}`,
      content: 'This is test post content',
      status: 'published',
      ...postData
    };

    return await Post.create(defaultData);
  }

  // 创建测试评论
  async createTestComment(commentData = {}) {
    const { Comment } = this.models;
    
    // 如果没有提供 authorId，创建一个测试用户
    if (!commentData.authorId) {
      const testUser = await this.createTestUser();
      commentData.authorId = testUser.id;
    }

    // 如果没有提供 postId，创建一个测试文章
    if (!commentData.postId) {
      const testPost = await this.createTestPost();
      commentData.postId = testPost.id;
    }

    const defaultData = {
      content: 'This is a test comment',
      ...commentData
    };

    return await Comment.create(defaultData);
  }

  // 获取模型实例
  getModels() {
    return this.models;
  }

  // 获取 Sequelize 实例
  getSequelize() {
    return this.sequelize;
  }

  // 执行原始 SQL 查询
  async query(sql, options = {}) {
    return await this.sequelize.query(sql, {
      type: this.sequelize.QueryTypes.SELECT,
      ...options
    });
  }

  // 开始事务（用于测试隔离）
  async beginTransaction() {
    return await this.sequelize.transaction();
  }

  // 创建完整的测试数据集
  async seedTestData() {
    const testData = {};

    // 创建测试用户
    testData.users = [];
    for (let i = 0; i < 3; i++) {
      const user = await this.createTestUser({
        username: `testuser${i + 1}`,
        email: `testuser${i + 1}@example.com`
      });
      testData.users.push(user);
    }

    // 创建测试分类
    testData.categories = [];
    const categoryNames = ['Technology', 'Science', 'Arts'];
    for (let i = 0; i < categoryNames.length; i++) {
      const category = await this.createTestCategory({
        name: categoryNames[i],
        description: `${categoryNames[i]} category description`
      });
      testData.categories.push(category);
    }

    // 创建测试文章
    testData.posts = [];
    for (let i = 0; i < 5; i++) {
      const post = await this.createTestPost({
        title: `Test Post ${i + 1}`,
        content: `Content for test post ${i + 1}`,
        authorId: testData.users[i % testData.users.length].id,
        categoryId: testData.categories[i % testData.categories.length].id
      });
      testData.posts.push(post);
    }

    // 创建测试评论
    testData.comments = [];
    for (let i = 0; i < 8; i++) {
      const comment = await this.createTestComment({
        content: `Test comment ${i + 1}`,
        authorId: testData.users[i % testData.users.length].id,
        postId: testData.posts[i % testData.posts.length].id
      });
      testData.comments.push(comment);
    }

    console.log('🌱 Test data seeded successfully');
    return testData;
  }
}

// 创建单例实例
const testDatabase = new TestDatabase();

module.exports = testDatabase;