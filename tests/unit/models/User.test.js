// 用户模型单元测试
const testDatabase = require('../../helpers/testDatabase');

describe('User Model', () => {
  beforeAll(async () => {
    await testDatabase.initialize();
  });

  beforeEach(async () => {
    await testDatabase.cleanup();
  });

  afterAll(async () => {
    await testDatabase.close();
  });

  describe('User Creation', () => {
    it('should create a user with valid data', async () => {
      const { User } = testDatabase.getModels();
      
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      const user = await User.create(userData);

      expect(user.id).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.password).not.toBe(userData.password); // 应该被哈希
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    it('should hash password before saving', async () => {
      const { User } = testDatabase.getModels();
      
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'PlainTextPassword'
      };

      const user = await User.create(userData);

      expect(user.password).not.toBe(userData.password);
      expect(user.password).toMatch(/^\$2[ayb]\$[0-9]{2}\$/); // bcrypt 格式
    });

    it('should validate password correctly', async () => {
      const { User } = testDatabase.getModels();
      
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      const user = await User.create(userData);
      
      // 测试正确密码
      const isValidCorrect = await user.validatePassword('TestPassword123!');
      expect(isValidCorrect).toBe(true);
      
      // 测试错误密码
      const isValidWrong = await user.validatePassword('WrongPassword');
      expect(isValidWrong).toBe(false);
    });

    it('should require username', async () => {
      const { User } = testDatabase.getModels();
      
      const userData = {
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should require email', async () => {
      const { User } = testDatabase.getModels();
      
      const userData = {
        username: 'testuser',
        password: 'TestPassword123!'
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should require password', async () => {
      const { User } = testDatabase.getModels();
      
      const userData = {
        username: 'testuser',
        email: 'test@example.com'
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should enforce unique username', async () => {
      const { User } = testDatabase.getModels();
      
      const userData1 = {
        username: 'testuser',
        email: 'test1@example.com',
        password: 'TestPassword123!'
      };

      const userData2 = {
        username: 'testuser', // 重复的用户名
        email: 'test2@example.com',
        password: 'TestPassword123!'
      };

      await User.create(userData1);
      await expect(User.create(userData2)).rejects.toThrow();
    });

    it('should enforce unique email', async () => {
      const { User } = testDatabase.getModels();
      
      const userData1 = {
        username: 'testuser1',
        email: 'test@example.com',
        password: 'TestPassword123!'
      };

      const userData2 = {
        username: 'testuser2',
        email: 'test@example.com', // 重复的邮箱
        password: 'TestPassword123!'
      };

      await User.create(userData1);
      await expect(User.create(userData2)).rejects.toThrow();
    });

    it('should validate email format', async () => {
      const { User } = testDatabase.getModels();
      
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'TestPassword123!'
      };

      await expect(User.create(userData)).rejects.toThrow();
    });

    it('should validate password strength', async () => {
      const { User } = testDatabase.getModels();
      
      // 密码太短
      const weakPasswordData = {
        username: 'testuser',
        email: 'test@example.com',
        password: '123'
      };

      await expect(User.create(weakPasswordData)).rejects.toThrow();
    });
  });

  describe('User Instance Methods', () => {
    let user;

    beforeEach(async () => {
      user = await testDatabase.createTestUser();
    });

    it('should return user profile without sensitive data', async () => {
      const profile = user.getProfile();

      expect(profile).toHaveProperty('id');
      expect(profile).toHaveProperty('username');
      expect(profile).toHaveProperty('email');
      expect(profile).toHaveProperty('createdAt');
      expect(profile).toHaveProperty('updatedAt');
      
      // 敏感数据不应该包含在内
      expect(profile).not.toHaveProperty('password');
      expect(profile).not.toHaveProperty('passwordHash');
    });

    it('should update user profile', async () => {
      const updateData = {
        bio: 'Updated bio',
        firstName: 'John',
        lastName: 'Doe'
      };

      await user.updateProfile(updateData);
      await user.reload();

      expect(user.bio).toBe(updateData.bio);
      expect(user.firstName).toBe(updateData.firstName);
      expect(user.lastName).toBe(updateData.lastName);
    });

    it('should not allow updating sensitive fields via updateProfile', async () => {
      const { User } = testDatabase.getModels();
      
      // 获取包含密码的用户实例以便比较
      const userWithPassword = await User.scope('withPassword').findByPk(user.id);
      const originalPassword = userWithPassword.password;
      const originalEmail = user.email;

      const updateData = {
        password: 'NewPassword123!',
        email: 'newemail@example.com',
        id: 999
      };

      await user.updateProfile(updateData);
      
      // 重新加载包含密码的用户以验证密码未被更改
      await userWithPassword.reload();
      await user.reload();

      expect(userWithPassword.password).toBe(originalPassword);
      expect(user.email).toBe(originalEmail);
      expect(user.id).not.toBe(999);
    });
  });

  describe('User Static Methods', () => {
    it('should find user by username', async () => {
      const { User } = testDatabase.getModels();
      const testUser = await testDatabase.createTestUser({
        username: 'findme'
      });

      const foundUser = await User.findByUsername('findme');

      expect(foundUser).toBeDefined();
      expect(foundUser.id).toBe(testUser.id);
      expect(foundUser.username).toBe('findme');
    });

    it('should find user by email', async () => {
      const { User } = testDatabase.getModels();
      const testUser = await testDatabase.createTestUser({
        email: 'findme@example.com'
      });

      const foundUser = await User.findByEmail('findme@example.com');

      expect(foundUser).toBeDefined();
      expect(foundUser.id).toBe(testUser.id);
      expect(foundUser.email).toBe('findme@example.com');
    });

    it('should return null for non-existent username', async () => {
      const { User } = testDatabase.getModels();

      const foundUser = await User.findByUsername('nonexistent');

      expect(foundUser).toBeNull();
    });

    it('should return null for non-existent email', async () => {
      const { User } = testDatabase.getModels();

      const foundUser = await User.findByEmail('nonexistent@example.com');

      expect(foundUser).toBeNull();
    });
  });

  describe('User Associations', () => {
    let user, category;

    beforeEach(async () => {
      user = await testDatabase.createTestUser();
      category = await testDatabase.createTestCategory();
    });

    it('should have posts association', async () => {
      const { Post } = testDatabase.getModels();
      
      // 创建文章
      const post = await Post.create({
        title: 'Test Post',
        content: 'Test content',
        authorId: user.id,
        categoryId: category.id,
        status: 'published'
      });

      // 获取用户的文章
      const userPosts = await user.getPosts();

      expect(userPosts).toHaveLength(1);
      expect(userPosts[0].id).toBe(post.id);
      expect(userPosts[0].title).toBe('Test Post');
    });

    it('should have comments association', async () => {
      const { Post, Comment } = testDatabase.getModels();
      
      // 创建文章和评论
      const post = await Post.create({
        title: 'Test Post',
        content: 'Test content',
        authorId: user.id,
        categoryId: category.id,
        status: 'published'
      });

      const comment = await Comment.create({
        content: 'Test comment',
        authorId: user.id,
        postId: post.id
      });

      // 获取用户的评论
      const userComments = await user.getComments();

      expect(userComments).toHaveLength(1);
      expect(userComments[0].id).toBe(comment.id);
      expect(userComments[0].content).toBe('Test comment');
    });
  });

  describe('User Scopes', () => {
    beforeEach(async () => {
      // 创建多个测试用户
      await testDatabase.createTestUser({ username: 'active1', isActive: true });
      await testDatabase.createTestUser({ username: 'active2', isActive: true });
      await testDatabase.createTestUser({ username: 'inactive1', isActive: false });
    });

    it('should find only active users', async () => {
      const { User } = testDatabase.getModels();

      const activeUsers = await User.scope('active').findAll();

      expect(activeUsers).toHaveLength(2);
      activeUsers.forEach(user => {
        expect(user.isActive).toBe(true);
      });
    });

    it('should exclude password in default scope', async () => {
      const { User } = testDatabase.getModels();

      const users = await User.findAll();

      users.forEach(user => {
        expect(user.dataValues).not.toHaveProperty('password');
      });
    });
  });
});