// The scheduler. Run this once a day (e.g. every evening). It looks at the
// follow-up plan, finds everyone who is due for a step they haven't received,
// sends it (or dry-runs it), and records the result so nobody is messaged twice.
//
// Run manually:   npm run followup
// Run on a timer: a host cron job, or see runForever() at the bottom.

import { config, isDryRun } from './config.js';
import { peopleDueForStep, hasMessage, logMessage } from './db.js';
import { followUpPlan, renderBody } from './followup-plan.js';
import { sendFollowUp } from './messaging.js';

// Send a single follow-up step to one person (used by both the scheduler and
// the instant "thank you" on check-in). Safe to call twice — it won't resend a
// step the person already received.
export async function sendStep(person, step) {
  if (hasMessage(person.id, step.step)) return null;
  const body = renderBody(step.body, person, config.churchName);
  const result = await sendFollowUp(person, body);
  logMessage({
    personId: person.id,
    step: step.step,
    channel: result.channel,
    status: result.status,
    providerId: result.providerId,
    error: result.error,
    body,
  });
  console.log(`  ${step.step} -> ${person.name} (${person.phone || person.email || 'no contact'}): ${result.status}`);
  return result;
}

export async function runOnce() {
  const mode = isDryRun() ? 'DRY RUN (no real messages)' : 'LIVE';
  console.log(`\n=== Follow-up run @ ${new Date().toISOString()} — ${mode} ===`);
  let processed = 0;

  for (const step of followUpPlan) {
    const due = peopleDueForStep(step.step, step.daysAfter);
    for (const person of due) {
      const result = await sendStep(person, step);
      if (result) processed++;
    }
  }

  console.log(`=== Done. ${processed} message(s) processed. ===\n`);
  return processed;
}

// Optional: keep the process alive and run every 24h without an external cron.
export function runForever() {
  const DAY = 24 * 60 * 60 * 1000;
  runOnce();
  setInterval(runOnce, DAY);
  console.log('Scheduler running: will send due follow-ups every 24 hours. Ctrl+C to stop.');
}

// If invoked directly (node src/followup.js) run once and exit.
const invokedDirectly = process.argv[1] && process.argv[1].endsWith('followup.js');
if (invokedDirectly) {
  if (process.argv.includes('--forever')) {
    runForever();
  } else {
    runOnce().then(() => process.exit(0));
  }
}
