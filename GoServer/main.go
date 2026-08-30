package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/gorilla/websocket"
)

// ─────────────────────────────────────────────────────
// WebSocket 连接包装（带发送队列，防止阻塞写）
// ─────────────────────────────────────────────────────

type WSConn struct {
	conn *websocket.Conn
	send chan []byte
}

func NewWSConn(c *websocket.Conn) *WSConn {
	wc := &WSConn{
		conn: c,
		send: make(chan []byte, 64),
	}
	go wc.writeLoop()
	return wc
}

func (w *WSConn) Send(data []byte) {
	select {
	case w.send <- data:
	default:
		// 发送队列满，丢弃（客机掉线或房主消息积压时保护）
	}
}

func (w *WSConn) Close() {
	close(w.send)
	w.conn.Close()
}

func (w *WSConn) writeLoop() {
	for msg := range w.send {
		if err := w.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			log.Printf("[连接] 写错误: %v", err)
			return
		}
	}
}

// ─────────────────────────────────────────────────────
// 主入口
// ─────────────────────────────────────────────────────

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // 允许所有来源
}

func main() {
	port := flag.Int("port", 8810, "监听端口")
	flag.Parse()

	addr := ":" + itoa(*port)
	room := NewRoom(*port)

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		// 房间已有房主，拒绝新连接
		if !room.HasHost() && room.IsEmpty() {
			// 正常，第一个连接会成为房主
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[连接] 升级失败: %v", err)
			return
		}

		name := r.URL.Query().Get("name")
		if name == "" {
			name = "玩家"
		}
		char := r.URL.Query().Get("char")
		mode := r.URL.Query().Get("mode")

		wc := NewWSConn(conn)
		p := room.Join(name, char, mode, wc)

		// 发送房间信息
		info := RoomInfoMsg{
			Type:     "room_info",
			Role:     "client",
			PlayerId: p.Id,
			Players:  room.PlayerList(),
			Port:     *port,
			Mode:     room.Mode,
		}
		if room.IsHost(p.Id) {
			info.Role = "host"
		}
		infoData, _ := json.Marshal(info)
		wc.Send(infoData)

		// 通知其他玩家有新玩家加入
		if !room.IsHost(p.Id) {
			joinData, _ := json.Marshal(PlayerJoinedMsg{
				Type:   "player_joined",
				Player: PlayerInfo{Id: p.Id, Name: p.Name, Char: p.Char, Ready: p.Ready, Faction: p.Faction},
			})
			room.Broadcast(joinData)
		}

		// 读循环
		go func() {
			defer func() {
				p.closed = true
				room.Leave(p.Id)

				// 通知剩余玩家
				leftData, _ := json.Marshal(PlayerLeftMsg{
					Type:     "player_left",
					PlayerId: p.Id,
				})
				if room.Host != nil && !room.IsHost(p.Id) {
					room.Host.Conn.Send(leftData)
				}
				for _, c := range room.ClientList() {
					c.Conn.Send(leftData)
				}

				wc.Close()
				log.Printf("[连接] 断开: %s (id=%d)", p.Name, p.Id)
			}()

			for {
				_, msg, err := conn.ReadMessage()
				if err != nil {
					break
				}
				handleMessage(room, p, msg)
			}
		}()
	})

	// 信号处理
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		log.Println("[服务器] 收到退出信号，关闭...")
		os.Exit(0)
	}()

	log.Printf("═══════════════════════════════════════════")
	log.Printf("  Dash 联机服务器")
	log.Printf("  监听端口: %d", *port)
	log.Printf("  WebSocket 路径: ws://0.0.0.0:%d/ws", *port)
	log.Printf("  第一个连接自动成为房主")
	log.Printf("═══════════════════════════════════════════")

	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("[服务器] 启动失败: %v", err)
	}
}

// 简单整数转字符串（避免 import strconv）
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	s := ""
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	return s
}
