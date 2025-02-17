import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AuthorizationCode } from 'simple-oauth2';
// import { serve } from '@hono/node-server';
import 'dotenv/config';
import { setCookie, getCookie } from 'hono/cookie'
import jwt from 'jsonwebtoken';
import { fetchGoogleToken } from './oauth2/google';
import { Kysely } from 'kysely';
import { Pool } from 'pg';
import { PostgresDialect } from 'kysely';
import { fetchGithubToken } from './oauth2/github';

// const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
// const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
// const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
// const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// const BASE_URL = process.env.BASE_URL;
// const DATABASE_URL = process.env.DATABASE_URL;
// const JWT_SECRET = process.env.JWT_SECRET;
// const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 创建 Hono 应用
const app = new Hono();

// chrome-extension://<blaklmjncfkjnjddaaihnojkklnempdj>
// http://localhost:8080
// 配置 CORS，允许来自指定源的跨域请求
app.use('*', cors({
    origin: 'chrome-extension://kfiiheaabjfobkicmpidpgpcamkffeon',
    credentials: true,
}));

// 修改后的 createJWTToken: 接受包含 user_id 和 current_plan 的对象作为参数
function createJWTToken(payload: { user_id: number | null; current_plan: any }, JWT_SECRET: string): string {
    return jwt.sign(
        {
            ...payload,
            exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7天后过期
        },
        JWT_SECRET
    );
}

interface Database {
    // 在此定义你的数据库结构，例如：
    user: {
        user_id: number;
        github_id: string;
        profile: string;
        name: string;
        email: string;
    };
    user_current_plan: {
        user_id: number;
        current_plan: any;
    };
}

// 新函数 generateJWTForUser：只负责生成 JWT，不再创建或更新用户
async function generateJWTForUser(platform_id: string, db: Kysely<Database>, JWT_SECRET: string): Promise<string> {
    // 根据平台的 id 查找用户是否存在（假设平台 id 存在于 github_id 字段中）
    const existing = await db
        .selectFrom('user')
        .select(['user_id', 'profile', 'name', 'email'])
        .where('github_id', '=', platform_id)
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

    // 返回生成的 JWT token
    return createJWTToken(tokenPayload, JWT_SECRET);
}

/** GitHub 登录流程 **/

// 跳转到 GitHub 授权页面
app.get('/auth/github/login', (c) => {
    // 配置 GitHub OAuth2 客户端
    const githubConfig = {
        client: {
            id: GITHUB_CLIENT_ID,
            secret: GITHUB_CLIENT_SECRET,
        },
        auth: {
            tokenHost: 'https://github.com',
            tokenPath: '/login/oauth/access_token',
            authorizePath: '/login/oauth/authorize',
        },
    };

    const githubClient = new AuthorizationCode(githubConfig);

    const redirectUri = `${BASE_URL}/auth/github/callback`;
    const authorizationUri = githubClient.authorizeURL({
        redirect_uri: redirectUri,
        scope: 'read:user user:email',
        state: Math.random().toString(36).substring(2),
    });
    // 返回 JSON 响应而不是重定向
    return c.json({
        success: true,
        authUrl: authorizationUri
    });
});

// GitHub 回调，处理 code 换取 token，然后获取用户信息
app.get('/auth/github/callback', async (c) => {
    const code = c.req.query('code');
    if (!code) {
        return c.json({ success: false, error: 'No code provided' }, 400);
    }
    const redirectUri = `${BASE_URL}/auth/github/callback`;
    try {
        // 使用 fetchGithubToken 替换原有的获取 token 和用户信息的流程
        const { githubUser } = await fetchGithubToken(code, redirectUri);

        // 创建数据库实例
        const db = new Kysely<Database>({
            dialect: new PostgresDialect({
                pool: new Pool({
                    connectionString: DATABASE_URL,
                }),
            }),
        });

        // 根据 GitHub 用户ID生成 JWT
        const jwtToken = await generateJWTForUser(githubUser.id, db, JWT_SECRET);

        // 设置 cookie
        setCookie(c, 'session', jwtToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 7 * 24 * 60 * 60 // 7天
        });
        return c.text('success');
    } catch (err: any) {
        return c.json({ success: false, error: err.message }, 400);
    }
});

/** Google 登录流程 **/

