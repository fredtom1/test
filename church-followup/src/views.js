// Tiny HTML templating — plain template strings, mobile-first, no framework.
import { config } from './config.js';

const esc = (s) =>
  String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

function page(title, body, { narrow = true } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(config.churchName)}</title>
<style>
  :root { --bg:#0f1221; --card:#191d33; --ink:#eef0f7; --muted:#9aa3bd; --brand:#6c7bff; --ok:#39d98a; --warn:#ffcb5e; }
  * { box-sizing:border-box; }
  body { margin:0; font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:var(--bg); color:var(--ink); }
  .wrap { max-width:${narrow ? '480' : '1000'}px; margin:0 auto; padding:24px 16px 60px; }
  .card { background:var(--card); border:1px solid #262b47; border-radius:16px; padding:20px; margin-bottom:16px; }
  h1 { font-size:1.4rem; margin:.2rem 0 .2rem; }
  h2 { font-size:1.05rem; margin:0 0 .6rem; }
  .muted { color:var(--muted); }
  label { display:block; font-weight:600; margin:14px 0 6px; }
  input, select, textarea { width:100%; padding:12px 14px; border-radius:10px; border:1px solid #2d3357; background:#10152a; color:var(--ink); font-size:16px; }
  button { margin-top:18px; width:100%; padding:14px; border:0; border-radius:12px; background:var(--brand); color:#fff; font-size:17px; font-weight:700; }
  button:active { transform:translateY(1px); }
  .big { font-size:2.6rem; margin:.3rem 0; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; }
  .stat { background:var(--card); border:1px solid #262b47; border-radius:14px; padding:16px; }
  .stat .n { font-size:1.9rem; font-weight:800; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:10px 8px; border-bottom:1px solid #262b47; vertical-align:top; }
  th { color:var(--muted); font-weight:600; }
  .pill { display:inline-block; padding:2px 9px; border-radius:999px; font-size:12px; font-weight:700; }
  .pill.new { background:#23305c; color:#9db4ff; }
  .pill.ret { background:#163a2c; color:var(--ok); }
  .pill.ok-msg { background:#163a2c; color:var(--ok); }
  .pill.bad-msg { background:#4a1f26; color:#ff8f8f; }
  .pill.muted-msg { background:#2a2f45; color:var(--muted); }
  a { color:var(--brand); }
  .footer { text-align:center; color:var(--muted); margin-top:24px; font-size:13px; }
</style>
</head>
<body><div class="wrap">${body}
<div class="footer">${esc(config.churchName)} · Visitor Follow-up</div>
</div></body></html>`;
}

export function checkInForm({ service = '', error = '' } = {}) {
  return page('Welcome', `
  <div class="card">
    <h1>Welcome to ${esc(config.churchName)} 👋</h1>
    <p class="muted">We're so glad you're here. Please leave your details so we can say a proper hello.</p>
    ${error ? `<p style="color:var(--warn)">${esc(error)}</p>` : ''}
    <form method="POST" action="/checkin">
      <input type="hidden" name="service" value="${esc(service)}">
      <label>Your name</label>
      <input name="name" required placeholder="Jane Doe" autocomplete="name">
      <label>Phone number</label>
      <input name="phone" required placeholder="0801 234 5678" inputmode="tel" autocomplete="tel">
      <label>Email <span class="muted">(optional)</span></label>
      <input name="email" type="email" placeholder="jane@email.com" autocomplete="email">
      <label>How did you hear about us? <span class="muted">(optional)</span></label>
      <select name="howHeard">
        <option value="">Select…</option>
        <option>A friend or family member</option>
        <option>Social media</option>
        <option>Walked / drove past</option>
        <option>Online search</option>
        <option>An event or outreach</option>
        <option>Other</option>
      </select>
      <button type="submit">I'm here 🎉</button>
    </form>
  </div>`);
}

export function thankYou({ person, isReturning, visitNumber }) {
  const first = esc((person.name || 'friend').split(/\s+/)[0]);
  return page('Thank you',
    isReturning
      ? `<div class="card" style="text-align:center">
           <div class="big">🎉</div>
           <h1>Welcome back, ${first}!</h1>
           <p class="muted">This is visit #${visitNumber}. It means so much that you came back — we've let our team know.</p>
         </div>`
      : `<div class="card" style="text-align:center">
           <div class="big">🙏</div>
           <h1>Thank you, ${first}!</h1>
           <p class="muted">You're now part of the family. Look out for a friendly message from us soon.</p>
         </div>`);
}

function msgBadge(status, error) {
  if (status === 'sent' || status === 'dryrun')
    return `<span class="pill ok-msg">✅ ${status === 'dryrun' ? 'logged' : 'sent'}</span>`;
  if (status === 'failed')
    return `<span class="pill bad-msg" title="${esc(error || '')}">❌ failed</span>`;
  if (status === 'skipped')
    return `<span class="pill muted-msg" title="${esc(error || '')}">— skipped</span>`;
  return `<span class="muted" style="font-size:12px">none yet</span>`;
}

export function dashboard({ stats, people, recentMessages = [], baseUrl, dryRun }) {
  const rows = people.map((p) => {
    const ret = p.visit_count > 1;
    return `<tr>
      <td>${esc(p.name)}<div class="muted" style="font-size:12px">${esc(p.phone || p.email || '')}</div></td>
      <td><span class="pill ${ret ? 'ret' : 'new'}">${ret ? 'Returning ×' + p.visit_count : 'First time'}</span></td>
      <td>${esc((p.last_visit || p.created_at || '').slice(0, 10))}</td>
      <td>${msgBadge(p.last_msg_status, p.last_msg_error)}</td>
      <td class="muted">${esc(p.how_heard || '')}</td>
    </tr>`;
  }).join('');

  const msgRows = recentMessages.map((m) => `
    <tr>
      <td>${esc(m.person_name)}<div class="muted" style="font-size:12px">${esc(m.person_phone || '')}</div></td>
      <td class="muted">${esc(m.step)}</td>
      <td>${msgBadge(m.status, m.error)}</td>
      <td class="muted" style="font-size:12px">${esc(m.error || (m.status === 'sent' ? 'delivered to provider' : ''))}</td>
      <td class="muted" style="font-size:12px">${esc((m.sent_at || '').slice(0, 16).replace('T', ' '))}</td>
    </tr>`).join('');

  const checkinUrl = `${baseUrl}/checkin`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(checkinUrl)}`;

  return page('Dashboard', `
  <h1>Follow-up Dashboard</h1>
  <p class="muted">${dryRun
    ? '⚠️ <strong>Dry-run mode</strong> — follow-up messages are being logged, not sent. Add Twilio keys to go live.'
    : '✅ <strong>Live</strong> — follow-up messages are being sent for real.'}</p>

  <div class="grid" style="margin-bottom:16px">
    <div class="stat"><div class="n">${stats.total}</div><div class="muted">People</div></div>
    <div class="stat"><div class="n">${stats.returners}</div><div class="muted">Returned ≥2×</div></div>
    <div class="stat"><div class="n">${stats.visitsThisWeek}</div><div class="muted">Visits this week</div></div>
    <div class="stat"><div class="n">${stats.messagesSent}</div><div class="muted">Sent ✅</div></div>
    <div class="stat"><div class="n" style="${stats.messagesFailed ? 'color:#ff8f8f' : ''}">${stats.messagesFailed}</div><div class="muted">Failed ❌</div></div>
  </div>

  ${stats.messagesFailed ? `<div class="card" style="border-color:#5a2a2a;background:#2a1a1f">
    <strong style="color:#ff8f8f">Some messages failed to send.</strong>
    <p class="muted" style="margin:.4rem 0 0">See the reason in the <em>Recent follow-up messages</em> table below. The most common cause with the Twilio WhatsApp sandbox is that the recipient's phone hasn't sent the <code>join</code> code yet.</p>
  </div>` : ''}

  <div class="card">
    <h2>Check-in QR code</h2>
    <p class="muted">Print this. New and returning visitors scan it each service.</p>
    <div style="text-align:center"><img src="${qr}" alt="QR code" width="220" height="220" style="background:#fff;border-radius:12px;padding:8px"></div>
    <p class="muted" style="text-align:center;word-break:break-all">${esc(checkinUrl)}</p>
  </div>

  <div class="card">
    <h2>Visitors</h2>
    <table>
      <thead><tr><th>Name</th><th>Status</th><th>Last visit</th><th>Follow-up</th><th>Heard via</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="muted">No check-ins yet.</td></tr>'}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>Recent follow-up messages</h2>
    <p class="muted" style="margin-top:0">Every send attempt, newest first — including failures and why they failed.</p>
    <table>
      <thead><tr><th>To</th><th>Step</th><th>Result</th><th>Detail / error</th><th>When</th></tr></thead>
      <tbody>${msgRows || '<tr><td colspan="5" class="muted">No messages attempted yet.</td></tr>'}</tbody>
    </table>
  </div>`, { narrow: false });
}
