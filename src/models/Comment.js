// 阶段六：评论数据模型
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Comment = sequelize.define('Comment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: {
        args: [1, 2000],
        msg: '评论内容长度必须在1-2000个字符之间'
      }
    }
  },
  authorId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  postId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'posts',
      key: 'id'
    }
  },
  parentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'comments',
      key: 'id'
    }
  },
  isApproved: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  likeCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  replyCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  ipAddress: {
    type: DataTypes.STRING(45), // 支持IPv6
    allowNull: true
  },
  userAgent: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  tableName: 'comments',
  indexes: [
    {
      fields: ['author_id']
    },
    {
      fields: ['post_id']
    },
    {
      fields: ['parent_id']
    },
    {
      fields: ['is_approved']
    },
    {
      fields: ['created_at']
    }
  ],
  hooks: {
    // 创建评论后更新文章评论数
    afterCreate: async (comment, options) => {
      const Post = require('./Post');
      await Post.increment('commentCount', { where: { id: comment.postId } });
      
      // 如果是回复，更新父评论的回复数
      if (comment.parentId) {
        await Comment.increment('replyCount', { where: { id: comment.parentId } });
      }
    },
    
    // 删除评论后更新文章评论数
    afterDestroy: async (comment, options) => {
      const Post = require('./Post');
      await Post.decrement('commentCount', { where: { id: comment.postId } });
      
      // 如果是回复，更新父评论的回复数
      if (comment.parentId) {
        await Comment.decrement('replyCount', { where: { id: comment.parentId } });
      }
    }
  }
});

// 实例方法：获取回复
Comment.prototype.getReplies = function(options = {}) {
  return Comment.findAll({
    where: { parentId: this.id },
    order: [['created_at', 'ASC']],
    ...options
  });
};

// 实例方法：点赞评论
Comment.prototype.addLike = async function() {
  this.likeCount += 1;
  await this.save(['likeCount'], { silent: true });
};

// 实例方法：取消点赞
Comment.prototype.removeLike = async function() {
  if (this.likeCount > 0) {
    this.likeCount -= 1;
    await this.save(['likeCount'], { silent: true });
  }
};

// 实例方法：审核通过
Comment.prototype.approve = async function() {
  this.isApproved = true;
  await this.save();
};

// 实例方法：拒绝审核
Comment.prototype.reject = async function() {
  this.isApproved = false;
  await this.save();
};

// 实例方法：是否为根评论
Comment.prototype.isRootComment = function() {
  return this.parentId === null;
};

// 实例方法：获取评论层级
Comment.prototype.getLevel = async function() {
  if (this.isRootComment()) {
    return 0;
  }
  
  const parent = await Comment.findByPk(this.parentId);
  if (!parent) {
    return 0;
  }
  
  return (await parent.getLevel()) + 1;
};

// 类方法：按文章查找评论
Comment.findByPost = function(postId, options = {}) {
  return this.findAll({
    where: { 
      postId,
      isApproved: true 
    },
    order: [['created_at', 'DESC']],
    ...options
  });
};

// 类方法：获取根评论（不包括回复）
Comment.findRootComments = function(postId, options = {}) {
  return this.findAll({
    where: { 
      postId,
      parentId: null,
      isApproved: true 
    },
    order: [['created_at', 'DESC']],
    ...options
  });
};

// 类方法：构建评论树
Comment.buildCommentTree = async function(postId, maxDepth = 3) {
  const rootComments = await this.findRootComments(postId, {
    include: [
      {
        model: require('./User'),
        as: 'author',
        attributes: ['id', 'username', 'avatarUrl']
      }
    ]
  });
  
  const buildReplies = async (comment, currentDepth = 0) => {
    if (currentDepth >= maxDepth) {
      return comment;
    }
    
    const replies = await comment.getReplies({
      include: [
        {
          model: require('./User'),
          as: 'author',
          attributes: ['id', 'username', 'avatarUrl']
        }
      ]
    });
    
    const repliesWithNested = await Promise.all(
      replies.map(reply => buildReplies(reply, currentDepth + 1))
    );
    
    return {
      ...comment.toJSON(),
      replies: repliesWithNested
    };
  };
  
  return await Promise.all(
    rootComments.map(comment => buildReplies(comment))
  );
};

// 类方法：按作者查找评论
Comment.findByAuthor = function(authorId, options = {}) {
  return this.findAll({
    where: { authorId },
    order: [['created_at', 'DESC']],
    ...options
  });
};

// 类方法：获取待审核评论
Comment.findPending = function(options = {}) {
  return this.findAll({
    where: { isApproved: false },
    order: [['created_at', 'ASC']],
    ...options
  });
};

// 类方法：获取最新评论
Comment.findRecent = function(limit = 10) {
  return this.findAll({
    where: { isApproved: true },
    order: [['created_at', 'DESC']],
    limit,
    include: [
      {
        model: require('./User'),
        as: 'author',
        attributes: ['id', 'username', 'avatarUrl']
      },
      {
        model: require('./Post'),
        as: 'post',
        attributes: ['id', 'title']
      }
    ]
  });
};

// 类方法：获取统计信息
Comment.getStats = async function() {
  const { Op } = require('sequelize');
  
  const totalComments = await this.count();
  const approvedComments = await this.count({ where: { isApproved: true } });
  const pendingComments = await this.count({ where: { isApproved: false } });
  const rootComments = await this.count({ where: { parentId: null } });
  const replies = await this.count({ where: { parentId: { [Op.not]: null } } });
  
  const totalLikes = await this.sum('like_count') || 0;
  
  const recentComments = await this.count({
    where: {
      created_at: {
        [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 最近7天
      }
    }
  });
  
  const topCommenters = await this.findAll({
    attributes: [
      'author_id',
      [sequelize.fn('COUNT', sequelize.col('id')), 'comment_count']
    ],
    group: ['author_id'],
    order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
    limit: 5,
    raw: true
  });
  
  return {
    total: totalComments,
    approved: approvedComments,
    pending: pendingComments,
    rootComments,
    replies,
    totalLikes,
    recentComments,
    topCommenters: topCommenters.map(item => ({
      authorId: item.author_id,
      count: parseInt(item.comment_count)
    }))
  };
};

module.exports = Comment;