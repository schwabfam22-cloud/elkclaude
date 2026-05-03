// Netlify function: receives calendar events from Make.com or Power Automate
// Place at: netlify/functions/sync-from-powerautomate.js

const SUPA_URL = 'https://qolawxoyirwrkxohxwat.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFvbGF3eG95aXJ3cmt4b2h4d2F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMzkyNzYsImV4cCI6MjA5MjkxNTI3Nn0.lwPybb7_KoXsp6CDsL0CeP3QzkFU0_LZWscAkYDVZIc';

function parseGowns(subject) {
  if (!subject) return [];
  const tokens = subject.split(/[\s,]+/).filter(t => t);
  if (tokens.length <= 7) {
    const gowns = subject.split(/[,\s]+/).map(t => t.trim()).filter(t => /\d{3}/.test(t));
    return gowns.length ? gowns : [subject.trim()];
  }
  return subject.match(/\d{3,}[a-zA-Z]*/g) || [subject.trim()];
}

function parseLocation(location) {
  if (!location) return { client: '', phone: '' };
  const phoneM = location.match(/(\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]?\d{4}|\d{10,})/);
  if (phoneM) {
    const phone  = phoneM[0].trim();
    const client = location.slice(0, phoneM.index).replace(/^l/i, '').trim();
    return { client: client.replace(/\b\w/g, l => l.toUpperCase()), phone };
  }
  return { client: location.replace(/^l/i, '').trim().replace(/\b\w/g, l => l.toUpperCase()), phone: '' };
}

exports.handler = async function(event) {
  // Allow GET for webhook verification (Make.com sends a verification request)
  if (event.httpMethod === 'GET') {
    return { statusCode: 200, body: 'OK' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { subject, location, start, id, action } = body;

  if (!subject || !start) {
    return { statusCode: 400, body: 'Missing required fields: subject, start' };
  }

  // Parse date — handle both string and Make.com date object formats
  let date = '';
  if (typeof start === 'string') {
    date = start.slice(0, 10);
  } else if (start && typeof start === 'object') {
    // Make.com sends date as object with date property or ISO string
    const dateStr = start.date || start.dateTime || start.value || JSON.stringify(start);
    date = dateStr.slice(0, 10);
  }
  if (!date || date.length < 10) return { statusCode: 400, body: 'Invalid start date: ' + JSON.stringify(start) };

  // Parse gowns and client info
  const gowns = parseGowns(subject);
  const { client, phone } = parseLocation(location || '');

  try {
    if (action === 'deleted') {
      // Delete from Supabase by graphId
      await fetch(`${SUPA_URL}/rest/v1/reservations?graph_id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': `Bearer ${SUPA_KEY}`,
        },
      });
      return { statusCode: 200, body: JSON.stringify({ deleted: true, id }) };
    }

    // Check if reservation already exists
    const existRes = await fetch(
      `${SUPA_URL}/rest/v1/reservations?graph_id=eq.${encodeURIComponent(id)}&select=id`,
      { headers: { 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}` } }
    );
    const existing = await existRes.json();

    let added = 0;
    let updated = 0;

    if (existing && existing.length > 0) {
      // Update existing reservation
      await fetch(`${SUPA_URL}/rest/v1/reservations?graph_id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPA_KEY,
          'Authorization': `Bearer ${SUPA_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ date, gown: gowns[0], client, phone, graph_id: id }),
      });
      updated = 1;
    } else {
      // Insert new reservations (one per gown)
      for (const gown of gowns) {
        await fetch(`${SUPA_URL}/rest/v1/reservations`, {
          method: 'POST',
          headers: {
            'apikey': SUPA_KEY,
            'Authorization': `Bearer ${SUPA_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ date, gown, client, phone, graph_id: id }),
        });
        added++;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, added, updated, date, gowns, client, phone }),
    };
  } catch(e) {
    console.error('Sync error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
