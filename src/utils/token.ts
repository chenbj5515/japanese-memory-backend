// 生成随机数
export function getRandomNumber() {
    return Math.floor(Math.random() * 5) + 1;
}

// 生成CSRF令牌
export function generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
} 