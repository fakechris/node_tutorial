// 种子数据：示例评论
module.exports = {
  up: async (sequelize) => {
    const comments = [
      {
        content: '非常好的入门教程！我刚开始学习Node.js，这篇文章帮助很大。',
        status: 'approved',
        authorId: 2, // janedoe
        postId: 1,   // Node.js后端开发入门指南
        parentId: null,
        likeCount: 3,
        isEdited: false,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        createdAt: new Date('2025-01-16'),
        updatedAt: new Date('2025-01-16')
      },
      {
        content: '感谢分享！能否再详细介绍一下事件循环的工作原理？',
        status: 'approved',
        authorId: 3, // bobsmith
        postId: 1,   // Node.js后端开发入门指南
        parentId: null,
        likeCount: 1,
        isEdited: false,
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        createdAt: new Date('2025-01-17'),
        updatedAt: new Date('2025-01-17')
      },
      {
        content: '好问题！事件循环确实是Node.js的核心概念。我会考虑写一篇专门的文章来详细解释。',
        status: 'approved',
        authorId: 1, // admin (文章作者)
        postId: 1,   // Node.js后端开发入门指南
        parentId: 2, // 回复bobsmith的评论
        likeCount: 5,
        isEdited: false,
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        createdAt: new Date('2025-01-17'),
        updatedAt: new Date('2025-01-17')
      },
      {
        content: '中间件这块讲得很清楚，特别是错误处理中间件的部分。实际项目中很实用！',
        status: 'approved',
        authorId: 3, // bobsmith
        postId: 2,   // Express.js中间件深度解析
        parentId: null,
        likeCount: 2,
        isEdited: false,
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        createdAt: new Date('2025-01-21'),
        updatedAt: new Date('2025-01-21')
      },
      {
        content: '请问自定义中间件的执行顺序是怎样的？如果有多个中间件会按什么顺序执行？',
        status: 'approved',
        authorId: 1, // admin
        postId: 2,   // Express.js中间件深度解析
        parentId: null,
        likeCount: 0,
        isEdited: false,
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        createdAt: new Date('2025-01-22'),
        updatedAt: new Date('2025-01-22')
      },
      {
        content: 'Express中间件按照注册的顺序执行，先注册的先执行。每个中间件必须调用next()才能继续到下一个中间件。',
        status: 'approved',
        authorId: 2, // janedoe (文章作者)
        postId: 2,   // Express.js中间件深度解析
        parentId: 5, // 回复admin的问题
        likeCount: 4,
        isEdited: false,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        createdAt: new Date('2025-01-22'),
        updatedAt: new Date('2025-01-22')
      },
      {
        content: 'RESTful API设计真的很重要！这些最佳实践在实际项目中都很有用。',
        status: 'approved',
        authorId: 2, // janedoe
        postId: 3,   // RESTful API设计最佳实践
        parentId: null,
        likeCount: 1,
        isEdited: false,
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        createdAt: new Date('2025-01-26'),
        updatedAt: new Date('2025-01-26')
      },
      {
        content: '关于版本控制，你觉得在URL中包含版本号好还是在Header中好？',
        status: 'approved',
        authorId: 3, // bobsmith
        postId: 3,   // RESTful API设计最佳实践
        parentId: null,
        likeCount: 2,
        isEdited: false,
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        createdAt: new Date('2025-01-27'),
        updatedAt: new Date('2025-01-27')
      },
      {
        content: '这个spam评论应该被过滤掉...',
        status: 'spam',
        authorId: 4, // alicejohnson (非活跃用户)
        postId: 1,   // Node.js后端开发入门指南
        parentId: null,
        likeCount: 0,
        isEdited: false,
        ipAddress: '192.168.1.200',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        createdAt: new Date('2025-01-28'),
        updatedAt: new Date('2025-01-28')
      },
      {
        content: '待审核的评论内容...',
        status: 'pending',
        authorId: 4, // alicejohnson
        postId: 2,   // Express.js中间件深度解析
        parentId: null,
        likeCount: 0,
        isEdited: false,
        ipAddress: '192.168.1.200',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        createdAt: new Date('2025-01-28'),
        updatedAt: new Date('2025-01-28')
      }
    ];

    await sequelize.bulkInsert('Comments', comments);
  },

  down: async (sequelize) => {
    await sequelize.bulkDelete('Comments', {
      id: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    });
  }
};