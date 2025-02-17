// import { ExecutionContext } from 'hono';
import app from './index';

/**
 * 将传入的 env 中的变量挂载到全局对象上，
 * 这样 index.ts 中如果直接引用 DATABASE_URL 等全局变量就不会报错。
 */
export default {
  async fetch(
    request: Request,
    env: {
      GITHUB_CLIENT_ID: string;
      GITHUB_CLIENT_SECRET: string;
      GOOGLE_CLIENT_ID: string;
      GOOGLE_CLIENT_SECRET: string;
      BASE_URL: string;
      DATABASE_URL: string;
      JWT_SECRET: string;
      OPENAI_API_KEY: string;
      // 如果还有其他环境变量，也可以在此处声明  
    },
  ): Promise<Response> {
    // 将所有需要的环境变量挂载到全局作用域上
    globalThis.GITHUB_CLIENT_ID = env.GITHUB_CLIENT_ID;
    globalThis.GITHUB_CLIENT_SECRET = env.GITHUB_CLIENT_SECRET;
    globalThis.GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
    globalThis.GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
    globalThis.BASE_URL = env.BASE_URL;
    globalThis.DATABASE_URL = env.DATABASE_URL;
    globalThis.JWT_SECRET = env.JWT_SECRET;
    globalThis.OPENAI_API_KEY = env.OPENAI_API_KEY;

    // 如果以后有更多变量，例如:
    // globalThis.OTHER_VAR = env.OTHER_VAR;

    return await app.fetch(request, env);
  },
}; 