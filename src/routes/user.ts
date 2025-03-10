import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { verifyJWTToken } from '../utils/jwt';

const user = new Hono();

// 用户信息路由
user.get('/info', async (c) => {
    const token = getCookie(c, 'session');
    if (!token) {
        return c.json({ success: false, error: '未登录' }, 401);
    }

    try {
        // 解析为完整对象
        const decoded = verifyJWTToken(token) as {
            user_id: string;
            name: string;
            email: string;
            profile: string;
            current_plan: boolean;
            exp: number;
        };
        return c.json({ success: true, user: decoded });
    } catch (err) {
        return c.json({ success: false, error: '无效的会话' }, 401);
    }
});

// 登出路由
user.get('/logout', (c) => {
    // 通过设置 maxAge 为 0 来清除 'session' cookie
    setCookie(c, 'session', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        maxAge: 0
    });
    return c.json({ success: true, message: '已成功登出' });
});

export default user; 