import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const ACCENT = "#cae84b";
const ACCENT_DARK = "#0a0a0a";
const SECONDARY = "#fb923c";
const RGB    = "202,232,75";
const DARK   = "#0a0a0a";
const API    = "http://localhost:3001";

// Schema fiel ao MCP do Higgsfield (validado via tools/call models_explore)
const MODELS = [
  {
    id: "kling3_0",
    name: "Kling 3.0 Omni",
    tag: "MULTI-SHOT",
    desc: "Multi-shot, audio sync e motion transfer automático",
    duration: { range: [3, 15], default: 5 },
    aspectRatios: ["16:9", "9:16", "1:1"],
    // mode é o REAL switch de resolução: std → 720p, pro → 1080p (confirmado via vídeo real)
    // sound é UI-only — MCP descarta, mas mostramos o toggle pra fidelidade com a Higgsfield
    params: {
      mode: {
        options: ["std", "pro"],
        default: "std",
        label: "Resolução",
        optionLabels: { std: "720p", pro: "1080p" },
      },
      sound: { type: "bool", default: true, label: "Audio", uiOnly: true },
    },
    medias: ["start_image", "end_image", "image"],
    thumb: { image: "/thumbs/kling.png" },
  },
  {
    id: "kling2_6",
    name: "Kling 2.6",
    tag: "CINEMATIC",
    desc: "Cinematic motion, física avançada",
    duration: { discrete: [5, 10], default: 5 },
    aspectRatios: ["16:9", "9:16", "1:1"],
    params: { sound: { type: "bool", default: true, label: "Audio" } },
    medias: ["start_image"],
    thumb: { image: "/thumbs/kling.png" },
  },
  {
    id: "seedance_2_0",
    name: "Seedance 2.0",
    tag: "REFERÊNCIA",
    desc: "Reference-driven, identidade consistente",
    duration: { range: [4, 15], default: 8 },
    aspectRatios: ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"],
    params: {
      resolution: { options: ["480p", "720p", "1080p"], default: "720p", label: "Resolução" },
      mode:       { options: ["std", "fast"], default: "std", label: "Modo" },
      sound:      { type: "bool", default: true, label: "Audio" },
    },
    medias: ["image", "video", "audio", "start_image", "end_image"],
    thumb: { image: "/thumbs/seedance.png" },
  },
];

const ROLE_LABELS = {
  start_image: "Start frame",
  end_image:   "End frame",
  image:       "Element",
  video:       "Video",
  audio:       "Audio",
};
const ROLE_ACCEPT = {
  start_image: "image/*",
  end_image:   "image/*",
  image:       "image/*",
  video:       "video/*",
  audio:       "audio/*",
};

function loadJSON(key, fb) { try { const v = JSON.parse(localStorage.getItem(key) || "null"); return v ?? fb; } catch { return fb; } }
function loadItems()       { const v = loadJSON("hf_video_items", []); return Array.isArray(v) ? v : []; }
function loadFavorites()   { return new Set(loadJSON("hf_video_favorites", [])); }

