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
  guardar(); revisarLogros(); syncWidget(); petReaccion = Date.now();
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
// Mezcla dos colores hex (t = 0 → a, t = 1 → b)
function mezc(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return "#" + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
}
let petSeq = 0, petReaccion = 0;

/* La mascota está armada como un esqueleto: cuerpo, brazos y cabeza son grupos.
   Cada accesorio vive DENTRO de la parte que lo carga (la gorra en la cabeza, la pesa en la mano),
   así se mueve con ella. Cuernos, orejas y branquias salen de DETRÁS de la cabeza, para que nazcan de ella.
   Todas las especies comparten el mismo esqueleto, por eso todos los accesorios les quedan. */
function petSVG(o = {}) {
  const m = D.mascota;
  const eq = o.equipo || m.equipo;
  const especie = o.especie || m.especie || "monstruo";
  const ES = ESPECIES[especie] || ESPECIES.monstruo;
  const colorId = o.color || m.color;
  const col = (colorId && colorId !== "original" && colorId !== "amarillo" && COLORES_MASCOTA[colorId]) || ES.colores;
  const fondo = o.fondo !== undefined ? o.fondo : m.fondo;
  const animo = o.animo || animoMascota();
  const u = "p" + (++petSeq);
  const ink = "#1D2A33", L = col.borde, SW = 3;
  const piel = col.cuerpo, panza = col.panza, cuerno = mezc(col.panza, "#ffffff", .35);
  const lin = (id, a, b) => `<linearGradient id="${u}${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const ref = id => `url(#${u}${id})`;
  const conSombrero = eq.cabeza === "gorra" || eq.cabeza === "corona";
  const hocico = especie === "gorila" || especie === "xolo";
  const dy = hocico ? 7 : 0; // la boca baja al hocico

  const defs = `<defs>
    <radialGradient id="${u}luz" cx=".34" cy=".26" r=".85">
      <stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".26"/></radialGradient>
    <clipPath id="${u}cc"><ellipse cx="100" cy="150" rx="44.5" ry="36.5"/></clipPath>
    <clipPath id="${u}ccx"><ellipse cx="100" cy="150" rx="47" ry="39"/></clipPath>
    <clipPath id="${u}cab"><circle cx="100" cy="84" r="48.6"/></clipPath>
    <clipPath id="${u}cabx"><circle cx="100" cy="84" r="52"/></clipPath>
    ${lin("roja", "#E8605A", "#A9312C")}${lin("azul", "#4F86D9", "#23498A")}${lin("oro", "#FFE07A", "#C9921A")}
    ${lin("metal", "#9AA6AF", "#4C5862")}${lin("negro", "#3A4650", "#11181D")}${lin("vidrio", "#3D5566", "#0E161C")}
    ${lin("capa", "#C8423B", "#7E211D")}${lin("cielo", "#ff8a5c", "#ffd27a")}${lin("cuerno", cuerno, mezc(cuerno, L, .35))}
  </defs>`;

  const fondos = {
    gym: `<rect width="200" height="200" rx="28" fill="#3b4650"/><rect y="168" width="200" height="32" fill="#2a3239"/><rect x="16" y="44" width="6" height="124" fill="#566370"/><rect x="178" y="44" width="6" height="124" fill="#566370"/><rect x="16" y="76" width="168" height="5" fill="#566370"/><rect x="26" y="68" width="8" height="20" rx="2" fill="#20282e"/><rect x="166" y="68" width="8" height="20" rx="2" fill="#20282e"/>`,
    playa: `<rect width="200" height="200" rx="28" fill="#8fd3f4"/><circle cx="160" cy="40" r="17" fill="#ffe27a"/><rect y="142" width="200" height="16" fill="#4cb8eb"/><path d="M0 154h200v18q0 28-28 28H28Q0 200 0 172z" fill="#f2d49b"/>`,
    atardecer: `<rect width="200" height="200" rx="28" fill="${ref("cielo")}"/><circle cx="100" cy="168" r="44" fill="#fff1b8" opacity=".6"/>`,
    noche: `<rect width="200" height="200" rx="28" fill="#1b2440"/><circle cx="160" cy="38" r="13" fill="#f4f1d0"/><circle cx="154" cy="34" r="12" fill="#1b2440"/>${[[30, 30], [60, 55], [104, 20], [24, 96], [178, 104], [126, 58]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#fff"/>`).join("")}`,
  };
  const espejo = d => d; // (las piezas simétricas se dibujan con transform)
  const par = g => `${g}<g transform="matrix(-1 0 0 1 200 0)">${g}</g>`;

  // ---------- Partes propias de cada especie ----------
  const SP = {
    monstruo: {
      // cuerno de toro: su base está DENTRO de la cabeza y la cabeza se dibuja encima
      atras: par(`<path d="M86 46Q80 38 70 37 56 34 49 20q-6 10 0 22 8 14 25 20z" fill="${ref("cuerno")}" stroke="${L}" stroke-width="${SW}" stroke-linejoin="round"/>
        <path d="M57 32q4 6 1 11M52 25q4 4 1 8" stroke="${L}" stroke-width="1.8" fill="none" opacity=".45" stroke-linecap="round"/>`),
      caraPiel: `<ellipse cx="100" cy="112" rx="34" ry="20" fill="${panza}" opacity=".55"/>`,
      encima: conSombrero ? "" : `<path d="M86 38q0-15 10-12 4-11 10-1 10-3 8 13" fill="${piel}" stroke="${L}" stroke-width="${SW}" stroke-linejoin="round"/>`,
      brazo: [10.5, 19],
    },
    gorila: {
      atras: `<ellipse cx="100" cy="38" rx="20" ry="12" fill="${piel}" stroke="${L}" stroke-width="${SW}"/>` + par(`<circle cx="51" cy="88" r="10" fill="${panza}" stroke="${L}" stroke-width="${SW}"/><circle cx="51" cy="88" r="4.5" fill="${mezc(panza, L, .35)}"/>`),
      caraPiel: `<path d="M62 82q38-22 76 0 6 26-14 42-24 10-48 0-20-16-14-42z" fill="${panza}"/>
        <ellipse cx="100" cy="108" rx="24" ry="15" fill="${mezc(panza, "#ffffff", .12)}" stroke="${mezc(panza, L, .4)}" stroke-width="2"/>`,
      encima: `<path d="M64 77q36-16 72 0-4 6-10 4-26-8-52 0-6 2-10-4z" fill="${mezc(piel, "#000000", .25)}"/>
        <ellipse cx="95" cy="100" rx="3.2" ry="2.4" fill="${ink}"/><ellipse cx="105" cy="100" rx="3.2" ry="2.4" fill="${ink}"/>`,
      pecho: `<path d="M74 130q13 10 26 0 13 10 26 0" stroke="${mezc(panza, L, .4)}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
      brazo: [13, 22],
    },
    ajolote: {
      atras: par(`<g stroke-linecap="round" fill="none">
          <path d="M60 66Q44 58 32 48M56 84Q40 84 26 82M60 102Q44 110 34 122" stroke="${L}" stroke-width="10"/>
          <path d="M60 66Q44 58 32 48M56 84Q40 84 26 82M60 102Q44 110 34 122" stroke="${mezc(piel, "#D9306A", .45)}" stroke-width="6"/>
          <path d="M46 58l-2 6M38 52l-3 5M44 83l-1 6M34 82l-1 6M46 108l-4 4M38 114l-4 4" stroke="${mezc(piel, "#D9306A", .6)}" stroke-width="3"/></g>`),
      caraPiel: `<ellipse cx="100" cy="112" rx="36" ry="18" fill="${panza}" opacity=".6"/>`,
      encima: `<circle cx="70" cy="64" r="2.5" fill="${L}" opacity=".35"/><circle cx="128" cy="58" r="3" fill="${L}" opacity=".3"/><circle cx="136" cy="70" r="2" fill="${L}" opacity=".3"/>`,
      cola: `<path d="M128 168q34 6 54-22 6 18-6 34-20 18-50 6z" fill="${piel}" stroke="${L}" stroke-width="${SW}" stroke-linejoin="round"/><path d="M150 168q18-4 28-18" stroke="${mezc(piel, "#ffffff", .4)}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
      brazo: [10, 17],
    },
    xolo: {
      atras: par(`<path d="M82 46Q60 30 50 6q-12 26 0 56z" fill="${piel}" stroke="${L}" stroke-width="${SW}" stroke-linejoin="round"/><path d="M74 44Q60 32 54 18q-6 18 0 36z" fill="#C98A8A" opacity=".75"/>`),
      caraPiel: `<ellipse cx="100" cy="106" rx="23" ry="16" fill="${mezc(panza, "#ffffff", .2)}" stroke="${mezc(panza, L, .45)}" stroke-width="2"/>`,
      encima: `<path d="M90 66q10-5 20 0M92 72q8-4 16 0" stroke="${L}" stroke-width="2" fill="none" opacity=".45" stroke-linecap="round"/>
        <path d="M94 96q6-4 12 0-1 6-6 7-5-1-6-7z" fill="${ink}"/><ellipse cx="98" cy="97" rx="2" ry="1.2" fill="#fff" opacity=".5"/>
        ${conSombrero ? "" : `<path d="M90 38l3-14 5 10 4-14 4 13 5-9 1 15" fill="#2a2f35" stroke="#2a2f35" stroke-width="2" stroke-linejoin="round"/>`}`,
      cola: `<path d="M134 170q30-4 40-34" stroke="${L}" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M134 170q30-4 40-34" stroke="${piel}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
      brazo: [10.5, 19],
    },
  }[especie] || {};

  // ---------- Ojos y boca ----------
  const ojoR = especie === "ajolote" ? 5.5 : 7;
  const ojos = animo === "feliz"
    ? `<path d="M73 88q9-11 18 0M109 88q9-11 18 0" stroke="${ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`
    : `<g class="p-parp"><ellipse cx="82" cy="85" rx="${ojoR}" ry="${animo === "triste" ? ojoR - 1 : ojoR + 1}" fill="${ink}"/><ellipse cx="118" cy="85" rx="${ojoR}" ry="${animo === "triste" ? ojoR - 1 : ojoR + 1}" fill="${ink}"/>
       <circle cx="84.5" cy="81.5" r="2.4" fill="#fff"/><circle cx="120.5" cy="81.5" r="2.4" fill="#fff"/></g>
       ${animo === "triste" ? `<path d="M73 76l15-5M127 76l-15-5" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>` : ""}`;
  const boca = especie === "ajolote" && animo !== "triste"
    ? `<path d="M82 101q18 ${animo === "feliz" ? 14 : 9} 36 0" stroke="${ink}" stroke-width="3.5" fill="${animo === "feliz" ? "#B8423C" : "none"}" stroke-linecap="round" stroke-linejoin="round"/>`
    : animo === "feliz"
      ? `<path d="M89 101q11 13 22 0z" fill="#B8423C" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"/><path d="M94 106q6 4 12 0" stroke="#F28B82" stroke-width="3" stroke-linecap="round" fill="none"/>`
      : animo === "triste" ? `<path d="M91 108q9-8 18 0" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
        : especie === "xolo" ? `<path d="M92 103q4 4 8 0 4 4 8 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`
          : `<path d="M92 103q8 6 16 0" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  const colmillo = especie !== "monstruo" || animo === "triste" ? "" : `<path d="M${animo === "feliz" ? "102 101.5l2.5 5 2.5-5.5" : "103 105.5l2 4.5 2.4-5.4"}z" fill="#fff" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round"/>`;

  // ---------- Accesorios ----------
  const cabezaAtras = {
    audifonos: `<rect x="40" y="72" width="16" height="30" rx="7" fill="${ref("roja")}" stroke="${L}" stroke-width="${SW}"/><rect x="144" y="72" width="16" height="30" rx="7" fill="${ref("roja")}" stroke="${L}" stroke-width="${SW}"/>`,
  };
  const cabezaPiel = {
    banda: `<path d="M44 58q56-22 112 0v14q-56-20-112 0z" fill="${ref("roja")}"/><path d="M44 64q56-21 112 0" stroke="#fff" stroke-width="2.5" fill="none" opacity=".75"/><path d="M44 72q56-20 112 0" stroke="#7d1f1b" stroke-width="2" fill="none" opacity=".5"/>`,
  };
  const cabezaFrente = {
    banda: `<path d="M148 60q16-2 20 8-10 0-16 4z" fill="${ref("roja")}" stroke="${L}" stroke-width="2"/><path d="M150 66q14 6 14 16-8-6-15-6z" fill="${ref("roja")}" stroke="${L}" stroke-width="2"/>`,
    gorra: `<path d="M50 70A51 51 0 0 1 150 70q-50-14-100 0z" fill="${ref("azul")}" stroke="${L}" stroke-width="${SW}" stroke-linejoin="round"/>
      <path d="M100 33v28M72 44q14 8 16 22M128 44q-14 8-16 22" stroke="#1d3d73" stroke-width="2" fill="none" opacity=".7"/>
      <path d="M50 70q50-14 100 0q-6 12-50 12t-50-12z" fill="#23498A" stroke="${L}" stroke-width="${SW}" stroke-linejoin="round"/>
      <circle cx="100" cy="34" r="4.5" fill="#23498A" stroke="${L}" stroke-width="2"/>`,
    audifonos: `<path d="M48 84A52 52 0 0 1 152 84" stroke="${ref("negro")}" stroke-width="7" fill="none" stroke-linecap="round"/>
      <rect x="36" y="70" width="18" height="34" rx="8" fill="${ref("roja")}" stroke="${L}" stroke-width="${SW}"/><rect x="146" y="70" width="18" height="34" rx="8" fill="${ref("roja")}" stroke="${L}" stroke-width="${SW}"/>
      <rect x="40" y="78" width="4" height="18" rx="2" fill="#fff" opacity=".35"/><rect x="150" y="78" width="4" height="18" rx="2" fill="#fff" opacity=".35"/>`,
    corona: `<g transform="rotate(-8 100 38)"><path d="M74 46l4-24 11 13 11-19 11 19 11-13 4 24q-26-7-52 0z" fill="${ref("oro")}" stroke="${L}" stroke-width="${SW}" stroke-linejoin="round"/>
      <circle cx="100" cy="36" r="4" fill="#C8423B" stroke="${L}" stroke-width="1.5"/><circle cx="84" cy="40" r="2.6" fill="#3a7bd5"/><circle cx="116" cy="40" r="2.6" fill="#3a7bd5"/>
      <path d="M80 40l2-10" stroke="#fff" stroke-width="2" opacity=".6" stroke-linecap="round"/></g>`,
  };
  const cara = {
    lentes: `<path d="M56 82l12 2M144 82l-12 2" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
      <path d="M67 77q15-4 30 0 1 13-14 15-15-1-16-15z" fill="${ref("vidrio")}" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M103 77q15-4 30 0-1 14-16 15-15-2-14-15z" fill="${ref("vidrio")}" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M97 79q3-2 6 0" stroke="${ink}" stroke-width="3" fill="none"/>
      <path d="M72 82l7-3M108 82l7-3" stroke="#fff" stroke-width="2.2" opacity=".55" stroke-linecap="round"/>`,
    bigote: `<path d="M100 98q-6-6-14-3-6 3-9 9 8-3 13-1 6 1 10-5 4 6 10 5 5-2 13 1-3-6-9-9-8-3-14 3z" fill="#5a3a22" stroke="#3b2414" stroke-width="1.5" stroke-linejoin="round"/>`,
  };
  const enMano = {
    mancuerna: `<rect x="132" y="162" width="36" height="5" rx="2" fill="${ref("metal")}" stroke="${L}" stroke-width="1.5"/>
      <rect x="127" y="152" width="9" height="25" rx="2.5" fill="${ref("negro")}" stroke="${L}" stroke-width="2"/><rect x="164" y="152" width="9" height="25" rx="2.5" fill="${ref("negro")}" stroke="${L}" stroke-width="2"/>`,
    shaker: `<path d="M141 138h20l-2 34h-16z" fill="#eef2f5" stroke="${L}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M143.5 154h15l-1 16h-13z" fill="#c49a6c"/><rect x="140" y="131" width="22" height="9" rx="3" fill="${ref("azul")}" stroke="${L}" stroke-width="2.5"/>
      <path d="M145 142v26" stroke="#fff" stroke-width="2" opacity=".7" stroke-linecap="round"/>`,
  };
  const ropa = {
    playera: `<path d="M50 200V120q16-6 28-6 6 18 22 18t22-18q12 0 28 6v80z" fill="${ref("roja")}"/>
      <path d="M78 114q6 18 22 18t22-18" stroke="#fff" stroke-width="3" fill="none" opacity=".8"/>
      <path d="M86 150h28M88 158h24" stroke="#fff" stroke-width="3" opacity=".25" stroke-linecap="round"/>`,
  };
  const cuello = {
    cadena: `<path d="M64 128q36 34 72 0" stroke="${ref("oro")}" stroke-width="4" fill="none" stroke-dasharray="4 2.5"/>
      <circle cx="100" cy="146" r="7.5" fill="${ref("oro")}" stroke="${L}" stroke-width="2"/><path d="M96 146h8M97 143v6M103 143v6" stroke="${L}" stroke-width="1.6"/>`,
  };
  const tiene = (slot, id) => eq[slot] === id;
  const capaOn = tiene("cuerpo", "capa");
  const item = eq.mano && enMano[eq.mano] ? enMano[eq.mano] : "";
  const [brx, bry] = SP.brazo || [10.5, 19];

  const brazo = (lado) => {
    const izq = lado === "izq";
    const cx = izq ? 56 : 144, rot = izq ? 18 : -18;
    const mano = izq ? "" : (item ? `${item}<circle cx="150" cy="164.5" r="7.5" fill="${piel}" stroke="${L}" stroke-width="${SW}"/>` : "");
    return `<g class="p-b${lado}"><ellipse cx="${cx}" cy="148" rx="${brx}" ry="${bry}" fill="${piel}" stroke="${L}" stroke-width="${SW}" transform="rotate(${rot} ${cx} 148)"/>
      <ellipse cx="${cx}" cy="148" rx="${brx}" ry="${bry}" fill="url(#${u}luz)" transform="rotate(${rot} ${cx} 148)"/>${mano}</g>`;
  };

  const clases = ["pet", "esp-" + especie, "animo-" + animo, item ? "con-" + eq.mano : "", capaOn ? "con-capa" : "", Date.now() - petReaccion < 900 ? "salta" : ""].join(" ");
  return `<svg class="${clases}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">${defs}
    ${fondos[fondo] || ""}
    <ellipse class="p-sombra" cx="100" cy="192" rx="46" ry="6" fill="#000" opacity=".18"/>
    <g class="p-todo">
      <g class="p-cuerpo">
        ${capaOn ? `<g class="p-capa"><path d="M64 122q-24 44-18 70 54 10 108 0 6-26-18-70z" fill="${ref("capa")}" stroke="${L}" stroke-width="${SW}" stroke-linejoin="round"/><path d="M76 140q-8 26-6 48M124 140q8 26 6 48" stroke="#5f1814" stroke-width="2" fill="none" opacity=".5"/></g>` : ""}
        ${SP.cola ? `<g class="p-cola">${SP.cola}</g>` : ""}
        <ellipse cx="82" cy="186" rx="15" ry="8" fill="${mezc(piel, L, .35)}" stroke="${L}" stroke-width="${SW}"/>
        <ellipse cx="118" cy="186" rx="15" ry="8" fill="${mezc(piel, L, .35)}" stroke="${L}" stroke-width="${SW}"/>
        <ellipse cx="100" cy="150" rx="46" ry="38" fill="${piel}" stroke="${L}" stroke-width="${SW}"/>
        <g clip-path="url(#${u}cc)">
          <ellipse cx="100" cy="162" rx="28" ry="24" fill="${panza}"/>
          ${SP.pecho || ""}
          ${eq.cuerpo && ropa[eq.cuerpo] ? ropa[eq.cuerpo] : ""}
        </g>
        <g clip-path="url(#${u}ccx)"><rect x="40" y="100" width="120" height="100" fill="url(#${u}luz)"/></g>
        ${capaOn ? `<circle cx="70" cy="125" r="4.5" fill="${ref("oro")}" stroke="${L}" stroke-width="1.5"/><circle cx="130" cy="125" r="4.5" fill="${ref("oro")}" stroke="${L}" stroke-width="1.5"/>` : ""}
        ${eq.cuerpo && cuello[eq.cuerpo] ? cuello[eq.cuerpo] : ""}
        ${brazo("izq")}${brazo("der")}
      </g>
      <g class="p-cabeza">
        ${eq.cabeza && cabezaAtras[eq.cabeza] ? cabezaAtras[eq.cabeza] : ""}
        <g class="p-orejas">${SP.atras || ""}</g>
        <circle cx="100" cy="84" r="50" fill="${piel}" stroke="${L}" stroke-width="${SW}"/>
        <g clip-path="url(#${u}cab)">
          ${SP.caraPiel || ""}
          ${eq.cabeza && cabezaPiel[eq.cabeza] ? cabezaPiel[eq.cabeza] : ""}
        </g>
        ${tiene("cabeza", "gorra") ? cabezaFrente.gorra : ""}
        <g clip-path="url(#${u}cabx)"><rect x="46" y="30" width="108" height="108" fill="url(#${u}luz)"/></g>
        ${SP.encima || ""}
        ${eq.cabeza && eq.cabeza !== "gorra" && cabezaFrente[eq.cabeza] ? cabezaFrente[eq.cabeza] : ""}
        <ellipse cx="68" cy="99" rx="7" ry="4.5" fill="${mezc(piel, "#E0607E", .45)}" opacity=".55"/><ellipse cx="132" cy="99" rx="7" ry="4.5" fill="${mezc(piel, "#E0607E", .45)}" opacity=".55"/>
        ${tiene("cara", "lentes") ? "" : ojos}
        <g transform="translate(0 ${dy})">${boca}${tiene("cara", "bigote") ? "" : colmillo}${tiene("cara", "bigote") ? cara.bigote : ""}</g>
        ${tiene("cara", "lentes") ? cara.lentes : ""}
      </g>
    </g>
    <g class="p-fx" fill="#F2C230" stroke="${L}" stroke-width="1.5">
      <path d="M40 60l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/><path d="M160 54l2.5 6 6 .8-4.4 4.2 1 6-5.1-2.8-5.1 2.8 1-6-4.4-4.2 6-.8z"/><path d="M150 24l2 5 5 .6-3.6 3.4.8 5-4.2-2.4-4.2 2.4.8-5-3.6-3.4 5-.6z"/>
    </g>
  </svg>`;
}
function reaccionar() {
  petReaccion = Date.now();
  document.querySelectorAll("svg.pet").forEach(s => { s.classList.remove("salta"); void s.getBoundingClientRect(); s.classList.add("salta"); });
}
const FRASES_TOQUE = ["¡Jeje, cosquillas!", "¿Vamos al gym?", "Échale ganas, carnal 💪", "¿Ya tomaste agua?", "¡Otro reto, otro reto!", "Tú puedes con todo."];
ACT.tocarPet = () => { reaccionar(); const b = document.querySelector(".petbig + .bubble, .petbig ~ .bubble"); if (b) b.textContent = FRASES_TOQUE[Math.floor(Math.random() * FRASES_TOQUE.length)]; try { navigator.vibrate && navigator.vibrate(30); } catch (e) {} };

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
      <div class="petbig" data-act="tocarPet">${petSVG(equipoPrueba || {})}</div>
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
const SLOTS = [["especie", "Mascotas"], ["cabeza", "Cabeza"], ["cara", "Cara"], ["mano", "En la mano"], ["cuerpo", "Cuerpo"], ["color", "Colores"], ["fondo", "Fondos"]];
function equipado(it) {
  const m = D.mascota;
  if (it.slot === "especie") return (m.especie || "monstruo") === it.valor;
  if (it.slot === "color") return m.color === it.valor;
  if (it.slot === "fondo") return m.fondo === it.valor;
  return m.equipo[it.slot] === it.id;
}
function probarEquipo(id) {
  const it = TIENDA.find(t => t.id === id); const m = D.mascota;
  if (it.slot === "especie") return {especie: it.valor};
  if (it.slot === "color") return {color: it.valor};
  if (it.slot === "fondo") return {fondo: it.valor};
  return {equipo: {...m.equipo, [it.slot]: it.id}};
}
function bTienda(head) {
  const inv = D.mascota.inventario;
  view().innerHTML = head + SLOTS.map(([s, l]) => `<section class="card" style="padding:6px 14px"><h2 style="margin:8px 0 2px">${l}</h2>
    ${s === "especie" ? `<div class="li"><span class="t">Monstruo (el original)</span>${(D.mascota.especie || "monstruo") === "monstruo" ? `<span class="pill">Contigo</span>` : `<button class="btn" data-act="usarBase" data-k="especie">Elegir</button>`}</div>` : ""}
    ${s === "color" ? `<div class="li"><div class="row"><span class="sw" style="background:${(ESPECIES[D.mascota.especie || "monstruo"]).colores.cuerpo}"></span><span class="t">Color original</span></div>${colorOriginal() ? `<span class="pill">En uso</span>` : `<button class="btn" data-act="usarBase" data-k="color">Usar</button>`}</div>` : ""}
    ${s === "fondo" ? `<div class="li"><span class="t">Sin fondo</span>${D.mascota.fondo === "ninguno" ? `<span class="pill">En uso</span>` : `<button class="btn" data-act="usarBase" data-k="fondo">Usar</button>`}</div>` : ""}
    ${TIENDA.filter(t => t.slot === s).map(t => {
      const tiene = inv.includes(t.id), en = equipado(t);
      const sw = t.slot === "color" ? `<span class="sw" style="background:${COLORES_MASCOTA[t.valor].cuerpo}"></span>` : "";
      return `<div class="li"><div class="row" style="min-width:0">${sw}<div style="min-width:0"><div class="t">${esc(t.nombre)}</div><div class="d">${tiene ? (en ? "Lo traes puesto" : "Ya es tuyo") : `⭐ ${t.precio}`}</div></div></div>
        <div class="row">${!tiene ? `<button class="ghost" data-act="probar" data-id="${t.id}">Probar</button><button class="btn ${D.puntos.saldo >= t.precio ? "primary" : ""}" data-act="comprar" data-id="${t.id}" ${D.puntos.saldo >= t.precio ? "" : "disabled"}>Comprar</button>`
        : en && !["color", "fondo", "especie"].includes(t.slot) ? `<button class="btn" data-act="quitar" data-id="${t.id}">Quitar</button>`
        : en ? `<span class="pill">${t.slot === "especie" ? "Contigo" : "En uso"}</span>` : `<button class="btn" data-act="usar" data-id="${t.id}">${t.slot === "especie" ? "Elegir" : "Usar"}</button>`}</div></div>`;
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
const colorOriginal = () => !D.mascota.color || D.mascota.color === "original" || D.mascota.color === "amarillo";
function usarItem(t) { const m = D.mascota; if (t.slot === "especie") m.especie = t.valor; else if (t.slot === "color") m.color = t.valor; else if (t.slot === "fondo") m.fondo = t.valor; else m.equipo[t.slot] = t.id; }
ACT.usar = el => { usarItem(TIENDA.find(x => x.id === el.dataset.id)); guardar(); syncWidget(); keepScroll(() => {}); };
ACT.quitar = el => { const t = TIENDA.find(x => x.id === el.dataset.id); D.mascota.equipo[t.slot] = null; guardar(); syncWidget(); keepScroll(() => {}); };
ACT.usarBase = el => { const k = el.dataset.k; if (k === "color") D.mascota.color = "original"; else if (k === "especie") D.mascota.especie = "monstruo"; else D.mascota.fondo = "ninguno"; guardar(); syncWidget(); keepScroll(() => {}); };

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
const esRecordatorio = msg => !/^(Aquí andamos|Sin retos activos|Vas con “)/.test(msg);
function agendaWidget() {
  const ahora = Date.now(); const actual = mensajeMascota(); const lista = [{t: ahora, msg: actual, r: esRecordatorio(actual) ? 1 : 0}];
  const base = new Date(); base.setMinutes(0, 0, 0);
  const metaOk = (D.agua[hoy()] || 0) >= D.ajustes.aguaMeta;
  for (let i = 1; i <= 30; i++) {
    const d = new Date(base.getTime() + i * 3600000); const h = d.getHours(); const mismoDia = keyFecha(d) === hoy();
    if (h === 0) lista.push({t: d.getTime(), msg: "Nuevo día, nuevos puntos 💪 Abre la app para ver qué toca.", r: 0});
    else if (mismoDia && !metaOk && h >= 10 && h <= 21 && h % 2 === 0) lista.push({t: d.getTime(), msg: "¿Ya tomaste agua? Un vaso y sigues 💧", r: 1});
    else if (mismoDia && h === 19 && habitosPendientes()) lista.push({t: d.getTime(), msg: "No olvides tus hábitos de hoy, son puntos fáciles.", r: 1});
    else if (!mismoDia && h >= 9 && h <= 21 && h % 3 === 0) lista.push({t: d.getTime(), msg: "¿Agua, hábitos, retos? Pásate a verme.", r: 0});
  }
  D.retos.filter(r => r.estado === "activo" && r.fin > ahora).forEach(r => lista.push({t: r.fin, msg: `¡Tu reto “${r.titulo}” ya está listo para cobrar! (+${r.pts})`, r: 1}));
  return lista.sort((a, b) => a.t - b.t);
}
let _tw;
function syncWidget() {
  if (!PW) return; clearTimeout(_tw);
  _tw = setTimeout(async () => {
    try {
      const image = await svgAPng(petSVG({fondo: D.mascota.fondo}));
      const am = D.ajustes.mascota;
      await PW.update({image, nombre: D.mascota.nombre, info: `Nv ${nivel(D.puntos.xp)} · ⭐ ${D.puntos.saldo}`, agenda: JSON.stringify(agendaWidget()),
        notif: !!am.notif, flotante: !!am.flotante, cada: am.cada || 60});
    } catch (e) { console.warn("widget", e); }
  }, 1200);
}

// ================= Arranque =================
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { syncWidget(); programarHabitos(); } });
window.addEventListener("DOMContentLoaded", () => { revisarLogros(); syncWidget(); programarHabitos(); });

// ================= Mascota flotante (encima de otras apps) =================
let flotPermiso = null;
async function revisarFlotante() {
  if (!PW) return null;
  try { flotPermiso = (await PW.canOverlay()).granted; } catch (e) { flotPermiso = false; }
  return flotPermiso;
}
ACT.permFlot = async () => { try { await PW.openOverlaySettings(); } catch (e) { toast("Abre Ajustes > Apps > Modo Bestia > Mostrar sobre otras apps"); } };
ACT.probarFlot = async () => {
  if (!PW) { toast("Funciona en la app instalada en Android."); return; }
  if (!(await revisarFlotante())) { toast("Primero da el permiso de mostrar sobre otras apps."); return; }
  syncWidget();
  setTimeout(() => PW.testFloat({msg: mensajeMascota()}).catch(() => {}), 1600);
  toast("Sal de la app: en unos segundos aparece 👀");
};
