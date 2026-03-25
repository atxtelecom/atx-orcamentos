export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect('/?ca_error=' + encodeURIComponent(error));
  }

  if (!code) {
    return res.status(400).send('Código de autorização ausente.');
  }

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', 'https://atx-orcamentos.vercel.app/api/callback');
    params.append('client_id', process.env.CA_CLIENT_ID);
    params.append('client_secret', process.env.CA_CLIENT_SECRET);

    const tokenRes = await fetch('https://auth.contaazul.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      throw new Error(JSON.stringify(tokenData));
    }

    // Salva tokens em cookies seguros (httpOnly)
    const expires = new Date(Date.now() + tokenData.expires_in * 1000).toUTCString();
    const refreshExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();

    res.setHeader('Set-Cookie', [
      `ca_access_token=${tokenData.access_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${expires}`,
      `ca_refresh_token=${tokenData.refresh_token}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${refreshExpires}`
    ]);

    res.redirect('/?ca_connected=1');

  } catch (err) {
    res.redirect('/?ca_error=' + encodeURIComponent(err.message));
  }
}
