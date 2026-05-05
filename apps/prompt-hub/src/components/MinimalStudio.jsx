import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GENERATORS } from "../config/generators";

function cn(...cls) {
  return cls.filter(Boolean).join(" ");
}

function toggleInArray(arr, val) {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

function buildPrompt({ scene, camera, lens, focalLength, aperture, angles, luz, look, rules, negative, references, aspect }) {
  const safeAngles = Array.isArray(angles) ? angles : [];
  const safeRefs   = Array.isArray(references) ? references : [];
  const shot       = safeAngles.length ? safeAngles.join(", ") : "cinematic medium shot";
  const camParts   = [
    camera     ? `${camera} camera`                    : "",
    lens       ? `with ${lens} lens`                   : "",
    focalLength? `at ${focalLength}`                   : "",
    aperture   ? `${aperture} aperture`                : "",
    "8K resolution",
    aspect     ? `${aspect} aspect ratio`              : "",
  ].filter(Boolean).join(", ");
  const refText    = safeRefs.length
    ? `Use the uploaded image references: ${safeRefs.map((r, i) => r.label ? `@image_${i + 1} (${r.label})` : `@image_${i + 1}`).join(", ")}. Preserve character identity, environment, styling, textures, and visual continuity from each reference exactly as described.`
    : "";
  const qualityClosing = "ultra resolution, 8K, photorealistic textures, hyperrealistic render, rich cinematic lighting, precise focus, natural composition, high production value, ultra-detail, photorealistic cinematic quality";
  const neg   = negative || "no motion blur, no extra limbs, no distorted anatomy, no deformed faces, no low quality, no visual artifacts";
  const scTxt = scene ? scene.trim() : "describe the scene with a clear main subject, action, environment, and composition";
  return [
    `Cinematic ${shot}, ${camParts}, ${scTxt}`,
    refText,
    luz   ? `Lighting: ${luz}`                                                : "",
    look  ? `The visual style should follow: ${look.trim()}`                  : "The image should have a premium cinematic look with controlled contrast, realistic shadows, and refined color grading.",
    rules ? `Scene rules: ${rules.trim()}`                                    : "Keep the composition clean, coherent, and physically believable.",
    `Final image quality: ${qualityClosing}`,
    `Negative prompt: ${neg}`,
  ].filter(Boolean).join(". ") + ".";
}

/* ─────────── Icon ─────────── */
function Icon({ name, className = "h-4 w-4" }) {
  const p = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const d = {
    camera:   (<><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></>),
    lens:     (<><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 4v4M12 16v4"/></>),
    angle:    (<><path d="M4 18h16M6 18 18 6M18 6v7M18 6h-7"/></>),
    aperture: (<><circle cx="12" cy="12" r="9"/><path d="M12 3l3.5 6M21 12h-7M16.5 19 13 13M7.5 19l3.5-6M3 12h7M7.5 5 11 11"/></>),
    at:       (<><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></>),
    close:    (<><path d="M18 6 6 18m0-12 12 12"/></>),
    plus:     (<><path d="M12 5v14M5 12h14"/></>),
    copy:     (<><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>),
    edit:     (<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>),
    sun:      (<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></>),
    history:  (<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></>),
    bookmark: (<><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></>),
    trash:    (<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></>),
    arrow_left:  (<><path d="M19 12H5M12 5l-7 7 7 7"/></>),
    chevron_down:(<><path d="M6 9l6 6 6-6"/></>),
  };
  return <svg {...p}>{d[name]}</svg>;
}

/* ─────────── Pill ─────────── */
function Pill({ children, active, onClick, sm }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-medium transition-all",
        sm ? "h-8 px-3.5 text-xs" : "h-9 px-4 text-xs",
        active
          ? "border-white/18 bg-white/[.09] text-white"
          : "border-white/8 bg-white/[.03] text-white/45 hover:border-white/15 hover:text-white/75"
      )}
    >
      {children}
    </button>
  );
}

