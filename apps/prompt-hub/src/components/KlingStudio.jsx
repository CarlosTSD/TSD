import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GENERATORS } from "../config/generators";

const GEN = GENERATORS.find(g => g.id === 'kling');

function cn(...cls) { return cls.filter(Boolean).join(" "); }
function toggleInArray(arr, val) { return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]; }

function buildVideoPrompt({ scene, camera, shot, cameraMove, speed, luz, look, rules, negative, references, aspect }) {
  const safeRefs = Array.isArray(references) ? references : [];
  const safeMoves = Array.isArray(cameraMove) ? cameraMove : [];
  const shotType = shot || "cinematic medium shot";
  const moves = safeMoves.length ? safeMoves.join(", ") : "static shot";
  const refText = safeRefs.length
    ? `Visual references: ${safeRefs.map((r, i) => r.label ? `@ref_${i+1} (${r.label})` : `@ref_${i+1}`).join(", ")}. Maintain visual consistency and character identity throughout the entire video.`
    : "";
  const camLine = [
    `${shotType}, ${moves}`,
    camera ? `${camera} camera` : "",
    "8K resolution",
    aspect ? `${aspect} aspect ratio` : "",
    speed && speed !== "Normal" ? speed : "",
  ].filter(Boolean).join(", ");
  const scTxt = scene ? scene.trim() : "describe the scene, subject, action and environment in detail";
  const lookLine = look ? `The visual style should follow: ${look.trim()}` : "Premium cinematic look with smooth natural motion, controlled contrast and refined color grading.";
  const rulesLine = rules ? `Scene rules: ${rules.trim()}` : "Maintain consistent motion throughout. Keep composition clean and physically believable.";
  const qualityClosing = "ultra resolution, 8K, photorealistic, smooth natural motion, high production value, cinematic depth, rich color grading, sharp focus";
  const neg = negative || "no camera shake, no flickering, no distorted anatomy, no low quality artifacts, no abrupt cuts, no static freeze frames";
  return [
    `${camLine}, ${scTxt}`,
    refText,
    luz ? `Lighting: ${luz}` : "",
    lookLine,
    rulesLine,
    `Final video quality: ${qualityClosing}`,
    `Negative prompt: ${neg}`,
  ].filter(Boolean).join(". ") + ".";
}

/* ─── Icons ─── */
function Icon({ name, className = "h-4 w-4" }) {
  const p = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const d = {
    camera:       (<><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></>),
    motion:       (<><path d="M5 12h14M12 5l7 7-7 7"/><path d="M5 19l-2-7 2-7"/></>),
    angle:        (<><path d="M4 18h16M6 18 18 6M18 6v7M18 6h-7"/></>),
    sun:          (<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></>),
    close:        (<><path d="M18 6 6 18m0-12 12 12"/></>),
    plus:         (<><path d="M12 5v14M5 12h14"/></>),
    copy:         (<><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>),
    bookmark:     (<><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></>),
    history:      (<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>),
    trash:        (<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>),
    at:           (<><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></>),
    play:         (<><polygon points="5 3 19 12 5 21 5 3"/></>),
    video:        (<><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>),
    zap:          (<><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>),
  };
  return <svg {...p}>{d[name]}</svg>;
}

function Pill({ children, active, onClick, sm }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium transition-all",
        sm ? "h-8 px-3.5 text-xs" : "h-9 px-4 text-xs",
        active ? "border-white/18 bg-white/[.09] text-white" : "border-white/8 bg-white/[.03] text-white/45 hover:border-white/15 hover:text-white/75"
      )}>
      {children}
    </button>
  );
}

function OptionCard({ icon, title, subtitle, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition",
        active ? "border-white/16 bg-white/[.07] text-white" : "border-white/7 bg-white/[.02] text-white/68 hover:border-white/14 hover:bg-white/[.05]"
      )}>
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
        active ? "border-white/16 bg-white/[.06] text-white/90" : "border-white/8 bg-black/20 text-white/40")}>
        <Icon name={icon} className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-normal">{title}</p>
        {subtitle && <p className="mt-1 text-xs leading-normal text-white/40">{subtitle}</p>}
      </div>
    </button>
  );
}

