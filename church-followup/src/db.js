// Database layer using Node's built-in SQLite (Node >= 22.5). No native build,
// no external database bill — the data lives in one file (data/church.db).

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new DatabaseSync(config.dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS people (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    phone      TEXT UNIQUE,              -- normalized E.164, e.g. +2348012345678
    email      TEXT,
    how_heard  TEXT,
    notes      TEXT,
    created_at TEXT NOT NULL,            -- first visit (ISO)
    opted_out  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS visits (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id  INTEGER NOT NULL REFERENCES people(id),
    visited_at TEXT NOT NULL,
    service    TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id   INTEGER NOT NULL REFERENCES people(id),
    step        TEXT NOT NULL,           -- which follow-up step, e.g. "day0","day3","day7"
    channel     TEXT,                    -- whatsapp | sms | email
    status      TEXT NOT NULL,           -- sent | dryrun | failed | skipped
    provider_id TEXT,
    error       TEXT,
    body        TEXT,
    sent_at     TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_visits_person ON visits(person_id);
  CREATE INDEX IF NOT EXISTS idx_messages_person_step ON messages(person_id, step);
`);

// ---- Phone normalization (Nigeria-friendly, works generally) ----
export function normalizePhone(raw, countryCode = config.defaultCountryCode) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/[\s()\-.]/g, '');
  if (s.startsWith('+')) return '+' + s.slice(1).replace(/\D/g, '');
  s = s.replace(/\D/g, '');
  if (!s) return null;
  // Local format starting with 0 (e.g. 08012345678) -> +234 8012345678
  if (s.startsWith('0')) return '+' + countryCode + s.slice(1);
  // Already has country code (e.g. 2348012345678)
  if (s.startsWith(countryCode)) return '+' + s;
  // Fallback: assume it's a local number missing the leading 0
  return '+' + countryCode + s;
}

const nowIso = () => new Date().toISOString();

// ---- Core operations ----

// Record a check-in. Returns { person, isReturning, visitNumber }.
export function checkIn({ name, phone, email, howHeard, service, notes }) {
  const normPhone = normalizePhone(phone);
  const now = nowIso();

  let person = normPhone
    ? db.prepare('SELECT * FROM people WHERE phone = ?').get(normPhone)
    : null;

  const isReturning = Boolean(person);

  if (!person) {
    const info = db.prepare(
      `INSERT INTO people (name, phone, email, how_heard, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(name, normPhone, email || null, howHeard || null, notes || null, now);
    person = db.prepare('SELECT * FROM people WHERE id = ?').get(info.lastInsertRowid);
  } else {
    // Light update: fill any gaps without overwriting good data.
    db.prepare(
      `UPDATE people SET
         name = COALESCE(NULLIF(?, ''), name),
         email = COALESCE(NULLIF(?, ''), email),
         how_heard = COALESCE(how_heard, ?)
       WHERE id = ?`
    ).run(name || '', email || '', howHeard || null, person.id);
    person = db.prepare('SELECT * FROM people WHERE id = ?').get(person.id);
  }

  db.prepare(
    'INSERT INTO visits (person_id, visited_at, service) VALUES (?, ?, ?)'
  ).run(person.id, now, service || null);

  const visitNumber = db.prepare(
    'SELECT COUNT(*) AS c FROM visits WHERE person_id = ?'
  ).get(person.id).c;

  return { person, isReturning, visitNumber };
}

export function getPerson(id) {
  return db.prepare('SELECT * FROM people WHERE id = ?').get(id);
}

export function listPeople() {
  return db.prepare(`
    SELECT p.*,
           (SELECT COUNT(*) FROM visits v WHERE v.person_id = p.id) AS visit_count,
           (SELECT MAX(visited_at) FROM visits v WHERE v.person_id = p.id) AS last_visit,
           (SELECT COUNT(*) FROM messages m WHERE m.person_id = p.id AND m.status IN ('sent','dryrun')) AS messages_sent,
           (SELECT status FROM messages m WHERE m.person_id = p.id ORDER BY m.sent_at DESC LIMIT 1) AS last_msg_status,
           (SELECT error  FROM messages m WHERE m.person_id = p.id ORDER BY m.sent_at DESC LIMIT 1) AS last_msg_error
    FROM people p
    ORDER BY p.created_at DESC
  `).all();
}

// Most recent follow-up messages (any status), newest first, for the dashboard.
export function listRecentMessages(limit = 30) {
  return db.prepare(`
    SELECT m.step, m.channel, m.status, m.error, m.sent_at, p.name AS person_name, p.phone AS person_phone
    FROM messages m JOIN people p ON p.id = m.person_id
    ORDER BY m.sent_at DESC
    LIMIT ?
  `).all(limit);
}

export function stats() {
  const total = db.prepare('SELECT COUNT(*) AS c FROM people').get().c;
  const returners = db.prepare(`
    SELECT COUNT(*) AS c FROM (
      SELECT person_id FROM visits GROUP BY person_id HAVING COUNT(*) > 1
    )
  `).get().c;
  const visitsThisWeek = db.prepare(`
    SELECT COUNT(*) AS c FROM visits
    WHERE datetime(visited_at) >= datetime('now', '-7 days')
  `).get().c;
  const messagesSent = db.prepare(
    "SELECT COUNT(*) AS c FROM messages WHERE status IN ('sent','dryrun')"
  ).get().c;
  const messagesFailed = db.prepare(
    "SELECT COUNT(*) AS c FROM messages WHERE status = 'failed'"
  ).get().c;
  return { total, returners, visitsThisWeek, messagesSent, messagesFailed };
}

// Has a given follow-up step already been attempted for this person?
export function hasMessage(personId, step) {
  return Boolean(
    db.prepare(
      "SELECT 1 FROM messages WHERE person_id = ? AND step = ? AND status IN ('sent','dryrun') LIMIT 1"
    ).get(personId, step)
  );
}

export function logMessage({ personId, step, channel, status, providerId, error, body }) {
  db.prepare(
    `INSERT INTO messages (person_id, step, channel, status, provider_id, error, body, sent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(personId, step, channel || null, status, providerId || null, error || null, body || null, nowIso());
}

// People whose first visit was N whole days ago (for a given follow-up step),
// who haven't already received that step and haven't opted out.
export function peopleDueForStep(step, daysAfter) {
  return db.prepare(`
    SELECT p.* FROM people p
    WHERE p.opted_out = 0
      AND datetime(p.created_at) <= datetime('now', ?)
      AND p.id NOT IN (
        SELECT person_id FROM messages WHERE step = ? AND status IN ('sent','dryrun')
      )
  `).all(`-${daysAfter} days`, step);
}

export function setOptOut(personId, value = 1) {
  db.prepare('UPDATE people SET opted_out = ? WHERE id = ?').run(value, personId);
}

export default db;
