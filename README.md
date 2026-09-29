# Kopamate

Every corper, one place. A mobile-first web app where corps members sign up in 20 seconds, get a position on the list, move up by inviting friends, and browse who has joined from each state.

Built with Next.js 15, Tailwind CSS 4 and Postgres. Designed to run on free plans: **Vercel** (hosting) + **Supabase** (database).

---

## Put it online (about 30 minutes)

### 1. Create the database (Supabase)
1. Sign up at [supabase.com](https://supabase.com) and create a new project. Pick the region closest to Nigeria (e.g. *West EU* or *Central EU*). Save the database password.
2. Open **SQL Editor → New query**, paste everything from [`db/schema.sql`](db/schema.sql) and press **Run**.
3. Open **Project settings → Database → Connection string → URI**, choose **Transaction pooler** (port 6543), and copy it. Replace `[YOUR-PASSWORD]` with your password. This is your `DATABASE_URL`.

### 2. Put the code on GitHub
Create a new private repository and upload this folder (or `git push` it).

### 3. Deploy on Vercel
1. Sign up at [vercel.com](https://vercel.com) with GitHub and click **Add New → Project**, then pick the repository.
2. Under **Environment Variables**, add:

| Name | Value |
|---|---|
| `DATABASE_URL` | the Supabase connection string from step 1 |
| `APP_URL` | your site address, e.g. `https://kopamate.vercel.app` (no slash at the end). Update it later when you add your own domain. |
| `SESSION_SECRET` | a long random string. On any computer with Node: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_IDS` | your Google email and/or WhatsApp number, comma-separated, e.g. `you@gmail.com,08031234567` |
| `CRON_SECRET` | another long random string |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from step 4 (you can add these after the first deploy) |

3. Click **Deploy**. If the build shows an error, copy it to Claude Code (or back to Claude) to fix.

### 4. Turn on "Continue with Google"
1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project, then **APIs & Services → OAuth consent screen**: choose *External*, add the app name, your email, and publish it.
2. **Credentials → Create credentials → OAuth client ID → Web application**.
3. Under **Authorised redirect URIs** add `https://YOUR-DOMAIN/auth/google/callback` (and `http://localhost:3000/auth/google/callback` for local testing).
4. Copy the client ID and secret into Vercel's environment variables, then **Redeploy**.

Without these two variables the app still works; the Google button is simply hidden.

### 5. Your own domain (optional)
In Vercel: **Project → Settings → Domains** and add e.g. `kopamate.ng`. Then update `APP_URL` and the Google redirect URI to match, and redeploy.

### 6. Check it works
- Open the site on your phone, sign up, and open **Profile → Open admin** (shows only for `ADMIN_IDS`).
- Copy your invite link, open it in a private window, and sign up as a second person. Your referral count should go up and your position should improve.
- The daily position snapshot runs automatically at 00:05 Lagos time (see `vercel.json`). The "↑ 20 since yesterday" badge appears from the second day.

---

## Run it on your computer

Needs Node 20+ and a Postgres database (local, Docker, or a free Supabase project).

```bash
cp .env.example .env          # then fill in DATABASE_URL and SESSION_SECRET
npm install
npm run db:migrate            # creates the tables
npm run db:seed               # optional: 300 fake corpers + demo login 0803 000 0001 / PIN 1234
npm run dev                   # open http://localhost:3000
```

Quick local Postgres with Docker:
```bash
docker run -d --name kopamate-db -e POSTGRES_PASSWORD=kopa -e POSTGRES_DB=kopamate -p 5432:5432 postgres:16
# DATABASE_URL=postgres://postgres:kopa@localhost:5432/kopamate
```

Never run `db:seed` against the live database.

---

## How it works

**Position.** `score = signup number − 10 × valid referrals`, ranked lowest first (ties go to whoever joined first). So each friend who joins with your link moves you up about 10 places, and new sign-ups never push existing people down. See [`lib/ranking.ts`](lib/ranking.ts).

**Valid referral.** The friend completed sign-up with a unique WhatsApp number, and neither account is flagged or banned. The referral code is stored in a cookie for 30 days when someone opens `/r/<code>`, and the most recent link wins.

**Sign-up.** Phone + WhatsApp number + state + 4-digit PIN, or Google followed by a short "Almost done" step for WhatsApp number and state. No SMS codes (they cost money); fake accounts are limited by unique numbers, max 5 sign-ups per network per hour, PIN lockout after 5 wrong tries, and the admin page.

**Privacy.** Other users only ever see nickname, photo, state and position. WhatsApp numbers, emails and state codes are never sent to other users' pages. People can hide themselves from the Corpers list or delete their account.

**Photos** are cropped and shrunk on the phone (max 400×400, usually under 40 KB) and stored in the database, so there's no extra storage service to set up.

## Pages

| Route | Page |
|---|---|
| `/` | Landing (live count, top states, coming soon, prize teaser) |
| `/r/<code>` | Landing with "X invited you" and a matching share preview |
| `/join`, `/login` | Sign up, finish Google sign-up, log in |
| `/home` | Position, daily change, next goal, share, state stats, newcomers |
| `/corpers`, `/corpers/<state>` | States list and people in a state (view only) |
| `/invite` | Your link, who joined with it, top 10 referrers |
| `/rewards` | Where you stand for prizes, rewards given to you |
| `/profile` | Photo, details, state code, hide from list, PIN, log out, delete |
| `/admin` | Stats, prize text, CSV exports, suspicious activity, users, rewards |
| `/privacy` | Privacy notice |

## Admin

Open **Profile → Open admin** (only for accounts listed in `ADMIN_IDS`).
- **Prize text**: change the "Prizes are coming" text everywhere, e.g. to announce the actual prizes.
- **First 500 counted by**: position on the list (default; referrals help) or sign-up order.
- **CSV exports**: first 500 and top 10 referrers with WhatsApp numbers, excluding flagged accounts. Check winners by hand before sending prizes.
- **Suspicious activity**: fast referrers and many accounts from one network (note: camp Wi-Fi can legitimately cause the second).
- **Users**: search, flag (their referrals stop counting), ban, rename, remove photo, add a reward.
- **Forgot PIN**: when someone messages you from their registered number, search them and press **Reset PIN**. The admin page shows a temporary PIN once; send it to them and they can change it in their profile.

## Settings you might change

In [`lib/config.ts`](lib/config.ts): places per referral (10), prize thresholds (500, top 10), sign-up limit per network, PIN lockout, state-change cooldown (30 days), and the WhatsApp share message.

## Not built yet (on purpose)

Contests, awards/voting, opportunities, messaging, payments. They show as "Coming soon" cards. The bottom navigation has room to add them as new tabs later.

---

## Note on testing

This code was written in an environment that couldn't download npm packages, so it has **not yet been through `npm install && npm run build`**. What was checked: every database query was run against Postgres 16 (schema, ranking, referrals, snapshots, admin stats), every file was syntax-checked, and the code was type-checked across files. Run `npm install && npm run build` first; if anything fails, the error message will point to the exact line.
