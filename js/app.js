/* Fatick Terrain — application d'enquête mobile (PWA statique) */
(function () {
'use strict';
var $ = function (s) { return document.querySelector(s); };
var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
var INFRAS = window.INFRAS, CATS = window.CATS;
var BYID = {}; INFRAS.forEach(function (i) { BYID[i.id] = i; });
var CENTER = [14.343, -16.41];

/* ───────── État persistant ───────── */
var KEY = 'ft_state_v1';
var S = { ignore: {}, visited: {}, forms: {}, settings: { auto: true, radius: 40, profile: 'foot', voice: false, wake: true, basemap: 'plan', enqueteur: '' }, lastExport: null };
try { var raw = localStorage.getItem(KEY); if (raw) { var p = JSON.parse(raw); S.visited = p.visited || {}; S.forms = p.forms || {}; S.ignore = p.ignore || {}; Object.assign(S.settings, p.settings || {}); S.lastExport = p.lastExport || null; } } catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('⚠️ Stockage plein ou bloqué : exporte tes données !'); } updateSaveInfo(); }
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

/* Réparation : une position « corrigée » à plus de 300 m du point d'origine est une erreur → on la supprime */
var fixed = 0;
(function () { var I = window.INFRAS; I.forEach(function (i) { var f = S.forms[i.id]; if (f && f._lat) { var R = 6371000, a = (f._lat - i.lat) * Math.PI / 180, b = (f._lng - i.lng) * Math.PI / 180; var d = R * Math.sqrt(a * a + Math.pow(Math.cos(i.lat * Math.PI / 180) * b, 2)); if (d > 300) { delete f._lat; delete f._lng; fixed++; } } }); })();
/* ───────── Utilitaires ───────── */
function toast(msg, ms) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, ms || 3000); }
function rad(d) { return d * Math.PI / 180; }
function hav(a, b) { var R = 6371000, dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]); var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) * Math.sin(dLng / 2); return 2 * R * Math.asin(Math.sqrt(x)); }
function bearing(a, b) { var y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0])); var x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1])); return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360; }
function fmtD(m) { return m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km'; }
function fmtT(s) { var m = Math.max(1, Math.round(s / 60)); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function nameOf(i) { var f = S.forms[i.id]; return (f && f.nom) || i.nom; }
function quartierOf(i) { var f = S.forms[i.id]; return (f && f.quartier) || i.quartier; }
function posOf(i) { var f = S.forms[i.id]; return (f && f._lat) ? [f._lat, f._lng] : [i.lat, i.lng]; }
function isDone(i) { return !!S.visited[i.id]; }
function isFilled(i) { return !!(S.forms[i.id] && S.forms[i.id]._saved); }
function dmy(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : (iso || ''); }
function toISO(v) { var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v || ''); if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); return /^\d{4}-\d{2}-\d{2}/.test(v || '') ? v.slice(0, 10) : ''; }
function stamp(ts) { var d = new Date(ts); function z(n) { return ('0' + n).slice(-2); } return z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()); }

/* ───────── Carte ───────── */
var map = L.map('map', { zoomControl: false, center: CENTER, zoom: 14, maxZoom: 19, attributionControl: false, tap: true });
L.control.attribution({ prefix: false, position: 'bottomright' }).addTo(map);
var BASES = {
  plan: L.tileLayer('https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }),
  sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, maxNativeZoom: 18, attribution: 'Esri' })
};
var base = null;
function setBase(k) { if (base) map.removeLayer(base); base = BASES[k].addTo(map); S.settings.basemap = k; $('#fab-base').textContent = k === 'sat' ? '🗺️' : '🛰️'; save(); }
setBase(S.settings.basemap === 'sat' ? 'sat' : 'plan');
$('#fab-base').onclick = function () { setBase(S.settings.basemap === 'sat' ? 'plan' : 'sat'); };

var mapEl = $('#map');
function zl() { mapEl.classList.toggle('zl', map.getZoom() >= 16); }
map.on('zoomend', zl); zl();

/* Marqueurs */
var markers = {}, selId = null;
function icon(i) {
  var c = CATS[i.cat], cls = 'pin' + (isDone(i) ? ' done' : '') + (isFilled(i) ? ' filled' : '') + (selId === i.id ? ' sel' : '');
  return L.divIcon({ className: 'pinicon', html: '<div class="' + cls + '" style="--c:' + c.color + '"><i></i><b>' + c.emoji + '</b></div>', iconSize: [34, 34], iconAnchor: [17, 34], tooltipAnchor: [0, 4] });
}
function tipHtml(i) { return esc(nameOf(i)) + '<small>' + esc(quartierOf(i)) + '</small>'; }
function refreshMarker(i) {
  var m = markers[i.id]; if (!m) return;
  m.setIcon(icon(i)); m.setLatLng(posOf(i)); m.setTooltipContent(tipHtml(i));
  m.setZIndexOffset(selId === i.id ? 1000 : (isDone(i) ? 0 : 200));
}
INFRAS.forEach(function (i) {
  var m = L.marker(posOf(i), { icon: icon(i), riseOnHover: true, zIndexOffset: isDone(i) ? 0 : 200 }).addTo(map);
  m.bindTooltip(tipHtml(i), { permanent: true, direction: 'bottom', className: 'lbl', opacity: 1 });
  m.on('click', function (e) { L.DomEvent.stopPropagation(e); select(i.id); });
  markers[i.id] = m;
});
map.on('click', function () { if (!$('#sheet').hidden) closeSheet(); });
map.fitBounds(L.latLngBounds(INFRAS.map(function (i) { return [i.lat, i.lng]; })).pad(0.12));

