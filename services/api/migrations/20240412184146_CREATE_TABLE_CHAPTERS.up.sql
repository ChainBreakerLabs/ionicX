CREATE TABLE chapters
(
    id       INTEGER PRIMARY KEY,
    book     TEXT NOT NULL,
    "index"  INTEGER NOT NULL,
    research TEXT,
    title    TEXT,
    FOREIGN KEY (book) REFERENCES books (name)
);

CREATE INDEX IF NOT EXISTS idx_chapters_book_index ON chapters(book, "index");
