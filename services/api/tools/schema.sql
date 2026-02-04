PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS bibles (
    id INTEGER PRIMARY KEY,
    version_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS books (
    name TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    bible_id INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (bible_id) REFERENCES bibles(id)
);

CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY,
    book TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    research TEXT,
    title TEXT,
    FOREIGN KEY (book) REFERENCES books(name)
);

CREATE TABLE IF NOT EXISTS verses (
    id INTEGER PRIMARY KEY,
    chapter INTEGER NOT NULL,
    research TEXT,
    "index" INTEGER NOT NULL,
    content TEXT NOT NULL,
    FOREIGN KEY (chapter) REFERENCES chapters(id)
);

CREATE TABLE IF NOT EXISTS chapters_verses (
    id INTEGER PRIMARY KEY,
    book TEXT NOT NULL,
    chapter INTEGER,
    number_verses INTEGER
);

CREATE INDEX IF NOT EXISTS idx_books_bible_id ON books(bible_id);
CREATE INDEX IF NOT EXISTS idx_chapters_book_index ON chapters(book, "index");
CREATE INDEX IF NOT EXISTS idx_verses_chapter_index ON verses(chapter, "index");
CREATE INDEX IF NOT EXISTS idx_chapters_verses_ref ON chapters_verses(book, chapter);
