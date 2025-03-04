import jwt from 'jsonwebtoken';

// 创建JWT令牌
export function createJWTToken(payload: { user_id: number | null; current_plan: any }, secret: string = JWT_SECRET): string {
    return jwt.sign(
        {
            ...payload,
            exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7天后过期
        },
        secret
    );
}

// 验证JWT令牌
export function verifyJWTToken(token: string, secret: string = JWT_SECRET): any {
    return jwt.verify(token, secret);
}