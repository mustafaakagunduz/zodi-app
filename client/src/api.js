export async function api(url, { token, method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...(body && { 'content-type': 'application/json' }),
        ...(token && { authorization: `Bearer ${token}` }),
      },
      body: body && JSON.stringify(body),
    });
  } catch {
    throw new Error('Sunucuya ulaşılamıyor.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    const error = new Error(data?.error ?? 'Sunucuya ulaşılamıyor.');
    error.status = res.status;
    throw error;
  }
  return data;
}
