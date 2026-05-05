import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const ACCENT = "#e879f9";
const RGB    = "232,121,249";
const DARK   = "#1a0022";

const MODELS = [
  { id: "nano_banana_flash", name: "Nano Banana 2",  tag: "RÁPIDO",    desc: "Geração rápida, alta qualidade",           res: ["1k","2k","4k"] },
  { id: "nano_banana_2",     name: "Nano Banana Pro", tag: "4K",       desc: "Máxima qualidade, texto e diagramas",      res: ["1k","2k","4k"] },
  { id: "soul_2",            name: "Soul 2.0",        tag: "PERSONAGEM", desc: "UGC, fashion, editorial, retratos",      res: [] },
  { id: "soul_cinematic",    name: "Soul Cinema",     tag: "CINEMA",   desc: "Stills cinematográficos e concept art",    res: [] },
  { id: "seedream_v4_5",     name: "Seedream 4.5",    tag: "EDIÇÃO",   desc: "4K, controle preciso, transformações",    res: ["basic","high"] },
  { id: "flux_2",            name: "Flux 2.0",        tag: "ADERÊNCIA", desc: "Prompt adherence preciso (pro/flex/max)", res: ["1k","2k"] },
  { id: "flux_kontext",      name: "Flux Kontext",    tag: "CONTEXTO", desc: "Context-aware editing e style transfer",  res: [] },
  { id: "z_image",           name: "Z Image",         tag: "FAST",     desc: "Super rápido, estilizado",                res: [] },
];

const ASPECT_RATIOS = ["1:1","16:9","9:16","4:3","3:4","3:2","2:3","4:5","5:4","21:9"];
const MAX_COUNT = 4; // limite do MCP

