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
  var APP_BUILD = '2.0.9';   // lo escribe make-version.py: versión del código que está corriendo
  var IS_ANDROID = typeof window.Android !== 'undefined';
  // ¿Celular/tablet o TV? En Android lo dice la app; en un navegador se deduce por la pantalla táctil.
  var IS_PHONE = (function () {
    if (IS_ANDROID) {
      try { return typeof window.Android.isTV === 'function' ? !window.Android.isTV() : false; } catch (e) { return false; }
    }
    var touch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    return touch && Math.min(screen.width, screen.height) < 1100;   // celulares y tablets
  })();
  if (/[?&]modo=celular/.test(location.search)) IS_PHONE = true;   // para probar en un PC
  var HOME_VIEW = 'live';   // la app parte en «Canales en vivo» (TV y celular)
  if (IS_PHONE) {
    document.documentElement.classList.add('phone');
    var vp = document.querySelector('meta[name="viewport"]');
    if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');
  }
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
  // Enlaces revisados que no funcionan (404, dominio inexistente, certificado inválido): no se muestran
  var DEAD_LIST = 'channels/caidos.json';
  function deadKey(u) { return String(u).replace(/[?&]PlaylistM3UCL$/, '').replace(/^http:/, 'https:').replace(/(\/\/[^\/:]+):\//, '$1/'); }
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

  // ---------- Videos de YouTube como favoritos (se abren en la app de YouTube) ----------
  function ytId(u) {
    u = String(u || '').trim();
    var m = u.match(/(?:youtu\.be\/|[?&]v=|\/(?:shorts|live|embed|v)\/)([A-Za-z0-9_-]{11})/) || u.match(/^([A-Za-z0-9_-]{11})$/);
    return m ? m[1] : null;
  }
  function ytLoad() { try { return JSON.parse(store('ytFavs') || '[]') || []; } catch (e) { return []; } }
  function ytChannel(o) {
    return { name: o.title || 'Video de YouTube', url: 'https://www.youtube.com/watch?v=' + o.id, yt: o.id, group: 'YouTube',
      logo: 'https://i.ytimg.com/vi/' + o.id + '/hqdefault.jpg' };
  }
  function ytMergeInto(list) {                    // agrega los videos guardados a la lista de canales (y a favoritos)
    ytLoad().forEach(function (o) {
      var c = ytChannel(o);
      if (!list.some(function (x) { return x.yt === o.id; })) list.push(c);
      favs[chKey(c)] = 1;
    });
  }
  function openYouTube(c) {
    var url = 'https://www.youtube.com/watch?v=' + c.yt;
    if (IS_ANDROID) {
      var ok = false;
      try { ok = window.Android.openUrl(url); } catch (e) { ok = false; }
      if (!ok) { try { ok = window.Android.openUrl('vnd.youtube:' + c.yt); } catch (e) { } }
      toast(ok ? '▶ Abriendo en YouTube: ' + c.name : 'No se pudo abrir YouTube en este equipo');
      return;
    }
    lunaCall('luna://com.webos.applicationManager/launch', { id: 'youtube.leanback.v4', params: { contentTarget: 'https://www.youtube.com/tv?v=' + c.yt } }, function (res) {
      if (res.notWebOS) window.open(url, '_blank');
      else if (!res.returnValue) toast('No se pudo abrir YouTube en este TV');
    });
  }
  function ytAdd() {
    var raw = $('ytInput').value, id = ytId(raw);
    if (!id) { toast('Ese enlace no parece de un video de YouTube'); return; }
    var all = ytLoad();
    if (all.some(function (o) { return o.id === id; })) { toast('Ese video ya está en tus favoritos'); return; }
    toast('Agregando video…');
    var done = function (title) {
      var o = { id: id, title: (title || 'Video de YouTube').slice(0, 80) };
      all.push(o); store('ytFavs', JSON.stringify(all));
      var c = ytChannel(o); channels.push(c); favs[chKey(c)] = 1; saveSet('favs', favs);
      $('ytInput').value = ''; refreshChannels(); ytInfo();
      toast('★ Agregado a favoritos: ' + o.title);
    };
    getText('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + id))
      .then(function (t) { var j = {}; try { j = JSON.parse(t); } catch (e) { } done(j.title); })
      .catch(function () { done(null); });
  }
  function ytRemove(c) {
    store('ytFavs', JSON.stringify(ytLoad().filter(function (o) { return o.id !== c.yt; })));
    channels = channels.filter(function (x) { return x !== c; });
    ytInfo();
  }
  function ytInfo() {
    var n = ytLoad().length;
    if ($('ytInfo')) $('ytInfo').textContent = n ? n + ' video' + (n > 1 ? 's' : '') + ' de YouTube en Favoritos · para quitar uno: mantén OK sobre él → Quitar de favoritos' : '';
  }
  // Enviar el enlace desde el celular: la TV muestra un QR con una página de su red Wi-Fi
  function showLinkQr() {
    if (!IS_ANDROID || typeof window.Android.startLinkServer !== 'function') {
      toast('Para esto instala la nueva APK de FuturaTV (2.0.6 o más nueva)'); return;
    }
    var url = '';
    try { url = window.Android.startLinkServer(); } catch (e) { url = ''; }
    if (!url) { toast('La TV no está conectada a una red Wi-Fi o cable de la casa'); return; }
    var draw = function () {
      try {
        var q = window.qrcode(0, 'M'); q.addData(url); q.make();
        $('linkQr').innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
      } catch (e) { $('linkQr').innerHTML = ''; }
      $('linkTxt').innerHTML = 'Escanea con la cámara del celular (conectado al <b>mismo Wi-Fi</b>), pega el enlace y toca «Enviar a la TV».<br>O abre en el celular: <b>' + escapeHtml(url) + '</b>';
      $('linkBox').classList.remove('hidden');
      if (focused) setFocus(focused);
      try { $('linkBox').scrollIntoView({ block: 'end' }); } catch (e) { }   // que el QR se vea completo
    };
    if (window.qrcode) draw();
    else { var sc = document.createElement('script'); sc.src = 'lib/qrcode.js'; sc.onload = draw; sc.onerror = draw; document.body.appendChild(sc); }
  }
  window.mitvRemoteLink = function (u) {               // llega un enlace enviado desde el celular
    if (!ytId(u)) { toast('Llegó un enlace que no es de YouTube: ' + String(u).slice(0, 60)); return; }
    $('ytInput').value = u; ytAdd();
  };
  // Cerrar la app por completo (detiene videos y libera memoria; las listas guardadas se mantienen)
  function exitApp() {
    try { stopPlayer(); } catch (e) { }
    try { wallTeardown(); sidePrevStop(); } catch (e) { }
    if (IS_ANDROID) { try { window.Android.exit(); return; } catch (e) { } }
    if (window.webOS && window.webOS.platformBack) { try { window.close(); } catch (e) { } window.webOS.platformBack(); return; }
    try { window.close(); } catch (e) { }
    toast('Cierra la pestaña del navegador para salir');
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
    if (el.hasAttribute('data-ch')) warmChannel(filtered[+el.getAttribute('data-ch')]);
    // TV: los cuadros de texto de Ajustes solo se marcan al pasar (no abren el teclado ni atrapan las flechas);
    // se escribe apretando OK sobre ellos
    var editOnOk = !IS_PHONE && el.tagName === 'INPUT' && el.id !== 'searchInput';
    if (el.tagName === 'INPUT' && !editOnOk) el.focus();
    else if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
    if (el.classList.contains('ch')) scrollGridTo(el);
    else if (el.scrollIntoView && !el.classList.contains('key')) el.scrollIntoView({ block: 'nearest' });
  }
  function scrollGridTo(el) {
    var g = $('channelGrid'), top = el.offsetTop - g.offsetTop, h = el.offsetHeight;
    if (top - 20 < g.scrollTop) g.scrollTop = Math.max(0, top - 20);
    else if (top + h + 20 > g.scrollTop + g.clientHeight) g.scrollTop = top + h + 20 - g.clientHeight;
    scheduleLogos();
  }
  // Ajustes: ▲▼ recorren los elementos uno por uno, en el orden de la página (sin saltarse botones)
  function settingsMove(dir) {
    if (menuOpen || currentView !== 'settings' || (dir !== 'up' && dir !== 'down') || !focused) return false;
    var items = Array.prototype.filter.call($('view-settings').querySelectorAll('.focusable'), function (el) { return el.offsetParent !== null; });
    var inTabs = focused.classList.contains('tab'), i = items.indexOf(focused);
    if (inTabs) { if (dir === 'down' && items.length) { setFocus(items[0]); return true; } return false; }
    if (i < 0) return false;
    if (dir === 'down') {                        // siguiente elemento que esté más abajo (salta los de la misma fila)
      var top = focused.getBoundingClientRect().top;
      for (var j = i + 1; j < items.length; j++) if (items[j].getBoundingClientRect().top > top + 5) { setFocus(items[j]); return true; }
      return true;
    }
    var t0 = focused.getBoundingClientRect().top;
    for (var k = i - 1; k >= 0; k--) {
      var tk = items[k].getBoundingClientRect().top;
      if (tk < t0 - 5) {                         // fila de arriba: su primer elemento
        while (k > 0 && Math.abs(items[k - 1].getBoundingClientRect().top - tk) < 5) k--;
        setFocus(items[k]); return true;
      }
    }
    setFocus(document.querySelector('.tab[data-view="settings"]')); return true;
  }
  function move(dir) {
    if (settingsMove(dir)) return;
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
    wallSync();
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
    if (cached) {                     // vencida: se abre al instante con la copia guardada y se renueva por detrás
      getText(url).then(function (t) { if (parseM3U(t).length) { store(key, t); store(key + ':at', String(Date.now())); } }).catch(function () { });
      return Promise.resolve(cached);
    }
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
    var dead = getText(DEAD_LIST).then(function (t) {
      var o = {}; (JSON.parse(t) || []).forEach(function (u) { o[deadKey(u)] = 1; }); return o;
    }).catch(function () { return {}; });
    Promise.all([chile, extra, intl, dead]).then(function (lists) {
      var seen = {}, deadSet = lists[3];
      var alive = function (c) { return !deadSet[deadKey(c.url)]; };
      lists[0] = lists[0].filter(alive); lists[1] = lists[1].filter(alive); lists[2] = lists[2].filter(alive);
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
      ytMergeInto(channels);
      activeGroup = listFor(FAV_GROUP).length ? FAV_GROUP : 'Todos';
      refreshChannels();
      if (window.mitvReadyFast) window.mitvReadyFast();
      autoStartFavorite();
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
    if (group === FAV_GROUP) {                     // el elegido como «primero» va arriba (es el que se abre al iniciar)
      var fl = vis.filter(isFav), first = store('favFirst');
      if (first) fl.sort(function (a, b) { return (chKey(b) === first) - (chKey(a) === first); });
      return fl;
    }
    if (group === 'Todos') return vis.filter(function (c) { return !c.intl && !c.yt; });
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
        : (searchQuery.trim() ? 'No se encontraron canales con «' + escapeHtml(searchQuery.trim()) + '».' : (IS_PHONE ? 'Escribe el nombre del canal o toca el micrófono 🎤.' : 'Escribe el nombre del canal con el teclado de arriba.'));
      $('channelGrid').innerHTML = '<p class="status">' + msg + '</p>';
    }
    wallSync();
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
  var MIC_SVG = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2.5" width="6" height="11.5" rx="3"/>' +
    '<path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>';
  var KBD_HTML = { MIC: MIC_SVG + '<span>Buscar por voz</span>' };
  var KBD_LABEL = { MIC: 'Buscar por voz', DEL: '⌫ Borrar', SPACE: 'Espacio', CLEAR: 'Borrar todo', CLOSE: '✕ Cerrar búsqueda' };
  function renderKeyboard() {
    $('kbd').innerHTML = KBD_ROWS.map(function (row) {
      return '<div class="krow">' + row.map(function (k) {
        return '<button class="key focusable' + (KBD_LABEL[k] ? ' wide' : '') + '" data-k="' + k + '">' + (KBD_HTML[k] || escapeHtml(KBD_LABEL[k] || k)) + '</button>';
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
    setFocus(IS_PHONE ? $('searchInput') : document.querySelector('.key[data-k="A"]'));   // en celular, teclado del teléfono
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
    $('liveStatus').textContent = q ? filtered.length + ' resultado' + (filtered.length === 1 ? '' : 's') + ' para «' + q + '»' + (IS_PHONE ? '' : ' · ▼ para ir a los resultados') : 'Buscar canal';
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
  // Android: reconocimiento dentro de la app (texto en vivo mientras hablas).
  // Navegador de PC: Web Speech API.
  var listening = false, voiceTimer = null, webRec = null;
  var VOICE_MSG = {
    starting: 'Preparando micrófono…', listening: 'Te escucho… di el nombre del canal',
    speaking: 'Te escucho…', processing: 'Buscando…', permission: 'Acepta el permiso del micrófono en la pantalla',
    external: 'Habla en la ventana de Google…'
  };
  function voiceUI(show) {
    $('voicePanel').classList.toggle('hidden', !show);
    $('voiceBtn').classList.toggle('on', show);
  }
  function setVoiceText(t, interim) {
    var el = $('voiceText');
    el.textContent = t || '';
    el.classList.toggle('interim', !!interim);
  }
  function startVoice() {
    if (listening) return;
    if (!searchOpen) { if (currentView !== 'live') showView('live'); openSearch(); }
    setVoiceText('');
    $('voiceMsg').textContent = VOICE_MSG.starting;
    if (IS_ANDROID) {
      if (typeof window.Android.voiceSearch !== 'function' || typeof window.Android.voiceCancel !== 'function') {
        toast('Para buscar por voz instala la nueva versión del APK de FuturaTV'); return;
      }
      listening = true; voiceUI(true);
      if (!window.Android.voiceSearch()) {
        stopVoiceUI();
        toast('Este dispositivo no tiene reconocimiento de voz. Instala la app "Google" desde la tienda.');
      }
      armVoiceTimeout();
      return;
    }
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Búsqueda por voz no disponible aquí. En el TV LG usa el micrófono del Magic Remote sobre el cuadro de texto.'); return; }
    webRec = new SR();
    webRec.lang = 'es-CL'; webRec.interimResults = true; webRec.maxAlternatives = 1;
    webRec.onresult = function (e) {
      var r = e.results[e.results.length - 1];
      if (r.isFinal) window.mitvVoiceResult(r[0].transcript); else window.mitvVoicePartial(r[0].transcript);
    };
    webRec.onerror = function (e) { window.mitvVoiceError(e.error || 'error'); };
    webRec.onend = function () { if (listening) stopVoiceUI(); };
    try { webRec.start(); listening = true; voiceUI(true); window.mitvVoiceState('listening'); armVoiceTimeout(); }
    catch (e) { toast('No se pudo usar el micrófono'); }
  }
  function armVoiceTimeout() {
    clearTimeout(voiceTimer);
    voiceTimer = setTimeout(function () {         // si en 15 s no llega nada, se cierra
      if (listening) { cancelVoice(); toast('No te escuché. Aprieta 🎤 e intenta otra vez.'); }
    }, 15000);
  }
  function stopVoiceUI() {
    listening = false; clearTimeout(voiceTimer);
    voiceUI(false);
    $('voiceLevel').style.transform = 'scale(1)';
  }
  function cancelVoice() {
    try { if (IS_ANDROID && window.Android.voiceCancel) window.Android.voiceCancel(); } catch (e) { }
    try { if (webRec) webRec.abort(); } catch (e) { }
    stopVoiceUI();
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
  window.mitvVoiceState = function (state) {
    if (!listening) { listening = true; voiceUI(true); }
    if (VOICE_MSG[state]) $('voiceMsg').textContent = VOICE_MSG[state];
    armVoiceTimeout();
  };
  window.mitvVoiceLevel = function (rms) {          // rms aprox. -2..10 dB
    var lvl = Math.max(0, Math.min(1, (rms + 2) / 12));
    $('voiceLevel').style.transform = 'scale(' + (1 + lvl * 0.6).toFixed(2) + ')';
  };
  window.mitvVoicePartial = function (text) {        // el texto se escribe mientras hablas
    if (!listening) return;
    setVoiceText(text, true);
    var q = cleanVoice(text);
    if (q && q !== searchQuery) { searchQuery = q; updateSearch(); }
    armVoiceTimeout();
  };
  window.mitvVoiceResult = function (text) {
    stopVoiceUI();
    var q = cleanVoice(text);
    if (!q) { toast('No te escuché bien, intenta otra vez'); return; }
    if (mode === 'full') minimize();
    if (currentView !== 'live') showView('live');
    if (!searchOpen) openSearch();
    searchQuery = q; updateSearch();
    var first = gridEl(0);
    if (filtered.length && first) { setFocus(first); toast('«' + q + '»: ' + filtered.length + ' resultado' + (filtered.length === 1 ? '' : 's') + ' · OK para ver'); }
    else toast('«' + q + '»: no encontré canales con ese nombre');
  };
  window.mitvVoiceError = function (code) {
    stopVoiceUI();
    var msg = {
      1: 'Sin conexión a internet para reconocer la voz', 2: 'Sin conexión a internet para reconocer la voz',
      3: 'No se pudo usar el micrófono', 6: 'No te escuché. Aprieta 🎤 e intenta otra vez.',
      7: 'No entendí. Intenta decir solo el nombre del canal.', 8: 'El micrófono está ocupado, intenta de nuevo',
      9: 'FuturaTV necesita permiso para usar el micrófono', permiso: 'Sin permiso de micrófono no se puede buscar por voz',
      'no-speech': 'No te escuché. Aprieta 🎤 e intenta otra vez.', 'not-allowed': 'Sin permiso de micrófono'
    }[code] || ('No se pudo reconocer la voz (código ' + code + ')');
    toast(msg);
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
    var pick = list[(idx + list.length) % list.length];
    if (pick && pick.yt) { openYouTube(pick); return; }       // video de YouTube: se abre en su app
    sidePrevStop();
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
    maxBufferLength: 20, maxMaxBufferLength: 40,
    // TV: guarda hasta 10 min de lo ya visto para poder retroceder aunque el canal guarde menos
    // (si la memoria no alcanza, el navegador descarta lo más antiguo solo)
    backBufferLength: IS_PHONE ? 90 : 600,
    manifestLoadingTimeOut: 10000, levelLoadingTimeOut: 10000, fragLoadingTimeOut: 15000,
    // apertura rápida: sin prueba de velocidad (se usa la medida guardada) y primer pedazo pedido en paralelo
    testBandwidth: false, startFragPrefetch: true
  };
  // Velocidad de internet medida en canales anteriores: el próximo canal parte directo en la calidad correcta
  function savedBandwidth() { var b = +(store('bwEst') || 0); return b > 100000 ? b : 2500000; }
  function rememberBandwidth(h) {
    try { var b = h && h.bandwidthEstimate; if (b && isFinite(b) && b > 100000) store('bwEst', String(Math.round(b))); } catch (e) { }
  }
  // Pre-conexión: al detenerse sobre un canal se abre la conexión con su servidor (al apretar OK ya está lista)
  var warmTimer = null, warmed = {};
  function warmChannel(c) {
    clearTimeout(warmTimer);
    if (!c || !c.url || c.isCountry || c.yt || (nowCh && c === nowCh)) return;
    warmTimer = setTimeout(function () {
      var host = (c.url.match(/^https?:\/\/[^\/]+/) || [])[0];
      if (!host || warmed[c.url] > Date.now() - 20000) return;
      warmed[c.url] = Date.now();
      try { if (window.fetch) fetch(c.url, { credentials: 'omit', cache: 'no-store' }).catch(function () { }); } catch (e) { }
    }, 350);
  }
  function warmNow(list) {                        // pre-conexión inmediata (sin esperar) de varios canales
    list.forEach(function (c) {
      if (!c || !c.url || c.isCountry || c.yt || warmed[c.url] > Date.now() - 20000) return;
      warmed[c.url] = Date.now();
      try { if (window.fetch) fetch(c.url, { credentials: 'omit', cache: 'no-store' }).catch(function () { }); } catch (e) { }
    });
  }
  function startStream(ch) {
    var video = $('video');
    if (window.Hls && window.Hls.isSupported()) {
      HLS_CONFIG.abrEwmaDefaultEstimate = savedBandwidth();
      hls = new window.Hls(HLS_CONFIG);
      allowTimeshift(hls);
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
  function zap(step) {                         // ▲▼ salta los videos de YouTube (no son canales en vivo)
    var n = zapList.length, i = zapIdx;
    for (var k = 0; k < n; k++) { i = (i + step + n) % n; if (!zapList[i].yt) break; }
    if (zapList[i] && !zapList[i].yt) playChannel(zapList, i, zapGroup);
  }

  function setMode(m) {
    mode = m;
    if (IS_ANDROID && window.Android.setPlaying) { try { window.Android.setPlaying(m !== 'none'); } catch (e) { } }
    if (m !== 'full') sidePrevStop();
    wallSync();
    var p = $('player');
    p.classList.toggle('hidden', m === 'none');
    p.classList.toggle('pip', m === 'pip');
    applyPipPos();
    $('pipMoveBtn').classList.toggle('hidden', m !== 'pip' || IS_PHONE);
    if (m !== 'pip' && focused === $('pipMoveBtn')) setFocus(document.querySelector('.tab.active') || document.querySelector('.tab'));
    if (m !== 'full') { closeSide(); $('ptools').classList.add('hidden'); }
    if (m === 'full') { if (IS_PHONE) showTools(); else showOsd(); }
  }
  function minimize() {           // pantalla completa -> PiP
    setMode('pip');
    if (!IS_PHONE && !store('pipTip')) { store('pipTip', '1'); setTimeout(function () { toast('Para mover la ventana: sube con ▲ hasta «⇲ Mover PiP» y aprieta OK'); }, 300); }
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
    $('playerError').textContent = IS_PHONE ? 'Este canal no está disponible ahora. Toca la pantalla y usa ◀ ▶ para cambiar.' : 'Este canal no está disponible ahora. Prueba ▲▼ para cambiar.';
    $('playerError').classList.remove('hidden');
  }
  function stopVideo() {
    var video = $('video');
    video.classList.remove('ready');
    if (hls) { rememberBandwidth(hls); hls.destroy(); hls = null; }
    video.removeAttribute('src'); if (video.load) video.load();
  }
  function showOsd() {
    $('osd').classList.remove('fade');
    clearTimeout(osdTimer); osdTimer = setTimeout(function () { $('osd').classList.add('fade'); }, 5000);
  }
  // Se muestra el video apenas hay imagen (algunos TV/celulares no avisan "playing")
  function videoShown() { $('spinner').classList.add('hidden'); $('video').classList.add('ready'); }
  $('video').addEventListener('playing', videoShown);
  $('video').addEventListener('loadeddata', function () { $('video').classList.add('ready'); });
  $('video').addEventListener('timeupdate', function () { if ($('video').currentTime > 0) videoShown(); });
  $('video').addEventListener('waiting', function () { $('spinner').classList.remove('hidden'); });
  $('video').addEventListener('error', function () { if (!hls) playError(); });

  // Lista lateral (en pantalla completa)
  function sideGroups() {
    var g = groups.filter(function (x) { return x !== HID_GROUP && x !== INTL_GROUP; });
    if (zapGroup.indexOf(INTL_PREFIX) === 0) g.push(zapGroup);
    return g;
  }
  // TV: la lista puede ser vertical (lateral) u horizontal (carrusel abajo, con controles de tiempo)
  var LIST_H = !IS_PHONE && store('listMode') === 'h', hbFocus = -1;   // -1 = tarjetas · 0..n = botón de tiempo
  function openSide() {
    sideOpen = true; hbFocus = -1;
    sideGroup = sideGroups().indexOf(zapGroup) >= 0 ? zapGroup : 'Todos';
    $(LIST_H ? 'hbar' : 'side').classList.remove('hidden');   // primero visible: así la vista previa se ubica bien
    renderSide(true);
    $('player').classList.toggle('list-h', LIST_H);
    if (LIST_H) { hbMarkCtrl(); hbTimeTick(); }
    $('osd').classList.add('fade');
    bumpSide();
  }
  function closeSide() {
    sideOpen = false; clearTimeout(sideTimer);
    sidePrevStop();
    $('side').classList.add('hidden'); $('hbar').classList.add('hidden');
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
    $('hbGroup').textContent = groupLabel(sideGroup);
    updateSideMarks();
  }
  // Solo se dibujan las filas visibles: moverse por la lista es instantáneo aunque tenga 500 canales
  var SIDE_ROWS = IS_PHONE ? Math.max(12, Math.ceil(Math.max(window.innerHeight, window.innerWidth) / 54) + 2) : 10;
  function updateSideMarks() {
    if (LIST_H) { hbRender(); sidePrevSchedule(); return; }
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
    sidePrevSchedule();
  }

  // ---------- TV: carrusel horizontal ----------
  function hbRender() {
    var n = sideList.length, html = '', digits = Math.max(2, String(n).length);
    for (var k = -3; k <= 3; k++) {              // 7 tarjetas: la elegida al centro (más grande) y vecinas a los lados
      var i = sideIdx + k, c = sideList[i];
      if (!c) { html += '<div class="hcard empty"></div>'; continue; }
      var now = nowCh && c === nowCh;
      html += '<div class="hcard' + (k === 0 ? ' sel' : '') + (now ? ' now' : '') + '" data-s="' + i + '">' +
        '<div class="hthumb">' + logoHtml(c, true) + '</div>' +
        '<div class="hlab"><b><i>' + ('0000' + (i + 1)).slice(-digits) + '</i> ' + escapeHtml(c.name) + (isFav(c) ? ' <em>★</em>' : '') + '</b>' +
        (k === 0 ? '<small>' + (now ? 'En reproducción' : escapeHtml(c.group || groupLabel(sideGroup))) + '</small>' : '') + '</div></div>';
    }
    $('hbTrack').innerHTML = n ? html : '<div class="hcard empty"><div class="hlab"><b>Sin canales</b></div></div>';
    $('hbCount').textContent = n ? (sideIdx + 1) + ' / ' + n : '';
    $('hbar').classList.toggle('in-ctrl', hbFocus >= 0);
  }
  var HB_CTRL = ['back', 'play', 'fwd', 'live'];
  function hbMarkCtrl() {
    Array.prototype.forEach.call(document.querySelectorAll('#hbCtrl .hc'), function (b) {
      b.classList.toggle('focused', hbFocus >= 0 && b.getAttribute('data-hc') === HB_CTRL[hbFocus]);
    });
    $('hbar').classList.toggle('in-ctrl', hbFocus >= 0);
  }
  function hbKey(k) {                            // teclas con la lista horizontal abierta; true = usada
    if (hbFocus < 0) {
      if (k === KEY.LEFT) sideMove(-1);
      else if (k === KEY.RIGHT) sideMove(1);
      else if (k === KEY.UP) sideGroupMove(1);
      else if (k === KEY.DOWN) { hbFocus = 0; hbMarkCtrl(); sidePrevStop(); }
      else return false;
      return true;
    }
    if (k === KEY.LEFT) hbFocus = Math.max(0, hbFocus - 1);
    else if (k === KEY.RIGHT) hbFocus = Math.min(HB_CTRL.length - 1, hbFocus + 1);
    else if (k === KEY.UP) { hbFocus = -1; sidePrevSchedule(); }
    else if (k === KEY.DOWN) { }
    else return false;
    hbMarkCtrl();
    return true;
  }
  function hbAction(a) {
    if (a === 'back') seekBy(-30);
    else if (a === 'fwd') seekBy(30);
    else if (a === 'play') togglePause();
    else if (a === 'live') goLive();
    hbTimeTick();
  }

  // ---------- Retroceder / adelantar / volver al directo ----------
  // Se puede retroceder lo que el canal guarda en su servidor y además lo ya visto (hasta 10 min en TV).
  // hls.js devuelve al directo si el video queda fuera de la ventana del servidor mientras carga:
  // aquí eso se evita (solo si hay video guardado en ese punto), para que retroceder funcione.
  function allowTimeshift(h) {
    try {
      var sc = h.streamController, orig = sc && sc.synchronizeToLiveEdge;
      if (typeof orig !== 'function') return;
      sc.synchronizeToLiveEdge = function (details) {
        var v = $('video'), b = v.buffered, t = v.currentTime;
        for (var i = 0; i < b.length; i++) if (t >= b.start(i) - 0.5 && t <= b.end(i)) return;   // está en lo guardado: no saltar
        return orig.apply(this, arguments);
      };
    } catch (e) { }
  }
  function liveRange() {
    var v = $('video'), s = v.seekable;
    if (!s || !s.length) return null;
    var end = s.end(s.length - 1), start = s.start(0);
    // el inicio real: lo más antiguo entre lo guardado en la TV y la ventana del servidor
    try {
      var b = v.buffered, win = null;
      if (hls && hls.levels && hls.levels[hls.currentLevel] && hls.levels[hls.currentLevel].details)
        win = hls.levels[hls.currentLevel].details.fragments[0].start;
      if (b.length) start = Math.max(start, win !== null ? Math.min(win, b.start(0)) : b.start(0));
    } catch (e) { }
    if (hls && hls.liveSyncPosition) end = Math.max(start, Math.min(end, hls.liveSyncPosition));
    return { start: start, end: end };
  }
  function fmtT(s) { s = Math.max(0, Math.round(s)); var m = Math.floor(s / 60), r = s % 60; return (m >= 60 ? Math.floor(m / 60) + ':' + ('0' + m % 60).slice(-2) : m) + ':' + ('0' + r).slice(-2); }
  function seekBy(sec) {
    var v = $('video'), r = liveRange();
    if (!r || r.end - r.start < 8) { toast('Este canal no permite retroceder'); return; }
    var t = Math.max(r.start + 1, Math.min(r.end, v.currentTime + sec));
    if (sec < 0 && v.currentTime - r.start < 4) { toast('Llegaste al inicio: este canal guarda ' + fmtT(r.end - r.start) + ' hacia atrás'); return; }
    v.currentTime = t;
    if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () { }); }
    var d = r.end - t;
    toast(d < 6 ? 'En vivo' : '−' + fmtT(d) + ' · se puede retroceder hasta ' + fmtT(r.end - r.start));
  }
  function goLive() {
    var v = $('video'), r = liveRange();
    if (r) v.currentTime = r.end;
    var p = v.play(); if (p && p.catch) p.catch(function () { });
    toast('En vivo');
  }
  function togglePause() {
    var v = $('video');
    if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () { }); } else v.pause();
  }
  function hbTimeTick() {
    if (!LIST_H || !sideOpen) return;
    var v = $('video'), r = liveRange();
    $('hcPlay').textContent = v.paused ? '▶' : '⏸';
    if (!r || r.end - r.start < 8) {
      $('hbFill').style.width = '100%'; $('hbDot').style.left = '100%';
      $('hbDelay').textContent = 'EN VIVO'; $('hbWin').textContent = 'Este canal no permite retroceder';
      return;
    }
    var f = Math.max(0, Math.min(1, (v.currentTime - r.start) / (r.end - r.start))), d = r.end - v.currentTime;
    $('hbFill').style.width = (f * 100) + '%'; $('hbDot').style.left = (f * 100) + '%';
    $('hbDelay').textContent = d < 6 ? 'EN VIVO' : '−' + fmtT(d);
    $('hbar').classList.toggle('behind', d >= 6);
    $('hbWin').textContent = 'Puedes retroceder hasta ' + fmtT(r.end - r.start);
  }
  setInterval(hbTimeTick, 500);

  // ---------- TV: vista previa en vivo (solo imagen) del canal elegido en la lista lateral ----------
  // Un solo video chico y sin sonido; se carga cuando te detienes medio segundo sobre un canal.
  var PREV_HLS = { enableWorker: true, startLevel: 0, testBandwidth: false, abrEwmaDefaultEstimate: 300000, startFragPrefetch: true,
    capLevelToPlayerSize: true, maxBufferLength: 6, maxMaxBufferLength: 10, maxBufferSize: 4 * 1000 * 1000, backBufferLength: 0,
    manifestLoadingTimeOut: 8000, levelLoadingTimeOut: 8000, fragLoadingTimeOut: 10000 };
  // vecinas: aún más livianas (calidad mínima y búfer mínimo)
  var PREV_HLS_SIDE = { enableWorker: true, startLevel: 0, testBandwidth: false, abrEwmaDefaultEstimate: 150000, startFragPrefetch: true,
    capLevelToPlayerSize: true, maxBufferLength: 4, maxMaxBufferLength: 6, maxBufferSize: 2 * 1000 * 1000, backBufferLength: 0,
    manifestLoadingTimeOut: 8000, levelLoadingTimeOut: 8000, fragLoadingTimeOut: 10000 };
  // Hasta 3 videos de vista previa (horizontal: la tarjeta del medio y sus 2 vecinas; vertical: solo 1).
  // Al moverse, un video ya cargado se reubica (no se recarga): solo carga el canal nuevo.
  var prevSlots = null, prevTimer = null;
  // Protección (20 cuadros por segundo): mientras las vecinas están en vivo se mide cuántos cuadros por
  // segundo dibuja la pantalla; si baja de 20 se deja solo la del medio
  var prevTriple = store('prevTriple') !== '0', fpsWin = null, fpsRaf = 0;
  var FPS_MIN = 20;
  function prevFallback() {
    prevTriple = false; store('prevTriple', '0'); fpsWin = null;
    toast('Para que se vea fluido, el carrusel muestra en vivo solo el canal del medio');
    sidePrevSchedule();
  }
  function fpsTick(t) {
    fpsRaf = 0;
    if (!prevTriple || !LIST_H || !sideOpen || mode !== 'full' || document.hidden) { fpsWin = null; return; }
    var on = prevSlots && prevSlots.filter(function (sl) { return sl.ch; }).length >= 2;
    if (!on) { fpsWin = null; fpsRaf = requestAnimationFrame(fpsTick); return; }
    if (!fpsWin) fpsWin = { t0: t, n: 0, bad: 0 };
    fpsWin.n++;
    if (t - fpsWin.t0 >= 2000) {                       // ventana de 2 s
      var fps = fpsWin.n * 1000 / (t - fpsWin.t0);
      fpsWin.bad = fps < FPS_MIN ? fpsWin.bad + 1 : 0;
      fpsWin.t0 = t; fpsWin.n = 0;
      if (fpsWin.bad >= 2) { prevFallback(); return; }  // 2 ventanas seguidas bajo 50 (no por un tirón suelto)
    }
    fpsRaf = requestAnimationFrame(fpsTick);
  }
  function prevGuard() {                          // solo la regla de los 20 cuadros por segundo
    if (!prevTriple || !LIST_H || !sideOpen || mode !== 'full') return;
    if (!fpsRaf) fpsRaf = requestAnimationFrame(fpsTick);
  }
  setInterval(prevGuard, 1000);
  function prevInit() {
    if (prevSlots) return prevSlots;
    var first = $('sidePrev');
    prevSlots = [first, first.cloneNode(true), first.cloneNode(true)].map(function (box, i) {
      if (i) { box.id = ''; first.parentNode.insertBefore(box, first.nextSibling); }
      return { box: box, v: box.querySelector('video'), hls: null, ch: null };
    });
    return prevSlots;
  }
  function slotStop(sl) {
    sl.ch = null;
    sl.box.classList.remove('show', 'ready', 'fail', 'on', 'side');
    if (sl.hls) { try { sl.hls.destroy(); } catch (e) { } sl.hls = null; }
    sl.v.removeAttribute('src'); try { sl.v.load(); } catch (e) { }
  }
  function sidePrevStop() {
    clearTimeout(prevTimer);
    if (prevSlots) prevSlots.forEach(slotStop);
    $('player').classList.remove('has-prev');
  }
  function slotPlace(sl, el, side) {               // coloca el recuadro sobre la tarjeta / fila; false si aún no tiene tamaño
    var P = $('player').getBoundingClientRect(), b = sl.box, r;
    if (LIST_H) {
      r = el.getBoundingClientRect(); if (r.width < 20) return false;
      b.style.left = (r.left - P.left) + 'px'; b.style.top = (r.top - P.top) + 'px';
      b.style.width = r.width + 'px'; b.style.height = r.height + 'px';
      b.querySelector('.sp-lab').innerHTML = el.querySelector('.hlab').innerHTML;   // el nombre va sobre la imagen
    } else {
      r = el.getBoundingClientRect(); if (r.height < 10) return false;
      var S = $('side').getBoundingClientRect();
      b.style.width = '128px'; b.style.height = '72px';
      b.style.left = (S.right - P.left - 78 - 128) + 'px'; b.style.top = (r.top - P.top + (r.height - 72) / 2) + 'px';
    }
    b.classList.add('on'); b.classList.toggle('side', !!side);
    return true;
  }
  function sidePrevSchedule() {
    if (sideOpen) warmChannel(sideList[sideIdx]);
    if (IS_PHONE) return;
    var slots = prevInit();
    clearTimeout(prevTimer);
    if (!sideOpen || mode !== 'full') { sidePrevStop(); return; }
    var want = [];                                 // [elemento, canal, esVecina]
    if (LIST_H) {
      Array.prototype.forEach.call($('hbTrack').querySelectorAll('.hcard[data-s]'), function (el) {
        var i = +el.getAttribute('data-s'), k = i - sideIdx;
        if (k === 0 || (prevTriple && (k === -1 || k === 1))) want.push([el, sideList[i], k !== 0]);
      });
    } else {
      var row = $('sideList').querySelector('.srow.sel');
      if (row) want.push([row, sideList[sideIdx], false]);
    }
    want = want.filter(function (w) { return w[1] && !w[1].isCountry && !w[1].yt && w[1] !== nowCh; });   // el que ya ves no se repite
    if (LIST_H && prevTriple) warmNow([sideList[sideIdx - 2], sideList[sideIdx + 2]]);   // los que vienen: conexión lista
    var used = [];
    want.forEach(function (w) {                    // 1) reutiliza el video que ya muestra ese canal
      for (var j = 0; j < slots.length; j++) if (used.indexOf(j) < 0 && slots[j].ch === w[1]) {
        used.push(j); w.slot = slots[j];
        if (!slotPlace(w.slot, w[0], w[2])) slotStop(w.slot);
        return;
      }
    });
    slots.forEach(function (sl, j) { if (used.indexOf(j) < 0 && sl.ch) slotStop(sl); });   // 2) apaga los que sobran
    var pending = want.filter(function (w) { return !w.slot; });
    pending = pending.filter(function (w) {         // 3) los nuevos: recuadro con rueda, carga al detenerse
      for (var j = 0; j < slots.length; j++) if (used.indexOf(j) < 0) {
        used.push(j); w.slot = slots[j]; slotStop(w.slot);
        return slotPlace(w.slot, w[0], w[2]);
      }
      return false;
    });
    $('player').classList.toggle('has-prev', want.length > 0);
    if (!pending.length) return;
    prevTimer = setTimeout(function () {
      pending.forEach(function (w, n) {             // el del medio primero y las vecinas casi a la vez
        setTimeout(function () { if (w.slot && !w.slot.ch && w.slot.box.classList.contains('on')) slotLoad(w.slot, w[1], w[2]); }, w[2] ? 120 * n : 0);
      });
    }, 350);
  }
  function slotLoad(sl, c, side) {
    if (!sideOpen || mode !== 'full') return;
    sl.ch = c;
    var box = sl.box, v = sl.v;
    box.classList.add('show');
    var shown = function () { if (sl.ch === c) box.classList.add('ready'); };
    v.onplaying = shown;
    v.ontimeupdate = function () { if (v.currentTime > 0) shown(); };
    if (window.Hls && window.Hls.isSupported()) {
      var h = sl.hls = new window.Hls(side ? PREV_HLS_SIDE : PREV_HLS);
      h.loadSource(c.url);
      h.attachMedia(v);
      h.on(window.Hls.Events.MANIFEST_PARSED, function () {
        try { h.autoLevelCapping = 0; h.nextLevel = 0; } catch (e) { }       // siempre la calidad más baja
        var p = v.play(); if (p && p.catch) p.catch(function () { });
      });
      h.on(window.Hls.Events.ERROR, function (_, d) { if (d.fatal && sl.ch === c) box.classList.add('fail'); });
    } else {
      v.src = c.url; var p = v.play(); if (p && p.catch) p.catch(function () { });
    }
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
    if (mode === 'pip') acts.push(['pipmove', '⇲  Mover la ventana PiP a otra esquina']);
    acts.push(isFav(c) ? ['unfav', '☆  Quitar de favoritos'] : ['fav', '★  Agregar a favoritos']);
    if (!(isFav(c) && store('favFirst') === chKey(c))) acts.push(['favfirst', '⬆  Abrir este canal al iniciar (primer favorito)']);
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
    if (isFav(c)) { delete favs[chKey(c)]; if (c.yt) ytRemove(c); toast('Quitado de favoritos: ' + c.name); }
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
    else if (act === 'pipmove') cyclePip();
    else if (act === 'fav' || act === 'unfav') toggleFav(c);
    else if (act === 'favfirst') {
      if (!isFav(c)) { favs[chKey(c)] = 1; saveSet('favs', favs); }
      store('favFirst', chKey(c));
      refreshChannels();
      toast('⬆ ' + c.name + ' es tu primer favorito: se abrirá al iniciar la app');
    }
    else if (act === 'hide') hideChannel(c);
    else if (act === 'unhide') unhideChannel(c);
  }
  // Canal sobre el que actúan "mantener OK", MENU y los botones de colores
  function contextChannel() {
    if (mode === 'full' && sideOpen) return sideList[sideIdx] || null;
    if (mode === 'full') return nowCh;
    if (focused && focused.classList.contains('wt')) { var wt = wallTiles[+focused.getAttribute('data-w')]; return wt ? wt.c : null; }
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
    if (el.id === 'pipMoveBtn') { cyclePip(); return; }
    if (el.id === 'exitBtn') { exitApp(); return; }
    if (el.id === 'ytAdd') { ytAdd(); return; }
    if (el.id === 'linkPhone') { showLinkQr(); return; }
    if (el.id === 'wallToggle') { wallToggle(); return; }
    if (el.classList.contains('wt')) { wallActivate(el); return; }
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
    if (el.id === 'listMode') {
      LIST_H = !LIST_H; store('listMode', LIST_H ? 'h' : 'v'); updateListModeBtn();
      prevTriple = true; store('prevTriple', '1');      // vuelve a intentar las vecinas en vivo
      toast(LIST_H ? 'Lista horizontal (carrusel) con controles de tiempo' : 'Lista vertical (lateral)');
      return;
    }
    if (el.id === 'checkUpdate') {
      if (IS_ANDROID && typeof window.Android.checkUpdateNow === 'function') { toast('Buscando actualización…'); window.Android.checkUpdateNow(); }
      else if (IS_ANDROID) toast('Para buscar actualizaciones con este botón instala la nueva APK de FuturaTV');
      else location.reload(true);
      return;
    }
    if (el.id === 'unhideAll') { hiddenSet = {}; saveSet('hidden', hiddenSet); refreshChannels(); updateSettingsInfo(); toast('Todos los canales vuelven a estar visibles'); return; }
    if (el.id === 'clearFavs') { favs = {}; saveSet('favs', favs); refreshChannels(); updateSettingsInfo(); toast('Favoritos borrados'); return; }
    if (el.tagName === 'INPUT') {                // OK: empieza a escribir · OK otra vez: termina
      if (document.activeElement === el) { el.blur(); toast('Listo'); }
      else { el.focus(); if (!IS_PHONE) toast('Escribe con el teclado · OK o ▲▼ para terminar'); }
    }
  }
  function updateListModeBtn() {
    $('listMode').textContent = LIST_H ? '▭ Horizontal (carrusel abajo) · cambiar a vertical' : '▯ Vertical (lista al costado) · cambiar a horizontal';
  }
  function updateSettingsInfo() {
    updateListModeBtn(); ytInfo();
    $('favInfo').textContent = Object.keys(favs).length + ' favoritos · ' + Object.keys(hiddenSet).length + ' canales ocultos';
  }

  // Devuelve true si manejó ATRÁS; false si ya estamos en el inicio (la app debe cerrarse).
  function goBack() {
    if (wallBig) { wallCollapse(); return true; }        // muro de favoritos: el agrandado vuelve a su lugar
    if (listening) { cancelVoice(); return true; }
    if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
    if (menuOpen) { closeMenu(); return true; }
    if (mode === 'full' && sideOpen) { closeSide(); return true; }
    if (mode === 'full' && wallReturn()) return true;   // vino del muro de favoritos: vuelve a él
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
    if (currentView !== HOME_VIEW) { showView(HOME_VIEW); setFocus(document.querySelector('.tab[data-view="' + HOME_VIEW + '"]')); return true; }
    if (IS_ANDROID) return false;
    // En la pantalla principal: dejar que webOS cierre la app
    if (window.webOS && window.webOS.platformBack) window.webOS.platformBack();
    else window.close();
    return false;
  }
  // Android avisa cuando el video pasa a (o sale de) la ventanita flotante del sistema
  window.mitvSystemPip = function (on) {
    document.documentElement.classList.toggle('syspip', !!on);
    if (!on && mode === 'full') showTools();
  };
  window.mitvBack = goBack;                                         // usado por Android (tecla ATRÁS)
  window.mitvPause = function () { if (mode !== 'none' && !listening) stopPlayer(); wallTeardown(); }; // al salir a otra app
  window.mitvResume = function () { wallSync(); };

  // OK corto = acción normal · OK mantenido = menú de opciones del canal
  var okTimer = null, okLong = false;
  function okShort() {
    if (mode === 'full' && sideOpen && LIST_H && hbFocus >= 0) { hbAction(HB_CTRL[hbFocus]); bumpSide(); return; }
    if (mode === 'full' && sideOpen) { playChannel(sideList, sideIdx, sideGroup, 'full'); bumpSide(); return; }
    if (mode === 'full') { openSide(); return; }
    activate(focused);
  }

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (listening) {                       // mientras se escucha: ATRÁS u OK cancelan
      if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE || k === KEY.ENTER) cancelVoice();
      e.preventDefault(); return;
    }
    if (wallBig && !menuOpen && k !== KEY.BACK && k !== KEY.ESC && k !== KEY.BACKSPACE) {
      if (wallKey(k)) { e.preventDefault(); return; }
    }
    var typing = document.activeElement && document.activeElement.tagName === 'INPUT';
    if (typing && !IS_PHONE && (k === KEY.UP || k === KEY.DOWN) && document.activeElement.id !== 'searchInput') {
      document.activeElement.blur(); typing = false;             // ▲▼ terminan de escribir y siguen navegando
    }
    if (typing && (k === KEY.LEFT || k === KEY.RIGHT || k === KEY.BACKSPACE)) return; // edición de texto
    if (searchOpen && !typing && !menuOpen && mode !== 'full' && e.key && e.key.length === 1 && /[a-z0-9ñ ]/i.test(e.key)) {
      searchQuery += e.key.toLowerCase(); updateSearch(); e.preventDefault(); return;      // teclado físico
    }

    // Teclas especiales: colores del control y MENU
    if (k === KEY.MENU || k === KEY.M) { if (!typing) { openMenu(contextChannel()); e.preventDefault(); } return; }
    if (k === KEY.GREEN && mode === 'pip') { cyclePip(); e.preventDefault(); return; }
    if (k === KEY.YELLOW || k === KEY.GREEN) { var cf = contextChannel(); if (cf) toggleFav(cf); e.preventDefault(); return; }
    if (k === KEY.RED) { var ch = contextChannel(); if (ch) { if (isHidden(ch)) unhideChannel(ch); else hideChannel(ch); } e.preventDefault(); return; }
    if (k === KEY.BLUE || (k === KEY.P && !typing)) {
      if (mode === 'full') { if (!wallReturn()) minimize(); } else if (mode === 'pip') setMode('full');
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
      if (k === 412 || k === 417 || k === 415 || k === 19 || k === 10252) {     // teclas de reproducción del control
        if (k === 412) seekBy(-30); else if (k === 417) seekBy(30);
        else if (k === 415) { var pv = $('video'); if (pv.paused) togglePause(); } else if (k === 19) { if (!$('video').paused) togglePause(); }
        else togglePause();
        if (sideOpen) bumpSide();
        e.preventDefault(); return;
      }
      if (sideOpen && LIST_H) { bumpSide(); hbKey(k); e.preventDefault(); return; }
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
    if (IS_PHONE) return;                    // en celular el "hover" del dedo no mueve el foco
    var el = e.target.closest && e.target.closest('.focusable');
    if (el && mode !== 'full' && (!menuOpen || el.classList.contains('mbtn'))) setFocus(el);
  });
  document.addEventListener('click', function (e) {
    if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
    if (Date.now() - pipDragEnd < 400) { e.preventDefault(); return; }
    var pt = e.target.closest && e.target.closest('[data-pt]');
    if (pt) { playerTool(pt.getAttribute('data-pt')); return; }
    if (IS_PHONE && mode === 'full' && !sideOpen && e.target.closest && e.target.closest('#player')) { showTools(); return; }
    var hc = e.target.closest && e.target.closest('[data-hc]');
    if (hc) { hbAction(hc.getAttribute('data-hc')); bumpSide(); return; }
    var card = e.target.closest && e.target.closest('.hcard[data-s]');
    if (card) { var ci = +card.getAttribute('data-s'); if (ci === sideIdx) okShort(); else { sideIdx = ci; hbFocus = -1; updateSideMarks(); bumpSide(); } return; }
    var row = e.target.closest && e.target.closest('.srow');
    if (row && row.hasAttribute('data-s')) { sideIdx = +row.getAttribute('data-s'); okShort(); return; }
    if (mode === 'full' && !sideOpen && e.target.closest && e.target.closest('#player')) { openSide(); return; }
    if (mode === 'pip' && e.target.closest && e.target.closest('#player')) { setMode('full'); return; }
    var el = e.target.closest && e.target.closest('.focusable');
    if (el) { setFocus(el); activate(el); }
  });
  document.addEventListener('contextmenu', function (e) {
    if (IS_PHONE) { e.preventDefault(); return; }    // en celular se usa "mantener presionado"
    var el = e.target.closest && e.target.closest('[data-ch]');
    if (el) { e.preventDefault(); setFocus(el); openMenu(filtered[+el.getAttribute('data-ch')]); }
  });

  // ---------- Celular: gestos táctiles ----------
  var suppressClick = false, pressTimer = null, touchY0 = 0, touchIdx0 = 0, touchMoved = false;
  function pressTarget(t) { return t.closest && (t.closest('[data-ch]') || t.closest('.srow[data-s]')); }
  document.addEventListener('touchstart', function (e) {
    var t = e.touches[0];
    touchMoved = false; touchY0 = t.clientY; touchIdx0 = sideIdx;
    var el = pressTarget(e.target);
    clearTimeout(pressTimer);
    if (!el) return;
    pressTimer = setTimeout(function () {      // mantener presionado = opciones del canal
      if (touchMoved) return;
      suppressClick = true;
      var c = el.hasAttribute('data-s') ? sideList[+el.getAttribute('data-s')] : filtered[+el.getAttribute('data-ch')];
      if (c && !c.isCountry) { if (navigator.vibrate) navigator.vibrate(30); openMenu(c); }
    }, 550);
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    var dy = e.touches[0].clientY - touchY0;
    if (Math.abs(dy) > 10) { touchMoved = true; clearTimeout(pressTimer); }
    // Deslizar el dedo sobre la lista lateral la recorre
    if (sideOpen && e.target.closest && e.target.closest('#side') && sideList.length) {
      var rowH = ($('sideList').firstChild && $('sideList').firstChild.offsetHeight) || 56;
      var idx = Math.max(0, Math.min(sideList.length - 1, touchIdx0 - Math.round(dy / rowH)));
      if (idx !== sideIdx) { sideIdx = idx; updateSideMarks(); bumpSide(); }
      if (e.cancelable) e.preventDefault();
    }
  }, { passive: false });
  document.addEventListener('touchend', function () {
    clearTimeout(pressTimer);
    if (touchMoved && sideOpen) suppressClick = true;   // fue un deslizamiento, no un toque
  }, { passive: true });

  // ---------- PiP movible: arrastrar (dedo o puntero) o botón VERDE ----------
  var PIP_POS = ['br', 'bl', 'tl', 'tr'];
  var PIP_NAMES = { br: 'abajo a la derecha', bl: 'abajo a la izquierda', tl: 'arriba a la izquierda', tr: 'arriba a la derecha' };
  var pipPos = PIP_POS.indexOf(store('pipPos')) >= 0 ? store('pipPos') : 'br';
  var pipDrag = null, pipDragEnd = 0;
  function applyPipPos() {
    var p = $('player');
    if (!PIP_POS) return;
    PIP_POS.forEach(function (c) { p.classList.toggle('pos-' + c, c === pipPos); });
    if (!pipDrag) { p.style.transition = ''; p.style.transform = ''; }
  }
  function setPipPos(c, fromRect) {
    var p = $('player');
    pipPos = c; store('pipPos', c);
    p.style.transition = 'none'; p.style.transform = '';
    applyPipPos();
    if (fromRect) {                          // animación suave hasta la esquina
      var to = p.getBoundingClientRect();
      p.style.transform = 'translate(' + (fromRect.left - to.left) + 'px,' + (fromRect.top - to.top) + 'px)';
      void p.offsetWidth;
      p.style.transition = 'transform .22s ease-out';
      p.style.transform = '';
    }
  }
  function cyclePip() {
    if (mode !== 'pip') return;
    var p = $('player'), from = p.getBoundingClientRect();
    setPipPos(PIP_POS[(PIP_POS.indexOf(pipPos) + 1) % PIP_POS.length], from);
    toast('Ventana PiP: ' + PIP_NAMES[pipPos]);
  }
  function pipDown(x, y, target) {
    if (mode !== 'pip' || !target.closest || !target.closest('#player')) return false;
    var r = $('player').getBoundingClientRect();
    pipDrag = { x: x, y: y, r: r, moved: false, dx: 0, dy: 0 };
    return true;
  }
  function pipMove(x, y) {
    if (!pipDrag) return false;
    var d = pipDrag, W = window.innerWidth, H = window.innerHeight;
    d.dx = Math.max(-d.r.left, Math.min(W - d.r.right, x - d.x));
    d.dy = Math.max(-d.r.top, Math.min(H - d.r.bottom, y - d.y));
    if (!d.moved && Math.abs(x - d.x) + Math.abs(y - d.y) < 10) return true;
    d.moved = true;
    var p = $('player');
    p.style.transition = 'none';
    p.style.transform = 'translate(' + d.dx + 'px,' + d.dy + 'px)';
    p.classList.add('dragging');
    return true;
  }
  function pipUp() {
    if (!pipDrag) return;
    var d = pipDrag; pipDrag = null;
    $('player').classList.remove('dragging');
    if (!d.moved) return;                  // fue un toque: lo maneja el click
    pipDragEnd = Date.now();
    var cx = (d.r.left + d.r.right) / 2 + d.dx, cy = (d.r.top + d.r.bottom) / 2 + d.dy;
    var c = (cy < window.innerHeight / 2 ? 't' : 'b') + (cx < window.innerWidth / 2 ? 'l' : 'r');
    setPipPos(c, { left: d.r.left + d.dx, top: d.r.top + d.dy });
  }
  $('player').addEventListener('touchstart', function (e) { pipDown(e.touches[0].clientX, e.touches[0].clientY, e.target); }, { passive: true });
  $('player').addEventListener('touchmove', function (e) {
    if (pipMove(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault();
  }, { passive: false });
  $('player').addEventListener('touchend', pipUp);
  $('player').addEventListener('touchcancel', pipUp);
  $('player').addEventListener('mousedown', function (e) { if (pipDown(e.clientX, e.clientY, e.target)) e.preventDefault(); });
  document.addEventListener('mousemove', function (e) { if (pipDrag) pipMove(e.clientX, e.clientY); });
  document.addEventListener('mouseup', pipUp);

  // Botones táctiles del reproductor
  var toolsTimer = null;
  function showTools() {
    $('ptools').classList.remove('hidden');
    showOsd();
    clearTimeout(toolsTimer);
    toolsTimer = setTimeout(function () { $('ptools').classList.add('hidden'); }, 4500);
  }
  function playerTool(t) {
    if (t === 'close') { if (!wallReturn()) stopPlayer(); return; }   // si vino del muro, vuelve a él
    if (t === 'pip') { if (!wallReturn()) minimize(); return; }
    if (t === 'list') { if (mode !== 'full') setMode('full'); $('ptools').classList.add('hidden'); openSide(); return; }
    if (t === 'prev') { zap(-1); showTools(); return; }
    if (t === 'next') { zap(1); showTools(); return; }
    if (t === 'full') { setMode('full'); showTools(); return; }
  }

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
  window.mitvUpdateStatus = function (s) {
    toast({ ok: 'Ya tienes la última versión', downloading: 'Descargando la nueva versión…',
            error: 'No se pudo revisar. ¿Hay internet?' }[s] || s);
  };
  window.mitvUpdateReady = function (version) {
    pendingUpdate = version;
    if (mode === 'none' && !menuOpen && !searchOpen) applyUpdate();
    else toast('Nueva versión ' + version + ' descargada. Se aplicará al cerrar el video.');
  };
  getText('version.json').then(function (t) {
    var v = JSON.parse(t).version;
    $('appVersion').textContent = 'FuturaTV versión ' + APP_BUILD + (IS_ANDROID ? ' · se actualiza sola desde internet' : '') +
      (v !== APP_BUILD ? ' · ⚠ actualización incompleta (' + v + '): aprieta «Buscar actualización ahora»' : '');
  }).catch(function () { });

  // ---------- Muro de favoritos en vivo (celular) ----------
  // Todos los favoritos se reproducen a la vez, sin sonido y en baja calidad. Al tocar uno se agranda al
  // frente con sonido; deslizándolo hacia arriba vuelve a su lugar. Se activa con el botón «Favoritos en vivo».
  // Videos a la vez (los que están en pantalla). Si un equipo no aguanta tantos, los que fallan muestran «Sin señal».
  var WALL_MAX = IS_PHONE ? 10 : 6;          // TV: 6 grandes en 3 columnas (si hay más, se ven bajando)
  var WALL_STALL = IS_PHONE ? 4 : 7;       // vueltas de 1,5 s sin avanzar antes de reconectar (TV: ~10 s)
  var WALL_HINT = IS_PHONE ? 'Desliza ↑ para volver' : '◀ ▶ cambiar · OK pantalla completa · ATRÁS volver';
  var WALL_HLS = {
    enableWorker: true,                       // el procesamiento del video va en otro hilo: la pantalla no se traba
    startLevel: 0, testBandwidth: false, abrEwmaDefaultEstimate: 300000,   // parte directo en la calidad más baja
    capLevelToPlayerSize: true, capLevelOnFPSDrop: true,                   // si el equipo pierde cuadros, no sube
    maxBufferLength: 12, maxMaxBufferLength: 20, maxBufferSize: 8 * 1000 * 1000, backBufferLength: 0,
    liveSyncDurationCount: 4, maxStarvationDelay: 6, startFragPrefetch: true,   // más colchón: menos cortes
    manifestLoadingTimeOut: 10000, levelLoadingTimeOut: 10000, fragLoadingTimeOut: 15000
  };
  if (!IS_PHONE) {                            // solo TV: más reintentos antes de dar un canal por caído
    WALL_HLS.manifestLoadingMaxRetry = 3; WALL_HLS.levelLoadingMaxRetry = 5; WALL_HLS.fragLoadingMaxRetry = 6;
    WALL_HLS.manifestLoadingRetryDelay = 1000; WALL_HLS.levelLoadingRetryDelay = 1000; WALL_HLS.fragLoadingRetryDelay = 1000;
    WALL_HLS.nudgeMaxRetry = 6;               // pequeños saltos para destrabar la imagen sin recargar
  }
  var ICO_PLAY_SOUND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="pl" d="M5 5.5v13l9-6.5z"/><path class="sn" d="M16.5 9.2a4 4 0 0 1 0 5.6M19 6.8a7.5 7.5 0 0 1 0 10.4"/></svg>';
  var ICO_MUTED = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="pl" d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path class="sn" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';
  var ICO_SOUND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="pl" d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path class="sn" d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.8a7.5 7.5 0 0 1 0 10.4"/></svg>';
  var wallOn = store('favWall') === '1', wallShown = false, wallSig = '', wallTiles = [], wallBig = null, wallIO = null;
  var wallReady = true;
  var wallFullOpen = false;      // TV: pantalla completa abierta desde el muro (el muro queda en pausa, sin recargar)
  var wallSoundTile = null, wallLastClick = { t: null, at: 0 };

  function wallShouldShow() {
    return wallOn && currentView === 'live' && activeGroup === FAV_GROUP && !searchOpen &&
      (mode === 'none' || (wallFullOpen && mode === 'full')) && !document.hidden;
  }
  function wallSync() {
    if (!wallReady) return;
    var hasFav = channels.length > 0 && listFor(FAV_GROUP).length > 0;
    var btn = $('wallToggle');
    btn.classList.toggle('hidden', !hasFav);
    btn.classList.toggle('on', wallOn);
    btn.setAttribute('aria-pressed', wallOn ? 'true' : 'false');
    if (hasFav && wallShouldShow()) {
      if (wallFullOpen && wallShown) return;           // detrás de la pantalla completa: queda tal cual, en pausa
      var list = listFor(FAV_GROUP), sig = list.map(chKey).join('|');
      if (!wallShown || sig !== wallSig) wallBuild(list, sig);
      $('favWall').classList.remove('hidden'); $('channelGrid').classList.add('hidden');
      wallSchedule();
    } else if (wallShown) wallTeardown();
  }
  function wallBuild(list, sig) {
    wallTeardown();
    wallShown = true; wallSig = sig;
    var box = $('favWall');
    box.innerHTML = list.map(function (c, i) {
      return '<div class="wt focusable" data-w="' + i + '"><div class="wt-in">' +
        '<div class="wt-logo">' + logoHtml(c, true) + '</div>' +
        '<video muted autoplay playsinline disablepictureinpicture></video>' +
        '<span class="wt-name">' + escapeHtml(c.name) + '</span>' +
        '<button class="wt-btn" aria-label="Ver con sonido">' + ICO_PLAY_SOUND + '</button>' +
        '<span class="wt-hint">' + WALL_HINT + '</span>' +
        '<button class="wt-full" aria-label="Pantalla completa">⛶</button>' +
        '<i class="wt-spin"></i><span class="wt-err">Sin señal · toca para reintentar</span>' +
        '</div></div>';
    }).join('');
    wallTiles = list.map(function (c, i) {
      var el = box.children[i], t = { c: c, i: i, el: el, inner: el.firstChild, video: el.querySelector('video'), hls: null, live: false, visible: !window.IntersectionObserver, failed: false };
      var shown = function () { if (t.live) { el.classList.remove('loading'); el.classList.add('ready'); t.fixes = 0; } };
      t.video.addEventListener('playing', shown);
      t.video.addEventListener('timeupdate', function () { if (t.video.currentTime > 0 && t.live && !el.classList.contains('ready')) shown(); });
      t.video.addEventListener('waiting', function () { if (t.live) el.classList.add('loading'); });
      t.video.addEventListener('error', function () { if (t.live && !t.hls) wallFail(t); });
      return t;
    });
    if (window.IntersectionObserver) {
      wallIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { var t = wallTiles[+en.target.getAttribute('data-w')]; if (t) t.visible = en.isIntersecting; });
        wallSchedule();
      }, { root: box, rootMargin: '40px 0px', threshold: 0.2 });
      wallTiles.forEach(function (t) { wallIO.observe(t.el); });
    }
    if (!store('wallTip3')) {
      store('wallTip3', '1');
      toast(IS_PHONE ? 'Un toque: activar el sonido · doble toque: pantalla completa'
                     : 'OK: activar el sonido · OK dos veces: pantalla completa');
    }
  }
  function wallTeardown() {
    if (wallBig) wallCollapse(true);
    if (wallIO) { wallIO.disconnect(); wallIO = null; }
    wallQueue = []; wallFullOpen = false; wallSoundTile = null;
    wallTiles.forEach(wallStop);
    var lostFocus = focused && focused.classList.contains('wt');
    wallTiles = []; wallShown = false; wallSig = '';
    var box = $('favWall');
    if (box) { box.innerHTML = ''; box.classList.add('hidden'); }
    $('channelGrid').classList.remove('hidden');
    if (lostFocus) { focused = null; setFocus(wallToggleVisible() ? $('wallToggle') : document.querySelector('.chip.active')); }
  }
  function wallToggleVisible() { return !$('wallToggle').classList.contains('hidden'); }
  // Decide qué cuadros reproducen: los visibles (hasta WALL_MAX) y siempre el agrandado
  var wallQueue = [], wallQueueTimer = null;
  function wallSchedule() {
    if (!wallShown || wallFullOpen) return;
    if (wallBig) { if (!wallBig.live) wallStart(wallBig); return; }   // con uno agrandado no se tocan los demás
    var n = 0;
    wallQueue = [];
    wallTiles.forEach(function (t) {
      var want = t.visible && !t.failed && !t.c.yt && n < WALL_MAX;
      if (want) n++;
      if (want && !t.live) wallQueue.push(t);
      else if (!want && t.live) wallStop(t);
    });
    wallKick();
  }
  // Arranca los videos de a uno (escalonado): evita el tirón de abrir 10 a la vez
  function wallKick() {
    if (wallQueueTimer || !wallQueue.length) return;
    var t = wallQueue.shift();
    if (wallShown && !wallBig && !t.live && t.visible && !t.failed && wallTiles.indexOf(t) >= 0) wallStart(t);
    wallQueueTimer = setTimeout(function () { wallQueueTimer = null; wallKick(); }, IS_PHONE ? 200 : 600);
  }
  function wallStart(t) {
    t.live = true; t.failed = false;
    t.el.classList.remove('err', 'ready'); t.el.classList.add('loading');
    var v = t.video;
    v.muted = t !== wallBig;
    if (window.Hls && window.Hls.isSupported()) {
      t.hls = new window.Hls(WALL_HLS);
      t.hls.loadSource(t.c.url);
      t.hls.attachMedia(v);
      t.hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
        wallQuality(t, t === wallBig);
        if (wallBig && t !== wallBig) return;                 // hay uno agrandado: este espera
        var p = v.play(); if (p && p.catch) p.catch(function () { });
      });
      t.fixes = 0;
      t.hls.on(window.Hls.Events.ERROR, function (_, d) {
        if (!d.fatal) return;
        if (!IS_PHONE && wallRecover(t, d)) return;       // TV: intenta recuperarse antes de rendirse
        wallFail(t);
      });
    } else {
      v.src = t.c.url;
      var p = v.play(); if (p && p.catch) p.catch(function () { });
    }
  }
  // TV: un error grave no corta el canal de inmediato; se recupera sin destruir el video
  function wallRecover(t, d) {
    if (!t.hls || t.fixes >= 4) return false;
    t.fixes++;
    var E = window.Hls.ErrorTypes, h = t.hls;
    if (d.type === E.MEDIA_ERROR) {
      try { if (t.fixes === 2) h.swapAudioCodec(); h.recoverMediaError(); } catch (e) { return false; }
      return true;
    }
    if (d.type === E.NETWORK_ERROR && d.details !== 'manifestLoadError') {
      setTimeout(function () { if (t.hls === h) { try { h.startLoad(-1); } catch (e) { } } }, 1500 * t.fixes);
      return true;
    }
    return false;
  }
  function wallStop(t) {
    t.live = false;
    if (t.hls) { try { t.hls.destroy(); } catch (e) { } t.hls = null; }
    t.video.removeAttribute('src'); try { t.video.load(); } catch (e) { }
    t.el.classList.remove('loading', 'ready');
  }
  function wallFail(t) {
    wallStop(t); t.failed = true; t.el.classList.add('err');
    if (t === wallBig) toast(t.c.name + ': este canal no está disponible ahora');
    setTimeout(wallSchedule, 0);           // otro favorito visible toma su lugar
  }
  function wallBigRect() {
    var W = window.innerWidth, H = window.innerHeight, m = 8, w, h;
    if (!IS_PHONE) {                                                    // TV: grande al frente, con borde a la vista
      W = document.documentElement.clientWidth || 1920; H = document.documentElement.clientHeight || 1080;
      h = H * 0.82; w = h * 16 / 9;
      return { left: (W - w) / 2, top: (H - h) / 2, width: w, height: h };
    }
    if (W < H) { w = W - m * 2; h = w * 9 / 16; }                      // vertical: a lo ancho
    else { h = Math.min(H - m * 2, (W - m * 2) * 9 / 16); w = h * 16 / 9; } // horizontal: lo más grande posible
    return { left: (W - w) / 2, top: Math.max(m, (H - h) / 2 - (W < H ? H * 0.06 : 0)), width: w, height: h };
  }
  function wallPlace(inner, r) {
    inner.style.left = r.left + 'px'; inner.style.top = r.top + 'px';
    inner.style.width = r.width + 'px'; inner.style.height = r.height + 'px';
  }
  // Transform que lleva el recuadro grande (B) a la posición/tamaño de r (técnica FLIP: solo GPU)
  function wallFlip(r, B) {
    return 'translate(' + (r.left - B.left) + 'px,' + (r.top - B.top) + 'px) scale(' + (r.width / B.width) + ',' + (r.height / B.height) + ')';
  }
  function wallSetSound(t, on) {
    t.video.muted = !on;
    t.el.querySelector('.wt-btn').innerHTML = on ? ICO_SOUND : ICO_MUTED;
    t.el.classList.toggle('sound', on);
    if (on) { var p = t.video.play(); if (p && p.catch) p.catch(function () { }); }
  }
  // Calidad: cuadros chicos en la más baja; el agrandado elige solo según su tamaño
  function wallQuality(t, big) {
    if (!t.hls) return;
    try {
      t.hls.autoLevelCapping = big ? -1 : 0;
      if (!big && t.hls.levels && t.hls.levels.length > 1) t.hls.nextLevel = 0;   // los cuadros chicos siempre en la más baja
    } catch (e) { }
  }
  // Mientras hay uno agrandado los demás se pausan: todo el equipo trabaja para el del frente
  function wallHold(t, hold) {
    if (!t.live) return;
    var v = t.video;
    if (hold) { try { v.pause(); } catch (e) { } return; }   // la descarga se frena sola al llenar el búfer chico
    try {                                                    // si quedó atrás, vuelve al directo
      var live = t.hls && t.hls.liveSyncPosition;
      if (live && v.currentTime < live - 8) v.currentTime = live;
    } catch (e) { }
    var play = function () { if (t.live && wallBig !== t && v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () { }); } };
    play(); setTimeout(play, 600);
  }
  function wallExpand(t) {
    if (wallBig === t) return;
    if (wallBig) wallCollapse(true);
    wallBig = t;
    var inner = t.inner, r = inner.getBoundingClientRect(), B = wallBigRect();
    t.el.classList.add('has-big');                            // sin zoom de foco: el video puede salir al frente
    inner.style.transition = 'none';
    inner.classList.add('big');
    wallPlace(inner, B);                                      // queda en su tamaño final…
    inner.style.transform = wallFlip(r, B);                   // …pero se ve todavía en el cuadro
    $('wallShade').classList.remove('hidden');
    void inner.offsetWidth;
    inner.style.transition = '';
    inner.style.transform = 'none';                           // y vuela al frente (solo GPU)
    $('wallShade').classList.add('show');
    wallTiles.forEach(function (o) { if (o !== t) { o.video.muted = true; wallHold(o, true); } });
    if (!t.live) wallStart(t);
    wallQuality(t, true);
    wallSetSound(t, true);                                    // solo el agrandado tiene sonido
    wallSchedule();
  }
  function wallCollapse(instant) {
    var t = wallBig; if (!t) return;
    wallBig = null;
    var inner = t.inner;
    wallSetSound(t, false);
    wallQuality(t, false);
    t.el.querySelector('.wt-btn').innerHTML = ICO_PLAY_SOUND;
    $('wallShade').classList.remove('show');
    if (!IS_PHONE || (focused && focused.classList.contains('wt'))) setFocus(t.el);   // el foco vuelve a su cuadro
    var finished = false;
    function done() {
      if (finished) return; finished = true;
      if (wallBig === t) return;
      inner.classList.remove('big', 'drag'); inner.style.cssText = '';
      t.el.classList.remove('has-big');
      if (!wallBig) $('wallShade').classList.add('hidden');
      wallTiles.forEach(function (o) { if (o !== t && o !== wallBig) wallHold(o, false); });
      wallSchedule();
    }
    if (instant) { done(); return; }
    var B = { left: parseFloat(inner.style.left), top: parseFloat(inner.style.top), width: parseFloat(inner.style.width), height: parseFloat(inner.style.height) };
    inner.classList.remove('drag');
    inner.style.opacity = '';
    inner.style.transition = '';
    inner.style.transform = wallFlip(t.el.getBoundingClientRect(), B);   // vuelve volando a su lugar
    inner.addEventListener('transitionend', function te(e) { if (e.propertyName === 'transform') { inner.removeEventListener('transitionend', te); done(); } });
    setTimeout(done, 400);                                    // por si no llega transitionend
  }

  $('wallToggle').addEventListener('click', function (e) { e.stopPropagation(); setFocus($('wallToggle')); wallToggle(); });
  function wallToggle() {
    wallOn = !wallOn; store('favWall', wallOn ? '1' : '0');
    if (wallOn) {
      if (searchOpen) closeSearch(true);
      if (activeGroup !== FAV_GROUP) { activeGroup = FAV_GROUP; renderGroups(); renderChannels(); markPlaying(); return; }
      toast('Favoritos en vivo: activado');
    } else toast('Favoritos en vivo: desactivado');
    wallSync();
  }
  // Control remoto: OK en un cuadro lo agranda; con uno agrandado ◀ ▶ cambian de canal, OK = pantalla completa
  // TV: un clic = sonido de ese canal (solo uno suena) · doble clic = pantalla completa
  function wallTvClick(t) {
    if (t.c.yt) { openYouTube(t.c); return; }
    var now = Date.now(), dbl = wallLastClick.t === t && now - wallLastClick.at < 450;
    wallLastClick = { t: t, at: dbl ? 0 : now };
    if (t.failed) { t.failed = false; t.el.classList.remove('err'); wallSchedule(); }
    if (!t.live) wallStart(t);
    if (dbl) { wallFull(t); return; }
    wallSound(wallSoundTile === t ? null : t);
  }
  function wallSound(t) {                     // deja con sonido solo a t (o a ninguno)
    wallTiles.forEach(function (o) {
      var on = o === t;
      o.video.muted = !on;
      o.el.classList.toggle('sound', on);
      o.el.querySelector('.wt-btn').innerHTML = on ? ICO_SOUND : ICO_PLAY_SOUND;
      wallQuality(o, false);                  // el cuadro es chico: aunque suene, sigue en la calidad más baja
    });
    wallSoundTile = t;
    if (t) { var p = t.video.play(); if (p && p.catch) p.catch(function () { }); }
  }
  // Al salir de la pantalla completa se vuelve al muro tal como estaba (sin recargarlo)
  function wallReturn() {
    if (!wallFullOpen) return false;
    var ch = nowCh;
    wallFullOpen = false;
    stopPlayer();                             // modo 'none' -> el muro sigue armado
    var t = null;
    wallTiles.forEach(function (o) { if (ch && chKey(o.c) === chKey(ch)) t = o; });
    wallTiles.forEach(function (o) { wallHold(o, false); });
    wallSchedule();
    if (t) { if (!t.live) wallStart(t); setFocus(t.el); wallSound(t); }
    return true;
  }
  function wallActivate(el) {
    var t = wallTiles[+el.getAttribute('data-w')]; if (!t) return;
    wallTvClick(t); return;                    // TV y celular: un toque = sonido · doble toque = pantalla completa
    if (t.failed) { t.failed = false; t.el.classList.remove('err'); }
    wallExpand(t);
  }
  function wallFull(t) {
    var list = listFor(FAV_GROUP), i = t.i;
    wallCollapse(true);
    wallFullOpen = true;                      // el muro queda en pausa detrás, listo para volver sin recargar
    wallTiles.forEach(function (o) { o.video.muted = true; wallHold(o, true); });
    playChannel(list, i, FAV_GROUP, 'full');
  }
  function wallKey(k) {                       // devuelve true si la tecla se usó
    if (!wallBig) return false;
    var n = wallTiles.length, t = wallBig;
    if (k === KEY.LEFT || k === KEY.RIGHT) {
      var nt = wallTiles[(t.i + (k === KEY.LEFT ? -1 : 1) + n) % n];
      if (nt !== t) { wallCollapse(true); setFocus(nt.el); wallExpand(nt); }
      return true;
    }
    if (k === KEY.UP) { wallCollapse(); return true; }
    if (k === KEY.ENTER) { wallFull(t); return true; }
    if (k === KEY.DOWN) return true;
    return false;
  }
  $('favWall').addEventListener('click', function (e) {
    e.stopPropagation();
    if (wallSwiped) { wallSwiped = false; return; }
    var tile = e.target.closest && e.target.closest('.wt'); if (!tile) return;
    var t = wallTiles[+tile.getAttribute('data-w')]; if (!t) return;
    setFocus(t.el);
    wallTvClick(t); return;                                     // toque = sonido · doble toque = pantalla completa
    if (t === wallBig) { if (e.target.closest('.wt-btn')) wallSetSound(t, t.video.muted); return; }
    if (t.failed) { t.failed = false; t.el.classList.remove('err'); }
    wallExpand(t);
  });
  $('wallShade').addEventListener('click', function () { if (!wallSwiped) wallCollapse(); wallSwiped = false; });

  // Deslizar hacia arriba el video agrandado (o el fondo) lo devuelve a su lugar
  var wallY0 = 0, wallDY = 0, wallDrag = false, wallSwiped = false;
  function wallTouchStart(e) {
    if (!wallBig) return;
    wallY0 = e.touches[0].clientY; wallDY = 0; wallDrag = true;
    wallBig.inner.classList.add('drag');
  }
  var wallRaf = 0;
  function wallTouchMove(e) {
    if (!wallDrag || !wallBig) return;
    wallDY = e.touches[0].clientY - wallY0;
    if (e.cancelable) e.preventDefault();
    if (wallRaf) return;
    wallRaf = requestAnimationFrame(function () {             // un cambio por cuadro de pantalla
      wallRaf = 0;
      if (!wallBig || !wallDrag) return;
      var dy = wallDY < 0 ? wallDY : wallDY * 0.25;          // hacia abajo apenas se mueve
      wallBig.inner.style.transform = 'translate3d(0,' + dy + 'px,0)';
      wallBig.inner.style.opacity = String(Math.max(0.35, 1 + Math.min(0, wallDY) / 400));
    });
  }
  function wallTouchEnd() {
    if (!wallDrag) return;
    wallDrag = false;
    if (!wallBig) return;
    var inner = wallBig.inner;
    inner.style.opacity = '';
    if (Math.abs(wallDY) > 12) wallSwiped = true;             // fue deslizamiento, no toque
    setTimeout(function () { wallSwiped = false; }, 350);
    if (wallDY < -60) { wallCollapse(); return; }
    inner.classList.remove('drag');
    inner.style.transform = 'none';
  }
  [$('favWall'), $('wallShade')].forEach(function (el) {
    el.addEventListener('touchstart', wallTouchStart, { passive: true });
    el.addEventListener('touchmove', wallTouchMove, { passive: false });
    el.addEventListener('touchend', wallTouchEnd, { passive: true });
    el.addEventListener('touchcancel', wallTouchEnd, { passive: true });
  });
  window.addEventListener('resize', function () {
    if (!wallBig) return;
    var inner = wallBig.inner;
    inner.style.transition = 'none'; wallPlace(inner, wallBigRect()); inner.style.transform = 'none';
    void inner.offsetWidth; inner.style.transition = '';
  });
  document.addEventListener('visibilitychange', wallSync);
  // Vigilante: algunos equipos pausan solos videos sin sonido; si el muro está a la vista, se reanudan
  // y si un cuadro no avanza durante ~5 s, se vuelve a conectar solo ese cuadro
  setInterval(function () {
    if (!wallShown || wallFullOpen || wallBig || document.hidden) return;
    var reconnected = false;
    wallTiles.forEach(function (t) {
      if (!t.live) { t.stall = 0; return; }
      var v = t.video, ct = v.currentTime;
      if (v.paused || ct === t.lastCt) t.stall = (t.stall || 0) + 1; else t.stall = 0;
      t.lastCt = ct;
      if (t.stall >= WALL_STALL && !reconnected) {   // de a uno por vuelta, para no recargar el equipo
        reconnected = true; t.stall = 0;
        var snd = t === wallSoundTile; wallStop(t); wallStart(t); if (snd) t.video.muted = false; return;
      }
      if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () { }); }
    });
  }, 1500);

  // TV: al abrir la app se pone el primer favorito en pantalla completa
  var autoStarted = false;
  function autoStartFavorite() {
    if (autoStarted || IS_PHONE) return;
    autoStarted = true;
    var favList = listFor(FAV_GROUP).filter(function (c) { return !c.yt; });
    if (!favList.length || mode !== 'none') return;
    playChannel(favList, 0, FAV_GROUP, 'full');
  }

  // ---------- Inicio ----------
  var splashStart = Date.now();
  function hideSplash() {
    var sp = $('splash');
    if (!sp || sp.classList.contains('out')) return;
    sp.classList.add('out');
    setTimeout(function () { if (sp.parentNode) sp.parentNode.removeChild(sp); }, 600);
  }
  window.addEventListener('load', function () { setTimeout(hideSplash, Math.max(0, 1500 - (Date.now() - splashStart))); });
  window.mitvReadyFast = function () { setTimeout(hideSplash, Math.max(0, 500 - (Date.now() - splashStart))); };   // canales listos: fuera el logo
  setTimeout(hideSplash, 4000);

  renderApps();
  showView(HOME_VIEW);
  setTimeout(function () { if (!channels.length && !loadingChannels) loadChannels(); }, 300);   // precarga la lista para que "Canales en vivo" abra al instante
  setFocus(document.querySelector('.tab[data-view="live"]'));
  tick(); setInterval(tick, 15000);
})();
