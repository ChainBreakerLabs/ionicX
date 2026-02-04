CREATE TABLE verses
(
    id       INTEGER PRIMARY KEY,
    chapter  INTEGER  NOT NULL,
    research TEXT,
    "index"  INTEGER  NOT NULL,
    content  TEXT NOT NULL,
    FOREIGN KEY (chapter) REFERENCES chapters (id)
);

CREATE INDEX IF NOT EXISTS idx_verses_chapter_index ON verses(chapter, "index");
