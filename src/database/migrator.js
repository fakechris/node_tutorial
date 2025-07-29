// 数据库迁移管理器
const fs = require('fs').promises;
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const logger = require('../config/logger');

class DatabaseMigrator {
  constructor(sequelize) {
    this.sequelize = sequelize;
    this.migrationsPath = path.join(__dirname, 'migrations');
    this.migrationTable = 'SequelizeMigrations';
  }

  // 初始化迁移表
  async initializeMigrationTable() {
    try {
      await this.sequelize.query(`
        CREATE TABLE IF NOT EXISTS ${this.migrationTable} (
          name VARCHAR(255) PRIMARY KEY,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      logger.info('Migration table initialized');
    } catch (error) {
      logger.error('Failed to initialize migration table:', error);
      throw error;
    }
  }

  // 获取所有迁移文件
  async getMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files.filter(file => file.endsWith('.js')).sort(); // 按文件名排序（确保按编号顺序执行）
    } catch (error) {
      logger.error('Failed to read migration files:', error);
      throw error;
    }
  }

  // 获取已执行的迁移
  async getExecutedMigrations() {
    try {
      const [results] = await this.sequelize.query(
        `SELECT name FROM ${this.migrationTable} ORDER BY name`
      );
      return results.map(row => row.name);
    } catch (error) {
      logger.error('Failed to get executed migrations:', error);
      throw error;
    }
  }

  // 获取待执行的迁移
  async getPendingMigrations() {
    const allMigrations = await this.getMigrationFiles();
    const executedMigrations = await this.getExecutedMigrations();

    return allMigrations.filter(migration => !executedMigrations.includes(migration));
  }

  // 执行单个迁移
  async executeMigration(migrationFile, direction = 'up') {
    try {
      const migrationPath = path.join(this.migrationsPath, migrationFile);
      const migration = require(migrationPath);

      logger.info(`Executing migration ${direction}: ${migrationFile}`);

      // 开始事务
      const transaction = await this.sequelize.transaction();

      try {
        // 执行迁移
        if (direction === 'up') {
          await migration.up(this.sequelize.getQueryInterface(), DataTypes);

          // 记录到迁移表
          await this.sequelize.query(
            `INSERT INTO ${this.migrationTable} (name) VALUES (?)`,
            {
              replacements: [migrationFile],
              transaction,
            }
          );
        } else if (direction === 'down') {
          await migration.down(this.sequelize.getQueryInterface(), DataTypes);

          // 从迁移表删除记录
          await this.sequelize.query(
            `DELETE FROM ${this.migrationTable} WHERE name = ?`,
            {
              replacements: [migrationFile],
              transaction,
            }
          );
        }

        await transaction.commit();
        logger.info(`Migration ${direction} completed: ${migrationFile}`);
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      logger.error(`Migration ${direction} failed: ${migrationFile}`, error);
      throw error;
    }
  }

  // 执行所有待执行的迁移
  async migrateUp() {
    try {
      await this.initializeMigrationTable();
      const pendingMigrations = await this.getPendingMigrations();

      if (pendingMigrations.length === 0) {
        logger.info('No pending migrations');
        return { executed: [], total: 0 };
      }

      logger.info(`Found ${pendingMigrations.length} pending migrations`);

      const executed = [];
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration, 'up');
        executed.push(migration);
      }

      logger.info(`Successfully executed ${executed.length} migrations`);
      return { executed, total: executed.length };
    } catch (error) {
      logger.error('Migration up failed:', error);
      throw error;
    }
  }

  // 回滚最近的迁移
  async migrateDown(steps = 1) {
    try {
      const executedMigrations = await this.getExecutedMigrations();

      if (executedMigrations.length === 0) {
        logger.info('No executed migrations to rollback');
        return { rolledBack: [], total: 0 };
      }

      // 按逆序回滚
      const migrationsToRollback = executedMigrations.slice(-steps).reverse();

      logger.info(`Rolling back ${migrationsToRollback.length} migrations`);

      const rolledBack = [];
      for (const migration of migrationsToRollback) {
        await this.executeMigration(migration, 'down');
        rolledBack.push(migration);
      }

      logger.info(`Successfully rolled back ${rolledBack.length} migrations`);
      return { rolledBack, total: rolledBack.length };
    } catch (error) {
      logger.error('Migration down failed:', error);
      throw error;
    }
  }

  // 获取迁移状态
  async getStatus() {
    try {
      await this.initializeMigrationTable();

      const allMigrations = await this.getMigrationFiles();
      const executedMigrations = await this.getExecutedMigrations();

      const status = allMigrations.map(migration => ({
        name: migration,
        executed: executedMigrations.includes(migration),
      }));

      return {
        total: allMigrations.length,
        executed: executedMigrations.length,
        pending: allMigrations.length - executedMigrations.length,
        migrations: status,
      };
    } catch (error) {
      logger.error('Failed to get migration status:', error);
      throw error;
    }
  }

  // 重置所有迁移（危险操作）
  async reset() {
    try {
      logger.warn('Resetting all migrations - this will drop all tables!');

      const executedMigrations = await this.getExecutedMigrations();

      // 按逆序回滚所有迁移
      for (const migration of executedMigrations.reverse()) {
        await this.executeMigration(migration, 'down');
      }

      // 删除迁移表
      await this.sequelize.query(`DROP TABLE IF EXISTS ${this.migrationTable}`);

      logger.info('All migrations reset successfully');
      return { reset: true, count: executedMigrations.length };
    } catch (error) {
      logger.error('Migration reset failed:', error);
      throw error;
    }
  }
}

module.exports = DatabaseMigrator;
