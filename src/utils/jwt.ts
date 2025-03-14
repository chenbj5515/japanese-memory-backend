import { JWTPayload } from 'hono/utils/jwt/types';
import jwt from 'jsonwebtoken';

export interface User {
    user_id: string;
    has_subscription: boolean;
    profile: string;
    name: string;
    email: string;
}

// 创建JWT令牌
export function createJWTToken(payload: User, secret: string = JWT_SECRET): string {
    return jwt.sign(
        {
            ...payload,
            exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7天后过期
        },
        secret
    );
}

// 验证JWT令牌
export function verifyJWTToken(token: string, secret: string = JWT_SECRET): User & { exp: number } {
    return jwt.verify(token, secret) as User & { exp: number };
}