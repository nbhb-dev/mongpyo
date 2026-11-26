// 몽표 — 소리 (모두 코드로 만든 소리, 외부 파일 없음). 첫 클릭 때 켜짐
window.Snd = (() => {
  let ac = null, master = null, pad = null, street = null, on = true;
  try { on = localStorage.getItem('mp_sound') !== 'off'; } catch(e) {}
  function ensure(){
    if (ac) { if (ac.state === 'suspended') ac.resume().catch(()=>{}); return true; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    try { ac = new AC(); } catch(e) { return false; }
    master = ac.createGain(); master.gain.value = on ? 1 : 0; master.connect(ac.destination);
    startPad(); return true;
  }
  function noiseBuf(sec){ const b = ac.createBuffer(1, ac.sampleRate*sec, ac.sampleRate), d = b.getChannelData(0); let l = 0;
    for (let i = 0; i < d.length; i++){ const w = Math.random()*2-1; l = (l + .02*w)/1.02; d[i] = l*3.5; } return b; }
  // 잔잔한 꿈 배경음: 겹친 사인파 + 천천히 숨 쉬는 음량
  function startPad(){
    pad = ac.createGain(); pad.gain.value = .045; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    pad.connect(lp); lp.connect(master);
    [220, 277.18, 329.63, 440, 554.37].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
      o.type = 'sine'; o.frequency.value = f; o.detune.value = (i%2 ? 4 : -4); g.gain.value = .25/(i+1);
      l.frequency.value = .05 + i*.02; lg.gain.value = .12/(i+1); l.connect(lg); lg.connect(g.gain);
      o.connect(g); g.connect(pad); o.start(); l.start(); });
    // 거리의 먼 웅성거림 (07에서만 들림)
    street = ac.createGain(); street.gain.value = 0; const n = ac.createBufferSource(); n.buffer = noiseBuf(4); n.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 420; n.connect(bp); bp.connect(street); street.connect(master); n.start();
  }
  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); };
  function tone(f, peak = .08, d = .35, type = 'sine', at = 0, f2){ if (!ensure()) return; const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); env(g, t, .008, peak, d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + .05); }
  function noise(freq, q, peak, d, type = 'bandpass'){ if (!ensure()) return; const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf(Math.max(.2, d + .1)); f.type = type; f.frequency.value = freq; f.Q.value = q; env(g, t, .01, peak, d); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + d + .1); }
  const api = {
    unlock: ensure,
    click(){ tone(988, .05, .12, 'sine', 0, 740); },
    hover(){ tone(1320, .018, .08); },
    paper(){ noise(2600, .7, .18, .35); },
    stamp(){ tone(110, .35, .25, 'sine', 0, 60); noise(500, 1, .25, .12, 'lowpass'); },
    pick(){ tone(784, .05, .4); tone(1175, .035, .5, 'sine', .06); },
    step(){ noise(380 + Math.random()*120, 1.2, .1, .09, 'lowpass'); },
    gauge(){ tone(660, .03, .6, 'sine', 0, 990); },
    enter(){ [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, .05, 1.4, 'sine', i*.11)); },
    wake(){ [1046.5, 783.99, 659.25, 523.25].forEach((f, i) => tone(f, .045, 1.2, 'sine', i*.14)); },
    street(onStreet){ if (!ac || !street) return; street.gain.setTargetAtTime(onStreet ? .05 : 0, ac.currentTime, .8); },
    get on(){ return on; },
    toggle(){ on = !on; try { localStorage.setItem('mp_sound', on ? 'on' : 'off'); } catch(e) {} ensure(); if (master) master.gain.setTargetAtTime(on ? 1 : 0, ac.currentTime, .1); return on; }
  };
  addEventListener('pointerdown', ensure, { capture: true });
  addEventListener('keydown', ensure, { capture: true });
  return api;
})();
