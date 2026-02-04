package migrations

import "embed"

// FS exposes embedded SQL migrations for the runtime migrator.
//
//go:embed *.sql
var FS embed.FS
