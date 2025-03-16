import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import { AuthorizationCode } from 'simple-oauth2';
import { generateToken } from '../utils/token';
import { fetchGithubToken } from '../oauth2/github';
import { fetchGoogleToken } from '../oauth2/google';
import { generateJWTForUser } from '../services/auth';
import { prisma } from '../services/prisma';
// import { PrismaClient } from '@prisma/client';

// 环境变量
// const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
// const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
// const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
// const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
// const BASE_URL = process.env.BASE_URL || '';
const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';

const auth = new Hono();

// CSRF令牌路由
auth.get('/csrf-token', (c) => {
    const token = generateToken();
    
    // 将 token 设置到 cookie 中，有效期 1 分钟
    setCookie(c, 'csrf_token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        maxAge: 60  // 1分钟
    });
    
    // 同时返回 token
    return c.json({ csrf_token: token });
});

// GitHub登录路由
auth.get('/github/login', (c) => {
    const cookieToken = getCookie(c, 'csrf_token');
    const headerToken = c.req.header('X-CSRF-Token');  // 从请求头获取 token
    
    // 验证 CSRF token
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return c.json({ success: false, error: 'CSRF 令牌无效或已过期' }, 403);
    }
    
    setCookie(c, 'csrf_token', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        maxAge: 0
    });
    
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

// GitHub回调路由
auth.get('/github/callback', async (c) => {
    const code = c.req.query('code');
    if (!code) {
        return c.json({ success: false, error: 'No code provided' }, 400);
    }
    const redirectUri = `${BASE_URL}/auth/github/callback`;
    try {
        // 使用 fetchGithubToken 获取 token 和用户信息
        const { githubUser, access_token } = await fetchGithubToken(code, redirectUri);

        // 根据 GitHub 用户ID生成 JWT
        const jwtToken = await generateJWTForUser(githubUser, githubUser.id, prisma);

        // 设置 cookie
        setCookie(c, 'session', jwtToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 7 * 24 * 60 * 60 // 7天
        });
        
        // 重定向到前端URL
        return c.redirect(NEXT_PUBLIC_BASE_URL);
    } catch (err: any) {
        return c.json({ success: false, error: err.message }, 400);
    }
});

// Google登录路由
auth.get('/google/login', (c) => {
    const cookieToken = getCookie(c, 'csrf_token');
    const headerToken = c.req.header('X-CSRF-Token');  // 从请求头获取 token
    
    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return c.json({ success: false, error: 'CSRF 令牌无效或已过期' }, 403);
    }
    
    setCookie(c, 'csrf_token', '', {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
        maxAge: 0
    });
    
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

// Google回调路由
auth.get('/google/callback', async (c) => {
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
        const googleUser = await userRes.json();
        
        // 根据 Google 用户ID生成 JWT
        const jwtToken = await generateJWTForUser(
            {
                id: googleUser.sub,
                email: googleUser.email,
                name: googleUser.name,
                image: googleUser.picture
            }, 
            googleUser.sub, 
            prisma
        );

        // 设置 Cookie
        setCookie(c, 'session', jwtToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 7 * 24 * 60 * 60 // 7天
        });
        
        // 重定向到前端URL
        return c.redirect(NEXT_PUBLIC_BASE_URL);
    } catch (err: any) {
        return c.json({ success: false, error: err.message }, 400);
    }
});

export default auth; 