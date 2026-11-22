// FuturaTV · trae una lista M3U para el revisor web (muchos sitios no dejan que una página la lea directo).
// Solo devuelve listas M3U de texto (empiezan con #EXTM3U), hasta 10 MB.
import { createHash } from 'node:crypto';
// Solo el dueño: la clave viaja en la cabecera x-clave; aquí solo está su huella (SHA-256), nunca la clave.
const HUELLA = process.env.FTV_CLAVE_SHA256 || '78bd972f63b0d8e8d5dfe39b7186c6d10e00f20afafff9ab7dd96c58c5ddc1cb';
const autorizado = (req) => createHash('sha256').update(req.headers.get('x-clave') || '').digest('hex') === HUELLA;

export default async (req) => {
  if (!autorizado(req)) return new Response('Sin acceso', { status: 401 });
  const u = new URL(req.url).searchParams.get('u') || '';
  if (!/^https?:\/\//i.test(u)) return new Response('Falta el enlace', { status: 400 });
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(u, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 FuturaTV-revisor' } });
    if (!r.ok) return new Response('La lista respondió con error ' + r.status, { status: 502 });
    const reader = r.body.getReader(); const parts = []; let n = 0;
    while (n < 10e6) { const { done, value } = await reader.read(); if (done) break; parts.push(Buffer.from(value)); n += value.length; }
    try { reader.cancel(); } catch (e) {}
    const text = Buffer.concat(parts).toString('utf8').replace(/^﻿/, '');
    if (!text.trimStart().startsWith('#EXTM3U')) return new Response('Ese enlace no es una lista M3U', { status: 415 });
    return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch (e) {
    return new Response('No se pudo descargar la lista', { status: 504 });
  } finally { clearTimeout(t); }
};
