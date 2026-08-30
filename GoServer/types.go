package main

// ─────────────────────────────────────────────────────
// JSON 消息类型定义（客户端 ↔ 服务器 ↔ 房主 ↔ 客机）
// ─────────────────────────────────────────────────────

// ---------- 客户端 → 服务器 ----------

type JoinMsg struct {
	Type string `json:"type"` // "join"
	Name string `json:"name"`
}

type InputMsg struct {
	Type string    `json:"type"` // "input"
	Seq  int       `json:"seq"`
	Keys InputKeys `json:"keys"`
}

type InputKeys struct {
	Left     bool    `json:"left"`
	Right    bool    `json:"right"`
	Jump     bool    `json:"jump"`
	Sprint   bool    `json:"sprint"`
	Interact bool    `json:"interact"`
	Hook     bool    `json:"hook"`
	Fire     bool    `json:"fire"`
	AltFire  bool    `json:"altFire"`
	Reload   bool    `json:"reload"`
	AimX     float64 `json:"aimX"`
	AimY     float64 `json:"aimY"`
}

type HostStateMsg struct {
	Type    string        `json:"type"` // "host_state"
	Seq     int           `json:"seq"`
	Players []PlayerState `json:"players"`
	Orbs    []OrbState    `json:"orbs"`
	Items   []ItemState   `json:"items,omitempty"`
	Gt      float64       `json:"gt"`
	GotN    int           `json:"gotN"`
	Deaths  int           `json:"deaths"`
	Win     bool          `json:"win"`
}

type HostEventMsg struct {
	Type string      `json:"type"` // "host_event"
	Kind string      `json:"kind"` // "orb" | "death" | "checkpoint" | "win"
	Data interface{} `json:"data,omitempty"`
}

type KickMsg struct {
	Type     string `json:"type"` // "kick"
	PlayerId int    `json:"playerId"`
}

// 房间内选人：客户端上报所选角色 id（服务器广播给全体）
type CharSelectMsg struct {
	Type string `json:"type"` // "char_select"
	Char string `json:"char"`
}

// 房间内准备：客户端上报准备状态（服务器广播给全体）
type ReadyMsg struct {
	Type  string `json:"type"` // "ready"
	Ready bool   `json:"ready"`
}

// ---------- 服务器 → 客户端 ----------

type RoomInfoMsg struct {
	Type     string       `json:"type"` // "room_info"
	Role     string       `json:"role"` // "host" | "client"
	PlayerId int          `json:"playerId"`
	Players  []PlayerInfo `json:"players"`
	Port     int          `json:"port"`
}

type PlayerInfo struct {
	Id    int    `json:"id"`
	Name  string `json:"name"`
	Char  string `json:"char,omitempty"`
	Ready bool   `json:"ready"`
}

type PlayerJoinedMsg struct {
	Type   string     `json:"type"` // "player_joined"
	Player PlayerInfo `json:"player"`
}

type PlayerLeftMsg struct {
	Type     string `json:"type"` // "player_left"
	PlayerId int    `json:"playerId"`
}

// 玩家信息变更（选人/准备）：广播给全体（含发送者，便于同步确认）
type PlayerUpdateMsg struct {
	Type   string     `json:"type"` // "player_update"
	Player PlayerInfo `json:"player"`
}

type InputForwardMsg struct {
	Type     string    `json:"type"` // "input"
	PlayerId int       `json:"playerId"`
	Seq      int       `json:"seq"`
	Keys     InputKeys `json:"keys"`
}

type StateBroadcastMsg struct {
	Type    string        `json:"type"` // "state"
	Seq     int           `json:"seq"`
	Players []PlayerState `json:"players"`
	Orbs    []OrbState    `json:"orbs"`
	Items   []ItemState   `json:"items,omitempty"`
	Gt      float64       `json:"gt"`
	GotN    int           `json:"gotN"`
	Deaths  int           `json:"deaths"`
	Win     bool          `json:"win"`
}

type EventBroadcastMsg struct {
	Type string      `json:"type"` // "event"
	Kind string      `json:"kind"`
	Data interface{} `json:"data,omitempty"`
}

type KickedMsg struct {
	Type string `json:"type"` // "kicked"
}

// ---------- 共享数据 ----------

type PlayerState struct {
	PlayerId  int     `json:"playerId"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Vx        float64 `json:"vx"`
	Vy        float64 `json:"vy"`
	Face      int     `json:"face"`
	Grounded  bool    `json:"grounded"`
	Dead      bool    `json:"dead"`
	Sprint    bool    `json:"sprint"`
	Squash    float64 `json:"squash"`
	Inv       float64 `json:"inv"`
	// 水平移速倍率（1 = 常态，2 = 加速 buff）
	SpeedMult float64 `json:"speedMult"`
	// 生命值（S1：房主权威；客机不自行结算伤害）
	Hp float64 `json:"hp"`
	// 当前主武器（S2：none / ak / grenade）
	Weapon  string  `json:"weapon"`
	Ammo    int     `json:"ammo"`
	// 是否拥有手雷副武器（S2：拾取手雷道具后 true）
	HasGrenade bool    `json:"hasGrenade"`
	ReloadT float64 `json:"reloadT"`
	HasPlat bool    `json:"hasPlat"`
	PlatDx  float64 `json:"platDx,omitempty"`
	// Track 状态（含钩锁滑索）
	TrackOn       bool    `json:"trackOn"`
	TrackZipline  bool    `json:"trackZipline"`
	TrackDist     float64 `json:"trackDist"`
	TrackSpeed    float64 `json:"trackSpeed"`
	TrackEntry    float64 `json:"trackEntry"`
	TrackExit     float64 `json:"trackExit"`
	TrackSegments []any   `json:"trackSegments,omitempty"`
	// 背包道具编码（0=doubleJump, 1=hook）
	Backpack     []int   `json:"backpack,omitempty"`
}

type OrbState struct {
	EntityId  int  `json:"entityId"`
	Collected bool `json:"collected"`
}

type ItemState struct {
	EntityId  int  `json:"entityId"`
	Collected bool `json:"collected"`
}