/* Extras v1.4: calculadora lb/kg, editor de rutina, coach con IA, sincronización y control de música. */
"use strict";

const MUS = plug("Musica");
const LB = 0.45359237;

// ================= Calculadora lb ⇄ kg =================
let calc = {v: "", de: "lb", barra: 45, discos: {45: 0, 35: 0, 25: 0, 10: 0, 5: 0, 2.5: 0}};
ACT.calc = () => hojaCalc();
function hojaCalc() {
  const v = num(calc.v);
  const res = calc.de === "lb" ? v * LB : v / LB;
  const totLb = calc.barra + 2 * Object.entries(calc.discos).reduce((a, [p, n]) => a + num(p) * n, 0);
  abrirHoja(`<h2 style="margin-bottom:10px">Calculadora lb ⇄ kg</h2>
    <div class="row"><input id="cV" class="grow" type="text" inputmode="decimal" placeholder="Cantidad" value="${esc(calc.v)}" data-in="x_calcV" style="font-family:var(--display);font-size:1.6rem;font-weight:700">
      <div class="seg" style="margin:0"><button class="chip" aria-pressed="${calc.de === "lb"}" data-act="calcDe" data-k="lb">lb</button><button class="chip" aria-pressed="${calc.de === "kg"}" data-act="calcDe" data-k="kg">kg</button></div></div>
    <div class="card" style="text-align:center;margin:12px 0"><div class="big" id="cRes">${v ? r1(res) : "—"} <small>${calc.de === "lb" ? "kg" : "lb"}</small></div></div>
    <h2 style="margin:16px 0 6px">Barra con discos (lb)</h2>
    <p class="muted small" style="margin:0 0 8px">Cuántos discos pones <b>por lado</b>. Te dice el total en kg para anotarlo.</p>
    <div class="row" style="margin-bottom:8px"><span class="muted small">Barra</span>${[45, 35, 20, 0].map(b => `<button class="chip" aria-pressed="${calc.barra === b}" data-act="calcBarra" data-b="${b}">${b ? b + " lb" : "Sin barra"}</button>`).join("")}</div>
    <div class="grid2" style="grid-template-columns:repeat(3,1fr)">${Object.keys(calc.discos).sort((a, b) => b - a).map(p => `<div class="card" style="margin:0;padding:8px;text-align:center"><div class="muted small">${p} lb</div>
      <div class="row" style="justify-content:center;gap:6px"><button class="btn" style="padding:4px 10px" data-act="disco" data-p="${p}" data-d="-1">−</button><b style="font-family:var(--display);font-size:1.3rem;min-width:18px">${calc.discos[p]}</b><button class="btn" style="padding:4px 10px" data-act="disco" data-p="${p}" data-d="1">+</button></div></div>`).join("")}</div>
    <div class="card" style="text-align:center;margin:12px 0"><div class="muted small">Total</div><div class="big">${r1(totLb * LB)} <small>kg</small></div><div class="muted small">${r1(totLb)} lb</div></div>
    <button class="ghost" style="width:100%" data-act="discoReset">Quitar discos</button>
    <p class="muted small">Tip: en tu entrenamiento puedes escribir el peso como <b>135lb</b> y se convierte solo a kg.</p>`);
}
ACT.calcDe = el => { calc.de = el.dataset.k; hojaCalc(); };
ACT.calcBarra = el => { calc.barra = +el.dataset.b; hojaCalc(); };
ACT.disco = el => { const p = el.dataset.p; calc.discos[p] = Math.max(0, calc.discos[p] + +el.dataset.d); hojaCalc(); };
ACT.discoReset = () => { Object.keys(calc.discos).forEach(k => calc.discos[k] = 0); hojaCalc(); };

// "135lb" en una serie → kg
document.getElementById("view").addEventListener("change", e => {
  const t = e.target; if (t.dataset.f !== "peso") return;
  const m = String(t.value).trim().toLowerCase().match(/^([\d.,]+)\s*(lb|lbs|libras?)$/);
  if (!m) return;
  const kg = String(r1(num(m[1]) * LB)); t.value = kg;
  D.borrador.ejercicios[+t.dataset.ei].series[+t.dataset.si].peso = kg; guardar();
  toast(`${m[1]} lb = ${kg} kg`);
});

