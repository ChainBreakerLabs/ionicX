package entities

type RequestBible struct {
	Book    string `json:"book" validate:"required"`
	Chapter int    `json:"chapter" validate:"required"`
	Offset  int    `json:"offset"`
	Limit   int    `json:"limit"`
	Version int    `json:"version" validate:"required"`
}
