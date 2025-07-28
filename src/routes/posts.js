// 阶段六：文章路由模块（集成数据库）
const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const auth = require('../middleware/auth');
const validateRequest = require('../middleware/requestValidator');

// 路由级中间件：文章ID验证
const validatePostId = (req, res, next) => {
  const postId = parseInt(req.params.id || req.params.postId);
  if (isNaN(postId) || postId <= 0) {
    return res.status(400).json({
      status: 'error',
      message: '文章ID必须是正整数',
      timestamp: new Date().toISOString()
    });
  }
  req.params.id = postId;
  req.params.postId = postId;
  next();
};

// GET /api/posts - 获取文章列表（支持分页、搜索、过滤、排序）
// 公开访问，但返回不同的内容基于用户权限
router.get('/', (req, res, next) => {
  // 如果用户未登录，只显示已发布的文章
  if (!req.user) {
    req.query.status = 'published';
  }
  next();
}, postController.getPosts);

// GET /api/posts/:id - 获取单篇文章详情
// 公开访问，但权限检查在controller中处理
router.get('/:id', 
  validatePostId,
  postController.getPostById
);

// POST /api/posts - 创建新文章（需要认证）
router.post('/', 
  auth.authenticate,
  validateRequest({
    body: {
      title: { 
        required: true, 
        type: 'string', 
        minLength: 1, 
        maxLength: 200
      },
      content: { 
        required: true, 
        type: 'string', 
        minLength: 1
      },
      summary: {
        required: false,
        type: 'string',
        maxLength: 500
      },
      categoryId: {
        required: false,
        type: 'number'
      },
      tags: {
        required: false,
        type: 'array'
      },
      status: {
        required: false,
        type: 'string'
      },
      allowComments: {
        required: false,
        type: 'boolean'
      },
      publishNow: {
        required: false,
        type: 'boolean'
      }
    }
  }), 
  postController.createPost
);

// PUT /api/posts/:id - 更新文章（需要认证和权限检查）
router.put('/:id', 
  validatePostId,
  auth.authenticate,
  validateRequest({
    body: {
      title: { 
        required: false, 
        type: 'string', 
        minLength: 1, 
        maxLength: 200
      },
      content: { 
        required: false, 
        type: 'string', 
        minLength: 1
      },
      summary: {
        required: false,
        type: 'string',
        maxLength: 500
      },
      categoryId: {
        required: false,
        type: 'number'
      },
      tags: {
        required: false,
        type: 'array'
      },
      status: {
        required: false,
        type: 'string'
      },
      allowComments: {
        required: false,
        type: 'boolean'
      },
      publishNow: {
        required: false,
        type: 'boolean'
      }
    }
  }), 
  postController.updatePost
);

// DELETE /api/posts/:id - 删除文章（需要认证和权限检查）
router.delete('/:id', 
  validatePostId,
  auth.authenticate,
  postController.deletePost
);

// POST /api/posts/:id/restore - 恢复已删除的文章（需要认证和权限检查）
router.post('/:id/restore', 
  validatePostId,
  auth.authenticate,
  postController.restorePost
);

// POST /api/posts/:id/publish - 发布文章（需要认证和权限检查）
router.post('/:id/publish', 
  validatePostId,
  auth.authenticate,
  postController.publishPost
);

// POST /api/posts/:id/unpublish - 取消发布文章（需要认证和权限检查）
router.post('/:id/unpublish', 
  validatePostId,
  auth.authenticate,
  postController.unpublishPost
);

// POST /api/posts/:id/like - 点赞文章
router.post('/:id/like', 
  validatePostId,
  postController.likePost
);

// GET /api/posts/:id/stats - 获取文章统计信息
router.get('/:id/stats', 
  validatePostId,
  auth.authenticate,
  auth.authorize(['admin', 'moderator']),
  postController.getPostStats
);

// POST /api/posts/batch - 批量操作文章（需要认证）
router.post('/batch', 
  auth.authenticate,
  validateRequest({
    body: {
      operation: {
        required: true,
        type: 'string'
      },
      postIds: {
        required: true,
        type: 'array',
        minItems: 1
      },
      data: {
        required: false,
        type: 'object'
      }
    }
  }),
  postController.batchOperation
);

// ===== 嵌套资源：文章评论路由 =====

// 导入评论控制器（将在下一步创建）
const commentController = require('../controllers/commentController');

// GET /api/posts/:postId/comments - 获取文章的评论列表
router.get('/:postId/comments', 
  validatePostId,
  commentController.getCommentsByPost
);

// POST /api/posts/:postId/comments - 为文章创建评论
router.post('/:postId/comments', 
  validatePostId,
  auth.authenticate,
  validateRequest({
    body: {
      content: { 
        required: true, 
        type: 'string', 
        minLength: 1,
        maxLength: 1000
      },
      parentId: {
        required: false,
        type: 'number'
      }
    }
  }),
  commentController.createComment
);

// GET /api/posts/:postId/comments/:commentId - 获取特定评论详情
router.get('/:postId/comments/:commentId', 
  validatePostId,
  (req, res, next) => {
    const commentId = parseInt(req.params.commentId);
    if (isNaN(commentId) || commentId <= 0) {
      return res.status(400).json({
        status: 'error',
        message: '评论ID必须是正整数',
        timestamp: new Date().toISOString()
      });
    }
    req.params.commentId = commentId;
    next();
  },
  commentController.getCommentById
);

// PUT /api/posts/:postId/comments/:commentId - 更新评论
router.put('/:postId/comments/:commentId', 
  validatePostId,
  (req, res, next) => {
    const commentId = parseInt(req.params.commentId);
    if (isNaN(commentId) || commentId <= 0) {
      return res.status(400).json({
        status: 'error',
        message: '评论ID必须是正整数',
        timestamp: new Date().toISOString()
      });
    }
    req.params.commentId = commentId;
    next();
  },
  auth.authenticate,
  validateRequest({
    body: {
      content: { 
        required: true, 
        type: 'string', 
        minLength: 1,
        maxLength: 1000
      }
    }
  }),
  commentController.updateComment
);

// DELETE /api/posts/:postId/comments/:commentId - 删除评论
router.delete('/:postId/comments/:commentId', 
  validatePostId,
  (req, res, next) => {
    const commentId = parseInt(req.params.commentId);
    if (isNaN(commentId) || commentId <= 0) {
      return res.status(400).json({
        status: 'error',
        message: '评论ID必须是正整数',
        timestamp: new Date().toISOString()
      });
    }
    req.params.commentId = commentId;
    next();
  },
  auth.authenticate,
  commentController.deleteComment
);

module.exports = router;