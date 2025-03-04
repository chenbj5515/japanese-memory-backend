import { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyJWTToken } from '../utils/jwt';

// 认证中间件
export async function authMiddleware(c: Context, next: () => Promise<void>) {
    const token = getCookie(c, 'session');
    if (!token) {
        return c.json({ success: false, error: '未登录' }, 401);
    }

    try {
        const decoded = verifyJWTToken(token);
        c.set('user', decoded);
        await next();
    } catch (err) {
        return c.json({ success: false, error: '无效的会话' }, 401);
    }
} 