function fmtDateHeader(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Hoje";
  if (sameDay(d, yest))  return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(ts) { return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }

function Icon({ name, cls = "h-4 w-4", style }) {
  const p = { className: cls, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", style };
  const d = {
    video:        (<><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>),
    download:     (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>),
    heart:        (<><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></>),
    heart_filled: (<><path fill="currentColor" stroke="currentColor" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></>),
    zap:          (<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>),
    close:        (<><path d="M18 6 6 18m0-12 12 12"/></>),
    arrow_left:   (<><path d="M19 12H5M12 5l-7 7 7 7"/></>),
    copy:         (<><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>),
    refresh:      (<><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-8.5"/></>),
    play:         (<><polygon points="5 3 19 12 5 21 5 3"/></>),
    clock:        (<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>),
    expand:       (<><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>),
    chevron_down: (<><polyline points="6 9 12 15 18 9"/></>),
    plus:         (<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>),
    image:        (<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>),
    monitor:      (<><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>),
    diamond:      (<><path d="M6 3h12l4 6-10 12L2 9z"/></>),
    audio:        (<><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></>),
    audio_off:    (<><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>),
    sliders:      (<><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></>),
    sparkle:      (<><path d="M12 3 L13.5 8.5 L19 10 L13.5 11.5 L12 17 L10.5 11.5 L5 10 L10.5 8.5 Z"/><path d="M5 3l.5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5z"/></>),
    pencil:       (<><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></>),
  };
  return <svg {...p}>{d[name]}</svg>;
}

function StatusBadge({ status }) {
  const map = {
    queued:      { label: "Na fila",        color: "text-yellow-400/70", bg: "bg-yellow-400/10" },
    in_progress: { label: "Gerando",        color: "text-orange-400/80", bg: "bg-orange-400/10" },
    completed:   { label: "Concluído",      color: "text-green-400/80",  bg: "bg-green-400/10" },
    failed:      { label: "Falhou",         color: "text-red-400/80",    bg: "bg-red-400/10" },
    nsfw:        { label: "Bloqueado",      color: "text-red-400/80",    bg: "bg-red-400/10" },
  };
  const s = map[status] || map.queued;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold font-mono uppercase tracking-wider ${s.color} ${s.bg}`}>
      {(status === "queued" || status === "in_progress") && <span className="h-1 w-1 rounded-full bg-current animate-pulse" />}
      {s.label}
    </span>
  );
}

// Slot de upload (image / video / audio) — preview adapta conforme o role
function FrameSlot({ role, slot, onUpload, onRemove, optional = true, big = false, compact = false }) {
  const inputRef = useRef(null);
  const label = ROLE_LABELS[role] || role;
  const accept = ROLE_ACCEPT[role] || "image/*";
  const acceptPrefix = accept.replace("/*", "/");
  const placeholderIcon = role === "video" ? "video" : role === "audio" ? "audio" : "image";

  function pick() { inputRef.current?.click(); }
  function handleFile(file) { if (file && file.type.startsWith(acceptPrefix)) onUpload(role, file); }

  return (
    <button
      onClick={(slot?.preview && !slot?.uploading) ? undefined : pick}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
      className="relative flex w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border transition"
      style={{
        aspectRatio: big ? "16 / 9" : "1 / 1",
        minHeight: big ? 110 : undefined,
        borderColor: slot?.preview ? `rgba(${RGB},.4)` : "rgba(255,255,255,.1)",
        background: slot?.preview ? "rgba(0,0,0,.4)" : "rgba(255,255,255,.05)",
      }}
    >
      {slot?.preview ? (
        <>
          {role === "video" ? (
            <video src={slot.preview} muted playsInline className="absolute inset-0 h-full w-full object-cover" />
          ) : role === "audio" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40">
              <Icon name="audio" cls="h-6 w-6 text-white/70" />
              <span className="px-2 text-center text-[9px] text-white/50 line-clamp-1">{slot.filename || "audio"}</span>
            </div>
          ) : (
            <img src={slot.preview} alt={label} className="absolute inset-0 h-full w-full object-cover" />
          )}
          {slot.uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: ACCENT }} />
            </div>
          )}
          {slot.error && <div className="absolute inset-0 flex items-center justify-center bg-red-500/40 text-[9px] font-bold text-white">erro</div>}
          {!slot.uploading && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white hover:bg-red-500/80"
            >
              <Icon name="close" cls="h-3 w-3" />
            </button>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 px-2 py-1 text-[10px] font-semibold text-white/90" style={{ background: "linear-gradient(to top, rgba(0,0,0,.75), transparent)" }}>
            {label}
          </div>
        </>
      ) : (
        <>
          {optional && !compact && (
            <span className="absolute right-1.5 top-1.5 rounded bg-white/[.06] px-1.5 py-0.5 text-[9px] text-white/40">
              Optional
            </span>
          )}
          <div className={`flex items-center justify-center rounded-full bg-white/[.06] ${big ? "h-10 w-10" : compact ? "h-6 w-6" : "h-9 w-9"}`}>
            <Icon name={placeholderIcon} cls={big ? "h-5 w-5 text-white/50" : compact ? "h-3 w-3 text-white/45" : "h-4 w-4 text-white/45"} />
          </div>
          {!compact && <span className={`font-semibold text-white/70 ${big ? "text-[12px]" : "text-[11px]"}`}>{label}</span>}
          {big && <span className="text-[10px] text-white/35">Character, person or object</span>}
        </>
      )}
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
    </button>
  );
}

// Pill com popover. fullWidth=true ocupa toda a célula do grid (estilo Higgsfield).
function ParamPill({ open, onToggle, icon, value, color, children, popoverWidth = 220, fullWidth = false }) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 transition ${fullWidth ? "w-full justify-start" : ""}`}
        style={{
          borderColor: open ? `rgba(${RGB},.45)` : "rgba(255,255,255,.1)",
          background:  open ? `rgba(${RGB},.08)` : "rgba(255,255,255,.03)",
        }}
      >
        {icon && <Icon name={icon} cls="h-3.5 w-3.5" style={{ color: color || "rgba(255,255,255,.55)" }} />}
        <span className="font-mono text-[11px] font-semibold uppercase text-white">{value}</span>
      </button>
      {open && (
        <div
          className="absolute bottom-full left-0 z-30 mb-2 rounded-xl border p-2 shadow-2xl"
          style={{ borderColor: "rgba(255,255,255,.1)", background: "rgba(15,15,18,.98)", backdropFilter: "blur(20px)", width: popoverWidth }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export default function VideoStudio() {
  const navigate = useNavigate();

  const [model,         setModel]         = useState("kling3_0");
  const [prompt,        setPrompt]        = useState("");
  const [aspectRatio,   setAspectRatio]   = useState("16:9");
  const [duration,      setDuration]      = useState(5);
  const [extras,        setExtras]        = useState({});
  const [medias,        setMedias]        = useState({});
  const [items,         setItems]         = useState(loadItems);
  const [favorites,     setFavorites]     = useState(loadFavorites);
  const [error,         setError]         = useState(null);
  const [lightboxId,    setLightboxId]    = useState(null);
  const [authenticated, setAuthenticated] = useState(null);
  const [copied,        setCopied]        = useState(false);
  const [openModel,     setOpenModel]     = useState(false);
  const [openPill,      setOpenPill]      = useState(null); // 'duration' | 'aspect' | 'resolution' | 'mode' | 'genre' | 'quality' | null
  const [mediaTab,      setMediaTab]      = useState("frames"); // 'frames' | 'elements'
  const [pickerOpen,    setPickerOpen]    = useState(false);
  const [pickerFilter,  setPickerFilter]  = useState("");
  const modelRef = useRef(null);
  const pillRefs = useRef({});
  const textareaRef = useRef(null);
  const pickerRef = useRef(null);

  // Auto-resize do textarea — cresce até ~2.5× o tamanho base
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const min = 56;   // ~2 linhas
    const max = 160;  // ~8 linhas (≈ 2.5–3× base)
    el.style.height = Math.min(max, Math.max(min, el.scrollHeight)) + "px";
  }, [prompt]);

  // Lista plana de elementos uploadados, com nome estável (image_1, video_1, audio_1, etc.)
  function getElements() {
    const out = [];
    for (const role of ["image", "video", "audio", "start_image", "end_image"]) {
      const slots = medias[role] || [];
      slots.forEach((s, i) => {
        if (s.mediaId) {
          // start_image e end_image ficam sem sufixo numérico (são únicos)
          const name = (role === "start_image" || role === "end_image") ? role : `${role}_${i + 1}`;
          out.push({ name, role, slot: s });
        }
      });
    }
    return out;
  }
  const elements = getElements();
  const filteredElements = pickerFilter
    ? elements.filter(e => e.name.toLowerCase().includes(pickerFilter.toLowerCase()))
    : elements;

  // Click-outside fecha picker de elementos
  useEffect(() => {
    if (!pickerOpen) return;
    function onClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target) && textareaRef.current && !textareaRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [pickerOpen]);

  function handlePromptChange(e) {
    const value = e.target.value;
    setPrompt(value);
    const cursor = e.target.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const atIdx = before.lastIndexOf("@");
    if (atIdx >= 0) {
      const afterAt = before.slice(atIdx + 1);
      if (!/\s/.test(afterAt) && afterAt.length < 30) {
        setPickerFilter(afterAt);
        setPickerOpen(true);
        return;
      }
    }
    setPickerOpen(false);
  }

  function insertElement(name) {
    const t = textareaRef.current;
    if (!t) return;
    const cursor = t.selectionStart ?? prompt.length;
    const before = prompt.slice(0, cursor);
    const atIdx = before.lastIndexOf("@");
    let next, newCursor;
    if (atIdx >= 0 && !/\s/.test(before.slice(atIdx + 1))) {
      next = prompt.slice(0, atIdx) + `@${name} ` + prompt.slice(cursor);
      newCursor = atIdx + name.length + 2;
    } else {
      next = prompt.slice(0, cursor) + `@${name} ` + prompt.slice(cursor);
      newCursor = cursor + name.length + 2;
    }
    setPrompt(next);
    setPickerOpen(false);
    setTimeout(() => {
      t.focus();
      t.setSelectionRange(newCursor, newCursor);
    }, 0);
  }

  function openElementsPicker() {
    setPickerFilter("");
    setPickerOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }

  const selectedModel = MODELS.find(m => m.id === model) || MODELS[0];

  // Persistência
  useEffect(() => { localStorage.setItem("hf_video_items", JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem("hf_video_favorites", JSON.stringify([...favorites])); }, [favorites]);

  // Click-outside popovers
  useEffect(() => {
    if (!openModel && !openPill) return;
    function onClick(e) {
      if (openModel && modelRef.current && !modelRef.current.contains(e.target)) setOpenModel(false);
      if (openPill) {
        const el = pillRefs.current[openPill];
        if (el && !el.contains(e.target)) setOpenPill(null);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openModel, openPill]);

  // Auth
  useEffect(() => {
    checkAuth();
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "success") window.history.replaceState({}, "", window.location.pathname);
  }, []);
  async function checkAuth() {
    try { const r = await fetch(`${API}/api/auth/status`); const d = await r.json(); setAuthenticated(d.authenticated); }
    catch { setAuthenticated(false); }
  }
  function connectHiggsfield() { window.location.href = `${API}/api/auth/login`; }

  // Reset config quando muda modelo
  useEffect(() => {
    const m = selectedModel;
    setAspectRatio(prev => m.aspectRatios.includes(prev) ? prev : m.aspectRatios[0]);
    setDuration(m.duration?.default ?? (m.duration?.discrete?.[0] ?? m.duration?.range?.[0] ?? 5));
    const newExtras = {};
    for (const [key, cfg] of Object.entries(m.params || {})) newExtras[key] = cfg.default;
    setExtras(newExtras);
    setMedias({});
    // Tab default por capacidade do modelo
    const hasFrames = m.medias.some(r => r === "start_image" || r === "end_image");
    setMediaTab(hasFrames ? "frames" : "elements");
  }, [model]);

  // Polling
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    const interval = setInterval(async () => {
      const pending = itemsRef.current.filter(it => it.status !== "completed" && it.status !== "failed" && it.status !== "nsfw");
      if (pending.length === 0) return;
      try {
        const responses = await Promise.all(pending.map(it => fetch(`${API}/api/hf/job/${it.jobId}`)));
        if (responses.some(r => r.status === 401)) { setAuthenticated(false); return; }
        const results = await Promise.all(responses.map(r => r.json()));
        const updates = new Map(pending.map((it, i) => [it.jobId, results[i]]));
        setItems(prev => prev.map(it => {
          const u = updates.get(it.jobId);
          if (!u) return it;
          return { ...it, status: u.status, url: u.video?.url || it.url };
        }));
      } catch (e) { console.error("Poll error:", e); }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Lightbox keyboard nav
  const completedItems = items.filter(it => it.url);
  const completedRef = useRef(completedItems);
  completedRef.current = completedItems;
  const lightboxItem = completedItems.find(it => it.jobId === lightboxId);
  const lightboxIndex = lightboxItem ? completedItems.findIndex(it => it.jobId === lightboxId) : -1;
  useEffect(() => {
    if (!lightboxId) return;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    function onKey(e) {
      const list = completedRef.current;
      if (list.length === 0) return;
      const i = list.findIndex(it => it.jobId === lightboxId);
      if (e.key === "ArrowRight") setLightboxId(list[(i + 1) % list.length].jobId);
      else if (e.key === "ArrowLeft") setLightboxId(list[(i - 1 + list.length) % list.length].jobId);
      else if (e.key === "Escape") setLightboxId(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxId]);

  // Roles que aceitam múltiplos uploads (image, video, audio em alguns modelos)
  const MULTI_ROLES = ["image", "video", "audio"];
  const isMulti = (role) => MULTI_ROLES.includes(role);

  // Upload em 3 passos: pede URL → PUT direto pro S3 → confirma.
  // medias[role] sempre é array de slots — para roles single-only (start_image/end_image) o array tem max 1.
  async function uploadMedia(role, file) {
    const slotId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newSlot = { id: slotId, preview: URL.createObjectURL(file), filename: file.name, uploading: true };
    setMedias(prev => {
      const list = prev[role] || [];
      const next = isMulti(role) ? [...list, newSlot] : [newSlot];
      return { ...prev, [role]: next };
    });
    try {
      const r1 = await fetch(`${API}/api/hf/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      if (r1.status === 401) { setAuthenticated(false); return; }
      const d1 = await r1.json();
      if (!r1.ok) throw new Error(d1.error || `upload-url HTTP ${r1.status}`);

      const putRes = await fetch(d1.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || d1.contentType },
        body: file,
      });
      if (!putRes.ok) {
        const t = await putRes.text().catch(() => "");
        throw new Error(`PUT falhou ${putRes.status}: ${t.slice(0, 120)}`);
      }

      const r3 = await fetch(`${API}/api/hf/upload-confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: d1.mediaId, contentType: file.type }),
      });
      const d3 = await r3.json();
      if (!r3.ok) throw new Error(d3.error || `confirm HTTP ${r3.status}`);

      // Atualiza só o slot correspondente pelo id
      setMedias(prev => ({
        ...prev,
        [role]: (prev[role] || []).map(s => s.id === slotId ? { ...s, mediaId: d1.mediaId, uploading: false } : s),
      }));
    } catch (err) {
      setMedias(prev => ({
        ...prev,
        [role]: (prev[role] || []).map(s => s.id === slotId ? { ...s, uploading: false, error: err.message } : s),
      }));
    }
  }
  function removeMedia(role, slotId) {
    setMedias(prev => {
      const list = (prev[role] || []).filter(s => s.id !== slotId);
      const next = { ...prev };
      if (list.length === 0) delete next[role]; else next[role] = list;
      return next;
    });
  }

  // Validation
  const allSlots = Object.values(medias).flat();
  const anyUploading = allSlots.some(s => s?.uploading);
  const anyError     = allSlots.some(s => s?.error);
  const canGenerate  = !!prompt.trim() && !anyUploading && !anyError;

  async function generate() {
    if (!canGenerate) return;
    setError(null);
    try {
      const body = { model, prompt, aspect_ratio: aspectRatio };
      if (duration) body.duration = duration;
      for (const [k, v] of Object.entries(extras)) {
        // Pula params marcados como uiOnly (MCP os descarta, evitamos lixo no body)
        if (selectedModel.params?.[k]?.uiOnly) continue;
        if (v !== undefined && v !== null && v !== "") body[k] = v;
      }
      const mediaList = Object.entries(medias).flatMap(([role, slots]) =>
        (slots || []).filter(s => s.mediaId).map(s => ({ value: s.mediaId, role }))
      );
      if (mediaList.length > 0) body.medias = mediaList;
      const r = await fetch(`${API}/api/hf/video`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json();
      if (r.status === 401 || data.error === "auth_required") { setAuthenticated(false); return; }
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const ids = data.jobIds || (data.jobId ? [data.jobId] : []);
      const ts = Date.now();
      const newItems = ids.map(jobId => ({
        jobId, status: "queued", url: null,
        aspectRatio, duration, extras: { ...extras },
        model: selectedModel.name, prompt, ts,
      }));
      setItems(prev => [...newItems, ...prev]);
    } catch (err) { setError(err.message); }
  }

  function downloadVideo(url, i) {
    const filename = `higgsfield-video-${Date.now()}-${i + 1}.mp4`;
    const proxy = `${API}/api/hf/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(filename)}`;
    const a = document.createElement("a"); a.href = proxy; a.download = filename; a.click();
  }
  function toggleFavorite(url) { setFavorites(prev => { const n = new Set(prev); n.has(url) ? n.delete(url) : n.add(url); return n; }); }
  function copyText(text) { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  function clearItems() {
    const hasPending = items.some(it => it.status !== "completed" && it.status !== "failed" && it.status !== "nsfw");
    if (hasPending && !window.confirm("Há vídeos sendo gerados. Limpar mesmo assim?")) return;
    setItems([]);
  }

  const favCount = items.filter(it => it.url && favorites.has(it.url)).length;

  // Histórico agrupado por dia
  const grouped = items.reduce((acc, it) => {
    const key = fmtDateHeader(it.ts);
    if (!acc[key]) acc[key] = [];
    acc[key].push(it);
    return acc;
  }, {});

  // Auth screens
  if (authenticated === false) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-8" style={{ background: "#0a0a0c", color: "#edecea" }}>
        <button onClick={() => navigate("/")} className="absolute left-5 top-5 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[.04] text-white/40 hover:text-white transition">
          <Icon name="arrow_left" cls="h-3.5 w-3.5" />
        </button>
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl text-4xl" style={{ background: `rgba(${RGB},.1)`, border: `1px solid rgba(${RGB},.2)` }}>🎞️</div>
        <div className="text-center">
          <div className="text-xl font-bold tracking-tight">Conecte sua conta Higgsfield</div>
          <div className="mt-2 max-w-xs text-sm leading-relaxed" style={{ color: "rgba(255,255,255,.4)" }}>
            Para gerar vídeos com Kling, Seedance, Veo e outros modelos.
          </div>
        </div>
        <button onClick={connectHiggsfield} className="flex items-center gap-2.5 rounded-2xl px-7 py-3.5 text-sm font-bold transition hover:opacity-90" style={{ background: ACCENT, color: ACCENT_DARK }}>
          <Icon name="zap" cls="h-4 w-4" />
          Conectar Higgsfield
        </button>
      </div>
    );
  }
  if (authenticated === null) return (<div className="flex h-screen items-center justify-center" style={{ background: "#0a0a0c" }}><div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: ACCENT }} /></div>);

  // ---- Auxiliar: pill ref helper ----
  const setPillRef = (key) => (el) => { pillRefs.current[key] = el; };

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: "#0a0a0c" }}>
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b px-5 py-3" style={{ borderColor: "rgba(255,255,255,.05)", background: "rgba(10,10,12,.92)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[.04] text-white/40 hover:text-white transition">
            <Icon name="arrow_left" cls="h-3.5 w-3.5" />
          </button>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg text-base" style={{ background: `rgba(${RGB},.15)` }}>🎞️</div>
          <div>
            <div className="text-sm font-bold tracking-tight">Video Studio</div>
            <div className="text-[9px] font-mono tracking-widest" style={{ color: `rgba(${RGB},.6)` }}>HIGGSFIELD AI</div>
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          {favCount > 0 && (
            <button
              onClick={() => items.filter(it => it.url && favorites.has(it.url)).forEach((it, i) => downloadVideo(it.url, i))}
              title="Baixar todas favoritas"
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition"
              style={{ borderColor: `rgba(${RGB},.4)`, background: `rgba(${RGB},.12)`, color: ACCENT }}
            >
              <Icon name="download" cls="h-3 w-3" />
              Favoritas ({favCount})
            </button>
          )}
          {items.length > 0 && (
            <button onClick={clearItems} title="Limpar histórico" className="flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/[.04] px-3 text-[11px] font-semibold text-white/40 hover:text-white/70 transition">
              Limpar ({items.length})
            </button>
          )}
        </div>
      </header>

      {/* 3-col body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* ================= LEFT: controles ================= */}
        <aside className="flex shrink-0 flex-col border-r" style={{ width: 320, minWidth: 320, maxWidth: 320, borderColor: "rgba(255,255,255,.05)" }}>
          {/* SCROLLABLE TOP */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="flex flex-col gap-3">

              {/* Thumb do modelo (arte do Kling/Seedance) */}
              <button
                onClick={() => setOpenModel(o => !o)}
                className="relative overflow-hidden rounded-xl border text-left transition hover:opacity-95"
                style={{
                  aspectRatio: "16 / 7",
                  borderColor: "rgba(255,255,255,.06)",
                  background: "#000",
                }}
                title={selectedModel.desc}
              >
                {selectedModel.thumb?.image && (
                  <img
                    src={selectedModel.thumb.image}
                    alt={selectedModel.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-between p-3">
                  <div className="flex justify-end">
                    <span className="flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[10px] font-semibold text-white/90 backdrop-blur">
                      <Icon name="pencil" cls="h-3 w-3" />
                      Change
                    </span>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-white/90">{selectedModel.name}</div>
                    <div className="mt-0.5 truncate text-[9px] text-white/55">{selectedModel.desc}</div>
                  </div>
                </div>
              </button>

              {(() => {
                const hasFrames = selectedModel.medias.some(r => r === "start_image" || r === "end_image");
                const hasElement = selectedModel.medias.includes("image");
                const showTabs = hasFrames && hasElement;
                const effectiveTab = showTabs ? mediaTab : (hasFrames ? "frames" : "elements");

                return (
                  <>
                    {/* Tab toggle Elements/Frames */}
                    {showTabs && (
                      <div className="flex gap-1 rounded-xl bg-white/[.03] p-1">
                        <button
                          onClick={() => setMediaTab("elements")}
                          className="flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition"
                          style={{
                            background: effectiveTab === "elements" ? "rgba(255,255,255,.08)" : "transparent",
                            color: effectiveTab === "elements" ? "#fff" : "rgba(255,255,255,.45)",
                          }}
                        >Elements</button>
                        <button
                          onClick={() => setMediaTab("frames")}
                          className="flex-1 rounded-lg py-1.5 text-[11px] font-semibold transition"
                          style={{
                            background: effectiveTab === "frames" ? "rgba(255,255,255,.08)" : "transparent",
                            color: effectiveTab === "frames" ? "#fff" : "rgba(255,255,255,.45)",
                          }}
                        >Frames</button>
                      </div>
                    )}

                    {/* Frames — start/end com 1 slot cada */}
                    {effectiveTab === "frames" && hasFrames && (() => {
                      const startSlot = medias.start_image?.[0];
                      const endSlot   = medias.end_image?.[0];
                      return (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          {selectedModel.medias.includes("start_image") && (
                            <FrameSlot
                              role="start_image"
                              slot={startSlot}
                              onUpload={uploadMedia}
                              onRemove={() => startSlot && removeMedia("start_image", startSlot.id)}
                              optional={false}
                            />
                          )}
                          {selectedModel.medias.includes("end_image") && (
                            <FrameSlot
                              role="end_image"
                              slot={endSlot}
                              onUpload={uploadMedia}
                              onRemove={() => endSlot && removeMedia("end_image", endSlot.id)}
                              optional={true}
                            />
                          )}
                        </div>
                      );
                    })()}

                    {/* Elements: image, video e audio aceitam múltiplos uploads (até 4 cada). Slots compactos. */}
                    {effectiveTab === "elements" && hasElement && (() => {
                      const MAX = 4;
                      const renderRoleGroup = (role, label) => {
                        if (!selectedModel.medias.includes(role)) return null;
                        const slots = medias[role] || [];
                        return (
                          <div key={role}>
                            {label && <div className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-white/30">{label}</div>}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
                              {slots.map(slot => (
                                <FrameSlot
                                  key={slot.id}
                                  role={role}
                                  slot={slot}
                                  onUpload={uploadMedia}
                                  onRemove={() => removeMedia(role, slot.id)}
                                  compact
                                />
                              ))}
                              {slots.length < MAX && (
                                <FrameSlot
                                  role={role}
                                  slot={undefined}
                                  onUpload={uploadMedia}
                                  onRemove={() => {}}
                                  optional={false}
                                  compact
                                />
                              )}
                            </div>
                          </div>
                        );
                      };
                      return (
                        <div className="flex flex-col gap-3">
                          {renderRoleGroup("image", null)}
                          {renderRoleGroup("video", "Video")}
                          {renderRoleGroup("audio", "Audio")}
                        </div>
                      );
                    })()}
                  </>
                );
              })()}

              {/* Prompt CARD */}
              <div className="relative rounded-xl border p-2.5" style={{ borderColor: "rgba(255,255,255,.08)", background: "rgba(255,255,255,.02)" }}>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={handlePromptChange}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
                    if (e.key === "Escape" && pickerOpen) { setPickerOpen(false); e.preventDefault(); }
                  }}
                  placeholder='Describe your video, use @ to reference uploaded elements'
                  rows={3}
                  className="w-full resize-none bg-transparent text-[11px] text-white placeholder-white/25 outline-none overflow-y-auto"
                  style={{ fontFamily: "inherit" }}
                />

                {/* Picker de @-mentions */}
                {pickerOpen && (
                  <div
                    ref={pickerRef}
                    className="absolute bottom-full left-0 right-0 z-30 mb-2 max-h-64 overflow-y-auto rounded-xl border p-1 shadow-2xl"
                    style={{ borderColor: "rgba(255,255,255,.1)", background: "rgba(15,15,18,.98)", backdropFilter: "blur(20px)" }}
                  >
                    {filteredElements.length === 0 ? (
                      <div className="p-3 text-center text-[11px] text-white/35">
                        {elements.length === 0 ? "Sem elementos. Suba uma imagem/vídeo/áudio nos slots acima." : "Nenhum match"}
                      </div>
                    ) : (
                      filteredElements.map(el => (
                        <button
                          key={el.slot.id}
                          onClick={() => insertElement(el.name)}
                          className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-white/[.06] transition"
                        >
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-white/[.04] flex items-center justify-center">
                            {el.role === "video" ? (
                              <video src={el.slot.preview} muted className="h-full w-full object-cover" />
                            ) : el.role === "audio" ? (
                              <Icon name="audio" cls="h-4 w-4 text-white/60" />
                            ) : (
                              <img src={el.slot.preview} alt="" className="h-full w-full object-cover" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-mono text-[11px] font-semibold text-white">@{el.name}</div>
                            <div className="text-[9px] uppercase tracking-wider text-white/35">{el.role}</div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {/* Toolbar inferior do prompt */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {/* Sound toggle — primeiro pra modelos com áudio */}
                  {selectedModel.params?.sound && (
                    <button
                      onClick={() => setExtras(prev => ({ ...prev, sound: !prev.sound }))}
                      className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition"
                      style={{
                        borderColor: extras.sound ? `rgba(${RGB},.4)` : "rgba(255,255,255,.1)",
                        background: extras.sound ? `rgba(${RGB},.08)` : "rgba(255,255,255,.04)",
                      }}
                      title={extras.sound ? "Áudio ativado" : "Áudio desligado"}
                    >
                      <Icon name={extras.sound ? "audio" : "audio_off"} cls="h-3 w-3" style={{ color: extras.sound ? ACCENT : "rgba(255,255,255,.55)" }} />
                      <span className="text-[11px] font-semibold" style={{ color: extras.sound ? ACCENT : "rgba(255,255,255,.6)" }}>
                        Sound {extras.sound ? "on" : "off"}
                      </span>
                    </button>
                  )}
                  {/* @ Elements — abre picker pra referenciar uploads no prompt */}
                  {selectedModel.medias.length > 0 && (
                    <button
                      onClick={openElementsPicker}
                      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.04] px-2.5 py-1 text-white/70 hover:text-white hover:bg-white/[.08] transition"
                      title={elements.length === 0 ? "Suba elementos primeiro" : "Referenciar elemento no prompt"}
                    >
                      <span className="font-mono text-[12px] leading-none">@</span>
                      <span className="text-[11px] font-semibold">Elements</span>
                      {elements.length > 0 && (
                        <span className="rounded-full bg-white/[.1] px-1.5 py-px font-mono text-[9px] text-white/60">{elements.length}</span>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Model section */}
              <div>
                <div className="mb-1.5 text-[10px] text-white/40">Model</div>
                <div ref={modelRef} className="relative">
                  <button
                    onClick={() => setOpenModel(o => !o)}
                    className="flex w-full items-center gap-2 rounded-xl border px-3 py-2 transition"
                    style={{
                      borderColor: openModel ? `rgba(${RGB},.4)` : "rgba(255,255,255,.08)",
                      background: openModel ? `rgba(${RGB},.06)` : "rgba(255,255,255,.03)",
                    }}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold" style={{ background: `rgba(${RGB},.18)`, color: ACCENT }}>{selectedModel.name.charAt(0)}</span>
                    <span className="min-w-0 flex-1 truncate text-left text-[12px] font-semibold text-white">{selectedModel.name}</span>
                    <Icon name="chevron_down" cls="h-3.5 w-3.5 text-white/40" />
                  </button>
                  {openModel && (
                    <div className="absolute left-0 top-full z-30 mt-1.5 w-full max-h-72 overflow-y-auto rounded-xl border p-1 shadow-2xl" style={{ borderColor: "rgba(255,255,255,.1)", background: "rgba(15,15,18,.98)", backdropFilter: "blur(20px)" }}>
                      {MODELS.map(m => (
                        <button key={m.id} onClick={() => { setModel(m.id); setOpenModel(false); }} className="flex w-full items-start gap-2 rounded-lg p-2 text-left transition hover:bg-white/[.05]" style={{ background: model === m.id ? `rgba(${RGB},.08)` : "transparent" }}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-[11px] font-semibold text-white/90">{m.name}</span>
                              <span className="shrink-0 rounded px-1 py-0.5 font-mono text-[8px]" style={{ background: `rgba(${RGB},.12)`, color: `rgba(${RGB},.85)` }}>{m.tag}</span>
                            </div>
                            <div className="mt-0.5 text-[9px] leading-tight text-white/35">{m.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Pills row 3-em-linha: Duration · Aspect · Resolution */}
              <div className="grid grid-cols-3 gap-1.5">
              {/* Duration */}
              <div ref={setPillRef("duration")}>
                <ParamPill
                  fullWidth
                  open={openPill === "duration"}
                  onToggle={() => setOpenPill(openPill === "duration" ? null : "duration")}
                  icon="clock"
                  value={`${duration}s`}
                  color={ACCENT}
                  popoverWidth={200}
                >
                  {(() => {
                    const dur = selectedModel.duration;
                    if (!dur) return null;
                    if (dur.discrete) {
                      const idx = Math.max(0, dur.discrete.indexOf(duration));
                      return (
                        <div>
                          <div className="mb-1 flex justify-between font-mono text-[9px] text-white/40"><span>Duração</span><span style={{ color: ACCENT }}>{duration}s</span></div>
                          <input type="range" min={0} max={dur.discrete.length - 1} step={1} value={idx} onChange={e => setDuration(dur.discrete[parseInt(e.target.value, 10)])} className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10" style={{ accentColor: ACCENT }} />
                          <div className="mt-1 flex justify-between font-mono text-[8px] text-white/30">{dur.discrete.map(d => <span key={d}>{d}s</span>)}</div>
                        </div>
                      );
                    }
                    const [mn, mx] = dur.range;
                    return (
                      <div>
                        <div className="mb-1 flex justify-between font-mono text-[9px] text-white/40"><span>Duração</span><span style={{ color: ACCENT }}>{duration}s</span></div>
                        <input type="range" min={mn} max={mx} step={1} value={duration} onChange={e => setDuration(parseInt(e.target.value, 10))} className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10" style={{ accentColor: ACCENT }} />
                        <div className="mt-1 flex justify-between font-mono text-[8px] text-white/30"><span>{mn}s</span><span>{mx}s</span></div>
                      </div>
                    );
                  })()}
                </ParamPill>
              </div>

              {/* Aspect */}
              <div ref={setPillRef("aspect")}>
                <ParamPill
                  fullWidth
                  open={openPill === "aspect"}
                  onToggle={() => setOpenPill(openPill === "aspect" ? null : "aspect")}
                  icon="monitor"
                  value={aspectRatio}
                  popoverWidth={180}
                >
                  <div className="grid grid-cols-3 gap-1">
                    {selectedModel.aspectRatios.map(ar => (
                      <button
                        key={ar}
                        onClick={() => { setAspectRatio(ar); setOpenPill(null); }}
                        className="rounded-md border px-2 py-1 font-mono text-[10px] transition"
                        style={{
                          borderColor: aspectRatio === ar ? `rgba(${RGB},.4)` : "rgba(255,255,255,.06)",
                          background: aspectRatio === ar ? `rgba(${RGB},.12)` : "rgba(255,255,255,.02)",
                          color: aspectRatio === ar ? "#fff" : "rgba(255,255,255,.6)",
                        }}
                      >{ar}</button>
                    ))}
                  </div>
                </ParamPill>
              </div>

              {/* Resolution OU Mode-com-optionLabels (Kling 3.0 usa mode como resolução real) */}
              {selectedModel.params?.resolution && (
                <div ref={setPillRef("resolution")}>
                  <ParamPill
                    fullWidth
                    open={openPill === "resolution"}
                    onToggle={() => setOpenPill(openPill === "resolution" ? null : "resolution")}
                    icon="diamond"
                    value={extras.resolution || "—"}
                    color={ACCENT}
                    popoverWidth={180}
                  >
                    <div className="flex gap-1">
                      {selectedModel.params.resolution.options.map(r => (
                        <button
                          key={r}
                          onClick={() => { setExtras(prev => ({ ...prev, resolution: r })); setOpenPill(null); }}
                          className="flex-1 rounded-md border px-2 py-1 font-mono text-[10px] uppercase transition"
                          style={{
                            borderColor: extras.resolution === r ? `rgba(${RGB},.4)` : "rgba(255,255,255,.06)",
                            background: extras.resolution === r ? `rgba(${RGB},.12)` : "rgba(255,255,255,.02)",
                            color: extras.resolution === r ? "#fff" : "rgba(255,255,255,.6)",
                          }}
                        >{r}</button>
                      ))}
                    </div>
                  </ParamPill>
                </div>
              )}
              {!selectedModel.params?.resolution && selectedModel.params?.mode?.optionLabels && (
                <div ref={setPillRef("mode_as_res")}>
                  <ParamPill
                    fullWidth
                    open={openPill === "mode_as_res"}
                    onToggle={() => setOpenPill(openPill === "mode_as_res" ? null : "mode_as_res")}
                    icon="diamond"
                    value={selectedModel.params.mode.optionLabels[extras.mode] || extras.mode || "—"}
                    color={ACCENT}
                    popoverWidth={180}
                  >
                    <div className="flex gap-1">
                      {selectedModel.params.mode.options.map(m => (
                        <button
                          key={m}
                          onClick={() => { setExtras(prev => ({ ...prev, mode: m })); setOpenPill(null); }}
                          className="flex-1 rounded-md border px-2 py-1 font-mono text-[10px] uppercase transition"
                          style={{
                            borderColor: extras.mode === m ? `rgba(${RGB},.4)` : "rgba(255,255,255,.06)",
                            background: extras.mode === m ? `rgba(${RGB},.12)` : "rgba(255,255,255,.02)",
                            color: extras.mode === m ? "#fff" : "rgba(255,255,255,.6)",
                          }}
                        >{selectedModel.params.mode.optionLabels[m] || m}</button>
                      ))}
                    </div>
                  </ParamPill>
                </div>
              )}
              </div>{/* /grid-cols-3 */}

              {/* Pills extras (mode/genre/quality) — só renderiza mode aqui se não tiver optionLabels (esse caso já vai pra Resolução) */}
              {((selectedModel.params?.mode && !selectedModel.params.mode.optionLabels) || selectedModel.params?.genre || selectedModel.params?.quality) && (
              <div className="flex flex-wrap gap-1.5">
              {/* Mode */}
              {selectedModel.params?.mode && !selectedModel.params.mode.optionLabels && (
                <div ref={setPillRef("mode")}>
                  <ParamPill
                    open={openPill === "mode"}
                    onToggle={() => setOpenPill(openPill === "mode" ? null : "mode")}
                    icon="sliders"
                    value={(extras.mode || "—").toUpperCase()}
                    popoverWidth={180}
                  >
                    <div className="flex gap-1">
                      {selectedModel.params.mode.options.map(m => (
                        <button
                          key={m}
                          onClick={() => { setExtras(prev => ({ ...prev, mode: m })); setOpenPill(null); }}
                          className="flex-1 rounded-md border px-2 py-1 font-mono text-[10px] uppercase transition"
                          style={{
                            borderColor: extras.mode === m ? `rgba(${RGB},.4)` : "rgba(255,255,255,.06)",
                            background: extras.mode === m ? `rgba(${RGB},.12)` : "rgba(255,255,255,.02)",
                            color: extras.mode === m ? "#fff" : "rgba(255,255,255,.6)",
                          }}
                        >{m}</button>
                      ))}
                    </div>
                  </ParamPill>
                </div>
              )}

              {/* Genre (Seedance 2.0) */}
              {selectedModel.params?.genre && (
                <div ref={setPillRef("genre")}>
                  <ParamPill
                    open={openPill === "genre"}
                    onToggle={() => setOpenPill(openPill === "genre" ? null : "genre")}
                    icon="sliders"
                    value={extras.genre || "—"}
                    popoverWidth={220}
                  >
                    <div className="grid grid-cols-2 gap-1">
                      {selectedModel.params.genre.options.map(g => (
                        <button
                          key={g}
                          onClick={() => { setExtras(prev => ({ ...prev, genre: g })); setOpenPill(null); }}
                          className="rounded-md border px-2 py-1 font-mono text-[10px] transition"
                          style={{
                            borderColor: extras.genre === g ? `rgba(${RGB},.4)` : "rgba(255,255,255,.06)",
                            background: extras.genre === g ? `rgba(${RGB},.12)` : "rgba(255,255,255,.02)",
                            color: extras.genre === g ? "#fff" : "rgba(255,255,255,.6)",
                          }}
                        >{g}</button>
                      ))}
                    </div>
                  </ParamPill>
                </div>
              )}

              {/* Quality (Veo) */}
              {selectedModel.params?.quality && (
                <div ref={setPillRef("quality")}>
                  <ParamPill
                    open={openPill === "quality"}
                    onToggle={() => setOpenPill(openPill === "quality" ? null : "quality")}
                    icon="sliders"
                    value={extras.quality || "—"}
                    popoverWidth={200}
                  >
                    <div className="flex gap-1">
                      {selectedModel.params.quality.options.map(q => (
                        <button
                          key={q}
                          onClick={() => { setExtras(prev => ({ ...prev, quality: q })); setOpenPill(null); }}
                          className="flex-1 rounded-md border px-2 py-1 font-mono text-[10px] transition"
                          style={{
                            borderColor: extras.quality === q ? `rgba(${RGB},.4)` : "rgba(255,255,255,.06)",
                            background: extras.quality === q ? `rgba(${RGB},.12)` : "rgba(255,255,255,.02)",
                            color: extras.quality === q ? "#fff" : "rgba(255,255,255,.6)",
                          }}
                        >{q}</button>
                      ))}
                    </div>
                  </ParamPill>
                </div>
              )}
              </div>
              )}{/* /pills extras */}
            </div>
          </div>

          {/* Generate button — sticky no fim */}
          <div className="shrink-0 border-t p-3" style={{ borderColor: "rgba(255,255,255,.05)" }}>
            <button
              onClick={generate}
              disabled={!canGenerate}
              className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: ACCENT, color: ACCENT_DARK }}
            >
              {anyUploading ? "Aguardando upload" : "Generate"}
              {!anyUploading && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z"/>
                </svg>
              )}
            </button>
            <div className="mt-1.5 text-center text-[9px] font-mono text-white/25">
              {!prompt.trim() ? "Escreva o prompt pra liberar Generate" : anyUploading ? "Aguarde upload terminar" : "⌘ + Enter"}
            </div>
          </div>
        </aside>

        {/* ================= MAIN: feed [video | info] paralelo ================= */}
        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {error && (
            <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/15 px-4 py-2.5 text-xs text-red-300 backdrop-blur">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-300/60 hover:text-red-300">
                <Icon name="close" cls="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="h-16 w-16 rounded-2xl border flex items-center justify-center" style={{ borderColor: `rgba(${RGB},.15)`, background: `rgba(${RGB},.06)` }}>
                  <Icon name="video" cls="h-6 w-6" style={{ color: `rgba(${RGB},.5)` }} />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-white/50">Nenhum vídeo ainda</div>
                  <div className="mt-0.5 text-[11px] text-white/25">Configure ao lado e clique Generate</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="mx-auto flex max-w-6xl flex-col gap-6">
                {Object.entries(grouped).map(([day, list]) => (
                  <div key={day} className="flex flex-col gap-3">
                    <div className="px-1 text-[9px] font-mono uppercase tracking-widest text-white/30">{day}</div>
                    {list.map(item => {
                      const isFav = item.url && favorites.has(item.url);
                      const ratio = (item.aspectRatio === "auto" ? "16:9" : (item.aspectRatio || "16:9")).replace(":", " / ");
                      return (
                        <div key={item.jobId} className="flex items-stretch gap-3">
                          {/* Vídeo */}
                          <div className="relative flex-1 overflow-hidden rounded-2xl border" style={{ borderColor: "rgba(255,255,255,.06)", background: "#000" }}>
                            {item.url ? (
                              <>
                                <video
                                  src={item.url}
                                  controls
                                  preload="metadata"
                                  playsInline
                                  className="h-full w-full object-contain"
                                  style={{ maxHeight: "70vh", aspectRatio: ratio }}
                                />
                                <div className="absolute right-2 top-2 flex gap-1">
                                  <button
                                    onClick={() => toggleFavorite(item.url)}
                                    title={isFav ? "Remover das favoritas" : "Favoritar"}
                                    className="flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition"
                                    style={{
                                      borderColor: isFav ? `rgba(${RGB},.6)` : "rgba(255,255,255,.2)",
                                      background:  isFav ? `rgba(${RGB},.85)` : "rgba(0,0,0,.5)",
                                      color:       isFav ? ACCENT_DARK : "rgba(255,255,255,.85)",
                                    }}
                                  >
                                    <Icon name={isFav ? "heart_filled" : "heart"} cls="h-3.5 w-3.5" />
                                  </button>
                                  <button onClick={() => downloadVideo(item.url, 0)} title="Baixar" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur transition hover:bg-white/20">
                                    <Icon name="download" cls="h-3.5 w-3.5" />
                                  </button>
                                  <button onClick={() => setLightboxId(item.jobId)} title="Tela cheia" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur transition hover:bg-white/20">
                                    <Icon name="expand" cls="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </>
                            ) : item.status === "failed" || item.status === "nsfw" ? (
                              <div className="flex flex-col items-center justify-center gap-2 p-6 text-center" style={{ aspectRatio: ratio }}>
                                <div className="h-10 w-10 rounded-full bg-red-500/15 flex items-center justify-center">
                                  <Icon name="close" cls="h-5 w-5 text-red-400" />
                                </div>
                                <div className="text-[11px] font-semibold text-red-400">{item.status === "nsfw" ? "Conteúdo bloqueado" : "Geração falhou"}</div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-3 p-6" style={{ aspectRatio: ratio }}>
                                <div className="relative h-12 w-12">
                                  <div className="absolute inset-0 rounded-full border-2 border-white/5" />
                                  <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: ACCENT }} />
                                </div>
                                <StatusBadge status={item.status} />
                                <div className="text-[10px] font-mono text-white/30">{item.model} · {item.duration}s</div>
                              </div>
                            )}
                          </div>

                          {/* Info card paralelo */}
                          <div className="flex w-[240px] shrink-0 flex-col gap-2 rounded-2xl border p-3" style={{ borderColor: "rgba(255,255,255,.06)", background: "rgba(255,255,255,.02)" }}>
                            <div className="flex items-center gap-1.5">
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold" style={{ background: `rgba(${RGB},.18)`, color: ACCENT }}>{item.model.charAt(0)}</span>
                              <span className="truncate text-[12px] font-semibold text-white">{item.model}</span>
                              {isFav && <Icon name="heart_filled" cls="h-3 w-3" style={{ color: ACCENT }} />}
                            </div>
                            <div className="flex-1 overflow-y-auto text-[11px] leading-snug text-white/55" style={{ maxHeight: "180px" }}>
                              {item.prompt}
                            </div>
                            <button
                              onClick={() => copyText(item.prompt)}
                              className="flex items-center gap-1 self-start rounded-full border border-white/8 bg-white/[.03] px-2 py-0.5 text-[9px] text-white/45 hover:text-white/80 transition"
                            >
                              <Icon name="copy" cls="h-2.5 w-2.5" />
                              Copiar prompt
                            </button>
                            <div className="flex flex-wrap gap-1">
                              {item.duration && <span className="rounded-full border border-white/8 bg-white/[.03] px-1.5 py-0.5 font-mono text-[9px] text-white/55">{item.duration}s</span>}
                              {item.aspectRatio && <span className="rounded-full border border-white/8 bg-white/[.03] px-1.5 py-0.5 font-mono text-[9px] text-white/55">{item.aspectRatio}</span>}
                              {item.extras?.resolution && <span className="rounded-full border border-white/8 bg-white/[.03] px-1.5 py-0.5 font-mono text-[9px] text-white/55">{item.extras.resolution}</span>}
                              {item.extras?.mode && <span className="rounded-full border border-white/8 bg-white/[.03] px-1.5 py-0.5 font-mono text-[9px] uppercase text-white/55">{item.extras.mode}</span>}
                              {item.extras?.sound !== undefined && (
                                <span className="rounded-full border border-white/8 bg-white/[.03] px-1.5 py-0.5 font-mono text-[9px] text-white/55">
                                  {item.extras.sound ? "Audio on" : "Audio off"}
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[9px] text-white/30">
                              {fmtDateHeader(item.ts)} · {fmtTime(item.ts)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Lightbox */}
      {lightboxItem && (() => {
        const isFav = favorites.has(lightboxItem.url);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={() => setLightboxId(null)}>
            <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/40 px-3 py-1 font-mono text-[11px] text-white/70 backdrop-blur">
              {lightboxIndex + 1} / {completedItems.length}
            </div>
            <button onClick={(e) => { e.stopPropagation(); setLightboxId(null); }} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white hover:bg-white/10 transition">
              <Icon name="close" cls="h-4 w-4" />
            </button>
            <video key={lightboxItem.jobId} src={lightboxItem.url} controls autoPlay loop playsInline className="max-h-[88vh] max-w-[90vw] rounded-2xl" style={{ background: "#000" }} onClick={e => e.stopPropagation()} />
            <div className="absolute bottom-4 right-4 flex gap-2" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => toggleFavorite(lightboxItem.url)}
                className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold backdrop-blur transition"
                style={{ borderColor: isFav ? `rgba(${RGB},.6)` : "rgba(255,255,255,.2)", background: isFav ? `rgba(${RGB},.85)` : "rgba(0,0,0,.6)", color: isFav ? ACCENT_DARK : "#fff" }}
              >
                <Icon name={isFav ? "heart_filled" : "heart"} cls="h-3.5 w-3.5" />
                {isFav ? "Favoritada" : "Favoritar"}
              </button>
              <button onClick={() => downloadVideo(lightboxItem.url, lightboxIndex)} className="flex items-center gap-2 rounded-xl border border-white/20 bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/10 transition">
                <Icon name="download" cls="h-3.5 w-3.5" />
                Download
              </button>
            </div>
            <div className="absolute inset-x-0 bottom-4 mx-auto w-fit pointer-events-none">
              <div className="rounded-full bg-black/40 px-3 py-1 font-mono text-[10px] text-white/40 backdrop-blur">← → para navegar · Esc para fechar</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