// Persistência
function loadJSON(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key) || "null"); return v ?? fallback; } catch { return fallback; }
}
function loadFolders() {
  const saved = loadJSON("hf_folders", null);
  if (Array.isArray(saved) && saved.length) {
    // Migra nomes auto-gerados "Job NN" → "Folder NN" (mantém renomeados manuais)
    return saved.map(f => /^Job \d+$/.test(f.name) ? { ...f, name: f.name.replace(/^Job /, "Folder ") } : f);
  }
  return [{ id: "default", name: "Folder 01", ts: Date.now() }];
}
function loadActiveFolder(folders) {
  const id = localStorage.getItem("hf_active_folder");
  if (id && folders.some(f => f.id === id)) return id;
  return folders[0]?.id || "default";
}
function loadItems() {
  const saved = loadJSON("hf_items", []);
  return Array.isArray(saved) ? saved : [];
}
function loadFavorites() {
  return new Set(loadJSON("hf_favorites", []));
}
function nextFolderName(folders) {
  const nums = folders.map(f => {
    const m = f.name.match(/(?:Job|Folder) (\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  });
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `Folder ${String(next).padStart(2, "0")}`;
}

function Icon({ name, cls = "h-4 w-4" }) {
  const p = { className: cls, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" };
  const d = {
    image:    (<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>),
    download: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>),
    heart:        (<><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></>),
    heart_filled: (<><path fill="currentColor" stroke="currentColor" d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></>),
    zap:      (<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>),
    close:    (<><path d="M18 6 6 18m0-12 12 12"/></>),
    arrow_left:(<><path d="M19 12H5M12 5l-7 7 7 7"/></>),
    copy:     (<><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>),
    refresh:  (<><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-8.5"/></>),
    expand:   (<><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>),
    sparkle:  (<><path d="M12 3 L13.5 8.5 L19 10 L13.5 11.5 L12 17 L10.5 11.5 L5 10 L10.5 8.5 Z"/><path d="M5 3l.5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5z"/><path d="M19 15l.5 1.5L21 17l-1.5.5L19 19l-.5-1.5L17 17l1.5-.5z"/></>),
    chevron_down:(<><polyline points="6 9 12 15 18 9"/></>),
    plus:     (<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>),
    minus:    (<><line x1="5" y1="12" x2="19" y2="12"/></>),
    folder:   (<><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></>),
    pencil:   (<><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/></>),
    trash:    (<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>),
    info:     (<><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>),
    monitor:  (<><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>),
    diamond:  (<><path d="M6 3h12l4 6-10 12L2 9z"/></>),
    draw:     (<><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></>),
  };
  return <svg {...p}>{d[name]}</svg>;
}

function Tile({ item, isFav, onToggleFav, onDownload, onExpand, index }) {
  const ratio = (item.aspectRatio || "1:1").replace(":", " / ");
  const baseStyle = { aspectRatio: ratio, borderColor: isFav ? `rgba(${RGB},.5)` : "rgba(255,255,255,.06)" };

  // Pendente — skeleton com shimmer + status
  if (!item.url) {
    return (
      <div className="relative overflow-hidden rounded-2xl border" style={baseStyle}>
        <div
          className="absolute inset-0 animate-pulse"
          style={{ background: `linear-gradient(135deg, rgba(${RGB},.04) 0%, rgba(255,255,255,.02) 50%, rgba(${RGB},.06) 100%)` }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-2 border-white/5" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: ACCENT }} />
          </div>
          <StatusBadge status={item.status} />
          <div className="text-[10px] font-mono text-white/30">{item.model}</div>
        </div>
      </div>
    );
  }

  // Falhou ou bloqueado
  if (item.status === "failed" || item.status === "nsfw") {
    return (
      <div className="relative overflow-hidden rounded-2xl border" style={{ aspectRatio: ratio, borderColor: "rgba(248,113,113,.25)" }}>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4 bg-red-500/5">
          <div className="h-10 w-10 rounded-full bg-red-500/15 flex items-center justify-center">
            <Icon name="close" cls="h-5 w-5 text-red-400" />
          </div>
          <div className="text-[11px] font-semibold text-red-400">
            {item.status === "nsfw" ? "Conteúdo bloqueado" : "Geração falhou"}
          </div>
          <div className="text-[10px] font-mono text-white/30">{item.model}</div>
        </div>
      </div>
    );
  }

  // Concluído
  return (
    <div className="group relative overflow-hidden rounded-2xl border" style={baseStyle}>
      <img
        src={item.url}
        alt={`Generated ${index + 1}`}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ cursor: "pointer" }}
        onClick={onExpand}
      />
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
        title={isFav ? "Remover das favoritas" : "Marcar como favorita"}
        className="absolute left-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur transition"
        style={{
          borderColor: isFav ? `rgba(${RGB},.6)` : "rgba(255,255,255,.2)",
          background: isFav ? `rgba(${RGB},.85)` : "rgba(0,0,0,.5)",
          color: isFav ? DARK : "rgba(255,255,255,.85)",
        }}
      >
        <Icon name={isFav ? "heart_filled" : "heart"} cls="h-4 w-4" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDownload(); }}
        title="Baixar imagem"
        className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur transition hover:bg-white/20"
      >
        <Icon name="download" cls="h-4 w-4" />
      </button>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-end gap-2 p-3 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "linear-gradient(to top, rgba(0,0,0,.7) 0%, transparent 70%)" }}>
        <button
          onClick={(e) => { e.stopPropagation(); onExpand(); }}
          className="flex h-8 items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-3 text-[11px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
        >
          <Icon name="expand" cls="h-3 w-3" />
          Expandir
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    queued:      { label: "Na fila…",     color: "text-yellow-400/70",  bg: "bg-yellow-400/10" },
    in_progress: { label: "Gerando…",     color: "text-fuchsia-400/80", bg: "bg-fuchsia-400/10" },
    completed:   { label: "Concluído",    color: "text-green-400/80",   bg: "bg-green-400/10" },
    failed:      { label: "Falhou",       color: "text-red-400/80",     bg: "bg-red-400/10" },
    nsfw:        { label: "Conteúdo bloqueado", color: "text-red-400/80", bg: "bg-red-400/10" },
  };
  const s = map[status] || map.queued;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold font-mono uppercase tracking-widest ${s.color} ${s.bg}`}>
      {(status === "queued" || status === "in_progress") && (
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      )}
      {s.label}
    </span>
  );
}

export default function ImageStudio() {
  const navigate = useNavigate();
  const [model,       setModel]       = useState("nano_banana_flash");
  const [prompt,      setPrompt]      = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution,  setResolution]  = useState(() => MODELS.find(m => m.id === "nano_banana_flash")?.res[0] || "");
  const [count,       setCount]       = useState(1);
  // Pastas/Jobs e itens persistidos em localStorage
  const [folders,         setFolders]         = useState(loadFolders);
  const [activeFolderId,  setActiveFolderId]  = useState(() => loadActiveFolder(loadFolders()));
  const [items,           setItems]           = useState(loadItems);
  const [error,           setError]           = useState(null);
  const [lightboxId,      setLightboxId]      = useState(null); // jobId da imagem em fullscreen
  const [copied,          setCopied]          = useState(false);
  const [authenticated,   setAuthenticated]   = useState(null);
  const [favorites,       setFavorites]       = useState(loadFavorites);
  const [openPopover,     setOpenPopover]     = useState(null); // 'model' | 'aspect' | 'res' | 'folders' | null
  const [gridCols,        setGridCols]        = useState(() => {
    const v = parseInt(localStorage.getItem("hf_grid_cols") || "3", 10);
    return Math.min(5, Math.max(1, isNaN(v) ? 3 : v));
  });
  const [unlimited,       setUnlimited]       = useState(() => localStorage.getItem("hf_unlimited") === "true");
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingName,     setEditingName]     = useState("");
  const popoverRef = useRef(null);
  const folderPopoverRef = useRef(null);

  // Persistência reativa
  useEffect(() => { localStorage.setItem("hf_folders", JSON.stringify(folders)); }, [folders]);
  useEffect(() => { localStorage.setItem("hf_active_folder", activeFolderId); }, [activeFolderId]);
  useEffect(() => { localStorage.setItem("hf_items", JSON.stringify(items)); }, [items]);
  useEffect(() => { localStorage.setItem("hf_favorites", JSON.stringify([...favorites])); }, [favorites]);
  useEffect(() => { localStorage.setItem("hf_grid_cols", String(gridCols)); }, [gridCols]);
  useEffect(() => { localStorage.setItem("hf_unlimited", String(unlimited)); }, [unlimited]);

  // Click-outside fecha popover (folders tem seu próprio container; bar tem outro)
  useEffect(() => {
    if (!openPopover) return;
    function onClick(e) {
      const ref = openPopover === "folders" ? folderPopoverRef : popoverRef;
      if (ref.current && !ref.current.contains(e.target)) setOpenPopover(null);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openPopover]);

  function toggleFavorite(url) {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  }

  // Folder management
  function createFolder() {
    const id = `f_${Date.now()}`;
    const name = nextFolderName(folders);
    setFolders(prev => [...prev, { id, name, ts: Date.now() }]);
    setActiveFolderId(id);
    // Já abre em modo de edição pra renomear na hora
    setEditingFolderId(id);
    setEditingName(name);
  }
  function startRename(id) {
    const cur = folders.find(f => f.id === id);
    setEditingFolderId(id);
    setEditingName(cur?.name || "");
  }
  function commitRename() {
    if (editingFolderId && editingName.trim()) {
      const id = editingFolderId;
      const name = editingName.trim();
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
    }
    setEditingFolderId(null);
    setEditingName("");
  }
  function cancelRename() {
    setEditingFolderId(null);
    setEditingName("");
  }
  function deleteFolder(id) {
    const cur = folders.find(f => f.id === id);
    const itemCount = items.filter(it => it.folderId === id).length;
    const msg = itemCount > 0
      ? `Excluir folder "${cur?.name}"? Isso apaga ${itemCount} imagem(ns) do histórico local (continuam disponíveis no Higgsfield).`
      : `Excluir folder "${cur?.name}"?`;
    if (!window.confirm(msg)) return;
    setItems(prev => prev.filter(it => it.folderId !== id));
    const remaining = folders.filter(f => f.id !== id);
    if (remaining.length === 0) {
      const fallback = { id: "default", name: "Job 01", ts: Date.now() };
      setFolders([fallback]);
      setActiveFolderId(fallback.id);
    } else {
      setFolders(remaining);
      if (id === activeFolderId) setActiveFolderId(remaining[0].id);
    }
  }

  const itemsRef = useRef(items);
  itemsRef.current = items;

  const visibleItems = items.filter(it => it.folderId === activeFolderId);
  const hasPending = visibleItems.some(it => it.status !== "completed" && it.status !== "failed" && it.status !== "nsfw");
  const favItems = visibleItems.filter(it => it.url && favorites.has(it.url));

  // Lightbox: itens completos da pasta ativa, navegáveis por seta
  const completedItems = visibleItems.filter(it => it.url);
  const completedRef = useRef(completedItems);
  completedRef.current = completedItems;
  const lightboxItem = completedItems.find(it => it.jobId === lightboxId);
  const lightboxIndex = lightboxItem ? completedItems.findIndex(it => it.jobId === lightboxId) : -1;

  // Navegação por teclado quando lightbox aberto
  useEffect(() => {
    if (!lightboxId) return;
    // Tira foco do textarea/input pra setas não moverem cursor lá
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    function onKey(e) {
      const list = completedRef.current;
      if (list.length === 0) return;
      const i = list.findIndex(it => it.jobId === lightboxId);
      if (e.key === "ArrowRight") {
        const next = list[(i + 1) % list.length];
        setLightboxId(next.jobId);
      } else if (e.key === "ArrowLeft") {
        const prev = list[(i - 1 + list.length) % list.length];
        setLightboxId(prev.jobId);
      } else if (e.key === "Escape") {
        setLightboxId(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxId]);

  const selectedModel = MODELS.find(m => m.id === model) || MODELS[0];

  // Verifica auth ao montar e ao voltar de OAuth
  useEffect(() => {
    checkAuth();
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") === "success") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function checkAuth() {
    try {
      const r = await fetch("http://localhost:3001/api/auth/status");
      const d = await r.json();
      setAuthenticated(d.authenticated);
    } catch {
      setAuthenticated(false);
    }
  }

  function connectHiggsfield() {
    window.location.href = "http://localhost:3001/api/auth/login";
  }

  // Polling único — atualiza qualquer item pendente por jobId, sem recriar interval
  useEffect(() => {
    const interval = setInterval(async () => {
      const pending = itemsRef.current.filter(it =>
        it.status !== "completed" && it.status !== "failed" && it.status !== "nsfw"
      );
      if (pending.length === 0) return;
      try {
        const responses = await Promise.all(
          pending.map(it => fetch(`http://localhost:3001/api/hf/job/${it.jobId}`))
        );
        if (responses.some(r => r.status === 401)) {
          setAuthenticated(false);
          return;
        }
        const results = await Promise.all(responses.map(r => r.json()));
        const updates = new Map(pending.map((it, i) => [it.jobId, results[i]]));
        setItems(prev => prev.map(it => {
          const u = updates.get(it.jobId);
          if (!u) return it;
          return { ...it, status: u.status, url: u.images?.[0]?.url || it.url };
        }));
      } catch (e) {
        console.error("Poll error:", e);
      }
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  async function generate() {
    if (!prompt.trim()) return;
    setError(null);
    try {
      const body = { model, prompt, aspect_ratio: aspectRatio, count };
      if (resolution && selectedModel.res.length > 0) body.resolution = resolution;
      const r = await fetch("http://localhost:3001/api/hf/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (r.status === 401 || data.error === "auth_required") {
        setAuthenticated(false);
        return;
      }
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      const ids = data.jobIds || (data.jobId ? [data.jobId] : []);
      const ts = Date.now();
      const newItems = ids.map(jobId => ({
        jobId,
        folderId: activeFolderId,
        status: "queued",
        url: null,
        aspectRatio,
        model: selectedModel.name,
        prompt,
        ts,
      }));
      // Mais novos primeiro
      setItems(prev => [...newItems, ...prev]);
    } catch (err) {
      setError(err.message);
    }
  }

  function clearItems() {
    if (hasPending) {
      if (!window.confirm("Há imagens ainda sendo geradas. Limpar mesmo assim? (elas continuam gerando no Higgsfield)")) return;
    }
    // Só limpa items da pasta ativa
    setItems(prev => prev.filter(it => it.folderId !== activeFolderId));
  }

  function downloadImage(url, i) {
    const filename = `higgsfield-${Date.now()}-${i + 1}.png`;
    const proxy = `http://localhost:3001/api/hf/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(filename)}`;
    const a = document.createElement("a");
    a.href = proxy;
    a.download = filename;
    a.click();
  }

  function copyPrompt() {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Tela de conexão (auth = null = checando, false = precisa conectar)
  if (authenticated === false) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-8" style={{ background: "#0a0a0c", color: "#edecea" }}>
        <button onClick={() => navigate("/")} className="absolute left-5 top-5 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[.04] text-white/40 hover:text-white transition">
          <Icon name="arrow_left" cls="h-3.5 w-3.5" />
        </button>
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl text-4xl" style={{ background: `rgba(${RGB},.1)`, border: `1px solid rgba(${RGB},.2)` }}>
          🖼️
        </div>
        <div className="text-center">
          <div className="text-xl font-bold tracking-tight">Conecte sua conta Higgsfield</div>
          <div className="mt-2 max-w-xs text-sm leading-relaxed" style={{ color: "rgba(255,255,255,.4)" }}>
            Para gerar imagens com Nano Banana, Soul, Seedream e outros modelos, você precisa autenticar com sua conta Higgsfield.
          </div>
        </div>
        <button
          onClick={connectHiggsfield}
          className="flex items-center gap-2.5 rounded-2xl px-7 py-3.5 text-sm font-bold transition hover:opacity-90"
          style={{ background: ACCENT, color: DARK }}
        >
          <Icon name="zap" cls="h-4 w-4" />
          Conectar Higgsfield
        </button>
        <div className="text-center text-[11px]" style={{ color: "rgba(255,255,255,.2)" }}>
          Você será redirecionado para a página de login da Higgsfield
        </div>
      </div>
    );
  }

  if (authenticated === null) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#0a0a0c" }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-transparent" style={{ borderTopColor: ACCENT }} />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: "#0a0a0c" }}>
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b px-5 py-3" style={{ borderColor: "rgba(255,255,255,.05)", background: "rgba(10,10,12,.92)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[.04] text-white/40 hover:text-white transition">
            <Icon name="arrow_left" cls="h-3.5 w-3.5" />
          </button>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg text-base" style={{ background: `rgba(${RGB},.15)` }}>
            🖼️
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">Image Studio</div>
            <div className="text-[9px] font-mono tracking-widest" style={{ color: `rgba(${RGB},.6)` }}>HIGGSFIELD AI</div>
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          {favItems.length > 0 && (
            <button
              onClick={() => favItems.forEach((it, i) => downloadImage(it.url, i))}
              title="Baixar todas favoritas"
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition"
              style={{ borderColor: `rgba(${RGB},.4)`, background: `rgba(${RGB},.12)`, color: ACCENT }}
            >
              <Icon name="download" cls="h-3 w-3" />
              Baixar favoritas ({favItems.length})
            </button>
          )}
          {visibleItems.length > 0 && (
            <button
              onClick={clearItems}
              title="Limpar histórico desta pasta"
              className="flex h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/[.04] px-3 text-[11px] font-semibold text-white/40 hover:text-white/70 transition"
            >
              Limpar ({visibleItems.length})
            </button>
          )}
          {hasPending && <StatusBadge status={visibleItems.find(it => it.status !== "completed" && it.status !== "failed" && it.status !== "nsfw")?.status || "queued"} />}
          <div className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT, boxShadow: `0 0 6px ${ACCENT}` }} />
        </div>
      </header>

      {/* Sub-header: dropdown de pastas (esq) + slider de escala (dir) */}
      <div className="flex shrink-0 items-center gap-3 border-b px-5 py-2.5" style={{ borderColor: "rgba(255,255,255,.04)", background: "rgba(10,10,12,.6)" }}>
        {/* Folder dropdown */}
        <div ref={folderPopoverRef} className="relative">
          {(() => {
            const active = folders.find(f => f.id === activeFolderId) || folders[0];
            const activeCount = items.filter(it => it.folderId === active?.id).length;
            return (
              <button
                onClick={() => setOpenPopover(openPopover === "folders" ? null : "folders")}
                className="flex items-center gap-2 rounded-full border px-3 py-1.5 transition"
                style={{
                  borderColor: openPopover === "folders" ? `rgba(${RGB},.4)` : "rgba(255,255,255,.1)",
                  background: openPopover === "folders" ? `rgba(${RGB},.08)` : "rgba(255,255,255,.03)",
                }}
              >
                <Icon name="folder" cls="h-3.5 w-3.5" style={{ color: ACCENT }} />
                <span className="text-[12px] font-semibold text-white">{active?.name}</span>
                <span className="font-mono text-[10px] text-white/40">{activeCount}</span>
                <span className="ml-1 rounded-full px-1.5 py-0.5 font-mono text-[9px] text-white/40" style={{ background: "rgba(255,255,255,.05)" }}>
                  {folders.length} {folders.length === 1 ? "folder" : "folders"}
                </span>
                <Icon name="chevron_down" cls="h-3 w-3 text-white/40" />
              </button>
            );
          })()}
          {openPopover === "folders" && (
            <div
              className="absolute left-0 top-full mt-2 w-72 rounded-2xl border p-1.5 shadow-2xl z-30"
              style={{ borderColor: "rgba(255,255,255,.1)", background: "rgba(15,15,18,.98)", backdropFilter: "blur(20px)" }}
            >
              <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
                {folders.map(f => {
                  const active = f.id === activeFolderId;
                  const count = items.filter(it => it.folderId === f.id).length;
                  const isEditing = editingFolderId === f.id;
                  return (
                    <div
                      key={f.id}
                      onClick={() => { if (!isEditing) { setActiveFolderId(f.id); setOpenPopover(null); } }}
                      className="group flex items-center gap-2 rounded-xl border p-2.5 transition"
                      style={{
                        borderColor: active ? `rgba(${RGB},.35)` : "transparent",
                        background:  active ? `rgba(${RGB},.10)` : "transparent",
                        cursor: isEditing ? "default" : "pointer",
                      }}
                    >
                      <Icon name="folder" cls="h-4 w-4 shrink-0" style={{ color: active ? ACCENT : "rgba(255,255,255,.4)" }} />
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <input
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onFocus={(e) => e.target.select()}
                            onBlur={commitRename}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                              else if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                            }}
                            className="w-full rounded border bg-white/[.06] px-1.5 py-0.5 text-[12px] font-semibold text-white outline-none"
                            style={{ borderColor: `rgba(${RGB},.4)` }}
                          />
                        ) : (
                          <div className="truncate text-[12px] font-semibold" style={{ color: active ? "#fff" : "rgba(255,255,255,.7)" }}>{f.name}</div>
                        )}
                        <div className="text-[10px] font-mono text-white/30">{count} {count === 1 ? "imagem" : "imagens"}</div>
                      </div>
                      {!isEditing && (
                        <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
                          <button
                            onClick={(e) => { e.stopPropagation(); startRename(f.id); }}
                            title="Renomear"
                            className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-white/[.06] hover:text-white"
                          >
                            <Icon name="pencil" cls="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteFolder(f.id); }}
                            title="Excluir"
                            className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Icon name="trash" cls="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => { createFolder(); /* mantém popover aberto pra editar nome inline */ }}
                className="mt-1 flex w-full items-center gap-2 rounded-xl border border-dashed border-white/10 p-2.5 text-[12px] font-semibold text-white/50 hover:border-white/25 hover:bg-white/[.03] hover:text-white/80 transition"
              >
                <Icon name="plus" cls="h-3.5 w-3.5" />
                Novo folder
              </button>
            </div>
          )}
        </div>
        <div className="flex-1" />

        {/* Grid scale slider */}
        <div className="flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1" style={{ borderColor: "rgba(255,255,255,.08)", background: "rgba(255,255,255,.02)" }}>
          <Icon name="image" cls="h-2.5 w-2.5 text-white/30" />
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={gridCols}
            onChange={e => setGridCols(parseInt(e.target.value, 10))}
            className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-white/10 accent-fuchsia-400"
            style={{ accentColor: ACCENT }}
            title={`${gridCols} ${gridCols === 1 ? "coluna" : "colunas"}`}
          />
          <Icon name="image" cls="h-3.5 w-3.5 text-white/50" />
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* Canvas */}
        <main className="relative flex flex-1 flex-col overflow-hidden">
          {/* Output area */}
          <div className="relative min-h-0 flex-1 overflow-y-auto p-6 pb-44">
            {visibleItems.length > 0 ? (
              <div
                className="mx-auto grid w-full max-w-6xl gap-4"
                style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
              >
                {visibleItems.map((it, i) => (
                  <Tile
                    key={it.jobId}
                    item={it}
                    index={i}
                    isFav={it.url ? favorites.has(it.url) : false}
                    onToggleFav={() => it.url && toggleFavorite(it.url)}
                    onDownload={() => it.url && downloadImage(it.url, i)}
                    onExpand={() => it.url && setLightboxId(it.jobId)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="h-20 w-20 rounded-2xl border flex items-center justify-center" style={{ borderColor: `rgba(${RGB},.15)`, background: `rgba(${RGB},.06)` }}>
                  <Icon name="image" cls="h-8 w-8" style={{ color: `rgba(${RGB},.5)` }} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white/50">Nenhuma imagem ainda</div>
                  <div className="mt-1 text-xs text-white/25">Escreva um prompt abaixo e clique em Gerar</div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 justify-center max-w-sm">
                  {["retrato cinematográfico, luz dramática", "paisagem futurista, neon", "still life editorial, luz de estúdio"].map(ex => (
                    <button key={ex} onClick={() => setPrompt(ex)} className="rounded-full border border-white/8 bg-white/[.03] px-3 py-1.5 text-[10px] text-white/40 hover:text-white/70 transition">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Toast de erro */}
          {error && (
            <div className="absolute bottom-44 left-1/2 z-30 -translate-x-1/2 flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/15 px-4 py-2.5 text-xs text-red-300 backdrop-blur">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-300/60 hover:text-red-300">
                <Icon name="close" cls="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Floating bottom bar — design da referência Higgsfield */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-4">
            <div ref={popoverRef} className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border shadow-2xl" style={{ borderColor: "rgba(255,255,255,.08)", background: "rgba(20,20,24,.95)", backdropFilter: "blur(20px)" }}>
              {/* Row 1: + button + textarea */}
              <div className="flex items-start gap-2 px-2.5 pt-2.5">
                <button
                  title="Adicionar imagem de referência (em breve)"
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[.04] text-white/40 hover:text-white/70 hover:border-white/20 transition"
                >
                  <Icon name="plus" cls="h-3.5 w-3.5" />
                </button>
                <div className="relative flex-1">
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
                    placeholder="Describe the scene you imagine"
                    rows={2}
                    className="w-full resize-none bg-transparent p-1.5 pr-9 text-sm text-white placeholder-white/30 outline-none"
                    style={{ fontFamily: "inherit" }}
                  />
                  <button onClick={copyPrompt} className="absolute right-2 top-2 text-white/25 hover:text-white/70 transition">
                    <Icon name={copied ? "close" : "copy"} cls="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 2: pills row */}
              <div className="flex items-center gap-1.5 px-2.5 pb-2.5 pt-1.5">
                {/* Modelo */}
                <div className="relative">
                  <button
                    onClick={() => setOpenPopover(openPopover === "model" ? null : "model")}
                    className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition"
                    style={{
                      borderColor: openPopover === "model" ? `rgba(${RGB},.4)` : "rgba(255,255,255,.08)",
                      background: openPopover === "model" ? `rgba(${RGB},.08)` : "rgba(255,255,255,.03)",
                    }}
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold" style={{ background: `rgba(${RGB},.18)`, color: ACCENT }}>
                      {selectedModel.name.charAt(0)}
                    </span>
                    <span className="text-[12px] font-semibold text-white">{selectedModel.name}</span>
                    <Icon name="chevron_down" cls="h-3 w-3 text-white/40" />
                  </button>
                  {openPopover === "model" && (
                    <div className="absolute bottom-full left-0 mb-2 w-72 max-h-80 overflow-y-auto rounded-xl border p-1 shadow-2xl"
                         style={{ borderColor: "rgba(255,255,255,.1)", background: "rgba(15,15,18,.98)", backdropFilter: "blur(20px)" }}>
                      {MODELS.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setModel(m.id); setResolution(m.res[0] || ""); setOpenPopover(null); }}
                          className="flex w-full items-start gap-2 rounded-lg p-2 text-left transition hover:bg-white/[.05]"
                          style={{ background: model === m.id ? `rgba(${RGB},.08)` : "transparent" }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-[12px] font-semibold text-white/90">{m.name}</span>
                              <span className="shrink-0 rounded px-1 py-0.5 font-mono text-[8px]" style={{ background: `rgba(${RGB},.12)`, color: `rgba(${RGB},.85)` }}>{m.tag}</span>
                            </div>
                            <div className="mt-0.5 text-[10px] leading-tight text-white/35">{m.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Aspect Ratio */}
                <div className="relative">
                  <button
                    onClick={() => setOpenPopover(openPopover === "aspect" ? null : "aspect")}
                    className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition"
                    style={{
                      borderColor: openPopover === "aspect" ? `rgba(${RGB},.4)` : "rgba(255,255,255,.08)",
                      background: openPopover === "aspect" ? `rgba(${RGB},.08)` : "rgba(255,255,255,.03)",
                    }}
                  >
                    <Icon name="monitor" cls="h-3 w-3 text-white/50" />
                    <span className="font-mono text-[11px] text-white">{aspectRatio}</span>
                  </button>
                  {openPopover === "aspect" && (
                    <div className="absolute bottom-full left-0 mb-2 grid grid-cols-3 gap-1 rounded-xl border p-2 shadow-2xl"
                         style={{ borderColor: "rgba(255,255,255,.1)", background: "rgba(15,15,18,.98)", backdropFilter: "blur(20px)" }}>
                      {ASPECT_RATIOS.map(ar => (
                        <button
                          key={ar}
                          onClick={() => { setAspectRatio(ar); setOpenPopover(null); }}
                          className="rounded-md border px-3 py-1.5 font-mono text-[11px] transition"
                          style={{
                            borderColor: aspectRatio === ar ? `rgba(${RGB},.4)` : "rgba(255,255,255,.06)",
                            background: aspectRatio === ar ? `rgba(${RGB},.12)` : "rgba(255,255,255,.02)",
                            color: aspectRatio === ar ? "#fff" : "rgba(255,255,255,.6)",
                          }}
                        >
                          {ar}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resolution */}
                {selectedModel.res.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setOpenPopover(openPopover === "res" ? null : "res")}
                      className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition"
                      style={{
                        borderColor: openPopover === "res" ? `rgba(${RGB},.4)` : "rgba(255,255,255,.08)",
                        background: openPopover === "res" ? `rgba(${RGB},.08)` : "rgba(255,255,255,.03)",
                      }}
                    >
                      <Icon name="diamond" cls="h-3 w-3" style={{ color: ACCENT }} />
                      <span className="font-mono text-[11px] uppercase text-white">{resolution}</span>
                    </button>
                    {openPopover === "res" && (
                      <div className="absolute bottom-full left-0 mb-2 flex gap-1 rounded-xl border p-2 shadow-2xl"
                           style={{ borderColor: "rgba(255,255,255,.1)", background: "rgba(15,15,18,.98)", backdropFilter: "blur(20px)" }}>
                        {selectedModel.res.map(r => (
                          <button
                            key={r}
                            onClick={() => { setResolution(r); setOpenPopover(null); }}
                            className="rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase transition"
                            style={{
                              borderColor: resolution === r ? `rgba(${RGB},.4)` : "rgba(255,255,255,.06)",
                              background: resolution === r ? `rgba(${RGB},.12)` : "rgba(255,255,255,.02)",
                              color: resolution === r ? "#fff" : "rgba(255,255,255,.6)",
                            }}
                          >{r}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Count stepper — formato N/MAX */}
                <div className="flex items-center rounded-full border" style={{ borderColor: "rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)" }}>
                  <button
                    onClick={() => setCount(c => Math.max(1, c - 1))}
                    disabled={count <= 1}
                    className="flex h-7 w-7 items-center justify-center text-white/60 hover:text-white disabled:opacity-30 transition"
                  >
                    <Icon name="minus" cls="h-3 w-3" />
                  </button>
                  <span className="min-w-[28px] text-center font-mono text-[11px] text-white">{count}/{MAX_COUNT}</span>
                  <button
                    onClick={() => setCount(c => Math.min(MAX_COUNT, c + 1))}
                    disabled={count >= MAX_COUNT}
                    className="flex h-7 w-7 items-center justify-center text-white/60 hover:text-white disabled:opacity-30 transition"
                  >
                    <Icon name="plus" cls="h-3 w-3" />
                  </button>
                </div>

                {/* Toggle Unlimited (só Nano Banana Pro) */}
                {model === "nano_banana_2" && (
                  <button
                    onClick={() => setUnlimited(u => !u)}
                    title={unlimited
                      ? "Lembre de ativar Unlimited também no site da Higgsfield (clique no ícone i para abrir)."
                      : "Marque para usar modo Unlimited (precisa estar ativo na sua conta Higgsfield)."}
                    className="flex items-center gap-2 rounded-full border px-2.5 py-1 transition"
                    style={{
                      borderColor: unlimited ? "rgba(202,238,75,.4)" : "rgba(255,255,255,.08)",
                      background:  unlimited ? "rgba(202,238,75,.08)" : "rgba(255,255,255,.03)",
                    }}
                  >
                    <span className="text-[11px] font-semibold" style={{ color: unlimited ? "#cae84b" : "rgba(255,255,255,.6)" }}>
                      Unlimited
                    </span>
                    <span className="relative h-3.5 w-6 rounded-full transition" style={{ background: unlimited ? "#a3d11c" : "rgba(255,255,255,.18)" }}>
                      <span
                        className="absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-all"
                        style={{ left: unlimited ? "calc(100% - 12px)" : "2px" }}
                      />
                    </span>
                    {unlimited && (
                      <a
                        href="https://higgsfield.ai/ai/image?model=nano-banana-pro"
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Abrir Higgsfield para confirmar Unlimited ativo"
                        className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[#cae84b] hover:bg-[#cae84b]/10"
                      >
                        <Icon name="info" cls="h-2.5 w-2.5" />
                      </a>
                    )}
                  </button>
                )}

                {/* Draw button (stub) */}
                <button
                  title="Modo Draw — em breve"
                  className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-white/40 transition cursor-not-allowed"
                  style={{ borderColor: "rgba(255,255,255,.06)", background: "rgba(255,255,255,.02)" }}
                >
                  <Icon name="draw" cls="h-3 w-3" />
                  <span className="text-[11px]">Draw</span>
                </button>

                <div className="flex-1" />

                {/* Gerar — fica amarelo "Unlimited" quando toggle ON */}
                <button
                  onClick={generate}
                  disabled={!prompt.trim()}
                  className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-bold transition disabled:opacity-40"
                  style={{
                    background: unlimited && model === "nano_banana_2" ? "#cae84b" : ACCENT,
                    color: unlimited && model === "nano_banana_2" ? "#0a0a0a" : DARK,
                  }}
                >
                  {unlimited && model === "nano_banana_2" ? "Unlimited" : "Gerar"}
                  <Icon name="zap" cls="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Lightbox — navegável por ←/→ teclado */}
      {lightboxItem && (() => {
        const isFav = favorites.has(lightboxItem.url);
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setLightboxId(null)}
          >
            {/* Counter top-left */}
            <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-black/40 px-3 py-1 font-mono text-[11px] text-white/70 backdrop-blur">
              {lightboxIndex + 1} / {completedItems.length}
            </div>

            {/* Close top-right */}
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxId(null); }}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white hover:bg-white/10 transition"
            >
              <Icon name="close" cls="h-4 w-4" />
            </button>

            <img
              key={lightboxItem.jobId}
              src={lightboxItem.url}
              alt="Lightbox"
              className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain"
              onClick={e => e.stopPropagation()}
            />

            {/* Action buttons bottom-right */}
            <div className="absolute bottom-4 right-4 flex gap-2" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => toggleFavorite(lightboxItem.url)}
                className="flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold backdrop-blur transition"
                style={{
                  borderColor: isFav ? `rgba(${RGB},.6)` : "rgba(255,255,255,.2)",
                  background: isFav ? `rgba(${RGB},.85)` : "rgba(0,0,0,.6)",
                  color: isFav ? DARK : "#fff",
                }}
              >
                <Icon name={isFav ? "heart_filled" : "heart"} cls="h-3.5 w-3.5" />
                {isFav ? "Favoritada" : "Favoritar"}
              </button>
              <button
                onClick={() => downloadImage(lightboxItem.url, lightboxIndex)}
                className="flex items-center gap-2 rounded-xl border border-white/20 bg-black/60 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/10 transition"
              >
                <Icon name="download" cls="h-3.5 w-3.5" />
                Download
              </button>
            </div>

            {/* Hint inferior */}
            <div className="absolute inset-x-0 bottom-4 mx-auto w-fit pointer-events-none">
              <div className="rounded-full bg-black/40 px-3 py-1 font-mono text-[10px] text-white/40 backdrop-blur">
                ← → para navegar · Esc para fechar
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
