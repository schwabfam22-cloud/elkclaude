// Netlify serverless function — Resend email sender
// Place this file at: netlify/functions/send-email.js in your GitHub repo

export async function handler(event) {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { to, subject, html, from } = body;

  if (!to || !subject || !html) {
    return { statusCode: 400, body: 'Missing required fields: to, subject, html' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer re_hFpag88F_N5Vy8oQvHY9TPrtk7uvSutxB`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: from || 'Ezra L\'Kallah <reservations@elkreservations.com>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend error:', data);
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: data }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, id: data.id }),
    };
  } catch (e) {
    console.error('Send email error:', e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
}