function CameraSection({ icon, label, children }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 pb-1 border-b border-white/6">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/10 bg-white/[.04] text-white/50">
          <Icon name={icon} className="h-3 w-3" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[.14em] text-white/40">{label}</span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function FloatingPanel({ title, onClose, children }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-[360px] left-4 right-4 top-[68px] z-50 flex flex-col overflow-hidden rounded-2xl border backdrop-blur-3xl transition-all duration-500 sm:left-[60px] sm:right-[60px] md:bottom-[200px] md:left-[150px] md:right-[150px] md:rounded-[24px] lg:left-[200px] lg:right-[200px]"
        style={{
          background: `linear-gradient(to bottom right, ${GEN.bgFrom}, rgba(7,9,15,.78))`,
          borderColor: GEN.borderAccent,
          boxShadow: `0 28px 80px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.07), 0 0 80px ${GEN.boxShadow}`,
        }}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-3.5" style={{ borderColor: GEN.borderAccent }}>
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-0.5 text-xs text-white/38">Escolha uma opção para aplicar no prompt.</p>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[.04] text-white/45 transition hover:text-white">
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
      </div>
    </>
  );
}

/* ─── Data ─── */
const CAM_MOVE_OPTS = [
  ["Slow pan left",    "panorâmica lenta esquerda"],
  ["Slow pan right",   "panorâmica lenta direita"],
  ["Zoom in",          "aproximação suave"],
  ["Zoom out",         "afastamento suave"],
  ["Dolly forward",    "câmera avança"],
  ["Dolly backward",   "câmera recua"],
  ["Tracking shot",    "segue o sujeito"],
  ["Orbit left",       "arco pelo lado esquerdo"],
  ["Orbit right",      "arco pelo lado direito"],
  ["Crane up",         "elevação suave"],
  ["Crane down",       "descida suave"],
  ["Tilt up",          "inclina para cima"],
  ["Tilt down",        "inclina para baixo"],
  ["Handheld",         "câmera na mão, orgânico"],
  ["Arc shot",         "arco lateral"],
  ["Static",           "câmera completamente parada"],
];

const SHOT_OPTS = [
  ["Wide shot",         "ambiente geral"],
  ["Medium shot",       "equilíbrio clássico"],
  ["Close-up",          "rosto / produto"],
  ["Extreme close-up",  "detalhe extremo"],
  ["Full shot",         "corpo inteiro"],
  ["Two shot",          "dois personagens"],
  ["Low angle",         "poderoso, imponente"],
  ["High angle",        "olhando de cima"],
  ["Bird's eye",        "aéreo amplo"],
  ["Top-down (overhead)", "vista de cima, 90°"],
  ["Worm's eye",        "raso, de baixo pra cima"],
  ["From behind",       "costas do personagem"],
  ["Over the shoulder", "por cima do ombro"],
  ["3/4 front",         "três-quartos"],
  ["Side profile",      "perfil lateral"],
  ["POV",               "ponto de vista"],
];

const SPEED_OPTS = [
  ["Normal",            "24fps, movimento natural"],
  ["Slow motion",       "60-120fps, slowmo suave"],
  ["Ultra slow-mo",     "240fps, detalhe extremo"],
  ["Time-lapse",        "acelerado, passagem do tempo"],
];

