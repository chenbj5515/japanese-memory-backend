import { cors } from 'hono/cors';

// console.log('当前环境变量:', process.env);
// console.log('NODE_ENV:', process.env.NODE_ENV);

// CORS中间件
export const corsMiddleware = cors({
    origin: [
        'chrome-extension://lmepenbgdgfihjehjnanphnfhobclghl',
        ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
        'https://www.bunn.ink'
    ],
    credentials: true,
})