// 阶段六：文章管理CRUD控制器
const { Post, User, Comment, Category } = require('../models');
const { Op } = require('sequelize');
const statusCode = require('../middleware/statusCode');

const postController = {
  // 获取文章列表（支持分页、搜索、过滤、排序）
  getPosts: async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        categoryId,
        authorId,
        search,
        tags,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        includeComments = false,
        includeAuthor = true,
        includeCategory = true,
      } = req.query;

      // 构建查询条件
      const whereConditions = {};

      if (status) {
        whereConditions.status = status;
      }

      if (categoryId) {
        whereConditions.categoryId = parseInt(categoryId);
      }

      if (authorId) {
        whereConditions.authorId = parseInt(authorId);
      }

      if (search) {
        whereConditions[Op.or] = [
          { title: { [Op.like]: `%${search}%` } },
          { content: { [Op.like]: `%${search}%` } },
          { summary: { [Op.like]: `%${search}%` } },
        ];
      }

      if (tags) {
        const tagList = Array.isArray(tags) ? tags : tags.split(',');
        whereConditions.tags = {
          [Op.overlap]: tagList,
        };
      }

      // 验证排序字段
      const validSortFields = [
        'createdAt',
        'updatedAt',
        'publishedAt',
        'title',
        'viewCount',
        'likeCount',
      ];
      const actualSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
      const actualSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : 'DESC';

      // 分页参数
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;

      // 构建包含关系
      const include = [];

      if (includeAuthor === 'true') {
        include.push({
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'firstName', 'lastName', 'email'],
          required: false,
        });
      }

      if (includeCategory === 'true') {
        include.push({
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug', 'color'],
          required: false,
        });
      }

      if (includeComments === 'true') {
        include.push({
          model: Comment,
          as: 'comments',
          attributes: ['id', 'content', 'createdAt'],
          include: [
            {
              model: User,
              as: 'author',
              attributes: ['id', 'username'],
            },
          ],
          limit: 5,
          order: [['createdAt', 'DESC']],
          required: false,
        });
      }

      // 查询文章
      const { count, rows: posts } = await Post.findAndCountAll({
        where: whereConditions,
        limit: limitNum,
        offset: offset,
        order: [[actualSortBy, actualSortOrder]],
        include: include,
        distinct: true,
      });

      statusCode.success.ok(
        res,
        {
          posts,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: count,
            totalPages: Math.ceil(count / limitNum),
            hasNext: pageNum < Math.ceil(count / limitNum),
            hasPrev: pageNum > 1,
          },
          filters: { status, categoryId, authorId, search, tags },
          sorting: { sortBy: actualSortBy, sortOrder: actualSortOrder },
        },
        '获取文章列表成功'
      );
    } catch (error) {
      statusCode.serverError.internalError(res, '获取文章列表失败', error);
    }
  },

  // 获取单篇文章详情
  getPostById: async (req, res) => {
    try {
      const { id } = req.params;
      const { incrementView = true } = req.query;

      const post = await Post.findByPk(id, {
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'username', 'firstName', 'lastName', 'email', 'bio'],
          },
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'slug', 'description', 'color'],
          },
          {
            model: Comment,
            as: 'comments',
            include: [
              {
                model: User,
                as: 'author',
                attributes: ['id', 'username', 'firstName', 'lastName'],
              },
            ],
            where: { isApproved: true },
            required: false,
            order: [['createdAt', 'DESC']],
          },
        ],
      });

      if (!post) {
        return statusCode.clientError.notFound(res, '文章不存在');
      }

      // 检查访问权限
      if (post.status === 'draft' || post.status === 'private') {
        // 只有作者、管理员和版主可以查看草稿和私有文章
        if (
          !req.user ||
          (req.user.userId !== post.authorId &&
            !['admin', 'moderator'].includes(req.user.role))
        ) {
          return statusCode.clientError.notFound(res, '文章不存在');
        }
      }

      // 增加访问次数（如果不是作者本人且是公开文章）
      if (
        incrementView === 'true' &&
        post.status === 'published' &&
        (!req.user || req.user.userId !== post.authorId)
      ) {
        await post.incrementViewCount();
      }

      statusCode.success.ok(res, post, '获取文章详情成功');
    } catch (error) {
      statusCode.serverError.internalError(res, '获取文章详情失败', error);
    }
  },

  // 创建文章
  createPost: async (req, res) => {
    try {
      const {
        title,
        content,
        summary,
        categoryId,
        tags = [],
        status = 'draft',
        allowComments = true,
        publishNow = false,
      } = req.body;

      // 验证分类存在性
      if (categoryId) {
        const category = await Category.findByPk(categoryId);
        if (!category) {
          return statusCode.clientError.badRequest(res, '指定的分类不存在');
        }
      }

      // 创建文章数据
      const postData = {
        title,
        content,
        summary: summary || content.substring(0, 200) + '...',
        authorId: req.user.userId,
        categoryId: categoryId || null,
        tags: Array.isArray(tags) ? tags : [],
        status,
        allowComments,
        publishedAt: status === 'published' || publishNow ? new Date() : null,
      };

      const newPost = await Post.create(postData);

      // 更新分类文章数量
      if (categoryId && (status === 'published' || publishNow)) {
        const category = await Category.findByPk(categoryId);
        await category.updatePostCount();
      }

      // 重新获取完整的文章信息
      const completePost = await Post.findByPk(newPost.id, {
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'username', 'firstName', 'lastName'],
          },
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'slug'],
          },
        ],
      });

      statusCode.success.created(res, completePost, '文章创建成功');
    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message);
        return statusCode.clientError.badRequest(
          res,
          `数据验证失败: ${validationErrors.join(', ')}`
        );
      }

      statusCode.serverError.internalError(res, '创建文章失败', error);
    }
  },

  // 更新文章
  updatePost: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        content,
        summary,
        categoryId,
        tags,
        status,
        allowComments,
        publishNow = false,
      } = req.body;

      const post = await Post.findByPk(id);
      if (!post) {
        return statusCode.clientError.notFound(res, '文章不存在');
      }

      // 权限检查：只有作者、管理员和版主可以编辑
      if (
        req.user.userId !== post.authorId &&
        !['admin', 'moderator'].includes(req.user.role)
      ) {
        return statusCode.clientError.forbidden(res, '权限不足：只能编辑自己的文章');
      }

      // 验证分类存在性
      if (categoryId !== undefined) {
        if (categoryId && categoryId !== post.categoryId) {
          const category = await Category.findByPk(categoryId);
          if (!category) {
            return statusCode.clientError.badRequest(res, '指定的分类不存在');
          }
        }
      }

      // 准备更新数据
      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;
      if (summary !== undefined) updateData.summary = summary;
      if (categoryId !== undefined) updateData.categoryId = categoryId;
      if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
      if (allowComments !== undefined) updateData.allowComments = allowComments;

      // 处理状态和发布时间
      if (status !== undefined) {
        updateData.status = status;
        if (status === 'published' && !post.publishedAt) {
          updateData.publishedAt = new Date();
        }
      }

      if (publishNow && !post.publishedAt) {
        updateData.status = 'published';
        updateData.publishedAt = new Date();
      }

      // 更新文章
      await post.update(updateData);

      // 更新分类文章数量
      if (categoryId !== undefined && categoryId !== post.categoryId) {
        if (post.categoryId) {
          const oldCategory = await Category.findByPk(post.categoryId);
          if (oldCategory) await oldCategory.updatePostCount();
        }
        if (categoryId) {
          const newCategory = await Category.findByPk(categoryId);
          if (newCategory) await newCategory.updatePostCount();
        }
      }

      // 重新获取更新后的文章信息
      await post.reload();
      const completePost = await Post.findByPk(post.id, {
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'username', 'firstName', 'lastName'],
          },
          {
            model: Category,
            as: 'category',
            attributes: ['id', 'name', 'slug'],
          },
        ],
      });

      statusCode.success.ok(res, completePost, '文章更新成功');
    } catch (error) {
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message);
        return statusCode.clientError.badRequest(
          res,
          `数据验证失败: ${validationErrors.join(', ')}`
        );
      }

      statusCode.serverError.internalError(res, '更新文章失败', error);
    }
  },

  // 删除文章（软删除）
  deletePost: async (req, res) => {
    try {
      const { id } = req.params;
      const { permanent = false } = req.query;

      const post = await Post.findByPk(id);
      if (!post) {
        return statusCode.clientError.notFound(res, '文章不存在');
      }

      // 权限检查：只有作者、管理员和版主可以删除
      if (
        req.user.userId !== post.authorId &&
        !['admin', 'moderator'].includes(req.user.role)
      ) {
        return statusCode.clientError.forbidden(res, '权限不足：只能删除自己的文章');
      }

      if (permanent === 'true') {
        // 永久删除（物理删除）
        await post.destroy({ force: true });
        statusCode.success.ok(res, null, '文章已永久删除');
      } else {
        // 软删除
        await post.destroy();
        statusCode.success.ok(res, null, '文章已删除');
      }

      // 更新分类文章数量
      if (post.categoryId) {
        const category = await Category.findByPk(post.categoryId);
        if (category) await category.updatePostCount();
      }
    } catch (error) {
      statusCode.serverError.internalError(res, '删除文章失败', error);
    }
  },

  // 恢复已删除的文章
  restorePost: async (req, res) => {
    try {
      const { id } = req.params;

      const post = await Post.findByPk(id, { paranoid: false });
      if (!post) {
        return statusCode.clientError.notFound(res, '文章不存在');
      }

      if (!post.deletedAt) {
        return statusCode.clientError.badRequest(res, '文章未被删除，无需恢复');
      }

      // 权限检查：只有作者、管理员和版主可以恢复
      if (
        req.user.userId !== post.authorId &&
        !['admin', 'moderator'].includes(req.user.role)
      ) {
        return statusCode.clientError.forbidden(res, '权限不足：只能恢复自己的文章');
      }

      await post.restore();

      // 更新分类文章数量
      if (post.categoryId) {
        const category = await Category.findByPk(post.categoryId);
        if (category) await category.updatePostCount();
      }

      statusCode.success.ok(res, post, '文章恢复成功');
    } catch (error) {
      statusCode.serverError.internalError(res, '恢复文章失败', error);
    }
  },

  // 发布文章
  publishPost: async (req, res) => {
    try {
      const { id } = req.params;

      const post = await Post.findByPk(id);
      if (!post) {
        return statusCode.clientError.notFound(res, '文章不存在');
      }

      // 权限检查：只有作者、管理员和版主可以发布
      if (
        req.user.userId !== post.authorId &&
        !['admin', 'moderator'].includes(req.user.role)
      ) {
        return statusCode.clientError.forbidden(res, '权限不足：只能发布自己的文章');
      }

      if (post.status === 'published') {
        return statusCode.clientError.badRequest(res, '文章已经是发布状态');
      }

      await post.publish();

      statusCode.success.ok(res, post, '文章发布成功');
    } catch (error) {
      statusCode.serverError.internalError(res, '发布文章失败', error);
    }
  },

  // 取消发布文章
  unpublishPost: async (req, res) => {
    try {
      const { id } = req.params;

      const post = await Post.findByPk(id);
      if (!post) {
        return statusCode.clientError.notFound(res, '文章不存在');
      }

      // 权限检查：只有作者、管理员和版主可以取消发布
      if (
        req.user.userId !== post.authorId &&
        !['admin', 'moderator'].includes(req.user.role)
      ) {
        return statusCode.clientError.forbidden(res, '权限不足：只能操作自己的文章');
      }

      if (post.status !== 'published') {
        return statusCode.clientError.badRequest(res, '文章不是发布状态');
      }

      await post.unpublish();

      statusCode.success.ok(res, post, '文章已取消发布');
    } catch (error) {
      statusCode.serverError.internalError(res, '取消发布文章失败', error);
    }
  },

  // 点赞文章
  likePost: async (req, res) => {
    try {
      const { id } = req.params;

      const post = await Post.findByPk(id);
      if (!post) {
        return statusCode.clientError.notFound(res, '文章不存在');
      }

      if (post.status !== 'published') {
        return statusCode.clientError.badRequest(res, '只能点赞已发布的文章');
      }

      await post.incrementLikeCount();

      statusCode.success.ok(
        res,
        {
          likeCount: post.likeCount,
        },
        '点赞成功'
      );
    } catch (error) {
      statusCode.serverError.internalError(res, '点赞失败', error);
    }
  },

  // 获取文章统计信息
  getPostStats: async (req, res) => {
    try {
      const { id } = req.params;

      const post = await Post.findByPk(id);
      if (!post) {
        return statusCode.clientError.notFound(res, '文章不存在');
      }

      const stats = await post.getStats();
      statusCode.success.ok(res, stats, '获取文章统计信息成功');
    } catch (error) {
      statusCode.serverError.internalError(res, '获取文章统计信息失败', error);
    }
  },

  // 批量操作文章
  batchOperation: async (req, res) => {
    try {
      const { operation, postIds, data = {} } = req.body;

      if (!operation || !Array.isArray(postIds) || postIds.length === 0) {
        return statusCode.clientError.badRequest(res, '操作类型和文章ID列表不能为空');
      }

      const validOperations = [
        'publish',
        'unpublish',
        'delete',
        'changeCategory',
        'changeStatus',
      ];
      if (!validOperations.includes(operation)) {
        return statusCode.clientError.badRequest(
          res,
          `操作类型必须是以下之一: ${validOperations.join(', ')}`
        );
      }

      const results = [];

      for (const postId of postIds) {
        try {
          const post = await Post.findByPk(postId);
          if (!post) {
            results.push({ postId, success: false, message: '文章不存在' });
            continue;
          }

          // 权限检查
          if (
            req.user.userId !== post.authorId &&
            !['admin', 'moderator'].includes(req.user.role)
          ) {
            results.push({ postId, success: false, message: '权限不足' });
            continue;
          }

          switch (operation) {
            case 'publish':
              if (post.status !== 'published') {
                await post.publish();
              }
              results.push({ postId, success: true, message: '文章已发布' });
              break;

            case 'unpublish':
              if (post.status === 'published') {
                await post.unpublish();
              }
              results.push({ postId, success: true, message: '文章已取消发布' });
              break;

            case 'delete':
              await post.destroy();
              results.push({ postId, success: true, message: '文章已删除' });
              break;

            case 'changeCategory':
              if (!data.categoryId) {
                results.push({ postId, success: false, message: '分类ID参数缺失' });
                continue;
              }
              const category = await Category.findByPk(data.categoryId);
              if (!category) {
                results.push({ postId, success: false, message: '指定的分类不存在' });
                continue;
              }
              await post.update({ categoryId: data.categoryId });
              results.push({ postId, success: true, message: '分类更新成功' });
              break;

            case 'changeStatus':
              if (!data.status) {
                results.push({ postId, success: false, message: '状态参数缺失' });
                continue;
              }
              const validStatuses = ['draft', 'published', 'archived', 'private'];
              if (!validStatuses.includes(data.status)) {
                results.push({ postId, success: false, message: '无效的状态' });
                continue;
              }
              await post.update({ status: data.status });
              results.push({ postId, success: true, message: '状态更新成功' });
              break;
          }
        } catch (error) {
          results.push({ postId, success: false, message: error.message });
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
};

module.exports = postController;