/* Progression */
function updateProgress() {
  var n = INFRAS.filter(isDone).length, t = INFRAS.length;
  $('#prog-n').textContent = n; $('#prog-total').textContent = t;
  $('#ring-fg').style.strokeDashoffset = 97.4 * (1 - n / t);
}

/* ───────── Position GPS ───────── */
var me = null, meMarker = null, meCircle = null, follow = false, firstFix = true, watchId = null;
function startGPS() {
  if (!navigator.geolocation) { toast('GPS non disponible sur cet appareil'); return; }
  if (watchId != null) return;
  watchId = navigator.geolocation.watchPosition(onPos, function (e) {
    watchId = null;
    toast(e.code === 1 ? '📍 Autorise la localisation pour ce site (réglages du navigateur)' : '📍 Position introuvable (' + e.message + ')', 4500);
  }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
}
function onPos(p) {
  var c = p.coords; me = { ll: [c.latitude, c.longitude], acc: c.accuracy, heading: (c.heading != null && !isNaN(c.heading) && c.speed > 0.8) ? c.heading : null, t: Date.now() };
  if (!meMarker) {
    meMarker = L.marker(me.ll, { icon: L.divIcon({ className: 'me-wrap', html: '<div class="me"></div>', iconSize: [18, 18] }), interactive: false, zIndexOffset: 2000 }).addTo(map);
    meCircle = L.circle(me.ll, { radius: c.accuracy, weight: 1, color: '#2563eb', fillOpacity: .1, interactive: false }).addTo(map);
  } else { meMarker.setLatLng(me.ll); meCircle.setLatLng(me.ll).setRadius(c.accuracy); }
  if (firstFix) {
    firstFix = false;
    if (hav(me.ll, CENTER) < 20000) { map.setView(me.ll, Math.max(map.getZoom(), 16)); follow = true; $('#fab-locate').classList.add('on'); }
    else toast('Tu es loin de Fatick (' + fmtD(hav(me.ll, CENTER)) + ') — carte non recentrée');
  } else if (follow) map.panTo(me.ll, { animate: true, duration: .5 });
  autoVisit(); navUpdate(); if (!$('#sheet').hidden) updateSheet(); if (!$('#drawer').hidden && drawerTab === 'list') renderList();
}
map.on('dragstart', function () { follow = false; $('#fab-locate').classList.remove('on'); });
$('#fab-locate').onclick = function () {
  if (!me) { toast('Recherche de ta position…'); startGPS(); follow = true; $('#fab-locate').classList.add('on'); firstFix = false; return; }
  follow = true; $('#fab-locate').classList.add('on'); map.setView(me.ll, Math.max(map.getZoom(), 17));
};

/* Visites */
function setVisited(i, on, mode) {
  if (on) { S.visited[i.id] = { t: Date.now(), mode: mode || 'manuel' }; delete S.ignore[i.id]; } else { delete S.visited[i.id]; S.ignore[i.id] = 1; }
  save(); refreshMarker(i); updateProgress(); if (selId === i.id) updateSheet(); if (!$('#drawer').hidden) renderList();
}
var cand = {};
function autoVisit() {
  if (!S.settings.auto || !me || me.acc > 50) return;
  INFRAS.forEach(function (i) {
    if (isDone(i) || S.ignore[i.id]) { return; }
    var d = hav(me.ll, posOf(i));
    if (d > S.settings.radius) { cand[i.id] = 0; return; }
    cand[i.id] = (cand[i.id] || 0) + 1;
    if (cand[i.id] >= 2) {
      setVisited(i, true, 'auto');
      try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch (e) {}
      toast('🔴 ' + nameOf(i) + ' — visitée ! Ouvre la fiche pour la remplir.', 5000);
      if (!navTarget || navTarget === i.id) select(i.id, true);
    }
  });
}

/* ───────── Fiche (bottom sheet) ───────── */
function select(id, noFly) {
  var old = selId; selId = id; var i = BYID[id];
  if (old && BYID[old]) refreshMarker(BYID[old]);
  refreshMarker(i); updateSheet(); $('#sheet').hidden = false; document.body.classList.add('sheet-open');
  if (!noFly) map.flyTo(posOf(i), Math.max(map.getZoom(), 17), { duration: .6 });
}
function closeSheet() { var o = selId; selId = null; $('#sheet').hidden = true; document.body.classList.remove('sheet-open'); if (o) refreshMarker(BYID[o]); }
function updateSheet() {
  var i = BYID[selId]; if (!i) return; var c = CATS[i.cat];
  $('#s-emoji').textContent = c.emoji; $('#s-nom').textContent = nameOf(i);
  $('#s-meta').textContent = c.label + ' · ' + quartierOf(i) + ' · #' + i.id;
  $('#s-dist').textContent = me ? '📏 ' + fmtD(hav(me.ll, posOf(i))) + ' (à vol d’oiseau)' : '📏 position GPS inconnue';
  var st = $('#s-state'); st.textContent = isDone(i) ? 'Visitée' : 'À visiter'; st.className = 'chip' + (isDone(i) ? ' red' : '');
  var f = $('#s-form'); f.textContent = isFilled(i) ? 'Fiche remplie ✓' : 'Fiche vide'; f.className = 'chip ' + (isFilled(i) ? 'ok' : 'ghost');
  $('#a-visit').textContent = isDone(i) ? '↩ Annuler « visitée »' : '🔴 Marquer visitée';
  $('#a-route').textContent = navTarget === i.id ? '🧭 Guidage en cours' : '🧭 Itinéraire';
}
$('#s-close').onclick = closeSheet;
$('#a-visit').onclick = function () { var i = BYID[selId]; setVisited(i, !isDone(i), 'manuel'); };
$('#a-form').onclick = function () { openForm(selId); };
$('#a-route').onclick = function () { startNav(selId); };

/* ───────── Guidage ───────── */
var navTarget = null, route = null, routeLine = null, routeCase = null, fallbackLine = null, lastReroute = 0, offCount = 0, lastSpoken = '', wake = null;
var OSRM = { foot: 'routed-foot', bike: 'routed-bike', car: 'routed-car' };
var SYM = { left: '⬅', right: '➡', 'slight left': '↖', 'slight right': '↗', 'sharp left': '↙', 'sharp right': '↘', straight: '⬆', uturn: '↩' };
var TXT = { left: 'Tournez à gauche', right: 'Tournez à droite', 'slight left': 'Tournez légèrement à gauche', 'slight right': 'Tournez légèrement à droite', 'sharp left': 'Tournez franchement à gauche', 'sharp right': 'Tournez franchement à droite', straight: 'Continuez tout droit', uturn: 'Faites demi-tour' };
function maneuverText(m, name) {
  var n = name ? ' sur ' + name : '';
  if (m.type === 'depart') return 'Démarrez' + n;
  if (m.type === 'arrive') return 'Vous êtes arrivé' + (m.modifier === 'left' ? ' — destination à gauche' : m.modifier === 'right' ? ' — destination à droite' : '');
  if (/roundabout|rotary/.test(m.type) && m.exit) return 'Au rond-point, prenez la ' + m.exit + (m.exit === 1 ? 're' : 'e') + ' sortie' + n;
  if (m.type === 'exit roundabout') return 'Sortez du rond-point' + n;
  return (TXT[m.modifier] || 'Continuez') + n;
}
function maneuverSym(m) { if (m.type === 'arrive') return '🏁'; if (/roundabout|rotary/.test(m.type)) return '⟳'; return SYM[m.modifier] || '⬆'; }

function startNav(id) {
  var i = BYID[id];
  if (!me) { startGPS(); toast('Attente de ta position GPS…'); navTarget = id; pendingNav = true; updateSheet(); return; }
  navTarget = id; pendingNav = false; $('#navbar').hidden = false; document.body.classList.add('nav-on'); follow = true; $('#fab-locate').classList.add('on');
  $('#nav-instr').textContent = 'Calcul de l’itinéraire…'; $('#nav-sub').textContent = nameOf(i);
  acquireWake(); updateSheet(); fetchRoute(true);
}
var pendingNav = false;
function stopNav() {
  navTarget = null; route = null; pendingNav = false; clearRoute(); $('#navbar').hidden = true; document.body.classList.remove('nav-on');
  try { speechSynthesis.cancel(); } catch (e) {} releaseWake(); if (selId) updateSheet();
}
function clearRoute() { [routeLine, routeCase, fallbackLine].forEach(function (l) { if (l) map.removeLayer(l); }); routeLine = routeCase = fallbackLine = null; }
$('#nav-stop').onclick = stopNav;

function fetchRoute(fit) {
  if (!navTarget || !me) return;
  lastReroute = Date.now(); var i = BYID[navTarget], dst = posOf(i), src = me.ll;
  var prof = OSRM[S.settings.profile] || OSRM.foot;
  var url = 'https://routing.openstreetmap.de/' + prof + '/route/v1/driving/' + src[1] + ',' + src[0] + ';' + dst[1] + ',' + dst[0] + '?overview=full&geometries=geojson&steps=true';
  var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 12000), target = navTarget;
  fetch(url, { signal: ctl.signal }).then(function (r) { return r.json(); }).then(function (j) {
    clearTimeout(to); if (target !== navTarget) return;
    if (!j.routes || !j.routes[0]) throw new Error('no route');
    setRoute(j.routes[0], fit);
  }).catch(function () {
    clearTimeout(to); if (target !== navTarget) return;
    route = null; clearRoute();
    if (!fallbackLine) fallbackLine = L.polyline([me.ll, dst], { color: '#2563eb', weight: 4, dashArray: '8 8' }).addTo(map);
    toast('Itinéraire indisponible (hors-ligne ?) — guidage en ligne droite', 4000); navUpdate();
  });
}
function setRoute(r, fit) {
  clearRoute();
  var pts = r.geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
  var cum = [0]; for (var k = 1; k < pts.length; k++) cum.push(cum[k - 1] + hav(pts[k - 1], pts[k]));
  var steps = [], acc = 0;
  r.legs.forEach(function (l) { l.steps.forEach(function (s) { steps.push({ start: acc, m: s.maneuver, name: s.name || '' }); acc += s.distance; }); });
  route = { pts: pts, cum: cum, total: cum[cum.length - 1], steps: steps, dur: r.duration, dist: r.distance };
  routeCase = L.polyline(pts, { color: '#fff', weight: 10, opacity: .9 }).addTo(map);
  routeLine = L.polyline(pts, { color: '#2563eb', weight: 6, opacity: .95 }).addTo(map);
  offCount = 0; lastSpoken = '';
  if (fit) map.fitBounds(routeLine.getBounds().pad(0.25), { maxZoom: 18 });
  navUpdate();
}
function project(p) { /* projette p sur l'itinéraire → {s: distance le long, off: écart} */
  var lat0 = p[0], kx = Math.cos(rad(lat0)) * 111320, ky = 110540, best = { off: 1e12, s: 0 }, pts = route.pts;
  for (var k = 0; k < pts.length - 1; k++) {
    var ax = (pts[k][1] - p[1]) * kx, ay = (pts[k][0] - p[0]) * ky, bx = (pts[k + 1][1] - p[1]) * kx, by = (pts[k + 1][0] - p[0]) * ky;
    var dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0;
    var px = ax + t * dx, py = ay + t * dy, off = Math.sqrt(px * px + py * py);
    if (off < best.off) best = { off: off, s: route.cum[k] + t * (route.cum[k + 1] - route.cum[k]) };
  }
  return best;
}
function navUpdate() {
  if (!navTarget) return;
  if (pendingNav && me) { startNav(navTarget); return; }
  if (!me) return;
  var i = BYID[navTarget], dst = posOf(i), dd = hav(me.ll, dst);
  if (dd <= Math.max(15, S.settings.radius * .6) && me.acc <= 80) { toast('🏁 Arrivé : ' + nameOf(i)); speak('Vous êtes arrivé'); var id = navTarget; stopNav(); select(id, true); return; }
  var arrow = $('#nav-arrow'), instr = $('#nav-instr'), sub = $('#nav-sub');
  if (route) {
    var pr = project(me.ll);
    if (pr.off > 40) { offCount++; if (offCount >= 2 && Date.now() - lastReroute > 12000) { instr.textContent = 'Recalcul de l’itinéraire…'; fetchRoute(false); return; } } else offCount = 0;
    var s = pr.s, j = -1;
    for (var k = 0; k < route.steps.length; k++) if (route.steps[k].start > s + 3) { j = k; break; }
    var rem = Math.max(0, route.total - s), txt, sym, dm;
    if (j < 0) { txt = 'Continuez jusqu’à destination'; sym = '🏁'; dm = rem; }
    else { var st = route.steps[j]; dm = st.start - s; txt = maneuverText(st.m, st.name); sym = maneuverSym(st.m); }
    arrow.style.transform = ''; arrow.textContent = sym;
    instr.textContent = (dm > 25 ? 'Dans ' + fmtD(dm) + ' : ' : '') + txt;
    sub.textContent = fmtD(rem) + ' restants · ~' + fmtT(rem / (route.dist / Math.max(route.dur, 1))) + ' · ' + nameOf(i);
    var key = j + '|' + (dm < 60 ? 'n' : dm < 200 ? 'm' : 'f');
    if (key !== lastSpoken && (dm < 200 || lastSpoken === '')) { lastSpoken = key; speak((dm > 40 ? 'Dans ' + Math.round(dm / 10) * 10 + ' mètres, ' : '') + txt.toLowerCase()); }
  } else {
    var b = bearing(me.ll, dst), rel = me.heading != null ? b - me.heading : b;
    arrow.textContent = '⬆'; arrow.style.transform = 'rotate(' + rel + 'deg)';
    var card = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'][Math.round(b / 45) % 8];
    instr.textContent = fmtD(dd) + ' vers le ' + card; sub.textContent = (me.heading != null ? 'Flèche = direction à suivre · ' : 'Direction : ') + Math.round(b) + '° · ' + nameOf(i);
    if (Date.now() - lastReroute > 30000 && navigator.onLine) fetchRoute(false);
  }
}
function speak(t) {
  if (!S.settings.voice) return;
  try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(t); u.lang = 'fr-FR'; speechSynthesis.speak(u); } catch (e) {}
}
function paintVoice() { $('#nav-voice').textContent = S.settings.voice ? '🔊' : '🔇'; $('#s-voice').checked = S.settings.voice; }
$('#nav-voice').onclick = function () { S.settings.voice = !S.settings.voice; save(); paintVoice(); if (S.settings.voice) speak('Annonces vocales activées'); };
function acquireWake() { if (!S.settings.wake || !navigator.wakeLock) return; navigator.wakeLock.request('screen').then(function (w) { wake = w; }).catch(function () {}); }
function releaseWake() { try { wake && wake.release(); } catch (e) {} wake = null; }
document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible' && navTarget) acquireWake(); });

