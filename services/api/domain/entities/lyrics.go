package entities

type LyricsSegment struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Content string `json:"content"`
	Kind    string `json:"kind"`
	Color   string `json:"color"`
}

type LyricsSettings struct {
	FontFamily     string `json:"fontFamily"`
	FontSize       int    `json:"fontSize"`
	TextColor      string `json:"textColor"`
	Background     string `json:"backgroundColor"`
	Align          string `json:"align"`
	HighlightColor string `json:"highlightColor"`
}

type LyricsSong struct {
	ID        string          `json:"id"`
	Title     string          `json:"title"`
	Lyrics    string          `json:"lyrics"`
	Segments  []LyricsSegment `json:"segments"`
	Settings  LyricsSettings  `json:"settings"`
	CreatedAt string          `json:"createdAt"`
	UpdatedAt string          `json:"updatedAt"`
}

type LyricsSongSummary struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	UpdatedAt string `json:"updatedAt"`
}

type LyricsSongPayload struct {
	ID       string          `json:"id"`
	Title    string          `json:"title"`
	Lyrics   string          `json:"lyrics"`
	Segments []LyricsSegment `json:"segments"`
	Settings LyricsSettings  `json:"settings"`
}
