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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Metodo nao permitido' });
  }

  var cookies = parseCookies(req);
  var accessToken = cookies.ca_access_token;

  if (!accessToken) {
    return res.status(401).json({ error: 'nao_conectado' });
  }

  var q = req.query.q;
  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Query muito curta' });
  }

  try {
    var caRes = await fetch(
      'https://api.contaazul.com/v1/customers?page=0&size=10',
      { headers: { Authorization: 'Bearer ' + accessToken } }
    );

    var statusCode = caRes.status;
    var rawText = await caRes.text();

    return res.status(200).json({
      clientes: [],
      debug: 'STATUS: ' + statusCode + ' | BODY: ' + rawText.substring(0, 800)
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
