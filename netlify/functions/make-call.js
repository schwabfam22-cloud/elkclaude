const TWILIO_SID   = 'AC29ab20b780418597697919a44f26c051';
const TWILIO_TOKEN = '0fa8524bb6d24da60b17e629a30617e0';
const TWILIO_FROM  = '+18553072497';
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
    `Mah-zuhl tuv on your upcoming wedding! ` +
    `This is a message from Schwab gowns. ` +
    `We're calling to remind you to return your gown on ${returnDateStr}, ` +
    `between ${returnTime}. ` +
    `We are so excited for you and look forward to seeing you. ` +
    `If you have any questions, please call us back at 7 3 2, 6 6 6, 9 9 9 8. ` +
    `Thank you and goodbye.`;

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna" language="en-US">${message}</Say></Response>`;
}

async function makeCall(toPhone, twiml) {
  let phone = toPhone.replace(/\D/g, '');
  if (phone.length === 10) phone = '1' + phone;
  phone = '+' + phone;

  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
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

exports.handler = async function(event) {
  let targetDate;

  if (event.httpMethod === 'POST' && event.body) {
    try { const b = JSON.parse(event.body); targetDate = b.date; } catch(e) {}
  }

  if (!targetDate) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    targetDate = yesterday.toISOString().slice(0, 10);
  }

  const res = await fetch(`${SUPA_URL}/rest/v1/reservations?select=*&date=eq.${targetDate}`, {
    headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` }
  });

  if (!res.ok) return { statusCode: 500, body: 'Failed to fetch reservations' };

  const reservations = await res.json();
  if (!reservations.length) {
    return { statusCode: 200, body: JSON.stringify({ message: `No reservations for ${targetDate}`, calls: 0 }) };
  }

  const groups = {};
  reservations.forEach(r => { if (!groups[r.phone]) groups[r.phone] = r; });

  const results = [];
  for (const r of Object.values(groups)) {
    if (!r.phone || r.phone.replace(/\D/g,'').length < 10) {
      results.push({ client: r.client, status: 'skipped — no valid phone' });
      continue;
    }
    const twiml  = buildTwiML(r);
    const result = await makeCall(r.phone, twiml);
    results.push({ client: r.client, phone: r.phone, status: result.ok ? 'called' : 'failed', sid: result.data.sid || result.data.message || '' });
  }

  return { statusCode: 200, body: JSON.stringify({ date: targetDate, calls: results.length, results }) };
};
