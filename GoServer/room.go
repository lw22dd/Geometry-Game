package main

import (
	"log"
	"sync"
)

// ─────────────────────────────────────────────────────
// 房间管理：单房间模型（一个 Go Server 实例跑一个房间）
// ─────────────────────────────────────────────────────

type Room struct {
	mu      sync.RWMutex
	Host    *Player
	Clients map[int]*Player
	nextId  int
	port    int
	Mode    string // "pve" | "asym"（房主创建房间时写入，广播给全部玩家）
}

type Player struct {
	Id      int
	Name    string
	Char    string
	Ready   bool
	Faction string // "keeper" | "survivor"（非对称模式；"" = 未选择）
	Conn    *WSConn
	closed  bool
}

func NewRoom(port int) *Room {
	return &Room{
		Clients: make(map[int]*Player),
		nextId:  1,
		port:    port,
	}
}

// 新玩家加入房间。第一个加入的自动成为房主（并写入房间模式）。
func (r *Room) Join(name string, char string, mode string, conn *WSConn) *Player {
	r.mu.Lock()
	defer r.mu.Unlock()

	p := &Player{
		Id:      r.nextId,
		Name:    name,
		Char:    char,
		Faction: "survivor", // 默认多方；非对称模式玩家可在房间内换阵营
		Conn:    conn,
	}
	r.nextId++

	if r.Host == nil {
		// 第一个连接 → 房主（创建房间时带模式）
		r.Host = p
		if mode == "asym" {
			r.Mode = "asym"
			p.Faction = "keeper" // 房主默认少方（守关者），可在房间内交换
		} else {
			r.Mode = "pve"
		}
		log.Printf("[房间] 房主加入: %s (id=%d) | 模式: %s", p.Name, p.Id, r.Mode)
	} else {
		r.Clients[p.Id] = p
		log.Printf("[房间] 玩家加入: %s (id=%d) | 当前在线: %d", p.Name, p.Id, len(r.Clients)+1)
	}

	return p
}

// 某阵营当前已占槽位数量（不含指定玩家；用于槽位仲裁）
func (r *Room) FactionCount(faction string, excludeId int) int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	n := 0
	if r.Host != nil && r.Host.Faction == faction && r.Host.Id != excludeId {
		n++
	}
	for _, c := range r.Clients {
		if c.Faction == faction && c.Id != excludeId {
			n++
		}
	}
	return n
}

// 阵营槽位上限（keeper 1 / survivor 4；非对称模式专用）
func factionLimit(faction string) int {
	if faction == "keeper" {
		return 1
	}
	return 4
}

// 玩家离开房间
func (r *Room) Leave(playerId int) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.Host != nil && r.Host.Id == playerId {
		log.Printf("[房间] 房主离开: %s (id=%d)", r.Host.Name, playerId)
		r.Host = nil
		return
	}

	if p, ok := r.Clients[playerId]; ok {
		log.Printf("[房间] 玩家离开: %s (id=%d) | 剩余: %d", p.Name, playerId, len(r.Clients)-1)
		delete(r.Clients, playerId)
	}
}

// 踢人（仅房主可调用）。返回被踢者的连接（用于发送 kick 通知）
func (r *Room) Kick(playerId int) (conn *Player, ok bool) {
	r.mu.Lock()
	defer r.mu.Unlock()

	p, ok := r.Clients[playerId]
	if !ok {
		return nil, false
	}
	delete(r.Clients, playerId)
	log.Printf("[房间] 踢出玩家 id=%d | 剩余: %d", playerId, len(r.Clients)+1)
	return p, true
}

// 获取指定玩家（不区分房主/客机，只用于查找连接）
func (r *Room) GetPlayer(playerId int) *Player {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.Host != nil && r.Host.Id == playerId {
		return r.Host
	}
	return r.Clients[playerId]
}

// 获取玩家列表
func (r *Room) PlayerList() []PlayerInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	list := make([]PlayerInfo, 0, len(r.Clients)+1)
	if r.Host != nil {
		list = append(list, PlayerInfo{Id: r.Host.Id, Name: r.Host.Name, Char: r.Host.Char, Ready: r.Host.Ready, Faction: r.Host.Faction})
	}
	for _, p := range r.Clients {
		list = append(list, PlayerInfo{Id: p.Id, Name: p.Name, Char: p.Char, Ready: p.Ready, Faction: p.Faction})
	}
	return list
}

// 获取非房主玩家列表
func (r *Room) ClientList() []*Player {
	r.mu.RLock()
	defer r.mu.RUnlock()

	list := make([]*Player, 0, len(r.Clients))
	for _, p := range r.Clients {
		list = append(list, p)
	}
	return list
}

// 判断玩家是否为房主
func (r *Room) IsHost(playerId int) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.Host != nil && r.Host.Id == playerId
}

// 判断房间是否为空
func (r *Room) IsEmpty() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.Host == nil && len(r.Clients) == 0
}

// 房主是否还在
func (r *Room) HasHost() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.Host != nil && !r.Host.closed
}

// 广播给全体玩家（含房主，含发送者本人）
func (r *Room) Broadcast(data []byte) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if r.Host != nil {
		r.Host.Conn.Send(data)
	}
	for _, c := range r.Clients {
		c.Conn.Send(data)
	}
}