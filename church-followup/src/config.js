// Central configuration. Everything is read from environment variables so you
// never put secrets in code. Copy .env.example to .env and fill it in, OR set
// these in your host's dashboard (Render/Railway). Nothing here is required to
// RUN the app — with no Twilio keys it stays in safe "dry run" mode and just
// logs the messages it WOULD send.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal .env loader (no dependency). Lines like KEY=value. Ignores # comments.
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

export const config = {
  port: Number(process.env.PORT || 3000),

  // The church's details (used in messages and on the form).
  churchName: process.env.CHURCH_NAME || 'Our Church',
  // The public base URL where this app is hosted, e.g. https://followup.ourchurch.org
  // Used to build the QR-code link. On Render/Railway this is detected
  // automatically, so the QR code points at the real site with no manual step.
  baseUrl:
    process.env.BASE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '') ||
    `http://localhost:${process.env.PORT || 3000}`,

  // If "true", the web process also runs the daily follow-up loop in-process,
  // so a single free web service does everything (no separate cron needed).
  runScheduler: String(process.env.RUN_SCHEDULER || 'false').toLowerCase() === 'true',

  // Password for the staff dashboard (Basic Auth username is "admin").
  adminPassword: process.env.ADMIN_PASSWORD || 'changeme',

  // Default country for phone numbers. Nigeria = 234.
  defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || '234',

  // --- Messaging (Twilio). Leave blank to stay in dry-run mode. ---
  // When LIVE is "true" AND the Twilio keys are present, messages are really sent.
  messagingLive: String(process.env.MESSAGING_LIVE || 'false').toLowerCase() === 'true',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    // Your Twilio WhatsApp sender, e.g. whatsapp:+14155238886 (sandbox) or your approved number.
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM || '',
    // Your Twilio SMS-capable number, e.g. +1XXXXXXXXXX.
    smsFrom: process.env.TWILIO_SMS_FROM || '',
  },

  // Optional email (SMTP via a simple HTTP provider is out of scope for the
  // prototype; email is logged in dry-run. Wire your provider later in messaging.js).
  emailFrom: process.env.EMAIL_FROM || '',

  // Database file location.
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'church.db'),
};

export function isDryRun() {
  return !(config.messagingLive && config.twilio.accountSid && config.twilio.authToken);
}
