/* Mascota, retos, puntos, tienda, logros y widget. Usa el estado D y helpers de app.js */
"use strict";

const PW = plug("PetWidget");
const MAX_RETOS = 3, MIN_RETO = 10, MAX_RETO = 14 * 1440;

// ================= Puntos =================
// Crecen con la duración, pero menos que lineal: 10 min = 10, 1 h ≈ 29, 1 día ≈ 197, 1 semana ≈ 632, 2 semanas ≈ 958
const ptsReto = min => Math.round(10 * Math.pow(Math.max(MIN_RETO, min) / 10, 0.6));
const PTS = {habito: 5, agua: 10, gym: 25, pomo: 5, logro: 25};

function otorgar(key, pts, txt) {
  if (D.otorgados[key] != null) return false;
  D.otorgados[key] = pts; D.puntos.saldo += pts; D.puntos.xp += pts;
  D.puntos.log.unshift({t: Date.now(), txt, pts}); D.puntos.log = D.puntos.log.slice(0, 200);
  guardar(); revisarLogros(); syncWidget();
  return true;
}
function revocar(key, txt) {
  const pts = D.otorgados[key]; if (pts == null) return;
  delete D.otorgados[key]; D.puntos.saldo -= pts; D.puntos.xp = Math.max(0, D.puntos.xp - pts);
  D.puntos.log.unshift({t: Date.now(), txt, pts: -pts}); guardar(); syncWidget();
}
const nivel = xp => Math.floor(Math.sqrt(xp / 50)) + 1;
const xpNivel = n => 50 * (n - 1) * (n - 1);

// ================= Logros =================
function estadisticas() {
  const hechos = D.retos.filter(r => r.estado === "cumplido");
  let rachaMax = 0;
  D.habitos.forEach(h => { rachaMax = Math.max(rachaMax, racha(h.id)); });
  rachaMax = Math.max(rachaMax, D.rachaRecord || 0); D.rachaRecord = rachaMax;
  return {retos: hechos.length, retoMax: Math.max(0, ...hechos.map(r => r.minutos)), gym: D.sesiones.length,
    aguaDias: Object.keys(D.otorgados).filter(k => k.startsWith("agua:")).length, rachaMax,
    inventario: D.mascota.inventario.length, xp: D.puntos.xp};
}
let _revisando = false;
function revisarLogros() {
  if (_revisando) return; _revisando = true;
  const s = estadisticas();
  LOGROS.forEach(l => {
    if (!D.logros[l.id] && l.test(s)) {
      D.logros[l.id] = Date.now();
      otorgar("logro:" + l.id, PTS.logro, `Logro: ${l.nombre}`);
      setTimeout(() => toast(`🏅 ¡Logro desbloqueado! ${l.nombre} (+${PTS.logro})`), 2600);
    }
  });
  _revisando = false;
}

