-- Kopamate database schema. Safe to run more than once.

CREATE SEQUENCE IF NOT EXISTS signup_number_seq;

CREATE TABLE IF NOT EXISTS users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname            text NOT NULL,
  whatsapp_e164       text UNIQUE,              -- private; null until a Google user finishes sign-up
  state               text,
  state_code          text,                     -- private, optional
  photo_data          text,                     -- base64, resized on the phone before upload
  photo_mime          text,
  photo_version       int  NOT NULL DEFAULT 0,
  google_id           text UNIQUE,
  email               text,
  pin_hash            text,
  failed_pin_attempts int  NOT NULL DEFAULT 0,
  pin_locked_until    timestamptz,
  referral_code       text NOT NULL UNIQUE,
  referred_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  signup_number       int UNIQUE,               -- set when sign-up is completed
  completed_at        timestamptz,
  show_in_list        boolean NOT NULL DEFAULT true,
  state_changed_at    timestamptz,
  is_flagged          boolean NOT NULL DEFAULT false,
  is_banned           boolean NOT NULL DEFAULT false,
  signup_ip_hash      text,
  last_seen_on        date,
  last_seen_position  int,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_referred_by_idx ON users (referred_by);
CREATE INDEX IF NOT EXISTS users_state_idx ON users (state);
CREATE INDEX IF NOT EXISTS users_completed_at_idx ON users (completed_at);
CREATE INDEX IF NOT EXISTS users_ip_idx ON users (signup_ip_hash, created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id          text PRIMARY KEY,                 -- sha256 of the cookie token
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS position_snapshots (
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot_date  date NOT NULL,
  position       int  NOT NULL,
  PRIMARY KEY (user_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS rewards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  status       text NOT NULL DEFAULT 'hidden',   -- allowed values: see rewards_status_check_v2 below
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz                       -- legacy: when an old 'sent' reward was sent; no longer written
);
CREATE INDEX IF NOT EXISTS rewards_user_idx ON rewards (user_id);

CREATE TABLE IF NOT EXISTS settings (
  key    text PRIMARY KEY,
  value  text NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  meta        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_name_time_idx ON events (name, created_at);

-- Seed accounts (fake test users): counted in totals, never ranked, never eligible for prizes.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false;

-- Verification for prizes: state code + NYSC ID card photo, checked by an admin.
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'none'
  CHECK (verification_status IN ('none', 'pending', 'verified', 'rejected'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_data text;             -- base64; deleted once an admin decides
ALTER TABLE users ADD COLUMN IF NOT EXISTS id_card_mime text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_requested_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_note text;        -- reason shown to the user when rejected
CREATE UNIQUE INDEX IF NOT EXISTS users_verified_state_code_idx ON users (state_code) WHERE verification_status = 'verified';
CREATE INDEX IF NOT EXISTS users_verification_pending_idx ON users (verification_requested_at) WHERE verification_status = 'pending';

-- Badges. "auto" badges are given by lib/badges.ts checkAutoBadges; "manual" ones by an admin.
CREATE TABLE IF NOT EXISTS badges (
  slug                   text PRIMARY KEY,
  name                   text NOT NULL,
  description            text NOT NULL,
  icon                   text NOT NULL,          -- key into components/BadgeIcon.tsx
  color                  text NOT NULL,          -- lime | pink | amber | violet | teal
  priority               int  NOT NULL DEFAULT 0, -- highest is shown next to the nickname
  kind                   text NOT NULL CHECK (kind IN ('auto', 'manual')),
  qualifies_for_rewards  boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_slug      text NOT NULL REFERENCES badges(slug),
  awarded_at      timestamptz NOT NULL DEFAULT now(),
  awarded_by      text NOT NULL DEFAULT 'system',  -- 'system' or the admin's user id
  revoked_at      timestamptz,
  revoked_reason  text,
  PRIMARY KEY (user_id, badge_slug)
);
CREATE INDEX IF NOT EXISTS user_badges_slug_idx ON user_badges (badge_slug) WHERE revoked_at IS NULL;

INSERT INTO badges (slug, name, description, icon, color, priority, kind, qualifies_for_rewards) VALUES
  ('early_corper', 'Early Corper', 'Joined before 2 Oct', 'clock', 'lime', 50, 'auto', true),
  ('profile_complete', 'Profile Complete', 'Finished every step of your profile', 'check', 'amber', 20, 'auto', false),
  ('first_invite', 'First Invite', 'A friend joined with your link', 'link', 'violet', 30, 'auto', false),
  ('prophet', 'Prophet', 'Predicted the winning state', 'eye', 'teal', 40, 'manual', false),
  ('state_ambassador', 'State Ambassador', 'Top referrer in their state, Kopamate team member', 'crown', 'pink', 100, 'manual', true)
ON CONFLICT (slug) DO NOTHING;

-- "Which state will have the most corpers when camp ends?" One vote per user, changeable until early_deadline.
CREATE TABLE IF NOT EXISTS state_predictions (
  user_id     uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS state_predictions_state_idx ON state_predictions (state);

-- Small avatar (144×144) made on the phone at upload, served for avatars shown at 72px or less.
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_thumb_data text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_thumb_mime text;

-- Reward claims and payouts.
-- Lifecycle: hidden → unclaimed → claimed → processing → paid; unclaimed/claimed/processing → rejected; rejected → unclaimed.
-- payout_* columns are private: read only on the owner's Rewards page and in admin.
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'cash' CHECK (kind IN ('cash', 'airtime', 'data'));
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS amount_ngn int CHECK (amount_ngn IS NULL OR amount_ngn > 0);
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS payout_bank text;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS payout_account_number text;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS payout_account_name text;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS payout_phone text;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS processing_at timestamptz;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS paid_at timestamptz;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS admin_note text;          -- reason shown to the user when rejected
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS batch_id text;            -- rewards awarded together, revealed together

-- Old statuses: 'pending' (not sent yet) becomes 'hidden' (admin sets an amount, then reveals);
-- 'sent' becomes 'paid' with reference 'legacy'. Amounts stay empty. Runs once; later runs find nothing to change.
ALTER TABLE rewards DROP CONSTRAINT IF EXISTS rewards_status_check;
UPDATE rewards SET status = 'hidden' WHERE status = 'pending';
UPDATE rewards SET status = 'paid', paid_at = sent_at, payment_reference = 'legacy' WHERE status = 'sent';
ALTER TABLE rewards ALTER COLUMN status SET DEFAULT 'hidden';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rewards_status_check_v2' AND conrelid = 'rewards'::regclass) THEN
    ALTER TABLE rewards ADD CONSTRAINT rewards_status_check_v2
      CHECK (status IN ('hidden', 'unclaimed', 'claimed', 'processing', 'paid', 'rejected'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS rewards_status_idx ON rewards (status);
CREATE INDEX IF NOT EXISTS rewards_batch_idx ON rewards (batch_id) WHERE batch_id IS NOT NULL;

-- Audit trail: one row per status change, amount edit, reveal and payout details edit.
CREATE TABLE IF NOT EXISTS reward_events (
  id          bigserial PRIMARY KEY,
  reward_id   uuid NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  actor       text NOT NULL,                    -- 'user' or the admin's user id
  action      text NOT NULL,
  detail      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reward_events_reward_idx ON reward_events (reward_id, created_at);

-- Last bank details a user claimed with, to prefill their next claim. Private, same rule as payout_*.
ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_bank text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_account_number text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payout_account_name text;

-- Reward money settings (editable in admin). Empty max_claim_per_user_ngn means no cap.
INSERT INTO settings (key, value) VALUES
  ('rewards_budget_ngn', '200000'),
  ('max_claim_per_user_ngn', ''),
  ('prize_presets', '{"top_referrers":[30000,20000,15000,10000,10000,5000,5000,5000,5000,5000]}')
ON CONFLICT (key) DO NOTHING;

-- Follows: anyone can follow any other corper. Counts and lists show on profiles.
CREATE TABLE IF NOT EXISTS follows (
  follower_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows (following_id, created_at DESC);

-- Referral bonus: one row per invited friend who got verified, worth referral_bonus_ngn at the time it was
-- earned. Unwithdrawn rows (reward_id NULL) add up to the referrer's balance; withdrawing turns them into one
-- normal reward (claimed and paid like any other) and links the rows to it. Deleting that reward frees them.
CREATE TABLE IF NOT EXISTS referral_bonuses (
  referred_id  uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  referrer_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_ngn   int NOT NULL CHECK (amount_ngn > 0),
  earned_at    timestamptz NOT NULL DEFAULT now(),
  reward_id    uuid REFERENCES rewards(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS referral_bonuses_referrer_idx ON referral_bonuses (referrer_id);

-- 0 switches the bonus off. Withdrawals need at least the minimum balance.
INSERT INTO settings (key, value) VALUES
  ('referral_bonus_enabled', '1'),
  ('referral_bonus_ngn', '250'),
  ('referral_bonus_min_withdraw_ngn', '1000')
ON CONFLICT (key) DO NOTHING;

-- Full name, optional, added in Profile. Private: only the user and admins see it (like the phone number).
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name text;

-- Verification checks against duplicate and fake requests.
-- Attempts: 24 hours between tries after a rejection, at most 3 tries (an admin can allow more).
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_attempts int NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_rejected_at timestamptz;

-- A fingerprint of each ID card photo sent (never the photo): an exact hash of the uploaded file and a
-- 64-bit difference hash that survives re-saving and resizing. Used to spot one card photo on many accounts.
CREATE TABLE IF NOT EXISTS id_card_fingerprints (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sha256      text NOT NULL,
  dhash       bigint,
  state_code  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS id_card_fingerprints_sha_idx ON id_card_fingerprints (sha256);
CREATE INDEX IF NOT EXISTS id_card_fingerprints_user_idx ON id_card_fingerprints (user_id);

-- Every verification request and decision, so admins can see earlier rejections and why.
CREATE TABLE IF NOT EXISTS verification_events (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action      text NOT NULL,                 -- requested, approved, rejected, revoked, reset
  state_code  text,
  note        text,
  actor       text NOT NULL,                 -- 'user' or the admin's user id
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_events_user_idx ON verification_events (user_id, created_at DESC);

-- State codes an admin found to be fake: no account can use them again.
CREATE TABLE IF NOT EXISTS blocked_state_codes (
  code        text PRIMARY KEY,
  reason      text,
  blocked_by  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Daily Quiz: the same QUESTIONS_PER_DAY questions for everyone each Lagos day (lib/quiz.ts).
CREATE TABLE IF NOT EXISTS quiz_questions (
  id            serial PRIMARY KEY,
  category      text NOT NULL,
  difficulty    smallint NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 3),
  question      text NOT NULL UNIQUE,
  options       text[] NOT NULL CHECK (array_length(options, 1) = 4),  -- the right answer is options[1]
  active        boolean NOT NULL DEFAULT true,
  last_used_on  date,
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- A line shown on the back of the card after answering (optional).
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS fact text;
CREATE TABLE IF NOT EXISTS quiz_days (
  day           date PRIMARY KEY,
  question_ids  int[] NOT NULL
);
-- One per player per day. `state` is where they served when they played; it scores for that state.
CREATE TABLE IF NOT EXISTS quiz_attempts (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day          date NOT NULL,
  state        text NOT NULL,
  points       int NOT NULL DEFAULT 0,   -- from answers
  bonus        int NOT NULL DEFAULT 0,   -- streak bonus, added when the quiz is finished
  correct      int NOT NULL DEFAULT 0,
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  PRIMARY KEY (user_id, day)
);
CREATE INDEX IF NOT EXISTS quiz_attempts_day_idx ON quiz_attempts (day, state);
-- Each question as served: the server keeps the clock, and `perm` is this player's option order,
-- so "it's B" can't be passed around. choice is the shown position tapped (null: ran out of time).
CREATE TABLE IF NOT EXISTS quiz_answers (
  user_id      uuid NOT NULL,
  day          date NOT NULL,
  idx          smallint NOT NULL,
  question_id  int NOT NULL REFERENCES quiz_questions(id),
  perm         smallint[] NOT NULL,
  served_at    timestamptz NOT NULL DEFAULT now(),
  answered_at  timestamptz,
  choice       smallint,
  correct      boolean,
  points       int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, idx),
  FOREIGN KEY (user_id, day) REFERENCES quiz_attempts(user_id, day) ON DELETE CASCADE
);

-- State League: one row per finished week (Monday, Lagos), written by the weekly close job.
CREATE TABLE IF NOT EXISTS league_weeks (
  week          date PRIMARY KEY,
  winner_state  text,
  standings     jsonb NOT NULL,
  top_players   jsonb NOT NULL,
  closed_at     timestamptz NOT NULL DEFAULT now()
);
INSERT INTO badges (slug, name, description, icon, color, priority, kind, qualifies_for_rewards) VALUES
  ('champion_state', 'Champion State', 'Played for the state that won a League week', 'trophy', 'lime', 55, 'manual', false),
  ('quiz_mvp', 'Quiz MVP', 'Top player in Nigeria for a League week', 'crown', 'amber', 70, 'manual', false)
ON CONFLICT (slug) DO NOTHING;

-- Streaks (see lib/streaks.ts). A day counts when you finish the Daily Quiz. A freeze covers one missed
-- day: you earn one every 7 days in a row and one per friend who joins with your link, holding at most 2.
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak int NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_on date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_best int NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_freezes int NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS streak_days (
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day      date NOT NULL,                    -- Lagos date
  frozen   boolean NOT NULL DEFAULT false,   -- covered by a freeze instead of played
  PRIMARY KEY (user_id, day)
);
INSERT INTO badges (slug, name, description, icon, color, priority, kind, qualifies_for_rewards) VALUES
  ('streak_7', '7-Day Streak', 'Played the Daily Quiz 7 days in a row', 'flame', 'amber', 25, 'auto', false),
  ('streak_30', '30-Day Streak', 'Played the Daily Quiz 30 days in a row', 'flame', 'pink', 45, 'auto', false),
  ('streak_100', '100-Day Streak', 'Played the Daily Quiz 100 days in a row', 'flame', 'violet', 60, 'auto', false)
ON CONFLICT (slug) DO NOTHING;

-- Web push: one row per browser that turned notifications on.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint    text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id);

-- Usernames: the nickname column now holds a unique username like on X: 2 to 20 letters, numbers, _ or .,
-- unique ignoring capitals (lib/validate.ts validateUsername). Runs once, before the unique index exists:
-- spaces become _, common accents are dropped, anything else is removed (and _ or . at either end); too-short
-- names become corper<n>;
-- when names clash, real accounts beat seed accounts, then whoever joined first keeps it; the others get a short
-- suffix (they can change it in Profile).
DO $$
DECLARE
  changed int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'users_username_idx') THEN
    UPDATE users SET nickname = left(regexp_replace(regexp_replace(regexp_replace(
        translate(btrim(nickname),
          'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÑñẸẹỌọṢṣŃńǸǹÇç',
          'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnEeOoSsNnNnCc'),
        '\s+', '_', 'g'), '[^A-Za-z0-9_.]', '', 'g'), '^[_.]+|[_.]+$', '', 'g'), 20)
    WHERE nickname !~ '^[A-Za-z0-9_.]{2,20}$';
    UPDATE users SET nickname = 'corper' || COALESCE(signup_number::text, substr(md5(id::text), 1, 6))
    WHERE length(nickname) < 2 OR nickname !~ '[A-Za-z]';
    LOOP
      UPDATE users u SET nickname = left(u.nickname, 15) || '_' || substr(md5(random()::text), 1, 4)
      FROM (
        SELECT id, row_number() OVER (PARTITION BY lower(nickname) ORDER BY is_seed, completed_at NULLS LAST, created_at, signup_number NULLS LAST, id) AS rn
        FROM users
      ) d
      WHERE d.id = u.id AND d.rn > 1;
      GET DIAGNOSTICS changed = ROW_COUNT;
      EXIT WHEN changed = 0;
    END LOOP;
    CREATE UNIQUE INDEX users_username_idx ON users (lower(nickname));
  END IF;
END $$;

-- Opportunities: jobs, internships, scholarships and more, pulled daily from public RSS feeds by
-- /api/cron/opportunities (lib/opportunities.ts) or added by an admin. Admins can hide or pin any of them.
CREATE TABLE IF NOT EXISTS opportunities (
  id            bigserial PRIMARY KEY,
  url           text NOT NULL UNIQUE,
  title         text NOT NULL,
  summary       text,
  source        text NOT NULL,                 -- site name, or 'Kopamate' for admin posts
  category      text NOT NULL CHECK (category IN ('jobs', 'internships', 'scholarships', 'fellowships', 'grants', 'contests', 'programs')),
  deadline      text,                          -- as the source wrote it ("31 October 2026", "Ongoing")
  published_at  timestamptz NOT NULL DEFAULT now(),
  hidden        boolean NOT NULL DEFAULT false,
  pinned        boolean NOT NULL DEFAULT false,
  added_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS opportunities_list_idx ON opportunities (published_at DESC) WHERE NOT hidden;
CREATE INDEX IF NOT EXISTS opportunities_category_idx ON opportunities (category, published_at DESC) WHERE NOT hidden;

-- Announcements from the Kopamate team, newest first on Home and in Notifications. A pinned one shows as the
-- banner at the top of Home.
CREATE TABLE IF NOT EXISTS announcements (
  id            bigserial PRIMARY KEY,
  title         text NOT NULL,
  body          text,
  button_label  text,
  button_url    text,                          -- in-app ("/…") or https
  pinned        boolean NOT NULL DEFAULT false,
  created_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS announcements_time_idx ON announcements (created_at DESC);

-- The old single Home announcement (settings announcement_*) becomes the first pinned announcement. Runs once.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM settings WHERE key = 'announcements_migrated') THEN
    INSERT INTO announcements (title, body, button_label, button_url, pinned)
    SELECT t.value, NULLIF(b.value, ''), NULLIF(l.value, ''), NULLIF(u.value, ''), true
    FROM settings a
    JOIN settings t ON t.key = 'announcement_title' AND t.value <> ''
    LEFT JOIN settings b ON b.key = 'announcement_body'
    LEFT JOIN settings l ON l.key = 'announcement_button_label'
    LEFT JOIN settings u ON u.key = 'announcement_button_url'
    WHERE a.key = 'announcement_active' AND a.value = '1';
    INSERT INTO settings (key, value) VALUES ('announcements_migrated', '1');
  END IF;
END $$;

-- Personal notifications (the bell on Home). Written by the triggers below, so every code path that follows,
-- awards a badge, reveals or pays a reward, or finishes a referred sign-up creates one.
-- Unread = newer than users.notifications_seen_at (announcements count too).
CREATE TABLE IF NOT EXISTS notifications (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL,                   -- follow | badge | reward | paid | friend
  title       text NOT NULL,
  body        text,
  url         text,
  actor_id    uuid REFERENCES users(id) ON DELETE CASCADE,  -- the person it's about (opens their profile)
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_seen_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION notify_follow() RETURNS trigger AS $$
DECLARE nick text;
BEGIN
  SELECT nickname INTO nick FROM users WHERE id = NEW.follower_id;
  -- Unfollow then follow again within a day doesn't notify twice.
  IF NOT EXISTS (
    SELECT 1 FROM notifications
    WHERE user_id = NEW.following_id AND kind = 'follow' AND actor_id = NEW.follower_id AND created_at > now() - interval '1 day'
  ) THEN
    INSERT INTO notifications (user_id, kind, title, actor_id) VALUES (NEW.following_id, 'follow', nick || ' followed you', NEW.follower_id);
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS follows_notify ON follows;
CREATE TRIGGER follows_notify AFTER INSERT ON follows FOR EACH ROW EXECUTE FUNCTION notify_follow();

CREATE OR REPLACE FUNCTION notify_badge() RETURNS trigger AS $$
BEGIN
  INSERT INTO notifications (user_id, kind, title, body, url)
  SELECT NEW.user_id, 'badge', 'You earned the ' || b.name || ' badge', b.description, '/profile'
  FROM badges b WHERE b.slug = NEW.badge_slug;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS user_badges_notify ON user_badges;
CREATE TRIGGER user_badges_notify AFTER INSERT ON user_badges FOR EACH ROW EXECUTE FUNCTION notify_badge();

-- A reward becoming visible (unclaimed) or paid. Hidden rewards stay secret until the admin reveals them.
CREATE OR REPLACE FUNCTION notify_reward() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'unclaimed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'unclaimed') THEN
    INSERT INTO notifications (user_id, kind, title, body, url)
    VALUES (NEW.user_id, 'reward', 'You won: ' || NEW.title, 'Claim it on your Rewards page.', '/rewards');
  ELSIF NEW.status = 'paid' AND TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'paid' THEN
    INSERT INTO notifications (user_id, kind, title, url) VALUES (NEW.user_id, 'paid', 'Paid: ' || NEW.title, '/rewards');
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS rewards_notify ON rewards;
CREATE TRIGGER rewards_notify AFTER INSERT OR UPDATE OF status ON rewards FOR EACH ROW EXECUTE FUNCTION notify_reward();

-- Someone finished sign-up with a friend's link (sign-up inserts a finished user; Google sign-up finishes later).
CREATE OR REPLACE FUNCTION notify_friend_joined() RETURNS trigger AS $$
BEGIN
  IF NEW.referred_by IS NOT NULL AND NEW.completed_at IS NOT NULL AND NOT NEW.is_seed
     AND (TG_OP = 'INSERT' OR OLD.completed_at IS NULL) THEN
    INSERT INTO notifications (user_id, kind, title, actor_id)
    VALUES (NEW.referred_by, 'friend', NEW.nickname || ' joined with your link', NEW.id);
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS users_friend_notify ON users;
CREATE TRIGGER users_friend_notify AFTER INSERT OR UPDATE OF completed_at ON users FOR EACH ROW EXECUTE FUNCTION notify_friend_joined();

-- Announcements get a type (sets the label and colour on Home), can be hidden (drafts, or taken down), and
-- count as new from when they were first shown, not when they were written.
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'general';
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS updated_at timestamptz;
UPDATE announcements SET published_at = created_at WHERE published_at IS NULL AND visible;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'announcements_kind_check') THEN
    ALTER TABLE announcements ADD CONSTRAINT announcements_kind_check
      CHECK (kind IN ('general', 'update', 'promotion', 'event', 'reminder', 'contest'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS announcements_published_idx ON announcements (published_at DESC) WHERE visible;

-- Where someone is in NYSC (lib/nysc.ts): waiting (no call-up yet), posted (call-up, camp not started),
-- serving, served (passed out). Everyone plays the quiz and League whatever their stage. The batch ("2026B2":
-- year, letter, stream) lets the daily cron move people on. Everyone who joined before this is 'serving'
-- until they confirm on Home (stage_confirmed_at stays null till then).
ALTER TABLE users ADD COLUMN IF NOT EXISTS nysc_stage text NOT NULL DEFAULT 'serving';
ALTER TABLE users ADD COLUMN IF NOT EXISTS nysc_batch text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stage_confirmed_at timestamptz;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_nysc_stage_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_nysc_stage_check CHECK (nysc_stage IN ('waiting', 'posted', 'serving', 'served'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_nysc_batch_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_nysc_batch_check CHECK (nysc_batch ~ '^\d{4}[ABC][12]?$');
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS users_state_stage_idx ON users (state, nysc_stage);

-- Challenges (lib/challenges.ts). A challenge has a brief, rules and a prize pool that grows with approved
-- entries. People join (verified, handles, follow us, accept rules), then submit up to max_entries_per_user
-- post links. Each entry has its own link (/c/<entry_code>) that works like an invite link, so sign-ups are
-- credited to the entry. The team picks winners offline; publishing creates rewards in the rewards system.
CREATE TABLE IF NOT EXISTS challenges (
  id                    serial PRIMARY KEY,
  slug                  text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,60}$'),
  title                 text NOT NULL,
  badge_name            text NOT NULL,                       -- short name for badges, like "Creator Challenge #1"
  brief                 text NOT NULL DEFAULT '',
  ideas                 text NOT NULL DEFAULT '',            -- one example idea per line
  rules                 text NOT NULL DEFAULT '',            -- one rule per line
  hashtag               text,                                -- a suggestion only, never required
  required_tags         jsonb NOT NULL DEFAULT '{}',         -- {"x":"@kopamate","tiktok":"@kopamate","instagram":"@kopamate"}
  social_links          jsonb NOT NULL DEFAULT '{}',         -- {"x":"https://…","tiktok":…,"instagram":…,"whatsapp":…}
  max_entries_per_user  int NOT NULL DEFAULT 3 CHECK (max_entries_per_user BETWEEN 1 AND 10),
  opens_at              timestamptz,
  closes_at             timestamptz,
  verify_by             timestamptz,                         -- sign-ups must be verified by then to count (null: closes_at + 14 days)
  metrics_due_hours     int NOT NULL DEFAULT 72,
  pool_base             int NOT NULL DEFAULT 100000,
  pool_step_entries     int NOT NULL DEFAULT 50 CHECK (pool_step_entries > 0),
  pool_step_amount      int NOT NULL DEFAULT 10000,
  pool_cap              int NOT NULL DEFAULT 200000,
  prize_split           jsonb NOT NULL,                      -- [{"key":"first","label":"1st place","pct":50}, …]
  status                text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'upcoming', 'open', 'closed', 'results')),
  published_at          timestamptz,                         -- when winners were published (locks the challenge)
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_participants (
  challenge_id                int NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id                     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  x_handle                    text,
  tiktok_handle               text,
  instagram_handle            text,
  confirmed_follow_x          boolean NOT NULL DEFAULT false,
  confirmed_follow_other      boolean NOT NULL DEFAULT false,
  confirmed_whatsapp_channel  boolean NOT NULL DEFAULT false,
  accepted_rules_at           timestamptz NOT NULL DEFAULT now(),
  -- Finalist checks, by hand: follows on X, the other platform and the WhatsApp Channel.
  check_x                     boolean,
  check_other                 boolean,
  check_whatsapp              boolean,
  follow_check_status         text NOT NULL DEFAULT 'unchecked' CHECK (follow_check_status IN ('unchecked', 'ok', 'failed')),
  checked_by                  uuid REFERENCES users(id) ON DELETE SET NULL,
  checked_at                  timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id),
  CHECK (x_handle IS NOT NULL OR tiktok_handle IS NOT NULL OR instagram_handle IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS challenge_entries (
  id                       serial PRIMARY KEY,
  challenge_id             int NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id                  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform                 text NOT NULL CHECK (platform IN ('x', 'tiktok', 'instagram')),
  post_url                 text NOT NULL,
  format                   text NOT NULL CHECK (format IN ('video', 'meme_art', 'skit', 'song', 'carousel', 'other')),
  caption_note             text CHECK (char_length(caption_note) <= 200),
  entry_code               text NOT NULL UNIQUE,
  submitted_at             timestamptz NOT NULL DEFAULT now(),
  status                   text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'disqualified')),
  reject_reason            text,
  reviewed_by              uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at              timestamptz,
  first_approved_at        timestamptz,
  -- Post stats the entrant adds after metrics_due_hours, with a screenshot (admins only).
  views                    int CHECK (views >= 0),
  likes                    int CHECK (likes >= 0),
  comments                 int CHECK (comments >= 0),
  shares                   int CHECK (shares >= 0),
  metrics_screenshot       text,                              -- base64, resized on the phone
  metrics_screenshot_mime  text,
  metrics_submitted_at     timestamptz,
  metrics_verified         boolean NOT NULL DEFAULT false,
  metrics_verified_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  metrics_reminded_at      timestamptz,
  UNIQUE (challenge_id, post_url)
);
CREATE INDEX IF NOT EXISTS challenge_entries_user_idx ON challenge_entries (challenge_id, user_id);
CREATE INDEX IF NOT EXISTS challenge_entries_status_idx ON challenge_entries (challenge_id, status, submitted_at DESC);

-- One row per person who signed up through a participant's link during the challenge. Whether it counts
-- is worked out when read (lib/challenges.ts countedSignup), so a later verification or revoke just works.
CREATE TABLE IF NOT EXISTS challenge_signups (
  id                bigserial PRIMARY KEY,
  challenge_id      int NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  entry_id          int REFERENCES challenge_entries(id) ON DELETE SET NULL,
  referrer_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  new_user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signed_up_at      timestamptz NOT NULL DEFAULT now(),
  void_reason       text,
  voided_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  voided_at         timestamptz,
  UNIQUE (challenge_id, new_user_id)
);
CREATE INDEX IF NOT EXISTS challenge_signups_referrer_idx ON challenge_signups (challenge_id, referrer_user_id);
CREATE INDEX IF NOT EXISTS challenge_signups_entry_idx ON challenge_signups (entry_id);

-- Winners picked by the team; one prize per person.
CREATE TABLE IF NOT EXISTS challenge_winners (
  challenge_id  int NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  prize_key     text NOT NULL,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id      int REFERENCES challenge_entries(id) ON DELETE SET NULL,
  amount_ngn    int NOT NULL CHECK (amount_ngn > 0),
  reward_id     uuid REFERENCES rewards(id) ON DELETE SET NULL,
  PRIMARY KEY (challenge_id, prize_key),
  UNIQUE (challenge_id, user_id)
);

-- Audit log of admin actions on a challenge.
CREATE TABLE IF NOT EXISTS challenge_events (
  id            bigserial PRIMARY KEY,
  challenge_id  int NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  actor         uuid REFERENCES users(id) ON DELETE SET NULL,
  action        text NOT NULL,
  detail        jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS challenge_events_idx ON challenge_events (challenge_id, created_at DESC);

INSERT INTO badges (slug, name, description, icon, color, priority, kind, qualifies_for_rewards) VALUES
  ('founding_creator', 'Founding Creator', 'One of the first 50 creators with an approved challenge entry', 'flame', 'pink', 60, 'manual', false)
ON CONFLICT (slug) DO NOTHING;

-- Creator Challenge #1, as a draft. Dates and social links are set in Admin → Challenges.
INSERT INTO challenges (slug, title, badge_name, hashtag, required_tags, prize_split, brief, ideas, rules) VALUES (
  'creator-challenge-1',
  'Kopamate Creator Challenge #1',
  'Creator Challenge #1',
  '#KopamateChallenge',
  '{"x": "@kopamate", "tiktok": "@kopamate", "instagram": "@kopamate"}',
  '[{"key": "first", "label": "1st place", "pct": 50},
    {"key": "second", "label": "2nd place", "pct": 20},
    {"key": "third", "label": "3rd place", "pct": 10},
    {"key": "recruiter", "label": "Top Recruiter", "pct": 10},
    {"key": "rising", "label": "Rising creator", "pct": 10}]',
  'Make something about Kopamate: a video, skit, meme, art, song or carousel. Post it on X, TikTok or Instagram, tag @kopamate and put your Kopamate link in the caption or bio. The more people join Kopamate through your link, the better your chances.',
  E'POV: you found your camp buddy on Kopamate before camp\nCorper life before vs after Kopamate\nThings corpers say at camp (Kopamate edition)\nA Kopamate jingle\nMemes about allawee, camp and CDS',
  E'Open to verified Kopamate users aged 18+, one account per person.\nFollow @kopamate on X (and TikTok or Instagram if you post there) and join our WhatsApp Channel. We check finalists.\nPosts must be public and original, tag @kopamate, and include your Kopamate link from the app in the caption or bio. Up to 3 entries. #KopamateChallenge is welcome but optional.\nWinners are chosen by the Kopamate team based on the people you bring to Kopamate, your post''s reach, and the quality of your content. Only people who join through your link and verify their account count.\nFake sign-ups, bought views or likes, bots, stolen content or multiple accounts lead to disqualification.\nNo politics, religion or ethnic content, no insults, nothing explicit.\nDon''t use the NYSC logo or crest, and don''t suggest NYSC endorses Kopamate.\nBy entering, you allow Kopamate to repost your entry with credit.\nWinners must verify their identity before payment. Prizes are paid within 7 days of verification.\nNo purchase needed. Kopamate''s decisions on eligibility and winners are final.'
) ON CONFLICT (slug) DO NOTHING;

-- Post stats (views, likes, screenshot) are optional per challenge; off unless the team asks for them.
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS ask_for_stats boolean NOT NULL DEFAULT false;

-- NYSC checklist (/nysc-checklist): a signed-in user's answers and ticks (lib/pcm-rules.ts Plan). The guide
-- content itself lives in settings (pcm_guide, pcm_guide_previous, pcm_guide_version, pcm_guide_enabled).
ALTER TABLE users ADD COLUMN IF NOT EXISTS pcm_plan jsonb;

-- People and connecting (lib/social.ts). Profile fields are all optional and shown as plain text.
-- The nickname is the @username (unique, see users_username_idx); username_changed_at limits changes to one
-- every 30 days, and username_redirects keeps an old one pointing to the new one for 30 days.
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio text CHECK (char_length(bio) <= 160);
ALTER TABLE users ADD COLUMN IF NOT EXISTS school text CHECK (char_length(school) <= 80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_set_at timestamptz;      -- when the school was first added (school_joined)
ALTER TABLE users ADD COLUMN IF NOT EXISTS course text CHECK (char_length(course) <= 80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS open_to text[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS links jsonb NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_changed_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hi_policy text NOT NULL DEFAULT 'everyone';
ALTER TABLE users ADD COLUMN IF NOT EXISTS strength_dismissed_at timestamptz;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_hi_policy_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_hi_policy_check CHECK (hi_policy IN ('everyone', 'following', 'nobody'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_interests_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_interests_check CHECK (cardinality(interests) <= 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_open_to_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_open_to_check CHECK (open_to <@ ARRAY['work', 'collab', 'friends', 'mentoring']::text[]);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS users_school_idx ON users (lower(school)) WHERE school IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_interests_idx ON users USING gin (interests);
CREATE INDEX IF NOT EXISTS users_open_to_idx ON users USING gin (open_to);
CREATE INDEX IF NOT EXISTS follows_follower_time_idx ON follows (follower_id, created_at DESC);

CREATE TABLE IF NOT EXISTS username_redirects (
  old_name    text PRIMARY KEY,                 -- lower(old nickname)
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS username_redirects_user_idx ON username_redirects (user_id);

-- "Say hi": a request to connect. Accepted, both see a WhatsApp button on each other's profile.
CREATE TABLE IF NOT EXISTS connections (
  id            bigserial PRIMARY KEY,
  from_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'removed')),
  note          text CHECK (char_length(note) <= 140),
  created_at    timestamptz NOT NULL DEFAULT now(),
  responded_at  timestamptz,
  CHECK (from_id <> to_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS connections_pending_idx ON connections (least(from_id, to_id), greatest(from_id, to_id)) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS connections_from_idx ON connections (from_id, created_at DESC);
CREATE INDEX IF NOT EXISTS connections_to_idx ON connections (to_id, status);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON blocks (blocked_id);

CREATE TABLE IF NOT EXISTS reports (
  id           bigserial PRIMARY KEY,
  reporter_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason       text NOT NULL CHECK (reason IN ('fake', 'harassment', 'spam', 'inappropriate', 'other')),
  note         text CHECK (char_length(note) <= 300),
  status       text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  closed_at    timestamptz,
  closed_by    uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS reports_open_idx ON reports (reporter_id, target_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reports_target_idx ON reports (target_id);

-- Notifications for "Say hi" carry the request id here (kinds hi_request, hi_accepted, school_joined).
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS data jsonb;
CREATE INDEX IF NOT EXISTS notifications_actor_idx ON notifications (actor_id) WHERE actor_id IS NOT NULL;
