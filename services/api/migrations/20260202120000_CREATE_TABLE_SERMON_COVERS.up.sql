CREATE TABLE IF NOT EXISTS sermon_covers (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    speaker TEXT NOT NULL,
    date_label TEXT NOT NULL,
    background TEXT NOT NULL,
    settings_json TEXT NOT NULL,
    design_json TEXT NOT NULL DEFAULT '',
    assets_json TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