// ================= Mascota (dibujo) =================
function petSVG(o = {}) {
  const m = D.mascota;
  const eq = o.equipo || m.equipo;
  const col = COLORES_MASCOTA[o.color || m.color] || COLORES_MASCOTA.amarillo;
  const fondo = o.fondo !== undefined ? o.fondo : m.fondo;
  const animo = o.animo || animoMascota();
  const ink = "#1D2A33";
  const fondos = {
    gym: `<rect width="200" height="200" rx="28" fill="#3b4650"/><rect y="160" width="200" height="40" fill="#2a3239"/><rect x="18" y="40" width="6" height="110" fill="#566370"/><rect x="176" y="40" width="6" height="110" fill="#566370"/><rect x="18" y="70" width="164" height="5" fill="#566370"/>`,
    playa: `<rect width="200" height="200" rx="28" fill="#8fd3f4"/><circle cx="160" cy="42" r="18" fill="#ffe27a"/><rect y="138" width="200" height="14" fill="#4cb8eb"/><path d="M0 150h200v22q0 28-28 28H28Q0 200 0 172z" fill="#f2d49b"/>`,
    atardecer: `<defs><linearGradient id="atd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a5c"/><stop offset="1" stop-color="#ffd27a"/></linearGradient></defs><rect width="200" height="200" rx="28" fill="url(#atd)"/><circle cx="100" cy="160" r="40" fill="#fff1b8" opacity=".7"/>`,
    noche: `<rect width="200" height="200" rx="28" fill="#1b2440"/><circle cx="158" cy="40" r="14" fill="#f4f1d0"/><circle cx="152" cy="36" r="13" fill="#1b2440"/>${[[30, 30], [60, 55], [100, 22], [26, 92], [176, 96], [124, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#fff"/>`).join("")}`,
  };
  const ojos = animo === "feliz"
    ? `<path d="M71 113q9-11 18 0M111 113q9-11 18 0" stroke="${ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`
    : animo === "triste"
      ? `<circle cx="80" cy="112" r="5.5" fill="${ink}"/><circle cx="120" cy="112" r="5.5" fill="${ink}"/><path d="M70 99l18 5M130 99l-18 5" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>`
      : `<circle cx="80" cy="110" r="6.5" fill="${ink}"/><circle cx="120" cy="110" r="6.5" fill="${ink}"/><circle cx="82" cy="108" r="2" fill="#fff"/><circle cx="122" cy="108" r="2" fill="#fff"/>`;
  const boca = animo === "feliz" ? `<path d="M88 125q12 14 24 0" stroke="${ink}" stroke-width="4" fill="#C8423B" stroke-linejoin="round"/>`
    : animo === "triste" ? `<path d="M90 134q10-9 20 0" stroke="${ink}" stroke-width="4" fill="none" stroke-linecap="round"/>`
      : `<path d="M91 128q9 5 18 0" stroke="${ink}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  const acc = {
    capa: `<path d="M50 100Q28 168 40 186h120q12-18-10-86z" fill="#C8423B"/>`,
    banda: `<rect x="58" y="82" width="84" height="12" rx="6" fill="#D9534F"/><rect x="58" y="86" width="84" height="3" fill="#fff" opacity=".7"/>`,
    gorra: `<path d="M60 86Q100 36 140 86z" fill="#2F64B0"/><path d="M118 82q34-6 52 6-20 6-52 2z" fill="#234d88"/><circle cx="100" cy="58" r="4" fill="#234d88"/>`,
    audifonos: `<path d="M50 114Q50 46 100 46t50 68" stroke="${ink}" stroke-width="7" fill="none"/><rect x="38" y="100" width="18" height="28" rx="7" fill="#D9534F"/><rect x="144" y="100" width="18" height="28" rx="7" fill="#D9534F"/>`,
    corona: `<path d="M70 74l6-28 12 16 12-22 12 22 12-16 6 28z" fill="#F5C542" stroke="#B98C10" stroke-width="2.5" stroke-linejoin="round"/><circle cx="100" cy="64" r="4" fill="#C8423B"/><circle cx="82" cy="68" r="3" fill="#3a7bd5"/><circle cx="118" cy="68" r="3" fill="#3a7bd5"/>`,
    lentes: `<rect x="64" y="100" width="30" height="19" rx="7" fill="${ink}"/><rect x="106" y="100" width="30" height="19" rx="7" fill="${ink}"/><path d="M94 107h12" stroke="${ink}" stroke-width="4"/><path d="M70 105l8-1" stroke="#fff" stroke-width="2" opacity=".6"/><path d="M112 105l8-1" stroke="#fff" stroke-width="2" opacity=".6"/>`,
    bigote: `<path d="M82 121q9-8 18-2 9-6 18 2-9 6-18 2-9 4-18-2z" fill="#5a3a22"/>`,
    playera: `<path d="M64 112l14-6q22 14 44 0l14 6 4 56q-40 16-80 0z" fill="#D9534F" opacity=".95"/>`,
    cadena: `<path d="M72 138q28 22 56 0" stroke="#F5C542" stroke-width="4" fill="none" stroke-dasharray="3 3"/><circle cx="100" cy="150" r="6" fill="#F5C542" stroke="#B98C10" stroke-width="2"/>`,
    mancuerna: `<rect x="150" y="137" width="36" height="6" rx="2" fill="#7a8791"/><rect x="146" y="127" width="8" height="26" rx="2" fill="${ink}"/><rect x="182" y="127" width="8" height="26" rx="2" fill="${ink}"/>`,
    shaker: `<rect x="150" y="116" width="22" height="36" rx="5" fill="#f4f6f8" stroke="#8a97a1" stroke-width="2"/><rect x="150" y="110" width="22" height="9" rx="3" fill="#3a7bd5"/><rect x="153" y="132" width="16" height="17" rx="3" fill="#c49a6c"/>`,
  };
  const pon = slot => eq[slot] && acc[eq[slot]] ? acc[eq[slot]] : "";
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    ${fondos[fondo] || ""}
    ${eq.cuerpo === "capa" ? acc.capa : ""}
    <ellipse cx="78" cy="178" rx="15" ry="7" fill="${col.borde}"/><ellipse cx="122" cy="178" rx="15" ry="7" fill="${col.borde}"/>
    <path d="M64 84l-8-32 26 20zM136 84l8-32-26 20z" fill="${col.borde}"/>
    <ellipse cx="44" cy="132" rx="11" ry="17" fill="${col.cuerpo}" stroke="${col.borde}" stroke-width="3" transform="rotate(-20 44 132)"/>
    <ellipse cx="100" cy="125" rx="60" ry="55" fill="${col.cuerpo}" stroke="${col.borde}" stroke-width="3"/>
    <ellipse cx="100" cy="142" rx="36" ry="30" fill="${col.panza}"/>
    ${eq.cuerpo && eq.cuerpo !== "capa" ? pon("cuerpo") : ""}
    <ellipse cx="156" cy="132" rx="11" ry="17" fill="${col.cuerpo}" stroke="${col.borde}" stroke-width="3" transform="rotate(20 156 132)"/>
    <circle cx="66" cy="125" r="7" fill="#F28B82" opacity=".55"/><circle cx="134" cy="125" r="7" fill="#F28B82" opacity=".55"/>
    ${ojos}${boca}
    ${pon("cara")}${pon("cabeza")}${pon("mano")}
  </svg>`;
}

