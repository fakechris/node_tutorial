// 用户完整工作流程端到端测试
const testDatabase = require('../helpers/testDatabase');
const ApiHelper = require('../helpers/apiHelper');

let app;
let apiHelper;

describe('User Workflow E2E Tests', () => {
  beforeAll(async () => {
    await testDatabase.initialize();
    
    const appModule = require('../../src/index');
    app = appModule.app || appModule;
    
    apiHelper = new ApiHelper(app);
  });

  beforeEach(async () => {
    await testDatabase.cleanup();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  describe('Complete User Journey', () => {
    it('should handle complete user registration to content creation workflow', async () => {
      // 1. 用户注册
      const userData = {
        username: 'journeyuser',
        email: 'journey@example.com',
        password: 'SecurePassword123!'
      };

      const registerResponse = await apiHelper.post('/api/auth/register', userData);
      
      // Debug: 显示实际响应
      console.log('注册请求数据:', userData);
      console.log('注册响应状态:', registerResponse.status);
      console.log('注册响应内容:', JSON.stringify(registerResponse.body, null, 2));
      
      apiHelper.expectSuccessResponse(registerResponse, 201);
      
      const { user, token } = registerResponse.body.data;
      expect(token).toBeValidJWT();

      // 为了测试完整功能，将用户提升为管理员（直接数据库操作）
      const { User } = testDatabase.getModels();
      await User.update({ role: 'admin' }, { where: { id: user.id } });
      
      // 重新登录以获取更新的admin角色token
      const adminLoginResponse = await apiHelper.post('/api/auth/login', {
        username: userData.username,
        password: userData.password
      });
      apiHelper.expectSuccessResponse(adminLoginResponse, 200);
      const adminToken = adminLoginResponse.body.data.token;

      // 2. 登录验证
      const loginResponse = await apiHelper.post('/api/auth/login', {
        username: userData.username,
        password: userData.password
      });
      apiHelper.expectSuccessResponse(loginResponse, 200);

      // 3. 获取用户信息
      const profileResponse = await apiHelper.get('/api/auth/profile', { token: adminToken });
      apiHelper.expectSuccessResponse(profileResponse, 200);
      expect(profileResponse.body.data.user.id).toBe(user.id);

      // 4. 更新用户资料
      const profileUpdateData = {
        bio: 'I am a test user',
        firstName: 'Journey',
        lastName: 'User'
      };

      const updateResponse = await apiHelper.put('/api/auth/profile', profileUpdateData, { token: adminToken });
      apiHelper.expectSuccessResponse(updateResponse, 200);
      expect(updateResponse.body.data.user.bio).toBe(profileUpdateData.bio);

      // 5. 创建分类
      const categoryData = {
        name: 'My Test Category',
        slug: 'my-test-category',
        description: 'A category for testing'
      };

      const categoryResponse = await apiHelper.post('/api/categories', categoryData, { token: adminToken });
      
      // Debug: 显示分类创建响应
      console.log('分类创建请求数据:', categoryData);
      console.log('分类创建响应状态:', categoryResponse.status);
      console.log('分类创建响应内容:', JSON.stringify(categoryResponse.body, null, 2));
      
      apiHelper.expectSuccessResponse(categoryResponse, 201);
      
      const category = categoryResponse.body.data;
      apiHelper.expectCategoryFormat(category);

      // 6. 创建文章
      const postData = {
        title: 'My First Post',
        content: 'This is the content of my first post. It contains valuable information.',
        categoryId: category.id,
        status: 'published'
      };

      const postResponse = await apiHelper.post('/api/posts', postData, { token: adminToken });
      apiHelper.expectSuccessResponse(postResponse, 201);
      
      const post = postResponse.body.data;
      apiHelper.expectPostFormat(post);
      expect(post.authorId).toBe(user.id);

      // 7. 获取文章列表（验证文章已创建）
      const postsListResponse = await apiHelper.get('/api/posts');
      apiHelper.expectPaginatedResponse(postsListResponse, 200);
      expect(postsListResponse.body.data.posts).toHaveLength(1);
      expect(postsListResponse.body.data.posts[0].id).toBe(post.id);

      // 8. 获取单个文章详情
      const postDetailResponse = await apiHelper.get(`/api/posts/${post.id}`);
      apiHelper.expectSuccessResponse(postDetailResponse, 200);
      expect(postDetailResponse.body.data.id).toBe(post.id);

      // 9. 添加评论
      const commentData = {
        content: 'This is a great post! Thanks for sharing.'
      };

      const commentResponse = await apiHelper.post(`/api/posts/${post.id}/comments`, commentData, { token });
      apiHelper.expectSuccessResponse(commentResponse, 201);
      
      const comment = commentResponse.body.data.comment;
      apiHelper.expectCommentFormat(comment);
      expect(comment.postId).toBe(post.id);
      expect(comment.authorId).toBe(user.id);

      // 10. 获取文章评论列表
      const commentsResponse = await apiHelper.get(`/api/posts/${post.id}/comments`);
      apiHelper.expectPaginatedResponse(commentsResponse, 200);
      expect(commentsResponse.body.data.items).toHaveLength(1);
      expect(commentsResponse.body.data.items[0].id).toBe(comment.id);

      // 11. 更新文章
      const postUpdateData = {
        title: 'My Updated First Post',
        content: 'This is the updated content with more information.'
      };

      const postUpdateResponse = await apiHelper.put(`/api/posts/${post.id}`, postUpdateData, { token });
      apiHelper.expectSuccessResponse(postUpdateResponse, 200);
      expect(postUpdateResponse.body.data.post.title).toBe(postUpdateData.title);

      // 12. 修改密码
      const passwordChangeData = {
        currentPassword: userData.password,
        newPassword: 'NewSecurePassword123!'
      };

      const passwordResponse = await apiHelper.post('/api/auth/change-password', passwordChangeData, { token });
      apiHelper.expectSuccessResponse(passwordResponse, 200);

      // 13. 用新密码登录验证
      const newLoginResponse = await apiHelper.post('/api/auth/login', {
        username: userData.username,
        password: 'NewSecurePassword123!'
      });
      apiHelper.expectSuccessResponse(newLoginResponse, 200);

      // 14. 注销
      const logoutResponse = await apiHelper.post('/api/auth/logout', {}, { token });
      apiHelper.expectSuccessResponse(logoutResponse, 200);

      // 15. 验证注销后无法访问受保护的资源
      const protectedResponse = await apiHelper.get('/api/auth/me', { token });
      apiHelper.expectErrorResponse(protectedResponse, 401);
    });

    it('should handle multi-user interaction workflow', async () => {
      // 创建两个用户
      const user1Data = await apiHelper.registerAndLogin({
        username: 'author',
        email: 'author@example.com',
        password: 'AuthorPassword123!'
      });

      const user2Data = await apiHelper.registerAndLogin({
        username: 'commenter',
        email: 'commenter@example.com',
        password: 'CommenterPassword123!'
      });

      // 用户1创建分类和文章
      const categoryResponse = await apiHelper.post('/api/categories', {
        name: 'Shared Category',
        description: 'A category for multi-user testing'
      }, { token: user1Data.token });

      const category = categoryResponse.body.data.category;

      const postResponse = await apiHelper.post('/api/posts', {
        title: 'Post for Discussion',
        content: 'This post is open for comments from other users.',
        categoryId: category.id,
        status: 'published'
      }, { token: user1Data.token });

      const post = postResponse.body.data.post;

      // 用户2对文章进行评论
      const commentResponse = await apiHelper.post(`/api/posts/${post.id}/comments`, {
        content: 'Great post! I learned a lot from it.'
      }, { token: user2Data.token });

      const comment = commentResponse.body.data.comment;

      // 用户1回复评论
      const replyResponse = await apiHelper.post(`/api/posts/${post.id}/comments`, {
        content: 'Thank you for your feedback!',
        parentId: comment.id
      }, { token: user1Data.token });

      const reply = replyResponse.body.data.comment;

      // 验证评论结构
      const commentsListResponse = await apiHelper.get(`/api/posts/${post.id}/comments`);
      apiHelper.expectPaginatedResponse(commentsListResponse, 200);
      
      const comments = commentsListResponse.body.data.items;
      expect(comments).toHaveLength(2);

      // 验证评论的作者
      const originalComment = comments.find(c => c.id === comment.id);
      const replyComment = comments.find(c => c.id === reply.id);

      expect(originalComment.authorId).toBe(user2Data.user.id);
      expect(replyComment.authorId).toBe(user1Data.user.id);
      expect(replyComment.parentId).toBe(comment.id);
    });

    it('should handle content management workflow', async () => {
      const { user, token } = await apiHelper.registerAndLogin();

      // 创建多个分类
      const categories = [];
      for (let i = 1; i <= 3; i++) {
        const categoryResponse = await apiHelper.post('/api/categories', {
          name: `Category ${i}`,
          description: `Description for category ${i}`
        }, { token });
        categories.push(categoryResponse.body.data.category);
      }

      // 创建多篇文章
      const posts = [];
      for (let i = 1; i <= 5; i++) {
        const postResponse = await apiHelper.post('/api/posts', {
          title: `Post ${i}`,
          content: `Content for post ${i}`,
          categoryId: categories[i % categories.length].id,
          status: i % 2 === 0 ? 'draft' : 'published'
        }, { token });
        posts.push(postResponse.body.data.post);
      }

      // 测试文章列表过滤
      const publishedPostsResponse = await apiHelper.get('/api/posts', {
        query: { status: 'published' }
      });
      
      const publishedPosts = publishedPostsResponse.body.data.items;
      expect(publishedPosts.every(post => post.status === 'published')).toBe(true);

      // 测试分页
      const paginatedResponse = await apiHelper.get('/api/posts', {
        query: { page: 1, limit: 2 }
      });
      
      apiHelper.expectPaginatedResponse(paginatedResponse, 200);
      expect(paginatedResponse.body.data.items).toHaveLength(2);
      expect(paginatedResponse.body.data.pagination.page).toBe(1);
      expect(paginatedResponse.body.data.pagination.limit).toBe(2);

      // 测试搜索功能
      const searchResponse = await apiHelper.get('/api/posts', {
        query: { search: 'Post 1' }
      });
      
      const searchResults = searchResponse.body.data.items;
      expect(searchResults.every(post => 
        post.title.includes('Post 1') || post.content.includes('Post 1')
      )).toBe(true);

      // 批量操作：发布所有草稿
      const draftPosts = posts.filter(post => post.status === 'draft');
      for (const post of draftPosts) {
        await apiHelper.put(`/api/posts/${post.id}`, {
          status: 'published'
        }, { token });
      }

      // 验证所有文章都已发布
      const allPostsResponse = await apiHelper.get('/api/posts');
      const allPosts = allPostsResponse.body.data.items;
      expect(allPosts.every(post => post.status === 'published')).toBe(true);
      expect(allPosts).toHaveLength(5);
    });

    it('should handle error scenarios gracefully', async () => {
      const { user, token } = await apiHelper.registerAndLogin();

      // 尝试访问不存在的文章
      const nonExistentPostResponse = await apiHelper.get('/api/posts/99999');
      apiHelper.expectErrorResponse(nonExistentPostResponse, 404);

      // 尝试编辑不属于自己的文章
      const otherUserData = await apiHelper.registerAndLogin({
        username: 'otheruser',
        email: 'other@example.com'
      });

      const postResponse = await apiHelper.post('/api/posts', {
        title: 'Other User Post',
        content: 'This post belongs to another user',
        status: 'published'
      }, { token: otherUserData.token });

      const post = postResponse.body.data.post;

      const unauthorizedEditResponse = await apiHelper.put(`/api/posts/${post.id}`, {
        title: 'Trying to edit others post'
      }, { token });

      apiHelper.expectErrorResponse(unauthorizedEditResponse, 403);

      // 尝试用无效的数据创建文章
      const invalidPostResponse = await apiHelper.post('/api/posts', {
        title: '', // 空标题
        content: 'Content without title'
      }, { token });

      apiHelper.expectErrorResponse(invalidPostResponse, 400);

      // 尝试评论不存在的文章
      const invalidCommentResponse = await apiHelper.post('/api/posts/99999/comments', {
        content: 'Comment on non-existent post'
      }, { token });

      apiHelper.expectErrorResponse(invalidCommentResponse, 404);
    });
  });

  describe('Performance and Load Tests', () => {
    it('should handle concurrent user registrations', async () => {
      const concurrentUsers = 10;
      
      const registrationPromises = Array.from({ length: concurrentUsers }, (_, i) =>
        apiHelper.post('/api/auth/register', {
          username: `concurrent_user_${i}`,
          email: `concurrent_${i}@example.com`,
          password: 'ConcurrentPassword123!'
        })
      );

      const results = await Promise.all(registrationPromises);
      
      // 所有注册都应该成功
      results.forEach(response => {
        apiHelper.expectSuccessResponse(response, 201);
      });

      // 验证所有用户都被创建
      const { User } = testDatabase.getModels();
      const userCount = await User.count();
      expect(userCount).toBe(concurrentUsers);
    });

    it('should maintain reasonable response times', async () => {
      const { user, token } = await apiHelper.registerAndLogin();

      // 测试文章创建的响应时间
      const { response, responseTime } = await apiHelper.measureResponseTime(async () => {
        return await apiHelper.post('/api/posts', {
          title: 'Performance Test Post',
          content: 'Testing response time for post creation',
          status: 'published'
        }, { token });
      });

      apiHelper.expectSuccessResponse(response, 201);
      expect(responseTime).toRespondWithin(1000); // 应该在1秒内完成

      // 测试文章列表的响应时间
      const { response: listResponse, responseTime: listResponseTime } = 
        await apiHelper.measureResponseTime(async () => {
          return await apiHelper.get('/api/posts');
        });

      apiHelper.expectPaginatedResponse(listResponse, 200);
      expect(listResponseTime).toRespondWithin(500); // 应该在500ms内完成
    });

    it('should handle batch operations efficiently', async () => {
      const { user, token } = await apiHelper.registerAndLogin();

      // 创建批量请求
      const batchSize = 5;
      const batchRequests = Array.from({ length: batchSize }, (_, i) =>
        apiHelper.post('/api/posts', {
          title: `Batch Post ${i + 1}`,
          content: `Content for batch post ${i + 1}`,
          status: 'published'
        }, { token })
      );

      const { results, totalTime } = await apiHelper.batchRequests(batchRequests);

      // 验证所有请求都成功
      results.forEach(response => {
        apiHelper.expectSuccessResponse(response, 201);
      });

      // 验证批量操作的总时间是合理的
      expect(totalTime).toRespondWithin(5000); // 批量操作应该在5秒内完成

      // 验证数据库中的记录数
      const postsListResponse = await apiHelper.get('/api/posts');
      expect(postsListResponse.body.data.items).toHaveLength(batchSize);
    });
  });
});