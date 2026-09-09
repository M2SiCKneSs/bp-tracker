# מעקב לחץ דם — Blood Pressure Tracker

A single-user Hebrew PWA for logging blood pressure, charting the trend, and getting
reminder notifications on an Android phone. Everything it uses is on a free tier.

- **Frontend:** Vite + React + TypeScript, Recharts, RTL Hebrew UI
- **Backend:** Supabase (Postgres, Auth, Edge Functions, `pg_cron`)
- **Hosting:** GitHub Pages, deployed by GitHub Actions on every push to `main`
- **Notifications:** Web Push (VAPID) — a daily reminder plus a "you didn't measure
  today" nudge

No native app is needed: Chrome on Android supports Web Push, so an installed PWA
delivers real system notifications.

---

## Live deployment

| | |
|---|---|
| Site | https://m2sickness.github.io/bp-tracker/ |
| Repo | https://github.com/M2SiCKneSs/bp-tracker (public — free Pages requires it) |
| Supabase project | `ezvzkrnsihxmnzwzvdfi`, region `ap-northeast-1` (Tokyo) |
| Dashboard | https://supabase.com/dashboard/project/ezvzkrnsihxmnzwzvdfi |

The database is in Tokyo rather than Frankfurt — roughly 250–300ms round trip from
Israel instead of ~60ms, so about half a second of extra delay when opening the app.
This was a deliberate choice to avoid recreating the project. Reminders are unaffected;
they run server-side. Changing it later means a project recreate plus a data migration.

## What the app does

**הזנה (Entry)** — date defaulting to today, systolic, diastolic, optional pulse, a
morning/evening/other tag preselected from the current hour, and an optional note.
Saving shows the AHA category (תקין / גבולי / שלב 1 / שלב 2 / crisis). Below the form,
the last ten readings, each editable by tapping and deletable.

**גרף (Graph)** — systolic and diastolic over time with reference lines at 120/80 and
140/90, a range selector (30 יום / 90 יום / שנה / הכל), a morning/evening filter,
averages and count, a hover tooltip, and a table view. Pulse gets its own panel below
rather than sharing the axis.

**הגדרות (Settings)** — notification toggle with a live status readout, timezone, the
two reminder hours, a test-push button, and sign-out.

Reminders are sent by an Edge Function that `pg_cron` calls every hour. The function
compares the current hour *in the user's own timezone* against the configured reminder
hours, so daylight saving needs no maintenance. The missed-day nudge only fires when no
reading exists for that local date.

---

## Setup state

Done and verified:

- [x] Repo created, GitHub Pages enabled with Actions as the source
- [x] Schema applied (`readings`, `push_subscriptions`, `reminder_settings`)
- [x] Row level security — anonymous reads return empty, anonymous insert refused (`42501`)
- [x] Three build values set as repo secrets and baked into the published bundle
- [x] `send-reminder` Edge Function deployed
- [x] VAPID pair generated; the private half exists only in Supabase secrets
- [x] Hourly `pg_cron` job `bp-reminders` scheduled and active
- [x] Full chain proven: `pg_cron` → `net.http_post` → function → **200**
- [x] Service worker active at the `/bp-tracker/` scope; manifest installable
- [x] Logic covered by ad-hoc checks: AHA boundaries, local-date handling across
      month/leap/year edges, validation rules, and timezone/DST hour matching

Outstanding:

- [ ] **Public signups are still enabled.** Anyone who finds the URL can register.
      Fix at Authentication → Providers → Email → *Allow new users to sign up* → off.
- [ ] End-to-end push confirmed on the phone (install to home screen, enable
      notifications, tap **שלח התראת בדיקה**)

---

## Rebuilding from scratch

### 1. Supabase

1. Create a project (free tier).
2. SQL Editor → run [`supabase/migrations/20260909000000_init.sql`](supabase/migrations/20260909000000_init.sql).
3. Authentication → Users → **Add user**, with *Auto Confirm User* on. This is the app
   login, separate from the Supabase account login.
4. Authentication → Providers → Email → turn **off** *Allow new users to sign up*.
5. Settings → API → copy the **Project URL** and the **publishable** key.

Supabase renamed its API keys: **publishable** is the old `anon`, and **secret**
(`sb_secret_...`) is the old `service_role`.

### 2. Local

```bash
cp .env.example .env.local     # fill in URL, publishable key, VAPID public key
npm install
npm run dev
```

### 3. Push notifications

```powershell
$vapid = npx web-push generate-vapid-keys --json | ConvertFrom-Json
npx supabase secrets set "VAPID_PUBLIC_KEY=$($vapid.publicKey)" "VAPID_PRIVATE_KEY=$($vapid.privateKey)" "VAPID_SUBJECT=mailto:you@example.com"
$vapid.publicKey    # goes in .env.local and the GitHub secret
```

The public key must match in three places — Supabase secrets, `.env.local`, and the
`VITE_VAPID_PUBLIC_KEY` repo secret — or pushes get signed with a key the browser never
subscribed to.

```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push
supabase functions deploy send-reminder --use-api
```