// 跳转到 Google 授权页面
app.get('/auth/google/login', (c) => {
    // 配置 Google OAuth2 客户端
    const googleConfig = {
        client: {
            id: GOOGLE_CLIENT_ID,
            secret: GOOGLE_CLIENT_SECRET,
        },
        auth: {
            tokenHost: 'https://oauth2.googleapis.com',
            tokenPath: '/token',
            authorizeHost: 'https://accounts.google.com',
            authorizePath: '/o/oauth2/v2/auth',
        },
    };

    const googleClient = new AuthorizationCode(googleConfig);

    const redirectUri = `${BASE_URL}/auth/google/callback`;
    const authorizationUri = googleClient.authorizeURL({
        redirect_uri: redirectUri,
        scope: 'openid email profile',
        state: Math.random().toString(36).substring(2),
    });

    // 返回 JSON 响应而不是重定向
    return c.json({
        success: true,
        authUrl: authorizationUri
    });
});

interface GoogleUser {
    sub: string;
    // 根据需要添加其他属性
}

// Google 回调，处理 code 换取 token，然后获取用户信息
app.get('/auth/google/callback', async (c) => {
    const code = c.req.query('code');
    if (!code) {
        return c.json({ success: false, error: 'No code provided' }, 400);
    }
    const redirectUri = `${BASE_URL}/auth/google/callback`;

    try {
        // 直接使用自定义 fetchGoogleToken 方法获取 token
        const tokenResponse = await fetchGoogleToken(code, redirectUri);
        const token = tokenResponse.access_token as string;

        // 使用 token 获取 Google 用户信息
        const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        const googleUser = (await userRes.json()) as GoogleUser;
        const db = new Kysely<Database>({
            dialect: new PostgresDialect({
                pool: new Pool({
                    connectionString: DATABASE_URL,
                }),
            }),
        });

        const jwtToken = await generateJWTForUser(googleUser.sub, db, JWT_SECRET);

        // 设置 Cookie
        setCookie(c, 'session', jwtToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 7 * 24 * 60 * 60 // 7天
        });
        return c.text('success');
    } catch (err: any) {
        return c.json({ success: false, error: err.message }, 400);
    }
});

// 验证时会解析回完整的对象
app.get('/api/user/info', async (c) => {
    const token = getCookie(c, 'session');
    if (!token) {
        return c.json({ success: false, error: '未登录' }, 401);
    }

    try {
        // 解析为完整对象
        const decoded = jwt.verify(token, JWT_SECRET) as {
            userId: number;
            name: string;
            email: string;
            membership: string;
            exp: number;
        };
        return c.json({ success: true, user: decoded });
    } catch (err) {
        return c.json({ success: false, error: '无效的会话' }, 401);
    }
});

// 新增登出接口
app.get('/auth/logout', (c) => {
    // 通过设置 maxAge 为 0 来清除 'session' cookie
    setCookie(c, 'session', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        maxAge: 0
    });
    return c.json({ success: true, message: '已成功登出' });
});

// 新增 OpenAI 处理接口
app.post('/api/openai/extract-subtitles', async (c) => {
    // 验证用户身份
    const token = getCookie(c, 'session');
    if (!token) {
        return c.json({ success: false, error: '未登录' }, 401);
    }

    let decoded: any;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return c.json({ success: false, error: '无效的会话' }, 401);
    }

    if (!decoded.current_plan) {
        return c.json({ success: false, error: '无权限访问此接口' }, 403);
    }

    // 修改为处理 FormData 格式的请求
    const formData = await c.req.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
        return c.json({ success: false, error: '未找到图片文件' }, 400);
    }

    // 将文件转换为 base64
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString('base64');

    const openaiApiKey = OPENAI_API_KEY;
    if (!openaiApiKey) {
        return c.json({ success: false, error: '服务器未配置 OpenAI API Key' }, 400);
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",  // 更正模型名称
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "请只识别并输出图片底部的日文字幕文本，不要输出其他内容。如果没有字幕，请返回空字符串。"
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 100
            })
        });

        const data = await response.json();
        console.log(data);
        // 从响应中提取实际的字幕文本
        const subtitles = data.choices?.[0]?.message?.content || '';
        return c.json({ success: true, subtitles });
    } catch (err: any) {
        return c.json({ success: false, error: err?.message }, 500);
    }
});

// serve({
//     fetch: app.fetch,
//     port: 3000
// }, (info) => {
//     console.log(`SSO API 服务运行在 http://localhost:${info.port}`);
// });

export default app;
