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

-- ============================================================================================================
-- My Hustle (docs/MY_HUSTLE_PROMPT.md): a business game played with game naira, which can never be withdrawn,
-- bought or converted. Money is whole naira. Every balance change goes through lib/hustle/ledger.ts move(),
-- which writes hustle_ledger in the same transaction, so balances always equal the sum of the ledger.
-- ============================================================================================================

-- Business types. Admins edit every number; a change applies from the next business day.
CREATE TABLE IF NOT EXISTS hustle_business_types (
  slug                        text PRIMARY KEY,
  name                        text NOT NULL,
  blurb                       text NOT NULL DEFAULT '',
  category                    text NOT NULL CHECK (category IN ('food', 'services', 'supply')),
  tier                        text NOT NULL DEFAULT 'starter' CHECK (tier IN ('starter', 'growth')),
  unit_name                   text NOT NULL,                 -- "plate", "haircut", "lot"
  kind                        text NOT NULL CHECK (kind IN ('consumer', 'supplier', 'b2b')),
  sells_supply                boolean NOT NULL DEFAULT false, -- a consumer business that also sells lots (provision store)
  perishable                  boolean NOT NULL DEFAULT false, -- unsold units are wasted at close
  slots                       boolean NOT NULL DEFAULT false, -- units are appointments: unused ones expire, nothing spoils
  open_air                    boolean NOT NULL DEFAULT false, -- rain hits demand
  expiry_days                 int,                            -- for supply lots bought from this type
  default_price               int NOT NULL CHECK (default_price > 0),
  cost_per_unit               int NOT NULL CHECK (cost_per_unit >= 0),
  capacity_per_day            int NOT NULL CHECK (capacity_per_day > 0),
  rent_per_day                int NOT NULL DEFAULT 0,
  upkeep_per_day              int NOT NULL DEFAULT 0,
  upkeep_provider_type        text,
  marketing_per_day           int NOT NULL DEFAULT 0,
  supply_type                 text,                           -- the supplier type it buys lots from
  units_per_supply_lot        int,
  setup_cost                  int NOT NULL,
  townspeople_demand_per_day  int NOT NULL,                   -- naira a day per state, before multipliers
  price_floor_pct             numeric(4,2) NOT NULL DEFAULT 0.5,
  price_ceiling_pct           numeric(4,2) NOT NULL DEFAULT 1.5,
  need_key                    text,                           -- the player need it satisfies
  need_days                   int,                            -- how long one purchase satisfies it
  is_active                   boolean NOT NULL DEFAULT true,
  sort                        int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hustle_businesses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,  -- one business per user (MVP)
  type_slug       text NOT NULL REFERENCES hustle_business_types(slug),
  name            text NOT NULL,
  slug            text NOT NULL UNIQUE,
  icon            text NOT NULL,
  color           text NOT NULL,
  state           text NOT NULL,                  -- copied from the owner at creation, never changes
  stage           int NOT NULL DEFAULT 1 CHECK (stage BETWEEN 1 AND 2),
  rating          numeric(3,2) NOT NULL DEFAULT 4.0,
  rating_count    int NOT NULL DEFAULT 0,
  cash            bigint NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'restructured', 'closed')),
  hot_until       date,                           -- started as a "hot" type: +20% townspeople demand until then
  closed_through  date NOT NULL,                  -- last business day that has been closed (rent charged etc.)
  restructures    int NOT NULL DEFAULT 0,
  trading_frozen  boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hustle_businesses_state_type_idx ON hustle_businesses (state, type_slug);

