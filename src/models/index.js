// 阶段六：模型关联关系定义
const { sequelize } = require('../config/database');

// 导入所有模型
const User = require('./User');
const Post = require('./Post');
const Comment = require('./Comment');
const Category = require('./Category');

// 定义模型关联关系

// 用户和文章的关联 (一对多)
User.hasMany(Post, {
  foreignKey: 'authorId',
  as: 'posts',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Post.belongsTo(User, {
  foreignKey: 'authorId',
  as: 'author',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

// 用户和评论的关联 (一对多)
User.hasMany(Comment, {
  foreignKey: 'authorId',
  as: 'comments',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Comment.belongsTo(User, {
  foreignKey: 'authorId',
  as: 'author',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

// 文章和评论的关联 (一对多)
Post.hasMany(Comment, {
  foreignKey: 'postId',
  as: 'comments',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Comment.belongsTo(Post, {
  foreignKey: 'postId',
  as: 'post',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

// 评论的自关联 (一对多，用于回复)
Comment.hasMany(Comment, {
  foreignKey: 'parentId',
  as: 'replies',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Comment.belongsTo(Comment, {
  foreignKey: 'parentId',
  as: 'parent',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

// 分类和文章的关联 (一对多)
Category.hasMany(Post, {
  foreignKey: 'categoryId',
  as: 'posts',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

Post.belongsTo(Category, {
  foreignKey: 'categoryId',
  as: 'category',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

// 分类的自关联 (一对多，用于父子关系)
Category.hasMany(Category, {
  foreignKey: 'parentId',
  as: 'children',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

Category.belongsTo(Category, {
  foreignKey: 'parentId',
  as: 'parent',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

// 模型工具函数
const models = {
  User,
  Post,
  Comment,
  Category,
  sequelize,
};

// 初始化数据库
models.initDatabase = async (options = {}) => {
  try {
    const { testConnection, syncDatabase } = require('../config/database');

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

// 完全重建数据库 - 确保幂等性
models.rebuildDatabase = async () => {
  try {
    console.log('🔄 开始完全重建数据库...');

    // 删除数据库文件（SQLite）
    const fs = require('fs');
    const path = require('path');
    const dbPath = './database/tutorial.db';

    // 先同步删除表结构
    try {
      await sequelize.drop();
      console.log('🗑️  数据库表结构已删除');
    } catch (dropError) {
      console.log('⚠️  删除表结构失败，继续删除文件:', dropError.message);
    }

    // 删除数据库文件
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
      console.log('🗑️  数据库文件已删除');
    }

    // 确保数据库目录存在
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log('📁 数据库目录已创建');
    }

    // 重新同步数据库（创建表）
    await sequelize.sync({ force: true });
    console.log('📋 数据库表结构已重建');

    console.log('✅ 数据库完全重建完成');
    return true;
  } catch (error) {
    console.error('❌ 数据库重建失败:', error.message);
    console.error('详细错误:', error);
    return false;
  }
};

// 创建示例数据 - 在干净数据库上创建
models.createSampleData = async () => {
  try {
    console.log('🌱 开始创建示例数据...');

    // 创建分类
    const techCategory = await Category.create({
      name: '技术分享',
      slug: 'tech',
      description: '技术相关的文章分享',
      color: '#007bff',
    });

    const lifeCategory = await Category.create({
      name: '生活随笔',
      slug: 'life',
      description: '生活感悟和随笔',
      color: '#28a745',
    });

    // 创建子分类
    const webCategory = await Category.create({
      name: 'Web开发',
      slug: 'web-dev',
      description: 'Web开发相关技术',
      parentId: techCategory.id,
      color: '#17a2b8',
    });

    // 创建用户
    const adminUser = await User.create({
      username: 'admin',
      email: 'admin@example.com',
      password: 'admin123',
      role: 'admin',
      firstName: '管理员',
      isActive: true,
    });

    const normalUser = await User.create({
      username: 'johndoe',
      email: 'john@example.com',
      password: 'password123',
      role: 'user',
      firstName: 'John',
      lastName: 'Doe',
      bio: '一个热爱技术的开发者',
      isActive: true,
    });

    // 创建文章
    const post1 = await Post.create({
      title: 'Node.js后端开发入门',
      content: '这是一篇关于Node.js后端开发的详细教程...',
      summary: '学习Node.js后端开发的基础知识',
      status: 'published',
      authorId: adminUser.id,
      categoryId: webCategory.id,
      tags: ['nodejs', 'backend', 'javascript'],
      publishedAt: new Date(),
      viewCount: 150,
      likeCount: 25,
      allowComments: true,
    });

    const post2 = await Post.create({
      title: 'JavaScript ES6+ 新特性',
      content: 'ES6+为JavaScript带来了许多新特性...',
      summary: '深入了解JavaScript的现代特性',
      status: 'published',
      authorId: normalUser.id,
      categoryId: webCategory.id,
      tags: ['javascript', 'es6', 'frontend'],
      publishedAt: new Date(),
      viewCount: 89,
      likeCount: 12,
      allowComments: true,
    });

    const draftPost = await Post.create({
      title: '我的编程之路',
      content: '这是一篇关于我如何开始编程的文章...',
      summary: '分享我的编程学习经历',
      status: 'draft',
      authorId: normalUser.id,
      categoryId: lifeCategory.id,
      tags: ['生活', '编程', '学习'],
      allowComments: true,
    });

    // 创建评论
    const comment1 = await Comment.create({
      content: '非常好的文章，学到了很多！',
      authorId: normalUser.id,
      postId: post1.id,
      isApproved: true,
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
    });

    const comment2 = await Comment.create({
      content: '感谢分享，期待更多内容',
      authorId: adminUser.id,
      postId: post1.id,
      isApproved: true,
      ipAddress: '192.168.1.2',
      userAgent: 'Mozilla/5.0...',
    });

    // 创建回复
    const reply1 = await Comment.create({
      content: '谢谢支持！我会继续努力的',
      authorId: adminUser.id,
      postId: post1.id,
      parentId: comment1.id,
      isApproved: true,
      ipAddress: '192.168.1.3',
      userAgent: 'Mozilla/5.0...',
    });

    // 更新统计数据
    await webCategory.updatePostCount();
    await lifeCategory.updatePostCount();
    await techCategory.updatePostCount();

    console.log('✅ 示例数据创建成功');
    console.log(`创建了 ${await User.count()} 个用户`);
    console.log(`创建了 ${await Category.count()} 个分类`);
    console.log(`创建了 ${await Post.count()} 篇文章`);
    console.log(`创建了 ${await Comment.count()} 条评论`);

    return true;
  } catch (error) {
    console.error('❌ 创建示例数据失败:', error.message);
    console.error('详细错误信息:', error);
    if (error.errors) {
      console.error(
        '验证错误:',
        error.errors.map(e => `${e.path}: ${e.message}`)
      );
    }
    if (error.sql) {
      console.error('SQL错误:', error.sql);
    }
    throw error; // 重新抛出错误以便调试
  }
};

// 获取所有模型的统计信息
models.getAllStats = async () => {
  try {
    const [userStats, postStats, commentStats, categoryStats] = await Promise.all([
      User.getStats(),
      Post.getStats(),
      Comment.getStats(),
      Category.getStats(),
    ]);

    return {
      users: userStats,
      posts: postStats,
      comments: commentStats,
      categories: categoryStats,
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

    // 按依赖关系顺序删除
    await Comment.destroy({ where: {}, force: true });
    await Post.destroy({ where: {}, force: true });
    await Category.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });

    console.log('✅ 所有数据已清空');
    return true;
  } catch (error) {
    console.error('❌ 清空数据失败:', error.message);
    return false;
  }
};

module.exports = {
  sequelize,
  models: {
    User,
    Post,
    Comment,
    Category,
  },
  // 保持向后兼容
  ...models
};
