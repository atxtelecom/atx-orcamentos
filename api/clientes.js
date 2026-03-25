function parseCookies(req) {
  const list = {};
  const header = req.headers.cookie;
  if (!header) return list;
  header.split(';').forEach(cookie => {
    const [key, ...val] = cookie.trim().split('=');
    list[key.trim()] = decodeURIComponent(val.join('='));
  });
  return list;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const cookies = parseCookies(req);
  const accessToken = cookies.ca_access_token;
  const refresh = cookies.ca_refresh_token;

  if (!accessToken && !refresh) return res.status(401).json({ error: 'nao_conectado' });

  const { q } = req.query;
  if (!q || q.length < 2) return res.status(400).json({ error: 'Query muito curta' });

  try {
    // Tenta nova API primeiro (api-v2)
    let caRes = await f
