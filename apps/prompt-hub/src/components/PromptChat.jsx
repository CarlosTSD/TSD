import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GENERATORS } from '../config/generators';

function cn(...cls) { return cls.filter(Boolean).join(' '); }

function Icon({ name, className = "h-4 w-4" }) {
  const p = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.7", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const d = {
    arrow_left: (<><path d="M19 12H5M12 5l-7 7 7 7"/></>),
    copy:       (<><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>),
    send:       (<><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>),
    sparkle:    (<><path d="M12 3l1.8 5.5H19l-4.6 3.4 1.8 5.5L12 14l-4.2 3.4 1.8-5.5L5 8.5h5.2z"/></>),
    edit:       (<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>),
    angle:      (<><path d="M4 18h16M6 18 18 6M18 6v7M18 6h-7"/></>),
    chevron_down:(<><path d="M6 9l6 6 6-6"/></>),
  };
  return <svg {...p}>{d[name]}</svg>;
}

const ANGLE_OPTS = [
  ["Wide shot",        "ambiente geral"],
  ["Medium shot",      "equilíbrio clássico"],
  ["Close-up",         "rosto / produto"],
  ["Extreme close-up", "detalhe extremo"],
  ["Full shot",        "corpo inteiro"],
  ["Low angle",        "poderoso, imponente"],
  ["High angle",       "olhando de cima"],
  ["Bird's eye",       "aéreo amplo"],
  ["Worm's eye",       "raso, de baixo pra cima"],
  ["From behind",      "costas do personagem"],
  ["Over the shoulder","por cima do ombro"],
  ["3/4 front",        "três-quartos"],
  ["Side profile",     "perfil lateral"],
  ["Dutch angle",      "câmera inclinada"],
  ["POV",              "ponto de vista"],
  ["Two shot",         "dois personagens"],
];

function formatPrompt(text) {
  return text.replace(/\. /g, '.\n').trim();
}

function loadSession(id) {
  try {
    return JSON.parse(localStorage.getItem('nb_sessions') || '[]').find(s => s.id === id) || null;
  } catch { return null; }
}

function persistSession(session) {
  try {
    const all = JSON.parse(localStorage.getItem('nb_sessions') || '[]');
    const idx = all.findIndex(s => s.id === session.id);
    if (idx >= 0) all[idx] = session; else all.unshift(session);
    localStorage.setItem('nb_sessions', JSON.stringify(all));
  } catch {}
}

