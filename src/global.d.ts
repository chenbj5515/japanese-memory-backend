export {}

declare global {
  var GITHUB_CLIENT_ID: string;
  var GITHUB_CLIENT_SECRET: string;
  var GOOGLE_CLIENT_ID: string;
  var GOOGLE_CLIENT_SECRET: string;
  var BASE_URL: string;
  var DATABASE_URL: string;
  var JWT_SECRET: string;
  var OPENAI_API_KEY: string;
}

// 扩展Hono的Context类型
declare module 'hono' {
  interface ContextVariableMap {
    'user': {
      user_id: string;
      has_subscription: boolean;
      profile: string;
      name: string;
      email: string;
    }
  }
} 