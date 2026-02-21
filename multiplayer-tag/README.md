# 🏷️ Multiplayer TAG — Online Game

A fully authoritative real-time online multiplayer TAG game built from scratch.
Up to 4 players · Room codes · Real physics · 3 maps · Chat

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run the server
npm start

# 3. Open in browser
# http://localhost:3000
```

For local development with auto-reload:
```bash
npm run dev
```

---

## 🎮 How to Play

1. **Create a Room** — Enter your name and click Create Room
2. **Share the code** — Give the 4-letter room code to friends
3. **Friends join** — They enter the code and click Join
4. **Host starts game** — Host selects map, round duration, then clicks START
5. **Play!**
   - One random player starts as **IT** (marked with red IT! above their head)
   - IT must **tag another player** by running into them
   - When tagged, roles switch — the tagger becomes IT
   - Whoever is **IT when the timer runs out LOSES**
   - Everyone else wins!

### Controls
| Action | Keys |
|--------|------|
| Move Left | ← Arrow or A |
| Move Right | → Arrow or D |
| Jump | ↑ Arrow, W, or Space |

### Special Features
- **Bounce Pads** 🟡 — Launch you high into the air
- **Teleporters** 🔵 — Transport you across the map instantly
- **Tag Immunity** — After being tagged, 2.5 second grace period

---

## 🏗️ Architecture

```
Browser (Player)          Node.js Server
─────────────            ──────────────────────────────────
index.html               server.js
  ├─ Lobby UI     ←──→   Room Manager
  ├─ Canvas Game  ←──→   Authoritative Game Loop (30Hz)
  ├─ Socket.IO    ←──→   Physics Engine
  └─ Input Keys   ──→    Tag Detection
                         Timer & Win Conditions
```

### Why Authoritative Server?
The server runs the **entire game simulation**:
- All physics (gravity, collisions, bounce pads, teleporters)
- All game logic (who is IT, tag detection, timer)
- All state is defined by the server

The browser is just a **renderer + input sender**. This prevents cheating and keeps all players in sync.

### Real-time Flow
```
Player presses ← key
    ↓ (immediate)
Client sends: { left: true, right: false, jump: false }
    ↓ (via WebSocket)
Server applies input to physics simulation
    ↓ (every 33ms at 30Hz)
Server broadcasts full game state to all players in room
    ↓
All clients receive state and render it (60fps with interpolation)
```

### Interpolation
Between server updates (33ms each), the client uses **linear interpolation** to render smooth 60fps motion:
- Store `previousState` and `currentState`
- Lerp player positions based on elapsed time since last update
- Result: smooth movement despite 30Hz server tick rate

---

## 📦 Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express |
| Real-time | Socket.IO (WebSockets) |
| Frontend | Vanilla JS + HTML5 Canvas |
| Physics | Custom AABB collision engine |

No external game engine needed — the physics are simple enough to implement from scratch.

---

## 🗂️ File Structure

```
multiplayer-tag/
├── server.js          ← Main server (rooms + game loop + physics)
├── package.json
├── public/
│   └── index.html     ← Complete game client (HTML + CSS + JS)
└── README.md
```

---

## 🗺️ Maps

| Map | Theme | Description |
|-----|-------|-------------|
| 🌿 Grasslands | Green/Dark blue | Classic platformer with trees |
| 🧊 Arctic | Ice blue/Dark | Slippery-looking icy platforms |
| 🏜️ Desert | Gold/Orange | Sandy ledges and warm tones |

All maps share the same layout mechanics but different visual themes.
Each map has: 10 platforms, 3 bounce pads, 2 teleporters (left ↔ right), 4 spawn points.

---

## ⚙️ Settings

Hosts can customize before starting:
- **Map**: Grasslands / Arctic / Desert
- **Round Duration**: 60s / 90s / 2min / 3min

---

## 🌍 Deployment

### Railway (Recommended — Easy)
```bash
railway init
railway up
```

### Render
1. Connect GitHub repo
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Deploy!

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |

---

## 🔧 Physics Constants (server.js)

Tweak these to change game feel:

```js
const GRAVITY      = 1400;   // px/s² — higher = falls faster
const MOVE_SPEED   = 230;    // px/s — player speed
const JUMP_SPEED   = -570;   // px/s — negative = upward
const MAX_FALL     = 900;    // px/s — terminal velocity
const TAG_DIST     = 44;     // px — tag detection radius
const TAG_COOLDOWN = 75;     // ticks — grace period after tag
const BOUNCE_POWER = -720;   // px/s — bounce pad launch speed
const TICK_RATE    = 30;     // Hz — server update rate
```

---

## 🚀 Future Features (Next Steps)

- [ ] Spectator mode when player leaves mid-game
- [ ] Custom player skins / hats
- [ ] Score leaderboard (persistent across rounds)
- [ ] Mobile touch controls
- [ ] Sound effects
- [ ] More maps
- [ ] Private/public room browser
- [ ] Redis for multi-server scaling

---

## 🔒 Security Notes

- All game state is server-authoritative (no client trust)
- Player inputs are bounds-checked server-side
- Room codes are randomly generated (no enumeration)
- Chat messages are sanitized (length-capped, HTML escaped on client)
- Players are automatically removed from rooms on disconnect

---

Built from scratch — no game engine, no framework. Just Node.js + Socket.IO + Canvas.