const LUZ_OPTS = [
  ["Low Key",           "sombras profundas, alto contraste"],
  ["High Key",          "luz uniforme, poucas sombras"],
  ["Luz Difusa",        "suave, sem sombras duras"],
  ["Luz Dura",          "sombras definidas, dramático"],
  ["Contraluz",         "silhueta, rim light"],
  ["Luz Natural",       "ambiente exterior real"],
  ["Chiaroscuro",       "claro-escuro clássico"],
  ["Luz de Amanhecer",  "golden hour matinal"],
  ["Luz de Entardecer", "golden hour ao pôr do sol"],
  ["Luz de Vela",       "quente, íntimo, orgânico"],
  ["Luz de Janela",     "lateral suave, natural"],
  ["Neon / Colorida",   "luz sintética, urbano, sci-fi"],
  ["Rembrandt",         "triângulo de luz no rosto"],
  ["Luz de Estúdio",    "setup controlado, look comercial"],
  ["Moonlight",         "azul frio, noturno suave"],
];

const LOOK_SECTIONS = [
  { label: "Iluminação",        options: ["Soft natural daylight","Golden hour","Blue hour","Overcast diffused","Hard dramatic","Backlit rim","Warm ambient interior","Neon practical","Natural moonlight"] },
  { label: "Color Grade",       options: ["Teal and amber","Soft neutral","Warm cinematic","Cool desaturated","High contrast","Bleach bypass","Kodak film emulation","Fuji film emulation","Black and white"] },
  { label: "Textura & Grain",   options: ["Film grain","Clean digital","Heavy grain","16mm grain","Super 8 grain"] },
  { label: "Estilo Visual",     options: ["Photorealistic","Cinematic","Commercial ad","Documentary","Concept art","3D render"] },
  { label: "Motion Style",      options: ["Fluid motion","Sharp cuts","Slow drift","Dynamic energy","Floating camera","Ethereal","Grounded"] },
];

const CAMERAS = ["Studio Digital S35","ARRI Alexa 35","ARRI Alexa Mini LF","RED V-Raptor","Sony Venice 2","Blackmagic URSA"];
const CAM_SUBS = { "Studio Digital S35":"clean cinematic digital","ARRI Alexa 35":"premium filmic range","ARRI Alexa Mini LF":"large format look","RED V-Raptor":"sharp commercial","Sony Venice 2":"soft high-end","Blackmagic URSA":"indie cinema feel" };

