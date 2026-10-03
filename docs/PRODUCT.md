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
- Home page (position, share, progress, state stats, new joiners, coming soon)
- Corpers browse page (by state → grid of profiles, view only)
- Invite page (link, who joined with your link, top referrers leaderboard)
- Rewards page (prizes, where you stand, list of rewards won)
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
- **Fonts:** the phone's own system font, the same stack x.com falls back to (San Francisco on iPhone, Roboto on Android, Segoe UI on Windows). Nothing to download.
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

### 4.1 Landing (`/` and invite links `/r/[code]`)
A real landing page that says what Kopamate is, with live numbers. No referral or "climb the list" talk; invite links show the same page (the inviter is still credited through the cookie, and their name appears only in the link preview). Mobile-first single column; from tablet width the hero splits into two columns.
- **Sticky top bar:** `Kopamate` wordmark, **Log in** and a lime **Join** button.
- **Hero:** pill "For NYSC corps members across Nigeria"; headline "The home for every corper in Nigeria."; "Kopamate brings corpers from every state into one place. Find people serving near you, earn badges for your service year, and win prizes, contests and awards made for corpers."; **Join free** and **Log in** buttons; "Takes 20 seconds. Phone number or Google."
- **Kopamate right now** (live, cached 30 seconds): corpers joined (counts up), states with corpers "of 37 states", joined today, verified corpers; then the top 5 states with bars and counts.
- **Early Corper countdown** (lime outline) until the deadline: "Early Corper badge closes in …" and "Early Corpers qualify for the first rewards drop."
- **Built for service year:** four features: find corpers in your state (tap to see profiles and badges); win real prizes (cash, airtime and data, claimed in the app); earn badges (Early Corper, State Ambassador…); contests, awards and opportunities (coming soon).
- **How it works:** 1. Sign up in 20 seconds (phone or Google, free). 2. Pick your state (state code and NYSC ID card to get verified). 3. Join in (meet corpers, earn badges, claim prizes).
- **Your details stay yours:** phone number never shown; prizes to verified corpers only, checked by ID; hide yourself or delete your account any time.
- **Closing call to action** (lime outline): "Join {total} corpers on Kopamate", "Free, and it takes 20 seconds.", **Join free**.
- **Footer:** "Kopamate is an independent app for corps members. Not affiliated with NYSC.", Privacy, Log in.
- Also needs Open Graph tags and a preview image so the link looks good when shared on WhatsApp (see section 6).

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
- **Reward banner** (top, under the header): when the user has unclaimed rewards, a lime banner "🎉 You won ₦X! Claim it" (sum of all unclaimed amounts) linking to Rewards; flagged users see "Your account is under review" instead of "Claim it". Confetti the first time each unclaimed reward is seen on the device (ids kept in localStorage `km_seen_rewards`; blocked storage just skips the confetti). With only hidden rewards: a smaller "🎁 Reward coming, amount revealed soon".
- **Your position** (one card, no carousel):
  - "Your position" and the position in large lime digits, e.g. **#347**, with a change badge: "↑ 20 since yesterday" (hidden if no change; "↓" in muted colour if they dropped).
  - Progress bar and next goal: "Invite **2 more** to reach the top 300". Goals are the next round hundred (or top 100, top 50, top 10 when closer).
  - Two buttons side by side: **WhatsApp** (opens `https://wa.me/?text=...` with the share message, section 6) and **Post to Status**. Post to Status shares a portrait 1080×1920 image sized for WhatsApp Status, saying "I'm #347 on Kopamate", the user's nickname and state, "Every corper. One place." and "Join me: [domain]/r/<code>", in the Social Night colours. The image is generated at `/card/<referral code>` (live position, cached 5 minutes; 404 for unknown, banned or unfinished users) and opens the phone's share sheet with the image and the share message; where sharing files isn't supported it downloads the PNG and shows "Card saved. Add it to your WhatsApp Status." Logs `share_clicked` with channel `status_card`.
  - Footer: "{N} friends joined · Invite" (links to Invite) and, until the deadline, "Early Corper {countdown}".
