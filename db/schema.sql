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
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz
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
