module.exports = async function handler(req, res) {
  var code = req.query.code;
  var error = req.query.error;

  if (error) return res.redirect('/?ca_error=' + encodeURIComponent(error));
  if (!code) return res.status(400).send('Código ausente.');

  try {
    // Documentação: Authorization: Basic BASE64(client_id:client_secret)
    var credencial = Buffer.from(
      process.env.CA_CLIENT_ID + ':' + process.env.CA_CLIENT_SECRET
    ).toString('base64');

    var body = 'grant_type=authorization_code' +
      '&code=' + encodeURIComponent(code) +
      '&redirect_uri=' + encodeURIComponent('https://atx-orcamentos-alpha.vercel.app/api/callback');

    var tokenRes = await fetch('https://auth.contaazul.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + credencial
      },
      body: body
    });

    var tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return res.redirect('/?ca_error=' + encodeURIComponent(JSON.stringify(tokenData)));
    }

    var expires = new Date(Date.now() + tokenData.expires_in * 1000).toUTCString();
    var refreshExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();

    res.setHeader('Set-Cookie', [
      'ca_access_token=' + tokenData.access_token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=' + expires,
      'ca_refresh_token=' + tokenData.refresh_token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=' + refreshExpires
    ]);

    return res.redirect('/?ca_connected=1');

  } catch (err) {
    return res.redirect('/?ca_error=' + encodeURIComponent(err.message));
  }
};
