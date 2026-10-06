'use strict';

// ---------- Opslag ----------
// Alles staat lokaal in localStorage op dit toestel; niets gaat naar een server.
const KEY = 'hoofdpijndagboek.v1';

function laad() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.dagen) return { versie: 1, meta: {}, ...d };
  } catch { /* corrupte opslag: leeg beginnen */ }
  return { versie: 1, dagen: {}, meta: {} };
}
let db = laad();

function bewaar() {
  for (const [k, d] of Object.entries(db.dagen)) if (isLeeg(d)) delete db.dagen[k];
  localStorage.setItem(KEY, JSON.stringify(db));
}
navigator.storage?.persist?.();

// ---------- Vaste keuzes ----------
const OPTIES = {
  plek: ['Voorhoofd', 'Slapen', 'Achter de ogen', 'Kruin', 'Achterhoofd', 'Nek', 'Hele hoofd'],
  kant: ['Links', 'Rechts', 'Beide kanten'],
  soort: ['Kloppend', 'Drukkend', 'Knellend', 'Stekend', 'Zeurend', 'Brandend'],
  symptomen: ['Misselijk', 'Overgeven', 'Lichtgevoelig', 'Geluidsgevoelig', 'Geurgevoelig', 'Aura', 'Duizelig', 'Erger bij bewegen', 'Tranend oog / loopneus'],
};

const LEEFSTIJL = [
  { k: 'slaap', label: 'Slaap afgelopen nacht', type: 'getal', eenheid: 'uur', stap: 0.5, min: 0, max: 16, start: 7 },
  { k: 'slaapkwaliteit', label: 'Slaapkwaliteit', type: 'keuze', opties: ['Slecht', 'Matig', 'Goed'] },
  { k: 'stress', label: 'Stress', type: 'keuze', opties: ['Laag', 'Gemiddeld', 'Hoog'] },
  { k: 'drukte', label: 'Drukte', type: 'keuze', opties: ['Rustig', 'Gemiddeld', 'Druk'] },
  { k: 'cafeine', label: 'Cafeïne', type: 'getal', eenheid: 'koppen', stap: 1, min: 0, max: 20, start: 0 },
  { k: 'alcohol', label: 'Alcohol', type: 'getal', eenheid: 'glazen', stap: 1, min: 0, max: 20, start: 0 },
  { k: 'water', label: 'Water', type: 'getal', eenheid: 'glazen', stap: 1, min: 0, max: 25, start: 4 },
  { k: 'scherm', label: 'Schermtijd', type: 'getal', eenheid: 'uur', stap: 1, min: 0, max: 20, start: 4 },
  { k: 'maaltijd', label: 'Maaltijd overgeslagen', type: 'janee' },
  { k: 'beweging', label: 'Bewogen of gesport', type: 'janee' },
  { k: 'wandeling', label: 'Middagwandeling', type: 'janee' },
  { k: 'weer', label: 'Weersomslag', type: 'janee' },
];

// Factoren voor Inzichten: geven true/false per dag, of null als het niet is ingevuld.
const FACTOREN = [
  { label: 'Minder dan 6 uur geslapen', f: (d) => isGetal(d.leefstijl.slaap) ? d.leefstijl.slaap < 6 : null },
  { label: 'Slecht geslapen', f: (d) => d.leefstijl.slaapkwaliteit ? d.leefstijl.slaapkwaliteit === 'Slecht' : null },
  { label: 'Hoge stress', f: (d) => d.leefstijl.stress ? d.leefstijl.stress === 'Hoog' : null },
  { label: 'Druk gehad', f: (d) => d.leefstijl.drukte ? d.leefstijl.drukte === 'Druk' : null },
  { label: 'Druk, maar niet gestrest', f: (d) => d.leefstijl.drukte && d.leefstijl.stress ? d.leefstijl.drukte === 'Druk' && d.leefstijl.stress !== 'Hoog' : null },
  { label: '3 of meer koppen cafeïne', f: (d) => isGetal(d.leefstijl.cafeine) ? d.leefstijl.cafeine >= 3 : null },
  { label: 'Geen cafeïne', f: (d) => isGetal(d.leefstijl.cafeine) ? d.leefstijl.cafeine === 0 : null },
  { label: 'Alcohol gedronken', f: (d) => isGetal(d.leefstijl.alcohol) ? d.leefstijl.alcohol > 0 : null },
  { label: 'Alcohol de dag ervoor', f: (d, gisteren) => gisteren && isGetal(gisteren.leefstijl.alcohol) ? gisteren.leefstijl.alcohol > 0 : null },
  { label: 'Minder dan 6 glazen water', f: (d) => isGetal(d.leefstijl.water) ? d.leefstijl.water < 6 : null },
  { label: '6 uur of meer schermtijd', f: (d) => isGetal(d.leefstijl.scherm) ? d.leefstijl.scherm >= 6 : null },
  { label: 'Maaltijd overgeslagen', f: (d) => isBool(d.leefstijl.maaltijd) ? d.leefstijl.maaltijd : null },
  { label: 'Niet bewogen', f: (d) => isBool(d.leefstijl.beweging) ? !d.leefstijl.beweging : null },
  { label: 'Geen middagwandeling', f: (d) => isBool(d.leefstijl.wandeling) ? !d.leefstijl.wandeling : null },
  { label: 'Weersomslag', f: (d) => isBool(d.leefstijl.weer) ? d.leefstijl.weer : null },
];
const MIN_DAGEN = 3; // minimaal aantal dagen per groep voordat we een percentage tonen

