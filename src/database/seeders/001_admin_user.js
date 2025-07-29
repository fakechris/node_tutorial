// 种子数据：管理员用户
const bcrypt = require('bcryptjs');

module.exports = {
  up: async (sequelize) => {
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    await sequelize.bulkInsert('Users', [
      {
        username: 'admin',
        email: 'admin@example.com',
        password: hashedPassword,
        firstName: '系统',
        lastName: '管理员',
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
  },

  down: async (sequelize) => {
    await sequelize.bulkDelete('Users', {
      username: 'admin'
    });
  }
};