// The web server — zero dependencies, Node's built-in http.
// Routes:
//   GET  /            -> redirect to /checkin
//   GET  /checkin     -> public mobile check-in form (QR code points here)
//   POST /checkin     -> record visit, detect returning visitors, say thanks
//   GET  /dashboard   -> staff view (Basic Auth: user "admin", password = ADMIN_PASSWORD)
//   GET  /healthz     -> uptime check for hosting

import http from 'node:http';
import { config, isDryRun } from './config.js';
import { checkIn, listPeople, stats, listRecentMessages } from './db.js';
import { checkInForm, thankYou, dashboard } from './views.js';
import { sendStep } from './followup.js';
import { followUpPlan } from './followup-plan.js';

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
}

function parseForm(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) req.destroy(); // guard
    });
    req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(data))));
  });
}

function requireAuth(req, res) {
  const header = req.headers.authorization || '';
  const expected = 'Basic ' + Buffer.from(`admin:${config.adminPassword}`).toString('base64');
  if (header === expected) return true;
  res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Staff"' });
  res.end('Authentication required.');
  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, config.baseUrl);
  const path = url.pathname;

  try {
    if (path === '/' ) {
      res.writeHead(302, { Location: '/checkin' });
      return res.end();
    }

    if (path === '/healthz') return send(res, 200, 'ok');

    if (path === '/checkin' && req.method === 'GET') {
      return send(res, 200, checkInForm({ service: url.searchParams.get('service') || '' }));
    }

    if (path === '/checkin' && req.method === 'POST') {
      const form = await parseForm(req);
      if (!form.name || !form.phone) {
        return send(res, 400, checkInForm({ service: form.service, error: 'Please enter your name and phone number.' }));
      }
      const result = checkIn({
        name: form.name,
        phone: form.phone,
        email: form.email,
        howHeard: form.howHeard,
        service: form.service,
      });
      // First-time visitor: fire the warm "thank you" (day0) right away, in the
      // background, so they get it within moments instead of waiting for the
      // nightly run. It's logged as day0, so the scheduler won't repeat it.
      if (!result.isReturning) {
        const day0 = followUpPlan.find((s) => s.step === 'day0');
        if (day0) {
          sendStep(result.person, day0).catch((err) =>
            console.error('instant day0 send failed:', err.message)
          );
        }
      }
      return send(res, 200, thankYou(result));
    }

    if (path === '/dashboard' && req.method === 'GET') {
      if (!requireAuth(req, res)) return;
      return send(res, 200, dashboard({
        stats: stats(),
        people: listPeople(),
        recentMessages: listRecentMessages(),
        baseUrl: config.baseUrl,
        dryRun: isDryRun(),
      }));
    }

    return send(res, 404, '<p>Not found. Try <a href="/checkin">/checkin</a>.</p>');
  } catch (err) {
    console.error(err);
    return send(res, 500, '<p>Something went wrong. Please try again.</p>');
  }
});

// Bind to 0.0.0.0 so cloud hosts (Render/Railway) can route traffic in.
server.listen(config.port, '0.0.0.0', () => {
  console.log(`\n${config.churchName} follow-up app running`);
  console.log(`  Check-in form : ${config.baseUrl}/checkin`);
  console.log(`  Dashboard     : ${config.baseUrl}/dashboard  (user: admin)`);
  console.log(`  Messaging     : ${isDryRun() ? 'DRY RUN (safe — nothing sent)' : 'LIVE'}`);
  console.log(`  Scheduler     : ${config.runScheduler ? 'ON (sends due follow-ups every 24h)' : 'off'}`);
  console.log('');
});

// Optionally run the daily follow-up loop inside this same process, so one
// free web service handles both the form and the automatic messages.
if (config.runScheduler) {
  const { runForever } = await import('./followup.js');
  runForever();
}