/* ─────────── OptionCard ─────────── */
function OptionCard({ icon, title, subtitle, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition",
        active
          ? "border-white/16 bg-white/[.07] text-white"
          : "border-white/7 bg-white/[.02] text-white/68 hover:border-white/14 hover:bg-white/[.05]"
      )}
    >
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border",
        active ? "border-white/16 bg-white/[.06] text-white/90" : "border-white/8 bg-black/20 text-white/40"
      )}>
        <Icon name={icon} className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-normal">{title}</p>
        {subtitle && <p className="mt-1 text-xs leading-normal text-white/40">{subtitle}</p>}
      </div>
    </button>
  );
}

/* ─────────── CameraSection ─────────── */
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

const LUZ_OPTS = [
  ["Low Key",           "sombras profundas, alto contraste"],
  ["High Key",          "luz uniforme, poucas sombras"],
  ["Luz Difusa",        "suave, sem sombras duras"],
  ["Luz Dura",          "sombras definidas, dramático"],
  ["Contraluz",         "silhueta, rim light"],
  ["Luz Natural",       "ambiente exterior real"],
  ["Chiaroscuro",       "claro-escuro clássico, renascentista"],
  ["Luz de Amanhecer",  "golden hour matinal"],
  ["Luz de Entardecer", "golden hour ao pôr do sol"],
  ["Luz de Vela",       "quente, íntimo, orgânico"],
  ["Luz de Janela",     "lateral suave, fotografia natural"],
  ["Neon / Colorida",   "luz sintética, urbano, sci-fi"],
  ["Rembrandt",         "triângulo de luz no rosto"],
  ["Luz de Estúdio",    "setup controlado, look comercial"],
  ["Luz Prática",       "fontes visíveis na cena"],
  ["Moonlight",         "azul frio, noturno suave"],
];

const LOOK_SECTIONS = [
  { label: "Iluminação", options: ["Soft natural daylight","Golden hour","Blue hour","Overcast diffused","Hard dramatic","Backlit rim","Studio three-point","Warm ambient interior","Neon practical","Natural moonlight"] },
  { label: "Color Grade",  options: ["Teal and amber","Soft neutral","Warm cinematic","Cool desaturated","High contrast","Bleach bypass","Kodak film emulation","Fuji film emulation","Black and white"] },
  { label: "Textura & Grain", options: ["Film grain","Clean digital","Heavy grain","16mm grain","Super 8 grain"] },
  { label: "Estilo Visual",   options: ["Photorealistic","Cinematic","Commercial ad","Editorial fashion","Documentary","Concept art","3D render","Illustration"] },
  { label: "Qualidade & Output", options: ["Ultra-detailed","Sharp focus","8K textures","High production value","Rich skin tones","No motion blur","No extra limbs","HDR","RAW look"] },
];

/* ─────────── FloatingPanel ─────────── */
function FloatingPanel({ title, onClose, gen, children }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-[360px] left-4 right-4 top-[68px] z-50 flex flex-col overflow-hidden rounded-2xl border backdrop-blur-3xl transition-all duration-500 sm:left-[60px] sm:right-[60px] md:bottom-[200px] md:left-[150px] md:right-[150px] md:rounded-[24px] lg:left-[200px] lg:right-[200px]"
        style={{
          background: `linear-gradient(to bottom right, ${gen.bgFrom}, rgba(7,9,15,.78))`,
          borderColor: gen.borderAccent,
          boxShadow: `0 28px_80px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.07), 0 0 80px ${gen.boxShadow}`,
        }}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-5 py-3.5" style={{ borderColor: gen.borderAccent }}>
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-0.5 text-xs text-white/38">Escolha uma opção para aplicar no prompt.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[.04] text-white/45 transition hover:text-white"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
      </div>
    </>
  );
}


