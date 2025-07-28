// 阶段三：文章路由模块（演示嵌套资源）
const express = require('express');
const router = express.Router();
const validateRequest = require('../middleware/requestValidator');

// 模拟文章数据
let posts = [
  { 
    id: 1, 
    title: '学习Node.js', 
    content: '这是一篇关于Node.js的文章...', 
    authorId: 1,
    tags: ['nodejs', 'javascript'],
    status: 'published',
    createdAt: '2024-01-01T00:00:00.000Z' 
  },
  { 
    id: 2, 
    title: 'Express.js最佳实践', 
    content: '这是一篇关于Express.js的文章...', 
    authorId: 2,
    tags: ['express', 'nodejs'],
    status: 'draft',
    createdAt: '2024-01-02T00:00:00.000Z' 
  }
];

// 模拟评论数据
let comments = [
  { id: 1, postId: 1, content: '很好的文章！', authorId: 2, createdAt: '2024-01-01T01:00:00.000Z' },
  { id: 2, postId: 1, content: '学到了很多', authorId: 3, createdAt: '2024-01-01T02:00:00.000Z' },
  { id: 3, postId: 2, content: '期待更多内容', authorId: 1, createdAt: '2024-01-02T01:00:00.000Z' }
];

// 参数验证中间件
const validatePostId = (req, res, next) => {
  const postId = parseInt(req.params.id || req.params.postId);
  if (isNaN(postId) || postId <= 0) {
    return res.status(400).json({
      status: 'error',
      message: '文章ID必须是正整数',
      timestamp: new Date().toISOString()
    });
  }
  req.postId = postId;
  next();
};

const checkPostExists = (req, res, next) => {
  const post = posts.find(p => p.id === req.postId);
  if (!post) {
    return res.status(404).json({
      status: 'error',
      message: `文章ID ${req.postId} 不存在`,
      timestamp: new Date().toISOString()
    });
  }
  req.post = post;
  next();
};

// GET /api/posts - 获取文章列表
router.get('/', (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    status, 
    authorId, 
    tag,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;
  
  // 参数验证
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({
      status: 'error',
      message: 'page参数必须是大于0的整数'
    });
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
    return res.status(400).json({
      status: 'error',
      message: 'limit参数必须是1-50之间的整数'
    });
  }
  
  // 验证排序参数
  const validSortFields = ['createdAt', 'title', 'id'];
  const validSortOrders = ['asc', 'desc'];
  
  if (!validSortFields.includes(sortBy)) {
    return res.status(400).json({
      status: 'error',
      message: `sortBy必须是以下之一: ${validSortFields.join(', ')}`
    });
  }
  
  if (!validSortOrders.includes(sortOrder)) {
    return res.status(400).json({
      status: 'error',
      message: `sortOrder必须是以下之一: ${validSortOrders.join(', ')}`
    });
  }
  
  // 过滤数据
  let filteredPosts = [...posts];
  
  // 按状态过滤
  if (status) {
    filteredPosts = filteredPosts.filter(post => post.status === status);
  }
  
  // 按作者过滤
  if (authorId) {
    const authorIdNum = parseInt(authorId);
    if (!isNaN(authorIdNum)) {
      filteredPosts = filteredPosts.filter(post => post.authorId === authorIdNum);
    }
  }
  
  // 按标签过滤
  if (tag) {
    filteredPosts = filteredPosts.filter(post => 
      post.tags && post.tags.includes(tag)
    );
  }
  
  // 排序
  filteredPosts.sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'createdAt') {
      comparison = new Date(a[sortBy]).getTime() - new Date(b[sortBy]).getTime();
    } else {
      comparison = a[sortBy] > b[sortBy] ? 1 : -1;
    }
    return sortOrder === 'desc' ? -comparison : comparison;
  });
  
  // 分页
  const total = filteredPosts.length;
  const startIndex = (pageNum - 1) * limitNum;
  const paginatedPosts = filteredPosts.slice(startIndex, startIndex + limitNum);
  
  res.json({
    status: 'success',
    data: {
      posts: paginatedPosts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: Math.ceil(total / limitNum)
      },
      filters: { status, authorId, tag },
      sorting: { sortBy, sortOrder }
    },
    timestamp: new Date().toISOString()
  });
});

// GET /api/posts/:id - 获取单篇文章
router.get('/:id', validatePostId, checkPostExists, (req, res) => {
  // 获取文章的评论数量
  const commentCount = comments.filter(c => c.postId === req.postId).length;
  
  res.json({
    status: 'success',
    data: {
      ...req.post,
      commentCount
    },
    timestamp: new Date().toISOString()
  });
});

