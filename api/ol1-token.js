export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const CLIENT_ID    = process.env.OL1_CLIENT_ID;
  const refreshToken = process.env.OL1_REFRESH_TOKEN;

  if (!CLIENT_ID || !refreshToken) {
    return res.status(500).json({ error: 'Missing OL1_CLIENT_ID or OL1_REFRESH_TOKEN env vars' });
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
      scope: 'Calendars.Read offline_access User.Read',
    });

    const r = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data.error_description });
    return res.status(200).json({ access_token: data.access_token, expires_in: data.expires_in });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
