/* Spotify (API web con inicio de sesión PKCE). Requiere Spotify Premium para controlar la música. */
"use strict";

const SP_CLIENT = "b8e66914c7e04a36befd16b1c9aeeb22";
const SP_REDIRECT = "com.joel.mamadoapp://spotify-callback";
const SP_SCOPES = "user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative user-library-read";
const APPP = plug("App"), BRW = plug("Browser");

function spCfg() { const a = D.ajustes; a.musica = a.musica || {fuente: "cel"}; a.spotify = a.spotify || {}; return a.spotify; }
const usaSpotify = () => (D.ajustes.musica || {}).fuente === "spotify";
const spConectado = () => !!spCfg().refresh;

// ---------- Inicio de sesión ----------
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function aleatorio(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a).slice(0, n); }

ACT.spConectar = async () => {
  if (!isNative) { toast("Conectar Spotify funciona en la app instalada."); return; }
  const verif = aleatorio(64), estado = aleatorio(16);
  const reto = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verif)));
  try { sessionStorage.setItem("sp_pkce", JSON.stringify({verif, estado})); } catch (e) {}
  localStorage.setItem("sp_pkce", JSON.stringify({verif, estado}));
  const url = "https://accounts.spotify.com/authorize?" + new URLSearchParams({
    client_id: SP_CLIENT, response_type: "code", redirect_uri: SP_REDIRECT, scope: SP_SCOPES,
    code_challenge_method: "S256", code_challenge: reto, state: estado}).toString();
  try { await BRW.open({url}); } catch (e) { window.open(url, "_system"); }
};
async function spRecibirCallback(u) {
  if (!u || !u.startsWith(SP_REDIRECT)) return;
  try { BRW && BRW.close().catch(() => {}); } catch (e) {}
  const q = new URL(u.replace(SP_REDIRECT, "https://x/cb")).searchParams;
  let p = {}; try { p = JSON.parse(localStorage.getItem("sp_pkce") || "{}"); } catch (e) {}
  if (q.get("error")) { toast(q.get("error") === "access_denied" ? "Cancelaste la conexión con Spotify." : "Spotify no dejó conectar: " + q.get("error")); return; }
  if (!q.get("code") || q.get("state") !== p.estado) { toast("No se pudo conectar Spotify. Intenta otra vez."); return; }
  try {
    const t = await spToken({grant_type: "authorization_code", code: q.get("code"), redirect_uri: SP_REDIRECT, code_verifier: p.verif});
    localStorage.removeItem("sp_pkce");
    D.ajustes.musica = {...(D.ajustes.musica || {}), fuente: "spotify"};
    guardarYa(); toast("¡Spotify conectado! 🎧"); render();
  } catch (e) { toast("No se pudo conectar Spotify: " + String(e.message || e).slice(0, 80)); }
}
async function spToken(params) {
  const r = await fetch("https://accounts.spotify.com/api/token", {method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams({client_id: SP_CLIENT, ...params}).toString()});
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || "HTTP " + r.status);
  const c = spCfg(); c.token = j.access_token; c.exp = Date.now() + (j.expires_in - 60) * 1000; if (j.refresh_token) c.refresh = j.refresh_token;
  guardar(); return j;
}
async function spTokenValido() {
  const c = spCfg(); if (!c.refresh) throw new Error("NO_CONECTADO");
  if (c.token && Date.now() < c.exp) return c.token;
  try { await spToken({grant_type: "refresh_token", refresh_token: c.refresh}); }
  catch (e) { if (/invalid_grant|revoked/i.test(String(e.message))) { delete c.refresh; delete c.token; guardar(); throw new Error("NO_CONECTADO"); } throw e; }
  return c.token;
}
ACT.spDesconectar = () => { if (!confirm("¿Desconectar Spotify de la app?")) return; D.ajustes.spotify = {}; D.ajustes.musica.fuente = "cel"; guardar(); keepScroll(() => {}); };

if (APPP) {
  APPP.addListener("appUrlOpen", ev => spRecibirCallback(ev.url));
  APPP.getLaunchUrl().then(r => r && r.url && spRecibirCallback(r.url)).catch(() => {});
}

