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

## Deploy it (free) — Render in ~5 minutes

This repo includes `render.yaml`, so Render sets everything up for you. **One free
web service runs both the check-in form and the daily follow-up** (set
`RUN_SCHEDULER=true`, which the blueprint already does) — no separate cron needed.

1. Push this repo to GitHub (already done if you're reading this there).
2. Go to **https://render.com** → sign up (free) → **New → Blueprint**.
3. Connect your GitHub and pick this repo. Render reads `church-followup/render.yaml`.
4. When prompted, fill in:
   - `CHURCH_NAME` — your church's name
   - `ADMIN_PASSWORD` — a password for the staff dashboard
   - (leave the Twilio values blank for now — it runs in safe dry-run mode)
5. Click **Apply**. In a minute you get a public URL like
   `https://church-followup.onrender.com`.

That's it. The QR code on `/dashboard` automatically points at your real URL —
**print it and you're live.** Follow-up messages will be *logged* (dry-run) until
you add Twilio keys (see the WhatsApp section above), then redeploy with
`MESSAGING_LIVE=true`.

**Railway** works the same way (New Project → Deploy from GitHub → set the same env
vars → it auto-detects the public domain).

> **Two caveats on free tiers (fine for a prototype, know them anyway):**
> 1. Free services *sleep* after inactivity, so the first scan after a quiet spell
>    takes a few seconds to wake. 2. Free disk is wiped on redeploy, so the visitor
>    database resets when you push changes. For steady use later, add a small Render
>    persistent disk (point `DB_PATH` at it) or move to a hosted database.

---

## Privacy

- Visitors' details are stored only in your own database file.
- The `day7` message includes a **STOP** opt-out line; `setOptOut()` in `db.js`
  marks someone as opted-out so they get no further messages.
- Only send to people who gave you their number at check-in.
