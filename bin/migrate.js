#!/usr/bin/env node

// 数据库迁移命令行工具
const { Command } = require('commander');
const { initializeConfig } = require('../src/config/environment');
const DatabaseMigrator = require('../src/database/migrator');
const DatabaseSeeder = require('../src/database/seeder');
const { Sequelize } = require('sequelize');

const program = new Command();

// 初始化数据库连接
let sequelize;

async function initDatabase() {
  try {
    const config = initializeConfig();
    
    if (config.isDevelopment || config.isTest) {
      sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: config.database.storage || './database/tutorial.db',
        logging: config.isDevelopment ? console.log : false
      });
    } else {
      // 生产环境数据库配置
      sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres', // 或其他数据库
        logging: false
      });
    }
    
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    return sequelize;
    
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    process.exit(1);
  }
}

// 关闭数据库连接
async function closeDatabase() {
  if (sequelize) {
    await sequelize.close();
  }
}

// 迁移命令
program
  .command('migrate:up')
  .description('Run pending migrations')
  .action(async () => {
    try {
      const db = await initDatabase();
      const migrator = new DatabaseMigrator(db);
      
      console.log('🚀 Running migrations...');
      const result = await migrator.migrateUp();
      
      if (result.total === 0) {
        console.log('📋 No pending migrations found.');
      } else {
        console.log(`✅ Successfully executed ${result.total} migrations:`);
        result.executed.forEach(migration => {
          console.log(`  - ${migration}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  });

program
  .command('migrate:down')
  .description('Rollback migrations')
  .option('-s, --steps <number>', 'Number of migrations to rollback', '1')
  .action(async (options) => {
    try {
      const db = await initDatabase();
      const migrator = new DatabaseMigrator(db);
      const steps = parseInt(options.steps);
      
      console.log(`🔄 Rolling back ${steps} migration(s)...`);
      const result = await migrator.migrateDown(steps);
      
      if (result.total === 0) {
        console.log('📋 No migrations to rollback.');
      } else {
        console.log(`✅ Successfully rolled back ${result.total} migrations:`);
        result.rolledBack.forEach(migration => {
          console.log(`  - ${migration}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Migration rollback failed:', error.message);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  });

program
  .command('migrate:status')
  .description('Show migration status')
  .action(async () => {
    try {
      const db = await initDatabase();
      const migrator = new DatabaseMigrator(db);
      
      const status = await migrator.getStatus();
      
      console.log('📊 Migration Status:');
      console.log(`  Total: ${status.total}`);
      console.log(`  Executed: ${status.executed}`);
      console.log(`  Pending: ${status.pending}`);
      console.log('');
      
      if (status.migrations.length > 0) {
        console.log('Migration files:');
        status.migrations.forEach(migration => {
          const icon = migration.executed ? '✅' : '⏳';
          const state = migration.executed ? 'executed' : 'pending';
          console.log(`  ${icon} ${migration.name} (${state})`);
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to get migration status:', error.message);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  });

program
  .command('migrate:reset')
  .description('Reset all migrations (DANGEROUS)')
  .option('--force', 'Force reset without confirmation')
  .action(async (options) => {
    try {
      if (!options.force) {
        console.log('⚠️  WARNING: This will drop all tables and data!');
        console.log('Use --force flag to confirm this action.');
        process.exit(1);
      }
      
      const db = await initDatabase();
      const migrator = new DatabaseMigrator(db);
      
      console.log('🔄 Resetting all migrations...');
      const result = await migrator.reset();
      
      console.log(`✅ Successfully reset ${result.count} migrations.`);
      
    } catch (error) {
      console.error('❌ Migration reset failed:', error.message);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  });

// 种子数据命令
program
  .command('seed:up')
  .description('Run pending seeders')
  .action(async () => {
    try {
      const db = await initDatabase();
      const seeder = new DatabaseSeeder(db);
      
      console.log('🌱 Running seeders...');
      const result = await seeder.seedUp();
      
      if (result.total === 0) {
        console.log('📋 No pending seeders found.');
      } else {
        console.log(`✅ Successfully executed ${result.total} seeders:`);
        result.executed.forEach(seederFile => {
          console.log(`  - ${seederFile}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Seeding failed:', error.message);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  });

program
  .command('seed:down')
  .description('Rollback seeders')
  .option('-s, --steps <number>', 'Number of seeders to rollback', '1')
  .action(async (options) => {
    try {
      const db = await initDatabase();
      const seeder = new DatabaseSeeder(db);
      const steps = parseInt(options.steps);
      
      console.log(`🔄 Rolling back ${steps} seeder(s)...`);
      const result = await seeder.seedDown(steps);
      
      if (result.total === 0) {
        console.log('📋 No seeders to rollback.');
      } else {
        console.log(`✅ Successfully rolled back ${result.total} seeders:`);
        result.rolledBack.forEach(seederFile => {
          console.log(`  - ${seederFile}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Seeder rollback failed:', error.message);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  });

program
  .command('seed:status')
  .description('Show seeder status')
  .action(async () => {
    try {
      const db = await initDatabase();
      const seeder = new DatabaseSeeder(db);
      
      const status = await seeder.getStatus();
      
      console.log('📊 Seeder Status:');
      console.log(`  Total: ${status.total}`);
      console.log(`  Executed: ${status.executed}`);
      console.log(`  Pending: ${status.pending}`);
      console.log('');
      
      if (status.seeders.length > 0) {
        console.log('Seeder files:');
        status.seeders.forEach(seederFile => {
          const icon = seederFile.executed ? '✅' : '⏳';
          const state = seederFile.executed ? 'executed' : 'pending';
          console.log(`  ${icon} ${seederFile.name} (${state})`);
        });
      }
      
    } catch (error) {
      console.error('❌ Failed to get seeder status:', error.message);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  });

program
  .command('seed:refresh')
  .description('Reset and re-run all seeders')
  .option('--force', 'Force refresh without confirmation')
  .action(async (options) => {
    try {
      if (!options.force) {
        console.log('⚠️  WARNING: This will remove all seeded data and re-seed!');
        console.log('Use --force flag to confirm this action.');
        process.exit(1);
      }
      
      const db = await initDatabase();
      const seeder = new DatabaseSeeder(db);
      
      console.log('🔄 Refreshing all seeders...');
      const result = await seeder.refresh();
      
      console.log(`✅ Successfully refreshed ${result.total} seeders.`);
      
    } catch (error) {
      console.error('❌ Seeder refresh failed:', error.message);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  });

// 组合命令
program
  .command('db:setup')
  .description('Setup database (run migrations and seeders)')
  .action(async () => {
    try {
      const db = await initDatabase();
      const migrator = new DatabaseMigrator(db);
      const seeder = new DatabaseSeeder(db);
      
      console.log('🏗️  Setting up database...');
      
      // 运行迁移
      console.log('📊 Running migrations...');
      const migrationResult = await migrator.migrateUp();
      if (migrationResult.total > 0) {
        console.log(`✅ Executed ${migrationResult.total} migrations.`);
      }
      
      // 运行种子数据
      console.log('🌱 Running seeders...');
      const seederResult = await seeder.seedUp();
      if (seederResult.total > 0) {
        console.log(`✅ Executed ${seederResult.total} seeders.`);
      }
      
      console.log('🎉 Database setup completed successfully!');
      
    } catch (error) {
      console.error('❌ Database setup failed:', error.message);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  });

program
  .command('db:reset')
  .description('Reset database (drop all and re-setup)')
  .option('--force', 'Force reset without confirmation')
  .action(async (options) => {
    try {
      if (!options.force) {
        console.log('⚠️  WARNING: This will completely reset the database!');
        console.log('Use --force flag to confirm this action.');
        process.exit(1);
      }
      
      const db = await initDatabase();
      const migrator = new DatabaseMigrator(db);
      const seeder = new DatabaseSeeder(db);
      
      console.log('🔄 Resetting database...');
      
      // 重置种子数据
      try {
        await seeder.reset();
        console.log('✅ Seeders reset.');
      } catch (error) {
        console.log('ℹ️  No seeders to reset.');
      }
      
      // 重置迁移
      await migrator.reset();
      console.log('✅ Migrations reset.');
      
      // 重新设置数据库
      console.log('🏗️  Re-setting up database...');
      await migrator.migrateUp();
      await seeder.seedUp();
      
      console.log('🎉 Database reset completed successfully!');
      
    } catch (error) {
      console.error('❌ Database reset failed:', error.message);
      process.exit(1);
    } finally {
      await closeDatabase();
    }
  });

// 处理程序退出
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, closing database connection...');
  await closeDatabase();
  process.exit(0);
});

program.parse(process.argv);

// 如果没有提供命令，显示帮助
if (!process.argv.slice(2).length) {
  program.outputHelp();
}