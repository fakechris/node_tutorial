// 阶段六：文章数据模型
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Post = sequelize.define('Post', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      len: {
        args: [1, 200],
        msg: '标题长度必须在1-200个字符之间'
      }
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: {
        args: [1, 50000],
        msg: '内容长度必须在1-50000个字符之间'
      }
    }
  },
  summary: {
    type: DataTypes.STRING(500),
    allowNull: true,
    validate: {
      len: {
        args: [0, 500],
        msg: '摘要长度不能超过500个字符'
      }
    }
  },
  status: {
    type: DataTypes.ENUM('draft', 'published', 'archived'),
    allowNull: false,
    defaultValue: 'draft'
  },
  authorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'categories',
      key: 'id'
    }
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: [],
    validate: {
      isArray(value) {
        if (value !== null && !Array.isArray(value)) {
          throw new Error('标签必须是数组格式');
        }
      }
    }
  },
  viewCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  likeCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  commentCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  featuredImageUrl: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isUrl: {
        msg: '特色图片URL格式不正确'
      }
    }
  },
  publishedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isSticky: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  allowComments: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'posts',
  indexes: [
    {
      fields: ['author_id']
    },
    {
      fields: ['category_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['published_at']
    },
    {
      fields: ['is_sticky']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['title'],
      type: 'FULLTEXT'
    }
  ],
  hooks: {
    // 发布文章时设置发布时间
    beforeUpdate: async (post, options) => {
      if (post.changed('status') && post.status === 'published' && !post.publishedAt) {
        post.publishedAt = new Date();
      }
    }
  }
});

// 实例方法：生成摘要
Post.prototype.generateSummary = function(maxLength = 200) {
  if (this.summary) {
    return this.summary;
  }
  
  // 从内容中提取摘要
  const cleanContent = this.content.replace(/<[^>]*>/g, ''); // 移除HTML标签
  if (cleanContent.length <= maxLength) {
    return cleanContent;
  }
  
  return cleanContent.substring(0, maxLength) + '...';
};

// 实例方法：增加浏览量
Post.prototype.incrementViewCount = async function() {
  this.viewCount += 1;
  await this.save(['viewCount'], { silent: true }); // silent: true 不触发hooks
};

// 实例方法：添加标签
Post.prototype.addTag = async function(tag) {
  const currentTags = this.tags || [];
  if (!currentTags.includes(tag)) {
    currentTags.push(tag);
    this.tags = currentTags;
    await this.save();
  }
};

// 实例方法：移除标签
Post.prototype.removeTag = async function(tag) {
  const currentTags = this.tags || [];
  const newTags = currentTags.filter(t => t !== tag);
  this.tags = newTags;
  await this.save();
};

// 实例方法：发布文章
Post.prototype.publish = async function() {
  this.status = 'published';
  this.publishedAt = new Date();
  await this.save();
};

// 实例方法：归档文章
Post.prototype.archive = async function() {
  this.status = 'archived';
  await this.save();
};

// 类方法：查找已发布的文章
Post.findPublished = function(options = {}) {
  return this.findAll({
    where: { status: 'published' },
    order: [['published_at', 'DESC']],
    ...options
  });
};

// 类方法：按作者查找文章
Post.findByAuthor = function(authorId, options = {}) {
  return this.findAll({
    where: { authorId },
    order: [['created_at', 'DESC']],
    ...options
  });
};

// 类方法：按标签查找文章
Post.findByTag = function(tag, options = {}) {
  const { Op } = require('sequelize');
  return this.findAll({
    where: {
      tags: {
        [Op.contains]: [tag]
      }
    },
    ...options
  });
};

// 类方法：搜索文章
Post.search = function(keyword, options = {}) {
  const { Op } = require('sequelize');
  return this.findAll({
    where: {
      [Op.or]: [
        {
          title: {
            [Op.like]: `%${keyword}%`
          }
        },
        {
          content: {
            [Op.like]: `%${keyword}%`
          }
        }
      ]
    },
    order: [['created_at', 'DESC']],
    ...options
  });
};

// 类方法：获取热门文章
Post.findPopular = function(limit = 10) {
  return this.findAll({
    where: { status: 'published' },
    order: [
      ['view_count', 'DESC'],
      ['like_count', 'DESC'],
      ['comment_count', 'DESC']
    ],
    limit
  });
};

// 类方法：获取统计信息
Post.getStats = async function() {
  const { Op } = require('sequelize');
  
  const totalPosts = await this.count();
  const publishedPosts = await this.count({ where: { status: 'published' } });
  const draftPosts = await this.count({ where: { status: 'draft' } });
  const archivedPosts = await this.count({ where: { status: 'archived' } });
  
  const postsByStatus = await this.findAll({
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: ['status'],
    raw: true
  });
  
  const totalViews = await this.sum('view_count') || 0;
  const totalLikes = await this.sum('like_count') || 0;
  const totalComments = await this.sum('comment_count') || 0;
  
  const recentPosts = await this.count({
    where: {
      created_at: {
        [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 最近7天
      }
    }
  });
  
  return {
    total: totalPosts,
    published: publishedPosts,
    draft: draftPosts,
    archived: archivedPosts,
    byStatus: postsByStatus.reduce((acc, item) => {
      acc[item.status] = parseInt(item.count);
      return acc;
    }, {}),
    engagement: {
      totalViews,
      totalLikes,
      totalComments,
      avgViewsPerPost: totalPosts > 0 ? Math.round(totalViews / totalPosts) : 0
    },
    recentPosts
  };
};

module.exports = Post;