Then schedule the hourly tick with [`supabase/schedule.sql`](supabase/schedule.sql),
after storing the secret key in Vault as that file describes.

### 4. GitHub Pages

Public repo; add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and
`VITE_VAPID_PUBLIC_KEY` as Actions secrets; Settings → Pages → Source: **GitHub
Actions**; push.

> Those three values are compiled into the JavaScript bundle and readable by anyone.
> That is intended: the publishable key is guarded by row level security and the VAPID
> public key is meant for the browser. The **secret** key and the VAPID **private** key
> live only in Supabase and must never enter the repo.

Name the repo `<username>.github.io` to serve from the root; otherwise the workflow sets
`VITE_BASE_PATH=/<repo>/` automatically.

### 5. On the phone

Open in Chrome on Android → menu → **הוספה למסך הבית** → open from the icon → sign in →
**הגדרות** → enable notifications → **שלח התראת בדיקה**. Push requires HTTPS and the
installed app; it will not work from a plain browser tab over `localhost`.

---

## Verifying the reminder chain

Fire the exact request the cron job makes, **as its own execution**:

```sql
select net.http_post(
  url := 'https://ezvzkrnsihxmnzwzvdfi.supabase.co/functions/v1/send-reminder',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
    'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
  )
);
```

Then, in a **separate** execution:

```sql
select id, status_code, left(content, 300) as body from net._http_response order by id desc limit 5;
```

A healthy reply is `200` with `{"ran":"...","results":[]}`. Empty `results` is expected
unless the current hour matches a configured reminder hour. Scheduled runs are recorded
in `cron.job_run_details`.

---

## Project layout

| Path | What it is |
|---|---|
| `src/lib/strings.ts` | Every Hebrew string in the UI, in one place |
| `src/lib/bp.ts` | AHA categories and the chart's reference values |
| `src/lib/dates.ts` | Local-date helpers, deliberately avoiding UTC conversion |
| `src/lib/validate.ts` | Pure input validation — no Supabase import, so it is testable alone |
| `src/lib/readings.ts` | Supabase CRUD |
| `src/lib/push.ts` | Service worker registration, subscription, staleness detection |
| `src/sw.ts` | Service worker: precache, `push`, `notificationclick` |
| `src/components/` | Login, EntryTab, GraphTab, HistoryList, SettingsTab |
| `supabase/migrations/` | Schema and row level security |
| `supabase/functions/send-reminder/` | The hourly reminder sender |
| `supabase/schedule.sql` | The `pg_cron` job |
| `scripts/make-icons.mjs` | Generates the PWA icons (`npm run icons`) — no image deps |

Commands: `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint`,
`npm run icons`.

---

## Decisions worth knowing

**Dates are `date`, not `timestamp`.** A reading belongs to the day you took it. Today's
date is formatted from local getters, never `toISOString()`, which would file an evening
reading in Israel under the previous day.

**Pulse gets its own chart panel.** It is bpm while blood pressure is mmHg, so a shared
y-axis would be a mixed-unit scale.

**`pg_cron`, not a GitHub Actions schedule.** Actions cron is routinely delayed 5–20
minutes and is auto-disabled after 60 days of repo inactivity — poor traits for a health
reminder.

**Auth is one manually created user with signups disabled.** The site is public, so RLS
plus a closed signup gate is what keeps the data private. There is no user-management UI.

## Gotchas hit while building this

**SVG `text-anchor` flips under `dir="rtl"`.** The right-hand Y axis labels rendered
*inside* the plot and collided with the data lines. Fixed by forcing `direction: ltr` on
the chart surface; the tooltip stays RTL. Time still runs left→right, the convention for
time series even in Hebrew material.

**Push subscriptions are bound for life to their `applicationServerKey`.** Rotating the
VAPID pair silently invalidates every existing subscription — it still looks registered
locally while the push service rejects everything. `push.ts` compares the stored key
against the current one and re-subscribes when they differ.

**Report what was actually sent.** The test-push button originally showed success on any
HTTP 200, including `{"sent":0}`, which hid exactly this failure.

**`supabase functions deploy` needs `--use-api` on Windows.** Otherwise the CLI passes a
Windows path as a Docker volume spec and Docker rejects it with `invalid volume
specification`.

**Migrations must be named `<timestamp>_name.sql`.** `0001_init.sql` is ignored by
`db push`.

**`pg_net` dispatches only on transaction commit.** Posting and reading
`net._http_response` in one SQL block always shows an empty table, because the request
has not been sent yet. Use two separate executions.

**PowerShell eats `<angle brackets>`** — it parses `<` as redirection. A command written
with `<your-key>` placeholders silently truncates arguments; a VAPID private key once
arrived as 18 characters instead of 43, and the subject was stored as the literal
placeholder text. Assign to a variable first, then pass `"NAME=$var"` quoted.

**A malformed VAPID key throws at Edge Function module load**, which the platform
surfaces only as an opaque `WORKER_ERROR 500`. The function now catches it and reports
the reason plus the observed key lengths.
