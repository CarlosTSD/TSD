import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const SESSION_FILE = path.resolve('.hf_session.json');
function saveSession() {
  try { fs.writeFileSync(SESSION_FILE, JSON.stringify({ accessToken: hfAuth.accessToken, refreshToken: hfAuth.refreshToken, expiresAt: hfAuth.expiresAt })); } catch {}
}
function loadSession() {
  try { const d = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')); hfAuth.accessToken = d.accessToken; hfAuth.refreshToken = d.refreshToken; hfAuth.expiresAt = d.expiresAt; console.log('[auth] Sessão carregada do disco'); } catch {}
}

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '25mb' })); // base64 de imagens de referência

const client = new Anthropic();

function enforceResolution(text) {
  return text.replace(/\b(?:HD|2K|4K|1080p|720p|4096|2048|1920)[^\w,.]*/gi, 'ultra resolution, 8K ');
}

const SYSTEM_PROMPT = `You are an expert AI image generation prompt engineer for tools like Midjourney, Stable Diffusion, and Sora.

Your job: receive the current prompt and a user refinement request, then return the complete updated prompt followed by a brief explanation.

The prompt follows this structure:
"Cinematic [shot], [camera] camera with [lens] lens at [focal], [aperture] aperture, 8K resolution, [aspect] aspect ratio, [scene description]. [References if any]. Lighting: [light type]. The visual style should follow: [look/grade]. Scene rules: [rules]. Final image quality: ultra resolution, 8K, photorealistic textures, hyperrealistic render, rich cinematic lighting, precise focus, natural composition, high production value, ultra-detail, photorealistic cinematic quality. Negative prompt: [what to avoid]."

Respond in this exact format — PROMPT first, then CHANGES:
[PROMPT]
The complete updated prompt here.

[CHANGES]
2-3 sentences in Brazilian Portuguese explaining conversationally what you changed, why you changed it, and what was missing or incorrect in the previous version. Write naturally, as if explaining to a creative director.

Rules:
- Preserve camera setup, quality, and negative prompt unless explicitly asked to change them
- Apply the user's change naturally into the existing prompt
- Keep the same language (English) in the output prompt
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

Respond in this exact format — PROMPT first, then CHANGES:
[PROMPT]
The complete updated prompt here — including all existing content PLUS any new content added. The prompt MUST be longer if content was added.

[CHANGES]
2-3 sentences in Brazilian Portuguese explaining conversationally what you changed, why you changed it, and what was missing or incorrect in the previous version. Write naturally, as if explaining to a creative director.

Rules:
- Write all added/changed content following the same formatting style as the existing blocks
- Keep the language of the prompt as English
- Do not trim other sections to compensate for added content`;

const VIDEO_REFINE_PROMPT = `You are an expert AI video generation prompt engineer for tools like Kling, Sora, and Runway.

Your job: receive the current video prompt and a user refinement request, then return the complete updated prompt followed by a brief explanation.

The prompt follows this structure:
"[Shot type], [camera movement], [camera] camera, 8K resolution, [aspect] aspect ratio, [scene with motion description]. [Reference info if any]. Lighting: [light type]. The visual style should follow: [look/grade]. Scene rules: [rules]. Final video quality: ultra resolution, 8K, photorealistic, smooth natural motion, high production value, cinematic depth, rich color grading, sharp focus. Negative prompt: [what to avoid]."

Respond in this exact format — PROMPT first, then CHANGES:
[PROMPT]
The complete updated prompt here.

[CHANGES]
2-3 sentences in Brazilian Portuguese explaining conversationally what you changed, why you changed it, and what was missing or incorrect in the previous version. Write naturally, as if explaining to a creative director.

Rules:
- Preserve camera setup, quality specs, and negative prompt unless explicitly asked to change them
- Apply the user's change naturally into the existing prompt
- Keep the same language (English) in the output prompt
- Always maintain 8K resolution — never use 2K, 4K, or HD
- Keep motion descriptions vivid and specific`;

