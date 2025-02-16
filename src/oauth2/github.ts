export async function fetchGithubToken(
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  token_type: string;
  scope: string;
  githubUser: any;
}> {
  // 确保环境变量 GITHUB_CLIENT_ID 和 GITHUB_CLIENT_SECRET 已经正确设置
  const clientId = GITHUB_CLIENT_ID;
  const clientSecret = GITHUB_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error("缺少 GitHub 客户端配置，无法完成 token 交换");
  }
  
  // 使用 URLSearchParams 拼接请求参数
  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('code', code);
  params.append('redirect_uri', redirectUri);
  
  // 第一步：使用 code 请求 access token
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: params.toString()
  });
  
  if (!tokenResponse.ok) {
    throw new Error(`GitHub token 交换失败，状态码：${tokenResponse.status}`);
  }
  
  const tokenData = await tokenResponse.json();
  if (tokenData.error) {
    throw new Error(tokenData.error_description || 'GitHub token 交换时发生错误');
  }
  
  const { access_token } = tokenData;
  if (!access_token) {
    throw new Error("未能获取到 access token");
  }
  
  // 第二步：使用 access token 请求用户信息
  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Accept': 'application/json',
      'User-Agent': 'japanese-memory-auth'
    }
  });
  
  if (!userResponse.ok) {
    throw new Error(`GitHub 用户信息获取失败，状态码：${userResponse.status}`);
  }
  
  const githubUser = await userResponse.json();
  
  // 返回 token 信息和获取到的用户信息
  return { ...tokenData, githubUser };
} 