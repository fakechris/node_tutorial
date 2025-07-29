// 数据库种子数据管理器
const fs = require('fs').promises;
const path = require('path');
const logger = require('../config/logger');

class DatabaseSeeder {
  constructor(sequelize) {
    this.sequelize = sequelize;
    this.seedersPath = path.join(__dirname, 'seeders');
    this.seederTable = 'SequelizeSeeders';
  }

  // 初始化种子表
  async initializeSeederTable() {
    try {
      await this.sequelize.query(`
        CREATE TABLE IF NOT EXISTS ${this.seederTable} (
          name VARCHAR(255) PRIMARY KEY,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      logger.info('Seeder table initialized');
    } catch (error) {
      logger.error('Failed to initialize seeder table:', error);
      throw error;
    }
  }

  // 获取所有种子文件
  async getSeederFiles() {
    try {
      const files = await fs.readdir(this.seedersPath);
      return files
        .filter(file => file.endsWith('.js'))
        .sort(); // 按文件名排序（确保按编号顺序执行）
    } catch (error) {
      logger.error('Failed to read seeder files:', error);
      throw error;
    }
  }

  // 获取已执行的种子
  async getExecutedSeeders() {
    try {
      const [results] = await this.sequelize.query(
        `SELECT name FROM ${this.seederTable} ORDER BY name`
      );
      return results.map(row => row.name);
    } catch (error) {
      logger.error('Failed to get executed seeders:', error);
      throw error;
    }
  }

  // 获取待执行的种子
  async getPendingSeeders() {
    const allSeeders = await this.getSeederFiles();
    const executedSeeders = await this.getExecutedSeeders();
    
    return allSeeders.filter(seeder => 
      !executedSeeders.includes(seeder)
    );
  }

  // 执行单个种子
  async executeSeeder(seederFile, direction = 'up') {
    try {
      const seederPath = path.join(this.seedersPath, seederFile);
      const seeder = require(seederPath);
      
      logger.info(`Executing seeder ${direction}: ${seederFile}`);
      
      // 开始事务
      const transaction = await this.sequelize.transaction();
      
      try {
        // 执行种子
        if (direction === 'up') {
          await seeder.up(this.sequelize.getQueryInterface());
          
          // 记录到种子表
          await this.sequelize.query(
            `INSERT INTO ${this.seederTable} (name) VALUES (?)`,
            {
              replacements: [seederFile],
              transaction
            }
          );
        } else if (direction === 'down') {
          await seeder.down(this.sequelize.getQueryInterface());
          
          // 从种子表删除记录
          await this.sequelize.query(
            `DELETE FROM ${this.seederTable} WHERE name = ?`,
            {
              replacements: [seederFile],
              transaction
            }
          );
        }
        
        await transaction.commit();
        logger.info(`Seeder ${direction} completed: ${seederFile}`);
        
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
      
    } catch (error) {
      logger.error(`Seeder ${direction} failed: ${seederFile}`, error);
      throw error;
    }
  }

  // 执行所有待执行的种子
  async seedUp() {
    try {
      await this.initializeSeederTable();
      const pendingSeeders = await this.getPendingSeeders();
      
      if (pendingSeeders.length === 0) {
        logger.info('No pending seeders');
        return { executed: [], total: 0 };
      }
      
      logger.info(`Found ${pendingSeeders.length} pending seeders`);
      
      const executed = [];
      for (const seeder of pendingSeeders) {
        await this.executeSeeder(seeder, 'up');
        executed.push(seeder);
      }
      
      logger.info(`Successfully executed ${executed.length} seeders`);
      return { executed, total: executed.length };
      
    } catch (error) {
      logger.error('Seeder up failed:', error);
      throw error;
    }
  }

  // 回滚种子数据
  async seedDown(steps = 1) {
    try {
      const executedSeeders = await this.getExecutedSeeders();
      
      if (executedSeeders.length === 0) {
        logger.info('No executed seeders to rollback');
        return { rolledBack: [], total: 0 };
      }
      
      // 按逆序回滚
      const seedersToRollback = executedSeeders
        .slice(-steps)
        .reverse();
      
      logger.info(`Rolling back ${seedersToRollback.length} seeders`);
      
      const rolledBack = [];
      for (const seeder of seedersToRollback) {
        await this.executeSeeder(seeder, 'down');
        rolledBack.push(seeder);
      }
      
      logger.info(`Successfully rolled back ${rolledBack.length} seeders`);
      return { rolledBack, total: rolledBack.length };
      
    } catch (error) {
      logger.error('Seeder down failed:', error);
      throw error;
    }
  }

  // 获取种子状态
  async getStatus() {
    try {
      await this.initializeSeederTable();
      
      const allSeeders = await this.getSeederFiles();
      const executedSeeders = await this.getExecutedSeeders();
      
      const status = allSeeders.map(seeder => ({
        name: seeder,
        executed: executedSeeders.includes(seeder)
      }));
      
      return {
        total: allSeeders.length,
        executed: executedSeeders.length,
        pending: allSeeders.length - executedSeeders.length,
        seeders: status
      };
      
    } catch (error) {
      logger.error('Failed to get seeder status:', error);
      throw error;
    }
  }

  // 重置所有种子数据
  async reset() {
    try {
      logger.warn('Resetting all seeders - this will remove all seeded data!');
      
      const executedSeeders = await this.getExecutedSeeders();
      
      // 按逆序回滚所有种子
      for (const seeder of executedSeeders.reverse()) {
        await this.executeSeeder(seeder, 'down');
      }
      
      logger.info('All seeders reset successfully');
      return { reset: true, count: executedSeeders.length };
      
    } catch (error) {
      logger.error('Seeder reset failed:', error);
      throw error;
    }
  }

  // 强制重新执行所有种子（先清理再执行）
  async refresh() {
    try {
      logger.info('Refreshing all seeders...');
      
      // 先重置所有种子
      await this.reset();
      
      // 再执行所有种子
      const result = await this.seedUp();
      
      logger.info('All seeders refreshed successfully');
      return result;
      
    } catch (error) {
      logger.error('Seeder refresh failed:', error);
      throw error;
    }
  }
}

module.exports = DatabaseSeeder;