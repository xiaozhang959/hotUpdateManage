#!/usr/bin/env node

const { execSync } = require('child_process')

function requireEnv(name) {
  if (!process.env[name]?.trim()) {
    console.error(`❌ Vercel 部署缺少必要环境变量: ${name}`)
    process.exit(1)
  }
}

function defaultEnv(name, value) {
  if (!process.env[name]?.trim()) {
    process.env[name] = value
  }
}

function run(command) {
  console.log(`\n▶ ${command}`)
  execSync(command, { stdio: 'inherit', env: process.env })
}

requireEnv('DATABASE_URL')
requireEnv('AUTH_SECRET')
requireEnv('HOT_UPDATE_BOOTSTRAP_TOKEN')

defaultEnv('DB_PROVIDER', 'postgresql')
defaultEnv('NEXTAUTH_SECRET', process.env.AUTH_SECRET)
defaultEnv('POSTGRESQL_URL', process.env.DATABASE_URL)
defaultEnv('POSTGRES_PRISMA_URL', process.env.DATABASE_URL)
defaultEnv('DATABASE_URL_NON_POOLING', process.env.DATABASE_URL)
defaultEnv('POSTGRES_URL_NON_POOLING', process.env.DATABASE_URL_NON_POOLING)
defaultEnv('TZ', 'Asia/Shanghai')
defaultEnv('NEXT_PUBLIC_TZ', process.env.TZ)
defaultEnv('NEXT_PUBLIC_UPLOAD_CHUNK_THRESHOLD_MB', '60')
defaultEnv('NEXT_PUBLIC_UPLOAD_RESUME_TTL_HOURS', '72')
defaultEnv('UPLOAD_SESSION_TTL_HOURS', '72')

run('node scripts/setup-db.js')
run('npx prisma db push --skip-generate')
run('next build')
