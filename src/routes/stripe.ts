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

        // 处理支付成功事件
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;
            console.log('session=============', session);
            const userId = session.client_reference_id;
            const metadata = session.metadata || {};
            // console.log('userId=============', userId);

            if (!userId) {
                throw new Error('未找到用户ID');
            }

            // 获取价格信息以确定订阅计划
            // const lineItems = await stripeClient.checkout.sessions.listLineItems(session.id);
            // const priceId = lineItems.data[0]?.price?.id;

            // 根据价格ID确定会员计划类型
            // let planType: membership_plan_enum = 'MONTHLY'; // 默认为平台API计划
            // if (priceId === process.env.STRIPE_SELF_API_PRICE_ID) {
            //     planType = 'MONTHLY';
            // }

            // 获取会员计划ID
            // const plan = await prisma.membership_plan.findFirstOrThrow({
            //     where: { name: planType }
            // });

            // 计算订阅结束时间（1个月后）
            const endTime = new Date();
            endTime.setMonth(endTime.getMonth() + 1);

            // 更新用户订阅信息
            await prisma.user_subscription.create({
                data: {
                    user_id: userId,
                    // membership_plan_id: plan.id,
                    start_time: new Date(),
                    end_time: endTime,
                    active: true,
                    openai_api_key: metadata.openai_api_key
                }
            });

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