// ---------- Llamadas a la API ----------
async function sp(ruta, {method = "GET", body, query} = {}) {
  const tok = await spTokenValido();
  const url = "https://api.spotify.com/v1" + ruta + (query ? "?" + new URLSearchParams(query) : "");
  const r = await fetch(url, {method, headers: {Authorization: "Bearer " + tok, ...(body ? {"Content-Type": "application/json"} : {})}, body: body ? JSON.stringify(body) : undefined});
  if (r.status === 204 || r.status === 202) return null;
  const txt = await r.text(); let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
  if (!r.ok) {
    const razon = (j && j.error && (j.error.reason || j.error.message)) || "HTTP " + r.status;
    const err = new Error(razon); err.status = r.status; throw err;
  }
  return j;
}
function spError(e) {
  const m = String(e.message || e);
  if (m === "NO_CONECTADO") return "Conecta tu cuenta de Spotify en Ajustes → Música.";
  if (/PREMIUM_REQUIRED|premium/i.test(m)) return "Spotify pide Premium para controlar la música desde otra app.";
  if (/NO_ACTIVE_DEVICE|404/.test(m) || e.status === 404) return "No hay dónde sonar. Abre Spotify en tu cel y reproduce algo una vez.";
  if (/Failed to fetch|Network/i.test(m)) return "Sin conexión a internet.";
  if (e.status === 403) return "Spotify no permitió esa acción.";
  return "Spotify: " + m.slice(0, 80);
}

// ---------- Estado y reproductor ----------
let spEstado = null;
async function spRefrescar() {
  try {
    const s = await sp("/me/player", {query: {additional_types: "track,episode"}});
    spEstado = s && s.item ? {titulo: s.item.name, artista: (s.item.artists || []).map(a => a.name).join(", ") || (s.item.show && s.item.show.name) || "",
      arte: ((s.item.album || s.item).images || []).slice(-1)[0]?.url || "", sonando: s.is_playing, disp: s.device && s.device.name,
      prog: s.progress_ms || 0, dur: s.item.duration_ms || 1, at: Date.now()} : {vacio: true};
  } catch (e) { spEstado = {error: spError(e)}; }
  const p = $("#player"); if (p) p.innerHTML = spPlayerHTML();
}
function spPlayerHTML() {
  if (!spConectado()) return `<div class="row"><div class="pnota">${ICO.nota}</div><div style="flex:1;min-width:0"><div class="t">Spotify</div><div class="muted small">No conectado</div></div><button class="btn primary" data-act="spConectar">Conectar</button></div>`;
  const s = spEstado || {};
  const btn = (a, t, l) => `<button class="pbtn" aria-label="${l}" data-act="spCtl" data-a="${a}">${t}</button>`;
  const prog = s.dur ? Math.min(100, ((s.prog + (s.sonando ? Date.now() - s.at : 0)) / s.dur) * 100) : 0;
  return `<div class="row">${s.arte ? `<img src="${esc(s.arte)}" alt="" style="width:46px;height:46px;border-radius:8px;flex:0 0 auto">` : `<div class="pnota" style="color:#1DB954">${ICO.nota}</div>`}
      <div style="min-width:0;flex:1"><div class="t" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.titulo || (s.error ? "Spotify" : spEstado ? "Nada sonando" : "Cargando…"))}</div>
      <div class="muted small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.error || (s.titulo ? s.artista + (s.disp ? " · " + s.disp : "") : "Busca algo para poner"))}</div></div>
      <div class="row" style="gap:4px">${btn("prev", ICO.prev, "Anterior")}${btn("toggle", s.sonando ? ICO.pausa : ICO.play, s.sonando ? "Pausa" : "Reproducir")}${btn("next", ICO.next, "Siguiente")}</div></div>
    ${s.titulo ? `<div class="bar" style="height:4px;margin-top:8px"><i style="width:${prog}%;background:#1DB954"></i></div>` : ""}
    <div class="row" style="margin-top:8px"><button class="ghost grow" data-act="spBuscar"><span class="row" style="justify-content:center;gap:6px">${ICO.buscar}Buscar</span></button><button class="ghost grow" data-act="spPlaylists">Mis playlists</button><button class="ghost" data-act="spDisp" aria-label="Dispositivos">${ICO.bocina}</button></div>`;
}
ACT.spCtl = async el => {
  const a = el.dataset.a;
  try {
    if (a === "toggle") { await sp(spEstado && spEstado.sonando ? "/me/player/pause" : "/me/player/play", {method: "PUT"}); if (spEstado) { spEstado.sonando = !spEstado.sonando; spEstado.at = Date.now(); } }
    else await sp(a === "next" ? "/me/player/next" : "/me/player/previous", {method: "POST"});
  } catch (e) { await manejarSinDispositivo(e, () => ACT.spCtl(el)); }
  const p = $("#player"); if (p) p.innerHTML = spPlayerHTML();
  setTimeout(spRefrescar, 700);
};
// Si no hay dispositivo activo, abre Spotify en el cel y reintenta
async function manejarSinDispositivo(e, reintento) {
  if ((e.status === 404 || /NO_ACTIVE_DEVICE/.test(e.message)) && MUS && !manejarSinDispositivo.ya) {
    manejarSinDispositivo.ya = true; toast("Abriendo Spotify en tu cel…");
    try { await MUS.abrirApp({pkg: "com.spotify.music"}); } catch (x) { toast("Instala o abre Spotify primero."); manejarSinDispositivo.ya = false; return; }
    setTimeout(async () => {
      try { const d = await sp("/me/player/devices"); const cel = (d.devices || []).find(x => x.type === "Smartphone") || (d.devices || [])[0]; if (cel) await sp("/me/player", {method: "PUT", body: {device_ids: [cel.id], play: false}}); await reintento(); }
      catch (x) { toast(spError(x)); }
      manejarSinDispositivo.ya = false;
    }, 3500);
    return;
  }
  toast(spError(e));
}

