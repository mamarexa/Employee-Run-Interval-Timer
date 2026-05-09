-- MonCivique Run — PostgreSQL Schema

-- Programs Table
CREATE TABLE IF NOT EXISTS programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    session_number INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    interval_data JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    magic_link_token TEXT UNIQUE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    active_program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    selected_character_id TEXT NOT NULL DEFAULT 'running-guy',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Progress Table (replaces current_week/current_session on users)
CREATE TABLE IF NOT EXISTS progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
    current_week INTEGER NOT NULL DEFAULT 1,
    current_session INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, program_id)
);

-- History Table
CREATE TABLE IF NOT EXISTS history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
    program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
    week_number INTEGER,
    session_number INTEGER,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    feedback TEXT CHECK (feedback IN ('easy', 'perfect', 'hard'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_program ON sessions(program_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);

-- Migrations (safe to run on existing databases)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
CREATE INDEX IF NOT EXISTS idx_history_user ON history(user_id);
CREATE INDEX IF NOT EXISTS idx_history_completed ON history(completed_at);