/* ═══ App ═══ */
export default function KlingStudio() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [openPanel,  setOpenPanel]  = useState(null);
  const [scene,      setScene]      = useState("");
  const [shot,       setShot]       = useState("");
  const [cameraMove, setCameraMove] = useState([]);
  const [camera,     setCamera]     = useState("Studio Digital S35");
  const [speed,      setSpeed]      = useState("Normal");
  const [luz,        setLuz]        = useState("");
  const [lookTags,   setLookTags]   = useState([]);
  const [rules,      setRules]      = useState("");
  const [negative,   setNegative]   = useState("");
  const [references, setReferences] = useState([]);
  const [aspect,     setAspect]     = useState("16:9");
  const [results,    setResults]    = useState([]);
  const [generating, setGenerating] = useState(false);
  const [library,    setLibrary]    = useState([]);
  const [newPrompt,  setNewPrompt]  = useState('');

  useEffect(() => {
    try { setResults(JSON.parse(localStorage.getItem('nb_sessions') || '[]')); } catch {}
  }, []);

  // Carrega biblioteca do servidor; migra dados antigos do localStorage uma vez.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let local = [];
        try { local = JSON.parse(localStorage.getItem('nb_library') || '[]'); } catch {}
        if (Array.isArray(local) && local.length) {
          await fetch('/api/library/migrate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: local }),
          }).catch(() => {});
          try { localStorage.removeItem('nb_library'); } catch {}
        }
        const res = await fetch('/api/library');
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setLibrary(data);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const klingLibrary = library.filter(l => l.generator === 'kling');

  const prompt = useMemo(
    () => buildVideoPrompt({ scene, camera, shot, cameraMove, speed, luz, look: lookTags.join(", "), rules, negative, references, aspect }),
    [scene, camera, shot, cameraMove, speed, luz, lookTags, rules, negative, references, aspect]
  );

  const handleFiles = (files) => {
    const imgs = Array.from(files || []).filter(f => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setReferences(cur => [...cur, ...imgs.map(f => ({ id: `${f.name}-${Date.now()}-${Math.random()}`, name: f.name, url: URL.createObjectURL(f), label: "" }))]);
  };

  const translateScene = async (text) => {
    if (!text.trim()) return text;
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=pt-BR|en-US&de=hello@merinno.com`);
      const data = await res.json();
      if (data.responseStatus === 200 && data.responseData?.translatedText) return data.responseData.translatedText;
    } catch {}
    return text;
  };

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    setOpenPanel(null);
    try {
      const sceneEn = await translateScene(scene);
      const raw = scene.trim();
      const title = raw.length > 0 ? raw.slice(0, 80) + (raw.length > 80 ? '…' : '') : 'Novo prompt de vídeo';

      let finalPrompt, finalPromptPt = '', usedExampleIds = [];
      try {
        const res = await fetch('/api/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scene: sceneEn, camera, shot, cameraMove, speed,
            luz, look: lookTags.join(', '), rules, negative, references, aspect,
            examples: klingLibrary.map(l => l.content),
          }),
        });
        if (!res.ok) throw new Error('api_error');
        const data = await res.json();
        finalPrompt = data.prompt;
        finalPromptPt = data.promptPt || '';
        usedExampleIds = Array.isArray(data.usedExampleIds) ? data.usedExampleIds : [];
      } catch {
        finalPrompt = buildVideoPrompt({ scene: sceneEn, camera, shot, cameraMove, speed, luz, look: lookTags.join(', '), rules, negative, references, aspect });
      }

      const sessionId = String(Date.now());
      const session = {
        id: sessionId, title, scene: raw, generator: 'kling',
        prompt: finalPrompt,
        createdAt: new Date().toISOString(),
        messages: [{ id: 'p0', role: 'assistant', type: 'prompt', content: finalPrompt, contentPt: finalPromptPt, usedExampleIds, createdAt: new Date().toISOString() }],
      };
      try {
        const saved = JSON.parse(localStorage.getItem('nb_sessions') || '[]');
        localStorage.setItem('nb_sessions', JSON.stringify([session, ...saved]));
      } catch {}
      setResults(cur => [session, ...cur]);
      navigate(`/studio3/chat/${sessionId}`);
    } finally {
      setGenerating(false);
    }
  };

  const addToLibrary = async () => {
    const text = newPrompt.trim();
    if (!text) return;
    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, generator: 'kling' }),
      });
      if (!res.ok) return;
      const item = await res.json();
      setLibrary(cur => [item, ...cur]);
      setNewPrompt('');
    } catch {}
  };

  const removeFromLibrary = async (id) => {
    try {
      await fetch(`/api/library/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setLibrary(cur => cur.filter(l => l.id !== id));
    } catch {}
  };

  const updateReferenceLabel = (id, label) => {
    setReferences(cur => cur.map(r => r.id === id ? { ...r, label } : r));
  };

  const close  = () => setOpenPanel(null);
  const toggle = (name) => setOpenPanel(p => p === name ? null : name);

  const bgStyle = {
    background: `linear-gradient(to bottom right, ${GEN.bgFrom}, rgba(7,9,15,.75))`,
    borderColor: GEN.borderAccent,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,.06), 0 0 40px ${GEN.boxShadow}`,
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08090d] text-white">

      {/* Background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 75% 65% at 28% 62%, ${GEN.glow1}, transparent)` }} />
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 55% 45% at 60% 42%, ${GEN.glow2}, transparent)` }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_110%,rgba(0,5,18,.70),transparent),radial-gradient(ellipse_55%_40%_at_100%_0%,rgba(0,4,14,.60),transparent)]" />
      </div>

      {/* Header */}
      <header className="fixed left-4 right-4 top-4 z-30 flex items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 backdrop-blur-3xl sm:left-[60px] sm:right-[60px] md:left-[150px] md:right-[150px] lg:left-[200px] lg:right-[200px]"
        style={bgStyle}>
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={() => navigate('/')}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[.03] text-white/35 hover:border-white/14 hover:text-white/70 transition"
            title="Voltar ao Hub">
            <Icon name="arrow_left" className="h-3.5 w-3.5" />
          </button>
          <span className="bg-gradient-to-b from-white/92 via-white/70 to-white/30 bg-clip-text text-xl font-black tracking-tight text-transparent select-none">TSD</span>
          <div className="hidden sm:block w-px h-4 bg-white/10 shrink-0" />
          <span className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: GEN.borderAccent, color: GEN.accent, background: `rgba(${GEN.rgb},.07)` }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: GEN.accent }} />
            {GEN.label}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => toggle("library")} title="Biblioteca de prompts"
            className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition",
              openPanel === "library" ? "border-white/18 bg-white/[.08] text-white/80" : "border-white/8 bg-white/[.03] text-white/35 hover:border-white/14 hover:text-white/60")}>
            <Icon name="bookmark" className="h-3.5 w-3.5" />
            {klingLibrary.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                style={{ background: GEN.accent, color: GEN.dark }}>{klingLibrary.length}</span>
            )}
          </button>
          <button type="button" onClick={() => toggle("history")} title="Histórico"
            className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition",
              openPanel === "history" ? "border-white/18 bg-white/[.08] text-white/80" : "border-white/8 bg-white/[.03] text-white/35 hover:border-white/14 hover:text-white/60")}>
            <Icon name="history" className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <main className="relative flex min-h-screen flex-col gap-4 p-4 pt-[84px] md:p-6 md:pt-[88px]">

        <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-20 h-[26rem] bg-gradient-to-t from-[#020304] from-50% to-transparent" />

        {/* Canvas */}
        <section className="relative flex min-h-0 flex-1 items-center justify-center overflow-x-hidden rounded-[28px] border border-white/6 bg-white/[.015] pb-[380px] md:pb-[210px]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[30%] top-[22%] h-5 w-5 border-l-2 border-t-2 border-white/12 md:left-[35%]" />
            <div className="absolute right-[30%] top-[22%] h-5 w-5 border-r-2 border-t-2 border-white/12 md:right-[35%]" />
            <div className="absolute bottom-[22%] left-[30%] h-5 w-5 border-b-2 border-l-2 border-white/12 md:left-[35%]" />
            <div className="absolute bottom-[22%] right-[30%] h-5 w-5 border-b-2 border-r-2 border-white/12 md:right-[35%]" />
          </div>
          <div className="relative z-[1] mx-auto flex w-full max-w-2xl flex-col items-center px-6 py-16 text-center md:px-10 md:py-20">
            <p className="mb-4 text-[9px] font-semibold uppercase tracking-[.48em]" style={{ color: GEN.accent, opacity: 0.7 }}>{GEN.tag}</p>
            <h1 className="bg-gradient-to-b from-white/92 via-white/65 to-white/22 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl md:text-7xl">{GEN.label}</h1>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/28">Descreva a cena e o movimento. Configure câmera, luz e estilo. Ao gerar, você entra no chat do prompt.</p>
            <div className="mt-10 flex h-14 w-14 items-center justify-center rounded-full border" style={{ borderColor: `rgba(${GEN.rgb},.2)` }}>
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: `rgba(${GEN.rgb},.4)` }} />
            </div>
          </div>
        </section>

        {/* ── Panels ── */}

        {openPanel === "history" && (
          <FloatingPanel title="Histórico de prompts" onClose={close}>
            {results.filter(s => s.generator === 'kling').length === 0 ? (
              <div className="flex min-h-[120px] items-center justify-center text-sm text-white/28">Nenhum prompt gerado ainda.</div>
            ) : (
              <div className="flex flex-col divide-y divide-white/6">
                {results.filter(s => s.generator === 'kling').map(session => (
                  <div key={session.id} className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white/82">{session.title || 'Prompt'}</p>
                      <p className="mt-0.5 text-[11px] text-white/30">{new Date(session.createdAt).toLocaleString('pt-BR')}</p>
                    </div>
                    <button type="button" onClick={() => { close(); navigate(`/studio3/chat/${session.id}`); }}
                      className="shrink-0 rounded-full border border-white/10 bg-white/[.04] px-4 py-1.5 text-xs font-medium text-white/55 transition hover:text-white">
                      Abrir →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </FloatingPanel>
        )}

        {openPanel === "library" && (
          <FloatingPanel title={`Biblioteca · ${GEN.label}`} onClose={close}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-white/38">Adicionar prompt validado</p>
                <textarea value={newPrompt} onChange={e => setNewPrompt(e.target.value)} rows={5}
                  placeholder={`Cole aqui um prompt de vídeo testado para ${GEN.label}. O agente vai aprender com ele.`}
                  className="w-full resize-none rounded-xl border bg-black/25 p-4 text-sm leading-relaxed text-white/78 outline-none placeholder:text-white/22"
                  style={{ borderColor: `rgba(${GEN.rgb},.15)` }} />
                <button type="button" onClick={addToLibrary} disabled={!newPrompt.trim()}
                  className="self-start rounded-full px-5 py-2 text-xs font-semibold transition hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: GEN.accent, color: GEN.dark }}>
                  Salvar em {GEN.label}
                </button>
              </div>
              {klingLibrary.length > 0 && <div className="border-t" style={{ borderColor: `rgba(${GEN.rgb},.1)` }} />}
              {klingLibrary.length === 0 ? (
                <div className="flex min-h-[80px] items-center justify-center rounded-xl border border-white/6 text-sm text-white/25">Nenhum prompt de {GEN.label} ainda.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-white/38">{klingLibrary.length} prompt{klingLibrary.length !== 1 ? 's' : ''} · {GEN.label}</p>
                  {klingLibrary.map((item, i) => (
                    <div key={item.id} className="group flex items-start gap-3 rounded-xl border bg-white/[.02] p-4" style={{ borderColor: `rgba(${GEN.rgb},.08)` }}>
                      <span className="mt-0.5 shrink-0 text-[10px] font-bold" style={{ color: `rgba(${GEN.rgb},.4)` }}>{String(i+1).padStart(2,'0')}</span>
                      <p className="min-w-0 flex-1 text-xs leading-relaxed text-white/55 line-clamp-3">{item.content}</p>
                      <button type="button" onClick={() => removeFromLibrary(item.id)}
                        className="shrink-0 text-white/20 opacity-0 transition hover:text-red-400 group-hover:opacity-100">
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FloatingPanel>
        )}

        {openPanel === "shot" && (
          <FloatingPanel title="Tipo de enquadramento" onClose={close}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {SHOT_OPTS.map(([t, s]) => (
                <OptionCard key={t} icon="video" title={t} subtitle={s} active={shot === t} onClick={() => { setShot(cur => cur === t ? "" : t); }} />
              ))}
            </div>
          </FloatingPanel>
        )}

        {openPanel === "movement" && (
          <FloatingPanel title="Movimento de câmera" onClose={close}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {CAM_MOVE_OPTS.map(([t, s]) => (
                <OptionCard key={t} icon="motion" title={t} subtitle={s} active={cameraMove.includes(t)} onClick={() => setCameraMove(cur => toggleInArray(cur, t))} />
              ))}
            </div>
          </FloatingPanel>
        )}

        {openPanel === "camera" && (
          <FloatingPanel title="Câmera & Velocidade" onClose={close}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CameraSection icon="camera" label="Câmera">
                {CAMERAS.map(c => <OptionCard key={c} icon="camera" title={c} subtitle={CAM_SUBS[c]} active={camera === c} onClick={() => setCamera(c)} />)}
              </CameraSection>
              <CameraSection icon="zap" label="Velocidade">
                {SPEED_OPTS.map(([t, s]) => <OptionCard key={t} icon="zap" title={t} subtitle={s} active={speed === t} onClick={() => setSpeed(t)} />)}
              </CameraSection>
            </div>
          </FloatingPanel>
        )}

        {openPanel === "luz" && (
          <FloatingPanel title="Luz" onClose={close}>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {LUZ_OPTS.map(([name, sub]) => (
                <OptionCard key={name} icon="sun" title={name} subtitle={sub} active={luz === name} onClick={() => setLuz(cur => cur === name ? "" : name)} />
              ))}
            </div>
          </FloatingPanel>
        )}

        {openPanel === "look" && (
          <FloatingPanel title="Look & Estilo" onClose={close}>
            <div className="flex flex-col gap-6">
              {LOOK_SECTIONS.map(({ label, options }) => (
                <div key={label}>
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.14em] text-white/38">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    {options.map(opt => (
                      <Pill key={opt} sm active={lookTags.includes(opt)} onClick={() => setLookTags(cur => toggleInArray(cur, opt))}>{opt}</Pill>
                    ))}
                  </div>
                </div>
              ))}
              {lookTags.length > 0 && (
                <button type="button" onClick={() => setLookTags([])}
                  className="self-start rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-white/40 transition hover:text-white/70">
                  Limpar ({lookTags.length})
                </button>
              )}
            </div>
          </FloatingPanel>
        )}

        {openPanel === "rules" && (
          <FloatingPanel title="Regras e negative prompt" onClose={close}>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-white/38">Regras da cena</p>
                <textarea value={rules} onChange={e => setRules(e.target.value)} rows={7}
                  placeholder="Manter personagem, não trocar cenário, preservar identidade..."
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-7 text-white/78 outline-none placeholder:text-white/22 focus:border-white/20" />
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-white/38">Negative prompt</p>
                <textarea value={negative} onChange={e => setNegative(e.target.value)} rows={7}
                  placeholder="Camera shake, flickering, distorted anatomy, low quality..."
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-7 text-white/78 outline-none placeholder:text-white/22 focus:border-white/20" />
              </div>
            </div>
          </FloatingPanel>
        )}

        {openPanel === "references" && (
          <FloatingPanel title="Imagens de referência" onClose={close}>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
            <div className="flex flex-col gap-5">
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center gap-4 rounded-xl border border-dashed border-white/14 bg-white/[.025] px-5 py-4 text-left transition hover:border-white/25 hover:bg-white/[.04]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-white/55">
                  <Icon name="plus" className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/70">Adicionar imagens</p>
                  <p className="mt-0.5 text-xs text-white/32">Cada imagem vira @ref_1, @ref_2… · Descreva o que cada uma contém</p>
                </div>
              </button>
              {references.length === 0 ? (
                <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-white/8 text-sm text-white/25">Nenhuma imagem adicionada ainda.</div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {references.map((r, i) => (
                    <div key={r.id} className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[.02]">
                      <div className="relative">
                        <img src={r.url} alt={r.name} className="h-52 w-full object-cover" />
                        <div className="absolute left-2 top-2 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm" style={{ color: GEN.accent }}>@ref_{i+1}</div>
                        <button type="button" onClick={() => setReferences(c => c.filter(x => x.id !== r.id))}
                          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white/65 opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:text-white">
                          <Icon name="close" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-col gap-1.5 px-3 py-3">
                        <p className="truncate text-[10px] text-white/30">{r.name}</p>
                        <input type="text" value={r.label || ""} onChange={e => updateReferenceLabel(r.id, e.target.value)}
                          placeholder={`O que é @ref_${i+1}? Ex: personagem principal`}
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs leading-normal text-white/78 outline-none placeholder:text-white/22 focus:border-white/20" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FloatingPanel>
        )}

        {/* ── Bottom Bar ── */}
        <section
          className="fixed bottom-4 left-4 right-4 z-30 flex flex-col overflow-hidden rounded-[24px] border backdrop-blur-3xl sm:left-[60px] sm:right-[60px] md:bottom-5 md:left-[150px] md:right-[150px] md:rounded-[28px] lg:left-[200px] lg:right-[200px]"
          style={{
            background: `linear-gradient(to bottom right, ${GEN.bgFrom}, rgba(7,9,15,.75))`,
            borderColor: GEN.borderAccent,
            boxShadow: `0 20px 60px rgba(0,0,0,.60), inset 0 1px 0 rgba(255,255,255,.06), 0 0 60px ${GEN.boxShadow}`,
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3 md:p-4">
            <div className="flex flex-col gap-2.5 md:flex-row md:items-stretch md:gap-3">

              {/* Scene input + pills */}
              <div className="min-w-0 flex-1 rounded-[16px] border border-white/10 bg-white/[.04] px-4 py-3 md:px-5 md:py-3.5">
                <textarea
                  value={scene}
                  onChange={e => setScene(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generate(); } }}
                  rows={2}
                  placeholder="Descreva a cena e a ação — Enter para gerar, Shift+Enter para nova linha"
                  className="w-full min-h-[2.75rem] resize-y bg-transparent text-sm leading-relaxed text-white/78 outline-none placeholder:text-white/32 md:min-h-0 md:resize-none md:text-base"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill active={openPanel==="shot"||Boolean(shot)} onClick={() => toggle("shot")}>
                    <Icon name="video" />Shot{shot ? ` · ${shot}` : ""}
                  </Pill>
                  <Pill active={openPanel==="movement"||cameraMove.length>0} onClick={() => toggle("movement")}>
                    <Icon name="motion" />Movimento{cameraMove.length ? ` (${cameraMove.length})` : ""}
                  </Pill>
                  <Pill active={openPanel==="luz"||Boolean(luz)} onClick={() => toggle("luz")}>
                    <Icon name="sun" />Luz{luz ? ` · ${luz}` : ""}
                  </Pill>
                  <Pill active={openPanel==="look"||lookTags.length>0} onClick={() => toggle("look")}>
                    Look & Estilo{lookTags.length ? ` (${lookTags.length})` : ""}
                  </Pill>
                  <Pill active={openPanel==="rules"||Boolean(rules||negative)} onClick={() => toggle("rules")}>Regras</Pill>
                  <Pill active={openPanel==="references"||references.length>0} onClick={() => toggle("references")}>
                    <Icon name="at" />Refs{references.length ? ` (${references.length})` : ""}
                  </Pill>
                </div>
              </div>

              {/* Camera card */}
              <button type="button" onClick={() => toggle("camera")}
                className="shrink-0 rounded-[18px] border border-white/10 bg-white/[.04] px-4 py-3 text-left transition hover:bg-white/[.07] md:w-[160px] md:px-4 md:py-3.5">
                <p className="text-sm font-semibold leading-normal text-white/88">{camera}</p>
                <p className="mt-1.5 text-xs text-white/45">{speed}</p>
                <p className="mt-0.5 text-xs text-white/38">Kling 3.0 Omni</p>
              </button>

              {/* Generate */}
              <button type="button" onClick={generate} disabled={generating}
                className="flex shrink-0 items-center justify-center gap-2 rounded-[16px] px-4 py-2.5 text-xs font-black tracking-wide transition duration-300 md:w-[100px] md:py-3 md:text-sm hover:brightness-105 active:scale-[.98] disabled:cursor-wait disabled:opacity-50"
                style={{ background: GEN.accent, color: GEN.dark, boxShadow: `0 4px 20px rgba(${GEN.rgb},.28)` }}>
                {generating ? "..." : "GENERATE ✦"}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {["9:16","16:9","1:1","4:5"].map(v => <Pill key={v} active={aspect===v} onClick={() => setAspect(v)}>{v}</Pill>)}
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
