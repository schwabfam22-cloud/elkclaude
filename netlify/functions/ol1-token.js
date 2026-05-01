// Netlify function: get Microsoft Graph token for Outlook Account 1
// Uses refresh token flow for personal Microsoft accounts (outlook.com)
// Place at: netlify/functions/ol1-token.js

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const CLIENT_ID    = process.env.OL1_CLIENT_ID;
  const refreshToken = process.env.OL1_REFRESH_TOKEN;

  if (!CLIENT_ID || !refreshToken) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing OL1_CLIENT_ID or OL1_REFRESH_TOKEN env vars' }),
    };
  }

  try {
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     CLIENT_ID,
      refresh_token: refreshToken,
      scope:         'Calendars.Read offline_access User.Read',
    });

    const res = await fetch(
      'https://login.microsoftonline.com/consumers/oauth2/v2.0/token',
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error('Token refresh error:', data);
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: data.error_description || 'Token refresh failed' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token:  data.access_token,
        expires_in:    data.expires_in,
        refresh_token: data.refresh_token || refreshToken,
      }),
    };
  } catch(e) {
    console.error('ol1-token error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