- **Announcement** (set in Admin): pink card under the position card with a title, short text and an optional button. Hidden when switched off or the title is empty.
- **Profile progress row** (hidden at 100%): one slim row, "33% · Profile · next: add a photo" with a thin bar, linking to the next step (see "Profile completion" in section 5).
- **New from {state}:** a sideways row of the 5 newest users from the user's state (avatars + nicknames + top badge icon; tapping opens their profile sheet), with "{count} corpers ›" linking to `/corpers/[state]`.
- **Coming soon:** three tiles (Contests, Awards, Opportunities, each "5 coming"). Tapping a tile opens a sheet listing what's planned, each with a small illustration (inline SVGs in the Social Night palette, `components/CardArt.tsx`: no image downloads, about 3 KB for all 15, follow light/dark mode), title and one line.
  - Contests: Best Khaki Drip, Camp Talent Showdown, Man O' War Challenge, Mammy Market Cook-off, Best CDS Project.
  - Awards: Corper of the Month, Best Platoon, Camp Comedian, Social Night MVP, Most Stylish in {user's state}.
  - Opportunities: Jobs from ex-corpers, Remote gigs, Retention at your PPA, Skills and SAED, Scholarships and grants.
  - The landing page keeps its small three-tile "Coming soon" grid.

### 4.4 Corpers (`/corpers`)
- Title "Corpers", and "{total} joined across {n} states".
- **Your state** card (lime outline, links to the state page): state name, "#{rank} of 37 states", the top 5 corpers there as overlapping avatars and "{count} corpers serving here".
- **All states:** search box to filter states, then one card listing every state sorted by count: rank, name, a bar showing its size next to the biggest state (lime for yours, pink for the rest), count and a chevron. The user's own state has a "You" tag. States with zero signups are listed at the bottom, greyed out.

### 4.5 Corpers in a state (`/corpers/[state]`)
- Back button, then a header card: state name, "{count} corpers" and "#{rank} of 37 states"; lime outline and a "Your state" label if it's theirs. "Tap anyone to see their profile." under it.
- 3-column grid: avatar (photo or default avatar), nickname with their top badge icon, position.
- The current user is highlighted with a lime ring and "(you)".
- Paginate or infinite-scroll in pages of 30. Order by position.
- Users who chose "hide me" don't appear.
- No messaging.

### Profile sheet and follows (anywhere in the signed-in app)
Tapping a person opens a normal profile in a bottom sheet: photo, nickname, "Verified" tag, "Follows you" (when they do), "Serving in {state} · Joined {month year}", **Following** and **Followers** counts, a **Follow** button (white; "Follow back" when they follow you; "Following" outlined once you do, showing "Unfollow" on hover; the change shows at once and is undone if the server refuses) and "See corpers in {state}" (hidden when already on that page). Position, referrals and badges are **not** shown on other people's profiles.
- Tapping Following or Followers switches the same sheet to that list (newest first, up to 200; banned and unfinished accounts left out); tapping someone in a list opens their profile, with a back link, so sheets never stack.
- Works in the state grid, Home's "New from {state}" row, the Rewards leaderboard and Invite's friends list.
- Data comes from `/api/person/[id]` (and `?list=followers|following`), signed-in users only, never cached, and never includes WhatsApp numbers, emails, state codes, payout details, positions, referrals or badges. Follow/unfollow is the server action `setFollow` (`app/actions/follows.ts`): you can't follow yourself, banned or unfinished accounts; following twice does nothing.

### Profile links (`/u/[code]`)
Everyone has a shareable profile link, `kopamate.ng/u/<their invite code>` (nicknames aren't unique, so the invite code doubles as the handle).
- **Share your profile** card on Profile (under the header): WhatsApp ("Follow me (Ada) on Kopamate, the app for NYSC corpers: <link>"), the phone's share sheet (or Copy link), and the link with Copy.
- **Logged in:** the person's profile (photo, nickname, Verified, Follows you, "Serving in {state} · Joined {month year}", Following / Followers) with a **Follow** button; on your own link, "This is your profile" and the share buttons.
- **Logged out:** the same public preview (nothing private) with **Join Kopamate to follow {nickname}** and **Log in to follow**, plus a short "What is Kopamate?". Opening the link stores the code like an invite link (`km_ref`, 30 days) and `km_follow`: signing up credits them as your inviter and follows them; logging in to an existing account follows them too.
- Link preview: "Follow {nickname} on Kopamate" with their photo (`/u/[code]/opengraph-image`). Profile links are `noindex`; unknown, banned or unfinished accounts give 404.

### 4.6 Invite (`/invite`)
- Title "Invite friends" and "Every friend who joins with your link moves you **up 10 places**."
- **Progress card:** "{N} friends joined" in large lime type (valid referrals, the count that ranks you; "No friends yet" at 0), "You've moved up {N × 10} places", a progress bar and the next goal: "2 more to pass Kels (#7)" (to pass the person just above you nationally), "Invite 1 friend to get on the leaderboard", or "You're #1 nationwide. Keep going to stay on top." Then **Share on WhatsApp** and one slim row with the link, **Copy** and (where the phone supports it) a share icon for other apps.
- **Friends who joined:** a card with up to 4 overlapping avatars (+N for the rest) and "{latest} joined {time ago} · N others". Tapping it or **See all** opens a bottom sheet with everyone (avatar, nickname, top badge icon, time ago; latest 100). Empty: "No one yet. Post your link on your WhatsApp Status to get your first friend in."
- **Rank card** (pink outline) linking to Rewards, where the full leaderboard lives: "#{rank} nationwide · #{state rank} in {state}" (or "Not on the leaderboard yet") and "Top 10 verified referrers win prizes." plus "See the leaderboard." or, for unverified users, "Get verified in Profile to qualify."

### Referral bonus (Invite and Rewards)
The inviter earns **₦250** (admin setting) for every friend who joins with their link and gets verified.
- **Admin → Settings → Reward money:** "Referral bonus on" (`referral_bonus_enabled`, "1"/"0"), the amount per verified friend (`referral_bonus_ngn`, default 250) and the least a user can withdraw (`referral_bonus_min_withdraw_ngn`, default 1000). Switching it off stops new bonuses; balances already earned can still be withdrawn. A new amount applies to friends verified from then on; earned bonuses keep theirs.
- **Earning:** recorded in `referral_bonuses` (one row per invited friend) when an admin approves the friend's verification, and on the inviter's Invite/Rewards visit for friends verified earlier. Only real referrals count: neither person flagged, banned or a seed account. Removing a friend's verification removes their bonus unless it was already withdrawn.
- **Invite page:** an earnings card after the progress card: "Earn ₦250 for every friend who gets verified", the balance available, a progress bar to the minimum ("₦750 more to withdraw · 3 more verified friends"), verified friends and amount withdrawn, and **Withdraw**. In the friends list each friend shows "+₦250", "₦250 withdrawn" or "Not verified yet".
- **Withdraw** (verified, not flagged, balance at least the minimum): pick bank transfer, airtime or data; the whole balance becomes one unclaimed reward ("Referral earnings · For N verified friends you invited", batch `referral-bonus`) that the user claims on Rewards like any other, so it goes through Payouts and counts in the budget. Deleting that reward frees the bonuses again.
- **Rewards page:** a compact "₦X referral earnings" card linking to the Invite earnings card.

### 4.7 Rewards (`/rewards`)
Prize amounts on the prize rows stay hidden; amounts the user has actually won show under "Your rewards". In order:
1. **Your rewards** (anchor `#your-rewards`; only when the user has won something, because that's what they come here for): one card per reward, unclaimed first, with the title, the amount and the state:
   - hidden: "🎁 You won a reward! Amount revealed soon". No action.
   - unclaimed: "You won ₦X" (plus "airtime"/"data" for those kinds) and a **Claim ₦X** button.
   - claimed: "Claimed · payments go out within 72 hours", where it's going (bank and last 4 digits + account name, or the phone number) and **Edit details**.
   - processing: "Payment in progress". Details are locked.
   - paid: "Paid ✓ {date}".
   - rejected: "Not approved." and the admin's note.
   - Flagged users see "Under review" instead of Claim / Edit details.
2. **Get verified to win** (unverified users; lime outline, links to the verify sheet at `/profile#verify`): "Only verified corpers win prizes.", "Checking your ID" while pending, or "Your verification needs another try."
3. **Your standing** (one card): national and state referrer rank side by side; who to beat next: "3 more friends to pass Kels (#7)" (one more than the person directly above you nationally; on a tie it adds "You're tied, but they got there first."), "You're leading. Keep inviting to stay on top." at #1, or "Invite your first friend to get on the leaderboard."; "{N} friends joined with your link" with a small **Invite** button. Under a divider, the two countdowns: "Early Corper badge closes in …" (after: "Early Corper closed · first rewards are being prepared.") and "Leaderboard closes in …" (after: "Leaderboard closed · winners are being confirmed.").
4. **Leaderboard** with two tabs: **Nigeria** (top 20 by valid referrals; the first 10 shown, **Show top 20** for the rest) and **{your state}** (top 10). Rows: rank, avatar, nickname, top badge icon, state, friends joined. Your row is highlighted, or pinned below the list when you're outside it. Cached 30 seconds.
5. **Prizes** ("Amounts revealed later"): one card with three rows: **Top 10 nationwide**, **State Ambassadors** (crown, "Currently leading in {state}: {nickname} with N friends") and **Early Corpers** (tagged "You have the badge" for holders). The admin's reveal text sits under the card. Each row opens a sheet with how it's decided (no amounts); the Ambassador sheet adds the perks (Kopamate team member (state admin), State Ambassador badge, promotion budget for the state, first access to new features, featured on Kopamate, certificate of recognition), "Ambassadors must be in good standing (no fake referrals). Final selection is confirmed by the Kopamate team.", who's leading, and Share on WhatsApp ("I'm #4 in Enugu, help me become Ambassador 👑" + referral link) with copy link.
6. Empty state at the bottom when nothing has been won yet: "Rewards you win show up here. Prizes are sent as airtime, data or bank transfer. You'll claim them here and we'll message you on WhatsApp."
- Badges live on Profile only; sharing lives on Invite, Home and the Ambassador sheet.
- Confetti when your national or state referrer rank improved since your last Rewards visit (last seen ranks are kept in localStorage on the device).
- **This is not a money wallet.** No balances or withdrawals: users claim individual rewards the admin has given them, and the admin pays them by hand.

#### Claiming a reward
- A bottom sheet opened from **Claim** or **Edit details**. Only the owner can claim, only from *unclaimed*, and flagged users can't ("Under review"). Banned users are signed out anyway.
- **Cash:** bank (Access, Fidelity, First Bank, FCMB, GTBank, Kuda, Moniepoint, OPay, PalmPay, Polaris, Stanbic IBTC, Sterling, UBA, Union, Wema, Zenith, or Other with the name typed in, 2–40 characters), account number (exactly 10 digits) and account name (2–80 characters). Note: "The account name must match your name. Payments go out within 72 hours." The last bank details used are remembered on the user (private columns) to prefill the next cash claim.
- **Airtime / data:** a phone number, prefilled with their WhatsApp number and normalised like sign-up (`normalizeNigerianPhone`).
- Details can be changed while the reward is *claimed*, and lock as soon as the admin starts processing (checked again on the server, so a stale form can't sneak a change in).
- The form keeps what the user typed when the server rejects it.

#### Reward lifecycle
`hidden → unclaimed → claimed → processing → paid`. Any of *unclaimed*, *claimed* or *processing* can be **rejected** by the admin (a note is required and shown to the user); a rejected reward can be **reopened**, which clears the old payout details and puts it back to *unclaimed* (or *hidden* if it has no amount). Only *hidden* and *unclaimed* rewards can be deleted. Revealing (*hidden → unclaimed*) needs an amount; without one the admin gets "Set an amount before revealing this reward". Title, kind and amount can be edited while *hidden* or *unclaimed*; once claimed the amount is locked (reject and award a new one to change it). Every status change, amount or title edit, reveal and payout details edit writes a row to `reward_events` (the user's own edits store only the bank and last 4 digits, never the full account number).

#### Migration of old rewards
`db/schema.sql` moves rewards from the old `pending`/`sent` statuses once (safe to run again): `pending` → `hidden` with no amount (the admin sets an amount, then reveals it before the user can claim), `sent` → `paid` with `paid_at = sent_at` and `payment_reference = 'legacy'` (amount stays empty and the budget tracker lists these separately). `sent_at` is kept for history. Run `npm run db:migrate` at the same time as deploying this code: the old code writes `pending`/`sent`, which the new status check rejects.

### 4.8 Profile (`/profile`)
Top to bottom:
- **Header card:** avatar (camera button: picks a photo, or with a photo already, a sheet with "Choose a new photo" / "Remove photo"; upload results show as a toast), nickname, "{State} · Joined {date}", a "Verified corper" tag once verified, and three numbers: your position, **Followers** and **Following** (tapping either opens that list in the profile sheet).
- **Get verified** (hidden once verified): a one-line card, "Get verified to win" (or "Verification needs another try" with the admin's reason). It opens a bottom sheet with the state code (format `EN/26B/1234`) and a photo of the NYSC ID card. Before a photo is picked, a small drawing (`components/IdCardGuide.tsx`) shows a card inside a camera frame with tips: lay it flat, good light with no glare, all 4 corners in the photo; the phone shrinks the photo (max 1600px JPEG, under 850 KB) before upload. While pending the card reads "Checking your ID". Links to `/profile#verify` (Rewards, the Home progress card, the checklist) open the sheet directly. A state code can only be verified on one account, and this sheet is the only place to enter it.
- **Complete your profile:** the three completion steps (section 5, "Profile completion") with ticks and a percentage; "Add your state code" opens the verify sheet. Hidden at 100% (reaching it gives the Profile Complete badge with confetti).
- Badges are not shown on Profile (they still appear as the small icon next to nicknames in lists). Reaching 100% still plays the Profile Complete celebration.
- **Account** (grouped card, label left, value right, inline edit): Nickname, **Full name** (optional, 2–60 letters; private: only the user and admins see it; "Not added" / **Add**), WhatsApp (masked), **State** (read-only: set when you join; only an admin can change it, from the admin user page) and Change PIN for phone users. Under it: "Only you can see your full name and WhatsApp number (and state code). Your state can't be changed after you join; message us on WhatsApp if it's wrong."
- **Preferences** (grouped card): **Show me in the Corpers list** ("Others see your nickname and photo only", on by default) and **Light mode** (off by default, saved in the `km_theme` cookie as `light` / `dark` so the server renders the right theme with no flash).
- A card with **Open admin** (admins only) and **Log out**, then a small "Delete my account" link (type DELETE to confirm).
- **State code:** optional, free text in the format like `EN/26B/1234`; validate the pattern loosely; never shown publicly in v1.
- Users can't change their state after joining (so nobody can game state rankings); admins can correct it.

### Verification checks
Stops one person verifying several accounts or making up a state code. Nothing here approves anyone automatically; admins still decide.
- **State code must match the state:** NYSC codes start with the state's two letters (`STATE_CODE_PREFIX` in `lib/states.ts`: AB Abia, AD Adamawa, AK Akwa Ibom, AN Anambra, BA Bauchi, BY Bayelsa, BN Benue, BO Borno, CR Cross River, DT Delta, EB Ebonyi, ED Edo, EK Ekiti, EN Enugu, FC FCT (Abuja), GM Gombe, IM Imo, JG Jigawa, KD Kaduna, KN Kano, KT Katsina, KB Kebbi, KG Kogi, KW Kwara, LA Lagos, NS Nasarawa, NG Niger, OG Ogun, OD Ondo, OS Osun, OY Oyo, PL Plateau, RV Rivers, SO Sokoto, TR Taraba, YB Yobe, ZM Zamfara). A Lagos corper must send `LA/…`. The batch year must be this year, next year or the two before (e.g. `24`–`27` in 2026). The placeholder shows their own prefix.
- **Full name** (as on the ID card) is required in the Get verified sheet and saved to their profile, so admins compare it with the card.
- **Tries:** at most 3 requests per account (`MAX_VERIFICATION_ATTEMPTS`), and 24 hours between a rejection and the next try. The sheet explains the wait, or says to message on WhatsApp when the tries are used up. Admins can **Allow another try now** on the user page.
- **ID photo fingerprints** (`id_card_fingerprints`): an exact SHA-256 of the uploaded file and a 64-bit difference hash computed on the phone (survives re-saving and resizing). The photo is still deleted after the decision; the fingerprints stay. A match within 6 bits on another account is flagged.
- **Blocked codes** (`blocked_state_codes`): rejecting with "Fake state code: block it for every account" stops any account sending that code again ("This state code can't be used. Message us on WhatsApp if it's really yours."). Listed with **Unblock** at the bottom of the Verification page.
- **Warnings on each request** (Verification page and user page): state code doesn't match the state / old batch, code blocked, same or near-identical ID photo on another account, same full name in the same state, accounts invited by or inviting them from the same network, how many other accounts share the sign-up network (verified / pending), tries used, and the history of requests and decisions with reasons (`verification_events`).
- State codes can only be added through Get verified (no separate edit).

### 4.9 Admin (`/admin`)
Only accessible to users whose email or phone is in an `ADMIN_IDS` environment variable. Simple and functional, no need to match the full design. Split into separate pages (tabs at the top) so each page runs only a few queries:
- **Overview** (`/admin`): corpers joined (public number, including seed accounts), real users, seed accounts, signups today, real signups per day (last 14 days), top states, % from referrals, average referrals per referrer, verified count. Shortcuts to waiting verification requests and payouts to send (claimed + processing).
- **Users** (`/admin/users`): search by nickname, phone, email, state code or referral code; filters (real, seed, pending check, verified, flagged, banned, unfinished, all); 50 per page with Newer/Older. Each row opens the user's page. Tick users and choose **Award selected** to give them all the same reward (bulk award, below).
- **User page** (`/admin/users/[id]`): all their details (contact, sign-in method, state and state code, position and position among verified, referrals, who invited them, sign-up number, whether they're hidden from the list). Actions: flag/unflag (flagged users' referrals stop counting), ban/unban (signs them out), reset PIN (shows a temporary PIN once), remove photo, edit nickname/state/state code, approve/reject/remove verification (with the ID card photo while pending), award a reward (kind, title, optional amount and "Show amount to user"; warns about seed, flagged or unverified accounts), see and act on their rewards with each one's history, see the people they invited, and delete the account (type DELETE to confirm). Admins can't ban or delete themselves.
- **Verification** (`/admin/verification`): pending requests, highest positions first, 30 at a time, with the ID card photo (served only to admins at `/admin/id-card/[id]`, never cached), state code, whether another account uses the same code, position and referrals. **Approve**, or **Reject** with a reason the user sees. The ID card photo is deleted as soon as either decision is made.
- **Suspicious** (`/admin/suspicious`): users who referred many people in a short time (5+ in an hour or 15+ in 24 hours, with a Flag button), and 3+ sign-ups from the same network in 7 days (could be a shared camp Wi-Fi).
- **Badges** (`/admin/badges`): how many people hold each badge; **Run badge backfill** (gives every completed user the auto badges they've earned; revoked badges stay revoked); **Award Prophet badges** (only after the leaderboard closes: gives Prophet to everyone who picked the state with the most completed sign-ups at that moment, every tied state counts); **Download Early Corpers (CSV)** (holders of the badge, not revoked, without flagged, banned and seed accounts: nickname, WhatsApp, state); and **Ambassador candidates**: the top 3 referrers in each state (flagged, banned and seed accounts left out) with an **Award State Ambassador** button.
- **Users** table also lists each user's badges (revoked ones faded). On the **user page**, a Badges section shows every badge with when and by whom it was given; admins can award manual badges (Prophet, State Ambassador), revoke any badge with a reason, and restore a revoked one.
- **Rewards** (`/admin/rewards`), top to bottom:
  - **Budget tracker:** Budget (`rewards_budget_ngn`), Awarded (sum of `amount_ngn` on every reward that isn't rejected, hidden ones included), Claimed, Processing, Paid, Remaining (budget − awarded, red when negative) and a bar (bright = paid, faded = awarded). Notes "N rewards have no amount yet" (hidden/unclaimed without an amount) and how many were paid before amounts existed (legacy). Also shown on every bulk-award confirmation screen, as it would be after the award.
  - **Award** shortcuts: Top referrers, All Early Corpers, Pick users.
  - **Payouts to send** (claimed + processing): nickname, WhatsApp, kind, amount, and bank / account number / account name (cash) or phone (airtime, data), each with a Copy button. **Start processing** (claimed → processing, locks the user's details), **Mark paid** (processing → paid; payment reference required), **Reject** (note required). **Download payouts (CSV)**: nickname, whatsapp, kind, amount, status, bank, account_number, account_name, phone, reward_id, with the same formula-injection protection as the other exports.
  - **Awarded, not claimed yet** (hidden + unclaimed), grouped by award batch: edit title/kind/amount inline, **Reveal amount**, **Delete**, **Reject**; per batch **Reveal all hidden rewards in this batch** (reveals the ones with an amount and says how many still need one).
  - **Rejected** with the note and **Reopen**; **Recently paid** (last 30, with reference).
  - **Prize lists** as CSV (first 500 **verified** users and top 10 **verified** referrers; flagged, banned and seed accounts left out; with nickname, WhatsApp number and state code).
- **Award prizes** (`/admin/rewards/award`): three bulk awards, each ending on a confirmation screen (recipients, amount each, total ₦, budget after this award, per-user cap warnings) before anything is saved. Flagged, banned and seed accounts are always skipped, and the screen says how many were skipped and why.
  - **Top referrers**, nationwide or for one state, top N (1–100) in leaderboard order. An editable prize table, one amount per rank, prefilled from the `prize_presets` setting (`top_referrers` nationwide, `top_state_referrers` per state, falling back to the nationwide one); **Save as preset** stores the table. With "Verified corpers only" (on by default) unverified referrers are passed over and the next verified one moves up. Titles get the rank added ("Top referrer prize · #3").
  - **All Early Corpers** (badge holders, not revoked; "Verified corpers only" on by default) and **Selected users** (ticked in Users), each with one amount for everyone.
  - Kind (cash, airtime, data), title and **Show amount to user** (off: rewards start hidden and are revealed later as a batch; on: every recipient needs an amount). Empty amounts are allowed only while hidden.
  - Rewards created together share a `batch_id`. Submitting the same confirmation twice doesn't award twice, and anyone flagged or banned since the confirmation screen is skipped when saving.
  - The budget and per-user cap only **warn**, on the confirmation screen and after saving; they never block.
- **Settings** (`/admin/settings`): **Countdowns and rewards**: `early_deadline` (default `2026-10-02T23:59:59+01:00`; Early Corper badge closes), `leaderboard_close` (default `2026-10-21T23:59:59+01:00`) and `rewards_reveal_text` (default "Prizes are revealed when the countdown ends."). Times must be ISO 8601 with a time zone, and the leaderboard must close after the Early Corper deadline. Also whether "first 500" is counted by position or sign-up order, and the Home **announcement**: on/off, title (max 60 characters), text (200), button label (24) and button link (300; must start with `/` or `https://`). Stored in `settings` as `announcement_active` ("1"/"0"), `announcement_title`, `announcement_body`, `announcement_button_label`, `announcement_button_url`. Changes show on Home right away. **Reward money:** total budget (`rewards_budget_ngn`, default 200000), per-user cap (`max_claim_per_user_ngn`, empty = no cap; the admin is warned when an award or amount edit pushes someone's non-rejected total above it) and the top-referrer presets (`prize_presets`, JSON, default `{"top_referrers":[30000,20000,15000,10000,10000,5000,5000,5000,5000,5000]}`; edited as comma-separated amounts).

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

### Profile completion
Three steps, each worth a third: **add a photo** · **add your state code** · **get your first friend to join with your link** (one valid referral). Home shows the next undone step as a button (photo and state code → Profile, first friend → `/invite`) until 100%. 100% gives the **Profile Complete** badge.

### State prediction (removed for now)
The "Which state will have the most corpers when camp ends?" poll was taken off Rewards and out of profile completion; it will come back. The `state_predictions` table and the admin **Award Prophet badges** button are kept for when it returns (the old UI is in git history, commit `aa6683e`).

### Badges
| Badge | How it's given | Priority | Qualifies for rewards |
|---|---|---|---|
| Early Corper (lime) | Auto: finished sign-up on or before `early_deadline` | 50 | Yes |
| Profile Complete (amber) | Auto: all three profile steps done | 20 | No |
| First Invite (violet) | Auto: at least one valid referral (same rule as positions) | 30 | No |
| Prophet (teal) | Manual, in bulk after the leaderboard closes (needs the prediction poll, currently removed) | 40 | No |
| State Ambassador (pink) | Manual: top referrer in their state, Kopamate team member | 100 | Yes |

- `lib/badges.ts` checks the auto badges after sign-up (for the new user and their referrer), profile changes, photo upload, verification request, and on every Home visit. The check is one idempotent statement that only adds missing badges and never brings back a revoked one.
- The highest-priority badge appears as a small icon next to the nickname on Invite, the Rewards leaderboards, the Corpers state grid and Home's newcomers row (fetched in the same query).
- **Flagged or banned users' badges are hidden everywhere and never count for rewards.** Seed accounts can show badges but are never eligible for rewards (they're left out of every prize list and export).

### Seed accounts
- Accounts created by the seed script have `is_seed = true` (100 by default). They count toward "Corpers joined" and state totals, and appear in the Corpers state lists (after ranked users, without a # position) and in "New from {state}". They never get a position, never appear on leaderboards, their referrals don't count, and they can never qualify for prizes.

---

## 6. Sharing

**WhatsApp share message** (editable in config):

> I just joined Kopamate, the new app for corpers across Nigeria 🇳🇬 There are prizes for the first 500 people. Join with my link: https://[domain]/r/ada347

- Use `https://wa.me/?text=<encoded>` for the WhatsApp button.
- Use the Web Share API when available for a general share option.
- **Open Graph preview** for `/` and `/r/[code]` (`lib/og.tsx`, 1200×630, app fonts): the app name and "Every corper. One place.", with art on the right. For referral links the title is "Chidi invited you to Kopamate", the image says "Chidi invited you" and shows Chidi's photo (JPEG/PNG photos only) or their initial on their avatar colour, in a lime ring. Without an inviter it shows a row of avatar circles.

---

## 7. Design system: "Social Night" (flat, X-style)

Dark by default. **Light mode** can be switched on in Profile (cookie `km_theme`, read in `app/layout.tsx`, which sets `data-theme` on `<html>`).

### Colours
Flat, X-style: true black, **no filled cards**. Cards, lists and banners are outlined with a 1px hairline (`line`) and share the page background; dividers inside lists use the same hairline. Colour comes from lime/pink outlines, text, buttons and badges, not from tinted panels.

| Token | Hex | Use |
|---|---|---|
| `bg` | `#000000` | Page background |
| `surface` | `#000000` | Same as `bg` (cards have no fill) |
| `surface-2` | `#16181C` | The only tint: chips, progress tracks, small icon circles, pressed states |
| `line` | `#2F3336` | Hairline borders and dividers (cards, lists, inputs, bottom nav) |
| `text` | `#E7E9EA` | Main text |
| `text-muted` | `#8B98A5` | Secondary text |
| `text-faint` | `#80868B` | Hints, inactive tabs |
| `lime` | `#C6F432` | Primary buttons, position number, active tab, highlights, "You won" outline |
| `pink` | `#FF4FA3` | Accents, announcement outline, second headline line |

Text on lime or pink is always `#0E0E10`. X's own grey (`#71767B`) was too dim on `surface-2` (3.9:1), so muted and faint are a step lighter; every text colour passes WCAG AA (4.5:1) on `bg` and `surface-2`.

**Light palette** (`[data-theme="light"]` in `globals.css`): same flat style on white. `bg` and `surface` `#FFFFFF`, `surface-2` `#F7F9F9`, `line` `#E1E8ED`, `text` `#0F1419`, `text-muted` `#536471`, `text-faint` `#5B7083`. Lime stays `#C6F432` for fills (dark text on it); lime **text** uses `#4D6B00` and pink text `#C21C6C`. All pass AA on `bg` and `surface-2`.

Avatar background colours for default avatars (pick from the user ID so it's stable): `#C6F432`, `#FF4FA3`, `#FFB547`, `#8B7BFF`, `#4FD1C5`.

### Typography
- **System font stack** everywhere in the app: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`. Headings, big numbers and ranks use it in bold (700) with tight letter spacing; body text at 400/500/700. x.com's own font (Chirp) is licensed to X only, so this is its fallback stack.
- The generated images (WhatsApp Status card, link previews, app icons) still embed Bricolage Grotesque 800 and DM Sans 700 from `@fontsource`, since images can't use the phone's fonts.
- Position number on Home: ~64px, bold, lime. Landing counter: ~64px.

### Shapes and components
- Cards: radius 20–24px, transparent with a 1px `line` border, no fill, no shadows. Lists inside cards are split by `line` dividers.
- Buttons: pill-shaped (fully rounded), height 48–56px. Primary = lime background with dark text. Secondary = transparent with a `line` outline.
- Inputs: height 52px, radius 14px, transparent with a `line` outline (lime when focused).
- Bottom nav: 76px high, 5 equal tabs, icon + label.
- Icons: simple outline icons (e.g. Lucide). **No emoji in the UI** (emoji are fine in the WhatsApp share message).
- **Default avatar:** coloured circle with the first letter of the nickname in bold, dark text.
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
  state_changed_at  timestamptz null   -- no longer written (users can't change state)
  full_name         text null          -- private, optional
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
  kind              text  -- 'cash' | 'airtime' | 'data'
  amount_ngn        int null (> 0)
  status            text  -- 'hidden' | 'unclaimed' | 'claimed' | 'processing' | 'paid' | 'rejected'
  batch_id          text null     -- rewards awarded together (revealed together)
  payout_bank, payout_account_number, payout_account_name, payout_phone   text null  -- private
  claimed_at, processing_at, paid_at, rejected_at   timestamptz null
  payment_reference text null     -- required to mark paid
  admin_note        text null     -- shown to the user when rejected
  created_at        timestamptz
  sent_at           timestamptz null  -- legacy only, no longer written

reward_events                                   -- audit trail
  id                bigserial pk
  reward_id         uuid fk rewards on delete cascade
  actor             text          -- 'user' or the admin's user id
  action            text          -- awarded, edited, revealed, claimed, details_edited, processing, paid, rejected, reopened
  detail            jsonb
  created_at        timestamptz

users (reward columns)
  payout_bank, payout_account_number, payout_account_name   text null  -- last cash claim, to prefill; private

settings                                        -- editable from admin
  key               text pk   -- e.g. 'first_n_mode', 'early_deadline', 'leaderboard_close', 'rewards_reveal_text',
                              --      'rewards_budget_ngn', 'max_claim_per_user_ngn', 'prize_presets'
  value             text

badges
  slug                   text pk      -- early_corper, profile_complete, first_invite, prophet, state_ambassador
  name, description      text
  icon                   text         -- clock | check | link | eye | crown
  color                  text         -- lime | pink | amber | violet | teal
  priority               int          -- highest is shown next to the nickname
  kind                   text         -- 'auto' | 'manual'
  qualifies_for_rewards  boolean

user_badges
  user_id           uuid fk users on delete cascade
  badge_slug        text fk badges
  awarded_at        timestamptz
  awarded_by        text         -- 'system' or the admin's user id
  revoked_at        timestamptz null
  revoked_reason    text null
  primary key (user_id, badge_slug)

follows
  follower_id       uuid fk users on delete cascade
  following_id      uuid fk users on delete cascade
  created_at        timestamptz
  primary key (follower_id, following_id), check follower_id <> following_id

referral_bonuses
  referred_id       uuid pk fk users on delete cascade   -- the friend who got verified
  referrer_id       uuid fk users on delete cascade
  amount_ngn        int (> 0)                             -- the rate when it was earned
  earned_at         timestamptz
  reward_id         uuid null fk rewards on delete set null -- set once withdrawn

state_predictions
  user_id           uuid pk fk users on delete cascade
  state             text not null
  created_at        timestamptz
```

- Keep a cached `valid_referrals` count on users (or a materialised view) so position queries are fast.
- Positions can be computed with a window function (`rank() over (order by score, completed_at)`). Cache public numbers (total, per-state counts, top referrers) for ~30–60 seconds.

---

## 9. Privacy, safety and fairness

- **Public info is only:** nickname, photo (or default avatar), state, position, plus on the profile sheet the join date, whether they're verified, and follower / following counts and lists. **Full names, WhatsApp numbers, emails, state codes, ID card photos and PINs are never exposed** in any page or API response to other users.
- **Payout details** (bank, account number, account name, payout phone, on `rewards` and the remembered ones on `users`) are read only on the owner's own Rewards page and in admin (Payouts, the user page, the payouts CSV). No other query, page or API selects them; Home only reads reward ids, statuses and amounts.
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

### Slow connections (most corpers are on 3G in camp)
- **Server next to the database:** Vercel functions run in the same region as the Supabase database (`vercel.json` `regions`; London `lhr1` for the eu-west-2 database). Change both together, or every query crosses between regions.
- **Database driver:** `lib/db.ts` keeps exactly one query in flight per connection (`max_pipeline: 0`). Pipelined queries through Supabase's transaction pooler (port 6543) lose their reply and the page hangs forever.
- **Avatars:** the phone uploads a 400px photo and a 144px thumbnail; avatars shown at 72px or less use the thumbnail (`/api/avatar/<id>?v=<n>&s=sm`), a few KB each.
- **Status card:** Home shows an HTML preview of the card; the 1080×1920 PNG (~80 KB) downloads only when someone taps Post to Status.
- **Bookkeeping after the response:** analytics and "last seen" writes run in `after()`, so pages don't wait for them.
- **Service worker** (`public/sw.js`): offline page; hashed JS/CSS/fonts, app icons and versioned avatars are served from its cache first (capped), so repeat visits barely download anything. Pages and data always come from the network.
- **Offline banner** when the phone loses its connection, and "Try again" on the error page reloads from the server.

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
- [ ] Home shows position, daily change, next goal, share buttons, new joiners and coming soon.
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
