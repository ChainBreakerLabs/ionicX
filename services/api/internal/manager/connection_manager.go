package manager

import (
	"encoding/json"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 2 * 1024 * 1024
)

type Client struct {
	conn *websocket.Conn
	send chan []byte
}

type Hub struct {
	clients    map[*Client]struct{}
	register   chan *Client
	unregister chan *Client
	broadcast  chan []byte
	mu         sync.RWMutex
	lastState  []byte
	lastVerse  []byte
	lastLyrics []byte
	lastCover  []byte
	lastScene  []byte
	lastLive   []byte
}

var hub = newHub()

func init() {
	go hub.run()
}

func newHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]struct{}),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan []byte, 256),
	}
}

func Register(conn *websocket.Conn) *Client {
	client := &Client{
		conn: conn,
		send: make(chan []byte, 256),
	}
	hub.register <- client
	return client
}

func Unregister(client *Client) {
	if client == nil {
		return
	}
	hub.unregister <- client
}

func BroadcastMessage(message []byte) {
	if message == nil {
		return
	}
	hub.broadcast <- message
}

func SetLastState(message []byte) {
	if message == nil {
		return
	}
	hub.mu.Lock()
	hub.lastState = message
	hub.mu.Unlock()
}

func SetLastVerse(message []byte) {
	if message == nil {
		return
	}
	hub.mu.Lock()
	hub.lastVerse = message
	hub.mu.Unlock()
}

func SetLastLyrics(message []byte) {
	if message == nil {
		return
	}
	hub.mu.Lock()
	hub.lastLyrics = message
	hub.mu.Unlock()
}

func SetLastCover(message []byte) {
	if message == nil {
		return
	}
	hub.mu.Lock()
	hub.lastCover = message
	hub.mu.Unlock()
}

func SetLastScene(message []byte) {
	if message == nil {
		return
	}
	hub.mu.Lock()
	hub.lastScene = message
	hub.mu.Unlock()
}

func SetLastLiveStatus(message []byte) {
	if message == nil {
		return
	}
	hub.mu.Lock()
	hub.lastLive = message
	hub.mu.Unlock()
}

func StartWriter(client *Client) {
	go func() {
		ticker := time.NewTicker(pingPeriod)
		defer func() {
			ticker.Stop()
			_ = client.conn.Close()
		}()

		for {
			select {
			case message, ok := <-client.send:
				_ = client.conn.SetWriteDeadline(time.Now().Add(writeWait))
				if !ok {
					_ = client.conn.WriteMessage(websocket.CloseMessage, []byte{})
					return
				}
				if err := client.conn.WriteMessage(websocket.TextMessage, message); err != nil {
					return
				}
			case <-ticker.C:
				_ = client.conn.SetWriteDeadline(time.Now().Add(writeWait))
				if err := client.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			}
		}
	}()
}

func ConfigureRead(conn *websocket.Conn) {
	conn.SetReadLimit(maxMessageSize)
	_ = conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(pongWait))
	})
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = struct{}{}
			h.sendSnapshot(client)
			h.broadcastClientCount()
		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.broadcastClientCount()
		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}

func (h *Hub) sendSnapshot(client *Client) {
	h.mu.RLock()
	state := h.lastState
	verse := h.lastVerse
	lyrics := h.lastLyrics
	cover := h.lastCover
	scene := h.lastScene
	live := h.lastLive
	h.mu.RUnlock()
	if live != nil {
		client.send <- live
	}
	if scene != nil {
		client.send <- scene
	}
	if state != nil {
		client.send <- state
	}
	if verse != nil {
		client.send <- verse
	}
	if lyrics != nil {
		client.send <- lyrics
	}
	if cover != nil {
		client.send <- cover
	}
}

func (h *Hub) broadcastClientCount() {
	payload, err := json.Marshal(map[string]interface{}{
		"type":  "clientCount",
		"count": len(h.clients),
	})
	if err != nil {
		return
	}
	for client := range h.clients {
		select {
		case client.send <- payload:
		default:
			close(client.send)
			delete(h.clients, client)
		}
	}
}