// ---------- Hulpjes ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isGetal = (v) => typeof v === 'number' && !Number.isNaN(v);
const isBool = (v) => typeof v === 'boolean';
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ontleed = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const plusDagen = (s, n) => { const d = ontleed(s); d.setDate(d.getDate() + n); return iso(d); };
const vandaag = () => iso(new Date());
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const DAGEN_KORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const fmtLang = (s) => { const d = ontleed(s); return `${DAGEN[d.getDay()]} ${d.getDate()} ${MAANDEN[d.getMonth()]}`; };
const fmtKort = (s) => { const d = ontleed(s); return `${DAGEN_KORT[d.getDay()]} ${d.getDate()}-${d.getMonth() + 1}`; };
const fmtDatum = (s) => { const d = ontleed(s); return `${d.getDate()} ${MAANDEN[d.getMonth()]} ${d.getFullYear()}`; };
const hoofdletter = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const nl = (x, dec = 1) => x.toLocaleString('nl-NL', { maximumFractionDigits: dec, minimumFractionDigits: 0 });

function leegDag() { return { status: null, aanvallen: [], leefstijl: {}, notitie: '' }; }
function dag(s) { return db.dagen[s] || leegDag(); }
function dagRW(s) { return (db.dagen[s] ||= leegDag()); }
function isLeeg(d) {
  return !d.status && !d.aanvallen.length && !d.notitie && !Object.values(d.leefstijl).some((v) => v !== null && v !== undefined);
}

function duurMin(a) {
  if (!a.begin || !a.eind) return null;
  const [bh, bm] = a.begin.split(':').map(Number);
  const [eh, em] = a.eind.split(':').map(Number);
  let m = (eh * 60 + em) - (bh * 60 + bm);
  if (m <= 0) m += 1440; // eind vóór begin = over middernacht heen
  return m;
}
function fmtDuur(m) {
  if (m == null) return '';
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return `${r} min`;
  return r ? `${h} u ${r} min` : `${h} uur`;
}
const maxErnst = (d) => d.aanvallen.reduce((m, a) => Math.max(m, a.ernst || 0), 0);
function ernstKleur(e) {
  if (!e) return 'var(--pijn-onbekend)';
  const h = 48 - (e - 1) * (48 / 9);
  return `hsl(${h.toFixed(0)} 85% ${(62 - e * 1.4).toFixed(0)}%)`;
}

function toast(tekst) {
  const t = $('#toast');
  t.textContent = tekst;
  t.classList.add('zichtbaar');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('zichtbaar'), 2200);
}

// ---------- Staat ----------
const staat = {
  tab: 'dag',
  datum: vandaag(),
  maand: vandaag().slice(0, 7),
  van: plusDagen(vandaag(), -27),
  tot: vandaag(),
};

const TITELS = { dag: 'Dagboek', kalender: 'Kalender', inzichten: 'Inzichten', arts: 'Voor de arts' };

function render() {
  $('#titel').textContent = TITELS[staat.tab];
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('actief', b.dataset.tab === staat.tab));
  $('#view').innerHTML = { dag: viewDag, kalender: viewKalender, inzichten: viewInzichten, arts: viewArts }[staat.tab]();
}

// ---------- Dag ----------
function chips(lijst, gekozen, act, extra = '') {
  return `<div class="chips">${lijst.map((o) =>
    `<button class="chip ${gekozen.includes(o) ? 'aan' : ''}" data-act="${act}" data-v="${esc(o)}" ${extra}>${esc(o)}</button>`).join('')}</div>`;
}

