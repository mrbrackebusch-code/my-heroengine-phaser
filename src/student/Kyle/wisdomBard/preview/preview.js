// Bard preview — songs, per-key instruments, chords/arps/sustains, and buff rules
(function(){
  const FALL_DURATION = 2000;
  const HIT_WINDOW = 200; // ms
  const HIT_LINE_RATIO = 0.86;

  const SONGS = [
    {
      name: 'Sunrise Arpeggio', events: [
        {t:400, lanes:[{d:'left', dur:800, role:'lead'}]},
        {t:900, lanes:[{d:'down'}]},
        {t:1400, lanes:[{d:'up'}]},
        {t:1900, lanes:[{d:'right'}]},
        {t:2500, lanes:[{d:'left'}]},
        {t:2900, lanes:[{d:'left'}]},
        {t:3400, lanes:[{d:'down', dur:600, role:'arp'},{d:'up'}]},
        {t:3800, lanes:[{d:'up'}]},
        {t:4300, lanes:[{d:'right'}]},
        {t:4800, lanes:[{d:'down'}]},
        {t:5200, lanes:[{d:'up'}]},
        {t:5600, lanes:[{d:'left', dur:1000}]},
        {t:7000, lanes:[{d:'left'},{d:'down'},{d:'up'},{d:'right'}]}
      ]
    },
    {
      name: 'Storm Quartet', events: [
        {t:300, lanes:[{d:'left'},{d:'down'}]},
        {t:700, lanes:[{d:'up'},{d:'right'}]},
        {t:1200, lanes:[{d:'left', dur:600, role:'lead'}]},
        {t:1800, lanes:[{d:'down'},{d:'up'},{d:'right'}]},
        {t:2400, lanes:[{d:'left'},{d:'down'},{d:'up'},{d:'right'}]},
        {t:3200, lanes:[{d:'left', dur:900, role:'arp'}]},
        {t:4200, lanes:[{d:'down'},{d:'up'}]},
        {t:4800, lanes:[{d:'left'},{d:'down'},{d:'up'},{d:'right'}]},
        {t:5600, lanes:[{d:'up', dur:600, role:'lead'}]}
      ]
    },
    {
      name: 'Wandering Lead', events: [
        {t:200, lanes:[{d:'up'}]},
        {t:600, lanes:[{d:'right'}]},
        {t:1000, lanes:[{d:'up', dur:400, role:'lead'}]},
        {t:1500, lanes:[{d:'left'},{d:'down'}]},
        {t:1900, lanes:[{d:'left'},{d:'down'},{d:'up'}]},
        {t:2500, lanes:[{d:'left'},{d:'down'},{d:'up'},{d:'right'}]},
        {t:3300, lanes:[{d:'up', dur:800, role:'lead'}]},
        {t:4300, lanes:[{d:'left'},{d:'down'}]},
        {t:4900, lanes:[{d:'left'},{d:'down'},{d:'up'},{d:'right'}]},
        {t:6100, lanes:[{d:'up', dur:900, role:'lead'}]}
      ]
    }
  ];

  let currentSongIndex = 0;
  let currentSong = SONGS[currentSongIndex];

  const laneMap = {ArrowLeft:'left', ArrowDown:'down', ArrowUp:'up', ArrowRight:'right'};
  const active = [];
  const recentHits = []; // {groupId, dir, time}
  let score = 0;
  let startAt = 0;
  let timers = [];

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  const LANE_INFO = {
    left: {freq: 523.25, type: 'sine'},
    down: {freq: 392.00, type: 'triangle'},
    up: {freq: 659.25, type: 'sawtooth'},
    right: {freq: 440.00, type: 'square'}
  };

  function playTone(freq, duration = 0.12, type = 'sine'){
    try { audioCtx.resume(); } catch {}
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.01);
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    o.stop(audioCtx.currentTime + duration + 0.02);
  }

  function playChord(freqs, duration = 0.36, type = 'sine'){
    try { audioCtx.resume(); } catch {}
    const now = audioCtx.currentTime;
    freqs.forEach((f)=>{
      const o = audioCtx.createOscillator(); o.type = type; o.frequency.value = f;
      const g = audioCtx.createGain(); g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.14, now + 0.01);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      o.stop(now + duration + 0.02);
    });
  }

  function playArpeggio(freqs, totalDuration = 0.36, type = 'sine'){
    try { audioCtx.resume(); } catch {}
    const step = totalDuration / Math.max(1, freqs.length);
    freqs.forEach((f, i)=>{
      setTimeout(()=> playTone(f, step*0.9, type), i * step * 1000);
    });
  }

  function playJudgementMusical(judgement, dir, sustain = 0){
    const info = LANE_INFO[dir] || {freq:440, type:'sine'};
    const base = info.freq; const type = info.type;
    const triad = [base, base * 1.259921, base * 1.498307];
    if(judgement === 'sick') playChord(triad, 0.44, type);
    else if(judgement === 'great') playArpeggio(triad, 0.36, type);
    else if(judgement === 'good') playTone(base, Math.max(0.22, sustain/1000 || 0.22), type);
    else if(judgement === 'bad') playTone(base * 0.5, 0.08, 'triangle');
    else if(judgement === 'miss') playTone(220, 0.22, 'sine');
  }

  const scoreEl = document.getElementById('score');
  const statusEl = document.getElementById('status');
  const startBtn = document.getElementById('startBtn');
  const songSelect = document.getElementById('songSelect');
  const hitLineEl = document.getElementById('hitLine');
  const playArea = document.getElementById('playArea');

  function spawnEvent(event, groupId){
    for(const laneDef of event.lanes){
      const dir = laneDef.d;
      const lane = playArea.querySelector(`.lane.${dir}`);
      if(!lane) continue;
      const note = document.createElement('div');
      note.className = 'note';
      note.textContent = dir==='left' ? '←' : dir==='down' ? '↓' : dir==='up' ? '↑' : '→';
      lane.appendChild(note);

      const t0 = performance.now();
      note.dataset.start = t0;
      note.dataset.dir = dir;
      note.dataset.group = String(groupId);

      note.style.transition = `transform ${FALL_DURATION}ms linear`;
      requestAnimationFrame(()=>{
        const laneHeight = lane.clientHeight;
        const travel = laneHeight - 48;
        note.style.transform = `translate(-50%, ${travel}px)`;
      });

      const record = {el: note, start: t0, dir: laneDef.d, dur: laneDef.dur || 0, groupId};
      active.push(record);

      const to = setTimeout(()=>{
        const idx = active.indexOf(record);
        if(idx !== -1){ active.splice(idx,1); note.remove(); }
      }, FALL_DURATION + 300);
      timers.push(to);
    }
  }

  function createFloating(judgement, delta, laneEl){
    const rect = playArea.getBoundingClientRect();
    const laneRect = laneEl.getBoundingClientRect();
    const x = laneRect.left + laneRect.width/2 - rect.left;
    const y = rect.height * HIT_LINE_RATIO;
    const wrap = document.createElement('div');
    wrap.className = 'floating-text '+judgement;
    wrap.style.left = x + 'px'; wrap.style.top = y + 'px';
    wrap.textContent = judgement.toUpperCase();
    const deltaEl = document.createElement('div'); deltaEl.className='floating-text delta'; deltaEl.textContent = (delta>0?'+':'')+delta;
    wrap.appendChild(deltaEl);
    playArea.appendChild(wrap);
    setTimeout(()=> wrap.remove(), 900);
  }

  function tryHit(key){
    const dir = laneMap[key]; if(!dir) return;
    const now = performance.now();
    let best = null; let bestDiff = 1e9;
    for(const r of active){ if(r.dir !== dir) continue; const expected = r.start + FALL_DURATION * HIT_LINE_RATIO; const diff = now - expected; if(Math.abs(diff) < Math.abs(bestDiff)){ bestDiff = diff; best = r; }}
    // Also check positional overlap with hit line to avoid visual timing misses
    function isInHitZone(el){ try{ const nr = el.getBoundingClientRect(); const hr = hitLineEl.getBoundingClientRect(); const overlap = !(nr.bottom < hr.top - 6 || nr.top > hr.bottom + 6); return overlap; }catch(e){ return false; } }

    let positionHit = false;
    if(best && best.el) positionHit = isInHitZone(best.el);

    if(best && (Math.abs(bestDiff) <= HIT_WINDOW || positionHit)){
      const abs = Math.abs(bestDiff); let jud = 'bad'; let pts = 60;
      if(abs <= 50){ jud='sick'; pts = 300; }
      else if(abs <= 100){ jud='great'; pts = 200; }
      else if(abs <= 150){ jud='good'; pts = 120; }
      else { jud='bad'; pts = 60; }

      score += pts; scoreEl.textContent = 'Score: ' + score;
      best.el.classList.add('hit');
      const laneEl = playArea.querySelector(`.lane.${dir}`) || best.el.parentElement;
      createFloating(jud, pts, laneEl);
      playJudgementMusical(jud, dir, best.dur || 0);

      // mark hit and remove
      const idx = active.indexOf(best); if(idx !== -1) active.splice(idx,1);
      recentHits.push({groupId: best.groupId, dir: best.dir, time: performance.now()});
      while(recentHits.length > 64) recentHits.shift();
      setTimeout(()=> best.el.remove(), 220);
      statusEl.textContent = `Hit ${dir} (${Math.round(bestDiff)}ms)`; setTimeout(()=> statusEl.textContent = '', 700);

      // If this event had multiple lanes, check for chord completion
      const CHORD_WINDOW = 400;
      if(typeof best.groupId !== 'undefined'){
        const gid = best.groupId;
        const ev = currentSong.events[gid];
        if(ev && ev.lanes.length > 1){
          const ok = ev.lanes.every(l => recentHits.some(r => r.groupId === gid && r.dir === l.d && (performance.now() - r.time) < CHORD_WINDOW));
          if(ok){
            const freqs = ev.lanes.map(l => (LANE_INFO[l.d] || {freq:440}).freq);
            playChord(freqs, 0.6, 'sine');
            createFloating('sick', 400, laneEl);
            // small chord bonus
            score += 200; scoreEl.textContent = 'Score: ' + score;
          }
        }
      }

    } else {
      const penalty = 50; score = score - penalty; scoreEl.textContent = 'Score: ' + score;
      const laneEl = playArea.querySelector(`.lane.${dir}`) || playArea; createFloating('miss', -penalty, laneEl);
      playJudgementMusical('miss', dir); statusEl.textContent = `Miss ${dir}`; setTimeout(()=> statusEl.textContent = '', 700);
    }
  }

  window.addEventListener('keydown', e=>{ if(document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return; tryHit(e.key); });

  function startDemo(songIndex){
    // reset
    active.forEach(a=>a.el.remove()); active.length = 0; timers.forEach(t=>clearTimeout(t)); timers.length = 0; recentHits.length = 0;
    score = 0; scoreEl.textContent = 'Score: 0'; statusEl.textContent = '';
    currentSongIndex = typeof songIndex === 'number' ? Math.max(0, Math.min(songIndex, SONGS.length-1)) : currentSongIndex;
    currentSong = SONGS[currentSongIndex];

    startAt = performance.now(); let last = 0;
    currentSong.events.forEach((ev, idx)=>{
      const to = setTimeout(()=> spawnEvent(ev, idx), ev.t);
      timers.push(to);
      let maxDur = 0; for(const l of ev.lanes) maxDur = Math.max(maxDur, l.dur || 0);
      last = Math.max(last, ev.t + maxDur);
    });
    const endDelay = last + FALL_DURATION + 500; const endTo = setTimeout(()=> endSong(), endDelay); timers.push(endTo);
  }

  startBtn.addEventListener('click', ()=> startDemo());

  // populate song selector UI
  function populateSongSelector(){
    if(!songSelect) return;
    SONGS.forEach((s,i)=>{
      const opt = document.createElement('option'); opt.value = String(i); opt.textContent = s.name; songSelect.appendChild(opt);
    });
    songSelect.addEventListener('change', ()=>{
      const i = parseInt(songSelect.value || '0', 10); currentSongIndex = i; currentSong = SONGS[i];
    });
  }
  populateSongSelector();

  function endSong(){
    // Buff mapping per updated rules
    let title = 'No Buff'; let desc = 'Score too low — no buff awarded.';
    if(score >= 100 && score <= 900){
      // alternate health or mana based on parity
      if(Math.abs(score) % 2 === 0){ title = 'Health Buff'; desc = 'You gained a Health buff!'; }
      else { title = 'Mana Buff'; desc = 'You gained a Mana buff!'; }
    } else if(score >= 1000 && score <= 9000){
      if(score < 3000){ title = 'Health + Mana Buff'; desc = 'You earned Health and Mana buffs!'; }
      else if(score < 6000){ title = 'Health + Strength Buff'; desc = 'You earned Health and Strength buffs!'; }
      else { title = 'Health Buff'; desc = 'You earned a Health buff!'; }
    } else if(score > 9000){ title = 'All Buffs'; desc = 'You earned Health, Mana, and Strength buffs!'; }

    const existing = document.querySelector('.end-overlay'); if(existing) existing.remove();
    const overlay = document.createElement('div'); overlay.className = 'end-overlay';
    const card = document.createElement('div'); card.className = 'card';
    const h = document.createElement('h1'); h.textContent = title;
    const p = document.createElement('p'); p.textContent = desc + ` Final score: ${score}`;
    card.appendChild(h); card.appendChild(p); overlay.appendChild(card); document.body.appendChild(overlay);
    setTimeout(()=> overlay.remove(), 6000);
  }

  // expose debug API
  window.__bardPreview = {startDemo, endSong, SONGS, setSong: i=>{ currentSongIndex = i; currentSong = SONGS[i]; }};

})();

