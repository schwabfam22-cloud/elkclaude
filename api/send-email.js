export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, subject, html } = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  if (!to || !subject || !html) return res.status(400).json({ error: 'Missing fields' });

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer re_hFpag88F_N5Vy8oQvHY9TPrtk7uvSutxB`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: "Schwab Gowns <reservations@elkreservations.com>",
        to: Array.isArray(to) ? to : [to],
        subject, html,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data });
    return res.status(200).json({ success: true, id: data.id });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
