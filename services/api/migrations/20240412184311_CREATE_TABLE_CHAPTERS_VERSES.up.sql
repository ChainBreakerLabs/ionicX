CREATE TABLE chapters_verses
(
    id            INTEGER PRIMARY KEY,
    book          TEXT NOT NULL,
    chapter       INTEGER,
    number_verses INTEGER
);

CREATE INDEX IF NOT EXISTS idx_chapters_verses_ref ON chapters_verses(book, chapter);
