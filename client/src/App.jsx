import { useState, useEffect, useRef } from 'react'
import io from 'socket.io-client'

const CHUNK_SIZE = 64 * 1024
const socket = io(import.meta.env.VITE_BACKEND_URL, {
  transports: ["websocket"],
  reconnection: true,
  timeout: 20000
});

async function sha256(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function getFileIcon(type) {
  if (!type) return '📄'
  if (type.startsWith('image/')) return '🖼️'
  if (type.startsWith('video/')) return '🎬'
  if (type.startsWith('audio/')) return '🎵'
  if (type.includes('pdf')) return '📕'
  if (type.includes('zip') || type.includes('tar') || type.includes('gz')) return '📦'
  if (type.includes('word') || type.includes('document')) return '📝'
  if (type.includes('sheet') || type.includes('excel')) return '📊'
  return '📄'
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #7c3aed, #6d28d9)',
  'linear-gradient(135deg, #06b6d4, #0891b2)',
  'linear-gradient(135deg, #ec4899, #db2777)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #6366f1, #4f46e5)',
  'linear-gradient(135deg, #f43f5e, #e11d48)',
  'linear-gradient(135deg, #8b5cf6, #7c3aed)',
  'linear-gradient(135deg, #14b8a6, #0d9488)',
  'linear-gradient(135deg, #f97316, #ea580c)',
]

function avatarColor(name) {
  if (!name) return AVATAR_GRADIENTS[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length]
}

/* ─────────────────────────────────────────────
   STYLES — Nebula Theme
   ───────────────────────────────────────────── */

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #06060e;
    --bg-2: #0c0c1d;
    --surface: #12122a;
    --surface-2: #1a1a3e;
    --glass: rgba(255,255,255,0.03);
    --glass-2: rgba(255,255,255,0.06);
    --glass-border: rgba(255,255,255,0.08);
    --glass-hover: rgba(255,255,255,0.14);
    --accent: #7c3aed;
    --accent-light: #a78bfa;
    --accent-glow: rgba(124,58,237,0.25);
    --cyan: #06b6d4;
    --cyan-glow: rgba(6,182,212,0.2);
    --pink: #ec4899;
    --green: #10b981;
    --green-glow: rgba(16,185,129,0.15);
    --red: #ef4444;
    --red-glow: rgba(239,68,68,0.15);
    --text: #e8e8f4;
    --text-2: #9494b0;
    --text-3: #5a5a78;
    --font: 'Inter', -apple-system, sans-serif;
    --radius: 16px;
    --radius-sm: 10px;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    min-height: 100vh;
    overflow: hidden;
  }

  /* ── Animated Background Orbs ── */
  .bg-orbs { position: fixed; inset: 0; overflow: hidden; z-index: 0; pointer-events: none; }
  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(120px);
    opacity: 0.35;
    animation: drift 20s infinite alternate ease-in-out;
  }
  .orb-1 { width: 600px; height: 600px; background: var(--accent); top: -15%; right: -10%; animation-duration: 25s; }
  .orb-2 { width: 500px; height: 500px; background: var(--cyan); bottom: -15%; left: -10%; animation-duration: 22s; animation-delay: -7s; }
  .orb-3 { width: 350px; height: 350px; background: var(--pink); top: 40%; left: 35%; animation-duration: 30s; animation-delay: -12s; opacity: 0.2; }
  @keyframes drift {
    0%   { transform: translate(0, 0) scale(1); }
    33%  { transform: translate(40px, -30px) scale(1.06); }
    66%  { transform: translate(-30px, 25px) scale(0.94); }
    100% { transform: translate(15px, -15px) scale(1.02); }
  }

  /* ── App Shell ── */
  .app {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    height: 100vh;
    max-width: 920px;
    margin: 0 auto;
    padding: 0 20px;
  }

  /* ── Navbar ── */
  .navbar { display: flex; align-items: center; gap: 14px; padding: 20px 0 16px; }
  .nav-brand { display: flex; align-items: center; gap: 12px; }
  .nav-logo {
    width: 44px; height: 44px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 24px var(--accent-glow);
    flex-shrink: 0;
  }
  .nav-logo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .nav-title {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: linear-gradient(135deg, var(--text), var(--accent-light));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .nav-sub { font-size: 11px; color: var(--text-3); font-weight: 400; letter-spacing: 0.3px; margin-top: 1px; }
  .nav-badge {
    margin-left: auto;
    display: flex; align-items: center; gap: 8px;
    background: var(--glass);
    backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    border-radius: 24px;
    padding: 7px 16px;
    font-size: 12px; font-weight: 500;
    color: var(--green);
    transition: all 0.3s ease;
  }
  .nav-badge.off { color: var(--red); }
  .dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 10px var(--green);
    animation: glow 2s infinite;
  }
  .nav-badge.off .dot { background: var(--red); box-shadow: 0 0 10px var(--red); animation: none; }
  @keyframes glow { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

  /* ── Online Users Strip ── */
  .users-strip {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 16px; margin-bottom: 8px;
    background: var(--glass);
    backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius);
    overflow-x: auto; scrollbar-width: none;
  }
  .users-strip::-webkit-scrollbar { display: none; }
  .users-tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-3); flex-shrink: 0; }
  .users-count {
    background: linear-gradient(135deg, var(--accent), var(--cyan));
    color: #fff; font-size: 10px; font-weight: 700;
    padding: 3px 9px; border-radius: 10px; flex-shrink: 0;
  }
  .user-pill {
    display: flex; align-items: center; gap: 8px;
    background: var(--glass-2); border: 1px solid var(--glass-border);
    border-radius: 24px; padding: 5px 14px 5px 6px;
    flex-shrink: 0;
    animation: pop-in 0.3s cubic-bezier(0.16,1,0.3,1);
    transition: all 0.2s ease;
  }
  .user-pill:hover { border-color: var(--glass-hover); background: rgba(255,255,255,0.08); }
  @keyframes pop-in {
    from { opacity: 0; transform: translateX(-8px) scale(0.9); }
    to   { opacity: 1; transform: translateX(0) scale(1); }
  }
  .user-av {
    width: 24px; height: 24px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 700; color: #fff;
    position: relative;
  }
  .user-av::after {
    content: ''; position: absolute; bottom: -1px; right: -1px;
    width: 8px; height: 8px; background: var(--green);
    border-radius: 50%; border: 2px solid var(--bg);
    box-shadow: 0 0 6px var(--green);
  }
  .user-name { font-size: 12px; font-weight: 500; color: var(--text-2); }
  .users-empty { font-size: 12px; color: var(--text-3); font-style: italic; }

  /* ── Messages Area ── */
  .messages {
    overflow-y: auto; padding: 14px 0;
    display: flex; flex-direction: column; gap: 16px;
    scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent;
  }

  /* Empty state */
  .empty-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 18px; padding: 50px 20px; text-align: center;
  }
  .empty-img { width: 220px; height: 220px; opacity: 0.8; object-fit: contain; border-radius: 24px; }
  .empty-title {
    font-size: 20px; font-weight: 700;
    background: linear-gradient(135deg, var(--text), var(--accent-light));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .empty-sub { font-size: 13px; color: var(--text-3); max-width: 340px; line-height: 1.7; }

  /* Message row */
  .msg-row {
    display: flex; gap: 12px;
    animation: msg-in 0.35s cubic-bezier(0.16,1,0.3,1);
  }
  @keyframes msg-in {
    from { opacity: 0; transform: translateY(14px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .msg-avatar {
    width: 38px; height: 38px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700; color: #fff;
    flex-shrink: 0; margin-top: 4px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  }
  .msg-body { flex: 1; min-width: 0; }
  .msg-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 5px; }
  .msg-sender { font-size: 13px; font-weight: 600; color: var(--text); }
  .msg-time { font-size: 10px; color: var(--text-3); }

  /* Text bubble */
  .msg-bubble {
    background: var(--glass-2); backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: 4px 16px 16px 16px;
    padding: 12px 16px; font-size: 14px; line-height: 1.6;
    color: var(--text); display: inline-block;
    max-width: 100%; word-break: break-word;
    transition: border-color 0.2s;
  }
  .msg-bubble:hover { border-color: var(--glass-hover); }

  /* File card */
  .file-card {
    background: var(--glass-2); backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: 4px 16px 16px 16px;
    padding: 18px; max-width: 440px;
    transition: border-color 0.2s;
  }
  .file-card:hover { border-color: var(--glass-hover); }
  .file-top { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
  .file-icon-box {
    width: 50px; height: 50px; border-radius: 14px;
    background: linear-gradient(135deg, var(--accent-glow), var(--cyan-glow));
    border: 1px solid var(--glass-border);
    display: flex; align-items: center; justify-content: center;
    font-size: 24px; flex-shrink: 0;
  }
  .file-meta { flex: 1; min-width: 0; }
  .file-title { font-size: 14px; font-weight: 600; word-break: break-all; }
  .file-size { font-size: 12px; color: var(--text-3); margin-top: 3px; }
  .integrity {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 12px; border-radius: 8px;
    font-size: 11px; font-weight: 600; margin-bottom: 12px;
  }
  .integrity.ok { background: var(--green-glow); border: 1px solid rgba(16,185,129,0.2); color: var(--green); }
  .integrity.bad { background: var(--red-glow); border: 1px solid rgba(239,68,68,0.2); color: var(--red); }
  .hashes {
    font-size: 10px; color: var(--text-3);
    background: rgba(0,0,0,0.25); border-radius: 8px;
    padding: 8px 12px; margin-bottom: 14px;
    font-family: 'Courier New', monospace; overflow: hidden;
  }
  .hashes .row { display: flex; gap: 8px; margin-bottom: 3px; }
  .hashes .row:last-child { margin-bottom: 0; }
  .hashes .k { color: var(--text-3); flex-shrink: 0; }
  .hashes .v { color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .dl-btn {
    display: inline-flex; align-items: center; gap: 8px;
    background: linear-gradient(135deg, var(--accent), #5b21b6);
    color: #fff; border: none; border-radius: var(--radius-sm);
    padding: 9px 20px; font-size: 12px; font-weight: 600;
    font-family: var(--font); text-decoration: none; cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 20px var(--accent-glow);
  }
  .dl-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(124,58,237,0.35); }

  /* Progress */
  .progress-card {
    background: var(--glass-2); backdrop-filter: blur(16px);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius); padding: 16px;
    animation: msg-in 0.3s ease;
  }
  .progress-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
  .progress-name {
    font-size: 13px; font-weight: 500;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70%;
  }
  .progress-pct {
    font-size: 13px; font-weight: 700;
    background: linear-gradient(135deg, var(--accent), var(--cyan));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .progress-track { height: 6px; background: rgba(255,255,255,0.06); border-radius: 6px; overflow: hidden; }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--cyan));
    border-radius: 6px; transition: width 0.3s ease;
    box-shadow: 0 0 14px var(--accent-glow);
  }

  /* Typing */
  .typing-bar {
    display: flex; align-items: center; gap: 10px;
    padding: 4px 0; animation: msg-in 0.2s ease;
  }
  .typing-dots {
    display: flex; gap: 4px;
    padding: 8px 14px;
    background: var(--glass-2); border: 1px solid var(--glass-border);
    border-radius: 14px;
  }
  .typing-dots span {
    width: 7px; height: 7px; border-radius: 50%;
    background: linear-gradient(135deg, var(--accent), var(--cyan));
    animation: wave 1.4s infinite ease-in-out;
  }
  .typing-dots span:nth-child(2) { animation-delay: 0.15s; }
  .typing-dots span:nth-child(3) { animation-delay: 0.3s; }
  @keyframes wave {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.25; }
    30% { transform: translateY(-8px); opacity: 1; }
  }
  .typing-who { font-size: 12px; color: var(--text-3); }

  /* ── Composer ── */
  .composer { padding: 14px 0 24px; }
  .composer-glass {
    background: var(--glass); backdrop-filter: blur(24px);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius); padding: 16px;
  }
  .composer-name { margin-bottom: 12px; }
  .label {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1.5px; color: var(--text-3); margin-bottom: 6px;
  }
  .field {
    width: 100%;
    background: rgba(0,0,0,0.3);
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    padding: 11px 14px;
    font-size: 14px; font-family: var(--font); color: var(--text);
    outline: none; transition: all 0.2s ease;
  }
  .field::placeholder { color: var(--text-3); }
  .field:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
  .actions { display: flex; gap: 8px; align-items: flex-end; }
  .actions .grow { flex: 1; }
  .attach {
    position: relative; width: 44px; height: 44px;
    background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border);
    border-radius: var(--radius-sm);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 0.2s ease;
    flex-shrink: 0; overflow: hidden;
  }
  .attach:hover { border-color: var(--glass-hover); background: rgba(255,255,255,0.04); }
  .attach.on { border-color: var(--accent); background: var(--accent-glow); }
  .attach input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .attach svg { width: 20px; height: 20px; stroke: var(--text-2); fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .send {
    height: 44px; padding: 0 24px;
    background: linear-gradient(135deg, var(--accent), #5b21b6);
    border: none; border-radius: var(--radius-sm);
    font-size: 14px; font-weight: 600; font-family: var(--font); color: #fff;
    cursor: pointer; flex-shrink: 0;
    display: flex; align-items: center; gap: 8px;
    transition: all 0.2s ease;
    box-shadow: 0 4px 20px var(--accent-glow);
  }
  .send:hover { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(124,58,237,0.4); }
  .send:active { transform: scale(0.97); }
  .send:disabled { opacity: 0.25; cursor: not-allowed; transform: none; box-shadow: none; }
  .send svg { width: 18px; height: 18px; stroke: #fff; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .file-strip {
    display: flex; align-items: center; gap: 8px;
    background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border);
    border-radius: 8px; padding: 8px 12px; margin-top: 8px;
    font-size: 12px; color: var(--text-2);
    animation: msg-in 0.2s ease;
  }
  .file-strip .fname { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .x-btn {
    background: none; border: none; color: var(--text-3);
    cursor: pointer; font-size: 16px; padding: 0; line-height: 1;
    transition: color 0.2s;
  }
  .x-btn:hover { color: var(--red); }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .app { padding: 0 12px; }
    .nav-title { font-size: 18px; }
    .nav-badge { padding: 5px 10px; font-size: 11px; }
    .users-strip { padding: 10px 12px; }
    .composer-glass { padding: 12px; }
    .send { padding: 0 16px; }
    .empty-img { width: 160px; height: 160px; }
  }
`

/* ─────────────────────────────────────────────
   COMPONENT
   ───────────────────────────────────────────── */

export default function App() {
  const [data, setData] = useState({ name: '', message: '', file: null })
  const [messages, setMessages] = useState([])
  const [progress, setProgress] = useState(null)
  const [sending, setSending] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState([])
  const [typingUsers, setTypingUsers] = useState([])
  const [connected, setConnected] = useState(false)
  const incomingFiles = useRef({})
  const messagesEndRef = useRef(null)
  const joinedRef = useRef(false)
  const typingTimeoutRef = useRef(null)

  /* ── Socket listeners ── */
  useEffect(() => {

    socket.on("connect", () => {
      console.log("CONNECTED:", socket.id)
      setConnected(true)
    })

    socket.on("chat message", (msg) => {
      setMessages(prev => [...prev, { ...msg, type: "text", ts: new Date() }])
    })

    socket.on("file:start", ({ transferId, fileName, fileType, totalChunks, hash, senderName }) => {
      incomingFiles.current[transferId] = { fileName, fileType, totalChunks, hash, senderName, chunks: [] }
    })

    socket.on("file:chunk", async ({ transferId, index, data }) => {
      const file = incomingFiles.current[transferId]
      if (!file) return

      file.chunks[index] = data
      const received = file.chunks.filter(Boolean).length

      setProgress({ name: file.fileName, pct: Math.round((received / file.totalChunks) * 100) })

      if (received >= file.totalChunks) {
        const binaryChunks = file.chunks.map(b64 => {
          const binary = atob(b64)
          return Uint8Array.from(binary, c => c.charCodeAt(0))
        })
        const totalLen = binaryChunks.reduce((s, c) => s + c.length, 0)
        const assembled = new Uint8Array(totalLen)
        let offset = 0
        for (const chunk of binaryChunks) { assembled.set(chunk, offset); offset += chunk.length }

        const receivedHash = await sha256(assembled.buffer)
        const verified = receivedHash === file.hash
        const url = URL.createObjectURL(new Blob([assembled], { type: file.fileType }))

        setMessages(prev => [...prev, {
          type: "file", name: file.senderName || "Anonymous",
          fileName: file.fileName, fileType: file.fileType, fileSize: totalLen,
          url, verified, senderHash: file.hash, receivedHash, ts: new Date()
        }])

        delete incomingFiles.current[transferId]
        setProgress(null)
      }
    })

    socket.on("users:update", (userList) => setOnlineUsers(userList))

    socket.on("user:typing", ({ name, isTyping }) => {
      setTypingUsers(prev => {
        if (isTyping) return prev.includes(name) ? prev : [...prev, name]
        return prev.filter(n => n !== name)
      })
    })

    socket.on("disconnect", () => setConnected(false))

    return () => {
      socket.off("connect")
      socket.off("chat message")
      socket.off("file:start")
      socket.off("file:chunk")
      socket.off("users:update")
      socket.off("user:typing")
      socket.off("disconnect")
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, progress])

  /* ── Handlers ── */

  const handleSubmit = async () => {
    if (!data.name.trim()) return
    if (!data.message.trim() && !data.file) return
    setSending(true)

    if (data.name.trim()) {
      socket.emit('user:join', { name: data.name })
      joinedRef.current = true
    }
    socket.emit('user:typing', { name: data.name, isTyping: false })
    clearTimeout(typingTimeoutRef.current)

    if (data.file) {
      const buffer = await data.file.arrayBuffer()
      const hash = await sha256(buffer)
      const transferId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      const totalChunks = Math.ceil(buffer.byteLength / CHUNK_SIZE)

      socket.emit('file:start', {
        transferId, fileName: data.file.name, fileType: data.file.type,
        totalChunks, hash, senderName: data.name
      })

      for (let i = 0; i < totalChunks; i++) {
        const slice = buffer.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
        const b64 = btoa(String.fromCharCode(...new Uint8Array(slice)))
        socket.emit('file:chunk', { transferId, index: i, data: b64 })
        setProgress({ name: data.file.name, pct: Math.round(((i + 1) / totalChunks) * 100) })
        if (i % 10 === 0) await new Promise(r => setTimeout(r, 0))
      }
    } else {
      const msg = { name: data.name, message: data.message, ts: new Date() }
      socket.emit('chat message', msg)
      setMessages(prev => [...prev, { ...msg, type: 'text' }])
    }

    setData(d => ({ ...d, message: '', file: null }))
    setSending(false)
  }

  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }

  const handleTyping = () => {
    if (data.name.trim()) {
      socket.emit('user:typing', { name: data.name, isTyping: true })
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('user:typing', { name: data.name, isTyping: false })
      }, 2000)
    }
  }

  const handleNameBlur = () => {
    if (data.name.trim()) {
      socket.emit('user:join', { name: data.name })
      joinedRef.current = true
    }
  }

  /* ── Helpers ── */
  const fmt = ts => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
  const initials = name => name ? name.trim().slice(0, 2).toUpperCase() : '?'

  /* ── Render ── */
  return (
    <>
      <style>{styles}</style>

      {/* Animated background orbs */}
      <div className="bg-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <div className="app">

        {/* ── Navbar ── */}
        <nav className="navbar">
          <div className="nav-brand">
            <div className="nav-logo">
              <img src="/logo.jpg" alt="FileDrop" />
            </div>
            <div>
              <div className="nav-title">FileDrop</div>
              <div className="nav-sub">Verified peer-to-peer transfer</div>
            </div>
          </div>
          <div className={`nav-badge ${connected ? '' : 'off'}`}>
            <span className="dot" />
            {connected ? 'Connected' : 'Reconnecting…'}
          </div>
        </nav>

        {/* ── Online Users ── */}
        <div className="users-strip">
          <span className="users-tag">Online</span>
          <span className="users-count">{onlineUsers.length}</span>
          {onlineUsers.map((u, i) => (
            <div key={i} className="user-pill">
              <div className="user-av" style={{ background: avatarColor(u.name) }}>
                {initials(u.name)}
              </div>
              <span className="user-name">{u.name}</span>
            </div>
          ))}
          {onlineUsers.length === 0 && (
            <span className="users-empty">Enter your name to go online</span>
          )}
        </div>

        {/* ── Messages ── */}
        <div className="messages">

          {messages.length === 0 && !progress && (
            <div className="empty-state">
              <img className="empty-img" src="/empty-state.jpg" alt="" />
              <div className="empty-title">Start a conversation</div>
              <div className="empty-sub">
                Share files with SHA-256 integrity verification, or chat in real-time with connected peers.
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className="msg-row">
              <div className="msg-avatar" style={{ background: avatarColor(msg.name) }}>
                {initials(msg.name)}
              </div>
              <div className="msg-body">
                <div className="msg-head">
                  <span className="msg-sender">{msg.name || 'Anonymous'}</span>
                  <span className="msg-time">{fmt(msg.ts)}</span>
                </div>

                {msg.type === 'text' ? (
                  <div className="msg-bubble">{msg.message}</div>
                ) : (
                  <div className="file-card">
                    <div className="file-top">
                      <div className="file-icon-box">{getFileIcon(msg.fileType)}</div>
                      <div className="file-meta">
                        <div className="file-title">{msg.fileName}</div>
                        <div className="file-size">{formatBytes(msg.fileSize)}</div>
                      </div>
                    </div>
                    <div className={`integrity ${msg.verified ? 'ok' : 'bad'}`}>
                      {msg.verified ? '✓ Integrity verified' : '✗ Hash mismatch'}
                    </div>
                    <div className="hashes">
                      <div className="row">
                        <span className="k">sent    </span>
                        <span className="v">{msg.senderHash}</span>
                      </div>
                      <div className="row">
                        <span className="k">received</span>
                        <span className="v">{msg.receivedHash}</span>
                      </div>
                    </div>
                    <a className="dl-btn" href={msg.url} download={msg.fileName}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                      </svg>
                      Download
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}

          {progress && (
            <div className="progress-card">
              <div className="progress-top">
                <span className="progress-name">⬆ {progress.name}</span>
                <span className="progress-pct">{progress.pct}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress.pct}%` }} />
              </div>
            </div>
          )}

          {typingUsers.length > 0 && (
            <div className="typing-bar">
              <div className="typing-dots">
                <span /><span /><span />
              </div>
              <span className="typing-who">
                {typingUsers.length === 1
                  ? `${typingUsers[0]} is typing…`
                  : `${typingUsers.join(', ')} are typing…`}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Composer ── */}
        <div className="composer">
          <div className="composer-glass">
            <div className="composer-name">
              <div className="label">Your name</div>
              <input
                className="field"
                placeholder="Enter your display name"
                value={data.name}
                onChange={e => setData({ ...data, name: e.target.value })}
                onBlur={handleNameBlur}
              />
            </div>
            <div className="label">Message</div>
            <div className="actions">
              <div className="grow">
                <input
                  className="field"
                  placeholder="Type something or drop a file…"
                  value={data.message}
                  onChange={e => { setData({ ...data, message: e.target.value }); handleTyping() }}
                  onKeyDown={handleKey}
                  disabled={!!data.file}
                />
                {data.file && (
                  <div className="file-strip">
                    <span>{getFileIcon(data.file.type)}</span>
                    <span className="fname">{data.file.name}</span>
                    <span style={{ color: 'var(--text-3)' }}>{formatBytes(data.file.size)}</span>
                    <button className="x-btn" onClick={() => setData({ ...data, file: null })}>✕</button>
                  </div>
                )}
              </div>
              <label className={`attach ${data.file ? 'on' : ''}`} title="Attach file">
                <svg viewBox="0 0 24 24">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
                <input type="file" onChange={e => setData({ ...data, file: e.target.files[0], message: '' })} />
              </label>
              <button
                className="send"
                onClick={handleSubmit}
                disabled={sending || !data.name.trim() || (!data.message.trim() && !data.file)}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
                </svg>
                Send
              </button>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}