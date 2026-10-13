-- Stomatologija Krsmanovic schema (PostgreSQL / Neon)

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- USERS ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BOARDS --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#6366f1',
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BOARD MEMBERS (sharing / collaboration) -----------------------------------
CREATE TABLE IF NOT EXISTS board_members (
  board_id  UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member', -- owner | admin | member
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);

-- COLUMNS -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS columns (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id  UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title     TEXT NOT NULL,
  position  DOUBLE PRECISION NOT NULL DEFAULT 1000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TASKS ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  column_id   UUID NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  priority    TEXT NOT NULL DEFAULT 'medium', -- low | medium | high | urgent
  due_date    TIMESTAMPTZ,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  position    DOUBLE PRECISION NOT NULL DEFAULT 1000,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ACTIVITY FEED -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activities (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,       -- e.g. 'task.moved', 'task.created'
  message    TEXT NOT NULL,       -- e.g. 'Alex moved "Login API" to Done'
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INDEXES -------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_boards_owner       ON boards(owner_id);
CREATE INDEX IF NOT EXISTS idx_columns_board      ON columns(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_board        ON tasks(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_column       ON tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee     ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_members_user       ON board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_board   ON activities(board_id, created_at DESC);
