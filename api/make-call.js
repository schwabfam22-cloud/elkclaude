const TWILIO_SID   = process.env.TWILIO_SID;
const TWILIO_FROM  = process.env.TWILIO_FROM;
const SUPA_URL     = 'https://qolawxoyirwrkxohxwat.supabase.co';
const SUPA_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvbGF3eG95aXJ3cmt4b2h4d2F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzkyNzYsImV4cCI6MjA5MjkxNTI3Nn0.lwPybb7_KoXsp6CDsL0CeP3QzkFU0_LZWscAkYDVZIc';

const BUSINESS_HOURS = {
  0: { slots: ['11:00am–2:00pm'] },
  1: { slots: ['7:30pm–9:00pm'] },
  2: { slots: ['10:30am–12:30pm', '7:30pm–9:00pm'] },
  3: { slots: ['7:30pm–9:00pm'] },
  4: { slots: ['10:30am–12:30pm', '7:30pm–9:00pm'] },
  5: null,
  6: null,
};

const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_SHORT = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function parseTime(str) {
  const m = str.match(/(\d+):(\d+)(am|pm)/i);
  if (!m) return null;
  let h = parseInt(m[1]), min = parseInt(m[2]), ap = m[3].toLowerCase();
  if (ap === 'pm' && h !== 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return { h, min };
}

function formatTime(h, m) {
  const ap = h >= 12 ? 'pm' : 'am';
  const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${dh}:${String(m).padStart(2,'0')}${ap}`;
}

function firstHalfHour(dow) {
  const bh = BUSINESS_HOURS[dow];
  if (!bh) return null;
  const firstSlot = bh.slots[0];
  const startStr  = firstSlot.split('–')[0];
  const start     = parseTime(startStr);
  let em = start.min + 30, eh = start.h;
  if (em >= 60) { em -= 60; eh += 1; }
  return `${startStr} to ${formatTime(eh, em)}`;
}

function nextOpenDay(date) {
  const d = new Date(date);
  while (BUSINESS_HOURS[d.getDay()] === null) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function formatDateSpoken(d) {
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function buildTwiML(reservation) {
  const resDate   = new Date(reservation.date + 'T12:00:00');
  const returnRaw = new Date(resDate);
  returnRaw.setDate(returnRaw.getDate() + 1);
  const returnDate    = nextOpenDay(returnRaw);
  const returnTime    = firstHalfHour(returnDate.getDay());
  const returnDateStr = formatDateSpoken(returnDate);

  const message =
    `Mah-zuhl tuv on your wedding! ` +
    `This is a message from Schwab gowns. ` +
    `We're calling to remind you to return your gown on ${returnDateStr}, ` +
    `between ${returnTime}. ` +
    `We are so excited for you and look forward to seeing you. ` +
    `If you have any questions, please call us back at 7 3 2, 6 6 6, 9 9 9 8. ` +
    `Thank you and goodbye.`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="2"/>
  <Say voice="Polly.Joanna" language="en-US" rate="85%">
    ${message}
  </Say>
</Response>`;
}

async function makeCall(toPhone, twiml, twilioToken) {
  let phone = toPhone.replace(/\D/g, '');
  if (phone.length === 10) phone = '1' + phone;
  phone = '+' + phone;

  const auth = Buffer.from(`${TWILIO_SID}:${twilioToken}`).toString('base64');
  const body = new URLSearchParams({ To: phone, From: TWILIO_FROM, Twiml: twiml });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Calls.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type':  'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = await res.json();
  return { ok: res.ok, data };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  if (!TWILIO_TOKEN) return res.status(500).json({ error: 'Missing TWILIO_AUTH_TOKEN env var' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  let { date, testPhone } = body || {};

  // Test call to a specific phone
  if (testPhone) {
    const dummyRes = { date: date || new Date().toISOString().slice(0,10), client: 'Test', phone: testPhone };
    const twiml  = buildTwiML(dummyRes);
    const result = await makeCall(testPhone, twiml, TWILIO_TOKEN);
    return res.status(200).json({ test: true, phone: testPhone, status: result.ok ? 'called' : 'failed', detail: result.data });
  }

  // Auto: call for yesterday's reservations
  if (!date) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    date = yesterday.toISOString().slice(0, 10);
  }

  const supaRes = await fetch(
    `${SUPA_URL}/rest/v1/reservations?select=*&date=eq.${date}`,
    { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } }
  );

  const reservations = await supaRes.json();
  if (!reservations.length) {
    return res.status(200).json({ message: `No reservations for ${date}`, calls: 0 });
  }

  // Group by phone — one call per customer
  const groups = {};
  reservations.forEach(r => { if (!groups[r.phone]) groups[r.phone] = r; });

  const results = [];
  for (const r of Object.values(groups)) {
    if (!r.phone || r.phone.replace(/\D/g,'').length < 10) {
      results.push({ client: r.client, status: 'skipped — no valid phone' });
      continue;
    }
    const twiml  = buildTwiML(r);
    const result = await makeCall(r.phone, twiml, TWILIO_TOKEN);
    results.push({ client: r.client, phone: r.phone, status: result.ok ? 'called' : 'failed', sid: result.data.sid || result.data.message || '' });
  }

  return res.status(200).json({ date, calls: results.length, results });
}
