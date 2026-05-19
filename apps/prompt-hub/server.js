import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';

const execFileP = promisify(execFile);

const SESSION_FILE = path.resolve('.hf_session.json');
function saveSession() {
  try { fs.writeFileSync(SESSION_FILE, JSON.stringify({ accessToken: hfAuth.accessToken, refreshToken: hfAuth.refreshToken, expiresAt: hfAuth.expiresAt })); } catch {}
}
function loadSession() {
  try { const d = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); hfAuth.accessToken = d.accessToken; hfAuth.refreshToken = d.refreshToken; hfAuth.expiresAt = d.expiresAt; console.log('[auth] Sessão carregada do disco'); } catch {}
}

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '60mb' })); // base64 de imagens/vídeos de referência

const client = new Anthropic();
const openai = process.env.OPENAI_API_KEY ? new OpenAI() : null;

// ── Embeddings (RAG): seleciona top-K exemplos da biblioteca por similaridade ──
const EMBED_MODEL = 'text-embedding-3-small';
const EMBED_FILE = path.resolve('.library-embeddings.json');
const TOP_K_DEFAULT = 5;

function loadEmbeddings() {
  try { const d = JSON.parse(fs.readFileSync(EMBED_FILE, 'utf8')); return d && typeof d === 'object' ? d : {}; }
  catch { return {}; }
}
function saveEmbeddings(map) {
  try { fs.writeFileSync(EMBED_FILE, JSON.stringify(map)); }
  catch (e) { console.error('[embed] save failed:', e.message); }
}

async function embedText(text) {
  if (!openai) throw new Error('OPENAI_API_KEY ausente — RAG desativado');
  const r = await openai.embeddings.create({ model: EMBED_MODEL, input: text });
  return r.data[0].embedding;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// Score do usuário (👍/👎) entra no ranking, capado pra não atropelar similaridade semântica
const SCORE_WEIGHT = 0.03; // 1 polegar = ±3% no rank
const SCORE_CAP = 0.18;    // máx ±18% (≈ 6 polegares saturam)

async function topKExamples({ query, generator, k = TOP_K_DEFAULT }) {
  if (!query || !openai) return [];
  const items = loadLibrary().filter(l => l.generator === generator);
  if (!items.length) return [];

  const map = loadEmbeddings();
  const missing = items.filter(it => !map[it.id]);
  if (missing.length) {
    try {
      const resp = await openai.embeddings.create({ model: EMBED_MODEL, input: missing.map(m => m.content) });
      resp.data.forEach((d, i) => { map[missing[i].id] = d.embedding; });
      saveEmbeddings(map);
    } catch (e) { console.error('[embed] lazy embed failed:', e.message); }
  }

  let queryVec;
  try { queryVec = await embedText(query); }
  catch (e) {
    console.error('[embed] query failed:', e.message);
    return items.slice(0, k).map(i => ({ id: i.id, content: i.content, score: 0 }));
  }

  return items
    .filter(it => map[it.id])
    .map(it => {
      const sim = cosine(queryVec, map[it.id]);
      const bonus = Math.max(-SCORE_CAP, Math.min(SCORE_CAP, (it.score || 0) * SCORE_WEIGHT));
      return { id: it.id, content: it.content, sim, score: it.score || 0, rank: sim + bonus };
    })
    .sort((a, b) => b.rank - a.rank)
    .slice(0, k);
}

function enforceResolution(text) {
  return text.replace(/\b(?:HD|2K|4K|1080p|720p|4096|2048|1920)[^\w,.]*/gi, 'ultra resolution, 8K ');
}

// Reforço de ângulos top-down / overhead — modelos de imagem têm viés forte pra eye-level
const ANGLE_REINFORCEMENT_RULE = `ANGLE REINFORCEMENT — when the configuration specifies any of these angles: "Overhead", "Top-down", "Bird's eye", "High angle", "Worm's eye", "Low angle", "Dutch angle":
- Express the angle EXPLICITLY and REDUNDANTLY using 2-3 positional phrases (image generation models like Nano Banana Pro and GPT-Image have a strong bias toward eye-level and ignore subtle angle hints)
- For Top-down / Overhead / Bird's eye: use phrases like "shot from directly overhead", "camera pointed straight down at a 90-degree vertical angle", "viewed from above", "flat lay composition"
- For Worm's eye / Low angle: use phrases like "shot from below looking up", "camera positioned near the ground tilted upward"
- For High angle: use phrases like "shot from above looking down at an angle", "elevated camera position"
- Additionally, when the angle is Top-down / Overhead / Bird's eye AND the subject is normally upright (bottle, can, jar, person standing, glass), describe the subject as laid flat or oriented horizontally (e.g. "the perfume bottle lying horizontally on the surface, photographed from directly above")
- Put the angle reinforcement near the START of the prompt (within the first sentence), not buried in the middle`;

// Notação obrigatória pra referências de mídia
const MEDIA_REFERENCE_RULE = `MEDIA REFERENCE NOTATION (mandatory):
- When the configuration includes uploaded image references, refer to them in the prompt EXACTLY as @image_1, @image_2, @image_3, etc.
- When the configuration includes uploaded video references, refer to them in the prompt EXACTLY as @video_1, @video_2, @video_3, etc.
- NEVER write "the reference image", "the uploaded image", "the first reference", "image one", "the video reference", or any paraphrase — always the @notation
- The @notation must appear literally with the @ symbol and the underscore (e.g. "@image_2", not "image 2" or "@image2")
- If no references were uploaded, do not invent any @image_N or @video_N markers`;

// Guardrail crítico: referências ensinam estilo, NÃO sujeito
const SUBJECT_ISOLATION_RULE = `CRITICAL — separate STYLE from SUBJECT:
- Use the references ONLY for: structure, vocabulary, format, section order, technical descriptors, camera language, lighting language, look/grade language, resolution conventions, punctuation, length
- NEVER copy from the references: product names, brand names, proper nouns, specific people, specific objects, specific locations, specific colors of subjects, specific identifiers
- The SUBJECT (what the image is OF — product, person, scene, action) must come EXCLUSIVELY from the user's scene description
- If the user says "perfume bottle" and a reference says "Nike sneaker", the output must describe the perfume bottle — NEVER a sneaker, NEVER Nike
- Even if a reference contains a similar product, do NOT reuse its specific name/brand unless the user explicitly named it`;

// Parser pra resposta dupla [PROMPT_EN] / [PROMPT_PT] / [CHANGES] (CHANGES é opcional)
function parseDualLang(raw) {
  const enMatch = raw.match(/\[PROMPT_EN\]([\s\S]*?)(?=\[PROMPT_PT\]|\[CHANGES\]|$)/i);
  const ptMatch = raw.match(/\[PROMPT_PT\]([\s\S]*?)(?=\[CHANGES\]|$)/i);
  const chMatch = raw.match(/\[CHANGES\]([\s\S]*)$/i);
  let promptEn = enMatch ? enMatch[1].trim() : '';
  let promptPt = ptMatch ? ptMatch[1].trim() : '';
  const note = chMatch ? chMatch[1].trim() : '';
  // Fallback 1: formato antigo (só [PROMPT]) ou sem marcadores
  if (!promptEn && !promptPt) {
    promptEn = raw.replace(/\[PROMPT\]/i, '').replace(/\[CHANGES\][\s\S]*$/i, '').trim();
  }
  // Fallback 2: veio só PT (sem [PROMPT_EN]) — usa PT como EN pra UI não ficar vazia
  if (!promptEn && promptPt) {
    promptEn = promptPt;
  }
  // Sinaliza pro caller logar se o parse ficou suspeito
  if (!promptEn && !promptPt) {
    console.warn('[parseDualLang] resposta sem prompt — raw (1k):', raw.slice(0, 1000));
  }
  return { promptEn, promptPt, note };
}

// ── Vídeo → 3 frames (1º / meio / último) via ffmpeg-static ──
async function probeDuration(inputPath) {
  try {
    await execFileP(ffmpegPath, ['-hide_banner', '-i', inputPath]);
    return null;
  } catch (e) {
    const m = String(e.stderr || '').match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!m) return null;
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }
}

