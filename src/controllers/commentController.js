// 阶段六：评论管理CRUD控制器
const { Comment, User, Post } = require('../models');
const { Op } = require('sequelize');
const statusCode = require('../middleware/statusCode');

const commentController = {
  // 获取文章的评论列表（支持分页、排序、嵌套显示）
  getCommentsByPost: async (req, res) => {
    try {
      const { postId } = req.params;
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'ASC',
        includeReplies = true,
        onlyApproved = true,
      } = req.query;

      // 验证文章存在性
      const post = await Post.findByPk(postId);
      if (!post) {
        return statusCode.clientError.notFound(res, '文章不存在');
      }

      // 构建查询条件
      const whereConditions = {
        postId: parseInt(postId),
        parentId: null, // 只获取顶级评论
      };

      // 是否只显示已审核的评论
      if (onlyApproved === 'true') {
        whereConditions.isApproved = true;
      }

      // 验证排序字段
      const validSortFields = ['createdAt', 'updatedAt'];
      const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
      const actualSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : 'ASC';

      // 分页参数
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      // 构建包含关系
      const include = [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'firstName', 'lastName'],
          required: true,
        },
      ];

      // 如果需要包含回复
      if (includeReplies === 'true') {
        include.push({
          model: Comment,
          as: 'replies',
          include: [
            {
              model: User,
              as: 'author',
              attributes: ['id', 'username', 'firstName', 'lastName'],
            },
          ],
          where: onlyApproved === 'true' ? { isApproved: true } : {},
          required: false,
          order: [['createdAt', 'ASC']],
        });
      }

      // 查询评论
      const { count, rows: comments } = await Comment.findAndCountAll({
        where: whereConditions,
        limit: limitNum,
        offset: offset,
        order: [[actualSortBy, actualSortOrder]],
        include: include,
        distinct: true,
      });

      // 如果需要构建评论树
      let processedComments = comments;
      if (includeReplies === 'true') {
        processedComments = await Promise.all(
          comments.map(async comment => {
            const commentTree = await comment.buildCommentTree();
            return commentTree;
          })
        );
      }

      statusCode.success.ok(
        res,
        {
          comments: processedComments,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: count,
            totalPages: Math.ceil(count / limitNum),
            hasNext: pageNum < Math.ceil(count / limitNum),
            hasPrev: pageNum > 1,
          },
          postInfo: {
            id: post.id,
            title: post.title,
            allowComments: post.allowComments,
          },
          sorting: { sortBy: actualSortBy, sortOrder: actualSortOrder },
        },
        '获取评论列表成功'
      );
    } catch (error) {
      statusCode.serverError.internalError(res, '获取评论列表失败', error);
    }
  },

  // 获取单个评论详情
  getCommentById: async (req, res) => {
    try {
      const { commentId } = req.params;

      const comment = await Comment.findByPk(commentId, {
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'username', 'firstName', 'lastName'],
          },
          {
            model: Post,
            as: 'post',
            attributes: ['id', 'title', 'allowComments'],
          },
          {
            model: Comment,
            as: 'parent',
            attributes: ['id', 'content', 'authorId'],
            include: [
              {
                model: User,
                as: 'author',
                attributes: ['id', 'username'],
              },
            ],
          },
          {
            model: Comment,
            as: 'replies',
            include: [
              {
                model: User,
                as: 'author',
                attributes: ['id', 'username', 'firstName', 'lastName'],
              },
            ],
            order: [['createdAt', 'ASC']],
          },
        ],
      });

      if (!comment) {
        return statusCode.clientError.notFound(res, '评论不存在');
      }

      statusCode.success.ok(res, comment, '获取评论详情成功');
    } catch (error) {
      statusCode.serverError.internalError(res, '获取评论详情失败', error);
    }
  },

  // 创建评论
  createComment: async (req, res) => {
    try {
      const { postId } = req.params;
      const { content, parentId } = req.body;

      // 验证文章存在性和评论权限
      const post = await Post.findByPk(postId);
      if (!post) {
        return statusCode.clientError.notFound(res, '文章不存在');
      }

      if (!post.allowComments) {
        return statusCode.clientError.forbidden(res, '该文章不允许评论');
      }

      // 如果是回复评论，验证父评论存在性
      let parentComment = null;
      if (parentId) {
        parentComment = await Comment.findByPk(parentId);
        if (!parentComment) {
          return statusCode.clientError.notFound(res, '要回复的评论不存在');
        }

        if (parentComment.postId !== parseInt(postId)) {
          return statusCode.clientError.badRequest(res, '只能回复同一篇文章下的评论');
        }
      }

      // 获取客户端信息
      const ipAddress = req.ip || req.connection.remoteAddress || '未知';
      const userAgent = req.get('user-agent') || '未知';

      // 创建评论
      const newComment = await Comment.create({
        content,
        authorId: req.user.userId,
        postId: parseInt(postId),
        parentId: parentId || null,
        isApproved: true, // 在实际应用中可能需要审核流程
        ipAddress,
        userAgent,
      });

      // 重新获取完整的评论信息
      const completeComment = await Comment.findByPk(newComment.id, {
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'username', 'firstName', 'lastName'],
          },
          {
            model: Comment,
            as: 'parent',
            attributes: ['id', 'content'],
            include: [
              {
                model: User,
                as: 'author',
                attributes: ['id', 'username'],
              },
            ],
          },
        ],
      });

      statusCode.success.created(res, completeComment, '评论创建成功');
    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message);
        return statusCode.clientError.badRequest(
          res,
          `数据验证失败: ${validationErrors.join(', ')}`
        );
      }

      statusCode.serverError.internalError(res, '创建评论失败', error);
    }
  },

  // 更新评论
  updateComment: async (req, res) => {
    try {
      const { commentId } = req.params;
      const { content } = req.body;

      const comment = await Comment.findByPk(commentId);
      if (!comment) {
        return statusCode.clientError.notFound(res, '评论不存在');
      }

      // 权限检查：只有评论作者、管理员和版主可以编辑
      if (
        req.user.userId !== comment.authorId &&
        !['admin', 'moderator'].includes(req.user.role)
      ) {
        return statusCode.clientError.forbidden(res, '权限不足：只能编辑自己的评论');
      }

      // 检查评论是否可以编辑（例如：发布后一段时间内才能编辑）
      const commentAge = Date.now() - new Date(comment.createdAt).getTime();
      const editTimeLimit = 30 * 60 * 1000; // 30分钟

      if (commentAge > editTimeLimit && req.user.role === 'user') {
        return statusCode.clientError.forbidden(res, '评论发布超过30分钟后不能编辑');
      }

      // 更新评论
      await comment.update({
        content,
        isEdited: true,
      });

      // 重新获取更新后的评论信息
      await comment.reload();
      const completeComment = await Comment.findByPk(comment.id, {
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'username', 'firstName', 'lastName'],
          },
        ],
      });

      statusCode.success.ok(res, completeComment, '评论更新成功');
    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message);
        return statusCode.clientError.badRequest(
          res,
          `数据验证失败: ${validationErrors.join(', ')}`
        );
      }

      statusCode.serverError.internalError(res, '更新评论失败', error);
    }
  },

  // 删除评论（软删除）
  deleteComment: async (req, res) => {
    try {
      const { commentId } = req.params;
      const { permanent = false } = req.query;

      const comment = await Comment.findByPk(commentId, {
        include: [
          {
            model: Comment,
            as: 'replies',
          },
        ],
      });

      if (!comment) {
        return statusCode.clientError.notFound(res, '评论不存在');
      }

      // 权限检查：只有评论作者、管理员和版主可以删除
      if (
        req.user.userId !== comment.authorId &&
        !['admin', 'moderator'].includes(req.user.role)
      ) {
        return statusCode.clientError.forbidden(res, '权限不足：只能删除自己的评论');
      }

      // 如果有回复评论，提醒用户
      if (comment.replies && comment.replies.length > 0 && permanent !== 'true') {
        return statusCode.clientError.badRequest(
          res,
          '该评论有回复，请先删除所有回复或使用永久删除'
        );
      }

      if (permanent === 'true') {
        // 永久删除（物理删除）
        await comment.destroy({ force: true });
        statusCode.success.ok(res, null, '评论已永久删除');
      } else {
        // 软删除
        await comment.destroy();
        statusCode.success.ok(res, null, '评论已删除');
      }
    } catch (error) {
      statusCode.serverError.internalError(res, '删除评论失败', error);
    }
  },

  // 审核评论（管理员和版主功能）
  approveComment: async (req, res) => {
    try {
      const { commentId } = req.params;
      const { approved = true } = req.body;

      const comment = await Comment.findByPk(commentId);
      if (!comment) {
        return statusCode.clientError.notFound(res, '评论不存在');
      }

      await comment.update({
        isApproved: approved,
        approvedAt: approved ? new Date() : null,
        approvedBy: approved ? req.user.userId : null,
      });

      const action = approved ? '审核通过' : '审核拒绝';
      statusCode.success.ok(res, comment, `评论${action}成功`);
    } catch (error) {
      statusCode.serverError.internalError(res, '审核评论失败', error);
    }
  },

  // 获取待审核评论列表（管理员和版主功能）
  getPendingComments: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
      } = req.query;

      // 分页参数
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      // 查询待审核评论
      const { count, rows: comments } = await Comment.findAndCountAll({
        where: { isApproved: false },
        limit: limitNum,
        offset: offset,
        order: [[sortBy, sortOrder.toUpperCase()]],
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'username', 'firstName', 'lastName', 'email'],
          },
          {
            model: Post,
            as: 'post',
            attributes: ['id', 'title'],
          },
        ],
      });

      statusCode.success.ok(
        res,
        {
          comments,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: count,
            totalPages: Math.ceil(count / limitNum),
            hasNext: pageNum < Math.ceil(count / limitNum),
            hasPrev: pageNum > 1,
          },
        },
        '获取待审核评论列表成功'
      );
    } catch (error) {
      statusCode.serverError.internalError(res, '获取待审核评论列表失败', error);
    }
  },

  // 批量操作评论（管理员和版主功能）
  batchOperation: async (req, res) => {
    try {
      const { operation, commentIds, data = {} } = req.body;

      if (!operation || !Array.isArray(commentIds) || commentIds.length === 0) {
        return statusCode.clientError.badRequest(res, '操作类型和评论ID列表不能为空');
      }

      const validOperations = ['approve', 'reject', 'delete'];
      if (!validOperations.includes(operation)) {
        return statusCode.clientError.badRequest(
          res,
          `操作类型必须是以下之一: ${validOperations.join(', ')}`
        );
      }

      const results = [];

      for (const commentId of commentIds) {
        try {
          const comment = await Comment.findByPk(commentId);
          if (!comment) {
            results.push({ commentId, success: false, message: '评论不存在' });
            continue;
          }

          switch (operation) {
            case 'approve':
              await comment.update({
                isApproved: true,
                approvedAt: new Date(),
                approvedBy: req.user.userId,
              });
              results.push({ commentId, success: true, message: '评论已审核通过' });
              break;

            case 'reject':
              await comment.update({
                isApproved: false,
                approvedAt: null,
                approvedBy: null,
              });
              results.push({ commentId, success: true, message: '评论已审核拒绝' });
              break;

            case 'delete':
              await comment.destroy();
              results.push({ commentId, success: true, message: '评论已删除' });
              break;
          }
        } catch (error) {
          results.push({ commentId, success: false, message: error.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      statusCode.success.ok(
        res,
        {
          operation,
          results,
          summary: {
            total: results.length,
            success: successCount,
            failed: failCount,
          },
        },
        `批量操作完成：成功 ${successCount} 个，失败 ${failCount} 个`
      );
    } catch (error) {
      statusCode.serverError.internalError(res, '批量操作失败', error);
    }
  },

  // 获取评论统计信息
  getCommentStats: async (req, res) => {
    try {
      const { postId } = req.params;

      const whereCondition = {};
      if (postId) {
        // 验证文章存在性
        const post = await Post.findByPk(postId);
        if (!post) {
          return statusCode.clientError.notFound(res, '文章不存在');
        }
        whereCondition.postId = parseInt(postId);
      }

      const stats = await Comment.getStats(whereCondition);
      statusCode.success.ok(res, stats, '获取评论统计信息成功');
    } catch (error) {
      statusCode.serverError.internalError(res, '获取评论统计信息失败', error);
    }
  },
};

module.exports = commentController;
