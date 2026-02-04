CREATE TABLE bibles (
    id INTEGER PRIMARY KEY,
    version_name TEXT NOT NULL
);

INSERT OR IGNORE INTO bibles (id, version_name) VALUES (1, 'Reina Valera 1960');

ALTER TABLE books ADD COLUMN bible_id INTEGER NOT NULL DEFAULT 1;
