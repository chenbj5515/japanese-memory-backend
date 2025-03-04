import { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyJWTToken } from '../utils/jwt';

// OpenAI 接口认证中间件
export async function openaiAuthMiddleware(c: Context, next: () => Promise<void>) {
    // 验证用户身份
    const token = getCookie(c, 'session');
    if (!token) {
        return c.json({ success: false, error: '未登录' }, 401);
    }

    let decoded: any;
    try {
        decoded = verifyJWTToken(token);
    } catch (err) {
        return c.json({ success: false, error: '无效的会话' }, 401);
    }

    // 检查用户是否有权限访问 OpenAI 接口
    if (!decoded.current_plan) {
        return c.json({ success: false, error: '无权限访问此接口' }, 403);
    }

    // 将用户信息设置到上下文中
    c.set('user', decoded);
    await next();
} 