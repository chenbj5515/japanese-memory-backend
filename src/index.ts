import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AuthorizationCode } from 'simple-oauth2';
// import { serve } from '@hono/node-server';
import 'dotenv/config';
import { setCookie, getCookie } from 'hono/cookie'
import jwt from 'jsonwebtoken';

// 创建 Hono 应用
const app = new Hono();

// chrome-extension://<blaklmjncfkjnjddaaihnojkklnempdj>
// http://localhost:8080
// 配置 CORS，允许来自指定源的跨域请求
app.use('*', cors({
    origin: 'chrome-extension://<blaklmjncfkjnjddaaihnojkklnempdj>',
    credentials: true,
}));

// 修改后的 createJWTToken: 接受包含 user_id 和 current_plan 的对象作为参数
function createJWTToken(payload: { user_id: number | null; current_plan: any }): string {
    return jwt.sign(
        {
            ...payload,
            exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7天后过期
        },
        JWT_SECRET
    );
}

// 新函数 generateJWTForUser：只负责生成 JWT，不再创建或更新用户
async function generateJWTForUser(platform_id: string): Promise<string> {
    // 根据平台的 id 查找用户是否存在（假设平台 id 存在于 github_id 字段中）
    const existing = await db.selectFrom('user')
        .select(['user_id'])
        .where('github_id', '=', platform_id)
        .executeTakeFirst();

    // 初始化 JWT payload，默认两个属性均为 null
    let tokenPayload = { user_id: null, current_plan: null };

    if (existing) {
        tokenPayload.user_id = existing.user_id;
        // 从 user_current_plan 表中查询对应的 current_plan 值
        const planRow = await db.selectFrom('user_current_plan')
            .select(['current_plan'])
            .where('user_id', '=', existing.user_id)
            .executeTakeFirst();

        if (planRow) {
            tokenPayload.current_plan = planRow.current_plan;
        }
    }

    // 返回生成的 JWT token
    return createJWTToken(tokenPayload);
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
    const code = c.req.query('code');
    if (!code) {
        return c.json({ success: false, error: 'No code provided' }, 400);
    }
    const redirectUri = `${BASE_URL}/auth/github/callback`;
    try {
        const tokenParams = {
            code,
            redirect_uri: redirectUri,
            scope: 'read:user user:email',
        };
        const accessToken = await githubClient.getToken(tokenParams);
        const token = accessToken.token.access_token as string;

        console.log(accessToken, token, "token================");
        // 获取 GitHub 用户信息
        const userRes = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `token ${token}`,
                'User-Agent': 'Hono-SSO-Service',
            },
        });
        const githubUser = await userRes.json();
        console.log(githubUser, "githubUser================");

        const jwtToken = await generateJWTForUser(githubUser.id);

        // 设置cookie
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

// Google 回调，处理 code 换取 token，然后获取用户信息
app.get('/auth/google/callback', async (c) => {
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

    const code = c.req.query('code');
    if (!code) {
        return c.json({ success: false, error: 'No code provided' }, 400);
    }
    const redirectUri = `${BASE_URL}/auth/google/callback`;
    try {
        const tokenParams = {
            code,
            redirect_uri: redirectUri,
            scope: 'openid email profile',
        };
        const accessToken = await googleClient.getToken(tokenParams);
        const token = accessToken.token.access_token as string;

        // 获取 Google 用户信息（使用 OpenID Connect 端点）
        const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        const googleUser = await userRes.json();

        const jwtToken = await generateJWTForUser(googleUser.sub);

        // 设置cookie
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

// 示例：一个用于检查当前 session 状态的接口（这里仅作示例）
app.get('/api/auth/session', (c) => {
    // 实际应用中，你可能会校验 JWT 或其他会话信息
    return c.json({ session: null });
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

// 替换原来的 listen 调用
// serve({
//     fetch: app.fetch,
//     port: 3000
// }, (info) => {
//     console.log(`SSO API 服务运行在 http://localhost:${info.port}`);
// });

export default app;