async function extractVideoFrames(videoBuffer, mimeType) {
  const ext = ((mimeType || '').split('/')[1] || 'mp4').replace(/[^a-z0-9]/gi, '') || 'mp4';
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ph-vid-'));
  const input = path.join(tmpDir, `in.${ext}`);
  fs.writeFileSync(input, videoBuffer);
  try {
    const dur = await probeDuration(input);
    const stamps = (dur && Number.isFinite(dur) && dur > 0.5)
      ? [0, dur / 2, Math.max(0, dur - 0.1)]
      : [0];
    const frames = [];
    for (let i = 0; i < stamps.length; i++) {
      const out = path.join(tmpDir, `f${i}.jpg`);
      await execFileP(ffmpegPath, [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-ss', String(stamps[i]),
        '-i', input,
        '-frames:v', '1',
        '-q:v', '4',
        '-vf', 'scale=min(1280\\,iw):-2',
        out,
      ]);
      const data = fs.readFileSync(out);
      frames.push({ dataUrl: `data:image/jpeg;base64,${data.toString('base64')}` });
    }
    return frames;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// Converte attachments do chat em content blocks multimodais pro Claude
function attachmentsToContentBlocks(attachments = []) {
  const blocks = [];
  attachments.forEach((a, i) => {
    const tag = a.type === 'video' ? `@video_${i + 1}` : `@image_${i + 1}`;
    const labelSuffix = a.label ? ` (${a.label})` : '';
    if (a.type === 'image' && a.dataUrl) {
      const m = a.dataUrl.match(/^data:([^;,]+);base64,(.*)$/);
      if (!m) return;
      blocks.push({ type: 'text', text: `[Chat attachment ${tag}${labelSuffix}]` });
      blocks.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
    } else if (a.type === 'video' && Array.isArray(a.frames) && a.frames.length) {
      blocks.push({ type: 'text', text: `[Chat attachment ${tag}${labelSuffix} — ${a.frames.length} frame(s) extraído(s)]` });
      for (const f of a.frames) {
        const m = f.dataUrl?.match(/^data:([^;,]+);base64,(.*)$/);
        if (m) blocks.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
      }
    }
  });
  return blocks;
}

app.post('/api/extract-frames', async (req, res) => {
  try {
    const { dataUrl } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string') return res.status(400).json({ error: 'dataUrl obrigatório' });
    const m = dataUrl.match(/^data:([^;,]+);base64,(.*)$/);
    if (!m) return res.status(400).json({ error: 'dataUrl base64 inválido' });
    const buf = Buffer.from(m[2], 'base64');
    const frames = await extractVideoFrames(buf, m[1]);
    res.json({ frames });
  } catch (e) {
    console.error('[extract-frames]', e.message);
    res.status(500).json({ error: e.message });
  }
});

const DUAL_LANG_FORMAT = `Respond in this exact format — English version FIRST, then Brazilian Portuguese translation:
[PROMPT_EN]
The complete prompt in English. This is the primary output and MUST always be in English, regardless of the language used in the reference examples or in the user's input.

[PROMPT_PT]
A faithful translation of the prompt above into Brazilian Portuguese. Keep technical terms (camera names, lens names, aperture values, aspect ratios, "8K", etc.) untranslated. Translate descriptive prose naturally.

ABSOLUTELY MANDATORY:
- Both [PROMPT_EN] and [PROMPT_PT] sections MUST be present and MUST contain the FULL prompt text.
- NEVER omit [PROMPT_EN] — even if the change is small or the prompt is already mostly correct, ALWAYS reproduce the entire updated prompt under [PROMPT_EN].
- NEVER output only [CHANGES] without the [PROMPT_EN] / [PROMPT_PT] sections.
- NEVER write things like "the prompt is unchanged" or "see above" — always restate the full prompt.`;

const DUAL_LANG_FORMAT_WITH_CHANGES = `${DUAL_LANG_FORMAT}

[CHANGES]
2-3 sentences in Brazilian Portuguese explaining conversationally what you changed, why you changed it, and what was missing or incorrect. Write naturally, as if explaining to a creative director.`;

const SYSTEM_PROMPT = `You are an expert AI image generation prompt engineer for tools like Midjourney, Stable Diffusion, and Sora.

Your job: receive the current prompt and a user refinement request, then return the complete updated prompt followed by a brief explanation.

The prompt follows this structure:
"Cinematic [shot], [camera] camera with [lens] lens at [focal], [aperture] aperture, 8K resolution, [aspect] aspect ratio, [scene description]. [References if any]. Lighting: [light type]. The visual style should follow: [look/grade]. Scene rules: [rules]. Final image quality: ultra resolution, 8K, photorealistic textures, hyperrealistic render, rich cinematic lighting, precise focus, natural composition, high production value, ultra-detail, photorealistic cinematic quality. Negative prompt: [what to avoid]."

${DUAL_LANG_FORMAT_WITH_CHANGES}

Rules:
- Preserve camera setup, quality, and negative prompt unless explicitly asked to change them
- Apply the user's change naturally into the existing prompt
- The [PROMPT_EN] section MUST always be in English
- First line format: "Cinematic [shot], [camera] camera with [lens] lens at [focal], [aperture] aperture, 8K resolution, [aspect] aspect ratio, [scene]"
- Quality details belong ONLY in the Final image quality section, never in the first line
- Never use 2K, 4K, or HD — always 8K resolution`;

const GPT2_REFINE_PROMPT = `You are an AI prompt engineer. Your job is to modify a prompt based on the user's instruction.

ABSOLUTE PRIORITY — apply the user's change fully and completely:
- If the user says a block, section, or instruction is MISSING → ADD it to the prompt. Write the full missing content. Do not just acknowledge it — actually write it in.
- If the user says something is wrong → FIX it in the prompt.
- If the user asks to change something → CHANGE it.
- Adding missing content ALWAYS takes priority over preserving length or structure.
- NEVER return the prompt unchanged or nearly unchanged when the user asked for a modification.
- NEVER just say something is missing without actually adding it.

${DUAL_LANG_FORMAT_WITH_CHANGES}

Rules:
- Write all added/changed content following the same formatting style as the existing blocks
- The [PROMPT_EN] section MUST always be in English
- Do not trim other sections to compensate for added content`;

const VIDEO_REFINE_PROMPT = `You are an expert AI video generation prompt engineer for tools like Kling, Sora, and Runway.

Your job: receive the current video prompt and a user refinement request, then return the complete updated prompt followed by a brief explanation.

The prompt follows this structure:
"[Shot type], [camera movement], [camera] camera, 8K resolution, [aspect] aspect ratio, [scene with motion description]. [Reference info if any]. Lighting: [light type]. The visual style should follow: [look/grade]. Scene rules: [rules]. Final video quality: ultra resolution, 8K, photorealistic, smooth natural motion, high production value, cinematic depth, rich color grading, sharp focus. Negative prompt: [what to avoid]."

${DUAL_LANG_FORMAT_WITH_CHANGES}

Rules:
- Preserve camera setup, quality specs, and negative prompt unless explicitly asked to change them
- Apply the user's change naturally into the existing prompt
- The [PROMPT_EN] section MUST always be in English
- Always maintain 8K resolution — never use 2K, 4K, or HD
- Keep motion descriptions vivid and specific`;

app.post('/api/refine', async (req, res) => {
  const { currentPrompt, history, userMessage, generatorId, attachments } = req.body;
  if (!currentPrompt || !userMessage) {
    return res.status(400).json({ error: 'Missing currentPrompt or userMessage' });
  }

  const attachmentBlocks = attachmentsToContentBlocks(Array.isArray(attachments) ? attachments : []);
  const hasAttachments = attachmentBlocks.length > 0;

  // RAG: busca top-K exemplos relevantes (query = pedido do usuário + prompt atual)
  const relevant = await topKExamples({
    query: `${userMessage}\n\n${currentPrompt}`,
    generator: generatorId,
    k: TOP_K_DEFAULT,
  });
  const hasExamples = relevant.length > 0;
  const usedExampleIds = relevant.map(r => r.id);

  let systemPrompt;
  if (hasExamples) {
    // Quando há exemplos, eles ditam estrutura/vocabulário/resolução — sem template fixo
    const refsBlock = `Reference library — these prompts produced good results in this exact style. They define the structure, vocabulary, formatting, resolution conventions, and section order to use:\n\n${relevant.map((r, i) => `[${i + 1}]\n${r.content}`).join('\n\n')}`;
    systemPrompt = `You are an AI prompt engineer. Apply the user's modification to the current prompt while keeping it consistent with the reference library style.

${refsBlock}
${SUBJECT_ISOLATION_RULE}

${MEDIA_REFERENCE_RULE}

${ANGLE_REINFORCEMENT_RULE}

ABSOLUTE PRIORITY — apply the user's change fully and completely:
- If the user says something is MISSING → ADD it (write the full content; do not just acknowledge).
- If the user says something is wrong → FIX it.
- If the user asks to change something → CHANGE it.
- NEVER return the prompt unchanged when the user asked for a modification.

Style guidance (from the references):
- Inherit section order, punctuation style, technical depth, resolution conventions and overall format FROM the references
- Do not impose external defaults (no forced 8K, no forced "Cinematic [shot]" opener, no forced "Negative prompt" ending unless the references use them)
- The [PROMPT_EN] section MUST always be in English, even if the references use other languages

${DUAL_LANG_FORMAT_WITH_CHANGES}`;
  } else {
    // Fallback: comportamento antigo quando a biblioteca está vazia
    systemPrompt = generatorId === 'kling' ? VIDEO_REFINE_PROMPT
      : generatorId === 'gpt2' ? GPT2_REFINE_PROMPT
      : SYSTEM_PROMPT;
  }

  const attachmentInstruction = hasAttachments
    ? `\n\nThe user attached ${attachmentBlocks.filter(b => b.type === 'image').length} reference image(s) in this turn. Analyze each one and incorporate what is relevant (composition, lighting, color palette, framing, mood, style cues) into the refined prompt. Use the @image_N / @video_N notation if you cite them, matching the order they appear.`
    : '';

  const userText = `Current prompt:\n"""\n${currentPrompt}\n"""\n\nUser request: "${userMessage}"${attachmentInstruction}`;
  const lastUserContent = hasAttachments
    ? [{ type: 'text', text: userText }, ...attachmentBlocks]
    : userText;

  const messages = [
    ...(history || []),
    { role: 'user', content: lastUserContent },
  ];

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });
    const raw = response.content[0].text.trim();
    const { promptEn, promptPt, note } = parseDualLang(raw);
    // Com exemplos ou gpt2: exemplos/usuário decidem a resolução. Senão: enforce 8K
    const applyEnforce = !(hasExamples || generatorId === 'gpt2');
    const prompt = applyEnforce ? enforceResolution(promptEn) : promptEn;
    res.json({ prompt, promptPt, note, usedExampleIds });
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate', async (req, res) => {
  const { scene, camera, lens, focalLength, aperture, angles, luz, look, rules, negative, references, aspect, resolution, examples: legacyExamples, generatorId } = req.body;

  // RAG primeiro; se OPENAI_API_KEY ausente, cai pra examples enviado pelo frontend (compat)
  const ragExamples = await topKExamples({
    query: [scene, look, luz, rules].filter(Boolean).join(' — '),
    generator: generatorId,
    k: TOP_K_DEFAULT,
  });
  const examples = ragExamples.length ? ragExamples.map(r => r.content) : (legacyExamples || []);
  const usedExampleIds = ragExamples.map(r => r.id);
  const hasExamples = examples.length > 0;
  const isGpt2 = generatorId === 'gpt2';

  /* ── GPT-2: follow reference library structure exactly ── */
  if (isGpt2) {
    const examplesBlock = hasExamples
      ? `Reference prompts (validated and approved — replicate their exact structure, vocabulary, and format):\n\n${examples.map((e, i) => `[${i + 1}]\n${e}`).join('\n\n')}\n\n`
      : '';

    const configLines = [
      scene ? `Scene: ${scene}` : '',
      angles?.length ? `Shot: ${angles.join(', ')}` : '',
      luz ? `Lighting: ${luz}` : '',
      look ? `Style: ${look}` : '',
      rules ? `Rules: ${rules}` : '',
      negative ? `Avoid: ${negative}` : '',
      aspect ? `Aspect ratio: ${aspect}` : '',
      references?.length ? `References: ${references.map((r, i) => r.label ? `@image_${i+1} (${r.label})` : `@image_${i+1}`).join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const gpt2System = hasExamples
      ? `You are an AI prompt engineer. Your only job is to generate a new prompt that replicates the EXACT formatting of the reference prompts below.

${examplesBlock}
${SUBJECT_ISOLATION_RULE}

${MEDIA_REFERENCE_RULE}

${ANGLE_REINFORCEMENT_RULE}

CRITICAL FORMATTING RULES:
- Replicate the exact line break structure of the references — if a reference breaks to a new line, you break to a new line in the same position
- Replicate the exact paragraph structure — if references have blank lines between sections, do the same
- Replicate the exact punctuation pattern at line endings
- Do NOT collapse multiple lines into a single paragraph
- Do NOT merge lines that are separated in the references
- Mirror the references line-by-line, section-by-section
- The [PROMPT_EN] section MUST always be in English, even if the references use other languages
- Follow the reference vocabulary and section order exactly

${DUAL_LANG_FORMAT}`
      : `You are an AI prompt engineer. Generate a single detailed prompt for the described scene.

The [PROMPT_EN] section MUST always be in English.

${DUAL_LANG_FORMAT}`;

    const gpt2UserMsg = `Generate a prompt for: "${scene || 'a creative scene'}"\n\nConfiguration:\n${configLines}\n\nReturn the prompt in the required [PROMPT_EN] / [PROMPT_PT] format.`;

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1536,
        system: gpt2System,
        messages: [{ role: 'user', content: gpt2UserMsg }],
      });
      const { promptEn, promptPt } = parseDualLang(response.content[0].text.trim());
      return res.json({ prompt: promptEn, promptPt, usedExampleIds });
    } catch (err) {
      console.error('GPT-2 generate error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  /* ── Nano Banana / Seedance ──
     Com exemplos: a biblioteca dita estrutura, vocabulário, resolução, ordem.
     Sem exemplos: fallback cinematográfico tradicional. */
  const config = [
    camera ? `Camera: ${camera}` : '',
    lens ? `Lens: ${lens}` : '',
    focalLength ? `Focal length: ${focalLength}` : '',
    aperture ? `Aperture: ${aperture}` : '',
    angles?.length ? `Shot angles: ${angles.join(', ')}` : '',
    luz ? `Lighting: ${luz}` : '',
    look ? `Look/Style: ${look}` : '',
    rules ? `Scene rules: ${rules}` : '',
    negative ? `Extra negative: ${negative}` : '',
    aspect ? `Aspect ratio: ${aspect}` : '',
    references?.length ? `Image references: ${references.map((r, i) => r.label ? `@image_${i + 1} (${r.label})` : `@image_${i + 1}`).join(', ')}` : '',
  ].filter(Boolean).join('\n');

  let system;
  if (hasExamples) {
    const examplesBlock = `Validated prompt library — these are real prompts that produced great results. Mirror them as closely as possible:\n\n${examples.map((e, i) => `[${i + 1}]\n${e}`).join('\n\n')}`;
    system = `You are an AI prompt engineer. Your only job is to generate a new prompt that mirrors the structure, vocabulary, formatting, length, section order, and overall style of the reference prompts below.

${examplesBlock}
${SUBJECT_ISOLATION_RULE}

${MEDIA_REFERENCE_RULE}

${ANGLE_REINFORCEMENT_RULE}

Rules:
- Mirror the references exactly — same sections, same order, same punctuation style, same level of technical detail, same resolution conventions
- Inherit resolution, camera language, quality descriptors and negative prompt style FROM the references — do not impose any external defaults
- Use the user's scene description and configuration values, but only include the sections the references actually use
- The [PROMPT_EN] section MUST always be in English, even if the references use other languages

${DUAL_LANG_FORMAT}`;
  } else {
    system = `You are an expert AI image generation prompt engineer specializing in cinematic photography prompts for tools like Midjourney, Stable Diffusion, and Sora.

Generate a single, complete, ready-to-use image generation prompt.

The prompt MUST follow this exact structure:
"Cinematic [shot], [camera] camera with [lens] lens at [focal], [aperture] aperture, 8K resolution, [aspect] aspect ratio, [scene description]. [References if any]. Lighting: [light type]. The visual style should follow: [look/grade]. Scene rules: [rules]. Final image quality: ultra resolution, 8K, photorealistic textures, hyperrealistic render, rich cinematic lighting, precise focus, natural composition, high production value, ultra-detail, photorealistic cinematic quality. Negative prompt: [what to avoid]."

Rules:
- The [PROMPT_EN] section MUST always be in English
- Use the cinematic prompt structure above exactly
- Incorporate all the user configuration naturally
- First line: "Cinematic [shot], [camera] camera with [lens] lens at [focal], [aperture] aperture, 8K resolution, [aspect] aspect ratio, [scene]"
- Quality details (photorealistic textures, hyperrealistic render, etc.) belong ONLY in the Final image quality section, never in the first line
- Never use 2K, 4K, or HD — always 8K resolution
- End with "Negative prompt: [what to avoid]"

${DUAL_LANG_FORMAT}`;
  }

  const userMsg = `Generate a prompt for this scene: "${scene || 'a cinematic scene'}"\n\nConfiguration:\n${config || '(no extra config — use only what fits the reference style)'}\n\nReturn the prompt in the required [PROMPT_EN] / [PROMPT_PT] format.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1536,
      system,
      messages: [{ role: 'user', content: userMsg }],
    });
    const { promptEn, promptPt } = parseDualLang(response.content[0].text.trim());
    // Quando os exemplos guiam, NÃO sobrescreve resolução — exemplos decidem
    const prompt = hasExamples ? promptEn : enforceResolution(promptEn);
    res.json({ prompt, promptPt, usedExampleIds });
  } catch (err) {
    console.error('Generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate-video', async (req, res) => {
  const { scene, camera, shot, cameraMove, speed, luz, look, rules, negative, references, aspect, examples: legacyExamples } = req.body;

  const ragExamples = await topKExamples({
    query: [scene, shot, look, luz, rules].filter(Boolean).join(' — '),
    generator: 'kling',
    k: TOP_K_DEFAULT,
  });
  const examples = ragExamples.length ? ragExamples.map(r => r.content) : (legacyExamples || []);
  const usedExampleIds = ragExamples.map(r => r.id);
  const hasExamples = examples.length > 0;

  const config = [
    shot ? `Shot type: ${shot}` : '',
    Array.isArray(cameraMove) && cameraMove.length ? `Camera movement: ${cameraMove.join(', ')}` : '',
    camera ? `Camera: ${camera}` : '',
    speed && speed !== 'Normal' ? `Speed: ${speed}` : '',
    luz ? `Lighting: ${luz}` : '',
    look ? `Look/Style: ${look}` : '',
    rules ? `Scene rules: ${rules}` : '',
    negative ? `Extra negative: ${negative}` : '',
    aspect ? `Aspect ratio: ${aspect}` : '',
    Array.isArray(references) && references.length
      ? `References: ${references.map((r, i) => r.label ? `@video_${i+1} (${r.label})` : `@video_${i+1}`).join(', ')}`
      : '',
  ].filter(Boolean).join('\n');

  let system;
  if (hasExamples) {
    const examplesBlock = `Validated video prompt library — real prompts that produced great results. Mirror them as closely as possible:\n\n${examples.map((e, i) => `[${i+1}]\n${e}`).join('\n\n')}`;
    system = `You are an AI video prompt engineer. Your only job is to generate a new prompt that mirrors the structure, vocabulary, motion language, formatting, length, section order, and overall style of the reference prompts below.

${examplesBlock}
${SUBJECT_ISOLATION_RULE}

${MEDIA_REFERENCE_RULE}

${ANGLE_REINFORCEMENT_RULE}

Rules:
- Mirror the references exactly — same sections, same order, same punctuation style, same level of motion detail, same resolution conventions
- Inherit resolution, camera language, quality descriptors and negative prompt style FROM the references — do not impose any external defaults
- Use the user's scene and configuration, but only include the sections the references actually use
- The [PROMPT_EN] section MUST always be in English, even if the references use other languages

${DUAL_LANG_FORMAT}`;
  } else {
    system = `You are an expert AI video generation prompt engineer specializing in cinematic video prompts for tools like Kling, Sora, and Runway.

Generate a single, complete, ready-to-use video generation prompt.

The prompt MUST follow this exact structure:
"[Shot type], [camera movement], [camera] camera, 8K resolution, [aspect] aspect ratio, [scene with vivid motion description]. [Reference info if any]. Lighting: [light type]. The visual style should follow: [look/grade]. Scene rules: [rules]. Final video quality: ultra resolution, 8K, photorealistic, smooth natural motion, high production value, cinematic depth, rich color grading, sharp focus. Negative prompt: [what to avoid]."

Rules:
- The [PROMPT_EN] section MUST always be in English
- Use the video prompt structure above exactly
- Incorporate all the user configuration naturally
- Include vivid motion descriptions: how subjects move, how the camera moves, how the environment reacts
- Always use 8K resolution — never use 2K, 4K, or HD
- End with "Negative prompt: [what to avoid]"

${DUAL_LANG_FORMAT}`;
  }

  const userMsg = `Generate a video prompt for this scene: "${scene || 'a cinematic scene'}"\n\nConfiguration:\n${config || '(no extra config — use only what fits the reference style)'}\n\nReturn the prompt in the required [PROMPT_EN] / [PROMPT_PT] format.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1536,
      system,
      messages: [{ role: 'user', content: userMsg }],
    });
    const { promptEn, promptPt } = parseDualLang(response.content[0].text.trim());
    const prompt = hasExamples ? promptEn : enforceResolution(promptEn);
    res.json({ prompt, promptPt, usedExampleIds });
  } catch (err) {
    console.error('Generate video error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Higgsfield OAuth + MCP ──────────────────────────────────────
const HF_CLIENT_ID   = 'yt4IuyJ7ussrZZjq';
const HF_REDIRECT    = 'http://localhost:3001/api/auth/callback';
const HF_AUTH_URL    = 'https://clerk.higgsfield.ai/oauth/authorize';
const HF_TOKEN_URL   = 'https://clerk.higgsfield.ai/oauth/token';
const HF_MCP_URL     = 'https://mcp.higgsfield.ai/mcp';
const HF_POLL_BASE   = 'https://platform.higgsfield.ai';

let hfAuth = { codeVerifier: null, accessToken: null, refreshToken: null, expiresAt: null };
loadSession();

function genVerifier() { return crypto.randomBytes(32).toString('base64url'); }
function genChallenge(v) { return crypto.createHash('sha256').update(v).digest('base64url'); }

async function refreshToken() {
  if (!hfAuth.refreshToken) return false;
  const r = await fetch(HF_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: hfAuth.refreshToken, client_id: HF_CLIENT_ID }),
  });
  if (!r.ok) return false;
  const d = await r.json();
  hfAuth.accessToken = d.access_token;
  hfAuth.refreshToken = d.refresh_token || hfAuth.refreshToken;
  hfAuth.expiresAt = Date.now() + (d.expires_in || 3600) * 1000;
  saveSession();
  return true;
}

async function getToken() {
  if (!hfAuth.accessToken) throw new Error('auth_required');
  if (hfAuth.expiresAt && Date.now() > hfAuth.expiresAt - 60_000) {
    const ok = await refreshToken();
    if (!ok) throw new Error('auth_required');
  }
  return hfAuth.accessToken;
}

// Status / login / callback
app.get('/api/auth/status', (req, res) => {
  res.json({ authenticated: !!hfAuth.accessToken });
});

app.get('/api/auth/login', (req, res) => {
  hfAuth.codeVerifier = genVerifier();
  const url = new URL(HF_AUTH_URL);
  url.searchParams.set('client_id', HF_CLIENT_ID);
  url.searchParams.set('redirect_uri', HF_REDIRECT);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email offline_access');
  url.searchParams.set('code_challenge', genChallenge(hfAuth.codeVerifier));
  url.searchParams.set('code_challenge_method', 'S256');
  res.redirect(url.toString());
});

app.get('/api/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) return res.redirect('http://localhost:5173/?auth=error');
  try {
    const r = await fetch(HF_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: HF_REDIRECT,
        client_id: HF_CLIENT_ID,
        code_verifier: hfAuth.codeVerifier,
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error_description || d.error || 'Token exchange failed');
    hfAuth.accessToken = d.access_token;
    hfAuth.refreshToken = d.refresh_token;
    hfAuth.expiresAt = Date.now() + (d.expires_in || 3600) * 1000;
    saveSession();
    res.redirect('http://localhost:5173/?auth=success');
  } catch (err) {
    console.error('OAuth callback error:', err.message);
    res.redirect('http://localhost:5173/?auth=error');
  }
});

app.get('/api/auth/logout', (req, res) => {
  hfAuth = { codeVerifier: null, accessToken: null, refreshToken: null, expiresAt: null };
  res.json({ ok: true });
});

// Chama o MCP do Higgsfield direto via JSON-RPC (sem Claude no meio).
// Resposta vem como SSE (text/event-stream); precisamos extrair as linhas `data:`.
async function mcpCall(token, method, params) {
  const r = await fetch(HF_MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  if (r.status === 401) throw new Error('auth_required');
  const text = await r.text();
  if (!r.ok) throw new Error(`MCP HTTP ${r.status}: ${text.slice(0, 200)}`);

  const dataPayload = text
    .split('\n')
    .filter(l => l.startsWith('data: '))
    .map(l => l.slice(6))
    .join('\n');
  if (!dataPayload) throw new Error('MCP: resposta vazia');

  const json = JSON.parse(dataPayload);
  if (json.error) throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
  if (json.result?.isError) {
    const msg = json.result.content?.[0]?.text || 'tool error';
    throw new Error(`MCP tool error: ${msg}`);
  }
  return json.result;
}

// Submete generate_image / generate_video → array de jobIds (1 por count)
async function hfSubmit(type, params, token) {
  const result = await mcpCall(token, 'tools/call', {
    name: `generate_${type}`,
    arguments: { params },
  });
  const results = result?.structuredContent?.results;
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('MCP: nenhum resultado retornado');
  }
  return results.map(r => r.id);
}

app.post('/api/hf/image', async (req, res) => {
  const { model, prompt, aspect_ratio, count, resolution } = req.body;
  try {
    const token = await getToken();
    const params = { model, prompt };
    if (aspect_ratio) params.aspect_ratio = aspect_ratio;
    if (count)        params.count = count;
    if (resolution)   params.resolution = resolution;
    const jobIds = await hfSubmit('image', params, token);
    res.json({ jobId: jobIds[0], jobIds });
  } catch (err) {
    if (err.message === 'auth_required') return res.status(401).json({ error: 'auth_required' });
    console.error('HF image error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Allowlist de campos do generate_video. Inclui params globais e sub-params por modelo.
const VIDEO_FIELDS = ['model','prompt','aspect_ratio','count','duration','medias','mode','resolution','genre','quality','sound'];

app.post('/api/hf/video', async (req, res) => {
  const { model, prompt } = req.body;
  if (!model || !prompt) return res.status(400).json({ error: 'model e prompt obrigatórios' });
  try {
    const token = await getToken();
    const params = {};
    for (const k of VIDEO_FIELDS) if (req.body[k] !== undefined && req.body[k] !== null && req.body[k] !== '') params[k] = req.body[k];
    const jobIds = await hfSubmit('video', params, token);
    res.json({ jobId: jobIds[0], jobIds });
  } catch (err) {
    if (err.message === 'auth_required') return res.status(401).json({ error: 'auth_required' });
    console.error('HF video error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Upload em 2 etapas — browser faz PUT direto pro S3 do Higgsfield (sem passar pelo server).
// Etapa 1: server pede presigned URL
app.post('/api/hf/upload-url', async (req, res) => {
  try {
    const token = await getToken();
    const { filename, contentType } = req.body || {};
    if (!filename) return res.status(400).json({ error: 'filename obrigatório' });
    const ct = contentType || 'image/png';
    const upRes = await mcpCall(token, 'tools/call', {
      name: 'media_upload',
      arguments: { filename, content_type: ct },
    });
    const upload = upRes?.structuredContent?.uploads?.[0];
    if (!upload?.upload_url || !upload?.media_id) throw new Error('media_upload: resposta inválida');
    res.json({ uploadUrl: upload.upload_url, mediaId: upload.media_id, contentType: ct });
  } catch (err) {
    if (err.message === 'auth_required') return res.status(401).json({ error: 'auth_required' });
    console.error('HF upload-url error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Etapa 2: depois do PUT, server confirma com o MCP
app.post('/api/hf/upload-confirm', async (req, res) => {
  try {
    const token = await getToken();
    const { mediaId, contentType } = req.body || {};
    if (!mediaId) return res.status(400).json({ error: 'mediaId obrigatório' });
    let mcpType = 'image';
    if (contentType?.startsWith('video/')) mcpType = 'video';
    else if (contentType?.startsWith('audio/')) mcpType = 'audio';
    await mcpCall(token, 'tools/call', {
      name: 'media_confirm',
      arguments: { type: mcpType, media_id: mediaId },
    });
    res.json({ ok: true });
  } catch (err) {
    if (err.message === 'auth_required') return res.status(401).json({ error: 'auth_required' });
    console.error('HF upload-confirm error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/hf/job/:jobId', async (req, res) => {
  try {
    const token = await getToken();
    const { jobId } = req.params;

    const result = await mcpCall(token, 'tools/call', {
      name: 'job_status',
      arguments: { jobId },
    });
    const gen = result?.structuredContent?.generation;
    if (!gen) return res.json({ status: 'in_progress' });

    const url = gen.results?.rawUrl;
    res.json({
      status: gen.status,
      images: gen.type === 'image' && url ? [{ url }] : [],
      video:  gen.type === 'video' && url ? { url }  : undefined,
    });
  } catch (err) {
    if (err.message === 'auth_required') return res.status(401).json({ error: 'auth_required' });
    console.error('HF poll error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Proxy de download — força attachment pra browser salvar em vez de abrir nova aba
// (URL cross-origin do CloudFront ignora `download` attribute do <a>)
app.get('/api/hf/download', async (req, res) => {
  try {
    const { url, name } = req.query;
    if (!url) return res.status(400).send('missing url');
    const u = new URL(url);
    if (!u.hostname.endsWith('cloudfront.net')) return res.status(403).send('forbidden host');
    const upstream = await fetch(url);
    if (!upstream.ok) return res.status(upstream.status).send('upstream error');
    const fname = (name || u.pathname.split('/').pop() || 'higgsfield-download').replace(/"/g, '');
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    console.error('download error:', e.message);
    res.status(500).send(e.message);
  }
});

// ── Biblioteca de prompts (persistência em disco) ──────────────
const LIBRARY_FILE = path.resolve('.library.json');
function loadLibrary() {
  try { const d = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8')); return Array.isArray(d) ? d : []; } catch { return []; }
}
function saveLibrary(items) {
  try { fs.writeFileSync(LIBRARY_FILE, JSON.stringify(items, null, 2)); }
  catch (e) { console.error('[library] save failed:', e.message); }
}
function newLibId() {
  return `lib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

app.get('/api/library', (req, res) => {
  res.json(loadLibrary());
});

app.post('/api/library', async (req, res) => {
  const { content, generator } = req.body || {};
  if (!content || !generator) return res.status(400).json({ error: 'content e generator obrigatórios' });
  const items = loadLibrary();
  const item = { id: newLibId(), content: String(content), generator: String(generator), createdAt: new Date().toISOString() };
  items.unshift(item);
  saveLibrary(items);
  // Embeda em background (não bloqueia a resposta)
  if (openai) {
    embedText(item.content)
      .then(vec => { const map = loadEmbeddings(); map[item.id] = vec; saveEmbeddings(map); })
      .catch(e => console.error('[embed] add failed:', e.message));
  }
  res.json(item);
});

app.delete('/api/library/:id', (req, res) => {
  const items = loadLibrary().filter(l => l.id !== req.params.id);
  saveLibrary(items);
  const map = loadEmbeddings();
  if (map[req.params.id]) { delete map[req.params.id]; saveEmbeddings(map); }
  res.json({ ok: true });
});

// Ajusta score (feedback do usuário) de N itens da biblioteca
app.post('/api/library/score', (req, res) => {
  const { ids, delta } = req.body || {};
  if (!Array.isArray(ids) || !ids.length || typeof delta !== 'number') {
    return res.status(400).json({ error: 'ids[] e delta numérico obrigatórios' });
  }
  const items = loadLibrary();
  const idSet = new Set(ids);
  let touched = 0;
  for (const it of items) {
    if (idSet.has(it.id)) { it.score = (it.score || 0) + delta; touched++; }
  }
  if (touched) saveLibrary(items);
  res.json({ touched });
});

// Retorna itens da biblioteca por IDs (pra mostrar quais exemplos o RAG usou)
app.post('/api/library/lookup', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (!ids.length) return res.json({ items: [] });
  const idSet = new Set(ids);
  const items = loadLibrary().filter(l => idSet.has(l.id));
  res.json({ items });
});

// Migra itens vindos do localStorage antigo (idempotente — dedup por generator+content)
app.post('/api/library/migrate', async (req, res) => {
  const incoming = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!incoming.length) return res.json({ added: 0 });
  const items = loadLibrary();
  const seen = new Set(items.map(i => `${i.generator}|${i.content}`));
  const added = [];
  for (const it of incoming) {
    if (!it?.content || !it?.generator) continue;
    const key = `${it.generator}|${it.content}`;
    if (seen.has(key)) continue;
    const entry = {
      id: it.id || newLibId(),
      content: String(it.content),
      generator: String(it.generator),
      createdAt: it.createdAt || new Date().toISOString(),
    };
    items.push(entry);
    seen.add(key);
    added.push(entry);
  }
  if (added.length) saveLibrary(items);

  // Embeda os novos em batch (background — não bloqueia)
  if (openai && added.length) {
    (async () => {
      try {
        const resp = await openai.embeddings.create({ model: EMBED_MODEL, input: added.map(a => a.content) });
        const map = loadEmbeddings();
        resp.data.forEach((d, i) => { map[added[i].id] = d.embedding; });
        saveEmbeddings(map);
      } catch (e) { console.error('[embed] migrate failed:', e.message); }
    })();
  }

  res.json({ added: added.length });
});

// Reindex: embeda todos os itens da biblioteca (uso pontual após bulk import)
app.post('/api/library/reindex', async (req, res) => {
  if (!openai) return res.status(400).json({ error: 'OPENAI_API_KEY ausente' });
  const items = loadLibrary();
  if (!items.length) return res.json({ embedded: 0, total: 0 });
  try {
    const map = {};
    const BATCH = 64;
    for (let i = 0; i < items.length; i += BATCH) {
      const slice = items.slice(i, i + BATCH);
      const resp = await openai.embeddings.create({ model: EMBED_MODEL, input: slice.map(s => s.content) });
      resp.data.forEach((d, j) => { map[slice[j].id] = d.embedding; });
    }
    saveEmbeddings(map);
    res.json({ embedded: items.length, total: items.length });
  } catch (e) {
    console.error('[embed] reindex failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(3001, () => console.log('API server → http://localhost:3001'));
