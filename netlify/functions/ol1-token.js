// Netlify function: get mailbox for Outlook Account 1
// Uses client credentials to find the user's email address
// Place at: netlify/functions/ol1-mailbox.js

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const TENANT_ID     = process.env.OL1_TENANT_ID;
  const CLIENT_ID     = process.env.OL1_CLIENT_ID;
  const CLIENT_SECRET = process.env.OL1_CLIENT_SECRET;
  const MAILBOX = process.env.OL1_MAILBOX || 'ezrahlkallah1@outlook.com';

  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing env vars' }) };
  }

  // If mailbox is set directly, return it immediately
  if (MAILBOX) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailbox: MAILBOX }),
    };
  }

  // Otherwise get a token and look up users in the tenant
  try {
    const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
    const tokenBody = new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope:         'https://graph.microsoft.com/.default',
    });

    const tokenRes = await fetch(tokenUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    tokenBody.toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: tokenData.error_description }) };
    }

    const token = tokenData.access_token;

    // Get users list to find the calendar owner
    const usersRes = await fetch('https://graph.microsoft.com/v1.0/users?$select=mail,userPrincipalName&$top=1', {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const usersData = await usersRes.json();
    const user = usersData.value?.[0];
    const mailbox = user?.mail || user?.userPrincipalName || null;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailbox }),
    };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
