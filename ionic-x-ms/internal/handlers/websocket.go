package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/labstack/gommon/log"

	"ionic-x-ms/internal/manager"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// HandleWebSocket establece la conexión WebSocket
func HandleWebSocket(c echo.Context) error {
	conn, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	manager.ConfigureRead(conn)

	client := manager.Register(conn)
	manager.StartWriter(client)

	defer func() {
		manager.Unregister(client)
		_ = conn.Close()
	}()

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Warnf("websocket read error: %v", err)
			}
			return nil
		}

		var envelope struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(msg, &envelope); err == nil {
			switch envelope.Type {
			case "sceneUpdate":
				manager.SetLastScene(msg)
			case "liveStatus":
				manager.SetLastLiveStatus(msg)
			case "stateUpdate":
				manager.SetLastState(msg)
			case "verseUpdate":
				manager.SetLastVerse(msg)
			case "lyricsUpdate":
				manager.SetLastLyrics(msg)
			case "coverUpdate":
				manager.SetLastCover(msg)
			}
		}

		manager.BroadcastMessage(msg)
	}
}