app.post('/api/refine', async (req, res) => {
  const { currentPrompt, history, userMessage, generatorId } = req.body;
  if (!currentPrompt || !userMessage) {
    return res.status(400).json({ error: 'Missing currentPrompt or userMessage' });
  }

  const systemPrompt = generatorId === 'kling' ? VIDEO_REFINE_PROMPT
    : generatorId === 'gpt2' ? GPT2_REFINE_PROMPT
    : SYSTEM_PROMPT;
  const messages = [
    ...(history || []),
    {
      role: 'user',
      content: `Current prompt:\n"""\n${currentPrompt}\n"""\n\nUser request: "${userMessage}"`,
    },
  ];

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });
    const raw = response.content[0].text.trim();
    // Format: [PROMPT]...[CHANGES]... — split on [CHANGES] to get prompt first
    const parts = raw.split('[CHANGES]');
    const promptRaw = parts[0].replace('[PROMPT]', '').trim();
    const note = (parts[1] || '').trim();
    const prompt = generatorId === 'gpt2' ? promptRaw : enforceResolution(promptRaw);
    res.json({ prompt, note });
  } catch (err) {
    console.error('Claude API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate', async (req, res) => {
  const { scene, camera, lens, focalLength, aperture, angles, luz, look, rules, negative, references, aspect, resolution, examples, generatorId } = req.body;

  const hasExamples = examples?.length > 0;
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
CRITICAL FORMATTING RULES:
- Replicate the exact line break structure of the references — if a reference breaks to a new line, you break to a new line in the same position
- Replicate the exact paragraph structure — if references have blank lines between sections, do the same
- Replicate the exact punctuation pattern at line endings
- Do NOT collapse multiple lines into a single paragraph
- Do NOT merge lines that are separated in the references
- Mirror the references line-by-line, section-by-section

Additional rules:
- Return ONLY the prompt, preserving all line breaks exactly
- No explanations, no labels, no markdown wrapper
- Write in English
- Follow the reference vocabulary and section order exactly`
      : `You are an AI prompt engineer. Generate a single detailed prompt for the described scene.\n\nRules:\n- Return ONLY the prompt\n- No explanations, no labels, no markdown\n- Write in English`;

    const gpt2UserMsg = `Generate a prompt for: "${scene || 'a creative scene'}"\n\nConfiguration:\n${configLines}\n\nReturn only the complete prompt.`;

    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: gpt2System,
        messages: [{ role: 'user', content: gpt2UserMsg }],
      });
      return res.json({ prompt: response.content[0].text.trim() });
    } catch (err) {
      console.error('GPT-2 generate error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  /* ── Nano Banana / Seedance: cinematic structure ── */
  const examplesBlock = hasExamples
    ? `\n\nValidated prompt library — these are real prompts that produced great results. Study their structure, vocabulary, technical details, and style:\n\n${examples.map((e, i) => `[${i + 1}]\n${e}`).join('\n\n')}`
    : '';

  const config = [
    `Camera: ${camera || 'Studio Digital S35'}`,
    `Lens: ${lens || 'Premium Modern Prime'}`,
    `Focal length: ${focalLength || '35mm'}`,
    `Aperture: ${aperture || 'f/4'}`,
    angles?.length ? `Shot angles: ${angles.join(', ')}` : '',
    luz ? `Lighting: ${luz}` : '',
    look ? `Look/Style: ${look}` : '',
    rules ? `Scene rules: ${rules}` : '',
    negative ? `Extra negative: ${negative}` : '',
    `Aspect ratio: ${aspect || '16:9'}`,
    `Resolution: Ultra resolution, 8K output quality`,
    references?.length ? `Image references: ${references.map((r, i) => r.label ? `@image_${i + 1} (${r.label})` : `@image_${i + 1}`).join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const system = `You are an expert AI image generation prompt engineer specializing in cinematic photography prompts for tools like Midjourney, Stable Diffusion, and Sora.${examplesBlock}

Generate a single, complete, ready-to-use image generation prompt.

The prompt MUST follow this exact structure:
"Cinematic [shot], [camera] camera with [lens] lens at [focal], [aperture] aperture, 8K resolution, [aspect] aspect ratio, [scene description]. [References if any]. Lighting: [light type]. The visual style should follow: [look/grade]. Scene rules: [rules]. Final image quality: ultra resolution, 8K, photorealistic textures, hyperrealistic render, rich cinematic lighting, precise focus, natural composition, high production value, ultra-detail, photorealistic cinematic quality. Negative prompt: [what to avoid]."

Rules:
- Write entirely in English
- ${hasExamples ? 'Follow the style, structure, and vocabulary of the library examples above, adapting to the structure above' : 'Use the cinematic prompt structure above exactly'}
- Incorporate all the user configuration naturally
- Return ONLY the prompt — no explanations, no labels, no markdown
- First line: "Cinematic [shot], [camera] camera with [lens] lens at [focal], [aperture] aperture, 8K resolution, [aspect] aspect ratio, [scene]"
- Quality details (photorealistic textures, hyperrealistic render, etc.) belong ONLY in the Final image quality section, never in the first line
- Never use 2K, 4K, or HD — always 8K resolution
- End with "Negative prompt: [what to avoid]"`;

  const userMsg = `Generate a cinematic prompt for this scene: "${scene || 'a cinematic scene'}"\n\nConfiguration:\n${config}\n\nReturn only the complete prompt.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: userMsg }],
    });
    res.json({ prompt: enforceResolution(response.content[0].text.trim()) });
  } catch (err) {
    console.error('Generate error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/generate-video', async (req, res) => {
  const { scene, camera, shot, cameraMove, speed, luz, look, rules, negative, references, aspect, examples } = req.body;
  const hasExamples = examples?.length > 0;

  const examplesBlock = hasExamples
    ? `\n\nValidated video prompt library — study their structure, vocabulary, motion descriptions, and style:\n\n${examples.map((e, i) => `[${i+1}]\n${e}`).join('\n\n')}`
    : '';

  const shotType = shot || 'cinematic medium shot';
  const moves = Array.isArray(cameraMove) && cameraMove.length ? cameraMove.join(', ') : 'static shot';

  const config = [
    `Shot type: ${shotType}`,
    `Camera movement: ${moves}`,
    camera ? `Camera: ${camera}` : '',
    speed && speed !== 'Normal' ? `Speed: ${speed}` : '',
    luz ? `Lighting: ${luz}` : '',
    look ? `Look/Style: ${look}` : '',
    rules ? `Scene rules: ${rules}` : '',
    negative ? `Extra negative: ${negative}` : '',
    `Aspect ratio: ${aspect || '16:9'}`,
    `Resolution: 8K ultra resolution`,
    Array.isArray(references) && references.length
      ? `References: ${references.map((r, i) => r.label ? `@ref_${i+1} (${r.label})` : `@ref_${i+1}`).join(', ')}`
      : '',
  ].filter(Boolean).join('\n');

  const system = `You are an expert AI video generation prompt engineer specializing in cinematic video prompts for tools like Kling, Sora, and Runway.${examplesBlock}

Generate a single, complete, ready-to-use video generation prompt.

The prompt MUST follow this exact structure:
"[Shot type], [camera movement], [camera] camera, 8K resolution, [aspect] aspect ratio, [scene with vivid motion description]. [Reference info if any]. Lighting: [light type]. The visual style should follow: [look/grade]. Scene rules: [rules]. Final video quality: ultra resolution, 8K, photorealistic, smooth natural motion, high production value, cinematic depth, rich color grading, sharp focus. Negative prompt: [what to avoid]."

Rules:
- Write entirely in English
- ${hasExamples ? 'Follow the style, structure, and vocabulary of the library examples above' : 'Use the video prompt structure above exactly'}
- Incorporate all the user configuration naturally
- Return ONLY the prompt — no explanations, no labels, no markdown
- Include vivid motion descriptions: how subjects move, how the camera moves, how the environment reacts
- Always use 8K resolution — never use 2K, 4K, or HD
- End with "Negative prompt: [what to avoid]"`;

  const userMsg = `Generate a cinematic video prompt for this scene: "${scene || 'a cinematic scene'}"\n\nConfiguration:\n${config}\n\nReturn only the complete prompt.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: userMsg }],
    });
    res.json({ prompt: enforceResolution(response.content[0].text.trim()) });
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

