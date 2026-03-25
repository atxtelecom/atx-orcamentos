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

async function refreshToken(refresh, res) {
  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refresh);
  params.append('client_id', process.env.CA_CLIENT_ID);
  params.append('client_secret', process.env.CA_CLIENT_SECRET);
  const tokenRes = await fetch('https://auth.contaazul.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  const data = await tokenRes.json();
  if (!data.access_token) throw new Error('Falha ao renovar token');
  const expires = new Date(Date.now() + data.expires_in * 1000).toUTCString();
  const refreshExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  res.setHeader('Set-Cookie', [
    `ca_access_token=${data.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires}`,
    `ca_refresh_token=${data.refresh_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${refreshExpires}`
  ]);
  return data.access_token;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
  const cookies = parseCookies(req);
  let accessToken = cookies.ca_access_token;
  const refresh = cookies.ca_refresh_token;
  if (!accessToken && !refresh) return res.status(401).json({ error: 'nao_conectado' });
  const { q } = req.query;
  if (!q || q.length < 2) return res.status(400).json({ error: 'Query muito curta' });
  try {
    if (!accessToken && refresh) accessToken = await refreshToken(refresh, res);
    let caRes = await fetch(
      `https://api.contaazul.com/v1/persons?search=${encodeURIComponent(q)}&page=0&size=10&type=CUSTOMER`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (caRes.status === 401 && refresh) {
      accessToken = await refreshToken(refresh, res);
      caRes = await fetch(
        `https://api.contaazul.com/v1/persons?search=${encodeURIComponent(q)}&page=0&size=10&type=CUSTOMER`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
    }
    if (!caRes.ok) throw new Error(await caRes.text());
    const data = await caRes.json();
    const clientes = (data.content || data || []).map(p => ({
      id: p.id,
      nome: p.name || p.company_name || '',
      email: p.email || '',
      telefone: p.phone || p.mobile_phone || '',
      endereco: [p.address?.street, p.address?.number, p.address?.neighborhood, p.address?.city, p.address?.state].filter(Boolean).join(', '),
      documento: p.cpf || p.cnpj || '',
      contato: p.contact_name || ''
    }));
    return res.status(200).json({ clientes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
