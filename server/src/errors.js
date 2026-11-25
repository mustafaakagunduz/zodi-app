// Mesajı kullanıcıya gösterilebilen hata.
export class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function rateLimiter(limit, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) throw new AppError('Çok hızlısın, biraz bekle.', 429);
    recent.push(now);
    hits.set(key, recent);
  };
}
