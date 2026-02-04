CREATE TABLE IF NOT EXISTS lyrics_songs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    lyrics TEXT NOT NULL,
    segments_json TEXT NOT NULL,
    settings_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