$('#fab-next').onclick = function () {
  var todo = INFRAS.filter(function (i) { return !isDone(i); });
  if (!todo.length) { toast('🎉 Tout est visité !'); return; }
  var ref = me ? me.ll : map.getCenter(); ref = Array.isArray(ref) ? ref : [ref.lat, ref.lng];
  todo.sort(function (a, b) { return hav(ref, posOf(a)) - hav(ref, posOf(b)); });
  select(todo[0].id); if (me) startNav(todo[0].id); else { startGPS(); toast('Plus proche : ' + nameOf(todo[0]) + ' (active le GPS pour le guidage)'); }
};

/* ───────── Menu / liste ───────── */
var drawerTab = 'list', fStatus = 'all', fCat = null;
function openDrawer(tab) { $('#drawer').hidden = false; setTab(tab || drawerTab); }
function setTab(t) { drawerTab = t; $$('.d-tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); }); $$('#drawer section').forEach(function (s) { s.hidden = s.dataset.pane !== t; }); if (t === 'list') renderList(); if (t === 'export') updateSaveInfo(); }
$('#btn-menu').onclick = function () { openDrawer('list'); };
$('#btn-search').onclick = function () { openDrawer('list'); setTimeout(function () { $('#q').focus(); }, 100); };
$('#d-close').onclick = function () { $('#drawer').hidden = true; };
$$('.d-tabs button').forEach(function (b) { b.onclick = function () { setTab(b.dataset.tab); }; });
function renderChips() {
  var h = '<button data-k="all" class="' + (fStatus === 'all' && !fCat ? 'on' : '') + '">Tous (' + INFRAS.length + ')</button>' +
    '<button data-k="todo" class="' + (fStatus === 'todo' ? 'on' : '') + '">À visiter (' + INFRAS.filter(function (i) { return !isDone(i); }).length + ')</button>' +
    '<button data-k="done" class="' + (fStatus === 'done' ? 'on' : '') + '">🔴 Visitées (' + INFRAS.filter(isDone).length + ')</button>';
  Object.keys(CATS).forEach(function (k) { h += '<button data-c="' + k + '" class="' + (fCat === k ? 'on' : '') + '">' + CATS[k].emoji + ' ' + CATS[k].label + '</button>'; });
  $('#chips').innerHTML = h;
}
$('#chips').onclick = function (e) {
  var b = e.target.closest('button'); if (!b) return;
  if (b.dataset.c) fCat = fCat === b.dataset.c ? null : b.dataset.c;
  else if (b.dataset.k === 'all') { fStatus = 'all'; fCat = null; } else fStatus = fStatus === b.dataset.k ? 'all' : b.dataset.k;
  renderList();
};
function renderList() {
  renderChips();
  var q = $('#q').value.trim().toLowerCase();
  var arr = INFRAS.filter(function (i) {
    if (fStatus === 'todo' && isDone(i)) return false; if (fStatus === 'done' && !isDone(i)) return false; if (fCat && i.cat !== fCat) return false;
    return !q || (nameOf(i) + ' ' + quartierOf(i) + ' ' + CATS[i.cat].label).toLowerCase().indexOf(q) >= 0;
  });
  arr.sort(function (a, b) { return me ? hav(me.ll, posOf(a)) - hav(me.ll, posOf(b)) : a.id - b.id; });
  $('#list').innerHTML = arr.map(function (i) {
    return '<div class="li ' + (isDone(i) ? 'done' : '') + '" data-id="' + i.id + '"><div class="e">' + CATS[i.cat].emoji + '</div><div class="t"><b>' + esc(nameOf(i)) + '</b><span>' + esc(CATS[i.cat].label) + ' · ' + esc(quartierOf(i)) + '</span></div><div class="d">' +
      (me ? fmtD(hav(me.ll, posOf(i))) + '<br>' : '') + (isDone(i) ? '🔴' : '') + (isFilled(i) ? '✓' : '') + '</div>' + (isDone(i) ? '<button class="mini undo" data-undo="' + i.id + '" title="Annuler visitée">↩</button>' : '') + '</div>';
  }).join('') || '<p class="muted">Aucun résultat.</p>';
}
$('#q').oninput = renderList;
$('#list').onclick = function (e) { var u = e.target.closest('[data-undo]'); if (u) { setVisited(BYID[+u.dataset.undo], false); toast('↩ Visite annulée'); return; } var li = e.target.closest('.li'); if (!li) return; $('#drawer').hidden = true; select(+li.dataset.id); };

/* ───────── Réglages ───────── */
$('#s-auto').checked = S.settings.auto; $('#s-auto').onchange = function () { S.settings.auto = this.checked; save(); toast(this.checked ? 'Visite automatique activée' : 'Visite automatique désactivée : marque à la main'); };
$('#s-radius').value = S.settings.radius; $('#s-radius-v').textContent = S.settings.radius + ' m';
$('#s-radius').oninput = function () { S.settings.radius = +this.value; $('#s-radius-v').textContent = this.value + ' m'; save(); };
$('#s-profile').value = S.settings.profile; $('#s-profile').onchange = function () { S.settings.profile = this.value; save(); if (navTarget) fetchRoute(false); };
$('#s-voice').onchange = function () { S.settings.voice = this.checked; save(); paintVoice(); };
$('#s-wake').checked = S.settings.wake; $('#s-wake').onchange = function () { S.settings.wake = this.checked; save(); if (this.checked && navTarget) acquireWake(); else releaseWake(); };
paintVoice();
$('#s-reset').onclick = function () {
  if (!confirm('Remettre les 52 infrastructures à « à visiter » ? (les fiches saisies sont conservées)')) return;
  S.visited = {}; save(); INFRAS.forEach(refreshMarker); updateProgress(); renderList(); toast('Visites remises à zéro');
};

/* Carte hors-ligne */
function tileXY(lat, lng, z) { var n = Math.pow(2, z); return [Math.floor((lng + 180) / 360 * n), Math.floor((1 - Math.log(Math.tan(rad(lat)) + 1 / Math.cos(rad(lat))) / Math.PI) / 2 * n)]; }
$('#s-offline').onclick = function () {
  var btn = this, lats = INFRAS.map(function (i) { return i.lat; }), lngs = INFRAS.map(function (i) { return i.lng; }), pad = .02;
  var n = Math.min.apply(0, lats) - pad, s = Math.max.apply(0, lats) + pad, w = Math.min.apply(0, lngs) - pad, e = Math.max.apply(0, lngs) + pad;
  var tpl = BASES[S.settings.basemap].getTileUrl ? S.settings.basemap : 'plan', urls = [];
  for (var z = 13; z <= 17; z++) { var a = tileXY(s, w, z), b = tileXY(n, e, z); for (var x = a[0]; x <= b[0]; x++) for (var y = b[1]; y <= a[1]; y++) urls.push(BASES[tpl].getTileUrl({ x: x, y: y, z: z })); }
  if (!navigator.onLine) { toast('Pas de réseau'); return; }
  btn.disabled = true; $('#off-bar').hidden = false; var done = 0, fail = 0, idx = 0, total = urls.length;
  $('#off-info').textContent = total + ' tuiles à télécharger (' + (tpl === 'sat' ? 'satellite' : 'plan') + ')…';
  function next() {
    if (idx >= total) return Promise.resolve();
    var u = urls[idx++];
    return fetch(u, { mode: 'no-cors' }).catch(function () { fail++; }).then(function () { done++; $('#off-fill').style.width = (done / total * 100) + '%'; $('#off-info').textContent = done + ' / ' + total + (fail ? ' (' + fail + ' échecs)' : ''); return next(); });
  }
  Promise.all([next(), next(), next(), next(), next(), next()]).then(function () { btn.disabled = false; $('#off-info').textContent = '✅ Terminé : ' + (total - fail) + ' tuiles en mémoire. Refais la même chose avec l’autre fond (🛰️) si tu veux les deux.'; });
};

/* ───────── Formulaire ───────── */
var formId = null, formCoords = null;
function fieldsOf(i) { return window.COMMON_BEFORE.concat(CATS[i.cat].fields, window.COMMON_AFTER); }
function openForm(id) {
  var i = BYID[id]; formId = id; formCoords = null; formReset = false; var c = CATS[i.cat], saved = S.forms[id];
  var vals = saved ? Object.assign({}, saved) : Object.assign({ quartier: i.quartier, nom: i.nom, enqueteur: S.settings.enqueteur }, i.pre);
  $('#f-title').textContent = c.emoji + ' ' + c.label; $('#f-sub').textContent = '#' + id + ' · ' + i.nom + (saved ? ' — modifier la fiche' : (Object.keys(i.pre).length ? ' — pré-rempli avec tes données Kobo' : ''));
  var h = '';
  fieldsOf(i).forEach(function (f) {
    var v = vals[f.k] == null ? '' : vals[f.k], inp;
    if (f.t === 'select') { var o = f.o.slice(); if (v && o.indexOf(v) < 0) o.push(v); inp = '<select name="' + f.k + '"><option value="">—</option>' + o.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>'; }
    else if (f.t === 'textarea') inp = '<textarea name="' + f.k + '">' + esc(v) + '</textarea>';
    else if (f.t === 'date') inp = '<input type="date" name="' + f.k + '" value="' + esc(toISO(v)) + '">';
    else if (f.t === 'time') inp = '<input type="time" name="' + f.k + '" value="' + esc(String(v).slice(0, 5)) + '">';
    else if (f.t === 'number') inp = '<input type="number" inputmode="numeric" min="0" step="any" name="' + f.k + '" value="' + esc(v) + '">';
    else inp = '<input type="text" name="' + f.k + '" value="' + esc(v) + '">';
    h += '<label>' + esc(f.l) + inp + '</label>';
  });
  $('#f-body').innerHTML = h; paintCoords(); $('#formwrap').hidden = false; $('#f-body').scrollTop = 0;
}
function paintCoords() {
  var i = BYID[formId], f = S.forms[formId], p = formCoords || (f && f._lat ? [f._lat, f._lng] : [i.lat, i.lng]);
  $('#f-coords').textContent = '📍 ' + p[0].toFixed(6) + ', ' + p[1].toFixed(6) + (formCoords || (f && f._lat) ? ' (corrigé GPS)' : '');
}
$('#f-gps').onclick = function () {
  if (!me) { startGPS(); toast('Position GPS pas encore disponible'); return; }
  var i = BYID[formId], d = hav(me.ll, [i.lat, i.lng]);
  if (d > 150 && !confirm('Tu es à ' + fmtD(d) + ' du point d’origine de cette infrastructure. Déplacer quand même le point à ta position actuelle ?')) return;
  formCoords = [me.ll[0], me.ll[1]]; paintCoords(); toast('Position enregistrée (précision ± ' + Math.round(me.acc) + ' m)'); };
function closeForm() { $('#formwrap').hidden = true; formId = null; }
$('#f-reset').onclick = function () { var i = BYID[formId]; formCoords = null; if (S.forms[formId]) { delete S.forms[formId]._lat; delete S.forms[formId]._lng; } formReset = true; $('#f-coords').textContent = '📍 ' + i.lat.toFixed(6) + ', ' + i.lng.toFixed(6) + ' (origine)'; toast('Position d’origine rétablie (enregistre la fiche)'); };
var formReset = false;
$('#f-close').onclick = $('#f-cancel').onclick = closeForm;
$('#form').onsubmit = function (e) {
  e.preventDefault(); var i = BYID[formId], fd = new FormData(this), v = {};
  fieldsOf(i).forEach(function (f) { v[f.k] = (fd.get(f.k) || '').toString().trim(); });
  var old = S.forms[formId] || {}; v._saved = Date.now();
  var ll = formCoords || (!formReset && old._lat ? [old._lat, old._lng] : null); formReset = false; if (ll) { v._lat = ll[0]; v._lng = ll[1]; }
  S.forms[formId] = v; if (v.enqueteur) S.settings.enqueteur = v.enqueteur;
  if (!isDone(i)) S.visited[formId] = { t: Date.now(), mode: 'fiche' };
  save(); refreshMarker(i); updateProgress(); if (selId === formId) updateSheet(); if (!$('#drawer').hidden) renderList();
  closeForm(); toast('✅ Fiche enregistrée : ' + nameOf(i));
};

/* ───────── Export Excel / sauvegarde ───────── */
function updateSaveInfo() {
  var el = $('#save-info'); if (!el) return;
  el.textContent = INFRAS.filter(isDone).length + ' visitées · ' + INFRAS.filter(isFilled).length + ' fiches remplies' + (S.lastExport ? ' · dernier export : ' + stamp(S.lastExport) : ' · jamais exporté');
}
function utm(lat, lng) { try { proj4.defs('EPSG:32628', '+proj=utm +zone=28 +datum=WGS84 +units=m +no_defs'); var r = proj4('EPSG:4326', 'EPSG:32628', [lng, lat]); return [Math.round(r[0] * 10) / 10, Math.round(r[1] * 10) / 10]; } catch (e) { return ['', '']; } }
function buildWorkbook(onlyFilled) {
  var wb = XLSX.utils.book_new(), total = 0;
  Object.keys(CATS).forEach(function (k) {
    var c = CATS[k], rows = [];
    INFRAS.filter(function (i) { return i.cat === k && (!onlyFilled || isFilled(i)); }).forEach(function (i) {
      var f = S.forms[i.id], src = f || Object.assign({ quartier: i.quartier, nom: i.nom }, i.pre), p = posOf(i), u = utm(p[0], p[1]), r = {};
      r['ID'] = i.id; r['Quartier'] = src.quartier || i.quartier; r['Enqueteur'] = (f && f.enqueteur) || '';
      r['Infrastructure'] = c.type; r['Nom etablissement'] = src.nom || i.nom;
      c.fields.forEach(function (fl) {
        var v = src[fl.k] == null ? '' : src[fl.k];
        if (fl.t === 'number' && v !== '' && !isNaN(+v)) v = +v; else if (fl.t === 'date') v = dmy(toISO(v)); else if (fl.t === 'time') v = String(v).slice(0, 5);
        r[fl.l] = v;
      });
      r['Longitude'] = +p[1].toFixed(7); r['Latitude'] = +p[0].toFixed(7); r['UTM_X_28N'] = u[0]; r['UTM_Y_28N'] = u[1];
      r['Visite'] = isDone(i) ? 'Oui' : 'Non'; r['Date_visite'] = isDone(i) ? stamp(S.visited[i.id].t) : '';
      r['Fiche_remplie'] = f ? 'Oui' : 'Non'; r['Date_enquete'] = f ? stamp(f._saved) : '';
      r['Observations'] = (f && f.observations) || ''; rows.push(r);
    });
    if (rows.length) { var ws = XLSX.utils.json_to_sheet(rows); ws['!cols'] = Object.keys(rows[0]).map(function (h) { return { wch: Math.max(10, Math.min(34, h.length + 3)) }; }); XLSX.utils.book_append_sheet(wb, ws, c.sheet.slice(0, 31)); total += rows.length; }
  });
  var sv = INFRAS.map(function (i) { var p = posOf(i); return { ID: i.id, Nom: nameOf(i), Categorie: CATS[i.cat].label, Quartier: quartierOf(i), Latitude: +p[0].toFixed(7), Longitude: +p[1].toFixed(7), Visite: isDone(i) ? 'Oui' : 'Non', Date_visite: isDone(i) ? stamp(S.visited[i.id].t) : '', Mode: isDone(i) ? S.visited[i.id].mode : '', Fiche_remplie: isFilled(i) ? 'Oui' : 'Non' }; });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sv), 'Suivi_visites');
  return { wb: wb, total: total };
}
function xlsxBlob() {
  var b = buildWorkbook($('#only-filled').checked);
  var out = XLSX.write(b.wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
function fname(ext) { var d = new Date(); function z(n) { return ('0' + n).slice(-2); } return 'Fatick_enquetes_' + d.getFullYear() + z(d.getMonth() + 1) + z(d.getDate()) + '_' + z(d.getHours()) + z(d.getMinutes()) + '.' + ext; }
function download(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
$('#x-xlsx').onclick = function () { download(xlsxBlob(), fname('xlsx')); S.lastExport = Date.now(); save(); toast('📥 Fichier Excel prêt (dossier Téléchargements)'); };
$('#x-share').onclick = function () {
  var blob = xlsxBlob(), file = new File([blob], fname('xlsx'), { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: 'Enquêtes Fatick' }).then(function () { S.lastExport = Date.now(); save(); }).catch(function () {});
  else { download(blob, file.name); toast('Partage indisponible ici — fichier téléchargé'); }
};
$('#x-json').onclick = function () { download(new Blob([JSON.stringify({ app: 'fatick-terrain', v: 1, exported: Date.now(), visited: S.visited, forms: S.forms, settings: S.settings })], { type: 'application/json' }), fname('json')); S.lastExport = Date.now(); save(); toast('💾 Sauvegarde téléchargée'); };
$('#x-import').onchange = function () {
  var f = this.files[0]; if (!f) return; var rd = new FileReader();
  rd.onload = function () {
    try {
      var d = JSON.parse(rd.result); if (d.app !== 'fatick-terrain') throw 0;
      if (!confirm('Remplacer les données actuelles par la sauvegarde (' + Object.keys(d.visited || {}).length + ' visites, ' + Object.keys(d.forms || {}).length + ' fiches) ?')) return;
      S.visited = d.visited || {}; S.forms = d.forms || {}; Object.assign(S.settings, d.settings || {}); save(); INFRAS.forEach(refreshMarker); updateProgress(); toast('Sauvegarde restaurée');
    } catch (e) { toast('Fichier de sauvegarde invalide'); }
  }; rd.readAsText(f); this.value = '';
};

/* ───────── Démarrage ───────── */
updateProgress(); updateSaveInfo(); startGPS(); if (fixed) { save(); INFRAS.forEach(refreshMarker); toast('🔧 ' + fixed + ' position(s) erronée(s) remise(s) à l’emplacement d’origine', 6000); }
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('sw.js').catch(function () {});
window.__ft = { S: S, select: select, openForm: openForm, buildWorkbook: buildWorkbook };
})();
