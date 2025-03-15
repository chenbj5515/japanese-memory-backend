import { cors } from 'hono/cors';

// CORS中间件
export const corsMiddleware = cors({
    origin: [
        'chrome-extension://lmepenbgdgfihjehjnanphnfhobclghl',
        ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
        'https://www.bunn.ink'
    ],
    credentials: true,
}); 