// ================= Ánimo y mensajes =================
function aguaEsperada() { const h = new Date().getHours() + new Date().getMinutes() / 60; return D.ajustes.aguaMeta * Math.min(1, Math.max(0, (h - 8) / 13)); }
function habitosPendientes() { const hechos = D.habLog[hoy()] || []; return D.habitos.filter(h => !hechos.includes(h.id)).length; }
function retosListos() { return D.retos.filter(r => r.estado === "activo" && Date.now() >= r.fin); }
function animoMascota() {
  const f = hoy(); const ganadosHoy = D.puntos.log.some(x => x.pts > 0 && keyFecha(x.t) === f);
  const h = new Date().getHours(); const agua = D.agua[f] || 0;
  if (ganadosHoy || retosListos().length) return "feliz";
  if (h >= 17 && agua < aguaEsperada() * 0.5 && habitosPendientes() === D.habitos.length && D.habitos.length) return "triste";
  return "normal";
}
function mensajeMascota() {
  const f = hoy(); const agua = D.agua[f] || 0, meta = D.ajustes.aguaMeta; const h = new Date().getHours();
  const listo = retosListos()[0];
  if (listo) return `¡Tu reto “${listo.titulo}” ya está listo! Entra a cobrar tus ${listo.pts} puntos.`;
  if (agua < meta && agua < aguaEsperada() - 400) return `¿Y el agua? Vas en ${(agua / 1000).toFixed(1)} de ${(meta / 1000).toFixed(1)} L 💧`;
  const gymHoy = D.ajustes.gymRec.dias.includes(new Date().getDay()) && !D.sesiones.some(s => s.fecha === f);
  if (gymHoy && h >= 12) return "Hoy toca gym. ¿Vamos o qué? 🏋️";
  const pend = habitosPendientes();
  if (pend && h >= 18) return `Te falta${pend > 1 ? "n" : ""} ${pend} hábito${pend > 1 ? "s" : ""} hoy. Son puntos fáciles.`;
  const act = D.retos.find(r => r.estado === "activo");
  if (act) return `Vas con “${act.titulo}”. Faltan ${fmtRestante(act.fin - Date.now())}.`;
  if (D.retos.filter(r => r.estado === "activo").length === 0) return "Sin retos activos. ¿Le entramos a uno?";
  return "Aquí andamos, échale ganas 💪";
}
function fmtRestante(ms) {
  if (ms <= 0) return "nada";
  const m = Math.ceil(ms / 60000); const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d) return `${d} d ${h} h`; if (h) return `${h} h ${mm} min`;
  if (m <= 1) { const s = Math.ceil(ms / 1000); return `${s} s`; } return `${mm} min`;
}
function fmtDur(min) { if (min >= 1440) { const d = min / 1440; return `${r1(d)} día${d === 1 ? "" : "s"}`; } if (min >= 60) { const h = min / 60; return `${r1(h)} h`; } return `${min} min`; }

