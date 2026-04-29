exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { to, subject, html } = body;

  if (!to || !subject || !html) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer re_hFpag88F_N5Vy8oQvHY9TPrtk7uvSutxB',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: "Schwab Gowns <reservations@elkreservations.com>",
        to: Array.isArray(to) ? to : [to],
        subject: subject,
        html: html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: data }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true, id: data.id }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
