import app from '../src/server';
import { handle } from '@hono/node-server/vercel';

// 使用Hono官方的Vercel适配器
export default handle(app); 