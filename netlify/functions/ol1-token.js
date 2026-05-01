// Netlify function: get Microsoft Graph token for Outlook Account 1
// Secrets stored in Netlify environment variables — never in code
// Place at: netlify/functions/ol1-token.js

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const TENANT_ID     = process.env.OL1_TENANT_ID;
  const CLIENT_ID     = process.env.OL1_CLIENT_ID;
  const CLIENT_SECRET = process.env.OL1_CLIENT_SECRET;

  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing environment variables. Set OL1_TENANT_ID, OL1_CLIENT_ID, OL1_CLIENT_SECRET in Netlify.' }),
    };
  }

  try {
    const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

    const body = new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope:         'https://graph.microsoft.com/.default',
    });

    const res = await fetch(tokenUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Token error:', data);
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: data.error_description || 'Token request failed' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: data.access_token,
        expires_in:   data.expires_in,
      }),
    };
  } catch(e) {
    console.error('ol1-token error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