// ---------- Buscar, playlists y dispositivos ----------
let spQ = "", spRes = null;
ACT.spBuscar = () => { spRes = null; hojaBuscar(); };
function hojaBuscar() {
  abrirHoja(`<h2 style="margin-bottom:10px">Buscar en Spotify</h2>
    <div class="row"><input id="spQ" class="grow" type="search" enterkeyhint="search" placeholder="Canción, artista o playlist" value="${esc(spQ)}"><button class="btn primary" data-act="spBuscarIr">Buscar</button></div>
    <div id="spRes" style="margin-top:12px">${spResultados()}</div>`);
  const q = $("#spQ"); q.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); ACT.spBuscarIr(); } }); if (!spQ) q.focus();
}
function spResultados() {
  if (!spRes) return `<p class="muted small">Tip: busca "gym", "phonk", "corridos" o tu artista favorito.</p>`;
  if (spRes.error) return `<p class="small" style="color:var(--danger)">${esc(spRes.error)}</p>`;
  const img = x => { const u = (x.images || x.album?.images || []).slice(-1)[0]?.url; return u ? `<img src="${esc(u)}" alt="" style="width:42px;height:42px;border-radius:6px;flex:0 0 auto">` : `<div class="pnota" style="width:42px;height:42px">${ICO.nota}</div>`; };
  const tr = spRes.tracks || [], pl = spRes.playlists || [];
  return `${tr.length ? `<p class="muted small" style="margin:0 2px 4px">Canciones</p><div class="card" style="padding:4px 12px">${tr.map(t => `<div class="li"><div class="row" style="min-width:0">${img(t)}<div style="min-width:0"><div class="t" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.name)}</div><div class="d">${esc((t.artists || []).map(a => a.name).join(", "))}</div></div></div>
      <div class="row" style="gap:4px"><button class="pbtn" aria-label="Poner" data-act="spPoner" data-uri="${esc(t.uri)}">${ICO.play}</button><button class="pbtn" aria-label="Agregar a la cola" data-act="spCola" data-uri="${esc(t.uri)}">${ICO.mas}</button></div></div>`).join("")}</div>` : ""}
    ${pl.length ? `<p class="muted small" style="margin:12px 2px 4px">Playlists</p><div class="card" style="padding:4px 12px">${pl.map(p => `<div class="li" data-act="spPonerCtx" data-uri="${esc(p.uri)}" style="cursor:pointer"><div class="row" style="min-width:0">${img(p)}<div style="min-width:0"><div class="t" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</div><div class="d">${esc(p.owner?.display_name || "")}</div></div></div><span class="pbtn">${ICO.play}</span></div>`).join("")}</div>` : ""}
    ${!tr.length && !pl.length ? `<p class="muted small">Sin resultados.</p>` : ""}`;
}
ACT.spBuscarIr = async () => {
  spQ = ($("#spQ").value || "").trim(); if (!spQ) return;
  $("#spRes").innerHTML = `<p class="muted">Buscando…</p>`;
  try { const r = await sp("/search", {query: {q: spQ, type: "track,playlist", limit: 10}}); spRes = {tracks: (r.tracks?.items || []).filter(Boolean), playlists: (r.playlists?.items || []).filter(Boolean)}; }
  catch (e) { spRes = {error: spError(e)}; }
  const box = $("#spRes"); if (box) box.innerHTML = spResultados();
};
ACT.spPlaylists = async () => {
  abrirHoja(`<h2 style="margin-bottom:10px">Tus playlists</h2><div id="spRes"><p class="muted">Cargando…</p></div>`);
  try { const r = await sp("/me/playlists", {query: {limit: 40}}); spRes = {playlists: (r.items || []).filter(Boolean)}; }
  catch (e) { spRes = {error: spError(e)}; }
  const box = $("#spRes"); if (box) box.innerHTML = spResultados();
};
async function spPlay(body) {
  try { await sp("/me/player/play", {method: "PUT", body}); toast("Sonando 🎧"); cerrarHoja(); }
  catch (e) { await manejarSinDispositivo(e, async () => { await sp("/me/player/play", {method: "PUT", body}); toast("Sonando 🎧"); cerrarHoja(); }); }
  setTimeout(spRefrescar, 900);
}
ACT.spPoner = el => spPlay({uris: [el.dataset.uri]});
ACT.spPonerCtx = el => spPlay({context_uri: el.dataset.uri});
ACT.spCola = async el => {
  try { await sp("/me/player/queue", {method: "POST", query: {uri: el.dataset.uri}}); toast("Agregada a la cola"); }
  catch (e) { toast(spError(e)); }
};
ACT.spDisp = async () => {
  abrirHoja(`<h2 style="margin-bottom:10px">¿Dónde suena?</h2><div id="spDis"><p class="muted">Buscando dispositivos…</p></div>`);
  let html;
  try {
    const d = await sp("/me/player/devices"); const xs = d.devices || [];
    html = xs.length ? `<div class="card" style="padding:4px 12px">${xs.map(x => `<div class="li" data-act="spMover" data-id="${esc(x.id)}" style="cursor:pointer"><div><div class="t">${esc(x.name)}</div><div class="d">${esc(x.type)}${x.is_active ? " · sonando aquí" : ""}</div></div>${x.is_active ? `<span class="pill">Activo</span>` : `<span class="muted">›</span>`}</div>`).join("")}</div>`
      : `<p class="small">No veo dispositivos. Abre Spotify en tu cel, bocina o compu y vuelve a intentar.</p><button class="btn block" data-act="spAbrirApp">Abrir Spotify</button>`;
  } catch (e) { html = `<p class="small" style="color:var(--danger)">${esc(spError(e))}</p>`; }
  const box = $("#spDis"); if (box) box.innerHTML = html;
};
ACT.spMover = async el => { try { await sp("/me/player", {method: "PUT", body: {device_ids: [el.dataset.id], play: true}}); toast("Cambiado"); cerrarHoja(); } catch (e) { toast(spError(e)); } setTimeout(spRefrescar, 900); };
ACT.spAbrirApp = () => { MUS && MUS.abrirApp({pkg: "com.spotify.music"}).catch(() => toast("No encontré Spotify instalado.")); };

