(() => {
"use strict";
// ───────────────────────── état ─────────────────────────
const S = {
  db:null, catalog:null, company:null, quotes:{}, demandes:[], keyHint:"", defaultLogo:null,
  loaded:{catalog:false, company:false, quotes:false},
  dbState:"loading",           // loading | ok | none | slow | error
  view:"nouveau", ed:null, edKey:null, busy:false,
  catEdit:null, confirm:null,
};
const STATUS = {draft:"Brouillon", sent:"Envoyé", accepted:"Accepté", rejected:"Refusé", expired:"Expiré"};
const view = document.getElementById("view");
const CSRF = document.querySelector('meta[name="csrf"]')?.content || "";
async function api(action, body){
  const init = body === undefined ? {headers:{accept:"application/json"}}
    : {method:"POST", headers:{"content-type":"application/json", "x-csrf":CSRF}, body:JSON.stringify(body)};
  let res;
  try { res = await fetch("devis.php?api=" + action, init); } catch { throw new Error("Connexion impossible. Vérifiez le réseau puis réessayez."); }
  if (res.status === 401) { location.href = "./"; throw new Error("Session expirée : reconnectez-vous."); }
  const r = await res.json().catch(() => ({error:"Réponse illisible du serveur."}));
  if (!res.ok) throw new Error(r.error || "Erreur du serveur. Réessayez.");
  return r;
}
const demandeById = id => S.demandes.find(d => String(d.id) === String(id));

// ───────────────────────── utilitaires ─────────────────────────
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = v => { const n = parseFloat(String(v ?? "").replace(/\s/g,"").replace(",", ".")); return isFinite(n) ? n : 0; };
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
function money(n, cur = true){
  const neg = n < 0; n = Math.abs(r2(n));
  const [i, d] = n.toFixed(2).split(".");
  return (neg ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + "," + d + (cur ? " €" : "");
}
const qty = n => { const v = r2(num(n)); return Number.isInteger(v) ? String(v) : String(v).replace(".", ","); };
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString();
const dfr = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("fr-FR"); };
const addDays = (iso, n) => { const d = new Date(iso); d.setDate(d.getDate() + n); return d.toISOString(); };
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const clientName = c => c ? [c.firstName, c.lastName].filter(Boolean).join(" ") : "";
function toast(msg, ms = 3200){ const t = document.getElementById("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, ms); }
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function totals(q){
  let sub = 0; const byRate = {};
  for (const l of q.lines || []) { const t = r2(num(l.quantity) * num(l.unitPriceHT)); sub += t; const k = String(num(l.tvaRate)); byRate[k] = (byRate[k] || 0) + t; }
  sub = r2(sub);
  let disc = 0; const dv = num(q.discountValue);
  if (dv > 0) disc = q.discountType === "amount" ? dv : sub * dv / 100;
  disc = r2(Math.min(Math.max(disc, 0), sub));
  const ht = r2(sub - disc), f = sub > 0 ? ht / sub : 0;
  const tvaLines = Object.entries(byRate).map(([r, b]) => ({rate:num(r), base:r2(b * f), amount:r2(b * f * num(r) / 100)})).sort((a, b) => b.rate - a.rate);
  const tva = r2(tvaLines.reduce((s, x) => s + x.amount, 0));
  return {sub, disc, ht, tva, ttc:r2(ht + tva), tvaLines};
}
function schedule(ttc){
  const txt = S.company?.paymentConditions || "";
  return txt.split(/\n+/).map(s => s.trim()).filter(Boolean).map(line => {
    const m = line.match(/(\d+(?:[.,]\d+)?)\s*%/);
    return {line, amount: m ? r2(ttc * num(m[1]) / 100) : null};
  });
}
function nextNumber(){
  const y = new Date().getFullYear(), p = `DV-${y}-`;
  let max = 0;
  for (const q of Object.values(S.quotes)) if (q.number?.startsWith(p)) max = Math.max(max, parseInt(q.number.slice(p.length), 10) || 0);
  return p + String(max + 1).padStart(4, "0");
}
const products = () => S.catalog?.products || [];
const productByRef = ref => products().find(p => p.ref === ref);
const catName = slug => S.catalog?.categories?.find(c => c.slug === slug)?.name || "Sans catégorie";

// ───────────────────────── routage ─────────────────────────
function route(){
  const h = (location.hash || "").slice(1);
  const v = /^(nouveau|devis|catalogue|parametres)$/.test(h) || /^devis-[a-z0-9]+$/.test(h) ? h : "nouveau";
  if (v !== S.view) { S.catEdit = null; S.confirm = null; }
  S.view = v;
  for (const a of document.querySelectorAll("#nav a")) {
    const cur = a.dataset.v === v || (a.dataset.v === "devis" && v.startsWith("devis-"));
    cur ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current");
    a.classList.toggle("on", cur);
  }
  render(true);
}
window.addEventListener("hashchange", route);

// ───────────────────────── éditeur de devis ─────────────────────────
function blankQuote(){
  return {id:null, number:null, status:"draft", demandeId:null,
    client:{firstName:"", lastName:"", phone:"", email:"", address:"", postalCode:"", city:""},
    title:"", notes:"", transcript:"", lines:[], discountType:"percent", discountValue:0,
    validityDays:S.company?.defaultValidityDays || 30};
}
function ensureEditor(){
  if (S.view === "nouveau") {
    if (S.edKey !== "new") { S.ed = lsGet("dv-draft") || blankQuote(); S.edKey = "new"; }
    return S.ed;
  }
  const id = S.view.slice(6);
  if (S.edKey !== id) {
    const q = S.quotes[id]; if (!q) return null;
    S.ed = structuredClone(q); S.ed.id = id; S.edKey = id; S.ed.dirty = false;
  }
  return S.ed;
}
function saveDraftLocal(){ if (S.edKey === "new") lsSet("dv-draft", S.ed); else if (S.ed) S.ed.dirty = true; }

function lineFromProduct(p, quantity = 1){
  return {ref:p.ref, designation:p.name, description:p.description || "", quantity, unit:p.unit || "pièce", unitPriceHT:p.priceHT, tvaRate:p.tvaRate ?? S.company?.defaultTvaRate ?? 20};
}

function editorHTML(q){
  const isNew = !q.id, t = totals(q);
  const c = q.client || {};
  const sched = schedule(t.ttc);
  return `
  <div class="head">
    <div>
      ${isNew ? `<h1>Nouveau devis</h1><p class="muted">Dictez le chantier, Claude prépare les lignes à partir de votre catalogue. Vous vérifiez, puis vous enregistrez.</p>${q.demandeId && demandeById(q.demandeId)?.message ? `<p class="dv-msg"><b>Message du client :</b> ${esc(demandeById(q.demandeId).message)}</p>` : ""}`
              : `<div class="label">Devis</div><h1 class="mono">${esc(q.number)}</h1><p>Créé le ${dfr(q.createdAt)} · valable jusqu'au ${dfr(addDays(q.createdAt, num(q.validityDays)))}</p>`}
    </div>
    <div class="row">${q.demandeId ? `<a class="btn" href="./?id=${encodeURIComponent(q.demandeId)}">Fiche du client ›</a>` : ""}${isNew ? "" : `<a class="btn" href="#devis">← Mes devis</a>`}</div>
  </div>

  ${isNew ? `
  <section class="panel" aria-labelledby="h-dict">
    <div class="panel-head"><h2 id="h-dict">Dictée</h2>${SR ? "" : `<span class="small muted">Dictez avec le micro du clavier : Windows <span class="mono">Win + H</span> · Mac <span class="mono">Fn Fn</span> · téléphone : touche micro</span>`}</div>
    <textarea id="transcript" class="dict" placeholder="Exemple : « Devis pour Monsieur et Madame Le Goff, 12 rue du Port à Vannes, 56000, téléphone 06 12 34 56 78. Piscine Victoria avec terrassement, évacuation des terres, margelles travertin, une pompe à chaleur et une bâche à barres. Remise de 5 %. »">${esc(q.transcript)}</textarea>
    <div class="row">
      ${SR ? `<button class="btn ${rec ? "rec" : ""}" data-act="mic" id="mic-btn">${rec ? "Arrêter la dictée" : "Dicter au micro"}</button>` : ""}
      <button class="btn primary" data-act="analyze" ${S.busy ? "disabled" : ""}>${S.busy ? '<span class="spin"></span> Claude analyse…' : "Analyser avec Claude"}</button>
      <button class="btn" data-act="example">Charger un exemple</button>
      <span class="spacer"></span>
      <button class="btn ghost" data-act="reset">Tout effacer</button>
    </div>
    <div id="ai-msg"></div>
  </section>` : ""}

  <div class="cols">
    <div style="display:flex;flex-direction:column;gap:22px;min-width:0">
      <section class="panel" aria-labelledby="h-cli">
        <div class="panel-head"><h2 id="h-cli">Client</h2>
          <label class="f" style="flex:1;min-width:220px;max-width:420px">Demande du CRM
          <select id="ed-demandeId">
            <option value="">Nouveau client (fiche créée à l'enregistrement)</option>
            ${S.demandes.map(d => `<option value="${d.id}" ${String(q.demandeId) === String(d.id) ? "selected" : ""}>${esc(d.nom)}${d.commune ? " · " + esc(d.commune) : ""} · ${esc(d.ref)}</option>`).join("")}
          </select></label>
        </div>
        <div class="grid2">
          <label class="f">Prénom<input id="c-firstName" data-c="firstName" value="${esc(c.firstName)}"></label>
          <label class="f">Nom<input id="c-lastName" data-c="lastName" value="${esc(c.lastName)}"></label>
          <label class="f">Téléphone<input id="c-phone" data-c="phone" inputmode="tel" value="${esc(c.phone)}"></label>
          <label class="f">E-mail<input id="c-email" data-c="email" type="email" value="${esc(c.email)}"></label>
        </div>
        <label class="f">Adresse du chantier<input id="c-address" data-c="address" value="${esc(c.address)}"></label>
        <div class="grid3">
          <label class="f">Code postal<input id="c-postalCode" data-c="postalCode" inputmode="numeric" value="${esc(c.postalCode)}"></label>
          <label class="f" style="grid-column:span 2">Ville<input id="c-city" data-c="city" value="${esc(c.city)}"></label>
        </div>
      </section>

      <section class="panel" aria-labelledby="h-lines">
        <div class="panel-head"><h2 id="h-lines">Prestations</h2><span class="small muted">${q.lines.length} ligne${q.lines.length > 1 ? "s" : ""}</span></div>
        <label class="f">Objet du devis<input id="ed-title" value="${esc(q.title)}" placeholder="Ex. Piscine coque Victoria posée"></label>
        ${q.lines.length ? `<div class="lines">${q.lines.map((l, i) => `
          <div class="line" data-i="${i}">
            <div class="l-top"><input id="l${i}-designation" data-f="designation" value="${esc(l.designation)}" aria-label="Désignation">${l.flag ? `<span class="tag ${l.flag === "hors catalogue" ? "warn" : ""}" title="${l.flag === "suggérée" ? "Ajoutée par Claude car liée au modèle dicté : à confirmer" : "Pas trouvée dans le catalogue : vérifiez le prix"}">${esc(l.flag)}</span>` : ""}<button class="btn ghost" data-act="del-line" data-i="${i}" aria-label="Supprimer la ligne">✕</button></div>
            <textarea id="l${i}-description" class="desc" data-f="description" rows="2" aria-label="Description">${esc(l.description)}</textarea>
            <div class="l-nums">
              <label class="f">Qté<input id="l${i}-quantity" class="num" data-f="quantity" inputmode="decimal" value="${esc(qty(l.quantity))}"></label>
              <label class="f">Unité<input id="l${i}-unit" data-f="unit" value="${esc(l.unit)}"></label>
              <label class="f">PU HT (€)<input id="l${i}-unitPriceHT" class="num" data-f="unitPriceHT" inputmode="decimal" value="${esc(String(r2(num(l.unitPriceHT))).replace(".", ","))}"></label>
              <label class="f">TVA<select id="l${i}-tvaRate" data-f="tvaRate">${[20, 10, 5.5, 0].map(r => `<option value="${r}" ${num(l.tvaRate) === r ? "selected" : ""}>${String(r).replace(".", ",")} %</option>`).join("")}</select></label>
              <div class="f l-tot"><span>Total HT</span><b class="num" data-tot="${i}">${money(num(l.quantity) * num(l.unitPriceHT))}</b></div>
            </div>
          </div>`).join("")}</div>` : `<div class="empty"><b>Aucune prestation</b>Analysez une dictée, ou ajoutez des lignes depuis le catalogue ci-dessous.</div>`}
        <div class="row">
          <input id="cat-search" placeholder="Ajouter depuis le catalogue : Victoria, margelle, PAC…" style="flex:1;min-width:200px" autocomplete="off">
          <button class="btn" data-act="free-line">+ Ligne libre</button>
        </div>
        <div id="cat-results"></div>
      </section>

      <section class="panel" aria-labelledby="h-notes">
        <h2 id="h-notes">Notes sur le devis</h2>
        <textarea id="ed-notes" rows="3" placeholder="Accès chantier, délais, options discutées…">${esc(q.notes)}</textarea>
      </section>
    </div>

    <aside class="panel" style="position:sticky;top:74px" aria-labelledby="h-tot">
      <h2 id="h-tot">Montant</h2>
      ${isNew ? "" : `<label class="f">Statut<select id="ed-status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${q.status === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>`}
      <div class="grid2" style="grid-template-columns:minmax(0,1fr) 92px">
        <label class="f">Remise<input id="ed-discountValue" inputmode="decimal" value="${esc(String(num(q.discountValue)).replace(".", ","))}"></label>
        <label class="f">&nbsp;<select id="ed-discountType"><option value="percent" ${q.discountType !== "amount" ? "selected" : ""}>%</option><option value="amount" ${q.discountType === "amount" ? "selected" : ""}>€ HT</option></select></label>
      </div>
      <label class="f">Validité (jours)<input id="ed-validityDays" inputmode="numeric" value="${esc(q.validityDays)}"></label>
      <div class="totals" id="totals">${totalsHTML(t)}</div>
      <div class="sched" id="sched">${schedHTML(sched)}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn primary" data-act="save" ${S.dbState !== "ok" ? "disabled" : ""}>${isNew ? "Enregistrer le devis" : "Enregistrer les modifications"}</button>
        ${isNew ? "" : `<button class="btn" data-act="pdf">Télécharger le PDF</button>`}
        ${isNew ? "" : (S.confirm === "del-quote"
          ? `<div class="confirm">Supprimer ce devis ? <button class="btn danger" data-act="del-quote-yes">Supprimer</button><button class="btn" data-act="cancel-confirm">Annuler</button></div>`
          : `<button class="btn danger" data-act="del-quote">Supprimer le devis</button>`)}
      </div>
      ${S.dbState !== "ok" ? `<div class="note warn">Vos données ne sont pas joignables pour l'instant : l'enregistrement est désactivé.</div>` : ""}
    </aside>
  </div>`;
}
function totalsHTML(t){
  return `<div><span class="muted">Sous-total HT</span><span class="num">${money(t.sub)}</span></div>
    ${t.disc ? `<div><span class="muted">Remise</span><span class="num">−${money(t.disc)}</span></div><div><span class="muted">Total HT</span><span class="num">${money(t.ht)}</span></div>` : ""}
    ${t.tvaLines.map(x => `<div><span class="muted">TVA ${String(x.rate).replace(".", ",")} %</span><span class="num">${money(x.amount)}</span></div>`).join("")}
    <div class="big"><span>TTC</span><span>${money(t.ttc)}</span></div>`;
}
function schedHTML(s){
  if (!s.length) return `<span class="muted small">Échéancier : renseignez les conditions de paiement dans Entreprise.</span>`;
  return `<span class="label">Échéancier</span>` + s.map(x => `<div><span>${esc(x.line)}</span>${x.amount != null ? `<span class="num">${money(x.amount)}</span>` : ""}</div>`).join("");
}
function refreshTotals(){
  const q = S.ed, t = totals(q);
  const el = document.getElementById("totals"); if (el) el.innerHTML = totalsHTML(t);
  const sc = document.getElementById("sched"); if (sc) sc.innerHTML = schedHTML(schedule(t.ttc));
  q.lines.forEach((l, i) => { const c = view.querySelector(`[data-tot="${i}"]`); if (c) c.textContent = money(num(l.quantity) * num(l.unitPriceHT)); });
}
function searchCatalog(qs){
  const box = document.getElementById("cat-results"); if (!box) return;
  const terms = norm(qs).split(/\s+/).filter(Boolean);
  if (!terms.length) { box.innerHTML = ""; return; }
  const hits = products().filter(p => p.active !== false).map(p => {
    const hay = norm(`${p.ref} ${p.name} ${p.keywords} ${catName(p.cat)}`);
    return {p, ok: terms.every(t => hay.includes(t))};
  }).filter(x => x.ok).slice(0, 8);
  box.innerHTML = hits.length ? `<div class="results">${hits.map(({p}) => `
    <button data-act="add-prod" data-ref="${esc(p.ref)}"><span class="r-name">${esc(p.name)}</span><span class="r-price num">${money(p.priceHT)} <span class="muted small">/ ${esc(p.unit)}</span></span><span class="r-meta">${esc(catName(p.cat))} · <span class="mono">${esc(p.ref)}</span></span></button>`).join("")}</div>`
    : `<div class="muted small">Rien dans le catalogue pour « ${esc(qs)} ». Ajoutez une ligne libre.</div>`;
}

// ───────────────────────── dictée au micro ─────────────────────────
const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
let rec = null;
function toggleMic(){
  if (!SR) return;
  if (rec) { rec.stop(); return; }
  const ta0 = document.getElementById("transcript");
  const base = ta0 && ta0.value.trim() ? ta0.value.trimEnd() + " " : "";
  let finalText = "";
  rec = new SR(); rec.lang = "fr-FR"; rec.continuous = true; rec.interimResults = true;
  rec.onresult = e => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i]?.[0]?.transcript ?? "";
      if (e.results[i].isFinal) finalText += t; else interim += t;
    }
    const ta = document.getElementById("transcript");
    const v = (base + finalText + interim).replace(/\s+/g, " ");
    if (ta) ta.value = v;
    if (S.ed) { S.ed.transcript = base + finalText; saveDraftLocal(); }
  };
  rec.onerror = e => toast(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Micro refusé : autorisez-le dans les réglages du navigateur." : e.error === "no-speech" ? "Aucune parole détectée." : "Dictée interrompue. Relancez le micro.");
  rec.onend = () => { rec = null; render(true); };
  try { rec.start(); } catch { rec = null; toast("Le micro n'a pas pu démarrer."); }
  render(true);
}

// ───────────────────────── analyse par Claude ─────────────────────────
const EXAMPLE = "Devis pour Monsieur et Madame Le Goff, Yannick et Sophie, 12 rue du Port à Vannes, 56000, téléphone 06 12 34 56 78. Ils veulent une piscine Victoria avec le terrassement et l'évacuation des terres, margelles travertin, une pompe à chaleur et une bâche à barres posée. Je leur fais 5 % de remise.";
async function analyze(){
  if (rec) rec.stop();
  const ta = document.getElementById("transcript");
  const text = (ta?.value || "").trim();
  const msg = m => { const el = document.getElementById("ai-msg"); if (el) el.innerHTML = m; };
  if (!text) { msg(`<div class="note warn">Dictez ou tapez d'abord la description du chantier.</div>`); return; }
  if (!products().length) { msg(`<div class="note bad">Le catalogue est vide : Claude n'a rien à rapprocher.</div>`); return; }
  S.ed.transcript = text; saveDraftLocal();
  S.busy = true; render(true);
  try {
    const r = await api("analyze", {transcript:text});
    applyAnalysis(r || {});
    S.busy = false; render(true);
    const sug = S.ed.lines.filter(l => l.flag === "suggérée").length, off = S.ed.lines.filter(l => l.flag === "hors catalogue").length;
    msg(`<div class="note ok">Analyse terminée : ${(r.lines || []).length} ligne(s) ajoutée(s)${sug ? `, dont ${sug} suggérée(s) à confirmer` : ""}${off ? `, ${off} hors catalogue (prix à vérifier)` : ""}. Les prix viennent de votre catalogue.</div>`);
  } catch (e) {
    S.busy = false; render(true);
    msg(`<div class="note bad">${esc(e?.message || "L'analyse a échoué. Réessayez.")}</div>`);
  }
}
function applyAnalysis(r){
  const q = S.ed;
  q.transcript = document.getElementById("transcript")?.value || q.transcript;
  const c = r.client || {};
  for (const k of ["firstName", "lastName", "address", "postalCode", "city", "phone", "email"]) if (c[k] && String(c[k]).trim()) q.client[k] = String(c[k]).trim();
  if (!q.demandeId && q.client.lastName) {
    const ln = norm(q.client.lastName);
    const hit = S.demandes.find(d => norm(d.nom).split(/\s+/).includes(ln) && (!q.client.city || !d.commune || norm(d.commune) === norm(q.client.city)));
    if (hit) q.demandeId = hit.id;
  }
  if (r.title && !q.title) q.title = String(r.title);
  if (r.notes) q.notes = [q.notes, String(r.notes)].filter(Boolean).join("\n");
  if (r.discount && num(r.discount.value) > 0) { q.discountType = r.discount.type === "amount" ? "amount" : "percent"; q.discountValue = num(r.discount.value); }
  for (const l of r.lines || []) {
    const p = l.ref ? productByRef(String(l.ref).trim()) : null;
    const quantity = num(l.quantity) > 0 ? num(l.quantity) : 1;
    if (p) q.lines.push({...lineFromProduct(p, quantity), flag: l.source === "suggérée" ? "suggérée" : ""});
    else q.lines.push({ref:"", designation:String(l.designation || "Prestation"), description:"", quantity, unit:String(l.unit || "pièce"), unitPriceHT:num(l.unitPriceHT), tvaRate:S.company?.defaultTvaRate ?? 20, flag:"hors catalogue"});
  }
  saveDraftLocal();
}

// ───────────────────────── enregistrement ─────────────────────────
async function saveQuote(){
  if (S.busy) return;
  const q = S.ed;
  if (!q.lines.length) { toast("Ajoutez au moins une prestation avant d'enregistrer."); return; }
  S.busy = true;
  try {
    const isNew = !q.id;
    const {quote} = await api("save", {quote:{...q, id:q.id ? Number(q.id) : 0}});
    S.busy = false;
    await loadAll();
    if (isNew) { lsSet("dv-draft", null); S.edKey = null; toast(`Devis ${quote.number} enregistré.`); location.hash = "devis-" + quote.id; }
    else { S.edKey = null; toast("Modifications enregistrées."); render(true); }
  } catch (e) { S.busy = false; toast(e.message); }
}

// ───────────────────────── PDF ─────────────────────────
function hexRGB(h){ const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function makePDF(q){
  const {jsPDF} = window.jspdf;
  const co = S.company || {}, c = q.client || {}, t = totals(q);
  const doc = new jsPDF({unit:"mm", format:"a4"});
  const W = 210, M = 15, R = W - M, BLUE = hexRGB("#1b2a78"), INK = hexRGB("#0c1222"), GREY = [90, 100, 120];
  let y = M;
  const set = (size, style = "normal", col = INK) => { doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(...col); };
  // en-tête entreprise
  let x0 = M, logoH = 0;
  const logo = co.logo ? {src:co.logo, ratio:co.logoRatio || 1} : S.defaultLogo;
  if (logo) { try { const w = 26, h = Math.min(26, w * logo.ratio); doc.addImage(logo.src, logo.src.startsWith("data:image/png") ? "PNG" : "JPEG", M, y, h / logo.ratio, h); x0 = M + h / logo.ratio + 5; logoH = h; } catch {} }
  set(13, "bold"); doc.text(co.companyName || "Votre entreprise", x0, y + 5);
  set(8.5, "normal", GREY);
  const coLines = [co.ownerName, co.address, [co.postalCode, co.city].filter(Boolean).join(" "), co.phone && "Tél. " + co.phone, co.email, co.siret ? "SIRET " + co.siret : co.siren && "SIREN " + co.siren].filter(Boolean);
  coLines.forEach((l, i) => doc.text(String(l), x0, y + 10 + i * 4));
  set(22, "bold", BLUE); doc.text("DEVIS", R, y + 7, {align:"right"});
  set(9, "normal"); doc.text(`N° ${q.number}`, R, y + 13, {align:"right"});
  doc.text(`Date : ${dfr(q.createdAt)}`, R, y + 18, {align:"right"});
  doc.text(`Valable jusqu'au : ${dfr(addDays(q.createdAt, num(q.validityDays)))}`, R, y + 23, {align:"right"});
  y = Math.max(y + 12 + coLines.length * 4, y + logoH, y + 26) + 6;
  // client
  const cx = 112, cw = R - cx;
  const cLines = [clientName(c), c.address, [c.postalCode, c.city].filter(Boolean).join(" "), c.phone, c.email].filter(Boolean);
  const ch = 9 + Math.max(1, cLines.length) * 4.5;
  doc.setDrawColor(...BLUE); doc.setLineWidth(0.3); doc.rect(cx, y, cw, ch);
  set(7.5, "bold", BLUE); doc.text("CLIENT", cx + 4, y + 5);
  set(9.5, "normal"); cLines.forEach((l, i) => { if (i === 0) doc.setFont("helvetica", "bold"); else doc.setFont("helvetica", "normal"); doc.text(String(l), cx + 4, y + 10 + i * 4.5); });
  if (q.title) { set(7.5, "bold", BLUE); doc.text("OBJET", M, y + 5); set(10.5, "bold"); doc.text(doc.splitTextToSize(q.title, cx - M - 6), M, y + 10.5); }
  y += ch + 7;
  // lignes
  doc.autoTable({
    startY:y, margin:{left:M, right:M, bottom:18},
    head:[["Désignation", "Qté", "Unité", "PU HT", "TVA", "Total HT"]],
    body:q.lines.map(l => [{content:l.designation + (l.description ? "\n" + l.description : "")}, qty(l.quantity), l.unit, money(num(l.unitPriceHT)), String(num(l.tvaRate)).replace(".", ",") + " %", money(num(l.quantity) * num(l.unitPriceHT))]),
    styles:{font:"helvetica", fontSize:8.5, cellPadding:2.2, textColor:INK, lineColor:[215, 222, 222], lineWidth:0.2, valign:"top"},
    headStyles:{fillColor:BLUE, textColor:255, fontStyle:"bold", fontSize:8},
    columnStyles:{0:{cellWidth:"auto"}, 1:{halign:"right", cellWidth:13}, 2:{cellWidth:16}, 3:{halign:"right", cellWidth:25}, 4:{halign:"right", cellWidth:14}, 5:{halign:"right", cellWidth:27}},
    didParseCell:d => { if (d.section === "body" && d.column.index === 0) d.cell.styles.fontStyle = "normal"; },
  });
  y = doc.lastAutoTable.finalY + 6;
  const room = h => { if (y + h > 279) { doc.addPage(); y = M; } };
  // totaux
  const rows = [["Sous-total HT", money(t.sub)]];
  if (t.disc) rows.push([q.discountType === "percent" ? `Remise ${String(num(q.discountValue)).replace(".", ",")} %` : "Remise", "-" + money(t.disc)], ["Total HT", money(t.ht)]);
  t.tvaLines.forEach(x => rows.push([`TVA ${String(x.rate).replace(".", ",")} %`, money(x.amount)]));
  room(rows.length * 5.5 + 12);
  const tx = 120;
  set(9.5); rows.forEach(([a, b]) => { doc.text(a, tx, y); doc.text(b, R, y, {align:"right"}); y += 5.5; });
  doc.setFillColor(...BLUE); doc.rect(tx - 3, y - 3.5, R - tx + 3, 9, "F");
  set(11, "bold", [255, 255, 255]); doc.text("Total TTC", tx, y + 2.5); doc.text(money(t.ttc), R - 1, y + 2.5, {align:"right"});
  y += 13;
  // échéancier
  const sc = schedule(t.ttc);
  const block = (title, text) => {
    if (!text) return;
    set(9.5); const lines = doc.splitTextToSize(String(text), R - M);
    room(10 + Math.min(lines.length, 6) * 4.2);
    set(8, "bold", BLUE); doc.text(title.toUpperCase(), M, y); y += 5;
    set(9); lines.forEach(l => { room(4.5); doc.text(l, M, y); y += 4.2; }); y += 4;
  };
  if (sc.length) {
    room(10 + sc.length * 5);
    set(8, "bold", BLUE); doc.text("CONDITIONS DE PAIEMENT", M, y); y += 5;
    set(9); sc.forEach(s => { room(5); doc.text(doc.splitTextToSize(s.line, 140)[0], M, y); if (s.amount != null) doc.text(money(s.amount), R, y, {align:"right"}); y += 4.8; });
    if (co.iban) { room(5); set(8.5, "normal", GREY); doc.text(`Règlement par virement · IBAN ${co.iban}`, M, y); y += 4.8; }
    y += 4;
  }
  block("Notes", q.notes);
  block("Conditions particulières", co.legalMentions);
  // signature
  room(34);
  doc.setDrawColor(...GREY); doc.setLineWidth(0.3); doc.rect(tx - 3, y, R - tx + 3, 30);
  set(8.5, "bold"); doc.text("Bon pour accord", tx, y + 5);
  set(7.5, "normal", GREY); doc.text(doc.splitTextToSize("Date et signature du client, précédées de la mention manuscrite « Bon pour accord »", R - tx - 2), tx, y + 9.5);
  // pied de page
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); set(7.5, "normal", GREY);
    doc.text([co.companyName, co.siret ? "SIRET " + co.siret : co.siren && "SIREN " + co.siren, `Devis ${q.number}`].filter(Boolean).join(" · "), M, 290);
    doc.text(`Page ${i} / ${n}`, R, 290, {align:"right"});
  }
  return doc;
}
async function downloadPDF(){
  const q = S.ed;
  if (q.dirty) { toast("Enregistrez d'abord vos modifications : le PDF reprend le devis enregistré."); return; }
  if (!window.jspdf?.jsPDF) { toast("Le module PDF n'a pas pu se charger. Rechargez la page."); return; }
  try {
    const blob = makePDF(q).output("blob");
    const name = `${q.number}${q.client?.lastName ? " " + q.client.lastName : ""}.pdf`.replace(/[\\/:*?"<>|]/g, "");
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch { toast("Le PDF n'a pas pu être créé."); }
}

// ───────────────────────── vues ─────────────────────────
function guard(){
  if (S.dbState === "error") return `<div class="note bad">${esc(S.loadError || "Impossible de joindre vos données.")} Rechargez la page.</div>`;
  return "";
}
function quotesHTML(){
  const all = Object.entries(S.quotes).sort((a, b) => String(b[1].createdAt).localeCompare(String(a[1].createdAt)));
  const f = S.qFilter || {q:"", st:""};
  const list = all.filter(([, x]) => (!f.st || x.status === f.st) && (!f.q || norm(`${x.number} ${clientName(x.client)} ${x.title} ${x.client?.city}`).includes(norm(f.q))));
  const sum = st => all.filter(([, x]) => x.status === st).reduce((s, [, x]) => s + (x.totals?.ttc || 0), 0);
  return `<div class="head"><div><h1>Mes devis</h1><p>${all.length} devis enregistré${all.length > 1 ? "s" : ""}.</p></div><a class="btn primary" href="#nouveau">Nouveau devis</a></div>
  ${all.length ? `<div class="stats">
    <div class="stat"><span class="label">Brouillons</span><b>${all.filter(([, x]) => x.status === "draft").length}</b></div>
    <div class="stat"><span class="label">Envoyés · TTC</span><b>${money(sum("sent"))}</b></div>
    <div class="stat"><span class="label">Acceptés · TTC</span><b>${money(sum("accepted"))}</b></div>
    <div class="stat"><span class="label">Taux d'acceptation</span><b>${(() => { const d = all.filter(([, x]) => ["accepted", "rejected", "expired"].includes(x.status)).length; return d ? Math.round(100 * all.filter(([, x]) => x.status === "accepted").length / d) + " %" : "—"; })()}</b></div>
  </div>` : ""}
  <section class="panel">
    <div class="row"><input id="qf-q" placeholder="Rechercher : numéro, client, ville…" value="${esc(f.q)}" style="flex:1;min-width:200px">
      <select id="qf-st" style="width:auto"><option value="">Tous les statuts</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${f.st === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
    ${list.length ? `<div class="tbl-wrap"><table><thead><tr><th>N°</th><th>Date</th><th>Client</th><th>Objet</th><th class="num">TTC</th><th>Statut</th></tr></thead><tbody>
      ${list.map(([id, x]) => `<tr class="click" data-open="${esc(id)}" tabindex="0"><td class="mono">${esc(x.number)}</td><td class="mono small">${dfr(x.createdAt)}</td><td>${esc(clientName(x.client)) || '<span class="muted">—</span>'}${x.demandeId ? ` <a class="small" href="./?id=${x.demandeId}" title="Fiche du client dans le CRM">fiche ›</a>` : ""}${x.client?.city ? `<div class="small muted">${esc(x.client.city)}</div>` : ""}</td><td>${esc(x.title) || '<span class="muted">—</span>'}</td><td class="num">${money(x.totals?.ttc || 0)}</td><td><span class="pill st-${esc(x.status)}">${STATUS[x.status] || esc(x.status)}</span></td></tr>`).join("")}
    </tbody></table></div>`
    : all.length ? `<div class="empty"><b>Aucun devis ne correspond</b>Modifiez la recherche ou le statut.</div>`
    : `<div class="empty"><b>Pas encore de devis</b>Vos devis apparaîtront ici. Commencez par <a href="#nouveau">dicter un chantier</a>.</div>`}
  </section>`;
}
function catalogueHTML(){
  const e = S.catEdit, cats = S.catalog?.categories || [];
  const f = norm(S.pFilter || "");
  const ps = products().filter(p => !f || norm(`${p.ref} ${p.name} ${p.keywords} ${p.description}`).includes(f));
  const form = e ? `<section class="panel"><h2>${e.idx == null ? "Nouvelle prestation" : "Modifier la prestation"}</h2>
    <div class="grid2"><label class="f">Référence<input id="pe-ref" data-pe="ref" class="mono" value="${esc(e.data.ref)}"></label>
    <label class="f">Catégorie<select id="pe-cat" data-pe="cat">${cats.map(c => `<option value="${esc(c.slug)}" ${e.data.cat === c.slug ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></label></div>
    <label class="f">Nom<input id="pe-name" data-pe="name" value="${esc(e.data.name)}"></label>
    <label class="f">Description (reprise sur le devis)<textarea id="pe-description" data-pe="description" rows="3">${esc(e.data.description)}</textarea></label>
    <div class="grid3"><label class="f">Prix HT (€)<input id="pe-priceHT" data-pe="priceHT" inputmode="decimal" class="num" value="${esc(String(e.data.priceHT).replace(".", ","))}"></label>
    <label class="f">Unité<input id="pe-unit" data-pe="unit" value="${esc(e.data.unit)}"></label>
    <label class="f">TVA<select id="pe-tvaRate" data-pe="tvaRate">${[20, 10, 5.5, 0].map(r => `<option value="${r}" ${num(e.data.tvaRate) === r ? "selected" : ""}>${String(r).replace(".", ",")} %</option>`).join("")}</select></label></div>
    <label class="f">Mots-clés (aident Claude à reconnaître la dictée)<input id="pe-keywords" data-pe="keywords" value="${esc(e.data.keywords)}"></label>
    <label class="row small" style="gap:8px"><input id="pe-active" type="checkbox" data-pe="active" style="width:auto" ${e.data.active !== false ? "checked" : ""}> Proposée dans les devis</label>
    <div class="row"><button class="btn primary" data-act="prod-save">Enregistrer</button><button class="btn" data-act="prod-cancel">Annuler</button><span class="spacer"></span>
    ${e.idx != null ? (S.confirm === "del-prod" ? `<div class="confirm">Supprimer du catalogue ? <button class="btn danger" data-act="prod-del-yes">Supprimer</button><button class="btn" data-act="cancel-confirm">Annuler</button></div>` : `<button class="btn danger" data-act="prod-del">Supprimer</button>`) : ""}</div></section>` : "";
  const groups = cats.map(c => ({c, items:ps.filter(p => p.cat === c.slug)})).filter(g => g.items.length);
  return `<div class="head"><div><h1>Catalogue</h1><p>${products().length} prestations, tarifs HT. Claude s'en sert pour chiffrer les dictées.</p></div><div class="row"><label class="btn" for="cat-import">Importer (.json)</label><input id="cat-import" type="file" accept="application/json,.json" hidden>${S.catalog ? `<button class="btn" data-act="cat-export">Exporter</button>` : ""}<button class="btn primary" data-act="prod-new" ${!S.catalog ? "disabled" : ""}>Nouvelle prestation</button></div></div>
  ${form}
  <input id="pf-q" placeholder="Rechercher dans le catalogue" value="${esc(S.pFilter || "")}">
  ${!S.catalog ? `<div class="empty card"><b>Catalogue vide</b><p class="muted">Importez le fichier du catalogue (catalogue-2026.json) avec le bouton « Importer ». Les tarifs restent dans la base du CRM, jamais sur le site public.</p></div>` : groups.length ? groups.map(g => `
    <div class="cat-group"><h3>${esc(g.c.name)} <span class="small muted mono">${g.items.length}</span></h3>
    <div class="cards">${g.items.map(p => `<div class="card"><div class="row" style="justify-content:space-between;gap:6px"><span class="mono small muted">${esc(p.ref)}</span>${p.active === false ? `<span class="tag">masquée</span>` : ""}</div>
      <div class="t">${esc(p.name)}</div><div class="small muted" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(p.description)}</div>
      <div class="row"><span class="num"><b>${money(p.priceHT)}</b> <span class="muted small">HT / ${esc(p.unit)}</span></span><span class="spacer"></span><button class="btn" data-act="prod-edit" data-ref="${esc(p.ref)}">Modifier</button></div></div>`).join("")}</div></div>`).join("")
  : `<div class="empty"><b>Aucune prestation ne correspond</b>Modifiez la recherche.</div>`}`;
}
function settingsHTML(){
  const c = S.coEdit || (S.coEdit = structuredClone(S.company || {}));
  const fld = (k, l, attrs = "") => `<label class="f">${l}<input id="co-${k}" data-co="${k}" value="${esc(c[k] ?? "")}" ${attrs}></label>`;
  return `<div class="head"><div><h1>Entreprise</h1><p>Ces informations figurent sur chaque devis PDF.</p></div></div>
  <section class="panel"><h2>Identité</h2>
    <div class="grid2">${fld("companyName", "Raison sociale")}${fld("ownerName", "Dirigeant")}${fld("phone", "Téléphone")}${fld("email", "E-mail")}</div>
    ${fld("address", "Adresse")}
    <div class="grid3">${fld("postalCode", "Code postal")}${fld("city", "Ville")}${fld("siren", "SIREN")}</div>
    <div class="grid2">${fld("siret", "SIRET")}${fld("iban", "IBAN", 'class="mono"')}</div>
    <div class="row"><span class="label">Logo</span>${c.logo ? `<img class="logo-prev" src="${esc(c.logo)}" alt="Logo actuel">` : `<span class="muted small">Aucun logo</span>`}
      <label class="btn" for="co-logo">Choisir une image</label><input id="co-logo" type="file" accept="image/png,image/jpeg" hidden>
      ${c.logo ? `<button class="btn ghost" data-act="logo-del">Retirer</button>` : ""}</div>
  </section>
  <section class="panel"><h2>Conditions</h2>
    <div class="grid2">${fld("defaultValidityDays", "Validité par défaut (jours)", 'inputmode="numeric"')}
      <label class="f">TVA par défaut<select id="co-defaultTvaRate" data-co="defaultTvaRate">${[20, 10, 5.5].map(r => `<option value="${r}" ${num(c.defaultTvaRate || 20) === r ? "selected" : ""}>${String(r).replace(".", ",")} %</option>`).join("")}</select></label></div>
    <label class="f">Conditions de paiement (une échéance par ligne ; un pourcentage dans la ligne calcule le montant)<textarea id="co-paymentConditions" data-co="paymentConditions" rows="4">${esc(c.paymentConditions)}</textarea></label>
    <label class="f">Conditions particulières<textarea id="co-legalMentions" data-co="legalMentions" rows="6">${esc(c.legalMentions)}</textarea></label>
  </section>
  <div class="row"><button class="btn primary" data-act="co-save" ${S.dbState !== "ok" ? "disabled" : ""}>Enregistrer</button><button class="btn" data-act="co-reset">Annuler les modifications</button></div>
  <section class="panel" id="cle"><h2>Clé API Claude</h2>
    <p class="muted">${S.keyHint ? `Clé enregistrée, se termine par <code>${esc(S.keyHint)}</code>.` : "Aucune clé enregistrée : l'analyse des dictées est désactivée."} Elle est rangée dans la base du CRM, hors du site, et n'est jamais réaffichée.</p>
    <div class="row"><input id="key-new" type="password" autocomplete="off" spellcheck="false" placeholder="sk-ant-…" style="flex:1;min-width:220px"><button class="btn primary" data-act="key-save">${S.keyHint ? "Remplacer la clé" : "Enregistrer la clé"}</button>${S.keyHint ? `<button class="btn ghost" data-act="key-del">Retirer</button>` : ""}</div>
    <p class="small muted">Créez la clé sur console.anthropic.com, rubrique API Keys, et fixez-y une limite de dépense mensuelle.</p>
  </section>`;
}

function render(force){
  if (!force && view.contains(document.activeElement) && document.activeElement.matches("input,textarea,select")) return;
  const g = guard();
  let html;
  if (S.view === "nouveau" || S.view.startsWith("devis-")) {
    if (S.view !== "nouveau" && !S.quotes[S.view.slice(6)]) {
      html = S.loaded.quotes ? `<div class="empty"><b>Devis introuvable</b>Il a peut-être été supprimé. <a href="#devis">Retour à mes devis</a></div>` : `<div class="empty"><b>Chargement du devis…</b></div>`;
    } else html = editorHTML(ensureEditor());
  }
  else if (S.view === "devis") html = quotesHTML();
  else if (S.view === "catalogue") html = catalogueHTML();
  else html = settingsHTML();
  view.innerHTML = g + html;
  document.getElementById("n-quotes").textContent = Object.keys(S.quotes).length || "";
  document.getElementById("n-products").textContent = products().length || "";
  const cs = document.getElementById("cat-search"); if (cs && S.lastSearch) { cs.value = S.lastSearch; searchCatalog(S.lastSearch); }
}

// ───────────────────────── événements ─────────────────────────
view.addEventListener("input", ev => {
  const el = ev.target, q = S.ed;
  if (el.id === "transcript") { q.transcript = el.value; saveDraftLocal(); return; }
  if (el.dataset.c) { q.client[el.dataset.c] = el.value; saveDraftLocal(); return; }
  if (el.dataset.f) { const i = +el.closest("[data-i]").dataset.i; q.lines[i][el.dataset.f] = el.value; if (el.dataset.f === "designation" || el.dataset.f === "unitPriceHT") q.lines[i].flag = ""; saveDraftLocal(); refreshTotals(); return; }
  if (el.id === "ed-title") { q.title = el.value; saveDraftLocal(); return; }
  if (el.id === "ed-notes") { q.notes = el.value; saveDraftLocal(); return; }
  if (el.id === "ed-discountValue") { q.discountValue = el.value; saveDraftLocal(); refreshTotals(); return; }
  if (el.id === "ed-validityDays") { q.validityDays = el.value; saveDraftLocal(); return; }
  if (el.id === "cat-search") { S.lastSearch = el.value; searchCatalog(el.value); return; }
  if (el.id === "qf-q") { S.qFilter = {...(S.qFilter || {}), q:el.value}; rerenderKeep(el); return; }
  if (el.id === "cf-q") { S.cFilter = el.value; rerenderKeep(el); return; }
  if (el.id === "pf-q") { S.pFilter = el.value; rerenderKeep(el); return; }
  if (el.dataset.pe && el.type !== "checkbox") { S.catEdit.data[el.dataset.pe] = el.value; return; }
  if (el.dataset.co) { S.coEdit[el.dataset.co] = el.value; S.coDirty = true; return; }
});
function rerenderKeep(el){ const id = el.id, pos = el.selectionStart; render(true); const n = document.getElementById(id); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch {} } }
view.addEventListener("change", ev => {
  const el = ev.target, q = S.ed;
  if (el.id === "ed-demandeId") {
    q.demandeId = el.value ? Number(el.value) : null;
    const d = demandeById(el.value);
    q.client = d ? clientFromDemande(d, q.client) : {firstName:"", lastName:"", phone:"", email:"", address:"", postalCode:"", city:""};
    saveDraftLocal(); render(true); return;
  }
  if (el.id === "cat-import" && el.files[0]) { importCatalog(el.files[0]); el.value = ""; return; }
  if (el.dataset.f === "tvaRate") { q.lines[+el.closest("[data-i]").dataset.i].tvaRate = num(el.value); saveDraftLocal(); refreshTotals(); return; }
  if (el.dataset.f === "quantity" || el.dataset.f === "unitPriceHT") { el.value = el.dataset.f === "quantity" ? qty(el.value) : String(r2(num(el.value))).replace(".", ","); return; }
  if (el.id === "ed-discountType") { q.discountType = el.value; saveDraftLocal(); refreshTotals(); return; }
  if (el.id === "ed-status") { q.status = el.value; saveDraftLocal(); return; }
  if (el.id === "qf-st") { S.qFilter = {...(S.qFilter || {}), st:el.value}; render(true); return; }
  if (el.id === "pe-active") { S.catEdit.data.active = el.checked; return; }
  if (el.id === "co-defaultTvaRate") { S.coEdit.defaultTvaRate = num(el.value); return; }
  if (el.id === "co-logo" && el.files[0]) { S.coDirty = true; loadLogo(el.files[0]); return; }
});
view.addEventListener("keydown", ev => {
  const tr = ev.target.closest?.("tr.click");
  if (tr && (ev.key === "Enter" || ev.key === " ")) { ev.preventDefault(); tr.click(); }
});
view.addEventListener("click", async ev => {
  if (ev.target.closest("a[href]")) return;
  const tr = ev.target.closest("tr[data-open]"); if (tr) { location.hash = "devis-" + tr.dataset.open; return; }
  const b = ev.target.closest("[data-act]"); if (!b) return;
  const a = b.dataset.act, q = S.ed;
  switch (a) {
    case "analyze": return analyze();
    case "mic": return toggleMic();
    case "example": { const ta = document.getElementById("transcript"); ta.value = EXAMPLE; q.transcript = EXAMPLE; saveDraftLocal(); ta.focus(); return; }
    case "reset": S.ed = blankQuote(); lsSet("dv-draft", null); S.lastSearch = ""; return render(true);
    case "add-prod": { const p = productByRef(b.dataset.ref); if (p) { q.lines.push(lineFromProduct(p)); saveDraftLocal(); render(true); toast(`${p.name} ajouté.`); } return; }
    case "free-line": q.lines.push({ref:"", designation:"", description:"", quantity:1, unit:"forfait", unitPriceHT:0, tvaRate:S.company?.defaultTvaRate ?? 20}); saveDraftLocal(); render(true); document.getElementById(`l${q.lines.length - 1}-designation`)?.focus(); return;
    case "del-line": q.lines.splice(+b.dataset.i, 1); saveDraftLocal(); return render(true);
    case "save": return saveQuote();
    case "pdf": return downloadPDF();
    case "del-quote": S.confirm = "del-quote"; return render(true);
    case "cancel-confirm": S.confirm = null; return render(true);
    case "del-quote-yes": try { await api("delete", {id:Number(q.id)}); delete S.quotes[q.id]; S.confirm = null; S.edKey = null; toast(`Devis ${q.number} supprimé.`); location.hash = "devis"; loadAll().then(() => render()); } catch (e) { toast(e.message); } return;
    case "cat-export": { const blob = new Blob([JSON.stringify(S.catalog, null, 1)], {type:"application/json"}); const url = URL.createObjectURL(blob), a2 = document.createElement("a"); a2.href = url; a2.download = `catalogue-${new Date().toISOString().slice(0, 10)}.json`; document.body.append(a2); a2.click(); a2.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); return; }
    case "key-save": case "key-del": {
      const k = a === "key-del" ? "" : (document.getElementById("key-new")?.value || "").trim();
      if (a === "key-save" && !k) { toast("Collez d'abord la clé."); return; }
      try { const r = await api("key", {key:k}); S.keyHint = r.keyHint; toast(k ? "Clé enregistrée." : "Clé retirée."); render(true); } catch (e) { toast(e.message); }
      return;
    }
    // catalogue
    case "prod-new": S.catEdit = {idx:null, data:{ref:"", cat:S.catalog.categories[0]?.slug || "", name:"", description:"", priceHT:0, unit:"pièce", tvaRate:S.company?.defaultTvaRate ?? 20, keywords:"", active:true}}; S.confirm = null; render(true); window.scrollTo({top:0}); return;
    case "prod-edit": { const idx = products().findIndex(p => p.ref === b.dataset.ref); S.catEdit = {idx, data:{...products()[idx]}}; S.confirm = null; render(true); window.scrollTo({top:0}); return; }
    case "prod-cancel": S.catEdit = null; return render(true);
    case "prod-del": S.confirm = "del-prod"; return render(true);
    case "prod-save": case "prod-del-yes": {
      const e = S.catEdit, list = products().slice();
      if (a === "prod-save") {
        const d = {...e.data, ref:String(e.data.ref || "").trim().toUpperCase(), priceHT:r2(num(e.data.priceHT)), tvaRate:num(e.data.tvaRate)};
        if (!d.ref || !d.name) { toast("Référence et nom sont obligatoires."); return; }
        if (list.some((p, i) => p.ref === d.ref && i !== e.idx)) { toast(`La référence ${d.ref} existe déjà.`); return; }
        if (e.idx == null) list.push(d); else list[e.idx] = d;
      } else list.splice(e.idx, 1);
      try { const data = cleanForStore({...S.catalog, products:list}); await api("catalog", {data}); S.catalog = data; S.catEdit = null; S.confirm = null; toast(a === "prod-save" ? "Catalogue mis à jour." : "Prestation supprimée."); render(true); } catch (err) { toast(err.message); }
      return;
    }
    // entreprise
    case "logo-del": S.coEdit.logo = ""; S.coEdit.logoRatio = 1; return render(true);
    case "co-reset": S.coEdit = null; S.coDirty = false; return render(true);
    case "co-save": {
      const c = {...S.coEdit, defaultValidityDays:Math.max(1, Math.round(num(S.coEdit.defaultValidityDays)) || 30), defaultTvaRate:num(S.coEdit.defaultTvaRate) || 20, updatedAt:today()};
      try { await api("company", {data:cleanForStore(c)}); S.company = c; S.coEdit = null; S.coDirty = false; toast("Informations de l'entreprise enregistrées."); render(true); } catch (e) { toast(e.message); }
      return;
    }
  }
});
function loadLogo(file){
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => {
    const max = 360, s = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    S.coEdit.logo = file.type === "image/png" ? cv.toDataURL("image/png") : cv.toDataURL("image/jpeg", 0.88);
    S.coEdit.logoRatio = cv.height / cv.width;
    URL.revokeObjectURL(url); render(true); toast("Logo prêt : pensez à enregistrer.");
  };
  img.onerror = () => toast("Image illisible. Choisissez un PNG ou un JPEG.");
  img.src = url;
}

// ───────────────────────── données (CRM) ─────────────────────────
function clientFromDemande(d, prev = {}){
  return {firstName:"", lastName:d.nom || "", phone:d.tel || "", email:d.email || "", address:prev.address || "", postalCode:prev.postalCode || "", city:d.commune || ""};
}
function importCatalog(file){
  const fr = new FileReader();
  fr.onload = async () => {
    let data;
    try { data = JSON.parse(String(fr.result)); } catch { toast("Fichier illisible : ce n'est pas un fichier JSON."); return; }
    if (!Array.isArray(data?.products) || !Array.isArray(data?.categories)) { toast("Fichier non reconnu : il faut un catalogue exporté par DevisVoice."); return; }
    try { await api("catalog", {data}); S.catalog = data; toast(`Catalogue importé : ${data.products.length} prestations.`); render(true); } catch (e) { toast(e.message); }
  };
  fr.readAsText(file);
}
async function loadAll(){
  const r = await api("state");
  S.catalog = r.catalog?.products ? r.catalog : null;
  S.company = r.company || {};
  S.keyHint = r.keyHint || "";
  S.quotes = Object.fromEntries((r.quotes || []).map(x => [String(x.id), x]));
  S.demandes = r.demandes || [];
  Object.keys(S.loaded).forEach(k => S.loaded[k] = true);
  if (!S.coDirty) S.coEdit = null;
  S.dbState = "ok";
}
function loadDefaultLogo(){
  const img = new Image();
  img.onload = () => {
    const cv = document.createElement("canvas"), s = Math.min(1, 300 / Math.max(img.width, img.height));
    cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
    cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
    try { S.defaultLogo = {src:cv.toDataURL("image/png"), ratio:cv.height / cv.width}; } catch {}
  };
  img.src = "/assets/img/logo.png";
}
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || S.busy || S.dbState !== "ok") return;
  if (view.contains(document.activeElement) && document.activeElement.matches("input,textarea,select")) return;
  try { await loadAll(); if (S.edKey && S.edKey !== "new" && !S.ed?.dirty) S.edKey = null; render(true); } catch {}
});

(async () => {
  loadDefaultLogo();
  const fromDemande = new URLSearchParams(location.search).get("demande");
  route();
  try { await loadAll(); } catch (e) { S.dbState = "error"; S.loadError = e.message; render(true); return; }
  if (fromDemande) {
    const d = demandeById(fromDemande);
    history.replaceState(null, "", location.pathname + "#nouveau");
    if (d) {
      const q = blankQuote(); q.demandeId = d.id; q.client = clientFromDemande(d);
      q.title = [d.type, d.commune && "à " + d.commune].filter(Boolean).join(" ");
      S.ed = q; S.edKey = "new"; saveDraftLocal(); S.view = "";
    }
  }
  route();
})();

})();
