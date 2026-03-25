function parseCookies(req) {
  var list = {};
  var header = req.headers.cookie;
  if (!header) return list;
  header.split(';').forEach(function(cookie) {
    var parts = cookie.trim().split('=');
    var key = parts[0].trim();
    var val = parts.slice(1).join('=');
    list[key] = decodeURIComponent(val);
  });
  return list;
}

async function renovarToken(refreshToken, res) {
  var credencial = Buffer.from(
    process.env.CA_CLIENT_ID + ':' + process.env.CA_CLIENT_SECRET
  ).toString('base64');

  var tokenRes = await fetch('https://auth.contaazul.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + credencial
    },
    body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(refreshToken)
  });

  var data = await tokenRes.json();
  if (!data.access_token) throw new Error('Falha ao renovar: ' + JSON.stringify(data));

  var expires = new Date(Date.now() + data.expires_in * 1000).toUTCString();
  var refreshExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();

  res.setHeader('Set-Cookie', [
    'ca_access_token=' + data.access_token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=' + expires,
    'ca_refresh_token=' + data.refresh_token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=' + refreshExpires
  ]);

  return data.access_token;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo nao permitido' });

  var cookies = parseCookies(req);
  var accessToken = cookies.ca_access_token;
  var refresh = cookies.ca_refresh_token;

  if (!accessToken && !refresh) return res.status(401).json({ error: 'nao_conectado' });

  var q = req.query.q;
  if (!q || q.length < 2) return res.status(400).json({ error: 'Query muito curta' });

  try {
    if (!accessToken && refresh) {
      accessToken = await renovarToken(refresh, res);
    }

    // Parâmetro correto: "busca" (busca por nome ou documento)
    // tipo_perfil: Cliente
    var url = 'https://api-v2.contaazul.com/v1/pessoas' +
      '?busca=' + encodeURIComponent(q) +
      '&tipo_perfil=Cliente' +
      '&pagina=1&tamanho_pagina=10';

    var caRes = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });

    if (caRes.status === 401 && refresh) {
      accessToken = await renovarToken(refresh, res);
      caRes = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
    }

    if (!caRes.ok) {
      var errText = await caRes.text();
      return res.status(200).json({ clientes: [], debug: errText });
    }

    var data = await caRes.json();
    var lista = Array.isArray(data) ? data : (data.items || []);

    var clientes = lista.map(function(p) {
      var end = p.endereco || {};
      var endStr = [end.logradouro, end.numero, end.bairro, end.cidade, end.estado]
        .filter(Boolean).join(', ');

      return {
        id: p.id,
        nome: p.nome || '',
        email: p.email || '',
        telefone: p.telefone || '',
        endereco: endStr,
        documento: p.documento || '',
        contato: ''
      };
    });

    return res.status(200).json({ clientes: clientes });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