// Tarjeta para la pantalla Hoy
function petCard() {
  const m = D.mascota; const n = nivel(D.puntos.xp);
  return `<section class="card petcard" data-act="ir" data-to="bestia">
    <div class="petmini">${petSVG({fondo: m.fondo})}</div>
    <div style="min-width:0;flex:1"><div class="row" style="justify-content:space-between"><h2>${esc(m.nombre)}</h2><span class="pill">Nv ${n}</span></div>
    <div class="bubble">${esc(mensajeMascota())}</div><div class="muted small" style="margin-top:6px">⭐ ${D.puntos.saldo} puntos</div></div></section>`;
}

// ================= Pantalla Bestia =================
let subB = "retos", probar = null;
function vBestia() {
  const m = D.mascota; const n = nivel(D.puntos.xp); const a = xpNivel(n), b = xpNivel(n + 1);
  const tabs = [["retos", "Retos"], ["tienda", "Tienda"], ["logros", "Logros"]];
  const equipoPrueba = probar ? probarEquipo(probar) : null;
  const head = `
    <section class="card" style="text-align:center">
      <div class="petbig">${petSVG(equipoPrueba || {})}</div>
      ${probar ? `<p class="small" style="margin:4px 0 0">Probando: <b>${esc(TIENDA.find(t => t.id === probar).nombre)}</b> <button class="ghost" data-act="noProbar">Quitar</button></p>` : `<div class="bubble" style="margin:6px auto 0;max-width:420px">${esc(mensajeMascota())}</div>`}
      <div class="row" style="justify-content:center;gap:6px;margin-top:10px"><h2 data-act="renombrar" style="cursor:pointer">${esc(m.nombre)} ✎</h2><span class="pill">Nivel ${n}</span></div>
      <div class="bar" style="margin:8px 0 4px"><i style="width:${pct(D.puntos.xp - a, b - a)}%"></i></div>
      <div class="row muted small" style="justify-content:space-between"><span>${D.puntos.xp} XP</span><span>⭐ <b style="color:var(--ink)">${D.puntos.saldo}</b> puntos para gastar</span></div>
    </section>
    <div class="seg" role="group">${tabs.map(([k, l]) => `<button class="chip" aria-pressed="${subB === k}" data-act="subB" data-k="${k}">${l}</button>`).join("")}</div>`;
  if (subB === "retos") bRetos(head); else if (subB === "tienda") bTienda(head); else bLogros(head);
}
ACT.subB = el => { subB = el.dataset.k; probar = null; render(); };
ACT.noProbar = () => { probar = null; keepScroll(() => {}); };
ACT.renombrar = () => { const v = prompt("¿Cómo se llama tu mascota?", D.mascota.nombre); if (v && v.trim()) { D.mascota.nombre = v.trim().slice(0, 20); guardar(); syncWidget(); render(); } };

