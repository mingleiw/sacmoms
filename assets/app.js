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

  function buildLocPrompt() {
    var locBar = document.getElementById('locBar');
    if (!locBar) return;

    if (userLoc) {
      locBar.innerHTML = '<span class="loc-status">\u{1F4CD} Using your location</span>' +
        '<button class="loc-clear-btn">Reset</button>';
      locBar.querySelector('.loc-clear-btn').addEventListener('click', function () {
        userLoc = null;
        try { localStorage.removeItem('owtk.loc'); } catch (e) {}
        sortCards();
        apply();
        buildLocPrompt();
      });
    } else if ('geolocation' in navigator) {
      locBar.innerHTML = '<button class="loc-btn">' +
        '\u{1F4CD} Use my location for exact distances</button>';
      locBar.querySelector('.loc-btn').addEventListener('click', requestLocation);
    } else {
      locBar.innerHTML = '';
    }
  }

  function requestLocation() {
    var locBar = document.getElementById('locBar');
    var btn = locBar ? locBar.querySelector('.loc-btn') : null;
    if (btn) { btn.textContent = 'Locating…'; btn.disabled = true; }

    navigator.geolocation.getCurrentPosition(
      function (pos) {
        userLoc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        try { localStorage.setItem('owtk.loc', JSON.stringify(userLoc)); } catch (e) {}
        sortCards();
        apply();
        buildLocPrompt();
        // Re-render events so distance chips update from user position
        if (typeof reRenderEvents === 'function') reRenderEvents();
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

  strip();
  render();
  fromHash();
})();
