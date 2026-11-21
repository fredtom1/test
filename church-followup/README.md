# Church Visitor Follow-up

Automatically follow up with first-time visitors, and know when they come back.

A first-timer **scans a QR code**, fills a short form on their phone, and lands
in your visitor database. That evening (and again on day 3 and day 7) they get a
warm, personalised **WhatsApp / SMS** follow-up — automatically. When they return
and scan the same code, the system recognises their phone number and marks it as
their **2nd visit** so your team can celebrate it.

Built to be cheap and simple: **no external database, no paid services to start.**
It runs on plain Node.js and stores everything in a single file. Messaging starts
in a safe **dry-run mode** (messages are logged, not sent) so you can try the whole
thing before paying for anything.

---

## What's inside

| Part | File | What it does |
|------|------|--------------|
| Check-in form | `src/server.js`, `src/views.js` | The mobile page the QR code opens |
| Visitor database | `src/db.js` | People + visits + message log (SQLite file) |
| Follow-up schedule | `src/followup-plan.js` | **Edit the message wording & timing here** |
| Sender | `src/messaging.js` | WhatsApp → SMS → email, via Twilio |
| Scheduler | `src/followup.js` | Sends the day-0 / day-3 / day-7 messages |
| Settings | `src/config.js`, `.env.example` | Church name, password, Twilio keys |

---

## Quick start (try it in 2 minutes)

Requires **Node.js 22.5+** (uses the built-in SQLite — nothing to install).

```bash
cd church-followup
npm run seed      # add 3 demo visitors (optional)
npm start         # start the web app
```

Then open:

- **Check-in form:** http://localhost:3000/checkin
- **Staff dashboard:** http://localhost:3000/dashboard  (user: `admin`, password: `changeme`)

Send the follow-up messages (dry-run — prints what it *would* send):

```bash
npm run followup
```

---

## Settings

Copy `.env.example` to `.env` and edit it:

```bash
cp .env.example .env
```

At minimum change `CHURCH_NAME` and `ADMIN_PASSWORD`. Everything about messaging can
stay blank — it just means the app keeps logging instead of sending.

---

## The QR code

Open `/dashboard` — the check-in QR code is shown there. **Print it** and put it on
welcome cards, seat-backs, or a screen. The same code is used every service, by new
*and* returning visitors.

(When you host this online, set `BASE_URL` in `.env` to your public address so the QR
points at the real site, not `localhost`.)

---

## Changing the follow-up messages

Open `src/followup-plan.js`. Each step has a day offset and the message text.
`{name}` becomes the person's first name, `{church}` becomes your church name.

```js
{ step: 'day0', daysAfter: 0, body: 'Hi {name}, this is {church}. It was so good...' }
```

Add, remove, or re-time steps freely.

---

## Going live with WhatsApp / SMS (Nigeria)

Messaging goes through **Twilio** (one account does WhatsApp, SMS and more).

1. Create a free Twilio account → get your **Account SID** and **Auth Token**.
2. For **SMS**: get a Twilio number. For **WhatsApp**: start with the Twilio WhatsApp
   **sandbox** (free, instant) to test; for production, register your church's
   WhatsApp sender and get your first-contact message **templates approved by Meta**
   (your `day0` message is a good template to submit).
3. Put the keys in `.env` and set `MESSAGING_LIVE=true`:

   ```
   MESSAGING_LIVE=true
   TWILIO_ACCOUNT_SID=ACxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxx
   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
   TWILIO_SMS_FROM=+1XXXXXXXXXX
   ```

The app tries **WhatsApp first, then SMS** for each person automatically.

> **Cost note (Nigeria):** WhatsApp is the cheapest and most-read channel, which is
> why it's tried first. SMS works everywhere but costs a little per message. Email is
> free but low-open — treat it as a bonus.

---

## Running the follow-up automatically every day

Pick one:

- **Simplest:** keep a scheduler process running —
  ```bash
  node --no-warnings src/followup.js --forever
  ```
  (sends due messages immediately, then every 24 hours.)
- **On a host:** add a daily **cron job** that runs `npm run followup` each evening.

---

## Hosting it for free

It's a standard Node app, so free tiers like **Render** or **Railway** work:

- Start command: `npm start`
- Add your `.env` values in the host's dashboard (don't commit `.env`).
- Set `BASE_URL` to the URL the host gives you.
- Add a daily scheduled job / cron that runs `npm run followup`.

> One caveat on truly free tiers: some wipe local disk on redeploy. For <20
> visitors/week that's usually fine, but if you want bulletproof storage later,
> point `DB_PATH` at a persistent disk or move to a hosted database.

---

## Privacy

- Visitors' details are stored only in your own database file.
- The `day7` message includes a **STOP** opt-out line; `setOptOut()` in `db.js`
  marks someone as opted-out so they get no further messages.
- Only send to people who gave you their number at check-in.
