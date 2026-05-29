#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 读取环境变量
require('dotenv').config();

const DB_PROVIDER = process.env.DB_PROVIDER || 'sqlite';
const PRISMA_DIR = path.join(__dirname, '..', 'prisma');

console.log(`🔧 配置数据库: ${DB_PROVIDER}`);

// 数据库配置映射
const dbConfigs = {
  sqlite: {
    schemaFile: 'schema.prisma',
    envVars: {
      DATABASE_URL: process.env.SQLITE_URL || 'file:./dev.db'
    }
  },
  postgresql: {
    schemaFile: 'schema.postgresql.prisma',
    envVars: {
      DATABASE_URL: process.env.POSTGRESQL_URL || process.env.POSTGRES_PRISMA_URL,
      DATABASE_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING
    }
  },
  mysql: {
    schemaFile: 'schema.mysql.prisma',
    envVars: {
      DATABASE_URL: process.env.MYSQL_URL
    }
  }
};

// 验证数据库提供者
if (!dbConfigs[DB_PROVIDER]) {
  console.error(`❌ 不支持的数据库类型: ${DB_PROVIDER}`);
  console.error('支持的类型: sqlite, postgresql, mysql');
  process.exit(1);
}

const config = dbConfigs[DB_PROVIDER];

// 检查必要的环境变量
if (DB_PROVIDER !== 'sqlite') {
  const missingVars = Object.entries(config.envVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error(`❌ 缺少必要的环境变量: ${missingVars.join(', ')}`);
    console.error(`请在 .env 文件中配置这些变量`);
    process.exit(1);
  }
}

// 复制对应的 schema 文件
const sourceSchema = path.join(PRISMA_DIR, config.schemaFile);
const targetSchema = path.join(PRISMA_DIR, 'schema.prisma');

// 如果源文件是 SQLite 默认文件，检查是否已存在
if (config.schemaFile === 'schema.prisma' && fs.existsSync(targetSchema)) {
  console.log('✅ 使用现有的 SQLite schema');
} else if (!fs.existsSync(sourceSchema)) {
  console.error(`❌ Schema 文件不存在: ${sourceSchema}`);
  process.exit(1);
} else if (config.schemaFile !== 'schema.prisma') {
  // 备份当前 schema（如果存在）
  if (fs.existsSync(targetSchema)) {
    const backupPath = path.join(PRISMA_DIR, 'schema.backup.prisma');
    fs.copyFileSync(targetSchema, backupPath);
    console.log(`📋 已备份当前 schema 到 schema.backup.prisma`);
  }

  // 复制新的 schema
  fs.copyFileSync(sourceSchema, targetSchema);
  console.log(`✅ 已切换到 ${DB_PROVIDER} schema`);
}

// 设置环境变量到 .env.local（如果不存在）
const envLocalPath = path.join(__dirname, '..', '.env.local');
const shouldWriteEnvLocal = !process.env.VERCEL && !process.env.CI;
if (!shouldWriteEnvLocal) {
  console.log('ℹ️ CI/Vercel 环境跳过 .env.local 写入');
} else if (!fs.existsSync(envLocalPath)) {
  const envContent = Object.entries(config.envVars)
    .filter(([key, value]) => value)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  fs.writeFileSync(envLocalPath, envContent + '\n');
  console.log('✅ 已创建 .env.local 文件');
}

// 生成 Prisma 客户端
console.log('🔄 生成 Prisma 客户端...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma 客户端生成成功');
} catch (error) {
  console.error('❌ Prisma 客户端生成失败');
  process.exit(1);
}

// 提示下一步操作
console.log('\n📝 下一步操作:');
console.log('1. 运行迁移: npm run db:migrate');
console.log('2. 或推送架构: npm run db:push');
console.log('3. 启动开发: npm run dev');
console.log(`\n当前数据库: ${DB_PROVIDER}`);
