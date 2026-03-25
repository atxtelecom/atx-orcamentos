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
  var refresh = cookies.ca_refresh_token;

  if (!accessToken && !refresh) {
    return res.status(401).json({ error: 'nao_conectado' });
  }

  var q = req.query.q;
  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Query muito curta' });
  }

  try {
    var caRes = await fetch(
      'https://api.contaazul.com/v1/customers?name=' + encodeURIComponent(q) + '&page=0&size=10',
      { headers: { Authorization: 'Bearer ' + accessToken } }
    );

    if (!caRes.ok) {
      var errText = await caRes.text();
      return res.status(200).json({ clientes: [], debug: errText });
    }

    var data = await caRes.json();
    var lista = data.content || data || [];

    var clientes = lista.map(function(p) {
      return {
        id: p.id,
        nome: p.name || p.company_name || '',
        email: p.email || '',
        telefone: p.phone || p.mobile_phone || '',
        endereco: [
          p.address && p.address.street,
          p.address && p.address.number,
          p.address && p.address.neighborhood,
          p.address && p.address.city,
          p.address && p.address.state
        ].filter(Boolean).join(', '),
        documento: p.cpf || p.cnpj || '',
        contato: p.contact_name || ''
      };
    });

    return res.status(200).json({ clientes: clientes });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
