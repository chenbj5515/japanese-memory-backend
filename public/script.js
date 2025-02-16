// 发起请求，调用 /auth/google/login 接口获取授权 URL
document.getElementById('googleLoginBtn').addEventListener('click', function () {
  fetch('/auth/google/login')
    .then(function(response) {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error('登录请求失败');
      }
    })
    .then(function(data) {
      console.log('登录成功', data);
      // 根据响应数据中的 authUrl 进行跳转
      if (data && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        console.error('响应中没有 authUrl 字段');
      }
    })
    .catch(function(error) {
      console.error('发生错误：', error);
    });
}); 