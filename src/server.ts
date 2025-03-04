import { serve } from '@hono/node-server';
import app from './index';
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// 设置全局环境变量
globalThis.GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
globalThis.GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
globalThis.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
globalThis.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
globalThis.BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
globalThis.DATABASE_URL = process.env.DATABASE_URL || '';
globalThis.JWT_SECRET = process.env.JWT_SECRET || '';
globalThis.OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// 获取端口，默认为3000
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`🚀 服务器启动在 http://localhost:${PORT}`);

// 启动服务器
serve({
  fetch: app.fetch,
  port: PORT
}); 