function viewAanval(a, i) {
  const duur = duurMin(a);
  return `
  <section class="kaart aanval" data-i="${i}">
    <div class="kop">
      <h2>Aanval ${i + 1}</h2>
      <button class="tekstknop gevaar" data-act="del-aanval">Verwijder</button>
    </div>
    <div class="tijden">
      <label>Begin<input type="time" data-a="begin" value="${esc(a.begin)}"></label>
      <label>Eind<input type="time" data-a="eind" value="${esc(a.eind)}"></label>
      <div class="duur" data-duur>${duur != null ? fmtDuur(duur) : '<span class="zacht">duur volgt</span>'}</div>
    </div>
    <h3>Ernst <span class="zacht">1 = licht, 10 = ondraaglijk</span></h3>
    <div class="schaal">${Array.from({ length: 10 }, (_, k) => k + 1).map((e) =>
      `<button data-act="ernst" data-v="${e}" class="${a.ernst === e ? 'aan' : ''}" style="--c:${ernstKleur(e)}">${e}</button>`).join('')}</div>
    <h3>Waar</h3>
    ${chips(OPTIES.plek, a.plek, 'plek')}
    ${chips(OPTIES.kant, a.kant ? [a.kant] : [], 'kant', 'data-klein')}
    <h3>Hoe voelt het</h3>
    ${chips(OPTIES.soort, a.soort, 'soort')}
    <h3>Bijverschijnselen</h3>
    ${chips(OPTIES.symptomen, a.symptomen, 'symptomen')}
  </section>`;
}

function viewLeefstijl(d) {
  return LEEFSTIJL.map((v) => {
    const w = d.leefstijl[v.k];
    let invoer;
    if (v.type === 'getal') {
      invoer = `<div class="stapper" data-k="${v.k}">
        <button data-act="stap" data-d="-1" aria-label="minder">−</button>
        <button class="waarde ${isGetal(w) ? '' : 'leeg'}" data-act="wis" title="Tik om te wissen">${isGetal(w) ? `${nl(w)} <small>${v.eenheid}</small>` : '–'}</button>
        <button data-act="stap" data-d="1" aria-label="meer">+</button>
      </div>`;
    } else if (v.type === 'keuze') {
      invoer = `<div class="segment" data-k="${v.k}">${v.opties.map((o) =>
        `<button data-act="keuze" data-v="${o}" class="${w === o ? 'aan' : ''}">${o}</button>`).join('')}</div>`;
    } else {
      invoer = `<div class="segment" data-k="${v.k}">
        <button data-act="janee" data-v="1" class="${w === true ? 'aan' : ''}">Ja</button>
        <button data-act="janee" data-v="0" class="${w === false ? 'aan' : ''}">Nee</button>
      </div>`;
    }
    return `<div class="rij"><span class="label">${v.label}</span>${invoer}</div>`;
  }).join('');
}

function viewDag() {
  const s = staat.datum;
  const d = dag(s);
  const isVandaag = s === vandaag();
  const kop = isVandaag ? 'Vandaag' : s === plusDagen(vandaag(), -1) ? 'Gisteren' : fmtLang(s);
  return `
  <div class="datumbalk">
    <button class="rond" data-act="dag-terug" aria-label="vorige dag">‹</button>
    <label class="datumkiezer">
      <strong>${hoofdletter(kop)}</strong>
      <span>${isVandaag || kop === 'Gisteren' ? fmtLang(s) : 'kies een andere dag'}</span>
      <input type="date" data-act-input="kies-datum" value="${s}" max="${vandaag()}">
    </label>
    <button class="rond" data-act="dag-verder" aria-label="volgende dag" ${isVandaag ? 'disabled' : ''}>›</button>
  </div>

  <section class="kaart">
    <h2>Hoofdpijn gehad?</h2>
    <div class="keuze2">
      <button data-act="status" data-v="geen" class="geen ${d.status === 'geen' ? 'aan' : ''}">Nee, hoofdpijnvrij</button>
      <button data-act="status" data-v="ja" class="ja ${d.status === 'ja' ? 'aan' : ''}">Ja</button>
    </div>
  </section>

  ${d.status === 'ja' ? `
    ${d.aanvallen.map(viewAanval).join('')}
    <button class="breed" data-act="add-aanval">+ Nog een aanval op deze dag</button>
  ` : ''}

  <section class="kaart">
    <h2>Leefstijl</h2>
    <p class="zacht klein">Ook op hoofdpijnvrije dagen invullen: alleen dan zie je bij Inzichten het verschil.</p>
    ${viewLeefstijl(d)}
  </section>

  <section class="kaart">
    <h2>Notitie</h2>
    <textarea data-veld="notitie" rows="3" placeholder="Bijzonderheden, wat je deed, wat hielp…">${esc(d.notitie)}</textarea>
  </section>`;
}

function nieuweAanval(s) {
  let begin = '';
  if (s === vandaag()) { const n = new Date(); begin = `${pad(n.getHours())}:${pad(n.getMinutes())}`; }
  return { begin, eind: '', ernst: null, plek: [], kant: null, soort: [], symptomen: [] };
}

