// FuturaTV · revisor de canales (versión web). Recibe hasta 25 enlaces y responde si cada uno funciona.
// Solo devuelve el estado (no el contenido): no sirve como proxy.
const UA = 'Mozilla/5.0 (Linux; Android 11) FuturaTV-revisor';

async function grab(url, signal, max = 400000) {
  const r = await fetch(url, { signal, redirect: 'follow', headers: { 'User-Agent': UA } });
  const ct = (r.headers.get('content-type') || '').toLowerCase();
  if (!r.ok) { try { r.body && r.body.cancel(); } catch (e) {} return { status: r.status, ct, text: '', url: r.url }; }
  const playlist = /mpegurl|text|json|xml/.test(ct) || /\.m3u8?(\?|$)/i.test(url);
  if (!playlist) { try { r.body && r.body.cancel(); } catch (e) {} return { status: r.status, ct, text: null, url: r.url }; }
  const reader = r.body.getReader(); const parts = []; let n = 0;
  while (n < max) { const { done, value } = await reader.read(); if (done) break; parts.push(value); n += value.length; }
  try { reader.cancel(); } catch (e) {}
  return { status: r.status, ct, text: Buffer.concat(parts.map((p) => Buffer.from(p))).toString('utf8'), url: r.url };
}

async function check(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const a = await grab(url, ctl.signal);
    if (a.status === 403 || a.status === 451) return { st: 'warn', why: 'bloqueado fuera de su país (' + a.status + ')' };
    if (a.status >= 400) return { st: 'bad', why: 'error ' + a.status };
    if (a.text === null) return { st: 'ok', why: 'video directo' };
    if (!a.text.includes('#EXTM3U')) return { st: 'bad', why: 'no es una lista de video' };
    const lines = a.text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    if (!lines.length) return { st: 'bad', why: 'lista vacía' };
    if (a.text.includes('#EXT-X-STREAM-INF')) {                 // lista maestra: se revisa la primera calidad
      const v = await grab(new URL(lines[0], a.url).href, ctl.signal);
      if (v.status === 403 || v.status === 451) return { st: 'warn', why: 'bloqueado fuera de su país (' + v.status + ')' };
      if (v.status >= 400) return { st: 'bad', why: 'error ' + v.status + ' en la calidad' };
      if (v.text !== null && !v.text.split(/\r?\n/).some((l) => l.trim() && !l.startsWith('#'))) return { st: 'bad', why: 'sin video' };
    }
    return { st: 'ok', why: '' };
  } catch (e) {
    return { st: 'bad', why: ctl.signal.aborted ? 'no responde' : 'servidor no existe o rechaza la conexión' };
  } finally { clearTimeout(timer); }
}

import { createHash } from 'node:crypto';
// Solo el dueño: la clave viaja en la cabecera x-clave; aquí solo está su huella (SHA-256), nunca la clave.
const HUELLA = process.env.FTV_CLAVE_SHA256 || '78bd972f63b0d8e8d5dfe39b7186c6d10e00f20afafff9ab7dd96c58c5ddc1cb';
const autorizado = (req) => createHash('sha256').update(req.headers.get('x-clave') || '').digest('hex') === HUELLA;

export default async (req) => {
  if (!autorizado(req)) return new Response('Sin acceso', { status: 401 });
  if (req.method !== 'POST') return new Response('Usa POST', { status: 405 });
  let body = {};
  try { body = await req.json(); } catch (e) { return new Response('JSON inválido', { status: 400 }); }
  const urls = (Array.isArray(body.urls) ? body.urls : []).filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u)).slice(0, 25);
  const out = await Promise.all(urls.map(check));
  return Response.json(out, { headers: { 'Cache-Control': 'no-store' } });
};
