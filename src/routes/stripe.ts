import { Hono } from 'hono';
import { membership_plan_enum, PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const stripe = new Hono();
const prisma = new PrismaClient();

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

    const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-02-24.acacia',
    });

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

export default stripe; 