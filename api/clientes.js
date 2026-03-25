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

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo nao permitido' });

  var cookies = parseCookies(req);
  var accessToken = cookies.ca_access_token;
  var refresh = cookies.ca_refresh_token;

  if (!accessToken && !refresh) return res.status(401).json({ error: 'nao_conectado' });

  var q = req.query.q;
  if (!q || q.length < 2) return res.status(400).json({ error: 'Query muito curta' });

  try {
    var url = 'https://api-v2.contaazul.com/v1/pessoas?busca_textual=' +
      encodeURIComponent(q) + '&pagina=1&tamanho_pagina=10';

    var caRes = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });

    var statusCode = caRes.status;
    var rawText = await caRes.text();

    return res.status(200).json({
      clientes: [],
      status: statusCode,
      debug: rawText.substring(0, 1000)
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
