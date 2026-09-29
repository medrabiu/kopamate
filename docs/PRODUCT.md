# PRODUCT.md: Kopamate

> Build spec for Claude Code. The app is called **Kopamate**. Keep the name and domain in one config value. The domain isn't confirmed yet, so use `[domain]` as a config placeholder (likely kopamate.ng).

---

## 1. What we're building

A mobile-first web app for Nigerian corps members (NYSC). It's **the real app, launched early to gather users**: people sign up in about 20 seconds, get a position on a list, move up by inviting friends, and can browse who has joined from each state. Contests, awards and opportunities are shown as "Coming soon" and will be built later.

**The only goal of v1: get as many corpers as possible to sign up and invite their friends.**

### Core loop
1. A corper sees a friend's link on WhatsApp Status and opens it.
2. They land on the landing page ("Chidi invited you"), see the live signup count, and tap **Join now**.
3. They sign up (Google or phone) → get a position, e.g. **#347**.
4. They share their own link to WhatsApp. **Every friend who joins with their link moves them up 10 places.**
5. They come back daily to check their position ("Up 20 places since yesterday"), their state's rank, and new joiners.

### Launch context
- Launches **Thursday** at NYSC orientation camp. Scope is **nationwide**: open to corpers in every state from day one.
- Users are on cheap Android phones with weak, expensive mobile data. **Speed and small page size matter more than features.**
- It's unofficial. **No NYSC logo, crest or official branding anywhere.**

---

## 2. Scope

### In v1
- Landing page with live total signups and top states
- Sign up with Google, or with phone number + PIN
- Referral links, positions, and "moves up 10 places" logic
- Home page (position, share, progress, state stats, new joiners, coming soon, prize teaser)
- Corpers browse page (by state → grid of profiles, view only)
- Invite page (link, who joined with your link, top referrers leaderboard)
- Rewards page (prize teaser, where you stand, list of rewards won)
- Profile page (edit details, optional photo and state code, hide from list, log out)
- Admin page (only for the owner)
- Installable as a PWA (add to home screen)

### Not in v1 (don't build)
- Contests, awards, voting, opportunities: shown only as locked "Coming soon" cards
- Messaging, following, likes, the "wave" button, comments, feeds of posts
- A real money wallet or in-app payments
- Paid features
- Native iOS/Android apps
- Pidgin wording (use standard English)

---

## 3. Recommended stack

Claude Code may adjust these if there's a good reason, but should keep the app light and free or cheap to host.

- **Next.js (App Router) + TypeScript**, deployed on **Vercel**
- **Tailwind CSS**
- **Postgres** on **Supabase** (or Neon), with **Drizzle** or **Prisma**
- **Auth.js (NextAuth)** with:
  - Google provider
  - Credentials provider for **phone number + 4-digit PIN** (PIN hashed with bcrypt/argon2)
- **Image storage** for profile photos: Supabase Storage (or Vercel Blob). Resize and compress on upload (max 400×400, WebP, under 60 KB).
- **Fonts:** Bricolage Grotesque (headings, numbers) and DM Sans (body), via `next/font/google`.
- **Scheduled job** (Vercel Cron) once a day to snapshot positions.

**Why no SMS codes:** SMS verification costs money per message. v1 uses phone + PIN and relies on unique WhatsApp numbers, rate limits and admin review to catch fake accounts. Design the code so an OTP step can be added later.

---

## 4. Pages and routes

Bottom navigation (logged in): **Home · Corpers · Invite · Rewards · Profile**. Active tab is lime; the rest are muted.

| Route | Page | Access |
|---|---|---|
| `/` | Landing | Public (logged-in users are sent to `/home`) |
| `/r/[code]` | Referral entry: stores the code, then shows the landing page | Public |
| `/join` | Sign up | Public |
| `/login` | Log in (Google or phone + PIN) | Public |
| `/home` | Home | Logged in |
| `/corpers` | States list | Logged in |
| `/corpers/[state]` | Corpers in one state | Logged in |
| `/invite` | Invite | Logged in |
| `/rewards` | Rewards | Logged in |
| `/profile` | Profile | Logged in |
| `/admin` | Admin | Owner only |

