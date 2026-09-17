/* Shared by every city page.

   Distances are baked into each card's data-dist at build time (from the
   town centre), so the page works with JavaScript off. When the user shares
   their location, distances recompute from their actual position and
   everything re-sorts. */

(function () {
  if (typeof TOWN === 'undefined') return;

  var cards   = [].slice.call(document.querySelectorAll('#cards .card'));
  var countEl = document.getElementById('count');
  var emptyEl = document.getElementById('empty');
  var resetEl = document.getElementById('reset');
  var cardsEl = document.getElementById('cards');

  var state = { age: 'all', env: 'all' };
  var userLoc = null;

  try {
    var seg = location.pathname.replace(/\/+$/, '').split('/').pop();
    if (seg) localStorage.setItem('owtk.city', seg);
  } catch (e) {}

  try {
    var saved = localStorage.getItem('owtk.loc');
    if (saved) userLoc = JSON.parse(saved);
  } catch (e) {}

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function haversine(lat1, lon1, lat2, lon2) {
    var R = 3958.8, r = Math.PI / 180;
    var dla = (lat2 - lat1) * r, dlo = (lon2 - lon1) * r;
    var a = Math.sin(dla / 2) * Math.sin(dla / 2) +
            Math.cos(lat1 * r) * Math.cos(lat2 * r) *
            Math.sin(dlo / 2) * Math.sin(dlo / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function showMiles(d) {
    return d < 10 ? String(Math.round(d * 10) / 10) : String(Math.round(d));
  }

  function cardDist(card) {
    if (userLoc) {
      var lat = +card.getAttribute('data-lat');
      var lon = +card.getAttribute('data-lon');
      if (lat && lon) return haversine(userLoc.lat, userLoc.lon, lat, lon);
    }
    return +card.getAttribute('data-dist');
  }

  function sortCards() {
    cards.sort(function (a, b) { return cardDist(a) - cardDist(b); });
    cards.forEach(function (c) {
      var mi = showMiles(cardDist(c));
      var el = c.querySelector('.m-dist');
      if (el) el.textContent = mi + ' mi';
      cardsEl.appendChild(c);
    });
  }

  var ZIPS = {
    '94203':[38.382,-121.443],'94204':[38.581,-121.494],'94205':[38.581,-121.494],
    '94206':[38.581,-121.494],'94207':[38.581,-121.494],'94208':[38.581,-121.494],
    '94209':[38.581,-121.494],'94211':[38.581,-121.494],'94229':[38.581,-121.494],
    '94230':[38.581,-121.494],'94232':[38.581,-121.494],'94234':[38.581,-121.494],
    '94235':[38.581,-121.494],'94236':[38.581,-121.494],'94237':[38.581,-121.494],
    '94239':[38.581,-121.494],'94240':[38.581,-121.494],'94244':[38.581,-121.494],
    '94245':[38.581,-121.494],'94247':[38.581,-121.494],'94248':[38.581,-121.494],
    '94249':[38.581,-121.494],'94252':[38.581,-121.494],'94254':[38.581,-121.494],
    '94256':[38.581,-121.494],'94257':[38.581,-121.494],'94258':[38.581,-121.494],
    '94259':[38.581,-121.494],'94261':[38.581,-121.494],'94262':[38.581,-121.494],
    '94263':[38.581,-121.494],'94267':[38.581,-121.494],'94268':[38.581,-121.494],
    '94269':[38.581,-121.494],'94271':[38.581,-121.494],'94273':[38.581,-121.494],
    '94274':[38.581,-121.494],'94277':[38.581,-121.494],'94278':[38.581,-121.494],
    '94279':[38.581,-121.494],'94280':[38.581,-121.494],'94282':[38.581,-121.494],
    '94283':[38.581,-121.494],'94284':[38.581,-121.494],'94285':[38.581,-121.494],
    '94287':[38.581,-121.494],'94288':[38.581,-121.494],'94289':[38.581,-121.494],
    '94290':[38.581,-121.494],'94291':[38.581,-121.494],'94293':[38.581,-121.494],
    '94294':[38.581,-121.494],'94295':[38.581,-121.494],'94296':[38.581,-121.494],
    '94297':[38.581,-121.494],'94298':[38.581,-121.494],'94299':[38.581,-121.494],
    '95608':[38.636,-121.328],'95609':[38.605,-121.337],'95610':[38.686,-121.273],
    '95611':[38.686,-121.273],'95615':[38.357,-121.568],'95621':[38.677,-121.309],
    '95624':[38.437,-121.302],'95626':[38.686,-121.472],'95628':[38.625,-121.260],
    '95630':[38.668,-121.159],'95632':[38.264,-121.299],'95638':[38.418,-121.075],
    '95639':[38.349,-121.505],'95641':[38.331,-121.513],'95652':[38.649,-121.386],
    '95655':[38.563,-121.192],'95660':[38.636,-121.380],'95662':[38.652,-121.228],
    '95670':[38.586,-121.263],'95671':[38.586,-121.263],'95673':[38.586,-121.357],
    '95678':[38.750,-121.289],'95683':[38.510,-121.121],'95693':[38.443,-121.213],
    '95741':[38.586,-121.263],'95742':[38.558,-121.183],'95757':[38.395,-121.430],
    '95758':[38.423,-121.412],'95759':[38.395,-121.430],'95763':[38.395,-121.430],
    '95811':[38.575,-121.497],'95812':[38.581,-121.494],'95813':[38.581,-121.494],
    '95814':[38.580,-121.491],'95815':[38.601,-121.449],'95816':[38.565,-121.470],
    '95817':[38.546,-121.462],'95818':[38.553,-121.497],'95819':[38.557,-121.446],
    '95820':[38.531,-121.453],'95821':[38.620,-121.399],'95822':[38.513,-121.491],
    '95823':[38.475,-121.446],'95824':[38.519,-121.443],'95825':[38.590,-121.399],
    '95826':[38.556,-121.381],'95827':[38.558,-121.343],'95828':[38.491,-121.406],
    '95829':[38.482,-121.364],'95830':[38.454,-121.377],'95831':[38.497,-121.521],
    '95832':[38.480,-121.502],'95833':[38.612,-121.499],'95834':[38.642,-121.497],
    '95835':[38.669,-121.518],'95836':[38.710,-121.530],'95837':[38.730,-121.598],
    '95838':[38.647,-121.442],'95841':[38.649,-121.355],'95842':[38.677,-121.348],
    '95843':[38.710,-121.349],'95860':[38.607,-121.381],'95864':[38.586,-121.379],
    '95866':[38.590,-121.399],'95899':[38.581,-121.494],
    '95601':[38.637,-120.980],'95603':[38.907,-121.080],'95648':[38.745,-121.183],
    '95650':[38.733,-121.184],'95661':[38.734,-121.237],'95663':[38.789,-121.190],
    '95677':[38.761,-121.259],'95681':[38.754,-121.177],'95703':[38.967,-120.905],
    '95722':[38.929,-121.051],'95746':[38.767,-121.169],'95747':[38.805,-121.202],
    '95602':[38.980,-121.103],'95614':[38.800,-120.887],'95633':[38.810,-120.890],
    '95634':[38.756,-120.795],'95636':[38.643,-120.593],'95651':[38.763,-120.920],
    '95664':[38.713,-120.998],'95667':[38.687,-120.836],'95672':[38.636,-121.069],
    '95682':[38.603,-120.943],'95709':[38.607,-120.750],'95726':[38.780,-120.486],
    '95762':[38.667,-121.069],'95619':[38.565,-120.808],'95623':[38.633,-120.836],
    '95684':[38.500,-120.866],'95613':[38.754,-121.042],'95658':[38.840,-121.232],
    '95668':[38.820,-121.377],'95674':[38.793,-121.512]
  };

  function buildLocPrompt() {
    var locBar = document.getElementById('locBar');
    if (!locBar) return;

    if (userLoc) {
      var label = userLoc.zip
        ? '\u{1F4CD} Using zip code ' + esc(userLoc.zip)
        : '\u{1F4CD} Using your location';
      locBar.innerHTML = '<span class="loc-status">' + label + '</span>' +
        '<button class="loc-clear-btn">Reset</button>';
      locBar.querySelector('.loc-clear-btn').addEventListener('click', function () {
        userLoc = null;
        try { localStorage.removeItem('owtk.loc'); } catch (e) {}
        sortCards();
        apply();
        buildLocPrompt();
        if (typeof reRenderEvents === 'function') reRenderEvents();
      });
    } else {
      var html = '';
      if ('geolocation' in navigator) {
        html += '<button class="loc-btn">' +
          '\u{1F4CD} Use my location</button>' +
          '<span class="loc-or">or</span>';
      }
      html += '<form class="zip-form">' +
        '<input class="zip-input" type="text" inputmode="numeric" pattern="[0-9]{5}"' +
        ' maxlength="5" placeholder="Enter zip code" aria-label="Zip code">' +
        '<button class="loc-btn zip-go" type="submit">Go</button>' +
        '</form>';
      locBar.innerHTML = html;

      var geoBtn = locBar.querySelector('.loc-btn:not(.zip-go)');
      if (geoBtn) geoBtn.addEventListener('click', requestLocation);

      locBar.querySelector('.zip-form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var inp = locBar.querySelector('.zip-input');
        var code = (inp.value || '').replace(/\D/g, '');
        if (code.length !== 5) { inp.focus(); return; }
        var coords = ZIPS[code];
        if (!coords) {
          inp.value = '';
          inp.placeholder = 'Zip not found';
          inp.classList.add('zip-err');
          inp.focus();
          return;
        }
        applyLocation({ lat: coords[0], lon: coords[1], zip: code });
      });
    }
  }

  function applyLocation(loc) {
    userLoc = loc;
    try { localStorage.setItem('owtk.loc', JSON.stringify(userLoc)); } catch (e) {}
    sortCards();
    apply();
    buildLocPrompt();
    if (typeof reRenderEvents === 'function') reRenderEvents();
  }

  function requestLocation() {
    var locBar = document.getElementById('locBar');
    var btn = locBar ? locBar.querySelector('.loc-btn:not(.zip-go)') : null;
    if (btn) { btn.textContent = 'Locating…'; btn.disabled = true; }

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        applyLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      function () {
        if (btn) { btn.textContent = 'Location unavailable'; btn.disabled = true; }
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  // Expose for the events IIFE to call
  window._sacmoms = { userLoc: function () { return userLoc; }, haversine: haversine, showMiles: showMiles, esc: esc };

  function matches(card) {
    for (var k in state) {
      if (state[k] === 'all') continue;
      if ((card.getAttribute('data-' + k) || '').split(/\s+/).indexOf(state[k]) === -1) return false;
    }
    return true;
  }

  function apply() {
    var n = 0;
    cards.forEach(function (c) { var ok = matches(c); c.hidden = !ok; if (ok) n++; });
    var filtered = state.age !== 'all' || state.env !== 'all';
    countEl.textContent = filtered ? n + (n === 1 ? ' place' : ' places') + ' match'
                                   : 'Showing all ' + n + ' places';
    emptyEl.hidden = n !== 0;
    resetEl.hidden = !filtered;
    document.querySelectorAll('[data-group]').forEach(function (g) {
      var key = g.getAttribute('data-group');
      g.querySelectorAll('.chip').forEach(function (b) {
        b.classList.toggle('is-on', b.getAttribute('data-v') === state[key]);
      });
    });
  }

  document.querySelectorAll('[data-group]').forEach(function (g) {
    var key = g.getAttribute('data-group');
    g.addEventListener('click', function (e) {
      var btn = e.target.closest('.chip');
      if (!btn || !g.contains(btn)) return;
      state[key] = btn.getAttribute('data-v');
      apply();
    });
  });

  resetEl.addEventListener('click', function () {
    state = { age: 'all', env: 'all' };
    apply();
  });

  if (userLoc) sortCards();
  buildLocPrompt();
  apply();
})();

/* ---- This week ---- */
(function () {
  var stripEl = document.getElementById('daystrip');
  var evEl    = document.getElementById('events');
  var weekMt  = document.getElementById('weekEmpty');
  if (!stripEl || !evEl || typeof EVENTS === 'undefined') return;

  var DAYS  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function ymd(d) {
    return d.getFullYear() + '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var week = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(today); d.setDate(today.getDate() + i); week.push(d);
  }
  function countFor(d) {
    var n = 0, y = ymd(d);
    for (var k = 0; k < EVENTS.length; k++)
      if (EVENTS[k].day === d.getDay() || EVENTS[k].date === y) n++;
    return n;
  }

  var picked = 0;
  for (var w = 0; w < week.length; w++) {
    if (countFor(week[w])) { picked = w; break; }
  }

  var sm = window._sacmoms || {};
  function esc(s) {
    if (sm.esc) return sm.esc(s);
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function showMiles(d) {
    return d < 10 ? String(Math.round(d * 10) / 10) : String(Math.round(d));
  }

  function hhmm(t) {
    var p = t.split(':'), h = +p[0], m = p[1], ap = h >= 12 ? 'pm' : 'am';
    h = h % 12; if (h === 0) h = 12;
    return m === '00' ? h + ' ' + ap : h + ':' + m + ' ' + ap;
  }

  function evDist(e) {
    var loc = sm.userLoc ? sm.userLoc() : null;
    if (loc && e.lat && e.lon) return sm.haversine(loc.lat, loc.lon, e.lat, e.lon);
    if (e.dist !== undefined) return e.dist;
    return null;
  }

  function evDistLabel(e) {
    var loc = sm.userLoc ? sm.userLoc() : null;
    if (loc && e.lat && e.lon) return '';  // from user, no "from X" suffix
    return ' from ' + TOWN.name;
  }

  function strip() {
    stripEl.innerHTML = '';
    week.forEach(function (d, i) {
      var b = document.createElement('button');
      b.className = 'day' + (i === picked ? ' is-on' : '');
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', i === picked ? 'true' : 'false');
      b.setAttribute('aria-controls', 'events');
      var label = i === 0 ? 'Today' : (i === 1 ? 'Tomorrow' : SHORT[d.getDay()]);
      var n = countFor(d);
      b.innerHTML = '<span class="day-name">' + label + '</span>' +
                    '<span class="day-num">' + d.getDate() + '</span>' +
                    (n ? '<span class="day-dot" aria-hidden="true"></span>' : '');
      b.setAttribute('aria-label', label + ' ' + d.getDate() + ', ' +
                     (n ? n + (n === 1 ? ' event' : ' events') : 'nothing listed'));
      b.addEventListener('click', function () { picked = i; strip(); render(); });
      stripEl.appendChild(b);
    });
  }

  var shown = [];

  function render() {
    var d = week[picked];
    var list = EVENTS.filter(function (e) { return e.day === d.getDay() || e.date === ymd(d); })
                     .sort(function (a, b) {
                       var ta = a.time || '99:99', tb = b.time || '99:99';
                       return ta < tb ? -1 : (ta > tb ? 1 : 0);
                     });
    shown = list;

    evEl.innerHTML = list.map(function (e, i) {
      var when = e.time ? hhmm(e.time) + (e.until ? ' – ' + hhmm(e.until) : '') : '';
      var dist = evDist(e);
      var distChip = dist !== null
        ? '<span class="ev-tag ev-dist">' + esc(showMiles(dist)) + ' mi</span>'
        : '';
      return '<article class="event" data-i="' + i + '">' +
        '<div class="ev-time' + (when ? '' : ' ev-time-unknown') + '">' +
          (when ? esc(when) : esc(e.timeLabel || 'Time not confirmed')) + '</div>' +
        '<div class="ev-body">' +
          '<h3>' + esc(e.title) + '</h3>' +
          '<p class="ev-where">' + esc(e.venue) + ', ' + esc(e.city) + '</p>' +
          '<p class="ev-blurb">' + esc(e.blurb) + '</p>' +
          '<div class="ev-foot">' +
            distChip +
            '<span class="ev-tag">' + esc(e.ages) + '</span>' +
            '<button class="ev-more" type="button">Details</button>' +
            '<a class="map" href="https://www.google.com/maps/search/?api=1&query=' +
              encodeURIComponent(e.venue + ' ' + e.city) + '" target="_blank" rel="noopener">Map</a>' +
            (e.source ? '<a class="ev-src" href="' + esc(e.source) + '" target="_blank" rel="noopener">Where this came from</a>' : '') +
          '</div>' +
        '</div></article>';
    }).join('');

    var when = picked === 0 ? 'today' : (picked === 1 ? 'tomorrow' : 'on ' + DAYS[d.getDay()]);
    weekMt.hidden = list.length !== 0;

    var nxt = -1;
    for (var j = 1; j < week.length; j++) {
      var idx = (picked + j) % week.length;
      if (countFor(week[idx])) { nxt = idx; break; }
    }
    weekMt.textContent = 'Nothing listed ' + when + '.' +
      (nxt > -1 ? ' Next up: ' + (nxt === 0 ? 'today' : nxt === 1 ? 'tomorrow' : DAYS[week[nxt].getDay()]) + '.' : '');
  }

  // Expose so the places IIFE can trigger a re-render after geolocation
  window.reRenderEvents = function () { render(); };

  /* ---- Details ---- */
  var dlg    = document.getElementById('evDialog');
  var detail = document.getElementById('evDetail');

  function keyFor(e) {
    return (e.date || 'w' + e.day) + '-' +
      String(e.title + '-' + e.venue).toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  }

  function longDate(e) {
    var d = e.date ? new Date(e.date + 'T00:00:00') : week[picked];
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' +
      ['January','February','March','April','May','June','July',
       'August','September','October','November','December'][d.getMonth()];
  }

  function openDetail(e, push) {
    if (!dlg || !detail) return;
    var when = e.time ? hhmm(e.time) + (e.until ? ' – ' + hhmm(e.until) : '')
                      : (e.timeLabel || 'Time not confirmed');
    var dist = evDist(e);
    var label = evDistLabel(e);
    detail.innerHTML =
      '<h3 id="evDialogTitle">' + esc(e.title) + '</h3>' +
      '<p class="d-when">' + esc(longDate(e)) + ' · ' + esc(when) + '</p>' +
      '<p class="d-where">' + esc(e.venue) + ', ' + esc(e.city) + '</p>' +
      (e.blurb ? '<p class="d-blurb">' + esc(e.blurb) + '</p>' : '') +
      '<div class="d-tags">' +
        (dist === null ? '' :
          '<span class="ev-tag ev-dist">' + esc(showMiles(dist)) + ' mi' + esc(label) + '</span>') +
        '<span class="ev-tag">' + esc(e.ages) + '</span></div>' +
      '<div class="d-acts">' +
        '<a class="map" href="https://www.google.com/maps/search/?api=1&query=' +
          encodeURIComponent(e.venue + ' ' + e.city) +
          '" target="_blank" rel="noopener">Map</a>' +
        (e.source ? '<a class="ev-src" href="' + esc(e.source) +
          '" target="_blank" rel="noopener">Where this came from</a>' : '') +
      '</div>';
    if (push) {
      try { history.pushState(null, '', '#event=' + keyFor(e)); } catch (err) {}
    }
    if (dlg.showModal) { if (!dlg.open) dlg.showModal(); }
    else { dlg.setAttribute('open', ''); }
  }

  if (dlg) {
    dlg.addEventListener('close', function () {
      if (location.hash.indexOf('#event=') === 0) {
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      }
    });
    dlg.addEventListener('click', function (ev) {
      if (ev.target === dlg) dlg.close();
    });
  }

  evEl.addEventListener('click', function (ev) {
    if (ev.target.closest('a')) return;
    var art = ev.target.closest('.event');
    if (!art) return;
    var e = shown[+art.getAttribute('data-i')];
    if (e) openDetail(e, true);
  });

  function fromHash() {
    var m = /^#event=(.+)$/.exec(location.hash);
    if (!m) return;
    for (var i = 0; i < EVENTS.length; i++) {
      if (keyFor(EVENTS[i]) === m[1]) {
        if (EVENTS[i].date) {
          for (var j = 0; j < week.length; j++) {
            if (ymd(week[j]) === EVENTS[i].date) { picked = j; break; }
          }
        }
        strip(); render();
        openDetail(EVENTS[i], false);
        return;
      }
    }
  }

  window.addEventListener('hashchange', function () {
    if (location.hash.indexOf('#event=') === 0) fromHash();
    else if (dlg && dlg.open) dlg.close();
  });

  /* ---- Quick links: #today / #weekend pick the day and jump to this section ---- */
  function pickDay(i, smooth) {
    picked = i; strip(); render();
    var sec = stripEl.closest ? stripEl.closest('section') : null;
    if (sec) {
      try { sec.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block: 'start'}); }
      catch (e) { sec.scrollIntoView(); }
    }
  }
  function weekendIndex() {
    var dow = today.getDay();
    return (dow === 0 || dow === 6) ? 0 : 6 - dow;  /* Sat/Sun -> today, else upcoming Saturday */
  }
  function applyQuickHash(smooth) {
    if (location.hash === '#today') { pickDay(0, smooth); return true; }
    if (location.hash === '#weekend') { pickDay(weekendIndex(), smooth); return true; }
    return false;
  }
  window.addEventListener('hashchange', function () { applyQuickHash(true); });

  strip();
  render();
  fromHash();
  applyQuickHash(false);
})();