// ================= Editor de rutina =================
let rutAbierto = null;
function marcarRutina() { D.rutinaMod = Date.now(); guardar(); }
function gymRutina(head) {
  const dias = Object.entries(RUTINA).filter(([k]) => k !== "libre");
  view().innerHTML = head + `
    <p class="sub" style="margin-top:-4px">Tu rutina. Lo que cambies aquí aparece al empezar ese día.</p>
    ${dias.map(([k, d]) => `<details class="sess" ${rutAbierto === k ? "open" : ""} data-dia="${esc(k)}"><summary><div><h2>${esc(d.nombre)}</h2><div class="muted small">${d.ej.length} ejercicios${d.opcional ? " · opcional" : ""}</div></div><span class="muted">▾</span></summary>
      <div class="body">
        ${d.ej.map((e, i) => `<div class="li"><div style="min-width:0"><div class="t">${esc(e[0])}</div><div class="d">${e[1]} × ${esc(e[2])} · descanso ${r1(e[3] / 60)} min</div></div>
          <div class="row" style="gap:2px"><button class="iconbtn" aria-label="Subir" data-act="rMov" data-k="${esc(k)}" data-i="${i}" data-d="-1">↑</button><button class="iconbtn" aria-label="Bajar" data-act="rMov" data-k="${esc(k)}" data-i="${i}" data-d="1">↓</button><button class="iconbtn" aria-label="Editar" data-act="rEdit" data-k="${esc(k)}" data-i="${i}">✎</button><button class="iconbtn" aria-label="Quitar" data-act="rDel" data-k="${esc(k)}" data-i="${i}">✕</button></div></div>`).join("") || `<p class="muted small">Sin ejercicios todavía.</p>`}
        <button class="btn primary block" style="margin-top:10px" data-act="rEdit" data-k="${esc(k)}" data-i="-1">+ Agregar ejercicio</button>
        <div class="row" style="margin-top:8px"><button class="ghost" data-act="rRen" data-k="${esc(k)}">Renombrar</button><button class="ghost" data-act="rOpc" data-k="${esc(k)}">${d.opcional ? "Hacerlo fijo" : "Hacerlo opcional"}</button><button class="ghost danger" data-act="rDelDia" data-k="${esc(k)}">Borrar día</button></div>
      </div></details>`).join("")}
    <button class="btn block" data-act="rNuevoDia">+ Nuevo día</button>
    <div class="row" style="margin-top:10px">${D.rutinaPrev ? `<button class="ghost grow" data-act="rDeshacer">Deshacer último cambio de la IA</button>` : ""}<button class="ghost grow" data-act="rReset">Restaurar rutina original</button></div>
    <p class="muted small">Los días opcionales no entran en la sugerencia de "te toca".</p>`;
  view().querySelectorAll("details[data-dia]").forEach(d => d.addEventListener("toggle", () => { if (d.open) rutAbierto = d.dataset.dia; }));
}
ACT.rMov = el => {
  const ej = RUTINA[el.dataset.k].ej, i = +el.dataset.i, j = i + +el.dataset.d;
  if (j < 0 || j >= ej.length) return; [ej[i], ej[j]] = [ej[j], ej[i]]; rutAbierto = el.dataset.k; marcarRutina(); keepScroll(() => {});
};
ACT.rDel = el => {
  const d = RUTINA[el.dataset.k], i = +el.dataset.i;
  if (!confirm(`¿Quitar "${d.ej[i][0]}" de ${d.nombre}?`)) return;
  d.ej.splice(i, 1); rutAbierto = el.dataset.k; marcarRutina(); keepScroll(() => {});
};
ACT.rRen = el => { const d = RUTINA[el.dataset.k]; const v = prompt("Nombre del día", d.nombre); if (v && v.trim()) { d.nombre = v.trim().slice(0, 30); marcarRutina(); keepScroll(() => {}); } };
ACT.rOpc = el => { const d = RUTINA[el.dataset.k]; d.opcional = !d.opcional; rutAbierto = el.dataset.k; marcarRutina(); keepScroll(() => {}); };
ACT.rDelDia = el => {
  const d = RUTINA[el.dataset.k];
  if (!confirm(`¿Borrar el día "${d.nombre}"? Tu historial no se borra.`)) return;
  delete RUTINA[el.dataset.k]; if (D.borrador && D.borrador.dia === el.dataset.k) D.borrador = null; marcarRutina(); keepScroll(() => {});
};
ACT.rNuevoDia = () => {
  const v = prompt("Nombre del nuevo día (ej. Full body, Cardio, Espalda)"); if (!v || !v.trim()) return;
  const k = "d" + uid(); const libre = RUTINA.libre; delete RUTINA.libre;
  RUTINA[k] = {nombre: v.trim().slice(0, 30), ej: []}; RUTINA.libre = libre; rutAbierto = k; marcarRutina(); render();
};
ACT.rReset = () => {
  if (!confirm("¿Regresar a la rutina original? Pierdes los cambios que le hiciste.")) return;
  D.rutinaPrev = structuredClone(D.rutina); D.rutina = structuredClone(RUTINA_BASE); asegurarRutina(); D.borrador = null; marcarRutina(); render(); toast("Rutina original restaurada");
};
ACT.rDeshacer = () => {
  if (!D.rutinaPrev) return; const actual = D.rutina; D.rutina = D.rutinaPrev; D.rutinaPrev = null; asegurarRutina();
  if (D.borrador && !RUTINA[D.borrador.dia]) D.borrador = null; void actual; marcarRutina(); render(); toast("Listo, regresé la rutina anterior");
};