// ---------- Ajustes ----------
function ajustesMusica() {
  const f = (D.ajustes.musica || {}).fuente || "cel";
  return `<section class="card"><h2>Música</h2>
    <p class="muted small" style="margin:6px 0 8px">Qué controla el reproductor en Gym → Entrenar.</p>
    <div class="seg" style="margin:0"><button class="chip" aria-pressed="${f === "cel"}" data-act="musFuente" data-k="cel">Reproductor del cel</button><button class="chip" aria-pressed="${f === "spotify"}" data-act="musFuente" data-k="spotify">Spotify</button></div>
    <p class="muted small" style="margin:8px 0 0">${f === "cel" ? "Funciona con cualquier app de música (Spotify gratis incluido): pausa, siguiente y anterior." : "Busca canciones, pon tus playlists y elige dónde suena. Necesita Spotify Premium."}</p>
    ${f === "spotify" ? (spConectado()
      ? `<div class="row" style="margin-top:10px;justify-content:space-between"><span class="small">✅ Cuenta conectada</span><button class="ghost danger" data-act="spDesconectar">Desconectar</button></div>`
      : `<button class="btn primary block" style="margin-top:10px;background:#1DB954;border-color:#1DB954;color:#fff" data-act="spConectar">Conectar con Spotify</button>`) : ""}
  </section>`;
}
ACT.musFuente = el => { D.ajustes.musica = {...(D.ajustes.musica || {}), fuente: el.dataset.k}; guardar(); keepScroll(() => {}); };