app.post('/api/library', (req, res) => {
  const { content, generator } = req.body || {};
  if (!content || !generator) return res.status(400).json({ error: 'content e generator obrigatórios' });
  const items = loadLibrary();
  const item = { id: newLibId(), content: String(content), generator: String(generator), createdAt: new Date().toISOString() };
  items.unshift(item);
  saveLibrary(items);
  res.json(item);
});

app.delete('/api/library/:id', (req, res) => {
  const items = loadLibrary().filter(l => l.id !== req.params.id);
  saveLibrary(items);
  res.json({ ok: true });
});

// Migra itens vindos do localStorage antigo (idempotente — dedup por generator+content)
app.post('/api/library/migrate', (req, res) => {
  const incoming = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!incoming.length) return res.json({ added: 0 });
  const items = loadLibrary();
  const seen = new Set(items.map(i => `${i.generator}|${i.content}`));
  let added = 0;
  for (const it of incoming) {
    if (!it?.content || !it?.generator) continue;
    const key = `${it.generator}|${it.content}`;
    if (seen.has(key)) continue;
    items.push({
      id: it.id || newLibId(),
      content: String(it.content),
      generator: String(it.generator),
      createdAt: it.createdAt || new Date().toISOString(),
    });
    seen.add(key);
    added++;
  }
  if (added) saveLibrary(items);
  res.json({ added });
});

app.listen(3001, () => console.log('API server → http://localhost:3001'));
