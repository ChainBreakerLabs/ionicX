package entities

type Verse struct {
	Research string `json:"research,omitempty"`
	Index    int    `json:"index"`
	Text     string `json:"text"`
}

type Chapter struct {
	Name     string  `json:"name"`
	Research string  `json:"research,omitempty"`
	Verses   []Verse `json:"verses"`
}
