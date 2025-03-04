import { Kysely } from 'kysely';
import { Database } from '../db/schema';
import { createJWTToken } from '../utils/jwt';
import { getRandomNumber } from '../utils/token';

interface PlatformUser {
    id: string;
    email: string;
    name: string;
    image?: string;
}

// 为用户生成JWT
export async function generateJWTForUser(platformUser: PlatformUser, platformId: string, db: Kysely<Database>, secret: string = JWT_SECRET): Promise<string> {
    // 查询用户是否已存在
    const existing = await db
        .selectFrom('user')
        .select(['user_id', 'profile', 'name', 'email'])
        .where('github_id', '=', platformId)
        .executeTakeFirst();

    // 明确指定 tokenPayload 类型
    let tokenPayload: { user_id: number | null; current_plan: any; profile: string; name: string; email: string } = {
        user_id: null,
        current_plan: null,
        profile: '',
        name: '',
        email: '',
    };

    if (existing) {
        tokenPayload.user_id = existing.user_id;
        tokenPayload.profile = existing.profile;
        tokenPayload.name = existing.name;
        tokenPayload.email = existing.email;
        // 从 user_current_plan 表中查询对应的 current_plan 值
        const planRow = await db
            .selectFrom('user_current_plan')
            .select(['current_plan'])
            .where('user_id', '=', existing.user_id)
            .executeTakeFirst();

        if (planRow) {
            tokenPayload.current_plan = planRow.current_plan;
        }
    }
    else {
        // 如果用户不存在，创建新用户
        const newUser = await db
            .insertInto('user')
            // @ts-ignore
            .values({
                github_id: platformId,
                email: platformUser.email,
                name: platformUser.name,
                image: platformUser.image,
                profile: `/assets/profiles/0${getRandomNumber()}.png`,
                create_time: new Date(),
                update_time: new Date()
            })
            .returning(['user_id', 'profile', 'name', 'email'])
            .executeTakeFirst();

        if (newUser) {
            tokenPayload.user_id = newUser.user_id;
            tokenPayload.profile = newUser.profile;
            tokenPayload.name = newUser.name;
            tokenPayload.email = newUser.email;
        }
    }

    // 返回生成的 JWT token
    return createJWTToken(tokenPayload, secret);
} 