let rEd = null;
ACT.rEdit = el => {
  const k = el.dataset.k, i = +el.dataset.i; const e = i >= 0 ? RUTINA[k].ej[i] : ["", 3, "8–12", 90];
  rEd = {k, i}; rutAbierto = k;
  abrirHoja(`<h2 style="margin-bottom:6px">${i >= 0 ? "Editar ejercicio" : "Agregar a " + esc(RUTINA[k].nombre)}</h2>
    <label class="f" for="eNom">Ejercicio</label><input id="eNom" list="ejList2" value="${esc(e[0])}" placeholder="Ej. Hip thrust, Press en máquina…" maxlength="50">
    <datalist id="ejList2">${todosEjercicios().map(n => `<option value="${esc(n)}">`).join("")}</datalist>
    <div class="grid2" style="grid-template-columns:1fr 1fr 1fr"><div><label class="f" for="eSer">Series</label><input id="eSer" type="text" inputmode="numeric" value="${e[1]}"></div>
      <div><label class="f" for="eRep">Reps</label><input id="eRep" value="${esc(e[2])}"></div>
      <div><label class="f" for="eDes">Descanso (s)</label><input id="eDes" type="text" inputmode="numeric" value="${e[3]}"></div></div>
    <button class="btn primary block lg" style="margin-top:14px" data-act="rGuardarEj">Guardar</button>`);
};
ACT.rGuardarEj = () => {
  const nombre = $("#eNom").value.trim(); if (!nombre) { toast("Ponle nombre al ejercicio."); return; }
  const ej = [nombre.slice(0, 50), Math.min(10, Math.max(1, Math.round(num($("#eSer").value)) || 3)), $("#eRep").value.trim().slice(0, 12) || "8–12", Math.min(600, Math.max(15, Math.round(num($("#eDes").value)) || 90))];
  const d = RUTINA[rEd.k]; if (rEd.i >= 0) d.ej[rEd.i] = ej; else d.ej.push(ej);
  marcarRutina(); cerrarHoja(); render(); toast("Rutina actualizada");
};

// ================= Coach con IA =================
const IA_DEF = {prov: "gemini", key: "", modelo: {gemini: "gemini-flash-latest", claude: "claude-haiku-5-5"}};
function iaCfg() { D.ajustes.ia = mezclar(structuredClone(IA_DEF), D.ajustes.ia || {}); return D.ajustes.ia; }
let coachCargando = false;

function contextoCoach() {
  const rut = Object.entries(RUTINA).filter(([k]) => k !== "libre").map(([k, d]) => ({id: k, nombre: d.nombre, opcional: !!d.opcional, ejercicios: d.ej.map(e => ({nombre: e[0], series: e[1], reps: e[2], descanso: e[3]}))}));
  const ult = D.sesiones.slice(0, 6).map(s => ({fecha: s.fecha, dia: (RUTINA[s.dia] || {nombre: s.dia}).nombre, ejercicios: s.ejercicios.map(e => `${e.nombre}: ${e.series.map(x => `${x.peso}kg×${x.reps}`).join(", ")}`)}));
  const a = D.ajustes;
  return `Eres el coach de gym dentro de la app "Modo Bestia". Hablas en español mexicano, casual y directo, y respuestas cortas (máximo ~120 palabras salvo que pidan detalle).
El usuario quiere ganar músculo. ${a.peso ? `Pesa ${a.peso} kg. ` : ""}Metas diarias: ${a.metas.kcal} kcal, ${a.metas.p} g de proteína.
Su rutina actual (JSON): ${JSON.stringify(rut)}
Sus últimos entrenamientos: ${JSON.stringify(ult)}
Puedes recomendar ejercicios, sustitutos (por equipo, molestias o gusto) y ajustes. Si la persona menciona dolor fuerte o lesión, sugiere bajar carga y consultar a un profesional; no diagnostiques.
Si el usuario te pide cambiar la rutina (o aceptar un sustituto), propón los cambios en "cambios". Si solo pregunta, deja "cambios" vacío. Nunca inventes días que no existen salvo con la operación "nuevo_dia".
Responde SIEMPRE solo con JSON válido, sin texto fuera, con esta forma:
{"respuesta":"texto para el usuario","cambios":[ ... ]}
Operaciones válidas en "cambios" (usa el "id" del día y el nombre exacto del ejercicio actual):
{"op":"reemplazar","dia":"<id>","ejercicio":"<nombre actual>","nuevo":{"nombre":"...","series":3,"reps":"8–12","descanso":90}}
{"op":"agregar","dia":"<id>","nuevo":{"nombre":"...","series":3,"reps":"10–12","descanso":90}}
{"op":"quitar","dia":"<id>","ejercicio":"<nombre actual>"}
{"op":"modificar","dia":"<id>","ejercicio":"<nombre actual>","series":4,"reps":"6–8","descanso":150}
{"op":"nuevo_dia","nombre":"...","ejercicios":[{"nombre":"...","series":3,"reps":"8–12","descanso":90}]}`;
}

