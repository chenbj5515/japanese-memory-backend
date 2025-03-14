import { Hono } from 'hono';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { getCookie } from 'hono/cookie';
import { User, verifyJWTToken } from '../utils/jwt';
import { JWTPayload } from 'hono/utils/jwt/types';

interface CustomJWTPayload extends JWTPayload {
    user_id: string;
    email: string;
}

const stripe = new Hono();
const prisma = new PrismaClient();

// 创建 Stripe 客户端实例
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-02-24.acacia',
});

// 语言映射函数
function mapLocaleToStripe(locale: string): 'en' | 'zh' | 'ja' {
    const localeMap: { [key: string]: 'en' | 'zh' | 'ja' } = {
        'en': 'en',
        'zh': 'zh',
        'ja': 'ja',
        // 可以根据需要添加更多语言映射
    };
    return localeMap[locale] || 'en';
}

// Stripe webhook 处理路由
stripe.post('/webhook', async (c) => {
    const signature = c.req.header('stripe-signature');
    
    if (!signature) {
        return c.json({ success: false, error: '缺少 Stripe 签名' }, 400);
    }

    const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

    if (!STRIPE_WEBHOOK_SECRET) {
        return c.json({ success: false, error: '未配置 Stripe Webhook Secret' }, 500);
    }

    try {
        const rawBody = await c.req.raw.text();
        const event = stripeClient.webhooks.constructEvent(
            rawBody,
            signature,
            STRIPE_WEBHOOK_SECRET
        );

        console.log('event=============', event.type);

        // 处理发票支付成功事件
        if (event.type === 'invoice.payment_succeeded') {
            const invoice = event.data.object as Stripe.Invoice;
            
            console.log('invoice=============', invoice);
            // 获取关联的 checkout session
            const session = await stripeClient.checkout.sessions.list({
                payment_intent: invoice.payment_intent as string,
                limit: 1,
            });

            if (!session.data.length) {
                throw new Error('未找到关联的 Checkout Session');
            }

            console.log('session data=============', session.data[0]);
            const userId = session.data[0].client_reference_id;

            if (!userId) {
                throw new Error('未找到用户ID');
            }

            // console.log('userId from checkout session=============', userId);

            // 计算订阅时间
            const startTime = new Date();
            const endTime = new Date(startTime);
            endTime.setMonth(endTime.getMonth() + 1);

            // 查找现有订阅
            const existingSubscription = await prisma.user_subscription.findFirst({
                where: { user_id: userId }
            });

            if (existingSubscription) {
                // 更新现有订阅
                await prisma.user_subscription.update({
                    where: { id: existingSubscription.id },
                    data: {
                        start_time: startTime,
                        end_time: endTime,
                        active: true
                    }
                });
            } else {
                // 创建新订阅
                await prisma.user_subscription.create({
                    data: {
                        user_id: userId,
                        start_time: startTime,
                        end_time: endTime,
                        active: true
                    }
                });
            }

            return c.json({ success: true });
        }

        return c.json({ success: true });
    } catch (err: any) {
        console.error('Stripe webhook 处理错误:', err);
        return c.json({ 
            success: false, 
            error: err?.message || 'Stripe webhook 处理失败' 
        }, 400);
    }
});

// 创建订阅管理门户会话
stripe.post('/portal', async (c) => {
    try {
        const { locale = 'en' } = await c.req.json();
        const token = getCookie(c, 'session');
        if (!token) {
            return c.json({ success: false, error: '未登录' }, 401);
        }
    
        let user: User;
        try {
            const tokenData = verifyJWTToken(token);
            if (!tokenData || typeof tokenData.user_id !== 'string' || typeof tokenData.email !== 'string') {
                throw new Error('Invalid token data');
            }
            user = tokenData;
        } catch (err) {
            return c.json({ success: false, error: '无效的会话' }, 401);
        }
    
        if (!user?.user_id) {
            return c.json({ success: false, error: '用户未登录' }, 401);
        }

        // 获取用户的 Stripe 客户 ID
        const customer = await stripeClient.customers.list({
            email: user.email,
            limit: 1
        });

        if (!customer.data.length) {
            return c.json({ success: false, error: '未找到 Stripe 客户' }, 404);
        }

        // 创建一个新的门户会话
        const portalSession = await stripeClient.billingPortal.sessions.create({
            customer: customer.data[0].id,
            return_url: `${process.env.NEXT_PUBLIC_BASE_URL}`,
            locale: mapLocaleToStripe(locale),
        });

        return c.json({ 
            success: true, 
            url: portalSession.url 
        });
    } catch (error: any) {
        console.error('创建门户会话失败:', error);
        return c.json({ 
            success: false, 
            error: error?.message || '创建门户会话失败' 
        }, 500);
    }
});

export default stripe;