export default function PromptChat() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [variationOpenId, setVariationOpenId] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const variationRef = useRef(null);

  useEffect(() => {
    if (!variationOpenId) return;
    const handler = (e) => { if (variationRef.current && !variationRef.current.contains(e.target)) setVariationOpenId(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [variationOpenId]);

  useEffect(() => { setSession(loadSession(sessionId)); }, [sessionId]);

  useEffect(() => {
    if (session?.messages?.length) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  }, [session?.messages?.length]);

  const updateSession = (updated) => { setSession(updated); persistSession(updated); };

  const applyFormat = (text) => session?.generator === 'gpt2' ? text : formatPrompt(text);

  const copyText = async (text, key) => {
    try { await navigator.clipboard.writeText(applyFormat(text)); setCopied(key); setTimeout(() => setCopied(null), 1400); } catch {}
  };

  const startEdit = (msg) => { setEditingId(msg.id); setEditText(msg.content); };
  const cancelEdit = () => { setEditingId(null); setEditText(''); };
  const saveEdit = (msg) => {
    const text = editText.trim();
    if (!text || text === msg.content) { cancelEdit(); return; }
    updateSession({ ...session, messages: session.messages.map(m => m.id === msg.id ? { ...m, content: text } : m) });
    cancelEdit();
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !session) return;
    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: input.trim(), createdAt: new Date().toISOString() };
    const lastPromptMsg = [...session.messages].reverse().find(m => m.type === 'prompt' || m.type === 'refined');
    const currentPrompt = lastPromptMsg?.content || '';
    const withUser = { ...session, messages: [...session.messages, userMsg] };
    updateSession(withUser);
    setInput('');
    setLoading(true);

    const history = [];
    for (const m of session.messages) {
      if (m.role === 'user') history.push({ role: 'user', content: `User request: "${m.content}"` });
      else if (m.type === 'refined') history.push({ role: 'assistant', content: m.content });
    }

    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPrompt, history, userMessage: userMsg.content, generatorId: session.generator }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const { prompt, note } = await res.json();
      const aiMsg = { id: `a-${Date.now()}`, role: 'assistant', type: 'refined', content: prompt, note: note || '', createdAt: new Date().toISOString() };
      updateSession({ ...withUser, messages: [...withUser.messages, aiMsg] });
    } catch (err) {
      const errMsg = { id: `e-${Date.now()}`, role: 'assistant', type: 'refined', content: `Erro ao refinar o prompt: ${err.message}`, createdAt: new Date().toISOString() };
      updateSession({ ...withUser, messages: [...withUser.messages, errMsg] });
    }

    setLoading(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const sendVariation = async (msg, angleName) => {
    setVariationOpenId(null);
    if (loading || !session) return;
    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: `Change the shot angle to: ${angleName}`, createdAt: new Date().toISOString() };
    const lastPrompt = [...session.messages].reverse().find(m => m.type === 'prompt' || m.type === 'refined');
    const currentPrompt = lastPrompt?.content || msg.content;
    const withUser = { ...session, messages: [...session.messages, userMsg] };
    updateSession(withUser);
    setLoading(true);

    const history = [];
    for (const m of session.messages) {
      if (m.role === 'user') history.push({ role: 'user', content: `User request: "${m.content}"` });
      else if (m.type === 'refined') history.push({ role: 'assistant', content: m.content });
    }

    try {
      const res = await fetch('/api/refine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPrompt, history, userMessage: userMsg.content, generatorId: session.generator }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const { prompt, note } = await res.json();
      const aiMsg = { id: `a-${Date.now()}`, role: 'assistant', type: 'refined', content: prompt, note: note || '', createdAt: new Date().toISOString() };
      updateSession({ ...withUser, messages: [...withUser.messages, aiMsg] });
    } catch (err) {
      const errMsg = { id: `e-${Date.now()}`, role: 'assistant', type: 'refined', content: `Erro ao gerar variação: ${err.message}`, createdAt: new Date().toISOString() };
      updateSession({ ...withUser, messages: [...withUser.messages, errMsg] });
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#05080f] text-white/40">
        <p className="text-sm">Sessão não encontrada.</p>
        <button onClick={() => navigate('/studio2')}
          className="rounded-full border border-white/10 bg-white/[.04] px-5 py-2 text-xs text-white/55 transition hover:text-white">
          ← Voltar ao Studio
        </button>
      </div>
    );
  }

  const gen = GENERATORS.find(g => g.id === session.generator) || GENERATORS[0];
  const backPath = session.generator === 'kling' ? '/studio3' : '/studio2';
  const userCount = session.messages.filter(m => m.role === 'user').length;
  const headerTitle = session.scene || session.title || 'Prompt Chat';

  const boxStyle = {
    background: `linear-gradient(to bottom right, ${gen.bgFrom}, rgba(7,9,15,.75))`,
    borderColor: gen.borderAccent,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,.06), 0 0 40px ${gen.boxShadow}`,
  };

  return (
    <div className="relative min-h-screen bg-[#08090d] text-white">

      {/* Background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 75% 65% at 28% 62%, ${gen.glow1}, transparent)` }} />
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 55% 45% at 60% 42%, ${gen.glow2}, transparent)` }} />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_110%,rgba(0,5,18,.70),transparent),radial-gradient(ellipse_55%_40%_at_100%_0%,rgba(0,4,14,.60),transparent),radial-gradient(ellipse_40%_35%_at_0%_0%,rgba(0,4,14,.50),transparent)]" />
      </div>

      {/* Header */}
      <header
        className="fixed left-4 right-4 top-4 z-30 flex items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 backdrop-blur-3xl sm:left-[60px] sm:right-[60px] md:left-[150px] md:right-[150px] lg:left-[200px] lg:right-[200px]"
        style={boxStyle}
      >
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={() => navigate(backPath)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/8 bg-white/[.04] text-white/45 transition hover:text-white">
            <Icon name="arrow_left" className="h-3.5 w-3.5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-white/88">{headerTitle}</p>
            <p className="text-[10px] text-white/30">
              {userCount === 0 ? 'Nenhuma interação' : `${userCount} interaç${userCount === 1 ? 'ão' : 'ões'}`}
            </p>
          </div>
        </div>
        {/* Generator badge — informativo */}
        <span
          className="shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide"
          style={{ borderColor: gen.borderAccent, color: gen.accent, background: `rgba(${gen.rgb},.07)` }}
        >
          {gen.label}
        </span>
      </header>

      {/* Messages */}
      <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-32 pt-[82px] md:px-6 md:pt-[88px]">

        {userCount === 0 && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <p className="mb-3 text-[9px] font-semibold uppercase tracking-[.45em]" style={{ color: gen.accent, opacity: 0.6 }}>{gen.tag}</p>
            <h1 className="bg-gradient-to-b from-white/90 via-white/70 to-white/30 bg-clip-text text-5xl font-bold tracking-tight text-transparent md:text-6xl">
              {gen.label}
            </h1>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/28">
              Seu prompt está pronto. Refine, edite ou copie abaixo.
            </p>
            <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-full border transition-colors"
              style={{ borderColor: `rgba(${gen.rgb},.2)` }}>
              <div className="h-2 w-2 rounded-full" style={{ background: `rgba(${gen.rgb},.4)` }} />
            </div>
          </div>
        )}

        {session.messages.map((msg) =>
          msg.role === 'user' ? (
            <div key={msg.id} className="flex justify-end">
              <div className="max-w-[85%] md:max-w-[72%]">
                <div className="rounded-2xl rounded-tr-sm border border-white/8 bg-white/[.06] px-4 py-3 backdrop-blur-sm">
                  <p className="text-sm leading-relaxed text-white/80">{msg.content}</p>
                </div>
                <p className="mt-1.5 text-right text-[10px] text-white/20">
                  {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ) : (
            <div key={msg.id} className="flex flex-col gap-2">
              {msg.type === 'refined' && (
                <div className="flex items-center gap-1.5">
                  <Icon name="sparkle" className="h-3 w-3" style={{ color: `rgba(${gen.rgb},.5)` }} />
                  <span className="text-[10px] font-semibold uppercase tracking-[.14em]" style={{ color: `rgba(${gen.rgb},.5)` }}>Prompt refinado</span>
                </div>
              )}
              {msg.type === 'prompt' && (
                <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-white/28">Prompt inicial</p>
              )}

              <div className="rounded-2xl rounded-tl-sm border bg-black/40 px-5 py-5 backdrop-blur-2xl"
                style={{ borderColor: `rgba(${gen.rgb},.1)` }}>
                {editingId === msg.id ? (
                  <div className="flex flex-col gap-3">
                    <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={8}
                      className="w-full resize-none rounded-xl border border-white/10 bg-black/30 p-3 text-sm leading-relaxed text-white/78 outline-none focus:border-white/20" />
                    <div className="flex justify-end gap-2">
                      <button onClick={cancelEdit}
                        className="rounded-full border border-white/8 px-4 py-1.5 text-xs text-white/40 transition hover:text-white">
                        Cancelar
                      </button>
                      <button onClick={() => saveEdit(msg)}
                        className="rounded-full px-4 py-1.5 text-xs font-semibold transition hover:brightness-110"
                        style={{ background: gen.accent, color: gen.dark }}>
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                      {msg.note && (
                      <div className="mb-4 rounded-xl border-l-2 bg-white/[.03] px-4 py-3"
                        style={{ borderColor: `rgba(${gen.rgb},.4)` }}>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.14em]" style={{ color: `rgba(${gen.rgb},.6)` }}>O que foi alterado</p>
                        <p className="text-xs leading-relaxed text-white/50">{msg.note}</p>
                      </div>
                    )}
                    <p className="whitespace-pre-line text-sm leading-7 text-white/68">{applyFormat(msg.content)}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button onClick={() => copyText(msg.content, msg.id)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[.04] px-3 py-1.5 text-xs font-medium text-white/45 transition hover:text-white">
                        <Icon name="copy" className="h-3 w-3" />
                        {copied === msg.id ? 'Copied ✓' : 'Copy'}
                      </button>
                      <button onClick={() => startEdit(msg)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/[.04] px-3 py-1.5 text-xs font-medium text-white/45 transition hover:text-white">
                        <Icon name="edit" className="h-3 w-3" /> Edit
                      </button>
                      {/* Variation button */}
                      <div className="relative" ref={variationOpenId === msg.id ? variationRef : null}>
                        <button
                          onClick={() => setVariationOpenId(id => id === msg.id ? null : msg.id)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                            variationOpenId === msg.id
                              ? "border-white/16 bg-white/[.08] text-white/80"
                              : "border-white/8 bg-white/[.04] text-white/45 hover:text-white"
                          )}
                        >
                          <Icon name="angle" className="h-3 w-3" />
                          Variation
                          <Icon name="chevron_down" className={cn("h-2.5 w-2.5 transition-transform", variationOpenId === msg.id && "rotate-180")} />
                        </button>
                        {variationOpenId === msg.id && (
                          <div className="absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#0d111e]/96 shadow-[0_12px_40px_rgba(0,0,0,.7)] backdrop-blur-2xl">
                            <div className="border-b border-white/8 px-4 py-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-white/35">Shot Angle Variation</p>
                            </div>
                            <div className="grid grid-cols-2 gap-px bg-white/5 max-h-72 overflow-y-auto">
                              {ANGLE_OPTS.map(([name, sub]) => (
                                <button
                                  key={name}
                                  onClick={() => sendVariation(msg, name)}
                                  className="flex flex-col gap-0.5 bg-[#0d111e] px-3.5 py-3 text-left transition hover:bg-white/[.05]"
                                >
                                  <span className="text-xs font-medium text-white/75">{name}</span>
                                  <span className="text-[10px] text-white/28">{sub}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <p className="text-[10px] text-white/18">
                {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )
        )}

        {loading && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Icon name="sparkle" className="h-3 w-3" style={{ color: `rgba(${gen.rgb},.4)` }} />
              <span className="text-[10px] font-semibold uppercase tracking-[.14em]" style={{ color: `rgba(${gen.rgb},.4)` }}>Refinando…</span>
            </div>
            <div className="w-fit rounded-2xl rounded-tl-sm border bg-black/40 px-5 py-4 backdrop-blur-2xl"
              style={{ borderColor: `rgba(${gen.rgb},.1)` }}>
              <div className="flex items-center gap-1.5">
                {[0, 130, 260].map(d => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full"
                    style={{ background: `rgba(${gen.rgb},.5)`, animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* Bottom input */}
      <div className="fixed bottom-4 left-4 right-4 z-30 sm:left-[60px] sm:right-[60px] md:left-[150px] md:right-[150px] lg:left-[200px] lg:right-[200px]">
        <div className="flex items-end gap-2 rounded-[22px] border p-2.5 pl-4 backdrop-blur-3xl" style={boxStyle}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Faça uma alteração no prompt ou escreva algo…"
            className="min-h-[38px] flex-1 resize-none bg-transparent py-2 text-sm leading-relaxed text-white/75 outline-none placeholder:text-white/22"
            style={{ maxHeight: '120px' }}
          />
          <button type="button" onClick={sendMessage} disabled={!input.trim() || loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold transition hover:brightness-110 disabled:opacity-25 disabled:cursor-not-allowed"
            style={{ background: gen.accent, color: gen.dark }}>
            <Icon name="send" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

    </div>
  );
}