async function llamarIA(historial) {
  const c = iaCfg(); const sys = contextoCoach();
  if (!c.key) throw new Error("SIN_LLAVE");
  if (c.prov === "claude") {
    const r = await fetch("https://api.anthropic.com/v1/messages", {method: "POST",
      headers: {"content-type": "application/json", "x-api-key": c.key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true"},
      body: JSON.stringify({model: c.modelo.claude, max_tokens: 1500, system: sys, messages: historial.map(m => ({role: m.r === "u" ? "user" : "assistant", content: m.raw || m.t}))})});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || "HTTP " + r.status);
    return (j.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.modelo.gemini)}:generateContent`;
  const r = await fetch(url, {method: "POST", headers: {"content-type": "application/json", "x-goog-api-key": c.key},
    body: JSON.stringify({systemInstruction: {parts: [{text: sys}]}, contents: historial.map(m => ({role: m.r === "u" ? "user" : "model", parts: [{text: m.raw || m.t}]})), generationConfig: {responseMimeType: "application/json", temperature: 0.6}})});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.message) || "HTTP " + r.status);
  return ((j.candidates || [])[0]?.content?.parts || []).map(p => p.text || "").join("");
}
function parsearIA(txt) {
  let s = String(txt).trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  try { const o = JSON.parse(a >= 0 ? s.slice(a, b + 1) : s); return {t: String(o.respuesta || "").trim() || "(sin respuesta)", cambios: Array.isArray(o.cambios) ? o.cambios.slice(0, 20) : []}; }
  catch (e) { return {t: s || "(sin respuesta)", cambios: []}; }
}
const buscaEj = (d, n) => d.ej.findIndex(e => norm(e[0]) === norm(n || ""));
const ejDe = n => [String(n.nombre || "Ejercicio").slice(0, 50), Math.min(10, Math.max(1, Math.round(num(n.series)) || 3)), String(n.reps || "8–12").slice(0, 12), Math.min(600, Math.max(15, Math.round(num(n.descanso)) || 90))];
function describirCambio(c) {
  const d = RUTINA[c.dia]; const dn = d ? d.nombre : c.dia;
  switch (c.op) {
    case "reemplazar": return `${dn}: cambiar <b>${esc(c.ejercicio)}</b> por <b>${esc(c.nuevo?.nombre)}</b> (${c.nuevo?.series ?? 3} × ${esc(c.nuevo?.reps ?? "")})`;
    case "agregar": return `${dn}: agregar <b>${esc(c.nuevo?.nombre)}</b> (${c.nuevo?.series ?? 3} × ${esc(c.nuevo?.reps ?? "")})`;
    case "quitar": return `${dn}: quitar <b>${esc(c.ejercicio)}</b>`;
    case "modificar": return `${dn}: <b>${esc(c.ejercicio)}</b> → ${[c.series && c.series + " series", c.reps && c.reps + " reps", c.descanso && Math.round(c.descanso) + " s descanso"].filter(Boolean).join(", ")}`;
    case "nuevo_dia": return `Nuevo día <b>${esc(c.nombre)}</b> con ${(c.ejercicios || []).length} ejercicios`;
  }
  return "Cambio no reconocido";
}
function cambioValido(c) {
  if (c.op === "nuevo_dia") return !!c.nombre;
  const d = RUTINA[c.dia]; if (!d || c.dia === "libre") return false;
  if (c.op === "agregar") return !!(c.nuevo && c.nuevo.nombre);
  if (c.op === "reemplazar") return buscaEj(d, c.ejercicio) >= 0 && !!(c.nuevo && c.nuevo.nombre);
  return ["quitar", "modificar"].includes(c.op) && buscaEj(d, c.ejercicio) >= 0;
}
function aplicarCambios(cambios) {
  D.rutinaPrev = structuredClone(D.rutina); let n = 0;
  cambios.filter(cambioValido).forEach(c => {
    const d = RUTINA[c.dia];
    if (c.op === "nuevo_dia") { const libre = RUTINA.libre; delete RUTINA.libre; RUTINA["d" + uid()] = {nombre: String(c.nombre).slice(0, 30), ej: (c.ejercicios || []).map(ejDe)}; RUTINA.libre = libre; }
    else if (c.op === "agregar") d.ej.push(ejDe(c.nuevo));
    else if (c.op === "quitar") d.ej.splice(buscaEj(d, c.ejercicio), 1);
    else if (c.op === "reemplazar") d.ej[buscaEj(d, c.ejercicio)] = ejDe(c.nuevo);
    else if (c.op === "modificar") { const e = d.ej[buscaEj(d, c.ejercicio)]; if (c.series) e[1] = ejDe({series: c.series})[1]; if (c.reps) e[2] = String(c.reps).slice(0, 12); if (c.descanso) e[3] = ejDe({descanso: c.descanso})[3]; }
    n++;
  });
  if (D.borrador && !D.borrador.ejercicios.some(e => e.series.some(s => s.reps))) D.borrador = null; // que tome la rutina nueva
  marcarRutina(); return n;
}

function gymCoach(head) {
  const c = iaCfg(); const msgs = D.coach.msgs;
  if (!c.key) {
    view().innerHTML = head + `<section class="card"><h2>Coach con IA</h2>
      <p class="small">Pregúntale por ejercicios nuevos, sustitutos o que te ajuste la rutina. Usa tu propia llave de IA, que se guarda solo en tu teléfono.</p>
      <p class="small"><b>Opción gratis:</b> Gemini. Entra a <b>aistudio.google.com</b>, inicia sesión con Google, ve a <b>Get API key → Create API key</b> y pégala aquí.</p>
      <p class="small"><b>Opción Claude:</b> crea una llave en <b>console.anthropic.com</b> (es de pago por uso, pocos centavos por plática).</p>
      ${iaForm()}</section>`;
    return;
  }
  const sug = ["No tengo barra, ¿con qué cambio el press de banca?", "Me duele el hombro con el press militar, dame un sustituto", "Agrégame más trabajo de bíceps", "¿Cómo voy con mis pesos?"];
  view().innerHTML = head + `
    <div id="chat">${msgs.length ? msgs.map((m, i) => burbuja(m, i)).join("") : `<div class="card empty"><b>¿En qué te ayudo?</b>Pregunta lo que sea de tu rutina.</div>
      <div class="seg" style="flex-wrap:wrap">${sug.map(s => `<button class="chip" style="font-family:var(--body);font-weight:500;font-size:.9rem" data-act="coachSug" data-t="${esc(s)}">${esc(s)}</button>`).join("")}</div>`}
      ${coachCargando ? `<div class="msg ia"><span class="muted">Pensando…</span></div>` : ""}</div>
    <div class="row" style="margin-top:10px"><textarea id="coachIn" class="grow" rows="2" placeholder="Pregúntale a tu coach…" ${coachCargando ? "disabled" : ""}></textarea><button class="btn primary" data-act="coachEnviar" ${coachCargando ? "disabled" : ""}>Enviar</button></div>
    <div class="row" style="justify-content:space-between;margin-top:8px"><span class="muted small">${c.prov === "claude" ? "Claude" : "Gemini"} · ${esc(c.modelo[c.prov])}</span>${msgs.length ? `<button class="ghost" data-act="coachBorrar">Nueva plática</button>` : ""}</div>`;
  const ch = $("#chat"); if (ch && msgs.length) setTimeout(() => ch.lastElementChild?.scrollIntoView({block: "end"}), 0);
}
function burbuja(m, i) {
  if (m.r === "u") return `<div class="msg yo">${esc(m.t)}</div>`;
  if (m.r === "e") return `<div class="msg ia" style="border-color:var(--danger)">${esc(m.t)}</div>`;
  const cambios = (m.cambios || []);
  return `<div class="msg ia">${esc(m.t).replace(/\n/g, "<br>")}
    ${cambios.length ? `<div class="cambios"><div class="muted small" style="margin-bottom:4px">Cambios propuestos a tu rutina:</div>
      ${cambios.map(c => `<div class="small" style="padding:3px 0;${cambioValido(c) || m.estado ? "" : "opacity:.5;text-decoration:line-through"}">• ${describirCambio(c)}</div>`).join("")}
      ${m.estado === "aplicado" ? `<div class="pill" style="margin-top:6px">Aplicado ✓</div>` : m.estado === "descartado" ? `<div class="pill" style="margin-top:6px">Descartado</div>`
        : `<div class="grid2" style="margin-top:8px"><button class="btn primary" data-act="coachAplicar" data-i="${i}">Aplicar</button><button class="btn" data-act="coachDescartar" data-i="${i}">Descartar</button></div>`}</div>` : ""}</div>`;
}
ACT.coachSug = el => { const t = $("#coachIn"); if (t) t.value = el.dataset.t; ACT.coachEnviar(); };
ACT.coachEnviar = async () => {
  const inp = $("#coachIn"); const txt = (inp && inp.value || "").trim(); if (!txt || coachCargando) return;
  const msgs = D.coach.msgs; msgs.push({r: "u", t: txt}); coachCargando = true; guardar(); render();
  try {
    const hist = msgs.filter(m => m.r !== "e").slice(-12);
    const raw = await llamarIA(hist);
    const p = parsearIA(raw); p.cambios = p.cambios.filter(cambioValido); msgs.push({r: "a", t: p.t, raw: JSON.stringify({respuesta: p.t, cambios: p.cambios}), cambios: p.cambios});
  } catch (e) {
    const m = String(e.message || e);
    msgs.push({r: "e", t: m === "SIN_LLAVE" ? "Falta tu llave de IA (Ajustes → Coach con IA)." : /Failed to fetch|NetworkError|Load failed/i.test(m) ? "No me pude conectar. Revisa tu internet." : /API key|api_key|401|403|PERMISSION|invalid x-api-key/i.test(m) ? "Tu llave de IA no funcionó. Revísala en Ajustes → Coach con IA." : /429|quota|RESOURCE_EXHAUSTED|rate/i.test(m) ? "Se acabó tu límite de la IA por ahora. Intenta en un rato." : /not found|404|model/i.test(m) ? "Ese modelo ya no existe o no está disponible para tu llave. Cámbialo en Ajustes → Coach con IA." : "Error de la IA: " + m.slice(0, 160)});
  }
  D.coach.msgs = msgs.slice(-40); coachCargando = false; guardar();
  if (tab === "gym" && sub.gym === "coach" && !sheetOpen) render();
};
ACT.coachAplicar = el => {
  const m = D.coach.msgs[+el.dataset.i]; if (!m || m.estado) return;
  const n = aplicarCambios(m.cambios || []); m.estado = "aplicado"; guardar();
  toast(n ? `Listo, ${n} cambio${n > 1 ? "s" : ""} en tu rutina. Puedes deshacerlo en Rutina.` : "Ningún cambio era válido con tu rutina actual."); keepScroll(() => {});
};
ACT.coachDescartar = el => { const m = D.coach.msgs[+el.dataset.i]; if (m) { m.estado = "descartado"; guardar(); keepScroll(() => {}); } };
ACT.coachBorrar = () => { if (!confirm("¿Empezar una plática nueva? Se borra esta conversación.")) return; D.coach.msgs = []; guardar(); render(); };

function iaForm() {
  const c = iaCfg();
  return `<label class="f">Proveedor</label>
    <div class="seg" style="margin:0"><button class="chip" aria-pressed="${c.prov === "gemini"}" data-act="iaProv" data-k="gemini">Gemini (gratis)</button><button class="chip" aria-pressed="${c.prov === "claude"}" data-act="iaProv" data-k="claude">Claude</button></div>
    <label class="f" for="iaKey">Llave de API</label>
    <div class="row"><input id="iaKey" class="grow" type="password" autocomplete="off" placeholder="${c.prov === "claude" ? "sk-ant-…" : "AIza…"}" value="${esc(c.key)}" data-in="x_iaKey"><button class="btn" data-act="iaProbar">Probar</button></div>
    <label class="f" for="iaMod">Modelo</label><input id="iaMod" value="${esc(c.modelo[c.prov])}" data-in="x_iaMod">
    <p class="muted small" style="margin:6px 0 0">Si un día dice que el modelo no existe, cambia el nombre aquí por el actual que indique Google o Anthropic.</p>`;
}
ACT.iaProv = el => { iaCfg().prov = el.dataset.k; guardar(); keepScroll(() => {}); };
ACT.iaProbar = async el => {
  const c = iaCfg(); if (!c.key) { toast("Pega tu llave primero."); return; }
  el.disabled = true; el.textContent = "…";
  try { await llamarIA([{r: "u", t: "Responde con {\"respuesta\":\"ok\",\"cambios\":[]}"}]); toast("¡Funciona! 🎉 Ya puedes usar el Coach"); }
  catch (e) { toast("No funcionó: " + String(e.message || e).slice(0, 90)); }
  el.disabled = false; el.textContent = "Probar";
  if (tab === "gym") keepScroll(() => {});
};

// ================= Sincronizar dispositivos =================
function ajustesExtras() {
  return `${ajustesMusica()}<section class="card"><h2>Coach con IA</h2>${iaForm()}</section>
    <section class="card"><h2>Sincronizar con otro dispositivo</h2>
      <p class="muted small" style="margin:6px 0 10px">Pasa tus datos al otro cel (o tablet) y se <b>juntan</b> con lo que ya tenga: no se borra nada. Haz lo mismo de regreso para que los dos queden iguales.</p>
      <div class="grid2"><button class="btn primary" data-act="syncEnviar">Enviar</button><button class="btn" data-act="syncRecibir">Recibir</button></div>
      <input type="file" id="fileSync" accept="application/json,.json" hidden>
      <p class="muted small" style="margin:8px 0 0">${D.ultimaSync ? `Última sincronización: ${new Date(D.ultimaSync).toLocaleString("es-MX", {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"})}. ` : ""}Envíalo por Quick Share (lo más rápido), WhatsApp o Drive.</p>
    </section>`;
}
ACT.syncEnviar = async () => {
  guardarYa(); const datos = {...D, ajustes: undefined, borrador: undefined, coach: undefined, _sync: 1, _de: Date.now()};
  const json = JSON.stringify(datos); const nombre = `modo-bestia-sync-${hoy()}.json`;
  try {
    if (isNative) { const r = await FS.writeFile({path: nombre, data: json, directory: "CACHE", encoding: "utf8"}); await SH.share({title: "Sincronizar Modo Bestia", files: [r.uri], dialogTitle: "Enviar al otro dispositivo"}); }
    else { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([json], {type: "application/json"})); a.download = nombre; a.click(); }
  } catch (e) { if (!/cancel/i.test(String(e && e.message))) toast("No se pudo enviar."); }
};
ACT.syncRecibir = () => { const f = $("#fileSync"); f.onchange = recibirSync; f.click(); };
function recibirSync(ev) {
  const file = ev.target.files[0]; if (!file) return; ev.target.value = "";
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const o = JSON.parse(fr.result); if (!o || typeof o !== "object" || !("sesiones" in o || "puntos" in o)) throw 0;
      const r = fusionar(o); D.ultimaSync = Date.now(); guardarYa(); syncWidget(); render();
      toast(`Sincronizado ✓ ${r.ses} entrenamientos y ${r.com} comidas nuevas`);
    } catch (e) { console.warn(e); toast("Ese archivo no es de Modo Bestia."); }
  };
  fr.readAsText(file);
}
function unirPorId(a = [], b = [], gana = (x, y) => ((y.mod || 0) > (x.mod || 0) ? y : x)) {
  const m = new Map(a.map(x => [x.id, x])); let nuevos = 0;
  b.forEach(y => { if (!y || !y.id) return; const x = m.get(y.id); if (!x) { m.set(y.id, y); nuevos++; } else m.set(y.id, gana(x, y)); });
  return [[...m.values()], nuevos];
}
function fusionar(o) {
  let ses, com = 0, n;
  [D.sesiones, ses] = unirPorId(D.sesiones, o.sesiones); ordenarSesiones();
  for (const [f, xs] of Object.entries(o.comida || {})) { const [u, k] = unirPorId(D.comida[f] || [], xs); D.comida[f] = u; com += k; }
  for (const [f, v] of Object.entries(o.agua || {})) D.agua[f] = Math.max(D.agua[f] || 0, v);
  for (const [f, v] of Object.entries(o.enfoqueLog || {})) D.enfoqueLog[f] = Math.max(D.enfoqueLog[f] || 0, v);
  for (const [f, xs] of Object.entries(o.habLog || {})) D.habLog[f] = [...new Set([...(D.habLog[f] || []), ...xs])];
  [D.habitos, n] = unirPorId(D.habitos, o.habitos);
  [D.tareas, n] = unirPorId(D.tareas, o.tareas, (x, y) => (y.hecha && !x.hecha ? y : x));
  [D.retos, n] = unirPorId(D.retos, o.retos, (x, y) => (x.estado === "activo" && y.estado !== "activo" ? y : x));
  D.retoN = Math.max(D.retoN || 0, o.retoN || 0);
  const nombres = new Set(D.misAlimentos.map(a => a.nombre));
  (o.misAlimentos || []).forEach(a => { if (!nombres.has(a.nombre)) D.misAlimentos.push(a); });
  // Puntos: se recalculan para no contar doble
  Object.assign(D.otorgados, o.otorgados || {});
  for (const [k, t] of Object.entries(o.logros || {})) D.logros[k] = D.logros[k] ? Math.min(D.logros[k], t) : t;
  if (o.mascota) D.mascota.inventario = [...new Set([...D.mascota.inventario, ...(o.mascota.inventario || [])])];
  const xp = Object.values(D.otorgados).reduce((a, v) => a + v, 0);
  const gastado = D.mascota.inventario.reduce((a, id) => a + ((TIENDA.find(t => t.id === id) || {}).precio || 0), 0);
  const vistos = new Set(D.puntos.log.map(x => x.t + x.txt));
  D.puntos.log = [...D.puntos.log, ...((o.puntos && o.puntos.log) || []).filter(x => !vistos.has(x.t + x.txt))].sort((a, b) => b.t - a.t).slice(0, 200);
  D.puntos.xp = xp; D.puntos.saldo = Math.max(0, xp - gastado);
  D.rachaRecord = Math.max(D.rachaRecord || 0, o.rachaRecord || 0);
  if (o.rutina && (o.rutinaMod || 0) > (D.rutinaMod || 0)) { D.rutina = o.rutina; D.rutinaMod = o.rutinaMod; asegurarRutina(); if (D.borrador && !RUTINA[D.borrador.dia]) D.borrador = null; }
  revisarLogros();
  return {ses, com};
}

// ================= Música =================
let mus = {ok: null, titulo: "", artista: "", arte: "", sonando: false, app: ""}, musInt = null;
function playerCard() {
  if (usaSpotify()) { setTimeout(iniciarMusica, 0); return `<section class="card player" id="player">${spPlayerHTML()}</section>`; }
  if (!isNative) return "";
  setTimeout(iniciarMusica, 0);
  return `<section class="card player" id="player">${playerHTML()}</section>`;
}
function playerHTML() {
  const btn = (a, s, l) => `<button class="pbtn" aria-label="${l}" data-act="mus" data-a="${a}">${s}</button>`;
  const ctrl = `<div class="row" style="gap:4px">${btn("prev", "⏮", "Anterior")}${btn("toggle", mus.sonando ? "⏸" : "▶", mus.sonando ? "Pausa" : "Reproducir")}${btn("next", "⏭", "Siguiente")}</div>`;
  const info = mus.titulo
    ? `<div style="min-width:0;flex:1"><div class="t" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(mus.titulo)}</div><div class="muted small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(mus.artista)}</div></div>`
    : `<div style="min-width:0;flex:1"><div class="t">Música</div><div class="muted small">${mus.ok === false ? `<a href="#" data-act="musPerm">Ver qué suena</a> · ` : ""}<a href="#" data-act="musSpotify">Abrir Spotify</a></div></div>`;
  return `<div class="row">${mus.arte ? `<img src="data:image/png;base64,${mus.arte}" alt="" style="width:46px;height:46px;border-radius:8px;flex:0 0 auto">` : `<div class="pnota">♪</div>`}${info}${ctrl}</div>`;
}
async function refrescarMusica() {
  if (!MUS) return;
  try { const r = await MUS.nowPlaying(); mus = {ok: !!r.permiso, titulo: r.titulo || "", artista: r.artista || "", arte: r.arte || "", sonando: !!r.sonando, app: r.app || ""}; }
  catch (e) { mus.ok = false; }
  const p = $("#player"); if (p) p.innerHTML = playerHTML();
}
function iniciarMusica() {
  const fn = () => usaSpotify() ? (spConectado() ? spRefrescar() : null) : refrescarMusica();
  clearInterval(musInt); fn();
  musInt = setInterval(() => { if (tab !== "gym" || sub.gym !== "entrenar" || document.hidden || !$("#player")) { clearInterval(musInt); return; } fn(); }, usaSpotify() ? 5000 : 3000);
}
ACT.mus = async el => {
  try { await MUS.control({accion: el.dataset.a}); } catch (e) { toast("No hay música abierta. Abre Spotify primero."); }
  if (el.dataset.a === "toggle") { mus.sonando = !mus.sonando; const p = $("#player"); if (p) p.innerHTML = playerHTML(); }
  setTimeout(refrescarMusica, 600);
};
ACT.musPerm = (el, e) => { e.preventDefault(); toast("Activa Modo Bestia en Acceso a notificaciones"); MUS.abrirPermiso().catch(() => {}); };
ACT.musSpotify = async (el, e) => { e.preventDefault(); try { await MUS.abrirApp({pkg: "com.spotify.music"}); } catch (x) { toast("No encontré Spotify instalado."); } };

// ================= Entradas =================
function extrasInput(t, k) {
  if (k === "x_calcV") { calc.v = t.value; const v = num(t.value); const r = calc.de === "lb" ? v * LB : v / LB; const el = $("#cRes"); if (el) el.innerHTML = `${v ? r1(r) : "—"} <small>${calc.de === "lb" ? "kg" : "lb"}</small>`; }
  else if (k === "x_iaKey") { iaCfg().key = t.value.trim(); guardar(); }
  else if (k === "x_iaMod") { const c = iaCfg(); c.modelo[c.prov] = t.value.trim(); guardar(); }
}
function extrasChange() {}
document.addEventListener("visibilitychange", () => { if (!document.hidden && tab === "gym" && sub.gym === "entrenar") iniciarMusica(); });
