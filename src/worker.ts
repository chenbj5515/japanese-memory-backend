import app from './index';

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
    },
  ): Promise<Response> {
    globalThis.GITHUB_CLIENT_ID = env.GITHUB_CLIENT_ID;
    globalThis.GITHUB_CLIENT_SECRET = env.GITHUB_CLIENT_SECRET;
    globalThis.GOOGLE_CLIENT_ID = env.GOOGLE_CLIENT_ID;
    globalThis.GOOGLE_CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
    globalThis.BASE_URL = env.BASE_URL;
    globalThis.DATABASE_URL = env.DATABASE_URL;
    globalThis.JWT_SECRET = env.JWT_SECRET;
    globalThis.OPENAI_API_KEY = env.OPENAI_API_KEY;

    return await app.fetch(request, env);
  },
}; 