CREATE TABLE IF NOT EXISTS hustle_wallets (
  user_id             uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance             bigint NOT NULL DEFAULT 0,
  last_allawee_month  text,                       -- "2026-10"
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hustle_ledger (
  id         bigserial PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  from_kind  text NOT NULL CHECK (from_kind IN ('wallet', 'business', 'system')),
  from_id    uuid,                                -- user id for a wallet, business id for a business
  to_kind    text NOT NULL CHECK (to_kind IN ('wallet', 'business', 'system')),
  to_id      uuid,
  amount     bigint NOT NULL CHECK (amount > 0),
  reason     text NOT NULL CHECK (reason IN ('grant', 'allawee', 'task', 'prize', 'purchase_need', 'purchase_supply', 'sale',
               'rent', 'upkeep', 'marketing', 'running_cost', 'backup_market', 'townspeople', 'spoilage_salvage', 'credit_repaid',
               'decision', 'invest', 'owner_draw', 'admin_adjust', 'restructure')),
  source     text,                                -- task source ("quiz", "follow"...) or a short label
  ref_id     text,
  note       text
);
CREATE INDEX IF NOT EXISTS hustle_ledger_from_idx ON hustle_ledger (from_id, at DESC) WHERE from_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS hustle_ledger_to_idx ON hustle_ledger (to_id, at DESC) WHERE to_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS hustle_ledger_reason_idx ON hustle_ledger (reason, at);

CREATE TABLE IF NOT EXISTS hustle_days (
  business_id         uuid NOT NULL REFERENCES hustle_businesses(id) ON DELETE CASCADE,
  day_date            date NOT NULL,
  plan                jsonb,                      -- { units, price, card, choice }
  opened_at           timestamptz,
  units_prepared      int NOT NULL DEFAULT 0,
  units_credit        int NOT NULL DEFAULT 0,
  units_sold_town     int NOT NULL DEFAULT 0,
  units_sold_players  int NOT NULL DEFAULT 0,
  units_wasted        int NOT NULL DEFAULT 0,
  town_demand         int NOT NULL DEFAULT 0,     -- customers who came from town (turned away = this - sold)
  revenue             bigint NOT NULL DEFAULT 0,
  cost_of_goods       bigint NOT NULL DEFAULT 0,
  fixed_costs         bigint NOT NULL DEFAULT 0,
  other               bigint NOT NULL DEFAULT 0,  -- decision card cash, + or -
  profit              bigint,
  rating_delta        numeric(4,2) NOT NULL DEFAULT 0,
  supply_extra        bigint NOT NULL DEFAULT 0,  -- paid above the normal lot price (backup market markup)
  tips                jsonb,
  closed_at           timestamptz,
  PRIMARY KEY (business_id, day_date)
);
CREATE INDEX IF NOT EXISTS hustle_days_date_idx ON hustle_days (day_date);

-- Supply lots held (fractional: a buka uses a quarter lot per plate).
CREATE TABLE IF NOT EXISTS hustle_inventory (
  id           bigserial PRIMARY KEY,
  business_id  uuid NOT NULL REFERENCES hustle_businesses(id) ON DELETE CASCADE,
  item_type    text NOT NULL,                     -- supply type slug
  qty_lots     numeric(10,3) NOT NULL CHECK (qty_lots >= 0),
  lot_cost     int NOT NULL,                      -- what one lot cost, for cost of goods
  source       text NOT NULL DEFAULT 'backup',    -- 'backup' or the seller business id
  acquired_at  timestamptz NOT NULL DEFAULT now(),
  expires_at   date
);
CREATE INDEX IF NOT EXISTS hustle_inventory_biz_idx ON hustle_inventory (business_id, item_type, acquired_at) WHERE qty_lots > 0;

-- What a business offers players today.
CREATE TABLE IF NOT EXISTS hustle_listings (
  id               bigserial PRIMARY KEY,
  business_id      uuid NOT NULL REFERENCES hustle_businesses(id) ON DELETE CASCADE,
  day_date         date NOT NULL,
  units_available  int NOT NULL CHECK (units_available >= 0),
  price            int NOT NULL CHECK (price > 0),
  UNIQUE (business_id, day_date)
);

CREATE TABLE IF NOT EXISTS hustle_orders (
  id                  bigserial PRIMARY KEY,
  buyer_kind          text NOT NULL CHECK (buyer_kind IN ('user', 'business')),
  buyer_id            uuid NOT NULL,
  buyer_user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_business_id  uuid REFERENCES hustle_businesses(id) ON DELETE CASCADE,  -- null: backup shop
  listing_id          bigint REFERENCES hustle_listings(id) ON DELETE SET NULL,
  qty                 int NOT NULL CHECK (qty > 0),
  unit_price          int NOT NULL,
  total               bigint NOT NULL,
  need_key            text,
  status              text NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'reversed')),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hustle_orders_seller_idx ON hustle_orders (seller_business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS hustle_orders_buyer_idx ON hustle_orders (buyer_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS hustle_reviews (
  id                bigserial PRIMARY KEY,
  business_id       uuid NOT NULL REFERENCES hustle_businesses(id) ON DELETE CASCADE,
  reviewer_user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id          bigint NOT NULL UNIQUE REFERENCES hustle_orders(id) ON DELETE CASCADE,
  stars             int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  text              text CHECK (char_length(text) <= 140),
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hustle_reviews_biz_idx ON hustle_reviews (business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS hustle_needs (
  user_id            uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  need_key           text NOT NULL,
  last_satisfied_at  timestamptz NOT NULL,
  satisfied_until    timestamptz NOT NULL,          -- last purchase + that seller's interval (backup shop: half)
  PRIMARY KEY (user_id, need_key)
);

-- Market news. effects: {"demand": {"buka": 1.2, "food": 1.2}, "cost": {"keke_rider": 1.15}} (type slug or category).
CREATE TABLE IF NOT EXISTS hustle_events (
  id          bigserial PRIMARY KEY,
  starts_on   date NOT NULL,
  ends_on     date NOT NULL,
  state       text,                               -- null: every state
  headline    text NOT NULL,
  body        text NOT NULL DEFAULT '',
  effects     jsonb NOT NULL DEFAULT '{}',
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One decision a day. options: [{ "label": "...", "effects": { ... } }] (see lib/hustle/cards.ts).
CREATE TABLE IF NOT EXISTS hustle_decision_cards (
  id                bigserial PRIMARY KEY,
  slug              text UNIQUE,
  applies_to_types  text[],                       -- null: every type
  prompt            text NOT NULL,
  options           jsonb NOT NULL,
  is_active         boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS hustle_receivables (
  id            bigserial PRIMARY KEY,
  business_id   uuid NOT NULL REFERENCES hustle_businesses(id) ON DELETE CASCADE,
  amount        bigint NOT NULL CHECK (amount > 0),
  due_on        date NOT NULL,
  from_label    text NOT NULL,
  repay_chance  numeric(3,2) NOT NULL,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'defaulted')),
  created_on    date NOT NULL
);
CREATE INDEX IF NOT EXISTS hustle_receivables_due_idx ON hustle_receivables (due_on) WHERE status = 'pending';

-- Effects that last several days: a helper's raise, a short-staffed week, a creator's campaign.
CREATE TABLE IF NOT EXISTS hustle_modifiers (
  id           bigserial PRIMARY KEY,
  business_id  uuid NOT NULL REFERENCES hustle_businesses(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('demand', 'capacity', 'daily_cost')),
  value        numeric(10,2) NOT NULL,            -- a multiplier, or naira a day for daily_cost
  starts_on    date NOT NULL,
  ends_on      date NOT NULL,
  label        text NOT NULL
);
CREATE INDEX IF NOT EXISTS hustle_modifiers_biz_idx ON hustle_modifiers (business_id, ends_on);

INSERT INTO settings (key, value) VALUES
  ('hustle_enabled', 'admins'),
  ('hustle_grant', '50000'),
  ('hustle_allawee', '20000'),
  ('hustle_task_cap', '500'),
  ('hustle_town_multiplier', '1.0'),
  ('hustle_backup_markup', '0.25'),
  ('hustle_salvage_pct', '0.7'),
  ('hustle_need_vibe_effect', '0.05'),
  ('hustle_grace_days', '7')
ON CONFLICT (key) DO NOTHING;

INSERT INTO badges (slug, name, description, icon, color, priority, kind, qualifies_for_rewards) VALUES
  ('hustle_comeback', 'Comeback', 'Restructured a business and kept going', 'flame', 'amber', 15, 'auto', false)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO hustle_business_types (slug, name, blurb, category, unit_name, kind, sells_supply, perishable, slots, open_air, expiry_days,
  default_price, cost_per_unit, capacity_per_day, rent_per_day, upkeep_per_day, upkeep_provider_type, marketing_per_day,
  supply_type, units_per_supply_lot, setup_cost, townspeople_demand_per_day, need_key, need_days, sort) VALUES
  ('buka', 'Buka', 'Daily meals for everyone', 'food', 'plate', 'consumer', false, true, false, false, NULL, 500, 250, 20, 1000, 150, 'carpenter', 100, 'crop_farm', 4, 35000, 9000, 'food', 1, 10),
  ('suya_spot', 'Suya spot', 'Evening suya and wraps', 'food', 'wrap', 'consumer', false, true, false, true, NULL, 1000, 500, 15, 800, 100, 'carpenter', 100, 'poultry', 2, 30000, 5000, 'food', 1, 20),
  ('provision_store', 'Provision store', 'Everyday items, and supplies for shops', 'food', 'basket', 'consumer', true, false, false, false, NULL, 1000, 800, 25, 700, 100, 'carpenter', 100, NULL, NULL, 30000, 8000, 'food', 1, 30),
  ('barber', 'Barber', 'Weekly cuts, local only', 'services', 'haircut', 'consumer', false, false, true, false, NULL, 1500, 150, 10, 1000, 100, 'carpenter', 100, 'cosmetics_supplier', 7, 30000, 4500, 'grooming', 7, 40),
  ('salon', 'Salon', 'Braids and styling', 'services', 'styling', 'consumer', false, false, true, false, NULL, 4000, 800, 3, 1200, 150, 'carpenter', 100, 'cosmetics_supplier', 1, 35000, 4000, 'grooming', 10, 50),
  ('tailor', 'Tailor', 'Outfits made to measure', 'services', 'outfit', 'consumer', false, false, false, false, NULL, 5000, 2400, 1, 800, 100, 'carpenter', 100, 'fabric_trader', 1, 30000, 4000, 'clothes', 30, 60),
  ('laundry', 'Laundry', 'Wash, iron, fold', 'services', 'load', 'consumer', false, false, true, false, NULL, 800, 200, 12, 900, 100, 'carpenter', 100, 'provision_store', 5, 25000, 3000, 'laundry', 7, 70),
  ('cyber_cafe', 'Cyber café', 'Printing, typing and forms', 'services', 'job', 'consumer', false, false, true, false, NULL, 500, 150, 25, 1000, 150, 'phone_repair', 100, 'provision_store', 7, 30000, 4000, 'printing', 14, 80),
  ('pos_agent', 'POS agent', 'Cash-outs and transfers', 'services', 'cash-out', 'consumer', false, false, true, false, NULL, 100, 20, 60, 500, 100, 'phone_repair', 0, NULL, NULL, 20000, 3000, 'cash', 7, 90),
  ('keke_rider', 'Keke rider', 'Rides around town', 'services', 'ride', 'consumer', false, false, true, true, NULL, 300, 100, 25, 800, 300, 'mechanic', 0, NULL, NULL, 15000, 4500, 'rides', 2, 100),
  ('dispatch_rider', 'Dispatch rider', 'Deliveries across town', 'services', 'delivery', 'consumer', false, false, true, true, NULL, 500, 150, 15, 700, 300, 'mechanic', 0, NULL, NULL, 20000, 3000, NULL, NULL, 110),
  ('phone_repair', 'Phone repair & data', 'Data, screens and chargers', 'services', 'job', 'consumer', false, false, false, false, NULL, 1500, 1050, 15, 800, 0, NULL, 100, 'phone_accessories', 1, 30000, 4000, 'data', 7, 120),
  ('mechanic', 'Mechanic & vulcanizer', 'Keeps kekes and bikes running', 'services', 'job', 'b2b', false, false, true, false, NULL, 1500, 600, 6, 600, 0, NULL, 0, NULL, NULL, 25000, 3000, NULL, NULL, 130),
  ('carpenter', 'Carpenter', 'Benches, stalls and shop fittings', 'services', 'piece', 'b2b', false, false, true, false, NULL, 5000, 2500, 2, 600, 0, NULL, 0, NULL, NULL, 30000, 2500, NULL, NULL, 140),
  ('content_creator', 'Content creator', 'Sells promo to businesses', 'services', 'campaign', 'b2b', false, false, true, false, NULL, 3000, 500, 3, 300, 0, NULL, 0, NULL, NULL, 15000, 1500, NULL, NULL, 150),
  ('crop_farm', 'Crop farm', 'Sells to bukas and suya spots', 'supply', 'lot', 'supplier', false, true, false, true, 3, 1000, 400, 15, 500, 0, NULL, 0, NULL, NULL, 30000, 3000, NULL, NULL, 160),
  ('poultry', 'Poultry', 'Chicken for suya and bukas', 'supply', 'lot', 'supplier', false, true, false, false, 3, 1000, 450, 12, 600, 0, NULL, 0, NULL, NULL, 35000, 2500, NULL, NULL, 170),
  ('fabric_trader', 'Fabric trader', 'Ankara and lace for tailors', 'supply', 'lot', 'supplier', false, false, false, false, NULL, 1000, 700, 20, 700, 0, NULL, 0, NULL, NULL, 20000, 2000, NULL, NULL, 180),
  ('cosmetics_supplier', 'Cosmetics & hair', 'Supplies for barbers and salons', 'supply', 'lot', 'supplier', false, false, false, false, NULL, 1000, 680, 20, 700, 0, NULL, 0, NULL, NULL, 20000, 3000, NULL, NULL, 190),
  ('phone_accessories', 'Phone accessories', 'Parts and data for phone shops', 'supply', 'lot', 'supplier', false, false, false, false, NULL, 1000, 720, 20, 700, 0, NULL, 0, NULL, NULL, 20000, 2500, NULL, NULL, 200)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO hustle_decision_cards (slug, applies_to_types, prompt, options) VALUES
  ('credit', NULL, 'A regular wants 3 {units} on credit. They say they''ll pay in 3 days.',
    '[{"label":"Give credit","effects":{"credit":{"units":3,"due_days":3,"repay_chance":0.8},"rating":0.1}},{"label":"Decline politely","effects":{}}]'),
  ('bulk_discount', '{buka,suya_spot,barber,salon,tailor,laundry,cyber_cafe,phone_repair}', 'Your supplier offers 10% off if you buy 5 lots today.',
    '[{"label":"Buy 5 lots","effects":{"buy_lots":{"lots":5,"discount":0.1}}},{"label":"Not today","effects":{}}]'),
  ('levy', NULL, 'A local government officer says you owe a ₦1,500 levy.',
    '[{"label":"Pay it","effects":{"cash":-1500}},{"label":"Argue","effects":{"chance":{"p":0.5,"then":{"cash":-3000},"else":{}}}}]'),
  ('nepa', '{buka,suya_spot,barber,salon,tailor,laundry,cyber_cafe,phone_repair,provision_store,pos_agent}', 'NEPA has taken light. Run the generator?',
    '[{"label":"Run it (₦600 fuel)","effects":{"cash":-600}},{"label":"No, manage","effects":{"demand":0.6}}]'),
  ('price_war', NULL, 'A competitor cut prices by 20%.',
    '[{"label":"Match their price","effects":{"price":0.8}},{"label":"Hold my price","effects":{"demand":0.85,"rating":0.05}}]'),
  ('helper_raise', NULL, 'Your helper asks for a ₦2,000 raise.',
    '[{"label":"Yes","effects":{"modifiers":[{"kind":"daily_cost","value":300,"days":7,"label":"Helper''s raise"},{"kind":"capacity","value":1.05,"days":7,"label":"Happy helper"}]}},{"label":"No","effects":{"chance":{"p":0.3,"then":{"modifiers":[{"kind":"capacity","value":0.8,"days":3,"label":"Helper not happy"}]},"else":{}}}}]'),
  ('complaint', NULL, 'A customer is complaining loudly online.',
    '[{"label":"Refund 1 {unit}","effects":{"refund_units":1,"rating":0.1}},{"label":"Ignore it","effects":{"rating":-0.2}}]'),
  ('rain', '{suya_spot,keke_rider,dispatch_rider,crop_farm}', 'Rain all day. Fewer people are out.',
    '[{"label":"OK","effects":{"demand":0.7}}]')
ON CONFLICT (slug) DO NOTHING;