Mockups of every screen are on the design canvas: https://claude.ai/artifact/25hndDPcRgZU3RW6FpCBbU (private; the owner may need to share it or send screenshots). **Match the mockups.**

### 4.1 Landing (`/`)
- Top bar: `Kopamate` wordmark; **Log in** link.
- **If the visitor arrived through a referral link:** a card at the top saying "**Chidi** invited you to join" with Chidi's avatar.
- Pill: "For corps members across Nigeria".
- Headline: "Every corper. / One place." (second line in pink).
- Subtext: "Join early, climb the list, and be first in line for contests, awards and prizes."
- **Live counter card:** total signups (large number), "corpers have joined", and "+N today".
- **Join now** button (lime, full width).
- **Top states:** top 5 states by signups, with counts.
- **Coming soon:** 3 locked cards: Contests, Awards, Opportunities.
- **Prize teaser** (pink outline): "Prizes are coming. For the first 500 signups and the top 10 referrers. Announced soon."
- Also needs Open Graph tags and a preview image so the link looks good when shared on WhatsApp.

### 4.2 Sign up (`/join`)
- Title: "Join in 20 seconds". If referred: "Chidi invited you. You'll both move up when you join."
- **Continue with Google** button.
- Divider: "or sign up with your number".
- Fields:
  - **Nickname** (required, 2–20 characters, letters, numbers, spaces, `_` and `.`; filter offensive words)
  - **WhatsApp number** (required; `+234` prefix shown; normalise to E.164; must be a valid Nigerian mobile number; **unique**)
  - **State you're serving in** (required; dropdown of 36 states + FCT, see section 10)
  - **4-digit PIN** (phone sign-up only, used to log back in)
- Note: "You can add a photo and your state code later."
- Button: **Create my account**.
- Small print: "Your number is only used to contact you about prizes. It's never shown to other users." plus a link to the privacy notice.
- **Google flow:** after Google sign-in, show a short "Finish up" step asking for nickname (prefilled from Google first name), WhatsApp number and state. The account isn't complete, and the referral doesn't count, until this step is done.
- After sign-up: a short celebration (confetti) and go to `/home`.

### 4.3 Home (`/home`)
- Header: "Hi, {nickname}" and the user's avatar (links to Profile).
- **Carousel** at the top: full-width slides the user swipes sideways (CSS scroll-snap, no library), with dots underneath that follow the scroll and jump to a slide when tapped. No auto-advance; dot jumps are instant when the user prefers reduced motion. Slides with nothing to show are left out.
  1. **Your position** (always first):
     - "Your position" and the position in large lime digits, e.g. **#347**
     - Change badge: "↑ 20 since yesterday" (hide if no change; show "↓" in muted colour if they dropped)
     - Progress bar and next goal: "Invite **2 more** to reach the top 300". Goals are the next round hundred (or top 100, top 50, top 10 when closer).
     - **Share on WhatsApp** button (opens `https://wa.me/?text=...` with the share message, section 6) and a **copy link** icon button.
     - "{N} friends joined with your link"
  2. **Post your spot** (Status card): a preview of a portrait 1080×1920 image sized for WhatsApp Status, saying "I'm #347 on Kopamate", the user's nickname and state, "Every corper. One place." and "Join me: [domain]/r/<code>", in the Social Night colours. The image is generated at `/card/<referral code>` (live position, cached 5 minutes; 404 for unknown, banned or unfinished users). **Post to Status** opens the phone's share sheet with the image and the share message; where sharing files isn't supported it downloads the PNG and shows "Card saved. Add it to your WhatsApp Status." Logs `share_clicked` with channel `status_card`.
  3. **Announcement** (set in Admin): pink card with a title, short text and an optional button. Hidden when switched off or the title is empty.
