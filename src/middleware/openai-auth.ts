import { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { verifyJWTToken } from '../utils/jwt';
import { checkSubscription } from '../utils/check-subscription';

// OpenAI 接口认证中间件
export async function openaiAuthMiddleware(c: Context, next: () => Promise<void>) {
    // 如果请求体是流,先读取formData
    const contentType = c.req.header('Content-Type') || '';
    if (contentType.includes('multipart/form-data')) {
        await c.req.formData();
    }
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

    if (!decoded?.user_id) {
        return c.json({ success: false, error: '用户未登录' }, 401);
    }

    const has_subscription = await checkSubscription(decoded?.user_id);

    // 将用户信息设置到上下文中
    c.set('user', {...decoded, has_subscription});
    await next();
} 