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

  var body = 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(refreshToken);

  var tokenRes = await fetch('https://auth.contaazul.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + credencial
    },
    body: body
  });

  var data = await tokenRes.json();
  if (!data.access_token) throw new Error('Falha ao renovar token: ' + JSON.stringify(data));

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

    // Nova API: api-v2.contaazul.com, endpoint /v1/pessoas com busca_textual
    var url = 'https://api-v2.contaazul.com/v1/pessoas?busca_textual=' +
      encodeURIComponent(q) + '&pagina=1&tamanho_pagina=10&tipo_pessoa=CLIENTE';

    var caRes = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });

    // Token expirado — renova e tenta de novo
    if (caRes.status === 401 && refresh) {
      accessToken = await renovarToken(refresh, res);
      caRes = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
    }

    if (!caRes.ok) {
      var errText = await caRes.text();
      return res.status(200).json({ clientes: [], debug: 'STATUS ' + caRes.status + ': ' + errText });
    }

    var data = await caRes.json();
    var lista = data.itens || data.content || data || [];

    var clientes = lista.map(function(p) {
      var end = p.enderecos && p.enderecos[0];
      var endStr = end ? [
        end.logradouro, end.numero, end.bairro, end.cidade, end.estado
      ].filter(Boolean).join(', ') : '';

      return {
        id: p.id,
        nome: p.nome || p.razao_social || p.name || '',
        email: (p.emails && p.emails[0] && p.emails[0].email) || p.email || '',
        telefone: (p.telefones && p.telefones[0] && p.telefones[0].numero) || '',
        endereco: endStr,
        documento: p.cpf || p.cnpj || '',
        contato: p.nome_contato || ''
      };
    });

    return res.status(200).json({ clientes: clientes });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
