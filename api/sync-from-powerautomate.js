const SUPA_URL = 'https://qolawxoyirwrkxohxwat.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvbGF3eG95aXJ3cmt4b2h4d2F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzkyNzYsImV4cCI6MjA5MjkxNTI3Nn0.lwPybb7_KoXsp6CDsL0CeP3QzkFU0_LZWscAkYDVZIc';

function parseGowns(subject) {
  try {
    if (!subject) return ['unknown'];
    const tokens = subject.split(/[\s,]+/).filter(t => t);
    if (tokens.length <= 7) {
      const gowns = subject.split(/[,\s]+/).map(t => t.trim()).filter(t => /\d{3}/.test(t));
      return gowns.length ? gowns : [subject.trim()];
    }
    const found = subject.match(/\d{3,}[a-zA-Z]*/g);
    return found || [subject.trim()];
  } catch(e) { return [String(subject)]; }
}

function parseLocation(location) {
  try {
    if (!location) return { client: '', phone: '' };
    let displayName = location;
    if (typeof location === 'string' && location.startsWith('{')) {
      const parsed = JSON.parse(location);
      displayName = parsed.displayName || parsed.DisplayName || '';
    } else if (typeof location === 'object') {
      displayName = location.displayName || location.DisplayName || '';
    }
    if (!displayName) return { client: '', phone: '' };
    const phoneM = displayName.match(/(\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]?\d{4}|\d{10,})/);
    if (phoneM) {
      const phone  = phoneM[0].trim();
      const client = displayName.slice(0, phoneM.index).replace(/^l/i, '').trim();
      return { client: client.replace(/\b\w/g, l => l.toUpperCase()), phone };
    }
    return { client: displayName.replace(/\b\w/g, l => l.toUpperCase()), phone: '' };
  } catch(e) { return { client: '', phone: '' }; }
}

function extractDate(start) {
  try {
    if (!start) return '';
    if (typeof start === 'string') return start.slice(0, 10);
    if (typeof start === 'object') {
      const val = start.date || start.dateTime || start.value || start.string || '';
      return String(val).slice(0, 10);
    }
    return String(start).slice(0, 10);
  } catch(e) { return ''; }
}

async function supaRequest(path, method, body) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json({ ok: true });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch(e) {
    return res.status(200).json({ error: 'Invalid JSON' });
  }

  const { subject, location, start, id, action } = body;
  const date  = extractDate(start);
  const gowns = parseGowns(subject);
  const { client, phone } = parseLocation(location);

  console.log('Sync:', { date, gowns, client, phone, id, action });

  if (!date) return res.status(200).json({ error: 'No date', start });

  try {
    if (action === 'deleted' && id) {
      await supaRequest(`reservations?graph_id=eq.${encodeURIComponent(id)}`, 'DELETE');
      return res.status(200).json({ deleted: true });
    }

    const existRes = await supaRequest(
      `reservations?graph_id=eq.${encodeURIComponent(id || '')}&select=id`, 'GET'
    );
    const existing = await existRes.json();

    if (existing && existing.length > 0) {
      await supaRequest(`reservations?graph_id=eq.${encodeURIComponent(id)}`, 'PATCH',
        { date, gown: gowns[0], client, phone });
      return res.status(200).json({ updated: true, date, gown: gowns[0], client, phone });
    }

    let added = 0;
    for (const gown of gowns) {
      await supaRequest('reservations', 'POST', { date, gown, client, phone, graph_id: id || null });
      added++;
    }

    return res.status(200).json({ success: true, added, date, gowns, client, phone });
  } catch(e) {
    console.error('Error:', e.message);
    return res.status(200).json({ error: e.message });
  }
}
