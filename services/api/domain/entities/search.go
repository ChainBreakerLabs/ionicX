package entities

type RequestSearch struct {
	Query   string `json:"q" validate:"required"`
	Version int    `json:"version"`
	Limit   int    `json:"limit"`
}

type VerseMatch struct {
	Book    string `json:"book"`
	Chapter int    `json:"chapter"`
	Verse   int    `json:"verse"`
	Text    string `json:"text"`
}