- **Two stat cards:** "Corpers joined: 4,382" and "{State} is #2 · 280".
- **New from {state}:** row of the 5 newest users from the user's state (avatars + nicknames), with **See all** linking to `/corpers/[state]`.
- **Coming soon:** three sections (Contests, Awards, Opportunities), each a heading and a sideways-scrolling row of locked cards (about 220px wide, icon, title, one-line description, small "Coming soon" lock pill). Tapping a card shows "<title> is coming soon".
  - Contests: Best Khaki Drip, Camp Talent Showdown, Man O' War Challenge, Mammy Market Cook-off, Best CDS Project.
  - Awards: Corper of the Month, Best Platoon, Camp Comedian, Social Night MVP, Most Stylish in {user's state}.
  - Opportunities: Jobs from ex-corpers, Remote gigs, Retention at your PPA, Skills and SAED, Scholarships and grants.
  - The landing page keeps its small three-tile "Coming soon" grid.
- **Prize teaser** card linking to Rewards.

### 4.4 Corpers (`/corpers`)
- Title "Corpers", and "{total} joined across {n} states".
- Search box to filter states.
- List of all states sorted by count, showing rank, name, count and a chevron. The user's own state is highlighted with a "You" tag.
- States with zero signups are listed at the bottom.

### 4.5 Corpers in a state (`/corpers/[state]`)
- Back button, state name, "{count} corpers · #{rank} state", "Your state" tag if it's theirs.
- 3-column grid: avatar (photo or default avatar), nickname, position.
- The current user is highlighted with a lime ring and "(you)".
- **View only.** No tapping into profiles, no messaging.
- Paginate or infinite-scroll in pages of 30. Order by position.
- Users who chose "hide me" don't appear.

### 4.6 Invite (`/invite`)
- Title "Invite friends" and "Every friend who joins with your link moves you **up 10 places**."
- Link box showing their link, with **Copy**.
- **Share on WhatsApp** button.
- **Joined with your link · {N}:** list of referred users (avatar, nickname, time ago).
- **Top referrers** with a "Top 10 win prizes" tag: top 10 by completed referrals (avatar, nickname · state, count). Below the list, the user's own row if they're outside the top 10, e.g. "58 · You · 3".

### 4.7 Rewards (`/rewards`)
- Pink card: "Prizes are coming. For the first 500 signups and the top 10 referrers. Details announced soon." (The admin can edit this text; see Admin.)
- **Where you stand:**
  - First 500: ✓ "You're in at #347", or "You're #612. Invite friends to get into the first 500."
  - Top 10 referrers: "You're #58. Invite more to climb." with an **Invite** link.
- **Your rewards:** list of rewards the admin has given this user (title, status: pending / sent, date). Empty state: "Rewards you win show up here. Prizes are sent as airtime, data or bank transfer. We'll message you on WhatsApp."
- **This is not a money wallet.** No balances, withdrawals or payments.

### 4.8 Profile (`/profile`)
- Large avatar with a camera button to add or change the photo.
- **Get verified** card (top of Profile): only verified corpers can win prizes. The user enters their state code (format `EN/26B/1234`) and a photo of their NYSC ID card; the phone shrinks the photo (max 1600px JPEG, under 850 KB) before upload. Status shows as "Checking your ID" (pending), the admin's reason (rejected, with a form to try again) or "Verified corper". The state code is locked while pending and once verified. A state code can only be verified on one account.
- Nickname, "{State} · #{position} · Joined {date}".
- Editable rows: Nickname, WhatsApp number ("only you can see this", shown masked), State serving in, State code ("Not added" / **Add**).
- Toggle: **Show me in the Corpers list** ("Others see your nickname and photo only"). On by default.
- For phone users: **Change PIN**.
- **Log out** button.
- A small "Delete my account" link at the bottom (with confirmation).
- **State code:** optional, free text in the format like `EN/26B/1234`; validate the pattern loosely; never shown publicly in v1.
- Changing state should be allowed but limited (e.g. once every 30 days) so people can't game state rankings.

### 4.9 Admin (`/admin`)
Only accessible to users whose email or phone is in an `ADMIN_IDS` environment variable. Simple and functional, no need to match the full design. Split into separate pages (tabs at the top) so each page runs only a few queries:
- **Overview** (`/admin`): corpers joined (public number, including seed accounts), real users, seed accounts, signups today, real signups per day (last 14 days), top states, % from referrals, average referrals per referrer, verified count. Shortcuts to waiting verification requests and rewards to send.
- **Users** (`/admin/users`): search by nickname, phone, email, state code or referral code; filters (real, seed, pending check, verified, flagged, banned, unfinished, all); 50 per page with Newer/Older. Each row opens the user's page.
- **User page** (`/admin/users/[id]`): all their details (contact, sign-in method, state and state code, position and position among verified, referrals, who invited them, sign-up number, whether they're hidden from the list). Actions: flag/unflag (flagged users' referrals stop counting), ban/unban (signs them out), reset PIN (shows a temporary PIN once), remove photo, edit nickname/state/state code, approve/reject/remove verification (with the ID card photo while pending), add rewards and mark them sent, see the people they invited, and delete the account (type DELETE to confirm). Admins can't ban or delete themselves.
- **Verification** (`/admin/verification`): pending requests, highest positions first, 30 at a time, with the ID card photo (served only to admins at `/admin/id-card/[id]`, never cached), state code, whether another account uses the same code, position and referrals. **Approve**, or **Reject** with a reason the user sees. The ID card photo is deleted as soon as either decision is made.
- **Suspicious** (`/admin/suspicious`): users who referred many people in a short time (5+ in an hour or 15+ in 24 hours, with a Flag button), and 3+ sign-ups from the same network in 7 days (could be a shared camp Wi-Fi).
- **Rewards** (`/admin/rewards`): download the prize lists as CSV (first 500 **verified** users and top 10 **verified** referrers; flagged, banned and seed accounts left out; with nickname, WhatsApp number and state code), and the rewards waiting to be sent.
- **Settings** (`/admin/settings`): the prize teaser text shown on Landing, Home and Rewards, whether "first 500" is counted by position or sign-up order, and the Home **announcement**: on/off, title (max 60 characters), text (200), button label (24) and button link (300; must start with `/` or `https://`). Stored in `settings` as `announcement_active` ("1"/"0"), `announcement_title`, `announcement_body`, `announcement_button_label`, `announcement_button_url`. Changes show on Home right away.

---

## 5. Position and referral rules

### Signup number
Each completed account gets a `signup_number`: 1, 2, 3… in order of completion.

### Position (option a: "every friend moves you up 10 places")
- `score = signup_number − (10 × valid_referrals)`
- **Position** = rank by `score` ascending; ties broken by earlier signup time. Position 1 is the top.
- This is close to "each referral moves you up 10 places" and is simple and fair. It also means new signups never push existing users down unless those new users bring referrals.
- Position can't go below 1.
- Banned users are removed from the ranking.

### Valid referral
A referral counts only when **all** of these are true:
- The new user signed up through the referrer's link (`/r/[code]` stores the code in a cookie for 30 days; the most recent link wins).
- The new user **completed** sign-up (nickname, WhatsApp number, state).
- The new user's WhatsApp number is unique.
- Neither account is flagged or banned.
- A user can't refer themselves.

### Daily change
A daily cron job stores each user's position (`position_snapshots`). Home shows current position vs. the last snapshot: "↑ 20 since yesterday".

### Referral code
Short, readable, unique per user, e.g. nickname-based + digits (`ada347`), lower case. Link format: `https://[domain]/r/ada347`.

### Prize eligibility
- **First 500:** the top 500 **positions** at the time prizes are awarded (so referrals help). *(Owner can switch this to plain signup order; make it a config value.)*
- **Top 10 referrers:** by number of valid referrals; ties broken by who reached the count first.

- **Only verified corpers win.** Prize places are counted among verified users only: "first 500" means the first 500 verified users by position (or by sign-up order in `signup` mode), and "top 10 referrers" means the top 10 verified referrers. Unverified users still have a normal position on the list.

### Seed accounts
- Accounts created by the seed script have `is_seed = true`. They count toward "Corpers joined" and state totals, but they never get a position, never appear in lists, leaderboards or "New from {state}", their referrals don't count, and they can never qualify for prizes.

---

## 6. Sharing

**WhatsApp share message** (editable in config):

> I just joined Kopamate, the new app for corpers across Nigeria 🇳🇬 There are prizes for the first 500 people. Join with my link: https://[domain]/r/ada347

- Use `https://wa.me/?text=<encoded>` for the WhatsApp button.
- Use the Web Share API when available for a general share option.
- **Open Graph preview** for `/` and `/r/[code]`: title, description, and an image in the Social Night style showing the app name and "Every corper. One place." For referral links, the title can be "Chidi invited you to Kopamate".

---

## 7. Design system: "Social Night"

Dark by default. Light mode isn't needed in v1.

### Colours
| Token | Hex | Use |
|---|---|---|
| `bg` | `#0E0E10` | Page background |
| `surface` | `#1C1C20` | Cards |
| `surface-2` | `#26262B` | Inner elements, dividers, progress track |
| `border` | `#2E2E34` | Input and outline borders |
| `text` | `#F5F5F0` | Main text |
| `text-muted` | `#A8A8A0` | Secondary text |
| `text-faint` | `#8A8A84` | Hints, inactive tabs |
| `lime` | `#C6F432` | Primary buttons, position number, active tab, highlights |
| `pink` | `#FF4FA3` | Accents, prize cards, second headline line |

Text on lime or pink is always `#0E0E10`.

Avatar background colours for default avatars (pick from the user ID so it's stable): `#C6F432`, `#FF4FA3`, `#FFB547`, `#8B7BFF`, `#4FD1C5`.

### Typography
- **Bricolage Grotesque** (weights 600, 800): headings, big numbers, ranks, wordmark.
- **DM Sans** (400, 500, 700): everything else.
- Position number on Home: ~72px, weight 800, lime. Landing counter: ~64px.

### Shapes and components
- Cards: radius 20–24px, `surface` background, no shadows.
- Buttons: pill-shaped (fully rounded), height 52–56px. Primary = lime background with dark text. Secondary = transparent with `border`.
- Inputs: height 52px, radius 14px, `surface` background, `border` outline.
- Bottom nav: 76px high, 5 equal tabs, icon + label.
- Icons: simple outline icons (e.g. Lucide). **No emoji in the UI** (emoji are fine in the WhatsApp share message).
- **Default avatar:** coloured circle with the first letter of the nickname in Bricolage Grotesque 800, dark text.
- Minimum touch target 44px. Text contrast at least WCAG AA.

### Motion
- Confetti on sign-up completion and when the position improves since last visit.
- Numbers count up when they change. Respect `prefers-reduced-motion`.

### Tone of copy
Standard English, friendly and short. Sentence case. No "please", no "successfully". Examples: "Join in 20 seconds", "Invite 2 more to reach the top 300", "Rewards you win show up here".

---

## 8. Data model (suggested)

```
users
  id                uuid pk
  nickname          text not null
  whatsapp_e164     text unique not null      -- never exposed publicly
  state             text not null             -- one of the 37
  state_code        text null                 -- optional, private
  photo_url         text null
  google_id         text unique null
  email             text null
  pin_hash          text null                 -- phone sign-up only
  referral_code     text unique not null
  referred_by       uuid null fk users.id
  signup_number     int unique null           -- set when sign-up completes
  completed_at      timestamptz null
  show_in_list      boolean default true
  state_changed_at  timestamptz null
  is_flagged        boolean default false
  is_banned         boolean default false
  signup_ip_hash    text null
  created_at        timestamptz default now()

referrals                                      -- or derive from users.referred_by
  referrer_id       uuid fk
  referred_id       uuid fk unique
  is_valid          boolean
  created_at        timestamptz

position_snapshots
  user_id           uuid fk
  snapshot_date     date
  position          int
  primary key (user_id, snapshot_date)

rewards
  id                uuid pk
  user_id           uuid fk
  title             text
  description       text null
  status            text  -- 'pending' | 'sent'
  created_at        timestamptz
  sent_at           timestamptz null

settings                                        -- editable from admin
  key               text pk   -- e.g. 'prize_teaser_text', 'first_n_mode'
  value             text
```

- Keep a cached `valid_referrals` count on users (or a materialised view) so position queries are fast.
- Positions can be computed with a window function (`rank() over (order by score, completed_at)`). Cache public numbers (total, per-state counts, top referrers) for ~30–60 seconds.

---

## 9. Privacy, safety and fairness

- **Public info is only:** nickname, photo (or default avatar), state, position. **WhatsApp numbers, emails, state codes, ID card photos and PINs are never exposed** in any page or API response to other users.
- Show a short privacy notice (linked from sign-up): what we collect, why (account, prizes, anti-fraud), that we don't sell data, and how to delete your account. Keep in line with Nigeria's Data Protection Act.
- Users can hide themselves from the Corpers list and delete their account.
- **Anti-fraud:**
  - One account per WhatsApp number and per Google account.
  - Rate-limit sign-ups per IP (e.g. max 5 per hour) and PIN login attempts (lock after 5 wrong tries for 15 minutes).
  - Store a hash of the sign-up IP (not the raw IP) to detect bulk sign-ups.
  - Admin can flag/ban; flagged users' referrals stop counting.
  - Prize winners must be verified (state code + NYSC ID card checked by an admin). ID card photos are only visible to admins and are deleted once a decision is made.
- Filter offensive nicknames with a word list; admin can edit nicknames and remove photos.
- Profile photo uploads: images only, max 5 MB before compression, strip metadata.

---

## 10. States list

Abia, Adamawa, Akwa Ibom, Anambra, Bauchi, Bayelsa, Benue, Borno, Cross River, Delta, Ebonyi, Edo, Ekiti, Enugu, FCT, Gombe, Imo, Jigawa, Kaduna, Kano, Katsina, Kebbi, Kogi, Kwara, Lagos, Nasarawa, Niger, Ogun, Ondo, Osun, Oyo, Plateau, Rivers, Sokoto, Taraba, Yobe, Zamfara.

Use URL-safe slugs for routes (e.g. `akwa-ibom`, `cross-river`, `fct`).

---

## 11. Performance targets

- First load of Landing under **150 KB** of JavaScript (gzipped) and usable within ~2 seconds on a slow 3G connection.
- Server-render the landing page and counters; avoid heavy client libraries.
- No videos, no large images. Compress everything.
- PWA manifest and icons so users can add it to their home screen; basic offline page.
- Works well on screens from 320px wide; designed for 390px.

---

## 12. Analytics (simple)

Track these events (a privacy-friendly tool like Plausible/Umami, or just a table):
- `landing_view` (with or without referral code)
- `signup_started`, `signup_completed` (method: google/phone)
- `share_clicked` (whatsapp / copy / native / status_card)
- `referral_completed`
- `daily_return` (user opened the app on a new day)

Admin overview should show: signups per day, % of signups that came from referrals, average referrals per user.

---

## 13. Acceptance checklist

- [ ] A new visitor can go from a WhatsApp link to a completed account in under 30 seconds.
- [ ] Opening `/r/ada347` shows "Ada invited you", and after sign-up Ada's referral count goes up by 1 and her position improves by 10 places.
- [ ] A second account with the same WhatsApp number is rejected.
- [ ] Google sign-up asks for WhatsApp number and state before the account is complete.
- [ ] Returning phone users can log in with number + PIN.
- [ ] Home shows position, daily change, next goal, share buttons, state stats, new joiners, coming soon and prize teaser.
- [ ] Corpers page lists all states by count; each state page shows a view-only grid; hidden users don't appear.
- [ ] Invite page shows the user's link, who joined with it, and the top 10 referrers.
- [ ] Rewards page shows where the user stands and any rewards given by the admin.
- [ ] Profile allows adding a photo and state code, editing details, hiding from list, logging out and deleting the account.
- [ ] No page or API ever returns another user's WhatsApp number, email or state code.
- [ ] Admin can see stats, flag/ban users, export prize lists as CSV, add rewards and edit the prize text.
- [ ] No NYSC logos or official branding.
- [ ] Looks like the mockups on a 390px-wide phone.

---

## 14. Open decisions (use the default unless the owner says otherwise)

| Decision | Default |
|---|---|
| Domain | `[domain]` placeholder in config (likely kopamate.ng) |
| "First 500" based on position or signup order | Position (config value) |
| Places moved per referral | 10 (config value) |
| Prizes | "Announced soon"; text editable in admin |
| SMS/WhatsApp code verification | Not in v1; design so it can be added |

---

## 15. Later (for context only, don't build)

Contests and awards with voting (platoon/state competitions, daily free votes), opportunities (jobs and gigs), a premium subscription (~₦1,500/month, e.g. "see who voted for you", profile boosts), and brand-sponsored prizes. Keep the data model and navigation flexible enough to add these as new tabs later.
