import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { verifyJWTToken } from '../utils/jwt';
import { checkSubscription } from '../utils/check-subscription';
import { prisma } from '../services/prisma';
import { action_type_enum } from '@prisma/client';

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
            has_subscription: boolean;
            exp: number;
        };

        // 获取今天的开始时间
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 并行执行所有查询
        const [has_subscription, ocrCount, translationCount] = await Promise.all([
            checkSubscription(decoded.user_id),
            prisma.user_action_logs.count({
                where: {
                    user_id: decoded.user_id,
                    action_type: action_type_enum.COMPLETE_IMAGE_OCR,
                    create_time: {
                        gte: today
                    }
                }
            }),
            prisma.user_action_logs.count({
                where: {
                    user_id: decoded.user_id,
                    action_type: action_type_enum.COMPLETE_TEXT_TRANSLATION_BY_EXTENSION,
                    create_time: {
                        gte: today
                    }
                }
            })
        ]);

        return c.json({ 
            success: true, 
            user: {
                ...decoded,
                has_subscription,
                today_ocr_count: ocrCount,
                today_translation_count: translationCount
            } 
        });
    } catch (err) {
        console.error(err);
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