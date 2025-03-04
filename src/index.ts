import { Hono } from 'hono';
import { corsMiddleware } from './middleware/cors';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import openaiRoutes from './routes/openai';

// 创建Hono应用
const app = new Hono();

// 应用CORS中间件
app.use('*', corsMiddleware);

// 注册路由
app.route('/auth', authRoutes);
app.route('/api/user', userRoutes);
app.route('/api/openai', openaiRoutes);

export default app;