// POST /api/posts - 创建新文章
router.post('/', validateRequest({
  body: {
    title: { required: true, type: 'string', minLength: 1, maxLength: 200 },
    content: { required: true, type: 'string', minLength: 1 },
    authorId: { required: true, type: 'number' },
    tags: { required: false, type: 'object' },
    status: { required: false, type: 'string' }
  }
}), (req, res) => {
  const { title, content, authorId, tags = [], status = 'draft' } = req.body;
  
  // 验证状态
  const validStatuses = ['draft', 'published', 'archived'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      status: 'error',
      message: `状态必须是以下之一: ${validStatuses.join(', ')}`
    });
  }
  
  // 验证标签格式
  if (tags && !Array.isArray(tags)) {
    return res.status(400).json({
      status: 'error',
      message: '标签必须是数组格式'
    });
  }
  
  const newPost = {
    id: Math.max(...posts.map(p => p.id), 0) + 1,
    title,
    content,
    authorId,
    tags: tags || [],
    status,
    createdAt: new Date().toISOString()
  };
  
  posts.push(newPost);
  
  res.status(201).json({
    status: 'success',
    message: '文章创建成功',
    data: newPost,
    timestamp: new Date().toISOString()
  });
});

// PUT /api/posts/:id - 更新文章
router.put('/:id', validatePostId, checkPostExists, validateRequest({
  body: {
    title: { required: false, type: 'string', minLength: 1, maxLength: 200 },
    content: { required: false, type: 'string', minLength: 1 },
    tags: { required: false, type: 'object' },
    status: { required: false, type: 'string' }
  }
}), (req, res) => {
  const { title, content, tags, status } = req.body;
  
  if (status) {
    const validStatuses = ['draft', 'published', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: `状态必须是以下之一: ${validStatuses.join(', ')}`
      });
    }
  }
  
  if (tags && !Array.isArray(tags)) {
    return res.status(400).json({
      status: 'error',
      message: '标签必须是数组格式'
    });
  }
  
  const postIndex = posts.findIndex(p => p.id === req.postId);
  posts[postIndex] = {
    ...posts[postIndex],
    ...(title && { title }),
    ...(content && { content }),
    ...(tags && { tags }),
    ...(status && { status }),
    updatedAt: new Date().toISOString()
  };
  
  res.json({
    status: 'success',
    message: '文章更新成功',
    data: posts[postIndex],
    timestamp: new Date().toISOString()
  });
});

// DELETE /api/posts/:id - 删除文章
router.delete('/:id', validatePostId, checkPostExists, (req, res) => {
  const postIndex = posts.findIndex(p => p.id === req.postId);
  const deletedPost = posts.splice(postIndex, 1)[0];
  
  // 同时删除相关评论
  const deletedComments = comments.filter(c => c.postId === req.postId);
  comments = comments.filter(c => c.postId !== req.postId);
  
  res.json({
    status: 'success',
    message: '文章删除成功',
    data: {
      post: deletedPost,
      deletedCommentsCount: deletedComments.length
    },
    timestamp: new Date().toISOString()
  });
});

// =======嵌套资源路由：文章评论=======

// GET /api/posts/:postId/comments - 获取文章评论
router.get('/:postId/comments', validatePostId, checkPostExists, (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  const postComments = comments.filter(c => c.postId === req.postId);
  
  // 分页
  const total = postComments.length;
  const startIndex = (pageNum - 1) * limitNum;
  const paginatedComments = postComments.slice(startIndex, startIndex + limitNum);
  
  res.json({
    status: 'success',
    data: {
      comments: paginatedComments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: total,
        totalPages: Math.ceil(total / limitNum)
      },
      postInfo: {
        id: req.post.id,
        title: req.post.title
      }
    },
    timestamp: new Date().toISOString()
  });
});

// POST /api/posts/:postId/comments - 创建文章评论
router.post('/:postId/comments', validatePostId, checkPostExists, validateRequest({
  body: {
    content: { required: true, type: 'string', minLength: 1, maxLength: 1000 },
    authorId: { required: true, type: 'number' }
  }
}), (req, res) => {
  const { content, authorId } = req.body;
  
  const newComment = {
    id: Math.max(...comments.map(c => c.id), 0) + 1,
    postId: req.postId,
    content,
    authorId,
    createdAt: new Date().toISOString()
  };
  
  comments.push(newComment);
  
  res.status(201).json({
    status: 'success',
    message: '评论创建成功',
    data: newComment,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;