import { cors } from 'hono/cors';

// CORS中间件
export const corsMiddleware = cors({
    origin: 'chrome-extension://lmepenbgdgfihjehjnanphnfhobclghl',
    credentials: true,
}); 