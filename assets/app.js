/* Shared by every city page.

   Distances are already baked into each card's data-dist at build time, so
   this script never computes geography. It handles the one thing that can
   only happen in a browser: filtering the places list. With JavaScript off
   the page still renders every place, in distance order, which is the
   important half. */

(function () {
  if (typeof TOWN === 'undefined') return;

  var cards   = [].slice.call(document.querySelectorAll('#cards .card'));
  var countEl = document.getElementById('count');
  var emptyEl = document.getElementById('empty');
  var resetEl = document.getElementById('reset');

  var state = { age: 'all', env: 'all' };

  // Remember which city this browser looked at, so the index can offer it.
  try {
    var seg = location.pathname.replace(/\/+$/, '').split('/').pop();
    if (seg) localStorage.setItem('owtk.city', seg);
  } catch (e) {}


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

  // Local YYYY-MM-DD for matching dated events (refreshed daily by the
  // scraper). Recurring events still match on day-of-week via e.day.
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

  // Open on the first day in the window that has something on, not blindly on
  // today. This calendar is sparse by design — most days are empty — and
  // defaulting to today showed an empty panel with no hint that Saturday was
  // busy, which reads as broken rather than quiet.
  var picked = 0;
  for (var w = 0; w < week.length; w++) {
    if (countFor(week[w])) { picked = w; break; }
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function hhmm(t) {
    var p = t.split(':'), h = +p[0], m = p[1], ap = h >= 12 ? 'pm' : 'am';
    h = h % 12; if (h === 0) h = 12;
    return m === '00' ? h + ' ' + ap : h + ':' + m + ' ' + ap;
  }

  function strip() {
    stripEl.innerHTML = '';
    week.forEach(function (d, i) {
      var b = document.createElement('button');
      b.className = 'day' + (i === picked ? ' is-on' : '');
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', i === picked ? 'true' : 'false');
      // Without aria-controls the tablist and the list it swaps are unrelated
      // as far as a screen reader is concerned.
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

  // The day's rendered list, hoisted so the click handler can map a card's
  // data-i back to its event.
  var shown = [];

  function render() {
    var d = week[picked];
    // An entry may have no time: the day and venue are confirmed but the hour
    // is not. Those sort last and say so rather than showing a made-up clock.
    var list = EVENTS.filter(function (e) { return e.day === d.getDay() || e.date === ymd(d); })
                     .sort(function (a, b) {
                       var ta = a.time || '99:99', tb = b.time || '99:99';
                       return ta < tb ? -1 : (ta > tb ? 1 : 0);
                     });
    shown = list;

    evEl.innerHTML = list.map(function (e, i) {
      var when = e.time ? hhmm(e.time) + (e.until ? ' – ' + hhmm(e.until) : '') : '';
      return '<article class="event" data-i="' + i + '">' +
        '<div class="ev-time' + (when ? '' : ' ev-time-unknown') + '">' +
          (when ? esc(when) : esc(e.timeLabel || 'Time not confirmed')) + '</div>' +
        '<div class="ev-body">' +
          '<h3>' + esc(e.title) + '</h3>' +
          '<p class="ev-where">' + esc(e.venue) + ', ' + esc(e.city) + '</p>' +
          '<p class="ev-blurb">' + esc(e.blurb) + '</p>' +
          '<div class="ev-foot">' +
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

    // Say where to look next rather than just reporting nothing here.
    var nxt = -1;
    for (var j = 1; j < week.length; j++) {
      var idx = (picked + j) % week.length;
      if (countFor(week[idx])) { nxt = idx; break; }
    }
    weekMt.textContent = 'Nothing listed ' + when + '.' +
      (nxt > -1 ? ' Next up: ' + (nxt === 0 ? 'today' : nxt === 1 ? 'tomorrow' : DAYS[week[nxt].getDay()]) + '.' : '');
  }

  /* ---- Details ----
     Cards clamp their blurb to keep the day's list scannable; this shows the
     whole entry. Deliberately a dialog and not a generated page per event:
     dated storytimes rotate daily, so static pages would be created and
     deleted every morning, leaving indexed URLs 404ing within the week, and
     each would carry a venue, a time and about two lines of text -- the thin
     content MIN_PLACES and LIST_MILES exist to keep off this domain. Search
     engines already get these events as Event JSON-LD on the city page. */
  var dlg    = document.getElementById('evDialog');
  var detail = document.getElementById('evDetail');

  // Stable across rebuilds and day changes, so a shared link keeps working
  // while the event is still listed. An event that has since passed simply
  // does not match and the page opens normally -- never a dead end.
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
    var when = e.time ? hhmm(e.time) + (e.until ? ' \u2013 ' + hhmm(e.until) : '')
                      : (e.timeLabel || 'Time not confirmed');
    detail.innerHTML =
      '<h3 id="evDialogTitle">' + esc(e.title) + '</h3>' +
      '<p class="d-when">' + esc(longDate(e)) + ' \u00b7 ' + esc(when) + '</p>' +
      '<p class="d-where">' + esc(e.venue) + ', ' + esc(e.city) + '</p>' +
      (e.blurb ? '<p class="d-blurb">' + esc(e.blurb) + '</p>' : '') +
      '<div class="d-tags"><span class="ev-tag">' + esc(e.ages) + '</span></div>' +
      '<div class="d-acts">' +
        '<a class="map" href="https://www.google.com/maps/search/?api=1&query=' +
          encodeURIComponent(e.venue + ' ' + e.city) +
          '" target="_blank" rel="noopener">Map &amp; directions</a>' +
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
    // Closing by any route (Esc, backdrop, the button) must drop the hash,
    // or reopening the same event from the list does nothing.
    dlg.addEventListener('close', function () {
      if (location.hash.indexOf('#event=') === 0) {
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
      }
    });
    dlg.addEventListener('click', function (ev) {
      if (ev.target === dlg) dlg.close();   // backdrop
    });
  }

  evEl.addEventListener('click', function (ev) {
    if (ev.target.closest('a')) return;     // Map / source links win
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
        // Jump the strip to the day that event is on, so closing the dialog
        // leaves the right list behind it.
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
