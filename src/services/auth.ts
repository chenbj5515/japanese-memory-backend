import { PrismaClient } from '@prisma/client';
import { createJWTToken } from '../utils/jwt';
import { getRandomNumber } from '../utils/token';

interface PlatformUser {
    id: string;
    email: string;
    name: string;
    image?: string;
}

interface JWTPayload {
    user_id: string;
    has_subscription: boolean;
    profile: string;
    name: string;
    email: string;
}

// 为用户生成JWT
export async function generateJWTForUser(platformUser: PlatformUser, platformId: string, prisma: PrismaClient, secret: string = JWT_SECRET): Promise<string> {
    // 查询用户是否已存在
    const existing = await prisma.user.findFirst({
        where: {
            github_id: platformId.toString()
        },
        select: {
            user_id: true,
            profile: true,
            name: true,
            email: true
        }
    });

    // 明确指定 tokenPayload 类型
    let tokenPayload: JWTPayload = {
        user_id: '',
        has_subscription: false,
        profile: '',
        name: '',
        email: '',
    };

    if (existing) {
        tokenPayload.user_id = existing.user_id;
        tokenPayload.profile = existing.profile || '';
        tokenPayload.name = existing.name || '';
        tokenPayload.email = existing.email;

        // 检查用户是否有有效的订阅
        const subscription = await prisma.user_subscription.findFirst({
            where: {
                user_id: existing.user_id,
                active: true,
                end_time: {
                    gt: new Date() // 确保订阅未过期
                }
            }
        });

        tokenPayload.has_subscription = !!subscription;
    } else {
        // 如果用户不存在，创建新用户
        const newUser = await prisma.user.create({
            data: {
                github_id: platformId,
                email: platformUser.email,
                name: platformUser.name,
                image: platformUser.image,
                profile: `/assets/profiles/0${getRandomNumber()}.png`,
                create_time: new Date(),
                update_time: new Date()
            },
            select: {
                user_id: true,
                profile: true,
                name: true,
                email: true
            }
        });

        tokenPayload.user_id = newUser.user_id;
        tokenPayload.profile = newUser.profile || '';
        tokenPayload.name = newUser.name || '';
        tokenPayload.email = newUser.email;
        tokenPayload.has_subscription = false; // 新用户默认没有订阅
    }

    // 返回生成的 JWT token
    return createJWTToken(tokenPayload, secret);
} 