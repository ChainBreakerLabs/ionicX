package entities

import "encoding/json"

type CoverSettings struct {
	FontFamily     string  `json:"fontFamily"`
	TitleColor     string  `json:"titleColor"`
	SubtitleColor  string  `json:"subtitleColor"`
	AccentColor    string  `json:"accentColor"`
	BackgroundTint string  `json:"backgroundTint"`
	TitleSize      int     `json:"titleSize"`
	SubtitleSize   int     `json:"subtitleSize"`
	Align          string  `json:"align"`
	BadgeLabel     string  `json:"badgeLabel"`
	ImagePosX      float64 `json:"imagePosX"`
	ImagePosY      float64 `json:"imagePosY"`
	ImageScale     float64 `json:"imageScale"`
	ShowInBible    bool    `json:"showInBible"`
}

type SermonCover struct {
	ID         string          `json:"id"`
	Title      string          `json:"title"`
	Subtitle   string          `json:"subtitle"`
	Speaker    string          `json:"speaker"`
	DateLabel  string          `json:"dateLabel"`
	Background string          `json:"background"`
	Settings   CoverSettings   `json:"settings"`
	Design     json.RawMessage `json:"design"`
	Assets     []string        `json:"assets"`
	CreatedAt  string          `json:"createdAt"`
	UpdatedAt  string          `json:"updatedAt"`
}

type SermonCoverSummary struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	UpdatedAt string `json:"updatedAt"`
}

type SermonCoverPayload struct {
	ID         string          `json:"id"`
	Title      string          `json:"title"`
	Subtitle   string          `json:"subtitle"`
	Speaker    string          `json:"speaker"`
	DateLabel  string          `json:"dateLabel"`
	Background string          `json:"background"`
	Settings   CoverSettings   `json:"settings"`
	Design     json.RawMessage `json:"design"`
	Assets     []string        `json:"assets"`
}
