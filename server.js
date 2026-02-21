/**
 * MULTIPLAYER TAG - Authoritative Game Server
 * Real-time online TAG game with room codes
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const TICK_RATE     = 60;          // Hz (server updates per second)
const DT            = 1 / TICK_RATE;
const GRAVITY       = 1400;        // px/s²
const MOVE_SPEED    = 230;         // px/s
const JUMP_SPEED    = -570;        // px/s (upward)
const MAX_FALL      = 900;         // px/s
const PLAYER_W      = 28;
const PLAYER_H      = 36;
const MAP_W         = 1000;
const MAP_H         = 600;
const TAG_DIST      = 44;          // px between centers to trigger a tag
const TAG_COOLDOWN  = TICK_RATE * 2.5; // ticks where you can't be re-tagged (2.5s)
const BOUNCE_POWER  = -720;        // px/s on bounce pad hit
const TELEPORT_CD   = TICK_RATE * 1.5; // ticks before re-using a teleporter

const PLAYER_COLORS = ['#FF4D6D', '#4CC9F0', '#F9C74F', '#90BE6D'];
const MAX_PLAYERS   = 4;

// ─────────────────────────────────────────────
// MAP DEFINITIONS  (shared logic with client)
// ─────────────────────────────────────────────

const MAPS = [
  {
    name: 'Grasslands',
    bgTop: '#0d1b2a',
    bgBottom: '#1b4332',
    platforms: [
      // Ground
      { x: 0,   y: 562, w: 1000, h: 38, color: '#2d6a4f' },
      // Left column
      { x: 60,  y: 460, w: 150,  h: 18, color: '#40916c' },
      { x: 200, y: 360, w: 110,  h: 18, color: '#40916c' },
      { x: 60,  y: 260, w: 130,  h: 18, color: '#40916c' },
      // Center
      { x: 420, y: 180, w: 160,  h: 18, color: '#52b788' },
      { x: 350, y: 400, w: 120,  h: 18, color: '#40916c' },
      { x: 530, y: 310, w: 100,  h: 18, color: '#40916c' },
      { x: 430, y: 490, w: 140,  h: 18, color: '#40916c' },
      // Right column
      { x: 640, y: 260, w: 130,  h: 18, color: '#40916c' },
      { x: 700, y: 360, w: 110,  h: 18, color: '#40916c' },
      { x: 790, y: 460, w: 150,  h: 18, color: '#40916c' },
    ],
    bouncePads: [
      { x: 170, y: 544, w: 60, h: 18 },
      { x: 470, y: 544, w: 60, h: 18 },
      { x: 770, y: 544, w: 60, h: 18 },
    ],
    teleporters: [
      { x: 26,  y: 540, r: 20, targetX: 960, targetY: 540 },
      { x: 960, y: 540, r: 20, targetX: 26,  targetY: 540 },
    ],
    spawns: [
      { x: 80,  y: 524 },
      { x: 900, y: 524 },
      { x: 350, y: 524 },
      { x: 620, y: 524 },
    ]
  },
  {
    name: 'Arctic',
    bgTop: '#0a0a2a',
    bgBottom: '#1a3a5a',
    platforms: [
      // Ground
      { x: 0,   y: 562, w: 1000, h: 38, color: '#90e0ef' },
      // Icy shelves
      { x: 50,  y: 470, w: 160,  h: 18, color: '#ade8f4' },
      { x: 280, y: 380, w: 120,  h: 18, color: '#ade8f4' },
      { x: 150, y: 280, w: 100,  h: 18, color: '#ade8f4' },
      { x: 430, y: 220, w: 140,  h: 18, color: '#caf0f8' },
      { x: 390, y: 450, w: 220,  h: 18, color: '#ade8f4' },
      { x: 600, y: 330, w: 100,  h: 18, color: '#ade8f4' },
      { x: 700, y: 240, w: 120,  h: 18, color: '#ade8f4' },
      { x: 800, y: 370, w: 140,  h: 18, color: '#ade8f4' },
      { x: 810, y: 470, w: 160,  h: 18, color: '#ade8f4' },
    ],
    bouncePads: [
      { x: 100,  y: 544, w: 60, h: 18 },
      { x: 480,  y: 544, w: 60, h: 18 },
      { x: 840,  y: 544, w: 60, h: 18 },
    ],
    teleporters: [
      { x: 26,  y: 540, r: 20, targetX: 960, targetY: 540 },
      { x: 960, y: 540, r: 20, targetX: 26,  targetY: 540 },
    ],
    spawns: [
      { x: 80,  y: 524 },
      { x: 900, y: 524 },
      { x: 300, y: 524 },
      { x: 650, y: 524 },
    ]
  },
  {
    name: 'Desert',
    bgTop: '#1a0a00',
    bgBottom: '#7c3d00',
    platforms: [
      // Ground
      { x: 0,   y: 562, w: 1000, h: 38, color: '#c9a227' },
      // Sandy ledges
      { x: 70,  y: 460, w: 130,  h: 18, color: '#e9c46a' },
      { x: 250, y: 350, w: 100,  h: 18, color: '#e9c46a' },
      { x: 100, y: 250, w: 130,  h: 18, color: '#f4d03f' },
      { x: 440, y: 190, w: 120,  h: 18, color: '#f4d03f' },
      { x: 370, y: 430, w: 100,  h: 18, color: '#e9c46a' },
      { x: 520, y: 350, w: 120,  h: 18, color: '#e9c46a' },
      { x: 460, y: 510, w: 80,   h: 18, color: '#e9c46a' },
      { x: 680, y: 270, w: 130,  h: 18, color: '#e9c46a' },
      { x: 800, y: 390, w: 140,  h: 18, color: '#e9c46a' },
      { x: 820, y: 470, w: 130,  h: 18, color: '#e9c46a' },
    ],
    bouncePads: [
      { x: 120,  y: 544, w: 60, h: 18 },
      { x: 460,  y: 544, w: 60, h: 18 },
      { x: 820,  y: 544, w: 60, h: 18 },
    ],
    teleporters: [
      { x: 26,  y: 540, r: 20, targetX: 960, targetY: 540 },
      { x: 960, y: 540, r: 20, targetX: 26,  targetY: 540 },
    ],
    spawns: [
      { x: 100, y: 524 },
      { x: 870, y: 524 },
      { x: 370, y: 524 },
      { x: 630, y: 524 },
    ]
  }
];

// ─────────────────────────────────────────────
// ROOM MANAGEMENT
// ─────────────────────────────────────────────

const rooms = new Map();  // code → room
const socketToRoom = new Map(); // socketId → roomCode

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function createRoom(hostSocket, hostName, mapIndex = 0, roundDuration = 90) {
  const code = generateRoomCode();
  const colorIndex = 0;
  const spawn = MAPS[mapIndex].spawns[0];

  const room = {
    code,
    host: hostSocket.id,
    status: 'lobby',  // lobby | countdown | playing | ended
    mapIndex,
    roundDuration,
    timer: roundDuration,
    itPlayerId: null,
    tick: 0,
    gameInterval: null,
    countdownValue: 3,
    players: new Map(),
    inputs: new Map(),
  };

  addPlayerToRoom(room, hostSocket, hostName, colorIndex, spawn);
  rooms.set(code, room);
  return room;
}

function addPlayerToRoom(room, socket, name, colorIndex, spawn) {
  const player = {
    id: socket.id,
    name: name.substring(0, 12),
    color: PLAYER_COLORS[colorIndex],
    colorIndex,
    // Physics
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    onGround: false,
    // Game
    isIt: false,
    tagCooldown: 0,
    teleportCooldown: 0,
    // Stats
    timesTagged: 0,
    score: 0,
  };

  room.players.set(socket.id, player);
  room.inputs.set(socket.id, { left: false, right: false, jump: false, jumpJustPressed: false });
  socketToRoom.set(socket.id, room.code);
  socket.join(room.code);
}

function removePlayerFromRoom(socketId) {
  const code = socketToRoom.get(socketId);
  if (!code) return;

  const room = rooms.get(code);
  if (!room) return;

  room.players.delete(socketId);
  room.inputs.delete(socketId);
  socketToRoom.delete(socketId);

  if (room.players.size === 0) {
    // Empty room — clean up
    stopGameLoop(room);
    rooms.delete(code);
    return;
  }

  // Transfer host if needed
  if (room.host === socketId) {
    room.host = room.players.keys().next().value;
  }

  // If "it" player left during game, assign "it" to someone else
  if (room.status === 'playing' && room.itPlayerId === socketId) {
    const remaining = [...room.players.keys()];
    room.itPlayerId = remaining[Math.floor(Math.random() * remaining.length)];
    room.players.get(room.itPlayerId).isIt = true;
  }

  // If only one player left during game, end it
  if (room.status === 'playing' && room.players.size < 2) {
    endGame(room, 'not_enough_players');
  }

  return { room, code };
}

// ─────────────────────────────────────────────
// PHYSICS ENGINE
// ─────────────────────────────────────────────

function aabbOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx &&
         ay < by + bh && ay + ah > by;
}

function resolvePlatformCollisions(player, map) {
  const { platforms, bouncePads } = map;

  // ── X axis ──
  player.x += player.vx * DT;
  player.x = Math.max(0, Math.min(MAP_W - PLAYER_W, player.x));

  for (const plat of platforms) {
    if (!aabbOverlap(player.x, player.y, PLAYER_W, PLAYER_H, plat.x, plat.y, plat.w, plat.h)) continue;
    const overL = (player.x + PLAYER_W) - plat.x;
    const overR = (plat.x + plat.w) - player.x;
    if (overL < overR) {
      player.x = plat.x - PLAYER_W;
    } else {
      player.x = plat.x + plat.w;
    }
    player.vx = 0;
  }

  // ── Y axis ──
  player.vy = Math.min(player.vy + GRAVITY * DT, MAX_FALL);
  player.y += player.vy * DT;
  player.onGround = false;

  for (const plat of platforms) {
    if (!aabbOverlap(player.x, player.y, PLAYER_W, PLAYER_H, plat.x, plat.y, plat.w, plat.h)) continue;
    const overT = (player.y + PLAYER_H) - plat.y;
    const overB = (plat.y + plat.h) - player.y;
    if (overT <= overB + 1) {
      // Landing on top
      player.y = plat.y - PLAYER_H;
      player.vy = 0;
      player.onGround = true;
    } else {
      // Hitting underside
      player.y = plat.y + plat.h;
      player.vy = Math.abs(player.vy) * 0.3;
    }
  }

  // ── Bounce pads ──
  for (const pad of bouncePads) {
    if (aabbOverlap(player.x, player.y, PLAYER_W, PLAYER_H, pad.x, pad.y, pad.w, pad.h)) {
      // Only bounce when coming down from above
      if (player.vy >= 0) {
        player.y = pad.y - PLAYER_H;
        player.vy = BOUNCE_POWER;
        player.onGround = false;
      }
    }
  }

  // ── Fell off bottom → respawn ──
  if (player.y > MAP_H + 100) {
    player.y = 80;
    player.vy = 0;
  }
}

function checkTeleporters(player, map) {
  if (player.teleportCooldown > 0) {
    player.teleportCooldown--;
    return;
  }
  for (const tp of map.teleporters) {
    const cx = player.x + PLAYER_W / 2;
    const cy = player.y + PLAYER_H / 2;
    const dist = Math.hypot(cx - tp.x, cy - tp.y);
    if (dist < tp.r + 14) {
      player.x = tp.targetX - PLAYER_W / 2;
      player.y = tp.targetY - PLAYER_H;
      player.vy = 0;
      player.teleportCooldown = TELEPORT_CD;
      return;
    }
  }
}

// ─────────────────────────────────────────────
// GAME LOOP
// ─────────────────────────────────────────────

function startCountdown(room) {
  room.status = 'countdown';
  room.countdownValue = 3;

  io.to(room.code).emit('countdown', { value: room.countdownValue });

  const cdInterval = setInterval(() => {
    room.countdownValue--;
    if (room.countdownValue <= 0) {
      clearInterval(cdInterval);
      startGame(room);
    } else {
      io.to(room.code).emit('countdown', { value: room.countdownValue });
    }
  }, 1000);
}

function startGame(room) {
  room.status = 'playing';
  room.timer = room.roundDuration;
  room.tick = 0;

  // Respawn all players to spawn points
  const mapData = MAPS[room.mapIndex];
  let spawnIdx = 0;
  for (const [, player] of room.players) {
    const spawn = mapData.spawns[spawnIdx % mapData.spawns.length];
    player.x = spawn.x;
    player.y = spawn.y;
    player.vx = 0;
    player.vy = 0;
    player.isIt = false;
    player.tagCooldown = 0;
    player.teleportCooldown = TELEPORT_CD; // prevent immediate teleport at spawn
    spawnIdx++;
  }

  // Pick a random player to be "it"
  const playerIds = [...room.players.keys()];
  const itIdx = Math.floor(Math.random() * playerIds.length);
  room.itPlayerId = playerIds[itIdx];
  room.players.get(room.itPlayerId).isIt = true;

  io.to(room.code).emit('gameStart', {
    mapIndex: room.mapIndex,
    roundDuration: room.roundDuration,
    itPlayerId: room.itPlayerId,
  });

  // Game loop
  room.gameInterval = setInterval(() => gameTick(room), 1000 / TICK_RATE);
}

function gameTick(room) {
  if (room.status !== 'playing') return;
  const map = MAPS[room.mapIndex];

  // ── Apply inputs & physics for each player ──
  for (const [id, player] of room.players) {
    const input = room.inputs.get(id) || {};

    // Horizontal movement
    if (input.left && !input.right) {
      player.vx = -MOVE_SPEED;
    } else if (input.right && !input.left) {
      player.vx = MOVE_SPEED;
    } else {
      // Friction
      player.vx *= 0.82;
      if (Math.abs(player.vx) < 2) player.vx = 0;
    }

    // Jump
    if (input.jumpJustPressed && player.onGround) {
      player.vy = JUMP_SPEED;
      player.onGround = false;
    }
    // Clear jump trigger (one-frame input)
    input.jumpJustPressed = false;

    resolvePlatformCollisions(player, map);
    checkTeleporters(player, map);

    // Cool down tag immunity
    if (player.tagCooldown > 0) player.tagCooldown--;
  }

  // ── Tag detection ──
  const itPlayer = room.players.get(room.itPlayerId);
  if (itPlayer) {
    const itCx = itPlayer.x + PLAYER_W / 2;
    const itCy = itPlayer.y + PLAYER_H / 2;

    for (const [id, player] of room.players) {
      if (id === room.itPlayerId) continue;
      if (player.tagCooldown > 0) continue;

      const px = player.x + PLAYER_W / 2;
      const py = player.y + PLAYER_H / 2;
      const dist = Math.hypot(itCx - px, itCy - py);

      if (dist < TAG_DIST) {
        // TAG!
        itPlayer.isIt = false;
        itPlayer.tagCooldown = TAG_COOLDOWN; // "it" can't be re-tagged immediately

        player.isIt = true;
        player.tagCooldown = 0;
        player.timesTagged++;

        room.itPlayerId = id;

        io.to(room.code).emit('tagged', {
          newItId: id,
          oldItId: itPlayer.id,
          newItName: player.name,
        });

        break; // only one tag per tick
      }
    }
  }

  // ── Timer ──
  room.tick++;
  if (room.tick % TICK_RATE === 0) {
    room.timer--;
    if (room.timer <= 0) {
      endGame(room, 'timeout');
      return;
    }
  }

  // ── Broadcast game state ──
  const state = {
    players: {},
    timer: room.timer,
    itPlayerId: room.itPlayerId,
    tick: room.tick,
  };

  for (const [id, p] of room.players) {
    state.players[id] = {
      id: p.id,
      name: p.name,
      color: p.color,
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      vx: Math.round(p.vx),
      vy: Math.round(p.vy),
      onGround: p.onGround,
      isIt: p.isIt,
      tagCooldown: p.tagCooldown,
    };
  }

  io.to(room.code).emit('gameState', state);
}

function endGame(room, reason) {
  stopGameLoop(room);
  room.status = 'ended';

  const results = [];
  for (const [, p] of room.players) {
    results.push({
      id: p.id,
      name: p.name,
      color: p.color,
      isIt: p.isIt,
      timesTagged: p.timesTagged,
      won: !p.isIt,
    });
  }

  // Sort: winners first
  results.sort((a, b) => (b.won ? 1 : 0) - (a.won ? 1 : 0));

  io.to(room.code).emit('gameEnd', { reason, results });

  // Reset to lobby after 5 seconds
  setTimeout(() => {
    if (!rooms.has(room.code)) return;
    room.status = 'lobby';
    room.timer = room.roundDuration;
    room.itPlayerId = null;
    for (const [, p] of room.players) {
      p.isIt = false;
      p.tagCooldown = 0;
      p.timesTagged = 0;
    }
    io.to(room.code).emit('returnToLobby', getRoomLobbyData(room));
  }, 6000);
}

function stopGameLoop(room) {
  if (room.gameInterval) {
    clearInterval(room.gameInterval);
    room.gameInterval = null;
  }
}

function getRoomLobbyData(room) {
  return {
    code: room.code,
    host: room.host,
    status: room.status,
    mapIndex: room.mapIndex,
    roundDuration: room.roundDuration,
    players: [...room.players.values()].map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      colorIndex: p.colorIndex,
    })),
  };
}

// ─────────────────────────────────────────────
// SOCKET.IO EVENTS
// ─────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── CREATE ROOM ──
  socket.on('createRoom', ({ name, mapIndex = 0, roundDuration = 90 }, cb) => {
    if (socketToRoom.has(socket.id)) {
      return cb({ error: 'Already in a room' });
    }
    if (!name || name.trim() === '') return cb({ error: 'Name required' });

    const room = createRoom(socket, name.trim(), mapIndex, roundDuration);
    console.log(`[Room] Created ${room.code} by ${name}`);
    cb({ success: true, room: getRoomLobbyData(room) });
  });

  // ── JOIN ROOM ──
  socket.on('joinRoom', ({ name, code }, cb) => {
    if (socketToRoom.has(socket.id)) {
      return cb({ error: 'Already in a room' });
    }
    if (!name || name.trim() === '') return cb({ error: 'Name required' });

    const room = rooms.get(code?.toUpperCase());
    if (!room) return cb({ error: 'Room not found' });
    if (room.status !== 'lobby') return cb({ error: 'Game already in progress' });
    if (room.players.size >= MAX_PLAYERS) return cb({ error: 'Room is full' });

    const colorIndex = room.players.size;
    const spawn = MAPS[room.mapIndex].spawns[colorIndex];
    addPlayerToRoom(room, socket, name.trim(), colorIndex, spawn);

    const lobbyData = getRoomLobbyData(room);
    // Notify existing players
    socket.to(room.code).emit('playerJoined', lobbyData);
    cb({ success: true, room: lobbyData });
  });

  // ── PLAYER INPUT ──
  socket.on('input', (input) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room || room.status !== 'playing') return;

    const current = room.inputs.get(socket.id);
    if (!current) return;

    // Track jump "just pressed" edge
    if (input.jump && !current.jump) {
      current.jumpJustPressed = true;
    }
    current.left = !!input.left;
    current.right = !!input.right;
    current.jump = !!input.jump;
  });

  // ── START GAME (host only) ──
  socket.on('startGame', (cb) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return cb?.({ error: 'Not in a room' });
    const room = rooms.get(code);
    if (!room) return cb?.({ error: 'Room not found' });
    if (room.host !== socket.id) return cb?.({ error: 'Only the host can start' });
    if (room.status !== 'lobby') return cb?.({ error: 'Game already started' });
    if (room.players.size < 2) return cb?.({ error: 'Need at least 2 players' });

    startCountdown(room);
    cb?.({ success: true });
  });

  // ── CHANGE SETTINGS (host only) ──
  socket.on('changeSettings', ({ mapIndex, roundDuration }) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room || room.host !== socket.id || room.status !== 'lobby') return;

    if (mapIndex !== undefined && MAPS[mapIndex]) room.mapIndex = mapIndex;
    if (roundDuration !== undefined) room.roundDuration = roundDuration;

    io.to(code).emit('settingsChanged', { mapIndex: room.mapIndex, roundDuration: room.roundDuration });
  });

  // ── CHAT MESSAGE ──
  socket.on('chatMsg', (msg) => {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;

    const safeMsg = String(msg).substring(0, 80);
    io.to(code).emit('chatMsg', { name: player.name, color: player.color, msg: safeMsg });
  });

  // ── DISCONNECT ──
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    const result = removePlayerFromRoom(socket.id);
    if (!result) return;
    const { room, code } = result;
    if (!rooms.has(code)) return;
    const lobbyData = getRoomLobbyData(room);
    io.to(code).emit('playerLeft', { playerId: socket.id, room: lobbyData });
  });

  // ── PING (latency check) ──
  socket.on('ping', (cb) => typeof cb === 'function' && cb());
});

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏷️  Multiplayer TAG Server running on http://0.0.0.0:${PORT}\n`);
});
