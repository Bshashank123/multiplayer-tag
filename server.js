/**
 * MULTIPLAYER TAG — Authoritative Game Server (Fixed)
 *
 * Key fixes vs original:
 *  1. Bounce pads are NON-SOLID — only apply upward impulse, no position snap.
 *     Original code did `player.y = pad.y - PLAYER_H` which caused massive
 *     client-side prediction desyncs (client had no bounce logic at all).
 *  2. More platforms per map (richer, more traversable layouts).
 *  3. facingRight transmitted so client can flip the sprite correctly.
 *  4. Slightly tuned physics constants for snappier feel.
 */

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const path       = require('path');

const app        = express();
const httpServer = http.createServer(app);
const io         = new Server(httpServer, {
  cors:         { origin: '*' },
  transports:   ['websocket', 'polling'],
  pingInterval: 5000,
  pingTimeout:  10000,
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── Physics Constants (MUST match client) ───────────────────────────────────
const TICK_RATE    = 60;
const DT           = 1 / TICK_RATE;
const GRAVITY      = 1600;
const MOVE_SPEED   = 260;
const JUMP_SPEED   = -620;
const MAX_FALL     = 1000;
const PLAYER_W     = 28;
const PLAYER_H     = 36;
const MAP_W        = 1000;
const MAP_H        = 600;
const TAG_DIST     = 46;
const TAG_COOLDOWN = TICK_RATE * 2.5;
const BOUNCE_POWER = -820;
const TELEPORT_CD  = TICK_RATE * 1.5;
const JUMP_BUFFER_TICKS = 6;

const PLAYER_COLORS = ['#FF4D6D', '#4CC9F0', '#F9C74F', '#90BE6D'];
const MAX_PLAYERS   = 4;

// ─── Map Definitions ─────────────────────────────────────────────────────────
const MAPS = [
  {
    name: 'Grasslands',
    bgTop: '#0d1b2a', bgBottom: '#1b4332',
    platforms: [
      { x:0,   y:562, w:1000, h:38, color:'#2d6a4f', ground:true },
      // Left tower
      { x:40,  y:460, w:160,  h:20, color:'#40916c' },
      { x:60,  y:360, w:130,  h:20, color:'#40916c' },
      { x:40,  y:260, w:150,  h:20, color:'#52b788' },
      { x:70,  y:160, w:110,  h:20, color:'#52b788' },
      // Center peak
      { x:380, y:170, w:240,  h:20, color:'#52b788' },
      { x:420, y:270, w:160,  h:20, color:'#40916c' },
      { x:350, y:390, w:130,  h:20, color:'#40916c' },
      { x:480, y:490, w:140,  h:20, color:'#40916c' },
      // Mid bridges
      { x:210, y:325, w:120,  h:20, color:'#40916c' },
      { x:670, y:325, w:120,  h:20, color:'#40916c' },
      // Right tower
      { x:790, y:460, w:160,  h:20, color:'#40916c' },
      { x:810, y:360, w:130,  h:20, color:'#40916c' },
      { x:790, y:260, w:150,  h:20, color:'#52b788' },
      { x:820, y:160, w:110,  h:20, color:'#52b788' },
      // Extras
      { x:600, y:460, w:120,  h:20, color:'#40916c' },
      { x:280, y:460, w:90,   h:20, color:'#40916c' },
    ],
    bouncePads: [
      { x:160, y:544, w:70, h:16 },
      { x:460, y:544, w:70, h:16 },
      { x:760, y:544, w:70, h:16 },
    ],
    teleporters: [
      { x:26,  y:538, r:22, targetX:960, targetY:538 },
      { x:960, y:538, r:22, targetX:26,  targetY:538 },
    ],
    spawns: [
      { x:80,  y:524 },
      { x:900, y:524 },
      { x:380, y:524 },
      { x:620, y:524 },
    ],
  },
  {
    name: 'Arctic',
    bgTop: '#040818', bgBottom: '#0a2040',
    platforms: [
      { x:0,   y:562, w:1000, h:38, color:'#7ecef4', ground:true },
      { x:30,  y:470, w:180,  h:20, color:'#ade8f4' },
      { x:60,  y:370, w:140,  h:20, color:'#caf0f8' },
      { x:30,  y:270, w:160,  h:20, color:'#ade8f4' },
      { x:70,  y:170, w:110,  h:20, color:'#caf0f8' },
      { x:380, y:200, w:240,  h:20, color:'#caf0f8' },
      { x:410, y:300, w:180,  h:20, color:'#ade8f4' },
      { x:370, y:420, w:130,  h:20, color:'#ade8f4' },
      { x:500, y:490, w:150,  h:20, color:'#ade8f4' },
      { x:220, y:340, w:120,  h:20, color:'#ade8f4' },
      { x:660, y:340, w:120,  h:20, color:'#ade8f4' },
      { x:800, y:470, w:170,  h:20, color:'#ade8f4' },
      { x:810, y:370, w:140,  h:20, color:'#caf0f8' },
      { x:800, y:270, w:160,  h:20, color:'#ade8f4' },
      { x:820, y:170, w:110,  h:20, color:'#caf0f8' },
      { x:580, y:450, w:130,  h:20, color:'#ade8f4' },
      { x:270, y:470, w:90,   h:20, color:'#ade8f4' },
    ],
    bouncePads: [
      { x:100, y:544, w:70, h:16 },
      { x:460, y:544, w:70, h:16 },
      { x:830, y:544, w:70, h:16 },
    ],
    teleporters: [
      { x:26,  y:538, r:22, targetX:960, targetY:538 },
      { x:960, y:538, r:22, targetX:26,  targetY:538 },
    ],
    spawns: [
      { x:80,  y:524 },
      { x:900, y:524 },
      { x:380, y:524 },
      { x:620, y:524 },
    ],
  },
  {
    name: 'Desert',
    bgTop: '#0f0500', bgBottom: '#6b2f00',
    platforms: [
      { x:0,   y:562, w:1000, h:38, color:'#b5862b', ground:true },
      { x:40,  y:462, w:150,  h:20, color:'#d4a43a' },
      { x:60,  y:362, w:130,  h:20, color:'#e9c46a' },
      { x:40,  y:262, w:150,  h:20, color:'#f4d03f' },
      { x:70,  y:162, w:110,  h:20, color:'#f9d74e' },
      { x:380, y:190, w:240,  h:20, color:'#f4d03f' },
      { x:410, y:290, w:180,  h:20, color:'#e9c46a' },
      { x:360, y:400, w:130,  h:20, color:'#d4a43a' },
      { x:460, y:490, w:140,  h:20, color:'#d4a43a' },
      { x:210, y:340, w:120,  h:20, color:'#e9c46a' },
      { x:670, y:340, w:120,  h:20, color:'#e9c46a' },
      { x:800, y:462, w:150,  h:20, color:'#d4a43a' },
      { x:820, y:362, w:130,  h:20, color:'#e9c46a' },
      { x:800, y:262, w:150,  h:20, color:'#f4d03f' },
      { x:820, y:162, w:110,  h:20, color:'#f9d74e' },
      { x:590, y:462, w:130,  h:20, color:'#d4a43a' },
      { x:270, y:462, w:90,   h:20, color:'#d4a43a' },
    ],
    bouncePads: [
      { x:120, y:544, w:70, h:16 },
      { x:460, y:544, w:70, h:16 },
      { x:800, y:544, w:70, h:16 },
    ],
    teleporters: [
      { x:26,  y:538, r:22, targetX:960, targetY:538 },
      { x:960, y:538, r:22, targetX:26,  targetY:538 },
    ],
    spawns: [
      { x:80,  y:524 },
      { x:900, y:524 },
      { x:380, y:524 },
      { x:620, y:524 },
    ],
  },
];

// ─── Rooms ───────────────────────────────────────────────────────────────────
const rooms        = new Map();
const socketToRoom = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do { code = Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join(''); }
  while (rooms.has(code));
  return code;
}

function createRoom(hostSocket, hostName, mapIndex=0, roundDuration=90) {
  const code  = generateRoomCode();
  const spawn = MAPS[mapIndex].spawns[0];
  const room  = {
    code, host: hostSocket.id, status:'lobby',
    mapIndex, roundDuration, timer:roundDuration,
    itPlayerId:null, tick:0, gameInterval:null, countdownValue:3,
    players: new Map(), inputs: new Map(),
  };
  addPlayerToRoom(room, hostSocket, hostName, 0, spawn);
  rooms.set(code, room);
  return room;
}

function addPlayerToRoom(room, socket, name, colorIndex, spawn) {
  room.players.set(socket.id, {
    id:socket.id, name:name.substring(0,12), color:PLAYER_COLORS[colorIndex], colorIndex,
    x:spawn.x, y:spawn.y, vx:0, vy:0, onGround:false,
    isIt:false, tagCooldown:0, teleportCooldown:0, timesTagged:0, facingRight:true,
  });
  room.inputs.set(socket.id, { left:false, right:false, jump:false, jumpBuffer:0 });
  socketToRoom.set(socket.id, room.code);
  socket.join(room.code);
}

function removePlayerFromRoom(socketId) {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;
  room.players.delete(socketId);
  room.inputs.delete(socketId);
  socketToRoom.delete(socketId);
  if (room.players.size === 0) { stopGameLoop(room); rooms.delete(code); return null; }
  if (room.host === socketId) room.host = room.players.keys().next().value;
  if (room.status === 'playing' && room.itPlayerId === socketId) {
    const rem = [...room.players.keys()];
    room.itPlayerId = rem[Math.floor(Math.random() * rem.length)];
    room.players.get(room.itPlayerId).isIt = true;
  }
  if (room.status === 'playing' && room.players.size < 2) endGame(room, 'not_enough_players');
  return { room, code };
}

// ─── Physics ─────────────────────────────────────────────────────────────────
function aabb(ax,ay,aw,ah,bx,by,bw,bh) {
  return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
}

function resolvePlatformCollisions(player, map) {
  const { platforms, bouncePads } = map;

  // X axis
  player.x += player.vx * DT;
  player.x  = Math.max(0, Math.min(MAP_W - PLAYER_W, player.x));
  for (const plat of platforms) {
    if (!aabb(player.x, player.y, PLAYER_W, PLAYER_H, plat.x, plat.y, plat.w, plat.h)) continue;
    const overL = (player.x + PLAYER_W) - plat.x;
    const overR = (plat.x + plat.w) - player.x;
    if (overL < overR) player.x = plat.x - PLAYER_W;
    else               player.x = plat.x + plat.w;
    player.vx = 0;
  }

  // Y axis
  player.vy       = Math.min(player.vy + GRAVITY * DT, MAX_FALL);
  player.y       += player.vy * DT;
  player.onGround = false;

  let best = null, bestO = Infinity;
  for (const plat of platforms) {
    if (!aabb(player.x, player.y, PLAYER_W, PLAYER_H, plat.x, plat.y, plat.w, plat.h)) continue;
    const o = Math.min((player.y + PLAYER_H) - plat.y, (plat.y + plat.h) - player.y);
    if (o < bestO) { bestO = o; best = plat; }
  }
  if (best) {
    const overT = (player.y + PLAYER_H) - best.y;
    const overB = (best.y + best.h) - player.y;
    if (overT <= overB + 1) { player.y = best.y - PLAYER_H; player.vy = 0; player.onGround = true; }
    else                    { player.y = best.y + best.h;   player.vy = Math.abs(player.vy) * 0.2; }
  }

  // ── Bounce pads: NON-SOLID trigger zone ──────────────────────────────────
  // Only apply upward impulse when the player's feet enter the pad zone.
  // NO position snapping — this is the core fix for the bounce desync bug.
  for (const pad of bouncePads) {
    if (player.vy < -100) continue; // already flying upward fast, skip
    // Test the bottom 10px of the player against the pad
    if (aabb(player.x + 2, player.y + PLAYER_H - 10, PLAYER_W - 4, 14,
             pad.x, pad.y, pad.w, pad.h)) {
      player.vy       = BOUNCE_POWER;
      player.onGround = false;
    }
  }

  // Fell off world
  if (player.y > MAP_H + 150) {
    player.y = 100; player.x = MAP_W / 2 - PLAYER_W / 2;
    player.vy = 0; player.onGround = false;
  }
}

function checkTeleporters(player, map) {
  if (player.teleportCooldown > 0) { player.teleportCooldown--; return; }
  for (const tp of map.teleporters) {
    const cx = player.x + PLAYER_W / 2, cy = player.y + PLAYER_H / 2;
    if (Math.hypot(cx - tp.x, cy - tp.y) < tp.r + 14) {
      player.x = tp.targetX - PLAYER_W / 2;
      player.y = tp.targetY - PLAYER_H;
      player.vy = 0;
      player.teleportCooldown = TELEPORT_CD;
      return;
    }
  }
}

// ─── Game Loop ───────────────────────────────────────────────────────────────
function startCountdown(room) {
  room.status = 'countdown'; room.countdownValue = 3;
  io.to(room.code).emit('countdown', { value: 3 });
  const iv = setInterval(() => {
    room.countdownValue--;
    if (room.countdownValue <= 0) { clearInterval(iv); startGame(room); }
    else io.to(room.code).emit('countdown', { value: room.countdownValue });
  }, 1000);
}

function startGame(room) {
  room.status = 'playing'; room.timer = room.roundDuration; room.tick = 0;
  const map = MAPS[room.mapIndex];
  let si = 0;
  for (const [, p] of room.players) {
    const sp = map.spawns[si++ % map.spawns.length];
    p.x = sp.x; p.y = sp.y; p.vx = 0; p.vy = 0;
    p.isIt = false; p.tagCooldown = 0; p.teleportCooldown = TELEPORT_CD;
  }
  for (const [, inp] of room.inputs) {
    inp.left = inp.right = inp.jump = false; inp.jumpBuffer = 0;
  }
  const ids = [...room.players.keys()];
  room.itPlayerId = ids[Math.floor(Math.random() * ids.length)];
  room.players.get(room.itPlayerId).isIt = true;
  io.to(room.code).emit('gameStart', { mapIndex: room.mapIndex, roundDuration: room.roundDuration, itPlayerId: room.itPlayerId });
  room.gameInterval = setInterval(() => gameTick(room), 1000 / TICK_RATE);
}

function gameTick(room) {
  if (room.status !== 'playing') return;
  const map = MAPS[room.mapIndex];

  for (const [id, player] of room.players) {
    const inp = room.inputs.get(id) || {};
    if (inp.left && !inp.right)       { player.vx = -MOVE_SPEED; player.facingRight = false; }
    else if (inp.right && !inp.left)  { player.vx =  MOVE_SPEED; player.facingRight = true;  }
    else { player.vx *= 0.80; if (Math.abs(player.vx) < 2) player.vx = 0; }

    if (inp.jumpBuffer > 0 && player.onGround) {
      player.vy = JUMP_SPEED; player.onGround = false; inp.jumpBuffer = 0;
    } else if (inp.jumpBuffer > 0) { inp.jumpBuffer--; }

    resolvePlatformCollisions(player, map);
    checkTeleporters(player, map);
    if (player.tagCooldown > 0) player.tagCooldown--;
  }

  // Tag detection
  const itP = room.players.get(room.itPlayerId);
  if (itP && itP.tagCooldown === 0) {
    const itCx = itP.x + PLAYER_W/2, itCy = itP.y + PLAYER_H/2;
    for (const [id, player] of room.players) {
      if (id === room.itPlayerId || player.tagCooldown > 0) continue;
      if (Math.hypot(itCx - (player.x + PLAYER_W/2), itCy - (player.y + PLAYER_H/2)) < TAG_DIST) {
        itP.isIt = false; itP.tagCooldown = TAG_COOLDOWN;
        player.isIt = true; player.tagCooldown = 0; player.timesTagged++;
        room.itPlayerId = id;
        io.to(room.code).emit('tagged', { newItId:id, oldItId:itP.id, newItName:player.name });
        break;
      }
    }
  }

  // Timer
  room.tick++;
  if (room.tick % TICK_RATE === 0) { room.timer--; if (room.timer <= 0) { endGame(room, 'timeout'); return; } }

  // Broadcast state
  const state = { players:{}, timer:room.timer, itPlayerId:room.itPlayerId, tick:room.tick };
  for (const [id, p] of room.players) {
    state.players[id] = {
      id:p.id, name:p.name, color:p.color,
      x:Math.round(p.x*10)/10, y:Math.round(p.y*10)/10,
      vx:Math.round(p.vx), vy:Math.round(p.vy),
      onGround:p.onGround, isIt:p.isIt, tagCooldown:p.tagCooldown,
      facingRight:p.facingRight,
    };
  }
  io.to(room.code).emit('gameState', state);
}

function endGame(room, reason) {
  stopGameLoop(room); room.status = 'ended';
  const results = [...room.players.values()].map(p => ({
    id:p.id, name:p.name, color:p.color, isIt:p.isIt, timesTagged:p.timesTagged, won:!p.isIt,
  })).sort((a,b) => (b.won?1:0)-(a.won?1:0));
  io.to(room.code).emit('gameEnd', { reason, results });
  setTimeout(() => {
    if (!rooms.has(room.code)) return;
    room.status='lobby'; room.timer=room.roundDuration; room.itPlayerId=null;
    for (const [,p] of room.players) { p.isIt=false; p.tagCooldown=0; p.timesTagged=0; }
    io.to(room.code).emit('returnToLobby', getRoomLobbyData(room));
  }, 6000);
}

function stopGameLoop(room) { if (room.gameInterval) { clearInterval(room.gameInterval); room.gameInterval=null; } }

function getRoomLobbyData(room) {
  return {
    code:room.code, host:room.host, status:room.status,
    mapIndex:room.mapIndex, roundDuration:room.roundDuration,
    players:[...room.players.values()].map(p=>({id:p.id,name:p.name,color:p.color,colorIndex:p.colorIndex})),
  };
}

// ─── Socket Events ───────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  socket.on('createRoom', ({name,mapIndex=0,roundDuration=90},cb) => {
    if (socketToRoom.has(socket.id)) return cb({error:'Already in a room'});
    if (!name?.trim()) return cb({error:'Name required'});
    cb({success:true, room:getRoomLobbyData(createRoom(socket,name.trim(),mapIndex,roundDuration))});
  });

  socket.on('joinRoom', ({name,code},cb) => {
    if (socketToRoom.has(socket.id)) return cb({error:'Already in a room'});
    if (!name?.trim()) return cb({error:'Name required'});
    const room = rooms.get(code?.toUpperCase());
    if (!room)                            return cb({error:'Room not found'});
    if (room.status !== 'lobby')          return cb({error:'Game in progress'});
    if (room.players.size >= MAX_PLAYERS) return cb({error:'Room full'});
    const ci = room.players.size;
    addPlayerToRoom(room, socket, name.trim(), ci, MAPS[room.mapIndex].spawns[ci]);
    const ld = getRoomLobbyData(room);
    socket.to(room.code).emit('playerJoined', ld);
    cb({success:true, room:ld});
  });

  socket.on('input', (input) => {
    const room = rooms.get(socketToRoom.get(socket.id));
    if (!room || room.status !== 'playing') return;
    const cur = room.inputs.get(socket.id);
    if (!cur) return;
    if (input.jump && !cur.jump) cur.jumpBuffer = JUMP_BUFFER_TICKS;
    cur.left = !!input.left; cur.right = !!input.right; cur.jump = !!input.jump;
  });

  socket.on('startGame', (cb) => {
    const room = rooms.get(socketToRoom.get(socket.id));
    if (!room)                   return cb?.({error:'Not in room'});
    if (room.host !== socket.id) return cb?.({error:'Only host can start'});
    if (room.status !== 'lobby') return cb?.({error:'Already started'});
    if (room.players.size < 2)   return cb?.({error:'Need 2+ players'});
    startCountdown(room); cb?.({success:true});
  });

  socket.on('changeSettings', ({mapIndex,roundDuration}) => {
    const room = rooms.get(socketToRoom.get(socket.id));
    if (!room || room.host !== socket.id || room.status !== 'lobby') return;
    if (mapIndex !== undefined && MAPS[mapIndex]) room.mapIndex = mapIndex;
    if (roundDuration !== undefined) room.roundDuration = roundDuration;
    io.to(room.code).emit('settingsChanged', {mapIndex:room.mapIndex,roundDuration:room.roundDuration});
  });

  socket.on('chatMsg', (msg) => {
    const room = rooms.get(socketToRoom.get(socket.id));
    if (!room) return;
    const player = room.players.get(socket.id);
    if (!player) return;
    io.to(room.code).emit('chatMsg', {name:player.name,color:player.color,msg:String(msg).substring(0,80)});
  });

  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);
    const r = removePlayerFromRoom(socket.id);
    if (!r || !rooms.has(r.code)) return;
    io.to(r.code).emit('playerLeft', {playerId:socket.id,room:getRoomLobbyData(r.room)});
  });

  socket.on('ping', (cb) => { if (typeof cb === 'function') cb(); });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => console.log(`\n🏷️  TAG Server → http://0.0.0.0:${PORT}\n`));