// ---------- Kalender ----------
function viewKalender() {
  const [y, m] = staat.maand.split('-').map(Number);
  const eerste = new Date(y, m - 1, 1);
  const aantal = new Date(y, m, 0).getDate();
  const offset = (eerste.getDay() + 6) % 7; // maandag eerst
  const nu = vandaag();
  let cellen = '';
  for (let i = 0; i < offset; i++) cellen += '<div></div>';
  let pijn = 0, vrij = 0, ernsten = [];
  for (let n = 1; n <= aantal; n++) {
    const s = `${y}-${pad(m)}-${pad(n)}`;
    const d = dag(s);
    let stijl = '', klasse = 'cel';
    if (d.status === 'ja') {
      pijn++;
      const e = maxErnst(d);
      if (e) ernsten.push(e);
      stijl = `style="--c:${ernstKleur(e)}"`;
      klasse += ' pijn';
    } else if (d.status === 'geen') { vrij++; klasse += ' vrij'; }
    if (s === nu) klasse += ' nu';
    if (s > nu) klasse += ' toekomst';
    cellen += `<button class="${klasse}" ${stijl} data-act="open-dag" data-v="${s}" ${s > nu ? 'disabled' : ''}>${n}${d.aanvallen.length > 1 ? '<i>•</i>' : ''}</button>`;
  }
  const gem = ernsten.length ? nl(ernsten.reduce((a, b) => a + b, 0) / ernsten.length) : '–';
  const volgendeKan = staat.maand < nu.slice(0, 7);
  return `
  <div class="datumbalk">
    <button class="rond" data-act="maand" data-d="-1" aria-label="vorige maand">‹</button>
    <div class="datumkiezer"><strong>${hoofdletter(MAANDEN[m - 1])} ${y}</strong></div>
    <button class="rond" data-act="maand" data-d="1" aria-label="volgende maand" ${volgendeKan ? '' : 'disabled'}>›</button>
  </div>
  <div class="tegels">
    <div class="tegel"><b>${pijn}</b><span>hoofdpijndagen</span></div>
    <div class="tegel"><b>${vrij}</b><span>hoofdpijnvrij</span></div>
    <div class="tegel"><b>${gem}</b><span>gem. ernst (max/dag)</span></div>
  </div>
  <section class="kaart">
    <div class="kalender">
      ${['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'].map((x) => `<div class="kolomkop">${x}</div>`).join('')}
      ${cellen}
    </div>
    <div class="legenda">
      <span><i class="vrij"></i>hoofdpijnvrij</span>
      <span><i style="background:${ernstKleur(2)}"></i>licht</span>
      <span><i style="background:${ernstKleur(6)}"></i>matig</span>
      <span><i style="background:${ernstKleur(10)}"></i>zwaar</span>
      <span><i class="leeg"></i>niet ingevuld</span>
    </div>
    <p class="zacht klein">Tik op een dag om hem in te vullen of aan te passen. Een stip betekent meer dan één aanval.</p>
  </section>`;
}

