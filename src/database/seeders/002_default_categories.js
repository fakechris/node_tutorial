// 种子数据：默认分类
module.exports = {
  up: async (sequelize) => {
    await sequelize.bulkInsert('Categories', [
      {
        name: '技术分享',
        description: '技术相关的文章和教程',
        slug: 'tech',
        parentId: null,
        isActive: true,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: '前端开发',
        description: '前端技术、框架和工具',
        slug: 'frontend',
        parentId: null,
        isActive: true,
        sortOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: '后端开发',
        description: '后端技术、架构和设计',
        slug: 'backend',
        parentId: null,
        isActive: true,
        sortOrder: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Node.js',
        description: 'Node.js 相关技术和最佳实践',
        slug: 'nodejs',
        parentId: 3, // 后端开发的子分类
        isActive: true,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: '数据库',
        description: '数据库设计、优化和管理',
        slug: 'database',
        parentId: 3, // 后端开发的子分类
        isActive: true,
        sortOrder: 2,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: '系统架构',
        description: '软件架构设计和系统设计',
        slug: 'architecture',
        parentId: null,
        isActive: true,
        sortOrder: 4,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  down: async (sequelize) => {
    await sequelize.bulkDelete('Categories', {
      slug: ['tech', 'frontend', 'backend', 'nodejs', 'database', 'architecture']
    });
  }
};