/* ═══════════════════════════════════════════════
   Generators config
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   App
═══════════════════════════════════════════════ */
export default function MinimalPromptStudioComposer() {
  const navigate     = useNavigate();
  const fileInputRef = useRef(null);

  const [scene,      setScene]      = useState("");
  const [generator,  setGenerator]  = useState("nb");
  const gen = GENERATORS.find(g => g.id === generator) || GENERATORS[0];
  const [openPanel,  setOpenPanel]  = useState(null);
  const [camera,     setCamera]     = useState("Studio Digital S35");
  const [lens,       setLens]       = useState("Premium Modern Prime");
  const [focalLength,setFocalLength]= useState("35mm");
  const [aperture,   setAperture]   = useState("f/4");
  const [angles,     setAngles]     = useState([]);
  const [luz,        setLuz]        = useState("");
  const [lookTags,   setLookTags]   = useState([]);
  const [rules,      setRules]      = useState("");
  const [negative,   setNegative]   = useState("");
  const [references, setReferences] = useState([]);
  const [aspect,     setAspect]     = useState("16:9");
  const [results,    setResults]    = useState([]);
  const [copied,     setCopied]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [library,    setLibrary]    = useState([]);
  const [newPrompt,  setNewPrompt]  = useState('');
  const [modelOpen,  setModelOpen]  = useState(false);
  const modelRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('nb_sessions') || '[]');
      setResults(saved);
    } catch {}
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

  useEffect(() => {
    if (!modelOpen) return;
    const handler = (e) => { if (modelRef.current && !modelRef.current.contains(e.target)) setModelOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modelOpen]);

  const cameras   = ["Studio Digital S35","ARRI Alexa 35","ARRI Alexa Mini LF","RED V-Raptor","Sony Venice 2","Blackmagic URSA"];
  const lenses    = ["Premium Modern Prime","Anamorphic","Vintage Glass","Macro","Tilt-Shift","Cooke S4"];
  const focals    = ["24mm","35mm","50mm","85mm","100mm"];
  const apertures = ["f/1.4","f/2","f/2.8","f/4","f/8"];
  const camSubs   = { "Studio Digital S35":"clean cinematic digital","ARRI Alexa 35":"premium filmic range","ARRI Alexa Mini LF":"large format look","RED V-Raptor":"sharp commercial","Sony Venice 2":"soft high-end","Blackmagic URSA":"indie cinema feel" };
  const lensSubs  = { "Premium Modern Prime":"sharp controlled contrast","Anamorphic":"wide cinematic flares","Vintage Glass":"soft organic texture","Macro":"extreme close-up","Tilt-Shift":"miniature depth","Cooke S4":"warm portrait look" };
  const focalSubs = { "24mm":"wide environment","35mm":"natural cinematic","50mm":"classic focus","85mm":"compressed portrait","100mm":"macro detail" };
  const apertSubs = { "f/1.4":"very shallow field","f/2":"soft separation","f/2.8":"cinematic blur","f/4":"clean subject + scene","f/8":"deep focus" };
  const angleOpts = [
    ["Wide shot","ambiente geral"],["Medium shot","equilíbrio clássico"],["Close-up","rosto / produto"],
    ["Extreme close-up","detalhe extremo"],["Full shot","corpo inteiro"],["Two shot","dois personagens"],
    ["Low angle","poderoso, imponente"],["High angle","olhando de cima"],["Overhead","vista de cima"],
    ["Bird's eye","aéreo amplo"],["Worm's eye","raso, de baixo pra cima"],
    ["From behind","costas do personagem"],["Over the shoulder","por cima do ombro"],
    ["3/4 front","três-quartos"],["Side profile","perfil lateral"],
    ["Dutch angle","câmera inclinada"],["POV","ponto de vista"],
  ];

  const prompt = useMemo(
    () => buildPrompt({ scene, camera, lens, focalLength, aperture, angles, luz, look: lookTags.join(", "), rules, negative, references, aspect }),
    [scene, camera, lens, focalLength, aperture, angles, luz, lookTags, rules, negative, references, aspect]
  );

  const handleFiles = (files) => {
    const imgs = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setReferences((cur) => [...cur, ...imgs.map((f) => ({ id: `${f.name}-${Date.now()}-${Math.random()}`, name: f.name, url: URL.createObjectURL(f), label: "" }))]);
  };

  const translateScene = async (text) => {
    if (!text.trim()) return text;
    try {
      const res  = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=pt-BR|en-US&de=hello@merinno.com`);
      const data = await res.json();
      if (data.responseStatus === 200 && data.responseData?.translatedText) return data.responseData.translatedText;
    } catch { /* fallback */ }
    return text;
  };

  const generate = async () => {
    if (generating) return;
    setGenerating(true);
    setOpenPanel(null);
    try {
      const sceneEn = await translateScene(scene);
      const raw     = scene.trim();
      const title   = raw.length > 0 ? raw.slice(0, 80) + (raw.length > 80 ? '…' : '') : 'Novo prompt';

      let finalPrompt;
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scene: sceneEn, camera, lens, focalLength, aperture, angles,
            luz, look: lookTags.join(', '), rules, negative, references, aspect,
            examples: genLibrary.map(l => l.content),
            generatorId: generator,
          }),
        });
        if (!res.ok) throw new Error('api_error');
        const data = await res.json();
        finalPrompt = data.prompt;
      } catch {
        finalPrompt = buildPrompt({ scene: sceneEn, camera, lens, focalLength, aperture, angles, luz, look: lookTags.join(', '), rules, negative, references, aspect });
      }

      const sessionId = String(Date.now());
      const session = {
        id: sessionId, title, scene: raw, generator,
        prompt: finalPrompt,
        createdAt: new Date().toISOString(),
        messages: [{ id: 'p0', role: 'assistant', type: 'prompt', content: finalPrompt, createdAt: new Date().toISOString() }],
      };
      try {
        const saved = JSON.parse(localStorage.getItem('nb_sessions') || '[]');
        localStorage.setItem('nb_sessions', JSON.stringify([session, ...saved]));
      } catch {}
      setResults(cur => [session, ...cur]);
      navigate(`/studio2/chat/${sessionId}`);
    } finally {
      setGenerating(false);
    }
  };

  const genLibrary = library.filter(l => l.generator === generator);

  const addToLibrary = async () => {
    const text = newPrompt.trim();
    if (!text) return;
    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, generator }),
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

  const copyText = async (txt) => {
    try { await navigator.clipboard.writeText(txt); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* ignore */ }
  };

  const close = ()     => setOpenPanel(null);
  const toggle= (name) => setOpenPanel((p) => (p === name ? null : name));

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#08090d] text-white">

      {/* Background — themed by generator */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 transition-all duration-700"
          style={{ background: `radial-gradient(ellipse 75% 65% at 28% 62%, ${gen.glow1}, transparent)` }} />
        <div className="absolute inset-0 transition-all duration-700"
          style={{ background: `radial-gradient(ellipse 55% 45% at 60% 42%, ${gen.glow2}, transparent)` }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_110%,rgba(0,5,18,.70),transparent),radial-gradient(ellipse_55%_40%_at_100%_0%,rgba(0,4,14,.60),transparent),radial-gradient(ellipse_40%_35%_at_0%_0%,rgba(0,4,14,.50),transparent)]" />
      </div>

      {/* ── Header (fixed) ── */}
      <header
        className="fixed left-4 right-4 top-4 z-30 flex items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 backdrop-blur-3xl transition-all duration-500 sm:left-[60px] sm:right-[60px] md:left-[150px] md:right-[150px] lg:left-[200px] lg:right-[200px]"
        style={{
          background: `linear-gradient(to bottom right, ${gen.bgFrom}, rgba(7,9,15,.75))`,
          borderColor: gen.borderAccent,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,.06), 0 0 40px ${gen.boxShadow}`,
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={() => navigate('/')}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[.03] text-white/35 hover:border-white/14 hover:text-white/70 transition"
            title="Voltar ao Hub">
            <Icon name="arrow_left" className="h-3.5 w-3.5" />
          </button>
          {/* Logo */}
          <span className="bg-gradient-to-b from-white/92 via-white/70 to-white/30 bg-clip-text text-xl font-black tracking-tight text-transparent select-none">
            TSD
          </span>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="hidden sm:block w-px h-4 bg-white/10 shrink-0" />
            {/* Generator switcher dropdown */}
            <div className="relative shrink-0" ref={modelRef}>
              <button
                type="button"
                onClick={() => setModelOpen(o => !o)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  modelOpen
                    ? "border-white/18 bg-white/[.08] text-white/90"
                    : "border-white/10 bg-white/[.04] text-white/55 hover:border-white/16 hover:text-white/80"
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full transition-colors duration-300" style={{ background: gen.accent }} />
                {gen.label}
                <Icon name="chevron_down" className={cn("h-3 w-3 transition-transform", modelOpen && "rotate-180")} />
              </button>
              {modelOpen && (
                <div className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-[170px] overflow-hidden rounded-xl border border-white/10 bg-[#0d111e]/95 shadow-[0_8px_32px_rgba(0,0,0,.6)] backdrop-blur-2xl">
                  {GENERATORS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => { setGenerator(g.id); setModelOpen(false); }}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-white/[.05]",
                        g.id === generator ? "text-white" : "text-white/50 hover:text-white/80"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: g.accent }} />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold">{g.label}</span>
                          <span className="text-[10px] text-white/30">{g.tag}</span>
                        </div>
                      </div>
                      {g.id === generator && <span className="h-1 w-1 shrink-0 rounded-full bg-white/40" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/* Library button */}
          <button
            type="button"
            onClick={() => toggle("library")}
            title="Biblioteca de prompts"
            className={cn(
              "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition",
              openPanel === "library"
                ? "border-white/18 bg-white/[.08] text-white/80"
                : "border-white/8 bg-white/[.03] text-white/35 hover:border-white/14 hover:text-white/60"
            )}
          >
            <Icon name="bookmark" className="h-3.5 w-3.5" />
            {genLibrary.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold transition-colors duration-300"
                style={{ background: gen.accent, color: gen.dark }}>
                {genLibrary.length}
              </span>
            )}
          </button>
          {/* History button */}
          <button
            type="button"
            onClick={() => toggle("history")}
            title="Histórico de prompts"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition",
              openPanel === "history"
                ? "border-white/18 bg-white/[.08] text-white/80"
                : "border-white/8 bg-white/[.03] text-white/35 hover:border-white/14 hover:text-white/60"
            )}
          >
            <Icon name="history" className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <main className="relative flex min-h-screen flex-col gap-4 p-4 pt-[84px] md:p-6 md:pt-[88px]">

        {/* Full-screen bottom fade — behind the bar (z-20 < z-30) */}
        <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-20 h-[26rem] bg-gradient-to-t from-[#020304] from-50% to-transparent" />

        {/* ── Canvas ── */}
        <section className="relative flex min-h-0 flex-1 items-center justify-center overflow-x-hidden rounded-[28px] border border-white/6 bg-white/[.015] pb-[380px] md:pb-[210px]">
          {/* corner brackets */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[30%] top-[22%] h-5 w-5 border-l-2 border-t-2 border-white/12 md:left-[35%]" />
            <div className="absolute right-[30%] top-[22%] h-5 w-5 border-r-2 border-t-2 border-white/12 md:right-[35%]" />
            <div className="absolute bottom-[22%] left-[30%] h-5 w-5 border-b-2 border-l-2 border-white/12 md:left-[35%]" />
            <div className="absolute bottom-[22%] right-[30%] h-5 w-5 border-b-2 border-r-2 border-white/12 md:right-[35%]" />
          </div>

          {/* Bottom fade — full-width gradient, cards fade before reaching the bar */}

          {/* Hero — sempre visível */}
          <div className="relative z-[1] mx-auto flex w-full max-w-2xl flex-col items-center px-6 py-16 text-center md:px-10 md:py-20">
            <p className="mb-4 text-[9px] font-semibold uppercase tracking-[.48em] transition-colors duration-500" style={{ color: gen.accent, opacity: 0.7 }}>{gen.tag}</p>
            <h1 className="bg-gradient-to-b from-white/92 via-white/65 to-white/22 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl md:text-7xl">
              {gen.label}
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/28">
              Descreva sua cena, configure câmera, luz e estilo. Ao gerar, você entra no chat do prompt.
            </p>
            {/* Decorative ring */}
            <div className="mt-10 flex h-14 w-14 items-center justify-center rounded-full border border-white/8 transition-colors duration-500"
              style={{ borderColor: `rgba(${gen.rgb},.2)` }}>
              <div className="h-2.5 w-2.5 rounded-full transition-colors duration-500" style={{ background: `rgba(${gen.rgb},.4)` }} />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════
            Floating Panels
        ══════════════════════════════════════════ */}

        {openPanel === "history" && (
          <FloatingPanel title="Histórico de prompts" onClose={close} gen={gen}>
            {results.length === 0 ? (
              <div className="flex min-h-[120px] items-center justify-center text-sm text-white/28">
                Nenhum prompt gerado ainda.
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-white/6">
                {results.map((session) => (
                  <div key={session.id} className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white/82">{session.title || 'Prompt'}</p>
                      <p className="mt-0.5 text-[11px] text-white/30">
                        {new Date(session.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { close(); navigate(`/studio2/chat/${session.id}`); }}
                      className="shrink-0 rounded-full border border-white/10 bg-white/[.04] px-4 py-1.5 text-xs font-medium text-white/55 transition hover:text-white"
                    >
                      Abrir →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </FloatingPanel>
        )}

        {openPanel === "library" && (
          <FloatingPanel title={`Biblioteca · ${gen.label}`} onClose={close} gen={gen}>
            <div className="flex flex-col gap-6">
              {/* Add new prompt */}
              <div className="flex flex-col gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-white/38">Adicionar prompt validado</p>
                <textarea
                  value={newPrompt}
                  onChange={e => setNewPrompt(e.target.value)}
                  rows={5}
                  placeholder={`Cole aqui um prompt testado para ${gen.label}. O agente vai aprender com ele para gerar novos prompts no mesmo estilo.`}
                  className="w-full resize-none rounded-xl border bg-black/25 p-4 text-sm leading-relaxed text-white/78 outline-none placeholder:text-white/22"
                  style={{ borderColor: `rgba(${gen.rgb},.15)` }}
                />
                <button
                  type="button"
                  onClick={addToLibrary}
                  disabled={!newPrompt.trim()}
                  className="self-start rounded-full px-5 py-2 text-xs font-semibold transition hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: gen.accent, color: gen.dark }}
                >
                  Salvar em {gen.label}
                </button>
              </div>

              {/* Divider */}
              {genLibrary.length > 0 && <div className="border-t" style={{ borderColor: `rgba(${gen.rgb},.1)` }} />}

              {/* List */}
              {genLibrary.length === 0 ? (
                <div className="flex min-h-[80px] items-center justify-center rounded-xl border border-white/6 text-sm text-white/25">
                  Nenhum prompt de {gen.label} ainda.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-white/38">
                    {genLibrary.length} prompt{genLibrary.length !== 1 ? 's' : ''} · {gen.label}
                  </p>
                  {genLibrary.map((item, i) => (
                    <div key={item.id} className="group flex items-start gap-3 rounded-xl border bg-white/[.02] p-4" style={{ borderColor: `rgba(${gen.rgb},.08)` }}>
                      <span className="mt-0.5 shrink-0 text-[10px] font-bold" style={{ color: `rgba(${gen.rgb},.4)` }}>{String(i + 1).padStart(2, '0')}</span>
                      <p className="min-w-0 flex-1 text-xs leading-relaxed text-white/55 line-clamp-3">{item.content}</p>
                      <button
                        type="button"
                        onClick={() => removeFromLibrary(item.id)}
                        className="shrink-0 text-white/20 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                        title="Remover"
                      >
                        <Icon name="trash" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FloatingPanel>
        )}

        {openPanel === "camera" && (
          <FloatingPanel title="Setup de câmera" onClose={close} gen={gen}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <CameraSection icon="camera" label="Câmera">
                {cameras.map((c) => <OptionCard key={c} icon="camera" title={c} subtitle={camSubs[c]} active={camera===c} onClick={()=>setCamera(c)} />)}
              </CameraSection>
              <CameraSection icon="lens" label="Lente">
                {lenses.map((l) => <OptionCard key={l} icon="lens" title={l} subtitle={lensSubs[l]} active={lens===l} onClick={()=>setLens(l)} />)}
              </CameraSection>
              <CameraSection icon="lens" label="Focal">
                {focals.map((f) => <OptionCard key={f} icon="lens" title={f} subtitle={focalSubs[f]} active={focalLength===f} onClick={()=>setFocalLength(f)} />)}
              </CameraSection>
              <CameraSection icon="aperture" label="Abertura">
                {apertures.map((a) => <OptionCard key={a} icon="aperture" title={a} subtitle={apertSubs[a]} active={aperture===a} onClick={()=>setAperture(a)} />)}
              </CameraSection>
            </div>
          </FloatingPanel>
        )}

        {openPanel === "angles" && (
          <FloatingPanel title="Ângulos e enquadramentos" onClose={close} gen={gen}>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {angleOpts.map(([t, s]) => (
                <OptionCard key={t} icon="angle" title={t} subtitle={s} active={angles.includes(t)} onClick={() => setAngles((cur) => toggleInArray(cur, t))} />
              ))}
            </div>
          </FloatingPanel>
        )}

        {openPanel === "luz" && (
          <FloatingPanel title="Luz" onClose={close} gen={gen}>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {LUZ_OPTS.map(([name, sub]) => (
                <OptionCard
                  key={name}
                  icon="sun"
                  title={name}
                  subtitle={sub}
                  active={luz === name}
                  onClick={() => setLuz((cur) => cur === name ? "" : name)}
                />
              ))}
            </div>
          </FloatingPanel>
        )}

        {openPanel === "look" && (
          <FloatingPanel title="Look & Estilo" onClose={close} gen={gen}>
            <div className="flex flex-col gap-6">
              {LOOK_SECTIONS.map(({ label, options }) => (
                <div key={label}>
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.14em] text-white/38">{label}</p>
                  <div className="flex flex-wrap gap-2">
                    {options.map((opt) => (
                      <Pill
                        key={opt}
                        sm
                        active={lookTags.includes(opt)}
                        onClick={() => setLookTags((cur) => toggleInArray(cur, opt))}
                      >
                        {opt}
                      </Pill>
                    ))}
                  </div>
                </div>
              ))}
              {lookTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLookTags([])}
                  className="self-start rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-white/40 transition hover:text-white/70"
                >
                  Limpar seleção ({lookTags.length})
                </button>
              )}
            </div>
          </FloatingPanel>
        )}

        {openPanel === "rules" && (
          <FloatingPanel title="Regras e negative prompt" onClose={close} gen={gen}>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="flex flex-col gap-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-white/38">Regras da cena</p>
                <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={7}
                  placeholder="Manter personagem, não trocar fundo, preservar composição..."
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-7 text-white/78 outline-none placeholder:text-white/22 focus:border-white/20" />
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-white/38">Negative prompt</p>
                <textarea value={negative} onChange={(e) => setNegative(e.target.value)} rows={7}
                  placeholder="Blurry, deformed, low quality, extra objects, distorted logo..."
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/25 p-4 text-sm leading-7 text-white/78 outline-none placeholder:text-white/22 focus:border-white/20" />
              </div>
            </div>
          </FloatingPanel>
        )}

        {openPanel === "references" && (
          <FloatingPanel title="Imagens de referência" onClose={close} gen={gen}>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            <div className="flex flex-col gap-5">
              {/* Add button */}
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center gap-4 rounded-xl border border-dashed border-white/14 bg-white/[.025] px-5 py-4 text-left transition hover:border-sky-400/30 hover:bg-sky-400/[.03]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-white/55">
                  <Icon name="plus" className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/70">Adicionar imagens</p>
                  <p className="mt-0.5 text-xs text-white/32">Cada imagem vira @image_1, @image_2… · Descreva abaixo o que cada uma contém para usar no prompt</p>
                </div>
              </button>

              {/* Grid */}
              {references.length === 0 ? (
                <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-white/8 text-sm text-white/25">
                  Nenhuma imagem adicionada ainda.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {references.map((r, i) => (
                    <div key={r.id} className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[.02]">
                      {/* Thumbnail */}
                      <div className="relative">
                        <img src={r.url} alt={r.name} className="h-52 w-full object-cover" />
                        <div className="absolute left-2 top-2 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-bold text-sky-300 backdrop-blur-sm">
                          @image_{i + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => setReferences((c) => c.filter((x) => x.id !== r.id))}
                          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white/65 opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:text-white"
                        >
                          <Icon name="close" className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* Label */}
                      <div className="flex flex-col gap-1.5 px-3 py-3">
                        <p className="truncate text-[10px] text-white/30">{r.name}</p>
                        <input
                          type="text"
                          value={r.label || ""}
                          onChange={e => updateReferenceLabel(r.id, e.target.value)}
                          placeholder={`O que é @image_${i + 1}? Ex: pai entrando pela porta`}
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs leading-normal text-white/78 outline-none placeholder:text-white/22 focus:border-sky-400/35 focus:bg-black/40"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FloatingPanel>
        )}

        {/* ══════════════════════════════════════════
            Bottom bar
        ══════════════════════════════════════════ */}
        <section
          className="fixed bottom-4 left-4 right-4 z-30 flex flex-col overflow-hidden rounded-[24px] border backdrop-blur-3xl transition-all duration-500 sm:left-[60px] sm:right-[60px] md:bottom-5 md:left-[150px] md:right-[150px] md:rounded-[28px] lg:left-[200px] lg:right-[200px]"
          aria-label="Composição do prompt"
          style={{
            background: `linear-gradient(to bottom right, ${gen.bgFrom}, rgba(7,9,15,.75))`,
            borderColor: gen.borderAccent,
            boxShadow: `0 20px 60px rgba(0,0,0,.60), inset 0 1px 0 rgba(255,255,255,.06), 0 0 60px ${gen.boxShadow}`,
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3 [scrollbar-gutter:stable] md:p-4">
            {/* Row: scene | camera | generate */}
            <div className="flex flex-col gap-2.5 md:flex-row md:items-stretch md:gap-3">

              {/* Scene + pills */}
              <div className="min-w-0 flex-1 rounded-[16px] border border-white/10 bg-white/[.04] px-4 py-3 md:px-5 md:py-3.5">
                <textarea
                  value={scene}
                  onChange={(e) => setScene(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generate(); } }}
                  rows={2}
                  placeholder="Descreva sua cena — Enter para gerar, Shift+Enter para nova linha"
                  className="w-full min-h-[2.75rem] resize-y bg-transparent text-sm leading-relaxed text-white/78 outline-none placeholder:text-white/32 md:min-h-0 md:resize-none md:text-base"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill active={openPanel==="angles"||angles.length>0} onClick={()=>toggle("angles")}><Icon name="angle"/>Ângulos{angles.length?` (${angles.length})`:""}</Pill>
                  <Pill active={openPanel==="luz"||Boolean(luz)} onClick={()=>toggle("luz")}><Icon name="sun"/>Luz{luz?` · ${luz}`:""}</Pill>
                  <Pill active={openPanel==="look"||lookTags.length>0} onClick={()=>toggle("look")}>Look & Estilo{lookTags.length?` (${lookTags.length})`:""}</Pill>
                  <Pill active={openPanel==="rules"||Boolean(rules||negative)} onClick={()=>toggle("rules")}>Regras</Pill>
                  <Pill active={openPanel==="references"||references.length>0} onClick={()=>toggle("references")}><Icon name="at"/>Imagens{references.length?` (${references.length})`:""}</Pill>
                </div>
              </div>

              {/* Camera info */}
              <button
                type="button"
                onClick={()=>toggle("camera")}
                className="shrink-0 rounded-[18px] border border-white/10 bg-white/[.04] px-4 py-3 text-left transition hover:bg-white/[.07] md:w-[160px] md:px-4 md:py-3.5"
              >
                <p className="text-sm font-semibold leading-normal text-white/88">{camera}</p>
                <p className="mt-1.5 text-xs text-white/45">{lens}</p>
                <p className="mt-0.5 text-xs text-white/38">{focalLength} · {aperture}</p>
              </button>

              {/* Generate */}
              <button
                type="button"
                onClick={generate}
                disabled={generating}
                className="flex shrink-0 items-center justify-center rounded-[16px] px-4 py-2.5 text-xs font-black tracking-wide transition duration-300 md:w-[100px] md:py-3 md:text-sm hover:brightness-105 active:scale-[.98] disabled:cursor-wait disabled:opacity-50"
                style={{
                  background: gen.accent,
                  color: gen.dark,
                  boxShadow: `0 4px 20px rgba(${gen.rgb},.28)`,
                }}
              >
                {generating ? "..." : "GENERATE ✦"}
              </button>
            </div>

            {/* Format pills + model selector */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {["9:16","16:9","1:1","4:5"].map((v) => <Pill key={v} active={aspect===v} onClick={()=>setAspect(v)}>{v}</Pill>)}
              {copied && <span className="ml-auto rounded-full border border-white/10 bg-white/[.05] px-3 py-1.5 text-xs text-white/60">Copiado ✓</span>}
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
