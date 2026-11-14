/* Mi TV – launcher para LG webOS
 * - Pestaña "Apps": abre las apps oficiales instaladas en el TV (YouTube, Netflix…)
 * - Pestaña "Canales en vivo": reproduce canales de una lista M3U (HLS)
 * Control remoto: flechas, OK, ATRÁS, CH+/CH-.
 */
(function () {
  'use strict';

  // ---------- Configuración ----------
  // id = app en webOS (TV LG) · android = paquetes posibles en Android TV / Google TV / Fire TV.
  // Si una app no está instalada, verás un aviso.
  var IS_ANDROID = typeof window.Android !== 'undefined';
  var APPS = [
    { name: 'YouTube',      id: 'youtube.leanback.v4',        color: '#ff0033', glyph: '▶', web: 'https://www.youtube.com/tv',
      android: ['com.google.android.youtube.tv', 'com.amazon.firetv.youtube', 'com.google.android.youtube'] },
    { name: 'Netflix',      id: 'netflix',                    color: '#b20710', glyph: 'N',
      android: ['com.netflix.ninja', 'com.netflix.mediaclient'] },
    { name: 'Prime Video',  id: 'amazon',                     color: '#00a8e1', glyph: 'P',
      android: ['com.amazon.amazonvideo.livingroom', 'com.amazon.avod', 'com.amazon.avod.thirdpartyclient'] },
    { name: 'Disney+',      id: 'com.disney.disneyplus-prod', color: '#113ccf', glyph: 'D+',
      android: ['com.disney.disneyplus'] },
    { name: 'Max',          id: 'com.hbo.hbomax',             color: '#002be7', glyph: 'M',
      android: ['com.wbd.stream', 'com.hbo.hbonow', 'com.hbo.max.android.tv'] },
    { name: 'Apple TV',     id: 'com.apple.appletv',          color: '#333333', glyph: 'tv',
      android: ['com.apple.atve.androidtv.appletv', 'com.apple.atve.amazon.appletv', 'com.apple.atve.sony.appletv'] },
    { name: 'Pluto TV',     id: 'com.pluto.tv',               color: '#2b2b6b', glyph: '◐',
      android: ['tv.pluto.android'] },
    { name: 'LG Channels',  id: 'com.webos.app.lgchannels',   color: '#a50034', glyph: 'LG', webosOnly: true },
    { name: 'Spotify',      id: 'spotify-beehive',            color: '#1db954', glyph: '♫',
      android: ['com.spotify.tv.android', 'com.spotify.music'] },
    { name: 'Navegador',    id: 'com.webos.app.browser',      color: '#4b5878', glyph: '🌐', webosOnly: true },
    { name: 'Twitch',       androidOnly: true,                color: '#9146ff', glyph: 'T',
      android: ['tv.twitch.android.app', 'tv.twitch.android.viewer'] },
    { name: 'Ajustes',      androidOnly: true,                color: '#4b5878', glyph: '⚙',
      android: ['com.android.tv.settings', 'com.amazon.tv.settings.v2', 'com.android.settings'] }
  ].filter(function (a) { return IS_ANDROID ? !a.webosOnly : !a.androidOnly; });
  var CL_URL = 'https://m3u.cl/lista/CL.m3u';                        // lista chilena en línea (se actualiza sola)
  var LOCAL_M3U = 'channels/chile.m3u';                              // copia incluida, por si no hay conexión con m3u.cl
  var DEFAULT_M3U = 'https://iptv-org.github.io/iptv/countries/cl.m3u'; // lista extra (se cambia en Ajustes)
  var EXTRA_GROUP = 'Más canales';
  // Canales gratuitos de todo el mundo (proyecto Free-TV/IPTV en GitHub)
  var INTL_URL = 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8';
  var INTL_GROUP = '🌎 Internacional', INTL_PREFIX = 'intl:';
  var INTL_FIRST = ['Argentina', 'Mexico', 'Spain', 'Peru', 'Venezuela', 'Costa Rica', 'Colombia', 'Uruguay', 'Ecuador',
    'Bolivia', 'Paraguay', 'Dominican Republic', 'Cuba', 'Panama', 'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua',
    'Puerto Rico', 'News (ES)', 'Chile'];
  var INTL_ES = {
    'Mexico': 'México', 'Spain': 'España', 'Peru': 'Perú', 'News (ES)': 'Noticias en español', 'Italy': 'Italia',
    'VOD Italy': 'Italia (a pedido)', 'Poland': 'Polonia', 'Hungary': 'Hungría', 'Greece': 'Grecia', 'Russia': 'Rusia',
    'UK': 'Reino Unido', 'Ukraine': 'Ucrania', 'News': 'Noticias en inglés', 'United Arab Emirates': 'Emiratos Árabes',
    'Germany': 'Alemania', 'France': 'Francia', 'USA': 'Estados Unidos', 'Czech Republic': 'República Checa',
    'VOD Movies (EN)': 'Películas a pedido (inglés)', 'Croatia': 'Croacia', 'Korea': 'Corea', '日本 / Japan': 'Japón',
    'Canada': 'Canadá', 'Ireland': 'Irlanda', 'Belarus': 'Bielorrusia', 'Turkey': 'Turquía', 'Romania': 'Rumania',
    'Lebanon': 'Líbano', 'Sweden': 'Suecia', 'Saudi Arabia': 'Arabia Saudita', 'Iraq': 'Irak', 'Taiwan': 'Taiwán',
    'Netherlands': 'Países Bajos', 'Egypt': 'Egipto', 'Denmark': 'Dinamarca', 'Brazil': 'Brasil', 'Lithuania': 'Lituania',
    'Belgium': 'Bélgica', 'News (AR)': 'Noticias en árabe', 'Business': 'Negocios', 'Switzerland': 'Suiza',
    'Norway': 'Noruega', 'Weather': 'Clima', 'Music (EN)': 'Música (inglés)', 'Finland': 'Finlandia',
    'North Macedonia': 'Macedonia del Norte', 'Iran': 'Irán', 'Bosnia and Herzegovina': 'Bosnia', 'Panama': 'Panamá',
    'Dominican Republic': 'República Dominicana', 'Slovakia': 'Eslovaquia', 'Cyprus': 'Chipre', 'Latvia': 'Letonia',
    'Kenya': 'Kenia', 'North Korea': 'Corea del Norte', 'Azerbaijan': 'Azerbaiyán', 'Moldova': 'Moldavia',
    'Qatar': 'Catar', 'Turkmenistan': 'Turkmenistán', 'Macau': 'Macao', 'Albania': 'Albania', 'Japan': 'Japón'
  };
  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 461, BACKSPACE: 8, ESC: 27, CH_UP: 33, CH_DOWN: 34,
    RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406, MENU: 1001, M: 77, P: 80 };

  // ---------- Utilidades ----------
  var $ = function (id) { return document.getElementById(id); };
  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }
  var toastTimer;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.add('hidden'); }, 3500);
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- webOS: lanzar apps ----------
  function lunaCall(uri, params, cb) {
    if (typeof window.PalmServiceBridge === 'undefined') { cb && cb({ returnValue: false, notWebOS: true }); return; }
    var bridge = new window.PalmServiceBridge();
    bridge.onservicecallback = function (msg) {
      var res; try { res = JSON.parse(msg); } catch (e) { res = { returnValue: false }; }
      cb && cb(res);
    };
    bridge.call(uri, JSON.stringify(params || {}));
  }
  function launchApp(app) {
    if (IS_ANDROID) {
      var ok = false;
      try { ok = window.Android.launchApp(JSON.stringify(app.android || [])); } catch (e) { ok = false; }
      if (!ok) toast('"' + app.name + '" no está instalada en este dispositivo');
      return;
    }
    lunaCall('luna://com.webos.applicationManager/launch', { id: app.id }, function (res) {
      if (res.notWebOS) {
        if (app.web) window.open(app.web, '_blank');
        else toast('Abrir "' + app.name + '" solo funciona en el TV LG');
      } else if (!res.returnValue) {
        toast('"' + app.name + '" no está instalada en este TV');
      }
    });
  }

  // ---------- Navegación con control remoto ----------
  var focused = null;
  // Grilla de canales: navegación por índice (rápida aunque haya cientos de canales)
  var gridCols = 0, gridPitch = 0;
  function gridEl(i) { var g = $('channelGrid'); return filtered.length ? g.children[i] || null : null; }
  function gridMeasure() {
    var a = gridEl(0);
    if (!a || !a.offsetParent) return false;
    var top = a.offsetTop, n = 1, b;
    while ((b = gridEl(n)) && b.offsetTop === top) n++;
    gridCols = n;
    var r2 = gridEl(n);
    gridPitch = r2 ? r2.offsetTop - top : a.offsetHeight + 28;
    return true;
  }
  function firstVisibleChannel() {
    if (!filtered.length || !$('channelGrid').offsetParent) return null;
    if (!gridCols && !gridMeasure()) return null;
    var row = Math.round($('channelGrid').scrollTop / (gridPitch || 1));
    return gridEl(Math.min(filtered.length - 1, row * gridCols));
  }
  function gridMove(dir) {
    if (!gridCols && !gridMeasure()) return false;
    var i = +focused.getAttribute('data-ch'), n = filtered.length, c = gridCols, t = -1;
    if (dir === 'left') { if (i % c === 0) return true; t = i - 1; }
    else if (dir === 'right') { if (i % c === c - 1 || i + 1 >= n) return true; t = i + 1; }
    else if (dir === 'down') {
      if (i + c < n) t = i + c;
      else if (Math.floor(i / c) < Math.floor((n - 1) / c)) t = n - 1;
      else return true;
    }
    else if (dir === 'up') { if (i - c < 0) return false; t = i - c; }
    setFocus(gridEl(t));
    return true;
  }
  function visibleFocusables() {
    var scope = menuOpen ? '#chMenu .focusable' : '.focusable:not(.ch)';
    var list = Array.prototype.filter.call(document.querySelectorAll(scope), function (el) {
      return el.offsetParent !== null;
    });
    if (!menuOpen) {
      if (focused && focused.classList.contains('ch')) list.push(focused);
      else { var fv = firstVisibleChannel(); if (fv) list.push(fv); }
    }
    return list;
  }
  function setFocus(el) {
    if (!el) return;
    if (focused) focused.classList.remove('focused');
    focused = el; el.classList.add('focused');
    if (el.tagName === 'INPUT') el.focus(); else if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
    if (el.classList.contains('ch')) scrollGridTo(el);
    else if (el.scrollIntoView && !el.classList.contains('key')) el.scrollIntoView({ block: 'nearest' });
  }
  function scrollGridTo(el) {
    var g = $('channelGrid'), top = el.offsetTop - g.offsetTop, h = el.offsetHeight;
    if (top - 20 < g.scrollTop) g.scrollTop = Math.max(0, top - 20);
    else if (top + h + 20 > g.scrollTop + g.clientHeight) g.scrollTop = top + h + 20 - g.clientHeight;
    scheduleLogos();
  }
  function move(dir) {
    if (!menuOpen && focused && focused.classList.contains('ch') && gridMove(dir)) return;
    var list = visibleFocusables();
    if (!focused || list.indexOf(focused) < 0) { setFocus(list[0]); return; }
    var a = focused.getBoundingClientRect();
    var ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    var best = null, bestScore = Infinity;
    list.forEach(function (el) {
      if (el === focused) return;
      var b = el.getBoundingClientRect();
      var bx = b.left + b.width / 2, by = b.top + b.height / 2;
      var dx = bx - ax, dy = by - ay, main, cross;
      if (dir === 'left')  { if (dx >= -1) return; main = -dx; cross = Math.abs(dy); }
      if (dir === 'right') { if (dx <= 1)  return; main = dx;  cross = Math.abs(dy); }
      if (dir === 'up')    { if (dy >= -1) return; main = -dy; cross = Math.abs(dx); }
      if (dir === 'down')  { if (dy <= 1)  return; main = dy;  cross = Math.abs(dx); }
      var score = main + cross * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) setFocus(best);
  }

  // ---------- Vistas ----------
  var currentView = 'apps';
  function showView(name) {
    currentView = name;
    ['apps', 'live', 'settings'].forEach(function (v) { $('view-' + v).classList.toggle('hidden', v !== name); });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.classList.toggle('active', t.getAttribute('data-view') === name);
    });
    if (name === 'live' && !channels.length && !loadingChannels) loadChannels();
    if (name === 'live') setTimeout(loadLogos, 0);
    if (name === 'settings') { $('m3uInput').value = store('m3u') || DEFAULT_M3U; updateSettingsInfo(); }
  }

  function renderApps() {
    $('appsGrid').innerHTML = APPS.map(function (a, i) {
      return '<button class="tile focusable" data-app="' + i + '" style="background:' + a.color + '">' +
        '<span class="glyph">' + escapeHtml(a.glyph) + '</span>' + escapeHtml(a.name) + '</button>';
    }).join('');
  }

  // ---------- Canales (M3U) ----------
  var channels = [], filtered = [], groups = [], activeGroup = 'Todos', currentIndex = -1;

  function parseM3U(text) {
    var out = [], lines = text.split(/\r?\n/), meta = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      if (line.indexOf('#EXTINF') === 0) {
        var attr = function (n) { var m = line.match(new RegExp(n + '="([^"]*)"')); return m ? m[1] : ''; };
        var comma = line.lastIndexOf(',');
        var rawName = comma >= 0 ? line.slice(comma + 1) : '';
        meta = {
          name: rawName.replace(/\s*\|\s*CL\s*$/, '').replace(/[✪\u24B6-\u24E9]/g, '')
            .replace(/\s*[\[(][^\])]*[\])]\s*/g, ' ').replace(/\s+/g, ' ').trim() || 'Canal',
          logo: attr('tvg-logo'),
          star: rawName.indexOf('✪') >= 0,
          group: (attr('group-title') || '').split(';')[0]
        };
      } else if (line.charAt(0) !== '#' && meta) {
        meta.url = line; out.push(meta); meta = null;
      }
    }
    return out;
  }

  // ---------- Categorías de la lista chilena (m3u.cl no trae grupos) ----------
  var CL_GROUPS = ['Nacionales', 'Regionales', 'Deportes', 'Temáticos', 'Cultura y universidades', 'Música y radios', 'Religiosos'];
  var CL_NATIONAL = ['TVN', 'Mega', 'CHV', 'Canal 13', 'La Red', 'TV+', 'Bio Bio TV', 'TVN 24 Horas', 'Meganoticias', 'T13',
    'TV Chile', 'NTV', 'TVN3', 'TVN - Reuters', 'T13 Radio', 'VideoHit'];
  function setOf(arr) { var o = {}; arr.forEach(function (n) { o[normName(n)] = 1; }); return o; }
  var CL_SETS = {
    'Deportes': setOf(['CHV Deportes', 'FutGO', 'D13', 'Teletrak', 'TV Turf', 'Valparaiso Sporting']),
    'Cultura y universidades': setOf(['U Chile TV', 'UCV', 'UCV 2', 'STGO.TV', 'UTalcaTV', 'TVU', 'Universidad Autonoma TV', 'TV UCT',
      'Ufrovision', 'U Los Lagos', 'UMAG TV', 'UMAG TV 2', 'UesTV', 'Frecuencia Cultural', 'Poesia TV', 'Autonoma TV', 'Radio UC',
      'Autonoma Radio', 'Camara de Diputados', 'TV Senado', 'Qultura']),
    'Religiosos': setOf(['TNE', 'Televida HD', 'Restaurando Vidas TV', 'Radio Vida Curico', 'NCTV', 'Gracia TV', 'Canal ISB',
      'Casa Sobre La Roca TV', 'Metanoia TV', 'IPNA Medio', 'Enlace BPB', 'Escuchame Radio', 'Fortaleza Radio', 'Fortaleza TV',
      'CESTV', 'ADA TV', 'El Sembrador', 'Apocalipsis TV', 'Vida Nueva TV', 'Primicia Vida Television', 'Radio Acogida'])
  };
  var CL_NAT_SET = setOf(CL_NATIONAL);
  var CL_MUSIC = /radio|\bfm\b|cooperativa|^adn$|la metro|la clave|duna|pudahuel|radioactiva|la nuestra|el conquistador|ritmo|pauta tv|music|musica|dj |remix|top new|dance|sabros|tropical|ranchero|metal|ruidos|concert|bailalo|tributo|rewind|carolina tv|maxima|red circle|subela|ciudadano|interradio|revolviendola/i;
  function chileGroup(c) {
    var k = normName(c.name);
    if (CL_NAT_SET[k] || /^13 /.test(c.name)) return 'Nacionales';
    for (var g in CL_SETS) if (CL_SETS[g][k]) return g;
    if (CL_MUSIC.test(c.name)) return 'Música y radios';
    if (c.star) return 'Temáticos';
    return 'Regionales';
  }
  function sortChile(list) {
    list = list.filter(function (c) { return !/listas en m3u/i.test(c.name); });
    list.forEach(function (c, i) {
      c.group = chileGroup(c);
      var nat = CL_NATIONAL.map(normName).indexOf(normName(c.name));
      c._k = CL_GROUPS.indexOf(c.group) * 100000 + (c.group === 'Nacionales' ? (nat < 0 ? 900 : nat) * 100 : 0) + i;
    });
    return list.sort(function (a, b) { return a._k - b._k; });
  }

  // XHR en vez de fetch(): fetch no puede leer archivos locales (file://) en el TV.
  function getText(url) {
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      x.open('GET', url, true);
      x.timeout = 12000;
      x.onload = function () {
        if ((x.status === 0 || (x.status >= 200 && x.status < 300)) && x.responseText) resolve(x.responseText);
        else reject(new Error('HTTP ' + x.status));
      };
      x.onerror = function () { reject(new Error('sin conexión')); };
      x.ontimeout = function () { reject(new Error('tiempo agotado')); };
      x.send();
    });
  }
  function normName(n) { return n.toLowerCase().replace(/[^a-z0-9ñ]/g, ''); }

  // Lista con caché: abre al instante con la última copia y la renueva cada 6 horas
  function cachedGet(url, maxAgeMs) {
    var key = 'cache:' + url, cached = store(key), at = +(store(key + ':at') || 0);
    if (cached && Date.now() - at < maxAgeMs) return Promise.resolve(cached);
    return getText(url).then(function (t) {
      if (parseM3U(t).length) { store(key, t); store(key + ':at', String(Date.now())); }
      return t;
    }).catch(function (e) { if (cached) return cached; throw e; });
  }
  var loadingChannels = false;
  function loadChannels() {
    loadingChannels = true;
    var extraUrl = store('m3u') || DEFAULT_M3U;
    $('liveStatus').textContent = 'Cargando lista de canales…';
    $('liveStatus').classList.remove('hidden');
    $('channelGrid').innerHTML = ''; $('groupBar').innerHTML = '';
    var asList = function (t) { var l = parseM3U(t); if (!l.length) throw new Error('vacía'); return l; };
    var SIX_H = 6 * 3600 * 1000;
    var chile = cachedGet(CL_URL, SIX_H).then(asList)
      .catch(function () { return getText(LOCAL_M3U).then(asList); })
      .then(sortChile)
      .catch(function () { return []; });
    var extra = cachedGet(extraUrl, SIX_H).then(parseM3U).catch(function () { return []; });
    var intl = cachedGet(INTL_URL, SIX_H).then(parseM3U).catch(function () { return []; });
    Promise.all([chile, extra, intl]).then(function (lists) {
      var seen = {};
      channels = [];
      lists[0].forEach(function (c) { seen[normName(c.name)] = 1; channels.push(c); });
      lists[1].forEach(function (c) {
        var k = normName(c.name);
        if (seen[k]) return;           // ya está en la lista chilena
        seen[k] = 1; c.group = EXTRA_GROUP; channels.push(c);
      });
      lists[2].forEach(function (c) {
        if (/youtube\.com|youtu\.be|twitch\.tv/i.test(c.url)) return;   // no se pueden reproducir directo
        var k = normName(c.name);
        if (seen[k]) return;
        seen[k] = 1;
        c.intl = true;
        c.country = c.group || 'Otros';
        c.group = INTL_PREFIX + c.country;
        channels.push(c);
      });
      if (!channels.length) throw new Error('las listas están vacías');
      activeGroup = listFor(FAV_GROUP).length ? FAV_GROUP : 'Todos';
      refreshChannels();
      if (!lists[1].length) $('liveStatus').textContent += ' (no se pudo cargar la lista extra de Ajustes)';
      loadingChannels = false;
    }).catch(function (e) {
      channels = []; loadingChannels = false;
      $('liveStatus').textContent = 'No se pudo cargar la lista (' + e.message + '). Revisa la URL en Ajustes.';
    });
  }

  window.mitvImgFail = function (img) {
    var ph = document.createElement('div');
    ph.className = 'ph'; ph.textContent = img.getAttribute('data-i') || '';
    img.parentNode.replaceChild(ph, img);
  };

  // ---------- Favoritos y ocultos ----------
  var FAV_GROUP = '★ Favoritos', HID_GROUP = 'Ocultos', SEARCH_GROUP = 'Búsqueda';
  var searchOpen = false, searchQuery = '';
  function fold(t) {
    t = String(t).toLowerCase();
    if (t.normalize) t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return t;
  }
  function loadSet(k) {
    var o = {};
    try { (JSON.parse(store(k) || '[]') || []).forEach(function (x) { o[x] = 1; }); } catch (e) { }
    return o;
  }
  function saveSet(k, o) { store(k, JSON.stringify(Object.keys(o))); }
  var favs = loadSet('favs'), hiddenSet = loadSet('hidden');
  function chKey(c) { return normName(c.name); }
  function isFav(c) { return !!favs[chKey(c)]; }
  function isHidden(c) { return !!hiddenSet[chKey(c)]; }

  function listFor(group) {
    if (group === HID_GROUP) return channels.filter(isHidden);
    var vis = channels.filter(function (c) { return !isHidden(c); });
    if (group === SEARCH_GROUP) {
      var words = fold(searchQuery).trim().split(/\s+/).filter(Boolean);
      if (!words.length) return [];
      return vis.filter(function (c) {
        var n = fold(c.name);
        return words.every(function (w) { return n.indexOf(w) >= 0; });
      });
    }
    if (group === FAV_GROUP) return vis.filter(isFav);
    if (group === 'Todos') return vis.filter(function (c) { return !c.intl; });
    if (group === INTL_GROUP) return intlCountries(vis);
    return vis.filter(function (c) { return c.group === group; });
  }
  function countryName(c) { return INTL_ES[c] || c; }
  // Recuadros de países para la sección Internacional
  function intlCountries(vis) {
    var counts = {};
    vis.forEach(function (c) { if (c.intl) counts[c.country] = (counts[c.country] || 0) + 1; });
    return Object.keys(counts).sort(function (a, b) {
      var ia = INTL_FIRST.indexOf(a), ib = INTL_FIRST.indexOf(b);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
      return countryName(a).localeCompare(countryName(b), 'es');
    }).map(function (k) { return { isCountry: true, country: k, name: countryName(k), count: counts[k] }; });
  }
  function intlCount() { return channels.filter(function (c) { return c.intl && !isHidden(c); }).length; }
  function buildGroups() {
    var g = [];
    if (listFor(FAV_GROUP).length) g.push(FAV_GROUP);
    g.push('Todos');
    var seen = {};
    listFor('Todos').forEach(function (c) { if (!seen[c.group]) { seen[c.group] = 1; g.push(c.group); } });
    if (intlCount()) g.push(INTL_GROUP);
    if (Object.keys(hiddenSet).length && listFor(HID_GROUP).length) g.push(HID_GROUP);
    groups = g;
    var inCountry = activeGroup.indexOf(INTL_PREFIX) === 0 && listFor(activeGroup).length;
    if (groups.indexOf(activeGroup) < 0 && activeGroup !== SEARCH_GROUP && !inCountry) activeGroup = groups[0];
  }
  function groupLabel(g) {
    if (g === HID_GROUP) return '🚫 Ocultos (' + listFor(HID_GROUP).length + ')';
    if (g.indexOf(INTL_PREFIX) === 0) return '🌎 ' + countryName(g.slice(INTL_PREFIX.length));
    return g;
  }

  function renderGroups() {
    $('groupBar').innerHTML = groups.map(function (g) {
      var on = g === activeGroup || (g === INTL_GROUP && activeGroup.indexOf(INTL_PREFIX) === 0);
      return '<button class="chip focusable' + (on ? ' active' : '') + '" data-group="' + escapeHtml(g) + '">' + escapeHtml(groupLabel(g)) + '</button>';
    }).join('');
  }

  function logoHtml(c, eager) {
    return c.logo
      ? '<img ' + (eager ? 'src' : 'data-src') + '="' + escapeHtml(c.logo) + '" alt="" data-i="' + escapeHtml(c.name.charAt(0)) + '" onerror="mitvImgFail(this)">'
      : '<div class="ph">' + escapeHtml(c.name.charAt(0)) + '</div>';
  }
  function renderChannels() {
    filtered = listFor(activeGroup);
    $('channelGrid').innerHTML = filtered.map(function (c, i) {
      if (c.isCountry) {
        return '<button class="ch country focusable" data-ch="' + i + '"><div class="ph globe">🌎</div>' +
          '<span class="nm">' + escapeHtml(c.name) + '</span><span class="cnt">' + c.count + ' canales</span></button>';
      }
      var now = nowCh && chKey(nowCh) === chKey(c);
      return '<button class="ch focusable' + (now ? ' now' : '') + '" data-ch="' + i + '">' +
        (isFav(c) ? '<span class="badge fav">★</span>' : '') + (now ? '<span class="badge live">EN VIVO</span>' : '') +
        logoHtml(c) + '<span class="nm">' + escapeHtml(c.name) + '</span></button>';
    }).join('');
    gridCols = 0; gridPitch = 0;
    $('channelGrid').scrollTop = 0;
    setTimeout(loadLogos, 0);
    if (!filtered.length) {
      var msg = activeGroup !== SEARCH_GROUP ? 'No hay canales en esta categoría.'
        : (searchQuery.trim() ? 'No se encontraron canales con «' + escapeHtml(searchQuery.trim()) + '».' : 'Escribe el nombre del canal con el teclado de arriba.');
      $('channelGrid').innerHTML = '<p class="status">' + msg + '</p>';
    }
  }
  // Carga solo los logos de las filas visibles (ahorra memoria y red en el TV)
  function loadLogos() {
    var g = $('channelGrid');
    if (!filtered.length || !g.offsetParent) return;
    if (!gridCols && !gridMeasure()) return;
    var first = Math.max(0, Math.floor(g.scrollTop / gridPitch) - 1) * gridCols;
    var last = Math.min(filtered.length, (Math.ceil((g.scrollTop + g.clientHeight) / gridPitch) + 2) * gridCols);
    for (var i = first; i < last; i++) {
      var img = g.children[i] && g.children[i].querySelector('img[data-src]');
      if (img) { img.src = img.getAttribute('data-src'); img.removeAttribute('data-src'); }
    }
  }
  var logoTimer = 0;
  function scheduleLogos() {
    if (logoTimer) return;
    logoTimer = setTimeout(function () { logoTimer = 0; loadLogos(); }, 60);
  }
  $('channelGrid').addEventListener('scroll', scheduleLogos);

  function updateCountryStatus() {
    $('liveStatus').textContent = '🌎 Internacional › ' + countryName(activeGroup.slice(INTL_PREFIX.length)) + ' · ' +
      filtered.length + ' canales · ATRÁS para volver a los países';
  }
  function openCountry(item) {
    activeGroup = INTL_PREFIX + item.country;
    renderGroups(); renderChannels(); markPlaying(); updateCountryStatus();
    setFocus(gridEl(0));
  }
  function backToCountries() {
    var country = activeGroup.slice(INTL_PREFIX.length);
    activeGroup = INTL_GROUP;
    renderGroups(); renderChannels(); refreshChannels();
    for (var i = 0; i < filtered.length; i++) if (filtered[i].country === country) { setFocus(gridEl(i)); scrollGridTo(gridEl(i)); break; }
  }

  // Vuelve a dibujar todo manteniendo el foco en una posición parecida
  function refreshChannels() {
    var idx = focused && focused.hasAttribute('data-ch') ? +focused.getAttribute('data-ch') : -1;
    buildGroups(); renderGroups(); renderChannels();
    if (searchOpen) updateSearchStatus(); else if (activeGroup.indexOf(INTL_PREFIX) === 0) updateCountryStatus();
    else $('liveStatus').textContent = listFor('Todos').length + ' canales de Chile' + (intlCount() ? ' · ' + intlCount() + ' internacionales' : '') +
      (Object.keys(favs).length ? ' · ' + listFor(FAV_GROUP).length + ' favoritos' : '') +
      (listFor(HID_GROUP).length ? ' · ' + listFor(HID_GROUP).length + ' ocultos' : '');
    if (idx >= 0 && currentView === 'live') {
      var el = document.querySelector('[data-ch="' + Math.min(idx, filtered.length - 1) + '"]');
      setFocus(el || document.querySelector('.chip.active'));
    }
  }


  // ---------- Búsqueda (lupa) con teclado en pantalla ----------
  var KBD_ROWS = [
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
    ['K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S'],
    ['T', 'U', 'V', 'W', 'X', 'Y', 'Z', '1', '2', '3'],
    ['4', '5', '6', '7', '8', '9', '0', '+', 'DEL'],
    ['MIC', 'SPACE', 'CLEAR', 'CLOSE']
  ];
  var KBD_LABEL = { MIC: '🎤 Buscar por voz', DEL: '⌫ Borrar', SPACE: 'Espacio', CLEAR: 'Borrar todo', CLOSE: '✕ Cerrar búsqueda' };
  function renderKeyboard() {
    $('kbd').innerHTML = KBD_ROWS.map(function (row) {
      return '<div class="krow">' + row.map(function (k) {
        return '<button class="key focusable' + (KBD_LABEL[k] ? ' wide' : '') + '" data-k="' + k + '">' + escapeHtml(KBD_LABEL[k] || k) + '</button>';
      }).join('') + '</div>';
    }).join('');
  }
  function openSearch() {
    if (!channels.length) return;
    searchOpen = true;
    activeGroup = SEARCH_GROUP;
    $('view-live').classList.add('searching');
    $('searchPanel').classList.remove('hidden');
    $('searchBtn').classList.add('active');
    renderGroups(); updateSearch();
    setFocus(document.querySelector('.key[data-k="A"]'));
  }
  function closeSearch(keepGroup) {
    searchOpen = false; searchQuery = '';
    $('view-live').classList.remove('searching');
    $('searchPanel').classList.add('hidden');
    $('searchBtn').classList.remove('active');
    if (!keepGroup) { activeGroup = groups.indexOf(FAV_GROUP) >= 0 ? FAV_GROUP : 'Todos'; }
    refreshChannels(); markPlaying();
    if (!keepGroup) setFocus($('searchBtn'));
  }
  function updateSearch() {
    if ($('searchInput').value !== searchQuery) $('searchInput').value = searchQuery;
    renderChannels(); markPlaying(); updateSearchStatus();
  }
  function updateSearchStatus() {
    var q = searchQuery.trim();
    $('liveStatus').textContent = q ? filtered.length + ' resultado' + (filtered.length === 1 ? '' : 's') + ' para «' + q + '» · ▼ para ir a los resultados' : 'Buscar canal';
  }
  function pressKey(k) {
    if (k === 'DEL') searchQuery = searchQuery.slice(0, -1);
    else if (k === 'SPACE') searchQuery += ' ';
    else if (k === 'CLEAR') searchQuery = '';
    else if (k === 'CLOSE') { closeSearch(false); return; }
    else if (k === 'MIC') { startVoice(); return; }
    else searchQuery += k.toLowerCase();
    updateSearch();
  }
  // ---------- Búsqueda por voz ----------
  // Android: reconocedor de voz de Google del dispositivo. Navegador de PC: Web Speech API.
  var listening = false;
  function startVoice() {
    if (listening) return;
    if (IS_ANDROID) {
      if (typeof window.Android.voiceSearch !== 'function') { toast('Para buscar por voz instala la nueva versión del APK'); return; }
      if (!window.Android.voiceSearch()) { toast('Este dispositivo no tiene búsqueda por voz (instala "Google" desde la tienda)'); return; }
      setListening(true);
      return;
    }
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Búsqueda por voz no disponible aquí. En el TV LG usa el micrófono del Magic Remote sobre el cuadro de texto.'); return; }
    var rec = new SR();
    rec.lang = 'es-CL'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = function (e) { window.mitvVoiceResult(e.results[0][0].transcript); };
    rec.onerror = function () { setListening(false); toast('No te escuché bien, intenta otra vez'); };
    rec.onend = function () { setListening(false); };
    try { rec.start(); setListening(true); } catch (e) { toast('No se pudo usar el micrófono'); }
  }
  function setListening(on) {
    listening = on;
    $('voiceBtn').classList.toggle('on', on);
    if (on) toast('🎤 Habla ahora: di el nombre del canal');
  }
  // Limpia frases como "pon el canal 13" -> "canal 13"
  function cleanVoice(t) {
    t = String(t || '').toLowerCase().trim().replace(/[.,!?¿¡]/g, '');
    var prev;
    do {
      prev = t;
      t = t.replace(/^(quiero ver|quiero|pon(me|er)?|coloca(r)?|ver|mira(r)?|busca(r)?|buscame|búscame|abre|abrir|muéstrame|muestrame|el|la|los|las|un|una)\s+/, '');
    } while (t !== prev);
    return t.trim();
  }
  window.mitvVoiceResult = function (text) {
    setListening(false);
    var q = cleanVoice(text);
    if (!q) { toast('No te escuché bien, intenta otra vez'); return; }
    if (mode === 'full') minimize();
    if (currentView !== 'live') showView('live');
    if (!searchOpen) openSearch();
    searchQuery = q; updateSearch();
    var first = gridEl(0);
    if (filtered.length && first) { setFocus(first); toast('🎤 «' + q + '»: ' + filtered.length + ' resultado' + (filtered.length === 1 ? '' : 's') + ' · OK para ver'); }
    else toast('🎤 «' + q + '»: no encontré canales con ese nombre');
  };
  // Botón de micrófono / búsqueda del control remoto
  window.mitvVoiceKey = function () {
    if (menuOpen) closeMenu();
    if (mode === 'full') minimize();
    if (currentView !== 'live') showView('live');
    if (!searchOpen) openSearch();
    startVoice();
  };

  $('searchInput').addEventListener('input', function () { searchQuery = $('searchInput').value; updateSearch(); });
  renderKeyboard();

  // ---------- Reproductor: pantalla completa, PiP y lista lateral ----------
  var hls = null, osdTimer, sideTimer;
  var mode = 'none';                 // 'none' | 'full' | 'pip'
  var nowCh = null, zapList = [], zapIdx = -1, zapGroup = 'Todos';
  var sideOpen = false, sideGroup = 'Todos', sideList = [], sideIdx = 0;

  function playChannel(list, idx, group, newMode) {
    if (!list.length) return;
    zapList = list; zapIdx = (idx + list.length) % list.length; zapGroup = group;
    nowCh = zapList[zapIdx];
    setMode(newMode || (mode === 'none' ? 'full' : mode));
    $('playerError').classList.add('hidden');
    $('spinner').classList.remove('hidden');
    $('osdName').textContent = (isFav(nowCh) ? '★ ' : '') + nowCh.name;
    $('pipName').textContent = nowCh.name;
    $('osdLogo').src = nowCh.logo || ''; $('osdLogo').style.display = nowCh.logo ? '' : 'none';
    showOsd();
    var zapping = !!(hls || $('video').getAttribute('src'));
    stopVideo();
    clearTimeout(startTimer);
    // Al cambiar rápido de canal (▲▼) solo se conecta al que dejas puesto
    var target = nowCh;
    startTimer = setTimeout(function () { if (target === nowCh) startStream(target); }, zapping ? 350 : 0);
    markPlaying();
    if (sideOpen) updateSideMarks();
  }
  var startTimer = null;
  var HLS_CONFIG = {
    enableWorker: true, lowLatencyMode: false, startLevel: -1,
    capLevelToPlayerSize: true,          // en PiP usa una calidad menor
    maxBufferLength: 20, maxMaxBufferLength: 40, backBufferLength: 10,
    manifestLoadingTimeOut: 10000, levelLoadingTimeOut: 10000, fragLoadingTimeOut: 15000
  };
  function startStream(ch) {
    var video = $('video');
    if (window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls(HLS_CONFIG);
      hls.loadSource(ch.url);
      hls.attachMedia(video);
      hls.on(window.Hls.Events.ERROR, function (_, d) {
        if (!d.fatal) return;
        if (d.type === window.Hls.ErrorTypes.MEDIA_ERROR && !ch._retried) { ch._retried = true; hls.recoverMediaError(); return; }
        playError();
      });
    } else {
      video.src = ch.url; // webOS reproduce HLS de forma nativa
    }
    if (video.play) { var p = video.play(); if (p && p.catch) p.catch(function () { }); }
  }
  function zap(step) { playChannel(zapList, zapIdx + step, zapGroup); }

  function setMode(m) {
    mode = m;
    var p = $('player');
    p.classList.toggle('hidden', m === 'none');
    p.classList.toggle('pip', m === 'pip');
    if (m !== 'full') closeSide();
    if (m === 'full') showOsd();
  }
  function minimize() {           // pantalla completa -> PiP
    setMode('pip');
    if (currentView !== 'live') showView('live');
    var i = filtered.indexOf(nowCh);
    var el = i >= 0 ? document.querySelector('[data-ch="' + i + '"]') : null;
    setFocus(el || focused || document.querySelector('.chip.active'));
  }
  function stopPlayer() {
    clearTimeout(startTimer);
    stopVideo(); nowCh = null; setMode('none'); markPlaying();
    if (pendingUpdate) applyUpdate();
  }
  function markPlaying() {
    Array.prototype.forEach.call(document.querySelectorAll('.ch.now'), function (el) {
      el.classList.remove('now'); var b = el.querySelector('.badge.live'); if (b) b.parentNode.removeChild(b);
    });
    if (!nowCh) return;
    var i = filtered.indexOf(nowCh);
    var el = i >= 0 ? document.querySelector('[data-ch="' + i + '"]') : null;
    if (el) { el.classList.add('now'); el.insertAdjacentHTML('afterbegin', '<span class="badge live">EN VIVO</span>'); }
  }
  function playError() {
    $('spinner').classList.add('hidden');
    $('playerError').textContent = 'Este canal no está disponible ahora. Prueba ▲▼ para cambiar.';
    $('playerError').classList.remove('hidden');
  }
  function stopVideo() {
    var video = $('video');
    if (hls) { hls.destroy(); hls = null; }
    video.removeAttribute('src'); if (video.load) video.load();
  }
  function showOsd() {
    $('osd').classList.remove('fade');
    clearTimeout(osdTimer); osdTimer = setTimeout(function () { $('osd').classList.add('fade'); }, 5000);
  }
  $('video').addEventListener('playing', function () { $('spinner').classList.add('hidden'); });
  $('video').addEventListener('waiting', function () { $('spinner').classList.remove('hidden'); });
  $('video').addEventListener('error', function () { if (!hls) playError(); });

  // Lista lateral (en pantalla completa)
  function sideGroups() {
    var g = groups.filter(function (x) { return x !== HID_GROUP && x !== INTL_GROUP; });
    if (zapGroup.indexOf(INTL_PREFIX) === 0) g.push(zapGroup);
    return g;
  }
  function openSide() {
    sideOpen = true;
    sideGroup = sideGroups().indexOf(zapGroup) >= 0 ? zapGroup : 'Todos';
    renderSide(true);
    $('side').classList.remove('hidden');
    $('osd').classList.add('fade');
    bumpSide();
  }
  function closeSide() {
    sideOpen = false; clearTimeout(sideTimer);
    $('side').classList.add('hidden');
  }
  function bumpSide() {
    clearTimeout(sideTimer);
    sideTimer = setTimeout(function () { if (!menuOpen) closeSide(); }, 10000);
  }
  function renderSide(selectNow) {
    sideList = listFor(sideGroup);
    if (selectNow) {
      var i = nowCh ? sideList.indexOf(nowCh) : -1;
      sideIdx = i >= 0 ? i : 0;
    }
    sideIdx = Math.max(0, Math.min(sideIdx, sideList.length - 1));
    $('sideHead').innerHTML = '<span class="arrow">◀</span>' + escapeHtml(groupLabel(sideGroup)) + '<span class="arrow">▶</span>';
    updateSideMarks();
  }
  // Solo se dibujan las filas visibles: moverse por la lista es instantáneo aunque tenga 500 canales
  var SIDE_ROWS = 10;
  function updateSideMarks() {
    var n = sideList.length;
    var start = Math.max(0, Math.min(sideIdx - Math.floor(SIDE_ROWS / 2), n - SIDE_ROWS));
    var html = '';
    for (var i = start; i < Math.min(n, start + SIDE_ROWS); i++) {
      var c = sideList[i];
      html += '<div class="srow' + (i === sideIdx ? ' sel' : '') + (nowCh && c === nowCh ? ' now' : '') + '" data-s="' + i + '">' +
        logoHtml(c, true) + '<span class="nm">' + escapeHtml(c.name) + '</span>' + (isFav(c) ? '<span class="star">★</span>' : '') + '</div>';
    }
    $('sideList').innerHTML = html || '<div class="srow empty">Sin canales</div>';
    $('sideCount').textContent = n ? (sideIdx + 1) + ' / ' + n : '';
  }
  function sideMove(step) {
    if (!sideList.length) return;
    sideIdx = (sideIdx + step + sideList.length) % sideList.length; updateSideMarks();
  }
  function sideGroupMove(step) {
    var g = sideGroups(), i = g.indexOf(sideGroup);
    sideGroup = g[(i + step + g.length) % g.length];
    renderSide(true);
  }

  // ---------- Menú de opciones del canal (favorito / ocultar) ----------
  var menuOpen = false, menuCh = null, menuPrevFocus = null;
  function openMenu(c) {
    if (!c) return;
    menuOpen = true; menuCh = c; menuPrevFocus = focused;
    clearTimeout(sideTimer);
    $('menuTitle').textContent = c.name;
    var acts = [['play', '▶  Ver en pantalla completa']];
    if (!(mode === 'pip' && nowCh === c)) acts.push(['pip', '⧉  Ver en ventana chica (PiP)']);
    acts.push(isFav(c) ? ['unfav', '☆  Quitar de favoritos'] : ['fav', '★  Agregar a favoritos']);
    acts.push(isHidden(c) ? ['unhide', '👁  Mostrar canal de nuevo'] : ['hide', '🚫  Ocultar canal (no se ve)']);
    acts.push(['cancel', 'Cancelar']);
    $('menuBtns').innerHTML = acts.map(function (a) {
      return '<button class="mbtn focusable" data-act="' + a[0] + '">' + a[1] + '</button>';
    }).join('');
    $('chMenu').classList.remove('hidden');
    setFocus($('menuBtns').querySelector('[data-act="pip"]') || $('menuBtns').querySelector('.mbtn'));
  }
  function closeMenu() {
    menuOpen = false;
    $('chMenu').classList.add('hidden');
    if (focused && focused.classList.contains('mbtn')) { focused.classList.remove('focused'); focused = null; }
    if (menuPrevFocus && document.body.contains(menuPrevFocus)) setFocus(menuPrevFocus);
    if (sideOpen) bumpSide();
  }
  function toggleFav(c) {
    if (isFav(c)) { delete favs[chKey(c)]; toast('Quitado de favoritos: ' + c.name); }
    else { favs[chKey(c)] = 1; toast('★ Agregado a favoritos: ' + c.name); }
    saveSet('favs', favs); afterListChange(c);
  }
  function hideChannel(c) {
    hiddenSet[chKey(c)] = 1; delete favs[chKey(c)];
    saveSet('hidden', hiddenSet); saveSet('favs', favs);
    toast('🚫 Canal oculto: ' + c.name + ' (lo recuperas en la categoría Ocultos)');
    afterListChange(c);
    if (nowCh === c && mode !== 'none' && zapGroup !== HID_GROUP) {   // si se estaba viendo, pasar al siguiente
      var list = listFor(zapGroup);
      if (list.length) playChannel(list, Math.min(zapIdx, list.length - 1), zapGroup); else stopPlayer();
    }
  }
  function unhideChannel(c) {
    delete hiddenSet[chKey(c)]; saveSet('hidden', hiddenSet);
    toast('👁 Canal visible de nuevo: ' + c.name); afterListChange(c);
  }
  function afterListChange(c) {
    refreshChannels();
    if (nowCh) { $('osdName').textContent = (isFav(nowCh) ? '★ ' : '') + nowCh.name; markPlaying(); }
    if (sideOpen) renderSide(false);
  }
  function menuAction(act) {
    var c = menuCh; closeMenu();
    if (act === 'play') {
      if (sideOpen) { playChannel(sideList, sideList.indexOf(c), sideGroup, 'full'); return; }
      var i = filtered.indexOf(c);
      playChannel(filtered.slice(), i < 0 ? 0 : i, activeGroup, 'full');
    }
    else if (act === 'pip') {
      if (sideOpen) playChannel(sideList, sideList.indexOf(c), sideGroup, 'pip');
      else { var j = filtered.indexOf(c); playChannel(filtered.slice(), j < 0 ? 0 : j, activeGroup, 'pip'); }
      minimize();
    }
    else if (act === 'fav' || act === 'unfav') toggleFav(c);
    else if (act === 'hide') hideChannel(c);
    else if (act === 'unhide') unhideChannel(c);
  }
  // Canal sobre el que actúan "mantener OK", MENU y los botones de colores
  function contextChannel() {
    if (mode === 'full' && sideOpen) return sideList[sideIdx] || null;
    if (mode === 'full') return nowCh;
    if (focused && focused.hasAttribute('data-ch')) {
      var it = filtered[+focused.getAttribute('data-ch')];
      return it && !it.isCountry ? it : null;
    }
    return null;
  }

  // ---------- Acciones ----------
  function activate(el) {
    if (!el) return;
    if (el.classList.contains('mbtn')) { menuAction(el.getAttribute('data-act')); return; }
    if (el.classList.contains('key')) { pressKey(el.getAttribute('data-k')); return; }
    if (el.id === 'voiceBtn') { startVoice(); return; }
    if (el.id === 'searchBtn') { if (searchOpen) closeSearch(false); else openSearch(); return; }
    if (el.id === 'searchInput') {          // OK en el cuadro de texto: ir al primer resultado (o abrir teclado del sistema)
      var first = document.querySelector('[data-ch="0"]');
      if (first && searchQuery.trim()) setFocus(first); else el.focus();
      return;
    }
    if (el.classList.contains('tab')) { showView(el.getAttribute('data-view')); return; }
    if (el.hasAttribute('data-app')) { launchApp(APPS[+el.getAttribute('data-app')]); return; }
    if (el.hasAttribute('data-group')) {
      if (searchOpen) closeSearch(true);
      activeGroup = el.getAttribute('data-group'); renderGroups(); renderChannels(); markPlaying();
      setFocus(document.querySelector('.chip.active'));
      return;
    }
    if (el.hasAttribute('data-ch')) {
      var c = filtered[+el.getAttribute('data-ch')];
      if (c && c.isCountry) { openCountry(c); return; }
      if (mode === 'pip' && nowCh && chKey(nowCh) === chKey(c)) { setMode('full'); return; } // 2º OK = pantalla completa
      playChannel(filtered.slice(), +el.getAttribute('data-ch'), activeGroup, mode === 'pip' ? 'pip' : 'full');
      return;
    }
    if (el.id === 'saveM3u') {
      var v = $('m3uInput').value.trim();
      if (!/^https?:\/\//i.test(v)) { toast('Escribe una URL que empiece con http:// o https://'); return; }
      store('m3u', v); channels = []; toast('Lista guardada'); showView('live'); setFocus(document.querySelector('.tab[data-view="live"]'));
      return;
    }
    if (el.id === 'resetM3u') { store('m3u', DEFAULT_M3U); $('m3uInput').value = DEFAULT_M3U; channels = []; toast('Lista restablecida'); return; }
    if (el.id === 'unhideAll') { hiddenSet = {}; saveSet('hidden', hiddenSet); refreshChannels(); updateSettingsInfo(); toast('Todos los canales vuelven a estar visibles'); return; }
    if (el.id === 'clearFavs') { favs = {}; saveSet('favs', favs); refreshChannels(); updateSettingsInfo(); toast('Favoritos borrados'); return; }
    if (el.tagName === 'INPUT') el.focus();
  }
  function updateSettingsInfo() {
    $('favInfo').textContent = Object.keys(favs).length + ' favoritos · ' + Object.keys(hiddenSet).length + ' canales ocultos';
  }

  // Devuelve true si manejó ATRÁS; false si ya estamos en el inicio (la app debe cerrarse).
  function goBack() {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
    if (menuOpen) { closeMenu(); return true; }
    if (mode === 'full' && sideOpen) { closeSide(); return true; }
    if (mode === 'full') { minimize(); return true; }   // pantalla completa -> PiP
    if (mode === 'pip') { stopPlayer(); return true; }  // PiP -> cerrar video
    if (activeGroup.indexOf(INTL_PREFIX) === 0 && currentView === 'live' &&
        focused && (focused.hasAttribute('data-ch') || focused.classList.contains('chip'))) { backToCountries(); return true; }
    if (searchOpen) {                                   // en resultados: volver al teclado; en teclado: cerrar búsqueda
      if (focused && focused.hasAttribute('data-ch')) { setFocus(document.querySelector('.key[data-k="A"]')); return true; }
      closeSearch(false); return true;
    }
    var tab = document.querySelector('.tab[data-view="' + currentView + '"]');
    if (focused !== tab) { setFocus(tab); return true; }
    if (currentView !== 'apps') { showView('apps'); setFocus(document.querySelector('.tab[data-view="apps"]')); return true; }
    if (IS_ANDROID) return false;
    // En la pantalla principal: dejar que webOS cierre la app
    if (window.webOS && window.webOS.platformBack) window.webOS.platformBack();
    else window.close();
    return false;
  }
  window.mitvBack = goBack;                                         // usado por Android (tecla ATRÁS)
  window.mitvPause = function () { if (mode !== 'none') stopPlayer(); }; // al salir a otra app

  // OK corto = acción normal · OK mantenido = menú de opciones del canal
  var okTimer = null, okLong = false;
  function okShort() {
    if (mode === 'full' && sideOpen) { playChannel(sideList, sideIdx, sideGroup, 'full'); bumpSide(); return; }
    if (mode === 'full') { openSide(); return; }
    activate(focused);
  }

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    var typing = document.activeElement && document.activeElement.tagName === 'INPUT';
    if (typing && (k === KEY.LEFT || k === KEY.RIGHT || k === KEY.BACKSPACE)) return; // edición de texto
    if (searchOpen && !typing && !menuOpen && mode !== 'full' && e.key && e.key.length === 1 && /[a-z0-9ñ ]/i.test(e.key)) {
      searchQuery += e.key.toLowerCase(); updateSearch(); e.preventDefault(); return;      // teclado físico
    }

    // Teclas especiales: colores del control y MENU
    if (k === KEY.MENU || k === KEY.M) { if (!typing) { openMenu(contextChannel()); e.preventDefault(); } return; }
    if (k === KEY.YELLOW || k === KEY.GREEN) { var cf = contextChannel(); if (cf) toggleFav(cf); e.preventDefault(); return; }
    if (k === KEY.RED) { var ch = contextChannel(); if (ch) { if (isHidden(ch)) unhideChannel(ch); else hideChannel(ch); } e.preventDefault(); return; }
    if (k === KEY.BLUE || (k === KEY.P && !typing)) {
      if (mode === 'full') minimize(); else if (mode === 'pip') setMode('full');
      e.preventDefault(); return;
    }
    if (k === KEY.BACK || k === KEY.ESC || (k === KEY.BACKSPACE && !typing)) { goBack(); e.preventDefault(); return; }

    if (k === KEY.ENTER && !menuOpen) {
      e.preventDefault();
      if (e.repeat || okTimer) return;
      if (contextChannel() && !(mode === 'full' && !sideOpen)) {
        okLong = false;
        okTimer = setTimeout(function () { okLong = true; openMenu(contextChannel()); }, 650);
      } else okShort();
      return;
    }

    if (menuOpen) {
      if (k === KEY.UP) move('up'); else if (k === KEY.DOWN) move('down');
      else if (k === KEY.ENTER) activate(focused);
      e.preventDefault(); return;
    }

    if (mode === 'full') {
      if (sideOpen) {
        bumpSide();
        if (k === KEY.UP) sideMove(-1);
        else if (k === KEY.DOWN) sideMove(1);
        else if (k === KEY.CH_UP) sideMove(-8);
        else if (k === KEY.CH_DOWN) sideMove(8);
        else if (k === KEY.LEFT) sideGroupMove(-1);
        else if (k === KEY.RIGHT) sideGroupMove(1);
      } else {
        if (k === KEY.UP || k === KEY.CH_UP) zap(-1);
        else if (k === KEY.DOWN || k === KEY.CH_DOWN) zap(1);
        else if (k === KEY.LEFT) openSide();
        else showOsd();
      }
      e.preventDefault(); return;
    }

    if (mode === 'pip' && (k === KEY.CH_UP || k === KEY.CH_DOWN)) { zap(k === KEY.CH_UP ? -1 : 1); e.preventDefault(); return; }

    switch (k) {
      case KEY.LEFT: move('left'); break;
      case KEY.RIGHT: move('right'); break;
      case KEY.UP: move('up'); break;
      case KEY.DOWN: move('down'); break;
      default: return;
    }
    e.preventDefault();
  });
  document.addEventListener('keyup', function (e) {
    if (e.keyCode !== KEY.ENTER || !okTimer) return;
    clearTimeout(okTimer); okTimer = null;
    if (!okLong) okShort();
    okLong = false;
    e.preventDefault();
  });

  // Puntero del Magic Remote / mouse
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest && e.target.closest('.focusable');
    if (el && mode !== 'full' && (!menuOpen || el.classList.contains('mbtn'))) setFocus(el);
  });
  document.addEventListener('click', function (e) {
    var row = e.target.closest && e.target.closest('.srow');
    if (row && row.hasAttribute('data-s')) { sideIdx = +row.getAttribute('data-s'); okShort(); return; }
    if (mode === 'full' && !sideOpen && e.target.closest && e.target.closest('#player')) { openSide(); return; }
    if (mode === 'pip' && e.target.closest && e.target.closest('#player')) { setMode('full'); return; }
    var el = e.target.closest && e.target.closest('.focusable');
    if (el) { setFocus(el); activate(el); }
  });
  document.addEventListener('contextmenu', function (e) {
    var el = e.target.closest && e.target.closest('[data-ch]');
    if (el) { e.preventDefault(); setFocus(el); openMenu(filtered[+el.getAttribute('data-ch')]); }
  });

  // Reloj
  function tick() {
    var d = new Date();
    $('clock').textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  // ---------- Actualizaciones automáticas (Android descarga la nueva versión en segundo plano) ----------
  var pendingUpdate = null;
  function applyUpdate() {
    toast('Actualizando FuturaTV a la versión ' + pendingUpdate + '…');
    setTimeout(function () { try { window.Android.reload(); } catch (e) { location.reload(); } }, 1500);
  }
  window.mitvUpdateReady = function (version) {
    pendingUpdate = version;
    if (mode === 'none' && !menuOpen && !searchOpen) applyUpdate();
    else toast('Nueva versión ' + version + ' descargada. Se aplicará al cerrar el video.');
  };
  getText('version.json').then(function (t) {
    var v = JSON.parse(t).version;
    $('appVersion').textContent = 'FuturaTV versión ' + v + (IS_ANDROID ? ' · se actualiza sola desde internet' : '');
  }).catch(function () { });

  // ---------- Inicio ----------
  var splashStart = Date.now();
  function hideSplash() {
    var sp = $('splash');
    if (!sp || sp.classList.contains('out')) return;
    sp.classList.add('out');
    setTimeout(function () { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 600);
  }
  window.addEventListener('load', function () { setTimeout(hideSplash, Math.max(0, 1500 - (Date.now() - splashStart))); });
  setTimeout(hideSplash, 4000);

  renderApps();
  showView('apps');
  setTimeout(loadChannels, 300);   // precarga la lista para que "Canales en vivo" abra al instante
  setFocus(document.querySelector('[data-app="0"]'));
  tick(); setInterval(tick, 15000);
})();
