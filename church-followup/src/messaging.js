// Sending layer. Tries WhatsApp first, falls back to SMS, then email.
// Uses Twilio's REST API directly via fetch (no SDK dependency).
// In dry-run mode (no live keys) it logs what it WOULD send and returns success,
// so the whole system is fully testable before you ever pay for anything.

import { config, isDryRun } from './config.js';

function twilioAuthHeader() {
  const token = Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64');
  return `Basic ${token}`;
}

async function twilioSend({ to, from, body }) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`;
  const form = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: twilioAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Twilio ${res.status}: ${data.message || JSON.stringify(data)}`);
  }
  return data.sid;
}

// Attempt the channels in order of preference. Returns a result object.
export async function sendFollowUp(person, body) {
  const dry = isDryRun();

  // Build the ordered list of channels we can actually try for this person.
  const attempts = [];
  if (person.phone && config.twilio.whatsappFrom) {
    attempts.push({ channel: 'whatsapp', to: `whatsapp:${person.phone}`, from: config.twilio.whatsappFrom });
  }
  if (person.phone && config.twilio.smsFrom) {
    attempts.push({ channel: 'sms', to: person.phone, from: config.twilio.smsFrom });
  }
  // (Email is logged only in this prototype — plug your provider in below.)
  if (person.email && config.emailFrom) {
    attempts.push({ channel: 'email', to: person.email, from: config.emailFrom });
  }

  if (attempts.length === 0 && person.phone) {
    // No sender numbers configured yet, but we have a phone — still exercise the
    // flow in dry-run so you can see the message content.
    attempts.push({ channel: 'whatsapp', to: `whatsapp:${person.phone}`, from: '(unconfigured)' });
  }

  if (attempts.length === 0) {
    return { channel: null, status: 'skipped', error: 'no phone or email on record' };
  }

  for (const a of attempts) {
    if (dry) {
      console.log(`\n[DRY RUN] ${a.channel.toUpperCase()} -> ${a.to}\n${body}\n`);
      return { channel: a.channel, status: 'dryrun' };
    }
    try {
      if (a.channel === 'email') {
        // TODO: integrate your email provider here (e.g. SendGrid/Resend HTTP API).
        console.log(`[EMAIL not wired for live send] -> ${a.to}`);
        continue;
      }
      const sid = await twilioSend({ to: a.to, from: a.from, body });
      return { channel: a.channel, status: 'sent', providerId: sid };
    } catch (err) {
      console.error(`[send failed on ${a.channel}] ${err.message}`);
      // fall through to the next channel
      if (a === attempts[attempts.length - 1]) {
        return { channel: a.channel, status: 'failed', error: err.message };
      }
    }
  }
  return { channel: null, status: 'failed', error: 'all channels failed' };
}
