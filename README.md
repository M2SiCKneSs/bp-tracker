# מעקב לחץ דם — Blood Pressure Tracker

A single-user Hebrew PWA for logging blood pressure, charting the trend, and getting
reminder notifications on an Android phone.

- **Frontend:** Vite + React + TypeScript, Recharts, RTL Hebrew UI
- **Backend:** Supabase free tier (Postgres, Auth, Edge Functions, `pg_cron`)
- **Hosting:** GitHub Pages, deployed by GitHub Actions on every push to `main`
- **Notifications:** Web Push (VAPID) — daily reminder + a "you didn't measure today" nudge

Everything used here is on a free tier.

---

## 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. **SQL Editor** → paste and run [`supabase/migrations/20260909000000_init.sql`](supabase/migrations/20260909000000_init.sql).
3. **Authentication → Users → Add user** → create your single account
   (email + password, "Auto Confirm User" on).
4. **Authentication → Sign In / Providers** → turn **off** "Allow new users to sign up".
   The site is public, so this is what stops anyone else from registering.
5. **Project Settings → API** → copy the **Project URL** and the **anon public** key.

## 2. Run it locally

```bash
cp .env.example .env.local     # then fill in the URL and anon key
npm install
npm run dev
```

Open the printed URL and sign in with the account from step 1.3.

## 3. Push notifications

Generate the VAPID key pair once:

```bash
npx web-push generate-vapid-keys
```

- **Public key** → `VITE_VAPID_PUBLIC_KEY` in `.env.local`, and as a GitHub repo secret.
- **Private key** → Supabase secret only. Never commit it.

Deploy the sender ([Supabase CLI](https://supabase.com/docs/guides/cli) required):

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF
supabase secrets set VAPID_PUBLIC_KEY=...  VAPID_PRIVATE_KEY=...  VAPID_SUBJECT=mailto:you@example.com
supabase functions deploy send-reminder --use-api
```

`--use-api` bundles the function on Supabase's side instead of in a local Docker
container. On Windows the Docker path is worth avoiding: the CLI passes a Windows
path as a container volume spec and Docker rejects it (`invalid volume
specification`).

Then schedule the hourly tick: open [`supabase/schedule.sql`](supabase/schedule.sql),
replace `YOUR-PROJECT-REF`, store the service-role key in Vault as the file describes,
and run it in the SQL Editor.

Supabase renamed the API keys: the **publishable** key is the old `anon` key, and the
**secret** key (`sb_secret_...`) is the old `service_role`. Step 4 wants the secret one.
The cron job sends it as both `Authorization: Bearer` and `apikey`, because the legacy
key is a JWT the gateway validates via `Authorization` while the newer format is
accepted as `apikey`.

The job runs every hour and the function decides whether the current hour matches your
configured reminder time **in your own timezone**, so DST needs no maintenance.

## 4. Deploy to GitHub Pages

1. Create a **public** repo (free Pages requires public) and push this project to `main`.
2. **Settings → Secrets and variables → Actions** → add three repository secrets:
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`.
3. **Settings → Pages → Source: GitHub Actions**.
4. Push. The workflow builds and publishes to `https://<user>.github.io/<repo>/`.

> These three values are baked into the JavaScript bundle and are readable by anyone.
> That is fine and intended: the anon key is guarded by row level security, and the VAPID
> public key is meant for the browser. The **service-role** key and the VAPID **private**
> key live only in Supabase and must never appear in the repo.

If you name the repo `<username>.github.io`, the site is served from the root — set
`VITE_BASE_PATH=/` in the workflow instead of the repo-name default.

## 5. Install on the phone

1. Open the Pages URL in **Chrome on Android**.
2. Menu → **Add to Home screen** (הוספה למסך הבית).
3. Open the app **from the home-screen icon**, sign in.
4. **הגדרות** tab → enable notifications, set the hours, save.
5. Press **שלח התראת בדיקה** to confirm push works end to end.

Push requires HTTPS, so it only works on the deployed site — not on `localhost` over
plain HTTP, and not from a browser tab that was never granted permission.

---

## Project layout

| Path | What it is |
|---|---|
| `src/lib/strings.ts` | Every Hebrew string in the UI, in one place |
| `src/lib/bp.ts` | AHA blood-pressure categories and chart reference values |
| `src/lib/dates.ts` | Local-date helpers (deliberately avoiding UTC conversion) |
| `src/lib/readings.ts` | Supabase CRUD + client-side validation |
| `src/lib/push.ts` | Service worker registration and push subscription |
| `src/sw.ts` | Service worker: precache, `push`, `notificationclick` |
| `src/components/` | Login, EntryTab, GraphTab, HistoryList, SettingsTab |
| `supabase/migrations/` | Schema and row level security |
| `supabase/functions/` | The hourly reminder sender |
| `scripts/make-icons.mjs` | Generates the PWA icons (`npm run icons`) |

## Notes on a couple of choices

**Dates are stored as `date`, not `timestamp`.** A reading belongs to the day you took
it. The app formats today's date from local getters rather than `toISOString()`, which
would file an evening reading in Israel under the previous day.

**Pulse gets its own chart panel.** It is measured in bpm while blood pressure is mmHg,
so putting both on one y-axis would be a mixed-unit scale. Toggling "הצג דופק" reveals a
second panel sharing the same time axis.

**`pg_cron`, not a GitHub Actions schedule.** Actions cron is frequently delayed by
5–20 minutes and is auto-disabled after 60 days of repo inactivity — both bad properties
for a health reminder.
