import { Hono } from 'hono';
import { corsMiddleware } from './middleware/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import openaiRoutes from './routes/openai';

// 创建Hono应用
const app = new Hono();

// 应用中间件
app.use('*', corsMiddleware);
app.use('*', logger());
app.use('*', prettyJSON());

// 注册路由
app.route('/auth', authRoutes);
app.route('/api/user', userRoutes);
app.route('/api/openai', openaiRoutes);

// 添加健康检查端点
app.get('/', (c) => c.json({ status: 'ok', message: 'API 服务正常运行' }));

export default app;