// ---- Retos ----
function bRetos(head) {
  const act = D.retos.filter(r => r.estado === "activo").sort((x, y) => x.fin - y.fin);
  const hist = D.retos.filter(r => r.estado !== "activo").sort((x, y) => (y.cerrado || 0) - (x.cerrado || 0)).slice(0, 15);
  view().innerHTML = head + `
    <div class="row" style="justify-content:space-between;margin:0 2px 8px"><span class="muted small">${act.length} de ${MAX_RETOS} retos activos</span></div>
    ${act.map(r => retoFila(r)).join("") || `<div class="card empty"><b>Sin retos activos</b>Ponte un reto con tiempo: desde 10 min hasta 2 semanas.</div>`}
    <button class="btn primary block lg" data-act="nuevoReto" ${act.length >= MAX_RETOS ? "disabled" : ""}>${act.length >= MAX_RETOS ? "Máximo 3 retos a la vez" : "+ Nuevo reto"}</button>
    ${hist.length ? `<h2 style="margin:20px 2px 8px">Últimos retos</h2><section class="card" style="padding:4px 14px">${hist.map(r => `<div class="li"><div style="min-width:0"><div class="t">${esc(r.titulo)}</div><div class="d">${fmtDur(r.minutos)} · ${r.estado === "cumplido" ? "Cumplido" : r.estado === "fallido" ? "No se logró" : "Abandonado"}</div></div><span class="${r.estado === "cumplido" ? "" : "muted"}" style="font-weight:600">${r.estado === "cumplido" ? `+${r.pts}` : "0"}</span></div>`).join("")}</section>` : ""}`;
  iniciarTickRetos();
}
function retoFila(r) {
  const total = r.fin - r.inicio, pasado = Date.now() - r.inicio; const listo = Date.now() >= r.fin;
  return `<section class="card reto ${listo ? "listo" : ""}">
    <div class="row" style="align-items:flex-start;justify-content:space-between"><div style="min-width:0"><h2>${esc(r.titulo)}</h2><div class="muted small">${fmtDur(r.minutos)} · vale ${r.pts} puntos</div></div>
    ${listo ? "" : `<button class="iconbtn" aria-label="Abandonar reto" data-act="abandonar" data-id="${r.id}">✕</button>`}</div>
    <div class="bar" style="margin:12px 0 6px"><i style="width:${pct(pasado, total)}%"></i></div>
    ${listo
      ? `<p class="small" style="margin:6px 0 10px">¡Se acabó el tiempo! ¿Lo cumpliste?</p><div class="grid2"><button class="btn primary" data-act="cumplido" data-id="${r.id}">Sí, cobrar +${r.pts}</button><button class="btn" data-act="fallido" data-id="${r.id}">No lo logré</button></div>`
      : `<div class="row muted small" style="justify-content:space-between"><span>Faltan <b class="cd" data-fin="${r.fin}" style="color:var(--ink)">${fmtRestante(r.fin - Date.now())}</b></span><span>Termina ${new Date(r.fin).toLocaleString("es-MX", {weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit"})}</span></div>`}
  </section>`;
}
let retoInt = null;
function iniciarTickRetos() {
  clearInterval(retoInt);
  retoInt = setInterval(() => {
    if (tab !== "bestia") { clearInterval(retoInt); return; }
    let cambio = false;
    document.querySelectorAll(".cd").forEach(el => { const ms = +el.dataset.fin - Date.now(); if (ms <= 0) cambio = true; else el.textContent = fmtRestante(ms); });
    if (cambio && !sheetOpen) keepScroll(() => {});
  }, 1000);
}

const PRESETS = [[10, "10 min"], [30, "30 min"], [60, "1 h"], [180, "3 h"], [1440, "1 día"], [4320, "3 días"], [10080, "1 semana"], [20160, "2 semanas"]];
let nuevo = {titulo: "", min: 60};
ACT.nuevoReto = () => { if (D.retos.filter(r => r.estado === "activo").length >= MAX_RETOS) return; nuevo = {titulo: "", min: 60}; hojaReto(); };
function hojaReto() {
  abrirHoja(`<h2 style="margin-bottom:6px">Nuevo reto</h2>
    <p class="muted small" style="margin:0 0 10px">No lo vas a poder cobrar antes de que se acabe el tiempo. Elige bien.</p>
    <label class="f" for="rTit">¿Cuál es el reto?</label><input id="rTit" placeholder="Ej. Cero refresco, leer 30 páginas…" value="${esc(nuevo.titulo)}" data-in="rTit" maxlength="60">
    <label class="f">Duración</label>
    <div class="seg" style="flex-wrap:wrap">${PRESETS.map(([m, l]) => `<button class="chip" aria-pressed="${nuevo.min === m}" data-act="rPreset" data-m="${m}">${l}</button>`).join("")}</div>
    <div class="row"><input id="rNum" class="grow" type="text" inputmode="decimal" placeholder="Otra" aria-label="Duración personalizada" data-in="rCustom"><select id="rUni" style="width:auto" data-in="rCustom"><option value="1">min</option><option value="60">horas</option><option value="1440">días</option></select></div>
    <div class="card" style="margin:12px 0;text-align:center"><div class="muted small">Duración: <b id="rDur" style="color:var(--ink)">${fmtDur(nuevo.min)}</b></div><div class="big" id="rPts">+${ptsReto(nuevo.min)}</div><div class="muted small">puntos al cumplirlo</div></div>
    <button class="btn primary block lg" data-act="crearReto">Empezar reto</button>`);
}
function refrescarPreview() { const d = $("#rDur"), p = $("#rPts"); if (d) d.textContent = fmtDur(nuevo.min); if (p) p.textContent = "+" + ptsReto(nuevo.min); }
ACT.rPreset = el => { nuevo.min = +el.dataset.m; nuevo.titulo = $("#rTit").value; $("#rNum").value = ""; document.querySelectorAll("[data-act=rPreset]").forEach(b => b.setAttribute("aria-pressed", b === el)); refrescarPreview(); };
ACT.crearReto = async () => {
  const titulo = $("#rTit").value.trim();
  if (!titulo) { toast("Escribe cuál es el reto."); return; }
  if (D.retos.filter(r => r.estado === "activo").length >= MAX_RETOS) { toast("Ya tienes 3 retos activos."); return; }
  const min = Math.round(Math.min(MAX_RETO, Math.max(MIN_RETO, nuevo.min)));
  const ahora = Date.now(); D.retoN = (D.retoN || 0) + 1;
  const r = {id: uid(), n: D.retoN, titulo, minutos: min, inicio: ahora, fin: ahora + min * 60000, pts: ptsReto(min), estado: "activo"};
  D.retos.push(r); guardarYa(); cerrarHoja(); render(); syncWidget();
  await notificacionesReto(r);
  toast(`Reto iniciado: ${fmtDur(min)} ⏱️`);
};
async function notificacionesReto(r) {
  if (!LN || !(await permisoNotif())) return;
  const lista = [{id: 10000 + (r.n % 40000), title: "¡Reto listo para cobrar!", body: `Se acabó el tiempo de “${r.titulo}”. Entra y cobra tus ${r.pts} puntos.`, schedule: {at: new Date(r.fin), allowWhileIdle: true}}];
  if (r.minutos >= 1440) lista.push({id: 60000 + (r.n % 40000), title: "Vas a la mitad 💪", body: `Llevas la mitad de “${r.titulo}”. No aflojes.`, schedule: {at: new Date(r.inicio + (r.fin - r.inicio) / 2), allowWhileIdle: true}});
  await programar(lista);
}
function cerrarReto(id, estado) {
  const r = D.retos.find(x => x.id === id); if (!r || r.estado !== "activo") return null;
  if (estado === "cumplido" && Date.now() < r.fin) { toast("Todavía no se acaba el tiempo."); return null; }
  r.estado = estado; r.cerrado = Date.now();
  cancelarIds([10000 + (r.n % 40000), 60000 + (r.n % 40000)]);
  return r;
}
ACT.cumplido = el => {
  const r = cerrarReto(el.dataset.id, "cumplido"); if (!r) return;
  otorgar("reto:" + r.id, r.pts, `Reto: ${r.titulo}`); guardarYa(); toast(`¡+${r.pts} puntos! 🎉`); render();
};
ACT.fallido = el => { if (!confirm("¿Marcarlo como no logrado? No ganas puntos, pero se libera el lugar.")) return; if (cerrarReto(el.dataset.id, "fallido")) { guardarYa(); syncWidget(); render(); } };
ACT.abandonar = el => { if (!confirm("¿Abandonar el reto? Pierdes los puntos de este reto.")) return; if (cerrarReto(el.dataset.id, "abandonado")) { guardarYa(); syncWidget(); render(); } };

// ---- Tienda ----
const SLOTS = [["cabeza", "Cabeza"], ["cara", "Cara"], ["mano", "En la mano"], ["cuerpo", "Cuerpo"], ["color", "Colores"], ["fondo", "Fondos"]];
function equipado(it) {
  const m = D.mascota;
  if (it.slot === "color") return m.color === it.valor;
  if (it.slot === "fondo") return m.fondo === it.valor;
  return m.equipo[it.slot] === it.id;
}
function probarEquipo(id) {
  const it = TIENDA.find(t => t.id === id); const m = D.mascota;
  if (it.slot === "color") return {color: it.valor};
  if (it.slot === "fondo") return {fondo: it.valor};
  return {equipo: {...m.equipo, [it.slot]: it.id}};
}
function bTienda(head) {
  const inv = D.mascota.inventario;
  view().innerHTML = head + SLOTS.map(([s, l]) => `<section class="card" style="padding:6px 14px"><h2 style="margin:8px 0 2px">${l}</h2>
    ${s === "color" ? `<div class="li"><div class="row"><span class="sw" style="background:${COLORES_MASCOTA.amarillo.cuerpo}"></span><span class="t">Amarillo (original)</span></div>${D.mascota.color === "amarillo" ? `<span class="pill">En uso</span>` : `<button class="btn" data-act="usarBase" data-k="color">Usar</button>`}</div>` : ""}
    ${s === "fondo" ? `<div class="li"><span class="t">Sin fondo</span>${D.mascota.fondo === "ninguno" ? `<span class="pill">En uso</span>` : `<button class="btn" data-act="usarBase" data-k="fondo">Usar</button>`}</div>` : ""}
    ${TIENDA.filter(t => t.slot === s).map(t => {
      const tiene = inv.includes(t.id), en = equipado(t);
      const sw = t.slot === "color" ? `<span class="sw" style="background:${COLORES_MASCOTA[t.valor].cuerpo}"></span>` : "";
      return `<div class="li"><div class="row" style="min-width:0">${sw}<div style="min-width:0"><div class="t">${esc(t.nombre)}</div><div class="d">${tiene ? (en ? "Lo traes puesto" : "Ya es tuyo") : `⭐ ${t.precio}`}</div></div></div>
        <div class="row">${!tiene ? `<button class="ghost" data-act="probar" data-id="${t.id}">Probar</button><button class="btn ${D.puntos.saldo >= t.precio ? "primary" : ""}" data-act="comprar" data-id="${t.id}" ${D.puntos.saldo >= t.precio ? "" : "disabled"}>Comprar</button>`
        : en && (t.slot !== "color" && t.slot !== "fondo") ? `<button class="btn" data-act="quitar" data-id="${t.id}">Quitar</button>`
        : en ? `<span class="pill">En uso</span>` : `<button class="btn" data-act="usar" data-id="${t.id}">Usar</button>`}</div></div>`;
    }).join("")}</section>`).join("");
}
ACT.probar = el => { probar = el.dataset.id; render(); scrollTo(0, 0); };
ACT.comprar = el => {
  const t = TIENDA.find(x => x.id === el.dataset.id); if (!t || D.mascota.inventario.includes(t.id)) return;
  if (D.puntos.saldo < t.precio) { toast(`Te faltan ${t.precio - D.puntos.saldo} puntos.`); return; }
  if (!confirm(`¿Comprar ${t.nombre} por ${t.precio} puntos?`)) return;
  D.puntos.saldo -= t.precio; D.puntos.log.unshift({t: Date.now(), txt: `Compra: ${t.nombre}`, pts: -t.precio});
  D.mascota.inventario.push(t.id); probar = null; usarItem(t); guardarYa(); revisarLogros(); syncWidget(); toast(`¡${t.nombre} es tuyo!`); keepScroll(() => {});
};
function usarItem(t) { const m = D.mascota; if (t.slot === "color") m.color = t.valor; else if (t.slot === "fondo") m.fondo = t.valor; else m.equipo[t.slot] = t.id; }
ACT.usar = el => { usarItem(TIENDA.find(x => x.id === el.dataset.id)); guardar(); syncWidget(); keepScroll(() => {}); };
ACT.quitar = el => { const t = TIENDA.find(x => x.id === el.dataset.id); D.mascota.equipo[t.slot] = null; guardar(); syncWidget(); keepScroll(() => {}); };
ACT.usarBase = el => { if (el.dataset.k === "color") D.mascota.color = "amarillo"; else D.mascota.fondo = "ninguno"; guardar(); syncWidget(); keepScroll(() => {}); };

// ---- Logros ----
function bLogros(head) {
  const s = estadisticas();
  view().innerHTML = head + `
    <section class="card"><div class="card-head"><h2>Medallas</h2><span class="muted small">${Object.keys(D.logros).length}/${LOGROS.length}</span></div>
      <div class="medallas">${LOGROS.map(l => `<div class="medalla ${D.logros[l.id] ? "on" : ""}"><div class="ico">${D.logros[l.id] ? "🏅" : "🔒"}</div><div class="t">${esc(l.nombre)}</div><div class="d">${esc(l.desc)}</div></div>`).join("")}</div></section>
    <section class="card"><h2 style="margin-bottom:6px">Cómo ganar puntos</h2>
      <div class="li"><span>Cumplir un reto</span><span class="d">10 (10 min) a ${ptsReto(MAX_RETO)} (2 semanas)</span></div>
      <div class="li"><span>Cada hábito del día</span><span class="d">+${PTS.habito}</span></div>
      <div class="li"><span>Meta de agua del día</span><span class="d">+${PTS.agua}</span></div>
      <div class="li"><span>Guardar un entrenamiento</span><span class="d">+${PTS.gym}</span></div>
      <div class="li"><span>Terminar un Pomodoro</span><span class="d">+${PTS.pomo}</span></div>
      <div class="li"><span>Desbloquear una medalla</span><span class="d">+${PTS.logro}</span></div></section>
    <section class="card"><div class="card-head"><h2>Historial de puntos</h2><span class="muted small">${s.retos} retos cumplidos</span></div>
      ${D.puntos.log.slice(0, 40).map(x => `<div class="li"><div style="min-width:0"><div class="t">${esc(x.txt)}</div><div class="d">${new Date(x.t).toLocaleString("es-MX", {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"})}</div></div><span style="font-weight:600;color:${x.pts >= 0 ? "var(--ok)" : "var(--danger)"}">${x.pts >= 0 ? "+" : ""}${x.pts}</span></div>`).join("") || `<p class="muted small">Aún no ganas puntos. Marca un hábito o empieza un reto.</p>`}</section>`;
}

// ================= Recordatorio de hábitos (21:00 si faltan) =================
async function programarHabitos() {
  if (!LN) return; await cancelarIds([500]);
  const pend = habitosPendientes(); const at = new Date(); at.setHours(21, 0, 0, 0);
  if (!pend || Date.now() >= at.getTime()) return;
  const p = await LN.checkPermissions().catch(() => ({})); if (p.display !== "granted") return;
  programar([{id: 500, title: `${D.mascota.nombre} te recuerda tus hábitos`, body: `Te falta${pend > 1 ? "n" : ""} ${pend} hábito${pend > 1 ? "s" : ""} hoy (+${PTS.habito} c/u).`, schedule: {at, allowWhileIdle: true}}]);
}

// ================= Widget de Android =================
function svgAPng(svg, size = 256) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement("canvas"); c.width = c.height = size; c.getContext("2d").drawImage(img, 0, 0, size, size); res(c.toDataURL("image/png").split(",")[1]); };
    img.onerror = rej;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}
// Mensajes programados para que el widget cambie aunque no abras la app
function agendaWidget() {
  const ahora = Date.now(); const lista = [{t: ahora, msg: mensajeMascota()}];
  const base = new Date(); base.setMinutes(0, 0, 0);
  const metaOk = (D.agua[hoy()] || 0) >= D.ajustes.aguaMeta;
  for (let i = 1; i <= 30; i++) {
    const d = new Date(base.getTime() + i * 3600000); const h = d.getHours(); const mismoDia = keyFecha(d) === hoy();
    if (h === 0) lista.push({t: d.getTime(), msg: "Nuevo día, nuevos puntos 💪 Abre la app para ver qué toca."});
    else if (mismoDia && !metaOk && h >= 10 && h <= 21 && h % 2 === 0) lista.push({t: d.getTime(), msg: "¿Ya tomaste agua? Un vaso y sigues 💧"});
    else if (mismoDia && h === 19 && habitosPendientes()) lista.push({t: d.getTime(), msg: "No olvides tus hábitos de hoy, son puntos fáciles."});
    else if (!mismoDia && h >= 9 && h <= 21 && h % 3 === 0) lista.push({t: d.getTime(), msg: "¿Agua, hábitos, retos? Pásate a verme."});
  }
  D.retos.filter(r => r.estado === "activo" && r.fin > ahora).forEach(r => lista.push({t: r.fin, msg: `¡Tu reto “${r.titulo}” ya está listo para cobrar! (+${r.pts})`, prio: 1}));
  return lista.sort((a, b) => a.t - b.t);
}
let _tw;
function syncWidget() {
  if (!PW) return; clearTimeout(_tw);
  _tw = setTimeout(async () => {
    try {
      const image = await svgAPng(petSVG({fondo: D.mascota.fondo}));
      await PW.update({image, nombre: D.mascota.nombre, info: `Nv ${nivel(D.puntos.xp)} · ⭐ ${D.puntos.saldo}`, agenda: JSON.stringify(agendaWidget())});
    } catch (e) { console.warn("widget", e); }
  }, 1200);
}

// ================= Arranque =================
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { syncWidget(); programarHabitos(); } });
window.addEventListener("DOMContentLoaded", () => { revisarLogros(); syncWidget(); programarHabitos(); });
