package main

import (
	"encoding/json"
	"log"

	"github.com/gorilla/websocket"
)

// ─────────────────────────────────────────────────────
// 消息路由：扇入（客机 → 房主）/ 扇出（房主 → 全部）
// ─────────────────────────────────────────────────────

// 处理收到的消息（运行在 conn 的读 goroutine 中）
func handleMessage(room *Room, p *Player, raw []byte) {
	var base struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(raw, &base); err != nil {
		log.Printf("[消息] 解析失败: %v", err)
		return
	}

	switch base.Type {
	case "join":
		// join 在连接建立时已处理，忽略重复
		return

	case "input":
		// 客机输入 → 转发给房主
		handleInput(room, p, raw)

	case "host_state":
		// 房主权威状态 → 广播给所有客机
		handleHostState(room, p, raw)

	case "host_event":
		// 房主事件 → 广播给所有客机
		handleHostEvent(room, p, raw)

	case "kick":
		// 房主踢人
		handleKick(room, p, raw)

	default:
		log.Printf("[消息] 未知类型: %s", base.Type)
	}
}

// 客机输入 → 房主
func handleInput(room *Room, p *Player, raw []byte) {
	if room.IsHost(p.Id) {
		return // 房主自己的输入不走这个路径
	}

	var msg InputMsg
	if err := json.Unmarshal(raw, &msg); err != nil {
		return
	}

	// 构造转发消息
	fwd := InputForwardMsg{
		Type:     "input",
		PlayerId: p.Id,
		Seq:      msg.Seq,
		Keys:     msg.Keys,
	}
	data, _ := json.Marshal(fwd)

	room.Host.Conn.Send(data)
}

// 房主权威状态 → 所有客机
func handleHostState(room *Room, p *Player, raw []byte) {
	if !room.IsHost(p.Id) {
		return // 只有房主可以发状态
	}

	var msg HostStateMsg
	if err := json.Unmarshal(raw, &msg); err != nil {
		return
	}

	// 广播给所有客机
	broadcast := StateBroadcastMsg{
		Type:    "state",
		Seq:     msg.Seq,
		Players: msg.Players,
		Orbs:    msg.Orbs,
		Gt:      msg.Gt,
		GotN:    msg.GotN,
		Deaths:  msg.Deaths,
		Win:     msg.Win,
	}
	data, _ := json.Marshal(broadcast)

	for _, c := range room.ClientList() {
		c.Conn.Send(data)
	}
}

// 房主事件 → 所有客机
func handleHostEvent(room *Room, p *Player, raw []byte) {
	if !room.IsHost(p.Id) {
		return
	}

	var msg HostEventMsg
	if err := json.Unmarshal(raw, &msg); err != nil {
		return
	}

	broadcast := EventBroadcastMsg{
		Type: "event",
		Kind: msg.Kind,
		Data: msg.Data,
	}
	data, _ := json.Marshal(broadcast)

	for _, c := range room.ClientList() {
		c.Conn.Send(data)
	}
}

// 房主踢人
func handleKick(room *Room, p *Player, raw []byte) {
	if !room.IsHost(p.Id) {
		return
	}

	var msg KickMsg
	if err := json.Unmarshal(raw, &msg); err != nil {
		return
	}

	kicked, ok := room.Kick(msg.PlayerId)
	if !ok {
		return
	}

	// 通知被踢者（直接写，不通过队列，确保被踢者收到再关闭）
	kickData, _ := json.Marshal(KickedMsg{Type: "kicked"})
	kicked.Conn.conn.WriteMessage(websocket.TextMessage, kickData)
	kicked.Conn.Close()

	// 通知剩余玩家
	leftData, _ := json.Marshal(PlayerLeftMsg{
		Type:     "player_left",
		PlayerId: msg.PlayerId,
	})
	for _, c := range room.ClientList() {
		c.Conn.Send(leftData)
	}
}