export async function fetchGoogleToken(code: string, redirectUri: string): Promise<any> {
  const params = new URLSearchParams();
  params.append('code', code);
  params.append('client_id', GOOGLE_CLIENT_ID); // 从环境变量或配置中获取
  params.append('client_secret', GOOGLE_CLIENT_SECRET); // 从环境变量或配置中获取
  params.append('redirect_uri', redirectUri);
  params.append('grant_type', 'authorization_code');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  if (!res.ok) {
    throw new Error('获取 token 失败');
  }
  return res.json();
} 