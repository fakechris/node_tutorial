// 种子数据：示例用户
const bcrypt = require('bcryptjs');

module.exports = {
  up: async sequelize => {
    const users = [
      {
        username: 'johndoe',
        email: 'john@example.com',
        password: await bcrypt.hash('password123', 10),
        firstName: 'John',
        lastName: 'Doe',
        role: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        username: 'janedoe',
        email: 'jane@example.com',
        password: await bcrypt.hash('password123', 10),
        firstName: 'Jane',
        lastName: 'Doe',
        role: 'moderator',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        username: 'bobsmith',
        email: 'bob@example.com',
        password: await bcrypt.hash('password123', 10),
        firstName: 'Bob',
        lastName: 'Smith',
        role: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        username: 'alicejohnson',
        email: 'alice@example.com',
        password: await bcrypt.hash('password123', 10),
        firstName: 'Alice',
        lastName: 'Johnson',
        role: 'user',
        isActive: false, // 非活跃用户
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await sequelize.bulkInsert('Users', users);
  },

  down: async sequelize => {
    await sequelize.bulkDelete('Users', {
      username: ['johndoe', 'janedoe', 'bobsmith', 'alicejohnson'],
    });
  },
};
