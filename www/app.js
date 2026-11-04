/* Modo Bestia — gym, nutrición y enfoque. Todo se guarda en el teléfono. */
"use strict";

// ================= Capacitor (solo existe dentro del APK) =================
const CapX = window.capacitorExports;
const isNative = !!(CapX && CapX.Capacitor && CapX.Capacitor.isNativePlatform());
const plug = n => isNative ? CapX.registerPlugin(n) : null;
const LN = plug("LocalNotifications");
const FS = plug("Filesystem");
const SH = plug("Share");
const ST = plug("ScreenTime");

// ================= Utilidades =================
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const num = v => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : 0; };
const r1 = n => Math.round(n * 10) / 10;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const keyFecha = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const hoy = () => keyFecha(new Date());
const sumarDias = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return keyFecha(new Date(y, m - 1, d + n)); };
const fmtFecha = (iso, largo) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString("es-MX", largo ? {weekday:"long", day:"numeric", month:"long"} : {weekday:"short", day:"numeric", month:"short"}); };
const rm = (p, r) => r > 0 && p > 0 ? p * (1 + r / 30) : 0;
const pct = (a, b) => b > 0 ? Math.min(100, Math.round(a / b * 100)) : 0;
const fmtMin = m => m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("on"), 2400); }

// ================= Datos =================
const DEFAULTS = {
  sesiones: [], borrador: null, rutina: null, rutinaMod: 0, rutinaPrev: null, coach: {msgs: []},
  agua: {}, comida: {}, misAlimentos: [],
  tareas: [], habitos: [
    {id: "h1", nombre: "Creatina"}, {id: "h2", nombre: "Dormir 7–9 h"}, {id: "h3", nombre: "Primeros 30 min sin redes"}],
  habLog: {}, enfoqueLog: {},
  pomo: {modo: 25, fase: "enfoque", fin: null, resta: null},
  retos: [], retoN: 0, puntos: {saldo: 0, xp: 0, log: []}, otorgados: {}, logros: {}, rachaRecord: 0,
  mascota: {nombre: "Bestia", especie: "monstruo", color: "original", fondo: "ninguno", equipo: {cabeza: null, cara: null, mano: null, cuerpo: null}, inventario: []},
  ajustes: {
    peso: "", metas: {kcal: 2800, p: 150, c: 340, g: 80},
    aguaMeta: 3000, vaso: 250,
    aguaRec: {on: false, desde: 8, hasta: 22, cada: 2},
    gymRec: {on: false, hora: "18:00", dias: [1, 2, 4, 5]},
    pantalla: {on: false, apps: [{pkg: "com.instagram.android", label: "Instagram", limit: 30}]},
    tema: "auto",
    mascota: {notif: false, flotante: false, cada: 60}
  }
};
function cargar() {
  let d = {};
  try { d = JSON.parse(localStorage.getItem("mb_data") || "{}"); } catch (e) {}
  // Migración: entrenamientos guardados por la bitácora anterior en este mismo dispositivo
  try { const viejas = JSON.parse(localStorage.getItem("gym_sesiones_local") || "[]"); if (viejas.length && !d.sesiones) d.sesiones = viejas; } catch (e) {}
  return mezclar(structuredClone(DEFAULTS), d);
}
function mezclar(base, extra) {
  for (const k in extra) {
    if (extra[k] && typeof extra[k] === "object" && !Array.isArray(extra[k]) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) mezclar(base[k], extra[k]);
    else base[k] = extra[k];
  }
  return base;
}
let D = cargar();
function asegurarRutina() { if (!D.rutina || !Object.keys(D.rutina).length) D.rutina = structuredClone(RUTINA_BASE); if (!D.rutina.libre) D.rutina.libre = {nombre: "Libre", ej: []}; }
asegurarRutina();
Object.defineProperty(window, "RUTINA", {get: () => D.rutina});
let _ts;
function guardar() { clearTimeout(_ts); _ts = setTimeout(() => { try { localStorage.setItem("mb_data", JSON.stringify(D)); } catch (e) { toast("No se pudo guardar: memoria llena"); } }, 250); }
function guardarYa() { clearTimeout(_ts); try { localStorage.setItem("mb_data", JSON.stringify(D)); } catch (e) {} }
window.addEventListener("pagehide", guardarYa);