// ---------- Inzichten ----------
function viewInzichten() {
  const sleutels = Object.keys(db.dagen).filter((s) => db.dagen[s].status).sort();
  if (sleutels.length < 7) {
    return `<section class="kaart"><h2>Nog even geduld</h2>
      <p>Je hebt ${sleutels.length} ${sleutels.length === 1 ? 'dag' : 'dagen'} ingevuld. Vanaf een week of twee worden de patronen hier zinvol, en hoe langer je bijhoudt, hoe betrouwbaarder.</p></section>`;
  }

  // Hoofdpijndagen per maand, laatste 6 maanden
  const nu = ontleed(vandaag());
  const maanden = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(nu.getFullYear(), nu.getMonth() - i, 1);
    const prefix = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const ks = sleutels.filter((s) => s.startsWith(prefix));
    maanden.push({ label: MAANDEN[d.getMonth()].slice(0, 3), pijn: ks.filter((s) => db.dagen[s].status === 'ja').length, ingevuld: ks.length });
  }
  const maxPijn = Math.max(1, ...maanden.map((x) => x.pijn));
  const staven = maanden.map((x) => `
    <div class="staaf">
      <span class="getal">${x.ingevuld ? x.pijn : ''}</span>
      ${x.ingevuld ? `<div class="balk" style="height:${(x.pijn / maxPijn) * 100}%"></div>` : ''}
      <span class="lbl">${x.label}</span>
      <span class="sub">${x.ingevuld ? `${x.ingevuld} ingevuld` : '–'}</span>
    </div>`).join('');

  // Factoren
  const rijen = FACTOREN.map((fac) => {
    const met = [0, 0], zonder = [0, 0]; // [pijndagen, totaal]
    for (const s of sleutels) {
      const d = db.dagen[s];
      const v = fac.f(d, db.dagen[plusDagen(s, -1)]);
      if (v === null) continue;
      const g = v ? met : zonder;
      g[1]++;
      if (d.status === 'ja') g[0]++;
    }
    return { label: fac.label, met, zonder };
  });
  const genoeg = rijen.filter((r) => r.met[1] >= MIN_DAGEN && r.zonder[1] >= MIN_DAGEN)
    .map((r) => ({ ...r, pm: r.met[0] / r.met[1], pz: r.zonder[0] / r.zonder[1] }))
    .sort((a, b) => (b.pm - b.pz) - (a.pm - a.pz));
  const teWeinig = rijen.filter((r) => !(r.met[1] >= MIN_DAGEN && r.zonder[1] >= MIN_DAGEN));
  const pct = (x) => `${Math.round(x * 100)}%`;
  const factorHtml = genoeg.map((r) => `
    <div class="factor">
      <div class="factorkop"><span>${r.label}</span><b class="${r.pm - r.pz >= 0.15 ? 'opvallend' : ''}">${r.pm >= r.pz ? '+' : '−'}${Math.round(Math.abs(r.pm - r.pz) * 100)} %-punt</b></div>
      <div class="vergelijk"><span>met</span><div class="spoor"><div style="width:${pct(r.pm)}"></div></div><em>${pct(r.pm)} <small>van ${r.met[1]} d</small></em></div>
      <div class="vergelijk zonder"><span>zonder</span><div class="spoor"><div style="width:${pct(r.pz)}"></div></div><em>${pct(r.pz)} <small>van ${r.zonder[1]} d</small></em></div>
    </div>`).join('');

  // Meest voorkomende kenmerken
  const tel = (veld) => {
    const c = {};
    for (const s of sleutels) for (const a of db.dagen[s].aanvallen) for (const x of (Array.isArray(a[veld]) ? a[veld] : a[veld] ? [a[veld]] : [])) c[x] = (c[x] || 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} (${n}×)`).join(', ') || '–';
  };

  return `
  <section class="kaart">
    <h2>Hoofdpijndagen per maand</h2>
    <div class="staven">${staven}</div>
  </section>
  <section class="kaart">
    <h2>Mogelijke triggers</h2>
    <p class="zacht klein">Percentage dagen mét hoofdpijn wanneer de factor speelde, tegenover dagen zonder die factor. Een groot verschil is een aanwijzing, geen bewijs: het zegt iets over samenhang, niet over oorzaak.</p>
    ${factorHtml || '<p>Nog te weinig ingevulde leefstijldagen om te vergelijken.</p>'}
    ${teWeinig.length ? `<p class="zacht klein">Nog te weinig gegevens (minder dan ${MIN_DAGEN} dagen met of zonder): ${teWeinig.map((r) => r.label.toLowerCase()).join(', ')}.</p>` : ''}
  </section>
  <section class="kaart">
    <h2>Meest voorkomend</h2>
    <div class="rij"><span class="label">Plek</span><span>${tel('plek')}</span></div>
    <div class="rij"><span class="label">Kant</span><span>${tel('kant')}</span></div>
    <div class="rij"><span class="label">Soort pijn</span><span>${tel('soort')}</span></div>
    <div class="rij"><span class="label">Bijverschijnselen</span><span>${tel('symptomen')}</span></div>
  </section>`;
}

// ---------- Arts ----------
function dagenInPeriode() {
  const uit = [];
  for (let s = staat.van; s <= staat.tot; s = plusDagen(s, 1)) uit.push(s);
  return uit;
}

function samenvatting(dagen) {
  const ingevuld = dagen.filter((s) => dag(s).status);
  const pijn = ingevuld.filter((s) => dag(s).status === 'ja');
  const aanvallen = pijn.flatMap((s) => dag(s).aanvallen);
  const ernsten = aanvallen.map((a) => a.ernst).filter(Boolean);
  const duren = aanvallen.map(duurMin).filter((m) => m != null);
  return {
    periode: dagen.length,
    ingevuld: ingevuld.length,
    pijn: pijn.length,
    aanvallen: aanvallen.length,
    gemErnst: ernsten.length ? ernsten.reduce((a, b) => a + b, 0) / ernsten.length : null,
    maxErnst: ernsten.length ? Math.max(...ernsten) : null,
    gemDuur: duren.length ? duren.reduce((a, b) => a + b, 0) / duren.length : null,
    totaalUur: duren.reduce((a, b) => a + b, 0) / 60,
    zonderDuur: aanvallen.length - duren.length,
  };
}

function viewArts() {
  const dagen = dagenInPeriode();
  const sv = samenvatting(dagen);
  const ingevuld = dagen.filter((s) => dag(s).status || dag(s).notitie);
  const rijen = ingevuld.map((s) => {
    const d = dag(s);
    const l = d.leefstijl;
    const aanv = d.status === 'ja' && d.aanvallen.length
      ? d.aanvallen.map((a) => `<div class="aanvalregel">
          <b style="--c:${ernstKleur(a.ernst)}" class="ernstbol">${a.ernst ?? '?'}</b>
          ${a.begin ? `${a.begin}${a.eind ? `–${a.eind}` : ''}` : ''}${duurMin(a) != null ? ` (${fmtDuur(duurMin(a))})` : ''}
          ${[[...a.plek, a.kant].filter(Boolean).join(', '), a.soort.join(', '), a.symptomen.join(', ')].filter(Boolean).map(esc).join(' · ')}
        </div>`).join('')
      : d.status === 'ja' ? 'Hoofdpijn (geen details)' : d.status === 'geen' ? '<span class="zacht">Hoofdpijnvrij</span>' : '';
    const leef = [
      isGetal(l.slaap) ? `slaap ${nl(l.slaap)} u` : '',
      l.slaapkwaliteit ? `slaap ${l.slaapkwaliteit.toLowerCase()}` : '',
      l.stress ? `stress ${l.stress.toLowerCase()}` : '',
      l.drukte ? `drukte ${l.drukte.toLowerCase()}` : '',
      isGetal(l.cafeine) ? `cafeïne ${l.cafeine}` : '',
      isGetal(l.alcohol) && l.alcohol > 0 ? `alcohol ${l.alcohol}` : '',
      l.maaltijd ? 'maaltijd overgeslagen' : '',
      l.wandeling ? 'middagwandeling' : '',
      l.weer ? 'weersomslag' : '',
    ].filter(Boolean).join(', ');
    return `<tr class="${d.status === 'ja' ? 'pijnrij' : ''}">
      <td class="nowrap">${fmtKort(s)}</td>
      <td>${aanv}${d.notitie ? `<div class="notitie">${esc(d.notitie)}</div>` : ''}</td>
      <td class="klein">${esc(leef)}</td>
    </tr>`;
  }).join('');

  const laatsteBackup = db.meta.laatsteBackup ? fmtDatum(db.meta.laatsteBackup.slice(0, 10)) : 'nog nooit';

  return `
  <section class="kaart noprint">
    <h2>Periode</h2>
    <div class="periode">
      <label>Van<input type="date" data-act-input="van" value="${staat.van}" max="${staat.tot}"></label>
      <label>Tot en met<input type="date" data-act-input="tot" value="${staat.tot}" min="${staat.van}" max="${vandaag()}"></label>
    </div>
    <div class="chips">
      <button class="chip" data-act="preset" data-v="4w">Laatste 4 weken</button>
      <button class="chip" data-act="preset" data-v="maand">Deze maand</button>
      <button class="chip" data-act="preset" data-v="vorige">Vorige maand</button>
      <button class="chip" data-act="preset" data-v="3m">Laatste 3 maanden</button>
    </div>
  </section>

  <section class="kaart rapport">
    <h2 class="printtitel">Hoofdpijndagboek</h2>
    <p class="zacht">${fmtDatum(staat.van)} t/m ${fmtDatum(staat.tot)} (${sv.periode} dagen)</p>
    <div class="tegels">
      <div class="tegel"><b>${sv.pijn}</b><span>hoofdpijndagen</span></div>
      <div class="tegel"><b>${sv.aanvallen}</b><span>aanvallen</span></div>
      <div class="tegel"><b>${sv.gemErnst != null ? nl(sv.gemErnst) : '–'}</b><span>gem. ernst (max ${sv.maxErnst ?? '–'})</span></div>
      <div class="tegel"><b>${sv.gemDuur != null ? fmtDuur(Math.round(sv.gemDuur)) : '–'}</b><span>gem. duur</span></div>
    </div>
    <p class="klein">
      ${sv.ingevuld} van de ${sv.periode} dagen ingevuld${sv.ingevuld < sv.periode ? `; over ${sv.periode - sv.ingevuld} ${sv.periode - sv.ingevuld === 1 ? 'dag' : 'dagen'} is niets bekend` : ''}.
      Totaal ${nl(sv.totaalUur)} uur hoofdpijn${sv.zonderDuur ? ` (exclusief ${sv.zonderDuur} ${sv.zonderDuur === 1 ? 'aanval' : 'aanvallen'} zonder eindtijd)` : ''}.
      Ernst op een schaal van 1 tot 10.
    </p>
    ${rijen ? `<table class="tabel">
      <thead><tr><th>Dag</th><th>Hoofdpijn (ernst · tijd · plek · soort · bijverschijnselen)</th><th>Leefstijl</th></tr></thead>
      <tbody>${rijen}</tbody>
    </table>` : '<p>Geen ingevulde dagen in deze periode.</p>'}
  </section>

  <div class="knoppen noprint">
    <button class="breed primair" data-act="print">Afdrukken of bewaren als PDF</button>
    <button class="breed" data-act="csv">Deel als CSV (Excel)</button>
  </div>

  <section class="kaart noprint">
    <h2>Je gegevens</h2>
    <p class="klein">Alles staat alleen op dit toestel. Verwijder je de app van je beginscherm, dan ben je het kwijt. Maak daarom af en toe een back-up (bijv. naar Bestanden of iCloud Drive).</p>
    <p class="klein">Laatste back-up: <b>${laatsteBackup}</b> · ${Object.keys(db.dagen).length} dagen in je dagboek</p>
    <div class="knoppen">
      <button class="breed" data-act="backup">Back-up maken</button>
      <button class="breed" data-act="import">Back-up terugzetten</button>
    </div>
  </section>`;
}

function csv() {
  const kop = ['Datum', 'Hoofdpijn', 'Aanval', 'Begin', 'Eind', 'Duur (min)', 'Ernst', 'Plek', 'Kant', 'Soort', 'Bijverschijnselen',
    ...LEEFSTIJL.map((v) => v.label), 'Notitie'];
  const cel = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const leef = (l) => LEEFSTIJL.map((v) => {
    const w = l[v.k];
    if (isBool(w)) return w ? 'ja' : 'nee';
    if (isGetal(w)) return String(w).replace('.', ',');
    return w ?? '';
  });
  const regels = [kop];
  for (const s of dagenInPeriode()) {
    const d = dag(s);
    if (!d.status && !d.notitie) continue;
    const status = d.status === 'ja' ? 'ja' : d.status === 'geen' ? 'nee' : '';
    if (d.status === 'ja' && d.aanvallen.length) {
      d.aanvallen.forEach((a, i) => regels.push([s, status, i + 1, a.begin, a.eind, duurMin(a) ?? '', a.ernst ?? '',
        a.plek.join(', '), a.kant ?? '', a.soort.join(', '), a.symptomen.join(', '), ...leef(d.leefstijl), d.notitie]));
    } else {
      regels.push([s, status, '', '', '', '', '', '', '', '', '', ...leef(d.leefstijl), d.notitie]);
    }
  }
  return '﻿' + regels.map((r) => r.map(cel).join(';')).join('\r\n');
}

async function deelBestand(naam, inhoud, type) {
  const bestand = new File([inhoud], naam, { type });
  if (navigator.canShare?.({ files: [bestand] })) {
    try { await navigator.share({ files: [bestand], title: naam }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  const url = URL.createObjectURL(bestand);
  const a = document.createElement('a');
  a.href = url; a.download = naam;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

function preset(v) {
  const nu = ontleed(vandaag());
  if (v === '4w') { staat.van = plusDagen(vandaag(), -27); staat.tot = vandaag(); }
  if (v === 'maand') { staat.van = iso(new Date(nu.getFullYear(), nu.getMonth(), 1)); staat.tot = vandaag(); }
  if (v === 'vorige') { staat.van = iso(new Date(nu.getFullYear(), nu.getMonth() - 1, 1)); staat.tot = iso(new Date(nu.getFullYear(), nu.getMonth(), 0)); }
  if (v === '3m') { staat.van = iso(new Date(nu.getFullYear(), nu.getMonth() - 3, nu.getDate() + 1)); staat.tot = vandaag(); }
}

// ---------- Gebeurtenissen ----------
document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  staat.tab = b.dataset.tab;
  if (staat.tab === 'kalender') staat.maand = staat.datum.slice(0, 7);
  render();
  window.scrollTo(0, 0);
});

const view = $('#view');

view.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const act = b.dataset.act, v = b.dataset.v;
  const s = staat.datum;
  const iEl = b.closest('[data-i]');
  const a = iEl ? dagRW(s).aanvallen[+iEl.dataset.i] : null;
  const kEl = b.closest('[data-k]');
  const k = kEl?.dataset.k;
  let opslaan = true, scrollTop = false;

  switch (act) {
    case 'dag-terug': staat.datum = plusDagen(s, -1); opslaan = false; scrollTop = true; break;
    case 'dag-verder': if (s < vandaag()) staat.datum = plusDagen(s, 1); opslaan = false; scrollTop = true; break;
    case 'status': {
      const d = dagRW(s);
      if (v === 'geen' && d.aanvallen.some((x) => x.ernst || x.begin || x.plek.length)) {
        if (!confirm('Deze dag als hoofdpijnvrij markeren? De ingevulde aanvallen worden dan verwijderd.')) return;
      }
      // Nogmaals op "ja" tikken doet niets (anders ben je zo je aanvallen kwijt); "ja" vervalt door de laatste aanval te verwijderen.
      if (d.status === v) { if (v === 'ja') return; d.status = null; break; }
      d.status = v;
      if (v === 'ja' && !d.aanvallen.length) d.aanvallen.push(nieuweAanval(s));
      if (v === 'geen') d.aanvallen = [];
      break;
    }
    case 'add-aanval': dagRW(s).aanvallen.push(nieuweAanval(s)); break;
    case 'del-aanval': {
      if (!confirm('Deze aanval verwijderen?')) return;
      const d = dagRW(s);
      d.aanvallen.splice(+iEl.dataset.i, 1);
      if (!d.aanvallen.length) d.status = null;
      break;
    }
    case 'ernst': a.ernst = a.ernst === +v ? null : +v; break;
    case 'plek': case 'soort': case 'symptomen': {
      const lijst = a[act];
      const j = lijst.indexOf(v);
      if (j >= 0) lijst.splice(j, 1); else lijst.push(v);
      break;
    }
    case 'kant': a.kant = a.kant === v ? null : v; break;
    case 'stap': {
      const def = LEEFSTIJL.find((x) => x.k === k);
      const l = dagRW(s).leefstijl;
      if (!isGetal(l[k])) l[k] = def.start;
      else l[k] = Math.min(def.max, Math.max(def.min, l[k] + def.stap * +b.dataset.d));
      break;
    }
    case 'wis': {
      const l = dagRW(s).leefstijl;
      if (isGetal(l[k])) delete l[k];
      else l[k] = LEEFSTIJL.find((x) => x.k === k).start;
      break;
    }
    case 'keuze': { const l = dagRW(s).leefstijl; l[k] = l[k] === v ? undefined : v; if (l[k] === undefined) delete l[k]; break; }
    case 'janee': { const l = dagRW(s).leefstijl; const w = v === '1'; if (l[k] === w) delete l[k]; else l[k] = w; break; }
    case 'open-dag': staat.datum = v; staat.tab = 'dag'; opslaan = false; scrollTop = true; break;
    case 'maand': {
      const [y, m] = staat.maand.split('-').map(Number);
      const d = new Date(y, m - 1 + +b.dataset.d, 1);
      staat.maand = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      opslaan = false; break;
    }
    case 'preset': preset(v); opslaan = false; break;
    case 'print': window.print(); return;
    case 'csv': await deelBestand(`hoofdpijndagboek_${staat.van}_${staat.tot}.csv`, csv(), 'text/csv'); return;
    case 'backup': {
      const ok = await deelBestand(`hoofdpijndagboek_backup_${vandaag()}.json`, JSON.stringify(db, null, 1), 'application/json');
      if (ok) { db.meta.laatsteBackup = new Date().toISOString(); bewaar(); render(); toast('Back-up gemaakt'); }
      return;
    }
    case 'import': $('#importbestand').click(); return;
    default: return;
  }
  if (opslaan) bewaar();
  render();
  if (scrollTop) window.scrollTo(0, 0);
});

// Tijden, notitie en datumvelden: opslaan zonder de hele weergave opnieuw te tekenen (houdt focus en toetsenbord vast).
view.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.a) {
    const iEl = el.closest('[data-i]');
    const a = dagRW(staat.datum).aanvallen[+iEl.dataset.i];
    a[el.dataset.a] = el.value;
    bewaar();
    const m = duurMin(a);
    $('[data-duur]', iEl).innerHTML = m != null ? fmtDuur(m) : '<span class="zacht">duur volgt</span>';
  } else if (el.dataset.veld === 'notitie') {
    dagRW(staat.datum).notitie = el.value;
    bewaar();
  }
});

view.addEventListener('change', (e) => {
  const el = e.target;
  const act = el.dataset.actInput;
  if (!act || !el.value) return;
  if (act === 'kies-datum') { staat.datum = el.value > vandaag() ? vandaag() : el.value; window.scrollTo(0, 0); }
  if (act === 'van') { staat.van = el.value; if (staat.van > staat.tot) staat.tot = staat.van; }
  if (act === 'tot') { staat.tot = el.value; if (staat.tot < staat.van) staat.van = staat.tot; }
  render();
});

$('#importbestand').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    if (!data || typeof data.dagen !== 'object') throw new Error('geen dagboek');
    const nieuw = Object.keys(data.dagen).length, huidig = Object.keys(db.dagen).length;
    if (!confirm(`Je huidige dagboek (${huidig} dagen) vervangen door deze back-up (${nieuw} dagen)?`)) return;
    db = { versie: 1, meta: {}, ...data };
    bewaar();
    render();
    toast('Back-up teruggezet');
  } catch {
    alert('Dit bestand is geen geldige back-up van het hoofdpijndagboek.');
  }
});

// Als de app de volgende dag weer uit de achtergrond komt, springen naar de nieuwe dag.
let laatstGezien = vandaag();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const nu = vandaag();
  if (nu !== laatstGezien) {
    if (staat.datum === laatstGezien) staat.datum = nu;
    laatstGezien = nu;
    render();
  }
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js');
}

render();