function aplicarTema() {
  const t = D.ajustes.tema;
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

// ================= Navegación =================
let tab = "hoy";
const sub = {gym: "entrenar", comida: "diario"};
let fechaComida = hoy();

function irA(t) {
  tab = t;
  document.querySelectorAll("nav.tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
  render(); window.scrollTo(0, 0);
}
document.querySelectorAll("nav.tabs button").forEach(b => b.onclick = () => irA(b.dataset.tab));

function render() {
  stopPomoTick(); clearInterval(retoInt);
  ({hoy: vHoy, gym: vGym, comida: vComida, enfoque: vEnfoque, bestia: vBestia, ajustes: vAjustes})[tab]();
}
const view = () => $("#view");

// Hoja inferior (modal). El botón atrás de Android la cierra.
let sheetOpen = false;
function abrirHoja(html) {
  $("#sheet").innerHTML = html; $("#sheet").classList.add("on"); $("#sheetBg").classList.add("on");
  $("#sheet").scrollTop = 0;
  if (!sheetOpen) { sheetOpen = true; history.pushState({hoja: 1}, ""); }
}
function cerrarHoja(fromPop) {
  if (!sheetOpen) return;
  sheetOpen = false; $("#sheet").classList.remove("on"); $("#sheetBg").classList.remove("on"); $("#sheet").innerHTML = "";
  if (!fromPop) history.back();
}
window.addEventListener("popstate", () => { if (sheetOpen) cerrarHoja(true); });
$("#sheetBg").onclick = () => cerrarHoja();

// Acciones por data-act (en la vista y en la hoja)
const ACT = {};
function onAct(e) {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const fn = ACT[el.dataset.act]; if (fn) fn(el, e);
}
$("#view").addEventListener("click", onAct);
$("#sheet").addEventListener("click", onAct);

// ================= HOY =================
function totalesComida(fecha) {
  const t = {kcal: 0, p: 0, c: 0, g: 0};
  (D.comida[fecha] || []).forEach(x => { t.kcal += x.kcal; t.p += x.p; t.c += x.c; t.g += x.g; });
  return t;
}
function barrasMacros(t) {
  const m = D.ajustes.metas;
  const fila = (lbl, v, meta, col, u) => `<div class="macro"><span>${lbl}</span><div class="bar"><i style="width:${pct(v, meta)}%;background:${col}"></i></div><span class="v">${Math.round(v)} / ${meta}${u}</span></div>`;
  return fila("Calorías", t.kcal, m.kcal, "var(--plate)", "") + fila("Proteína", t.p, m.p, "var(--p)", " g") + fila("Carbos", t.c, m.c, "var(--c)", " g") + fila("Grasa", t.g, m.g, "var(--g)", " g");
}
function sugerirDia() {
  const orden = Object.keys(RUTINA).filter(k => k !== "libre" && !RUTINA[k].opcional && RUTINA[k].ej.length);
  if (!orden.length) return "libre";
  const ult = D.sesiones.find(s => orden.includes(s.dia));
  return ult ? orden[(orden.indexOf(ult.dia) + 1) % orden.length] : orden[0];
}
function entrenosSemana() {
  const d = new Date(); const lunes = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  const desde = keyFecha(lunes);
  return D.sesiones.filter(s => s.fecha >= desde).length;
}

function vHoy() {
  const f = hoy();
  const agua = D.agua[f] || 0, metaA = D.ajustes.aguaMeta;
  const t = totalesComida(f);
  const entrenoHoy = D.sesiones.find(s => s.fecha === f);
  const tip = CONSEJOS[Math.floor(Date.now() / 86400000) % CONSEJOS.length];
  const hechos = D.habLog[f] || [];
  const pend = D.tareas.filter(x => !x.hecha).length;
  const focoHoy = D.enfoqueLog[f] || 0;

  view().innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:flex-start"><h1>${esc(cap(fmtFecha(f, true)))}</h1><button class="iconbtn" style="font-size:1.5rem" aria-label="Ajustes" data-act="ir" data-to="ajustes">⚙</button></div>
    <p class="sub">${entrenosSemana()} de 4 entrenamientos esta semana</p>
    ${petCard()}

    <section class="card">
      <div class="card-head"><h2>Agua</h2><span class="muted small">${pct(agua, metaA)}%</span></div>
      <div class="big">${(agua / 1000).toFixed(2)} <small>/ ${(metaA / 1000).toFixed(1)} L</small></div>
      <div class="bar" style="margin:10px 0 12px"><i style="width:${pct(agua, metaA)}%;background:var(--water)"></i></div>
      <div class="row"><button class="btn water grow" data-act="agua" data-ml="${D.ajustes.vaso}">+ Vaso (${D.ajustes.vaso} ml)</button><button class="btn" data-act="agua" data-ml="-${D.ajustes.vaso}" aria-label="Quitar un vaso">−</button></div>
    </section>

    <section class="card">
      <div class="card-head"><h2>Gym</h2><span class="muted small">${entrenoHoy ? "Hecho hoy ✓" : ""}</span></div>
      ${entrenoHoy
        ? `<p style="margin:0">${esc((RUTINA[entrenoHoy.dia] || {nombre: "Entrenamiento"}).nombre)}: ${entrenoHoy.ejercicios.length} ejercicios, ${entrenoHoy.ejercicios.reduce((a, e) => a + e.series.length, 0)} series.</p>`
        : `<p style="margin:0 0 10px">Te toca <b>${esc((RUTINA[(D.borrador && D.borrador.dia)] || RUTINA[sugerirDia()]).nombre)}</b>${D.borrador && D.borrador.ejercicios.some(e => e.series.some(s => s.reps)) ? " (lo dejaste a medias)" : ""}.</p>
           <button class="btn primary block" data-act="ir" data-to="gym">Ir a entrenar</button>`}
    </section>

    <section class="card">
      <div class="card-head"><h2>Comida</h2><span class="muted small">${Math.round(t.kcal)} kcal</span></div>
      ${barrasMacros(t)}
      <button class="btn block" style="margin-top:8px" data-act="ir" data-to="comida">Registrar comida</button>
    </section>

    ${isNative && D.ajustes.pantalla.on && stState.granted ? `
    <section class="card">
      <div class="card-head"><h2>Pantalla</h2><span class="muted small">${fmtMin(stState.total)} hoy</span></div>
      ${D.ajustes.pantalla.apps.map(a => { const u = (stState.apps.find(x => x.pkg === a.pkg) || {minutes: 0}).minutes; return `<div class="macro"><span>${esc(a.label)}</span><div class="bar"><i style="width:${pct(u, a.limit)}%;background:${u >= a.limit ? "var(--danger)" : "var(--ok)"}"></i></div><span class="v">${u} / ${a.limit} min</span></div>`; }).join("")}
    </section>` : ""}

    <section class="card">
      <div class="card-head"><h2>Hábitos</h2><span class="muted small">${hechos.length}/${D.habitos.length}</span></div>
      ${D.habitos.length ? D.habitos.map(h => habitoFila(h, f)).join("") : `<p class="muted small">Agrega hábitos en Enfoque.</p>`}
    </section>

    <section class="card">
      <div class="card-head"><h2>Enfoque</h2><span class="muted small">${focoHoy} min hoy</span></div>
      <p style="margin:0 0 10px">${pend ? `${pend} tarea${pend > 1 ? "s" : ""} pendiente${pend > 1 ? "s" : ""}.` : "Sin tareas pendientes."}</p>
      <button class="btn block" data-act="ir" data-to="enfoque">Abrir enfoque</button>
    </section>

    <section class="card"><h2 style="margin-bottom:6px">Consejo del día</h2><p style="margin:0">${esc(tip)}</p></section>`;
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

ACT.ir = el => irA(el.dataset.to);
ACT.agua = el => {
  const f = hoy(); D.agua[f] = Math.max(0, (D.agua[f] || 0) + num(el.dataset.ml)); guardar();
  if (D.agua[f] >= D.ajustes.aguaMeta) { if (otorgar("agua:" + f, PTS.agua, "Meta de agua")) toast(`¡Meta de agua cumplida! +${PTS.agua} 💧`); }
  else revocar("agua:" + f, "Quitaste agua");
  syncWidget(); render();
};

// ================= HÁBITOS =================
function racha(id) {
  let d = hoy(), n = 0;
  if (!(D.habLog[d] || []).includes(id)) d = sumarDias(d, -1);
  while ((D.habLog[d] || []).includes(id)) { n++; d = sumarDias(d, -1); }
  return n;
}
function habitoFila(h, f) {
  const on = (D.habLog[f] || []).includes(h.id); const r = racha(h.id);
  return `<div class="habit"><button class="tick" aria-pressed="${on}" aria-label="Marcar ${esc(h.nombre)}" data-act="habito" data-id="${h.id}">✓</button><span class="grow" style="flex:1">${esc(h.nombre)}</span><span class="muted small">${r ? `🔥 ${r}` : ""}</span></div>`;
}
ACT.habito = el => {
  const f = hoy(); const arr = D.habLog[f] || (D.habLog[f] = []);
  const id = el.dataset.id, h = D.habitos.find(x => x.id === id);
  const i = arr.indexOf(id);
  if (i >= 0) { arr.splice(i, 1); revocar(`hab:${f}:${id}`, `Desmarcaste: ${h ? h.nombre : "hábito"}`); }
  else { arr.push(id); otorgar(`hab:${f}:${id}`, PTS.habito, `Hábito: ${h ? h.nombre : ""}`); toast(`+${PTS.habito} puntos`); }
  guardar(); programarHabitos(); syncWidget(); const y = scrollY; render(); scrollTo(0, y);
};

// ================= GYM =================
function ultimaVez(nombre, excluir) {
  for (const s of D.sesiones) {
    if (s.id === excluir) continue;
    const e = (s.ejercicios || []).find(x => x.nombre === nombre);
    if (e && e.series.length) return {fecha: s.fecha, series: e.series};
  }
  return null;
}
function nuevoBorrador(dia) {
  D.borrador = {id: "s" + Date.now(), dia, fecha: hoy(), nota: "", ejercicios: RUTINA[dia].ej.map(([nombre, series, reps, desc]) => {
    const prev = ultimaVez(nombre);
    return {nombre, meta: `${series} × ${reps}`, desc, series: Array.from({length: series}, (_, i) => {
      const ps = prev && prev.series[Math.min(i, prev.series.length - 1)];
      return {peso: ps ? String(ps.peso || "") : "", reps: "", hecho: false};
    })};
  })};
  guardar();
}
function ordenarSesiones() { D.sesiones.sort((a, b) => (b.fecha + b.id).localeCompare(a.fecha + a.id)); }
function todosEjercicios() {
  const s = new Set(); Object.values(RUTINA).forEach(d => d.ej.forEach(e => s.add(e[0])));
  D.sesiones.forEach(x => x.ejercicios.forEach(e => s.add(e.nombre)));
  return [...s].sort((a, b) => a.localeCompare(b, "es"));
}

function vGym() {
  const tabs = [["entrenar", "Entrenar"], ["rutina", "Rutina"], ["coach", "Coach IA"], ["historial", "Historial"], ["progreso", "Progreso"]];
  const head = `<div class="row" style="justify-content:space-between"><h1>Gym</h1><button class="btn" data-act="calc">lb ⇄ kg</button></div><div class="seg" role="group">${tabs.map(([k, l]) => `<button class="chip" aria-pressed="${sub.gym === k}" data-act="subgym" data-k="${k}">${l}</button>`).join("")}</div>`;
  if (sub.gym === "entrenar") gymEntrenar(head + playerCard());
  else if (sub.gym === "rutina") gymRutina(head);
  else if (sub.gym === "coach") gymCoach(head);
  else if (sub.gym === "historial") gymHistorial(head);
  else gymProgreso(head);
}
ACT.subgym = el => { sub.gym = el.dataset.k; render(); };

let progEj = null;
function gymEntrenar(head) {
  if (!D.borrador || !RUTINA[D.borrador.dia]) nuevoBorrador(sugerirDia());
  const b = D.borrador;
  const dias = Object.entries(RUTINA).map(([k, d]) => `<button class="chip" aria-pressed="${k === b.dia}" data-act="dia" data-dia="${k}">${esc(d.nombre)}</button>`).join("");
  const ejs = b.ejercicios.map((e, ei) => {
    const prev = ultimaVez(e.nombre, b.id);
    const done = e.series.length && e.series.every(s => s.hecho);
    return `<section class="ex ${done ? "done" : ""}">
      <div class="row" style="align-items:flex-start"><div class="grow"><h2>${esc(e.nombre)}</h2><div class="muted small">${e.meta ? esc(e.meta) + " · " : ""}descanso ${r1((e.desc || 90) / 60)} min</div></div>
      <button class="iconbtn" aria-label="Quitar ejercicio" data-act="delex" data-ei="${ei}">✕</button></div>
      <div class="last">${prev ? `La vez pasada (${esc(fmtFecha(prev.fecha))}): <b>${prev.series.map(s => `${r1(num(s.peso))}×${s.reps}`).join(" · ")}</b>` : "Primera vez registrando este ejercicio."}</div>
      <div class="sets"><div class="h">#</div><div class="h">Peso (kg)</div><div class="h">Reps</div><div class="h">Hecha</div>
      ${e.series.map((s, si) => `<div class="n">${si + 1}</div>
        <input type="text" inputmode="decimal" placeholder="kg" aria-label="Peso serie ${si + 1}" value="${esc(s.peso)}" data-in="set" data-ei="${ei}" data-si="${si}" data-f="peso">
        <input type="text" inputmode="numeric" placeholder="reps" aria-label="Reps serie ${si + 1}" value="${esc(s.reps)}" data-in="set" data-ei="${ei}" data-si="${si}" data-f="reps">
        <button class="chk" aria-pressed="${s.hecho}" aria-label="Serie ${si + 1} hecha" data-act="chk" data-ei="${ei}" data-si="${si}">✓</button>`).join("")}</div>
      <div class="row" style="margin-top:10px"><button class="ghost" data-act="addset" data-ei="${ei}">+ Serie</button>${e.series.length > 1 ? `<button class="ghost" data-act="rmset" data-ei="${ei}">− Serie</button>` : ""}</div>
    </section>`;
  }).join("");
  view().innerHTML = head + `
    <div class="seg" role="group" aria-label="Día">${dias}</div>
    <div class="row" style="margin:0 2px 12px"><label class="muted small" for="gfecha">Fecha</label><input type="date" id="gfecha" style="max-width:180px" value="${esc(b.fecha)}" data-in="gfecha"></div>
    ${ejs || `<div class="card empty"><b>Entrenamiento libre</b>Agrega los ejercicios que vayas haciendo.</div>`}
    <div class="row" style="margin:6px 0 12px"><input class="grow" id="nuevoEj" list="ejList" placeholder="Agregar ejercicio" aria-label="Nombre del ejercicio"><button class="btn" data-act="addex">Agregar</button></div>
    <datalist id="ejList">${todosEjercicios().map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    <textarea id="gnota" rows="2" placeholder="Notas (cómo te sentiste, molestias…)" data-in="gnota" style="margin-bottom:12px">${esc(b.nota)}</textarea>
    <button class="btn primary block lg" data-act="guardarEntreno">Guardar entrenamiento</button>`;
}
const keepScroll = fn => { const y = scrollY; fn(); render(); scrollTo(0, y); };
ACT.dia = el => {
  const b = D.borrador; if (el.dataset.dia === b.dia) return;
  if (b.ejercicios.some(x => x.series.some(s => s.reps)) && !confirm("Cambiar de día borra lo que llevas sin guardar. ¿Continuar?")) return;
  nuevoBorrador(el.dataset.dia); render();
};
ACT.chk = el => keepScroll(() => {
  const ex = D.borrador.ejercicios[+el.dataset.ei]; const si = +el.dataset.si; const s = ex.series[si];
  s.hecho = !s.hecho;
  const sig = ex.series[si + 1]; if (s.hecho && sig && !sig.peso && s.peso) sig.peso = s.peso;
  if (s.hecho) iniciarDescanso(ex.desc || 90);
  guardar();
});
ACT.addset = el => keepScroll(() => { const ex = D.borrador.ejercicios[+el.dataset.ei]; const u = ex.series[ex.series.length - 1]; ex.series.push({peso: u ? u.peso : "", reps: "", hecho: false}); guardar(); });
ACT.rmset = el => keepScroll(() => { D.borrador.ejercicios[+el.dataset.ei].series.pop(); guardar(); });
ACT.delex = el => { const ei = +el.dataset.ei; if (!confirm(`¿Quitar "${D.borrador.ejercicios[ei].nombre}" de hoy?`)) return; keepScroll(() => { D.borrador.ejercicios.splice(ei, 1); guardar(); }); };
ACT.addex = () => {
  const nombre = $("#nuevoEj").value.trim(); if (!nombre) return;
  const prev = ultimaVez(nombre); const n = prev ? prev.series.length : 3;
  D.borrador.ejercicios.push({nombre, meta: "", desc: 90, series: Array.from({length: n}, (_, i) => ({peso: prev ? String(prev.series[i].peso || "") : "", reps: "", hecho: false}))});
  guardar(); render(); const xs = document.querySelectorAll(".ex"); xs[xs.length - 1]?.scrollIntoView({block: "center"});
};
ACT.guardarEntreno = () => {
  const b = D.borrador;
  const ejercicios = b.ejercicios.map(x => ({nombre: x.nombre, series: x.series.filter(s => num(s.reps) > 0).map(s => ({peso: num(s.peso), reps: num(s.reps)}))})).filter(x => x.series.length);
  if (!ejercicios.length) { toast("Anota al menos una serie con reps para guardar."); return; }
  D.sesiones = D.sesiones.filter(s => s.id !== b.id);
  D.sesiones.push({id: b.id, fecha: b.fecha, dia: b.dia, ejercicios, nota: b.nota || "", mod: Date.now()});
  ordenarSesiones(); D.borrador = null; guardarYa(); pararDescanso();
  const nuevoPts = otorgar("gym:" + b.id, PTS.gym, `Entrenamiento: ${(RUTINA[b.dia] || {nombre: ""}).nombre}`);
  toast(nuevoPts ? `Entrenamiento guardado 💪 +${PTS.gym}` : "Entrenamiento guardado 💪"); sub.gym = "historial"; render(); scrollTo(0, 0);
};

function gymHistorial(head) {
  if (!D.sesiones.length) { view().innerHTML = head + `<div class="card empty"><b>Aún no hay entrenamientos</b>Cuando guardes el primero, aparece aquí.</div>`; return; }
  view().innerHTML = head + D.sesiones.map(s => {
    const vol = s.ejercicios.reduce((a, e) => a + e.series.reduce((b, x) => b + x.peso * x.reps, 0), 0);
    return `<details class="sess"><summary><div><h2>${esc((RUTINA[s.dia] || {nombre: "Entrenamiento"}).nombre)}</h2><div class="muted small">${esc(fmtFecha(s.fecha))}</div></div>
      <div class="muted small" style="text-align:right">${s.ejercicios.reduce((a, e) => a + e.series.length, 0)} series<br>${Math.round(vol).toLocaleString("es-MX")} kg</div></summary>
      <div class="body">${s.ejercicios.map(e => `<div class="li"><span>${esc(e.nombre)}</span><span class="d" style="text-align:right">${e.series.map(x => `${r1(x.peso)}×${x.reps}`).join(" · ")}</span></div>`).join("")}
      ${s.nota ? `<p class="muted small">${esc(s.nota)}</p>` : ""}
      <div class="row" style="margin-top:8px"><button class="ghost" data-act="editarSes" data-id="${s.id}">Editar</button><button class="ghost danger" data-act="borrarSes" data-id="${s.id}">Borrar</button></div></div></details>`;
  }).join("");
}
ACT.borrarSes = el => { if (!confirm("¿Borrar este entrenamiento? No se puede deshacer.")) return; D.sesiones = D.sesiones.filter(s => s.id !== el.dataset.id); guardar(); render(); toast("Entrenamiento borrado"); };
ACT.editarSes = el => {
  const s = D.sesiones.find(x => x.id === el.dataset.id); if (!s) return;
  if (D.borrador && D.borrador.ejercicios.some(x => x.series.some(y => y.reps)) && !confirm("Tienes un entrenamiento sin guardar. ¿Reemplazarlo por este para editarlo?")) return;
  D.borrador = {id: s.id, dia: s.dia, fecha: s.fecha, nota: s.nota || "", ejercicios: s.ejercicios.map(e => {
    const r = (RUTINA[s.dia] || {ej: []}).ej.find(x => x[0] === e.nombre);
    return {nombre: e.nombre, meta: r ? `${r[1]} × ${r[2]}` : "", desc: r ? r[3] : 90, series: e.series.map(x => ({peso: String(x.peso), reps: String(x.reps), hecho: true}))};
  })};
  guardar(); sub.gym = "entrenar"; render(); scrollTo(0, 0);
};

function gymProgreso(head) {
  const lista = [...new Set(D.sesiones.flatMap(s => s.ejercicios.map(e => e.nombre)))].sort((a, b) => a.localeCompare(b, "es"));
  if (!lista.length) { view().innerHTML = head + `<div class="card empty"><b>Sin datos todavía</b>Registra unos entrenamientos y aquí verás cómo suben tus pesos.</div>`; return; }
  if (!progEj || !lista.includes(progEj)) progEj = lista[0];
  const pts = D.sesiones.slice().reverse().map(s => {
    const e = s.ejercicios.find(x => x.nombre === progEj); if (!e) return null;
    let max = 0, mejor = 0, ms = null;
    e.series.forEach(x => { if (x.peso > max) max = x.peso; const v = rm(x.peso, x.reps); if (v > mejor) { mejor = v; ms = x; } });
    return {fecha: s.fecha, max, est: mejor, ms};
  }).filter(Boolean);
  const a = pts[0].est, z = pts[pts.length - 1].est; const cambio = a > 0 ? Math.round((z - a) / a * 100) : 0;
  view().innerHTML = head + `
    <select data-in="progEj" aria-label="Ejercicio" style="margin-bottom:12px">${lista.map(n => `<option ${n === progEj ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
    <div class="stats">
      <div class="stat"><div class="v">${r1(Math.max(...pts.map(p => p.max)))}</div><div class="l">Peso máximo (kg)</div></div>
      <div class="stat"><div class="v">${r1(Math.max(...pts.map(p => p.est)))}</div><div class="l">1RM estimado (kg)</div></div>
      <div class="stat"><div class="v">${cambio > 0 ? "+" : ""}${cambio}%</div><div class="l">Desde el inicio</div></div>
    </div>
    <div class="card">${grafica(pts.map(p => ({x: p.fecha, y: p.est})), "1RM estimado")}</div>
    <div class="card">${pts.slice().reverse().slice(0, 15).map(p => `<div class="li"><span>${esc(fmtFecha(p.fecha))}</span><span class="d">${p.ms ? `${r1(p.ms.peso)} kg × ${p.ms.reps}` : "—"}</span></div>`).join("")}</div>
    <p class="muted small">El 1RM estimado combina peso y reps de tu mejor serie: así ves si progresas aunque subas reps y no peso.</p>`;
}

function grafica(pts, etiqueta) {
  if (pts.length < 2) return `<p class="muted small" style="margin:0">Con dos o más registros aparece la gráfica.</p>`;
  const W = 600, H = 220, pl = 40, pr = 12, pt = 14, pb = 28;
  let mn = Math.min(...pts.map(p => p.y)), mx = Math.max(...pts.map(p => p.y));
  if (mx === mn) { mx += 5; mn = Math.max(0, mn - 5); }
  const pad = (mx - mn) * .12; mn = Math.max(0, mn - pad); mx += pad;
  const x = i => pl + (W - pl - pr) * (i / (pts.length - 1)), y = v => pt + (H - pt - pb) * (1 - (v - mn) / (mx - mn));
  const ticks = [mn, (mn + mx) / 2, mx];
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(etiqueta)}">
    ${ticks.map(t => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${pl - 6}" y="${y(t) + 4}" text-anchor="end" font-size="12" fill="var(--muted)">${Math.round(t)}</text>`).join("")}
    <path d="${pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--plate)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
    ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.y)}" r="5" fill="var(--surface)" stroke="var(--ink)" stroke-width="2"/>`).join("")}
    <text x="${pl}" y="${H - 6}" font-size="12" fill="var(--muted)">${esc(fmtFecha(pts[0].x))}</text>
    <text x="${W - pr}" y="${H - 6}" text-anchor="end" font-size="12" fill="var(--muted)">${esc(fmtFecha(pts[pts.length - 1].x))}</text></svg>`;
}

// Descanso entre series (con notificación por si bloqueas el cel)
let descFin = 0, descInt = null;
function iniciarDescanso(seg) {
  descFin = Date.now() + seg * 1000; $("#rest").classList.add("on"); tickDesc();
  clearInterval(descInt); descInt = setInterval(tickDesc, 500);
  programarUna(301, "Descanso terminado", "¡A la siguiente serie! 💪", descFin);
}
function tickDesc() {
  const s = Math.max(0, Math.ceil((descFin - Date.now()) / 1000));
  $("#restTime").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  if (s <= 0) { pararDescanso(true); toast("¡A la siguiente serie!"); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {} }
}
function pararDescanso(fin) { clearInterval(descInt); $("#rest").classList.remove("on"); if (!fin) cancelarIds([301]); }
$("#restPlus").onclick = () => { descFin += 30000; tickDesc(); programarUna(301, "Descanso terminado", "¡A la siguiente serie! 💪", descFin); };
$("#restStop").onclick = () => pararDescanso();

// ================= COMIDA =================
const COMIDAS = [["desayuno", "Desayuno"], ["comida", "Comida"], ["cena", "Cena"], ["snack", "Snacks"]];
function vComida() {
  const tabs = [["diario", "Diario"], ["recetas", "Recetas"], ["consejos", "Consejos"]];
  const head = `<h1>Comida</h1><div class="seg" role="group">${tabs.map(([k, l]) => `<button class="chip" aria-pressed="${sub.comida === k}" data-act="subcom" data-k="${k}">${l}</button>`).join("")}</div>`;
  if (sub.comida === "diario") comidaDiario(head);
  else if (sub.comida === "recetas") comidaRecetas(head);
  else view().innerHTML = head + `<section class="card">${CONSEJOS.map(c => `<div class="li"><span>${esc(c)}</span></div>`).join("")}</section>`;
}
ACT.subcom = el => { sub.comida = el.dataset.k; render(); };
const macTxt = x => `<span class="mac">${Math.round(x.kcal)} kcal · <span class="P">P ${r1(x.p)}</span> · <span class="C">C ${r1(x.c)}</span> · <span class="G">G ${r1(x.g)}</span></span>`;

function comidaDiario(head) {
  const f = fechaComida; const items = D.comida[f] || []; const t = totalesComida(f);
  const restP = Math.max(0, D.ajustes.metas.p - t.p);
  view().innerHTML = head + `
    <div class="row" style="justify-content:space-between;margin-bottom:10px">
      <button class="btn" data-act="diaCom" data-n="-1" aria-label="Día anterior">‹</button>
      <h2>${f === hoy() ? "Hoy" : esc(cap(fmtFecha(f)))}</h2>
      <button class="btn" data-act="diaCom" data-n="1" aria-label="Día siguiente" ${f >= hoy() ? "disabled" : ""}>›</button>
    </div>
    <section class="card">${barrasMacros(t)}
      ${restP > 0 && f === hoy() ? `<p class="muted small" style="margin:8px 0 0">Te faltan ${Math.round(restP)} g de proteína para tu meta.</p>` : ""}</section>
    ${COMIDAS.map(([k, l]) => {
      const xs = items.filter(i => i.meal === k); const st = xs.reduce((a, x) => ({kcal: a.kcal + x.kcal, p: a.p + x.p, c: a.c + x.c, g: a.g + x.g}), {kcal: 0, p: 0, c: 0, g: 0});
      return `<section class="card"><div class="card-head" style="margin-bottom:4px"><h2>${l}</h2><span class="mac">${Math.round(st.kcal)} kcal</span></div>
        ${xs.map(x => `<div class="li"><div style="min-width:0"><div class="t">${esc(x.nombre)}</div><div>${x.gramos ? `<span class="pill">${Math.round(x.gramos)} g</span> ` : ""}${macTxt(x)}</div></div><button class="iconbtn" aria-label="Quitar" data-act="delCom" data-id="${x.id}">✕</button></div>`).join("")}
        <button class="ghost" style="margin-top:8px;width:100%" data-act="addCom" data-meal="${k}">+ Agregar a ${l.toLowerCase()}</button></section>`;
    }).join("")}`;
}
ACT.diaCom = el => { fechaComida = sumarDias(fechaComida, +el.dataset.n); if (fechaComida > hoy()) fechaComida = hoy(); render(); };
ACT.delCom = el => { const f = fechaComida; D.comida[f] = (D.comida[f] || []).filter(x => x.id !== el.dataset.id); guardar(); keepScroll(() => {}); };

// ---- Hoja para agregar alimento ----
let addCtx = {meal: "comida", modo: "buscar", q: "", online: [], cargando: false, error: "", sel: null};
ACT.addCom = el => { addCtx = {meal: el.dataset.meal, modo: "buscar", q: "", online: [], cargando: false, error: "", sel: null}; hojaAlimento(); };
function locales(q) {
  const n = norm(q);
  const mios = D.misAlimentos.map(a => ({...a, mio: true}));
  const base = ALIMENTOS.filter(a => !D.misAlimentos.some(m => m.nombre === a.nombre));
  const todo = [...mios, ...base];
  return n ? todo.filter(a => norm(a.nombre).includes(n)) : mios.slice(0, 12).concat(base.slice(0, mios.length ? 6 : 14));
}
function hojaAlimento() {
  const meal = COMIDAS.find(c => c[0] === addCtx.meal)[1];
  if (addCtx.sel) return hojaPorcion(meal);
  const tabs = `<div class="seg"><button class="chip" aria-pressed="${addCtx.modo === "buscar"}" data-act="modoCom" data-k="buscar">Buscar</button><button class="chip" aria-pressed="${addCtx.modo === "manual"}" data-act="modoCom" data-k="manual">Manual</button></div>`;
  if (addCtx.modo === "manual") {
    abrirHoja(`<h2 style="margin-bottom:10px">Agregar a ${meal}</h2>${tabs}
      <label class="f" for="mNom">Nombre</label><input id="mNom" placeholder="Ej. Torta de pollo">
      <div class="grid4"><div><label class="f" for="mK">kcal</label><input id="mK" type="text" inputmode="decimal"></div><div><label class="f" for="mP">Prot. g</label><input id="mP" type="text" inputmode="decimal"></div><div><label class="f" for="mC">Carbs g</label><input id="mC" type="text" inputmode="decimal"></div><div><label class="f" for="mG">Grasa g</label><input id="mG" type="text" inputmode="decimal"></div></div>
      <button class="btn primary block lg" style="margin-top:14px" data-act="guardarManual">Agregar</button>`);
    return;
  }
  const res = locales(addCtx.q);
  abrirHoja(`<h2 style="margin-bottom:10px">Agregar a ${meal}</h2>${tabs}
    <div class="row"><input class="grow" type="search" id="qCom" placeholder="Busca un alimento o código de barras" value="${esc(addCtx.q)}" data-in="qCom" enterkeyhint="search"><button class="btn" data-act="buscarOFF">Internet</button></div>
    <p class="muted small" style="margin:6px 2px 4px">${addCtx.q ? "En tu lista" : "Recientes y básicos"} · valores por 100 g</p>
    <div id="resLocal">${listaAlimentos(res, "loc")}</div>
    ${addCtx.cargando ? `<p class="muted">Buscando en Open Food Facts…</p>` : ""}
    ${addCtx.error ? `<p class="small" style="color:var(--danger)">${esc(addCtx.error)}</p>` : ""}
    ${addCtx.online.length ? `<p class="muted small" style="margin:12px 2px 4px">Open Food Facts · por 100 g</p>${listaAlimentos(addCtx.online, "off")}` : ""}`);
  const q = $("#qCom"); if (q && addCtx.q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}
function listaAlimentos(xs, src) {
  if (!xs.length) return `<p class="muted small">Nada por aquí. Prueba “Internet” o captura en Manual.</p>`;
  return `<div class="card" style="padding:4px 14px">${xs.map((a, i) => `<div class="li" data-act="selAli" data-src="${src}" data-i="${i}" style="cursor:pointer"><div style="min-width:0"><div class="t">${esc(a.nombre)}${a.mio ? ' <span class="pill">reciente</span>' : ""}</div>${macTxt(a)}</div><span class="muted">›</span></div>`).join("")}</div>`;
}
ACT.modoCom = el => { addCtx.modo = el.dataset.k; hojaAlimento(); };
ACT.selAli = el => {
  const list = el.dataset.src === "off" ? addCtx.online : locales(addCtx.q);
  addCtx.sel = list[+el.dataset.i]; hojaAlimento();
};
function hojaPorcion(meal) {
  const a = addCtx.sel; const g = a.porcion || 100;
  abrirHoja(`<button class="ghost" data-act="volverAli">‹ Volver</button>
    <h2 style="margin:12px 0 4px">${esc(a.nombre)}</h2><p class="muted small" style="margin:0 0 10px">Por 100 g: ${macTxt(a)}</p>
    <label class="f" for="gramos">Cantidad (gramos)</label>
    <div class="row"><input id="gramos" type="text" inputmode="decimal" value="${g}" data-in="gramos" class="grow">
    ${[0.5, 1, 2].map(m => `<button class="btn" data-act="porc" data-g="${Math.round(g * m)}">${m === 1 ? "1 porción" : m === 0.5 ? "½" : "×2"}</button>`).join("")}</div>
    <div class="card" style="margin-top:12px" id="calcAli">${macTxt(calcAli(a, g))}</div>
    <button class="btn primary block lg" data-act="guardarAli">Agregar a ${meal.toLowerCase()}</button>`);
}
function calcAli(a, g) { const k = g / 100; return {kcal: a.kcal * k, p: a.p * k, c: a.c * k, g: a.g * k}; }
ACT.volverAli = () => { addCtx.sel = null; hojaAlimento(); };
ACT.porc = el => { $("#gramos").value = el.dataset.g; $("#calcAli").innerHTML = macTxt(calcAli(addCtx.sel, num(el.dataset.g))); };
ACT.guardarAli = () => {
  const a = addCtx.sel; const g = num($("#gramos").value); if (g <= 0) { toast("Pon una cantidad en gramos."); return; }
  const m = calcAli(a, g);
  agregarComida({meal: addCtx.meal, nombre: a.nombre, gramos: g, kcal: r1(m.kcal), p: r1(m.p), c: r1(m.c), g: r1(m.g)});
  D.misAlimentos = [{nombre: a.nombre, kcal: a.kcal, p: a.p, c: a.c, g: a.g, porcion: g}, ...D.misAlimentos.filter(x => x.nombre !== a.nombre)].slice(0, 60);
  guardar(); cerrarHoja(); render();
};
ACT.guardarManual = () => {
  const nombre = $("#mNom").value.trim() || "Alimento";
  const x = {kcal: num($("#mK").value), p: num($("#mP").value), c: num($("#mC").value), g: num($("#mG").value)};
  if (!x.kcal && !x.p && !x.c && !x.g) { toast("Pon al menos las calorías o un macro."); return; }
  if (!x.kcal) x.kcal = Math.round(x.p * 4 + x.c * 4 + x.g * 9);
  agregarComida({meal: addCtx.meal, nombre, gramos: 0, ...x}); guardar(); cerrarHoja(); render();
};
function agregarComida(x) { const f = fechaComida; (D.comida[f] || (D.comida[f] = [])).push({id: uid(), ...x}); toast("Agregado ✓"); }

async function fetchJSON(url, ms = 12000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, {signal: ctl.signal}); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); }
  finally { clearTimeout(t); }
}
const offAli = p => { const n = p.nutriments || {}; const k = n["energy-kcal_100g"] ?? (n["energy_100g"] ? n["energy_100g"] / 4.184 : null);
  if (k == null) return null;
  return {nombre: [p.product_name, p.brands && p.brands.split(",")[0]].filter(Boolean).join(" · ") || "Producto", kcal: r1(+k), p: r1(+(n.proteins_100g || 0)), c: r1(+(n.carbohydrates_100g || 0)), g: r1(+(n.fat_100g || 0)), porcion: num(p.serving_quantity) || 100}; };
ACT.buscarOFF = async () => {
  const q = ($("#qCom").value || "").trim(); addCtx.q = q;
  if (!q) { toast("Escribe qué buscar."); return; }
  addCtx.cargando = true; addCtx.error = ""; addCtx.online = []; hojaAlimento();
  const campos = "product_name,brands,nutriments,serving_quantity";
  try {
    if (/^\d{8,14}$/.test(q)) {
      const j = await fetchJSON(`https://world.openfoodfacts.org/api/v2/product/${q}.json?fields=${campos}`);
      const a = j.product && offAli(j.product); addCtx.online = a ? [a] : [];
    } else {
      const j = await fetchJSON(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${campos}`);
      addCtx.online = (j.products || []).map(offAli).filter(a => a && a.nombre !== "Producto").slice(0, 20);
    }
    if (!addCtx.online.length) addCtx.error = "Sin resultados en internet. Prueba con otra palabra o captúralo en Manual.";
  } catch (e) { addCtx.error = "No se pudo conectar. Revisa tu internet o captúralo en Manual."; }
  addCtx.cargando = false; if (sheetOpen && !addCtx.sel) hojaAlimento();
};

// ---- Recetas ----
let recFiltro = "Todas", mealdb = {cargando: false, lista: [], error: "", ing: ""};
function comidaRecetas(head) {
  const tipos = ["Todas", "Desayuno", "Comida", "Snack"];
  const xs = RECETAS.filter(r => recFiltro === "Todas" || r.tipo === recFiltro);
  const ings = [["chicken_breast", "Pollo"], ["salmon", "Salmón"], ["beef", "Res"], ["eggs", "Huevo"], ["tuna", "Atún"], ["oats", "Avena"]];
  view().innerHTML = head + `
    <div class="seg">${tipos.map(t => `<button class="chip" aria-pressed="${t === recFiltro}" data-act="recTipo" data-k="${t}">${t}</button>`).join("")}</div>
    ${xs.map(r => `<details class="sess recipe"><summary><div style="min-width:0"><h2>${esc(r.nombre)}</h2><div>${macTxt(r)}</div></div><span class="pill">${r.min} min</span></summary>
      <div class="body"><p class="muted small" style="margin:10px 0 0">Ingredientes</p><ul>${r.ing.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
      <p class="muted small" style="margin:6px 0 0">Preparación</p><ol>${r.pasos.map(i => `<li>${esc(i)}</li>`).join("")}</ol>
      <button class="btn block" data-act="recAdd" data-i="${RECETAS.indexOf(r)}">Agregar a mi diario de hoy</button></div></details>`).join("")}
    <section class="card" style="margin-top:16px">
      <h2>Más recetas de internet</h2><p class="muted small" style="margin:4px 0 10px">De TheMealDB (vienen en inglés y sin macros). Escoge un ingrediente:</p>
      <div class="seg">${ings.map(([k, l]) => `<button class="chip" aria-pressed="${mealdb.ing === k}" data-act="mealdb" data-k="${k}">${l}</button>`).join("")}</div>
      ${mealdb.cargando ? `<p class="muted">Buscando…</p>` : ""}${mealdb.error ? `<p class="small" style="color:var(--danger)">${esc(mealdb.error)}</p>` : ""}
      ${mealdb.lista.map(m => `<div class="li" data-act="mealVer" data-id="${esc(m.idMeal)}" style="cursor:pointer"><span class="t">${esc(m.strMeal)}</span><span class="muted">›</span></div>`).join("")}
    </section>`;
}
ACT.recTipo = el => { recFiltro = el.dataset.k; render(); };
ACT.recAdd = el => {
  const r = RECETAS[+el.dataset.i]; const meal = r.tipo === "Desayuno" ? "desayuno" : r.tipo === "Snack" ? "snack" : "comida";
  fechaComida = hoy(); agregarComida({meal, nombre: r.nombre, gramos: 0, kcal: r.kcal, p: r.p, c: r.c, g: r.g}); guardar();
};
ACT.mealdb = async el => {
  mealdb = {cargando: true, lista: [], error: "", ing: el.dataset.k}; keepScroll(() => {});
  try {
    const j = await fetchJSON(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${el.dataset.k}`);
    mealdb.lista = (j.meals || []).slice(0, 25);
    if (!mealdb.lista.length) mealdb.error = "Sin resultados para ese ingrediente.";
  } catch (e) { mealdb.error = "No se pudo conectar. Revisa tu internet."; }
  mealdb.cargando = false; if (tab === "comida" && sub.comida === "recetas") keepScroll(() => {});
};
ACT.mealVer = async el => {
  abrirHoja(`<p class="muted">Cargando receta…</p>`);
  try {
    const j = await fetchJSON(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${encodeURIComponent(el.dataset.id)}`);
    const m = j.meals && j.meals[0]; if (!m) throw 0;
    const ing = []; for (let i = 1; i <= 20; i++) { const n = (m["strIngredient" + i] || "").trim(); if (n) ing.push(`${(m["strMeasure" + i] || "").trim()} ${n}`.trim()); }
    if (!sheetOpen) return;
    $("#sheet").innerHTML = `<div class="recipe"><h2>${esc(m.strMeal)}</h2><p class="muted small" style="margin:2px 0">${esc([m.strArea, m.strCategory].filter(Boolean).join(" · "))}</p>
      ${m.strMealThumb ? `<img src="${esc(m.strMealThumb)}/medium" alt="">` : ""}
      <p class="muted small" style="margin:6px 0 0">Ingredientes</p><ul>${ing.map(i => `<li>${esc(i)}</li>`).join("")}</ul>
      <p class="muted small" style="margin:6px 0 0">Preparación</p>${(m.strInstructions || "").split(/\r?\n+/).filter(s => s.trim()).map(p => `<p style="margin:6px 0">${esc(p)}</p>`).join("")}
      <p class="muted small">Para registrarla, agrégala en tu diario con Manual o por ingrediente.</p>
      <button class="btn block" data-act="cerrar">Cerrar</button></div>`;
  } catch (e) { if (sheetOpen) $("#sheet").innerHTML = `<p>No se pudo cargar la receta. Revisa tu internet.</p><button class="btn block" data-act="cerrar">Cerrar</button>`; }
};
ACT.cerrar = () => cerrarHoja();

// ================= ENFOQUE =================
let stState = {granted: null, apps: [], total: 0, cargado: false};
async function refrescarPantalla() {
  if (!isNative) return;
  try {
    const {granted} = await ST.hasPermission(); stState.granted = granted;
    if (granted) { const r = await ST.getTodayUsage(); stState.apps = r.apps || []; stState.total = r.totalMinutes || 0; }
  } catch (e) { stState.granted = false; }
  stState.cargado = true;
}
async function syncVigilancia() {
  if (!isNative) return;
  const p = D.ajustes.pantalla;
  try { await ST.setWatch({watch: JSON.stringify(p.apps), enabled: !!(p.on && stState.granted)}); } catch (e) {}
}

function vEnfoque() {
  const f = hoy(); const P = D.pomo; const foco = D.enfoqueLog[f] || 0;
  const pend = D.tareas.filter(t => !t.hecha), hechas = D.tareas.filter(t => t.hecha && t.hechaEn === f);
  view().innerHTML = `<h1>Enfoque</h1><p class="sub">${foco} min de enfoque hoy</p>
    ${bloquePantalla()}
    <section class="card">
      <div class="card-head"><h2>${P.fase === "enfoque" ? "Pomodoro" : "Descanso"}</h2>
        <div class="seg" style="margin:0"><button class="chip" aria-pressed="${P.modo === 25}" data-act="pomoModo" data-m="25">25/5</button><button class="chip" aria-pressed="${P.modo === 50}" data-act="pomoModo" data-m="50">50/10</button></div></div>
      <div class="timer" id="pomoT">${fmtReloj(restantePomo())}</div>
      <div class="row">${P.fin ? `<button class="btn grow" data-act="pomoPausa">Pausa</button>` : `<button class="btn primary grow" data-act="pomoStart">${P.resta ? "Seguir" : P.fase === "enfoque" ? "Empezar enfoque" : "Empezar descanso"}</button>`}
        <button class="btn" data-act="pomoReset">Reiniciar</button></div>
      <p class="muted small" style="margin:8px 0 0">Te aviso con notificación aunque bloquees el cel.</p>
    </section>
    <section class="card">
      <div class="card-head"><h2>Tareas</h2><span class="muted small">${pend.length} pendientes</span></div>
      <div class="row" style="margin-bottom:6px"><input class="grow" id="nuevaT" placeholder="¿Qué tienes que hacer?" enterkeyhint="done"><button class="btn" data-act="addTarea">Agregar</button></div>
      ${pend.map(t => tareaFila(t)).join("")}${hechas.map(t => tareaFila(t)).join("")}
      ${!pend.length && !hechas.length ? `<p class="muted small" style="margin:8px 0 0">Sin pendientes. Agrega lo más importante del día.</p>` : ""}
    </section>
    <section class="card">
      <div class="card-head"><h2>Hábitos</h2></div>
      ${D.habitos.map(h => `<div class="row">${habitoFila(h, f)}<button class="iconbtn" aria-label="Borrar hábito" data-act="delHab" data-id="${h.id}">✕</button></div>`).join("")}
      <div class="row" style="margin-top:8px"><input class="grow" id="nuevoH" placeholder="Nuevo hábito"><button class="btn" data-act="addHab">Agregar</button></div>
    </section>`;
  document.querySelectorAll(".row > .habit").forEach(h => h.style.flex = "1");
  if (P.fin) startPomoTick();
}

function bloquePantalla() {
  if (!isNative) return `<section class="card"><h2>Tiempo en pantalla</h2><p class="muted small" style="margin:6px 0 0">Funciona cuando instalas la app en Android.</p></section>`;
  if (!stState.cargado) return `<section class="card"><h2>Tiempo en pantalla</h2><p class="muted small">Cargando…</p></section>`;
  if (!stState.granted) return `<section class="card"><h2>Tiempo en pantalla</h2>
    <p class="small" style="margin:6px 0 10px">Para medir cuánto usas Instagram y otras apps, Android pide que actives “Acceso a datos de uso” para Modo Bestia. Todo se queda en tu teléfono.</p>
    <button class="btn primary block" data-act="permUso">Dar permiso</button></section>`;
  const p = D.ajustes.pantalla;
  const opciones = [...APPS_COMUNES, ...stState.apps.map(a => ({pkg: a.pkg, label: a.label}))].filter((a, i, arr) => arr.findIndex(b => b.pkg === a.pkg) === i && !p.apps.some(w => w.pkg === a.pkg));
  const max = Math.max(1, ...stState.apps.map(a => a.minutes));
  return `<section class="card">
    <div class="card-head"><h2>Tiempo en pantalla</h2><span class="muted small">${fmtMin(stState.total)} hoy</span></div>
    ${stState.apps.slice(0, 6).map(a => `<div class="macro" style="grid-template-columns:96px 1fr 64px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(a.label)}</span><div class="bar"><i style="width:${pct(a.minutes, max)}%;background:var(--muted)"></i></div><span class="v">${fmtMin(a.minutes)}</span></div>`).join("") || `<p class="muted small">Aún no hay uso registrado hoy.</p>`}
    <div class="switch" style="margin-top:10px;border-top:1px solid var(--line);padding-top:12px"><label for="swPant"><b>Alertas de límite</b><br><span class="muted small">Te aviso al pasar el límite (revisa cada ~15 min)</span></label><input type="checkbox" id="swPant" data-in="swPant" ${p.on ? "checked" : ""}></div>
    ${p.apps.map((a, i) => { const u = (stState.apps.find(x => x.pkg === a.pkg) || {minutes: 0}).minutes;
      return `<div class="li"><div style="min-width:0"><div class="t">${esc(a.label)}</div><div class="d" style="color:${u >= a.limit ? "var(--danger)" : "var(--muted)"}">${u} min hoy${u >= a.limit ? " · ya pasaste tu límite" : ""}</div></div>
      <div class="row"><input type="text" inputmode="numeric" style="width:64px;text-align:center" value="${a.limit}" aria-label="Límite en minutos" data-in="limApp" data-i="${i}"><span class="muted small">min</span><button class="iconbtn" aria-label="Dejar de vigilar" data-act="delApp" data-i="${i}">✕</button></div></div>`; }).join("")}
    ${opciones.length ? `<div class="row" style="margin-top:10px"><select class="grow" id="selApp">${opciones.map(o => `<option value="${esc(o.pkg)}">${esc(o.label)}</option>`).join("")}</select><button class="btn" data-act="addApp">Vigilar</button></div>` : ""}
  </section>`;
}
ACT.permUso = async () => { try { await ST.openSettings(); } catch (e) { toast("Abre Ajustes > Acceso a datos de uso"); } };
ACT.addApp = async () => {
  const pkg = $("#selApp").value; const o = [...APPS_COMUNES, ...stState.apps].find(a => a.pkg === pkg);
  D.ajustes.pantalla.apps.push({pkg, label: o ? o.label : pkg, limit: 30}); guardar(); await syncVigilancia(); keepScroll(() => {});
};
ACT.delApp = async el => { D.ajustes.pantalla.apps.splice(+el.dataset.i, 1); guardar(); await syncVigilancia(); keepScroll(() => {}); };

function tareaFila(t) {
  return `<div class="habit"><button class="tick" aria-pressed="${t.hecha}" aria-label="Completar" data-act="togTarea" data-id="${t.id}">✓</button><span style="flex:1;${t.hecha ? "text-decoration:line-through;color:var(--muted)" : ""}">${esc(t.texto)}</span><button class="iconbtn" aria-label="Borrar tarea" data-act="delTarea" data-id="${t.id}">✕</button></div>`;
}
ACT.addTarea = () => { const v = $("#nuevaT").value.trim(); if (!v) return; D.tareas.unshift({id: uid(), texto: v, hecha: false}); guardar(); keepScroll(() => {}); setTimeout(() => $("#nuevaT")?.focus(), 0); };
ACT.togTarea = el => { const t = D.tareas.find(x => x.id === el.dataset.id); if (!t) return; t.hecha = !t.hecha; t.hechaEn = t.hecha ? hoy() : null; guardar(); keepScroll(() => {}); };
ACT.delTarea = el => { D.tareas = D.tareas.filter(x => x.id !== el.dataset.id); guardar(); keepScroll(() => {}); };
ACT.addHab = () => { const v = $("#nuevoH").value.trim(); if (!v) return; D.habitos.push({id: uid(), nombre: v}); guardar(); keepScroll(() => {}); };
ACT.delHab = el => { const h = D.habitos.find(x => x.id === el.dataset.id); if (!h || !confirm(`¿Borrar el hábito "${h.nombre}"?`)) return; D.habitos = D.habitos.filter(x => x !== h); guardar(); keepScroll(() => {}); };

// ---- Pomodoro (basado en hora de fin, sobrevive a que cierres la app) ----
const durFase = () => (D.pomo.fase === "enfoque" ? D.pomo.modo : D.pomo.modo / 5) * 60000;
const restantePomo = () => D.pomo.fin ? Math.max(0, D.pomo.fin - Date.now()) : (D.pomo.resta ?? durFase());
const fmtReloj = ms => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
let pomoInt = null;
function startPomoTick() { stopPomoTick(); pomoInt = setInterval(() => { const el = $("#pomoT"); if (el) el.textContent = fmtReloj(restantePomo()); revisarPomo(); }, 500); }
function stopPomoTick() { clearInterval(pomoInt); pomoInt = null; }
function revisarPomo() {
  const P = D.pomo; if (!P.fin || Date.now() < P.fin) return;
  if (P.fase === "enfoque") { const f = hoy(); D.enfoqueLog[f] = (D.enfoqueLog[f] || 0) + P.modo; P.fase = "descanso"; otorgar("pomo:" + P.fin, PTS.pomo, `Pomodoro de ${P.modo} min`); toast(`¡${P.modo} min de enfoque! +${PTS.pomo} puntos`); }
  else { P.fase = "enfoque"; toast("Descanso terminado. ¿Otro bloque?"); }
  P.fin = null; P.resta = null; guardarYa(); try { navigator.vibrate && navigator.vibrate(400); } catch (e) {}
  if (tab === "enfoque") render();
}
ACT.pomoModo = el => { if (D.pomo.fin && !confirm("Esto reinicia el temporizador. ¿Continuar?")) return; D.pomo = {modo: +el.dataset.m, fase: "enfoque", fin: null, resta: null}; cancelarIds([300]); guardar(); render(); };
ACT.pomoStart = () => {
  const P = D.pomo; P.fin = Date.now() + restantePomo(); P.resta = null; guardar();
  programarUna(300, P.fase === "enfoque" ? "¡Bloque de enfoque terminado! 🎯" : "Se acabó el descanso", P.fase === "enfoque" ? "Levántate, toma agua y estírate." : "Regresa a lo tuyo, tú puedes.", P.fin);
  render();
};
ACT.pomoPausa = () => { const P = D.pomo; P.resta = restantePomo(); P.fin = null; cancelarIds([300]); guardar(); render(); };
ACT.pomoReset = () => { D.pomo = {modo: D.pomo.modo, fase: "enfoque", fin: null, resta: null}; cancelarIds([300]); guardar(); render(); };

// ================= NOTIFICACIONES =================
async function permisoNotif() {
  if (!LN) return false;
  try { let p = await LN.checkPermissions(); if (p.display !== "granted") p = await LN.requestPermissions(); return p.display === "granted"; } catch (e) { return false; }
}
async function canales() { if (!LN) return; try { await LN.createChannel({id: "recordatorios", name: "Recordatorios", importance: 4, vibration: true}); } catch (e) {} }
async function cancelarIds(ids) { if (!LN) return; try { await LN.cancel({notifications: ids.map(id => ({id}))}); } catch (e) {} }
async function programar(list) { if (!LN || !list.length) return; try { await LN.schedule({notifications: list.map(n => ({channelId: "recordatorios", smallIcon: "ic_stat_icon", ...n}))}); } catch (e) { console.warn(e); } }
async function programarUna(id, title, body, at) { if (!LN) return; await cancelarIds([id]); if (!(await permisoNotif())) return; programar([{id, title, body, schedule: {at: new Date(at), allowWhileIdle: true}}]); }

const FRASES_AGUA = ["Un vaso de agua y sigues 💧", "Hidrátate, rinde más el músculo", "¿Ya tomaste agua? Ándale", "Agua ahora, crecimiento después", "Tu meta de agua te espera"];
async function aplicarRecAgua() {
  if (!LN) return;
  const ids = Array.from({length: 24}, (_, i) => 100 + i); await cancelarIds(ids);
  const r = D.ajustes.aguaRec; if (!r.on) return;
  if (!(await permisoNotif())) { toast("Activa las notificaciones para recibir recordatorios."); return; }
  const list = [];
  for (let h = r.desde; h <= r.hasta; h += r.cada) list.push({id: 100 + h, title: "Hora de tomar agua", body: FRASES_AGUA[h % FRASES_AGUA.length], schedule: {on: {hour: h, minute: 0}, allowWhileIdle: true}});
  await programar(list);
}
async function aplicarRecGym() {
  if (!LN) return;
  await cancelarIds([200, 201, 202, 203, 204, 205, 206]);
  const r = D.ajustes.gymRec; if (!r.on || !r.dias.length) return;
  if (!(await permisoNotif())) { toast("Activa las notificaciones para recibir recordatorios."); return; }
  const [hh, mm] = r.hora.split(":").map(Number);
  await programar(r.dias.map(d => ({id: 200 + d, title: "Hoy toca gym 🏋️", body: "Ya sabes qué hacer. Abre la app para ver tu rutina.", schedule: {on: {weekday: d + 1, hour: hh, minute: mm}, allowWhileIdle: true}})));
}

// ================= AJUSTES =================
const DIAS = ["D", "L", "M", "Mi", "J", "V", "S"];
function vAjustes() {
  if (isNative && D.ajustes.mascota.flotante && flotPermiso === null) revisarFlotante().then(() => { if (tab === "ajustes") keepScroll(() => {}); });
  const a = D.ajustes, m = a.metas;
  const horas = (sel) => Array.from({length: 24}, (_, h) => `<option value="${h}" ${h === sel ? "selected" : ""}>${h}:00</option>`).join("");
  view().innerHTML = `<h1>Ajustes</h1><p class="sub">Todo se guarda solo en tu teléfono.</p>
    <section class="card"><h2>Metas de nutrición</h2>
      <label class="f" for="aPeso">Tu peso (kg)</label>
      <div class="row"><input id="aPeso" class="grow" type="text" inputmode="decimal" value="${esc(a.peso)}" data-in="aPeso"><button class="btn" data-act="sugerirMetas">Sugerir metas</button></div>
      <div class="grid4">${[["kcal", "kcal"], ["p", "Prot. g"], ["c", "Carbs g"], ["g", "Grasa g"]].map(([k, l]) => `<div><label class="f" for="meta_${k}">${l}</label><input id="meta_${k}" type="text" inputmode="numeric" value="${m[k]}" data-in="meta" data-k="${k}"></div>`).join("")}</div>
      <p class="muted small" style="margin:8px 0 0">La sugerencia es un punto de partida para ganar músculo (≈35 kcal y 2 g de proteína por kg). Ajusta según cómo responda tu peso en 3–4 semanas.</p>
    </section>
    <section class="card"><h2>Agua</h2>
      <div class="grid2"><div><label class="f" for="aMeta">Meta diaria (ml)</label><input id="aMeta" type="text" inputmode="numeric" value="${a.aguaMeta}" data-in="aguaMeta"></div>
      <div><label class="f" for="aVaso">Tamaño del vaso (ml)</label><input id="aVaso" type="text" inputmode="numeric" value="${a.vaso}" data-in="vaso"></div></div>
      <div class="switch" style="margin-top:10px"><label for="swAgua"><b>Recordatorios</b></label><input type="checkbox" id="swAgua" data-in="swAgua" ${a.aguaRec.on ? "checked" : ""}></div>
      <div class="grid2" style="grid-template-columns:1fr 1fr 1fr"><div><label class="f" for="aDesde">Desde</label><select id="aDesde" data-in="aguaRec" data-k="desde">${horas(a.aguaRec.desde)}</select></div>
      <div><label class="f" for="aHasta">Hasta</label><select id="aHasta" data-in="aguaRec" data-k="hasta">${horas(a.aguaRec.hasta)}</select></div>
      <div><label class="f" for="aCada">Cada</label><select id="aCada" data-in="aguaRec" data-k="cada">${[1, 2, 3].map(n => `<option value="${n}" ${n === a.aguaRec.cada ? "selected" : ""}>${n} h</option>`).join("")}</select></div></div>
    </section>
    <section class="card"><h2>Recordatorio de gym</h2>
      <div class="switch"><label for="swGym"><b>Avisarme los días de entreno</b></label><input type="checkbox" id="swGym" data-in="swGym" ${a.gymRec.on ? "checked" : ""}></div>
      <div class="seg" style="margin-top:6px">${DIAS.map((d, i) => `<button class="chip" aria-pressed="${a.gymRec.dias.includes(i)}" data-act="gymDia" data-d="${i}">${d}</button>`).join("")}</div>
      <label class="f" for="gHora">Hora</label><input id="gHora" type="time" value="${esc(a.gymRec.hora)}" data-in="gymHora" style="max-width:160px">
    </section>
    <section class="card"><h2>Mascota</h2>
      <div class="switch"><label for="swPetN"><b>Notificación persistente</b><br><span class="muted small">Tu mascota fija en las notificaciones con su recordatorio del momento</span></label><input type="checkbox" id="swPetN" data-in="swPetN" ${a.mascota.notif ? "checked" : ""}></div>
      <div class="switch" style="margin-top:6px"><label for="swFlot"><b>Mascota flotante</b><br><span class="muted small">Aparece unos segundos encima de otras apps para recordarte algo, y se va</span></label><input type="checkbox" id="swFlot" data-in="swFlot" ${a.mascota.flotante ? "checked" : ""}></div>
      ${a.mascota.flotante ? `
        ${isNative && flotPermiso === false ? `<p class="small" style="margin:8px 0">Android necesita el permiso <b>Mostrar sobre otras apps</b>.</p><button class="btn primary block" data-act="permFlot">Dar permiso</button>` : ""}
        <label class="f" for="flotCada">Aparece como máximo</label>
        <select id="flotCada" data-in="flotCada">${[[30, "cada 30 min"], [60, "cada hora"], [120, "cada 2 horas"], [180, "cada 3 horas"]].map(([v, l]) => `<option value="${v}" ${a.mascota.cada === v ? "selected" : ""}>${l}</option>`).join("")}</select>
        <p class="muted small" style="margin:6px 0 10px">Solo sale si tiene algo que recordarte (agua, hábitos, gym, un reto listo) y entre 9 am y 10 pm. Si pasas tu límite en Instagram, sale en ese momento.</p>
        <button class="btn block" data-act="probarFlot">Probar ahora</button>` : ""}
    </section>
    <section class="card"><h2>Apariencia</h2>
      <div class="seg" style="margin:8px 0 0">${[["auto", "Automático"], ["light", "Claro"], ["dark", "Oscuro"]].map(([k, l]) => `<button class="chip" aria-pressed="${a.tema === k}" data-act="tema" data-k="${k}">${l}</button>`).join("")}</div>
    </section>
    ${ajustesExtras()}
    <section class="card"><h2>Respaldo</h2>
      <p class="muted small" style="margin:6px 0 10px">Si desinstalas la app se borran tus datos. Exporta un respaldo de vez en cuando (Drive, WhatsApp a ti mismo, etc.).</p>
      <div class="grid2"><button class="btn" data-act="exportar">Exportar</button><button class="btn" data-act="importar">Importar</button></div>
      <input type="file" id="fileImp" accept="application/json,.json" hidden>
      <button class="ghost danger" style="width:100%;margin-top:10px" data-act="borrarTodo">Borrar todos mis datos</button>
    </section>`;
  $("#fileImp").onchange = importar;
}
ACT.sugerirMetas = () => {
  const p = num(D.ajustes.peso); if (p < 30 || p > 250) { toast("Escribe tu peso en kg primero."); return; }
  const kcal = Math.round(p * 35 / 10) * 10, pr = Math.round(p * 2), g = Math.round(p * 0.9), c = Math.max(0, Math.round((kcal - pr * 4 - g * 9) / 4));
  D.ajustes.metas = {kcal, p: pr, c, g}; guardar(); keepScroll(() => {}); toast("Metas actualizadas");
};
ACT.gymDia = el => { const d = +el.dataset.d, arr = D.ajustes.gymRec.dias; const i = arr.indexOf(d); if (i >= 0) arr.splice(i, 1); else arr.push(d); guardar(); aplicarRecGym(); keepScroll(() => {}); };
ACT.tema = el => { D.ajustes.tema = el.dataset.k; aplicarTema(); guardar(); keepScroll(() => {}); };
ACT.exportar = async () => {
  guardarYa(); const json = JSON.stringify(D); const nombre = `modo-bestia-${hoy()}.json`;
  try {
    if (isNative) {
      const r = await FS.writeFile({path: nombre, data: json, directory: "CACHE", encoding: "utf8"});
      await SH.share({title: "Respaldo Modo Bestia", files: [r.uri], dialogTitle: "Guardar respaldo"});
    } else {
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([json], {type: "application/json"})); a.download = nombre; a.click();
    }
  } catch (e) { if (!/cancel/i.test(String(e && e.message))) toast("No se pudo exportar."); }
};
ACT.importar = () => $("#fileImp").click();
function importar(ev) {
  const file = ev.target.files[0]; if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      if (!d || typeof d !== "object" || !("ajustes" in d || "sesiones" in d)) throw 0;
      if (!confirm("Esto reemplaza tus datos actuales con los del respaldo. ¿Continuar?")) return;
      D = mezclar(structuredClone(DEFAULTS), d); asegurarRutina(); guardarYa(); aplicarTema(); aplicarRecAgua(); aplicarRecGym(); syncVigilancia();
      toast("Respaldo importado ✓"); syncWidget(); render();
    } catch (e) { toast("Ese archivo no es un respaldo de Modo Bestia."); }
  };
  fr.readAsText(file); ev.target.value = "";
}
ACT.borrarTodo = async () => {
  if (!confirm("¿Borrar TODOS tus datos? No se puede deshacer.")) return;
  if (!confirm("¿Seguro? Te recomiendo exportar un respaldo antes.")) return;
  D = structuredClone(DEFAULTS); asegurarRutina(); guardarYa(); aplicarTema(); await aplicarRecAgua(); await aplicarRecGym(); await syncVigilancia(); syncWidget(); render(); toast("Datos borrados");
};

// ================= Inputs (delegados) =================
let _tr;
function onInput(e) {
  const t = e.target, k = t.dataset.in; if (!k) return;
  if (k.startsWith("x_")) { extrasInput(t, k); return; }
  const a = D.ajustes;
  switch (k) {
    case "set": D.borrador.ejercicios[+t.dataset.ei].series[+t.dataset.si][t.dataset.f] = t.value; break;
    case "gnota": D.borrador.nota = t.value; break;
    case "gfecha": D.borrador.fecha = t.value || hoy(); break;
    case "progEj": progEj = t.value; render(); return;
    case "qCom": addCtx.q = t.value; clearTimeout(_tr); _tr = setTimeout(() => { const box = $("#resLocal"); if (box) box.innerHTML = listaAlimentos(locales(addCtx.q), "loc"); }, 150); return;
    case "gramos": $("#calcAli").innerHTML = macTxt(calcAli(addCtx.sel, num(t.value))); return;
    case "aPeso": a.peso = t.value; break;
    case "meta": a.metas[t.dataset.k] = Math.round(num(t.value)); break;
    case "aguaMeta": a.aguaMeta = Math.max(250, Math.round(num(t.value))); break;
    case "vaso": a.vaso = Math.max(50, Math.round(num(t.value))); break;
    case "limApp": a.pantalla.apps[+t.dataset.i].limit = Math.max(5, Math.round(num(t.value)) || 30); clearTimeout(_tr); _tr = setTimeout(syncVigilancia, 600); break;
    case "rCustom": { const v = num($("#rNum").value) * num($("#rUni").value); if (v > 0) { nuevo.min = Math.min(MAX_RETO, Math.max(MIN_RETO, v)); document.querySelectorAll("[data-act=rPreset]").forEach(b => b.setAttribute("aria-pressed", "false")); refrescarPreview(); } return; }
    case "rTit": nuevo.titulo = t.value; return;
    case "x": return;
    case "gymHora": if (t.value) { a.gymRec.hora = t.value; clearTimeout(_tr); _tr = setTimeout(aplicarRecGym, 600); } break;
  }
  guardar();
}
async function onChange(e) {
  const t = e.target, k = t.dataset.in; if (!k) return;
  if (k.startsWith("x_")) { extrasChange(t, k); return; }
  const a = D.ajustes;
  if (k === "swAgua") { a.aguaRec.on = t.checked; guardar(); await aplicarRecAgua(); if (t.checked && isNative) toast("Recordatorios de agua activados"); }
  else if (k === "aguaRec") { a.aguaRec[t.dataset.k] = +t.value; if (a.aguaRec.hasta < a.aguaRec.desde) a.aguaRec.hasta = a.aguaRec.desde; guardar(); await aplicarRecAgua(); }
  else if (k === "swGym") { a.gymRec.on = t.checked; guardar(); await aplicarRecGym(); }
  else if (k === "swPant") { a.pantalla.on = t.checked; guardar(); if (t.checked) await permisoNotif(); await syncVigilancia(); if (t.checked) toast("Alertas activadas"); }
  else if (k === "progEj") { progEj = t.value; render(); }
  else if (k === "swPetN") { a.mascota.notif = t.checked; guardar(); if (t.checked) await permisoNotif(); syncWidget(); if (t.checked && isNative) toast("Listo, tu mascota está en tus notificaciones"); }
  else if (k === "swFlot") { a.mascota.flotante = t.checked; guardar(); if (t.checked) await revisarFlotante(); syncWidget(); keepScroll(() => {}); }
  else if (k === "flotCada") { a.mascota.cada = +t.value; guardar(); syncWidget(); }
}
["view", "sheet"].forEach(id => { const el = document.getElementById(id); el.addEventListener("input", onInput); el.addEventListener("change", onChange); });
document.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  const id = e.target.id;
  if (id === "nuevaT") { e.preventDefault(); ACT.addTarea(); }
  else if (id === "nuevoH") { e.preventDefault(); ACT.addHab(); }
  else if (id === "nuevoEj") { e.preventDefault(); ACT.addex(); }
  else if (id === "qCom") { e.preventDefault(); ACT.buscarOFF(); }
});

// ================= Arranque =================
async function alVolver() {
  revisarPomo();
  if (descFin && Date.now() >= descFin && $("#rest").classList.contains("on")) pararDescanso(true);
  if (isNative && (tab === "enfoque" || tab === "hoy")) {
    const antes = stState.granted; await refrescarPantalla();
    if (!antes && stState.granted) await syncVigilancia();
  }
  if (tab === "ajustes" && D.ajustes.mascota.flotante) { await revisarFlotante(); }
  if (!sheetOpen && ["enfoque", "hoy", "bestia", "ajustes"].includes(tab)) { const y = scrollY; render(); scrollTo(0, y); }
  programarHabitos(); syncWidget();
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") alVolver(); });

window.addEventListener("DOMContentLoaded", async function init() {
  aplicarTema(); ordenarSesiones(); render();
  if (D.pomo.fin) revisarPomo();
  if (isNative) {
    await canales();
    await refrescarPantalla(); await syncVigilancia();
    if (tab === "hoy" || tab === "enfoque") render();
  }
});
