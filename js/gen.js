// 몽표 — 10 빈 간판 · 그래픽 생성기
// 간판 겉모양은 원으로 고정. 그 안의 그래픽을 '형태소 1 + 리듬 연산 1 + 응용 연산 1' 결합 규칙으로 새로 만듦
//  형태소 (그래픽을 이루는 조각) : 정서 < -0.3 삼각형 / -0.3~+0.3 비정형 / > +0.3 원  — 경계에서는 두 조각이 섞임
//  리듬 연산 (조각을 놓는 방식) : 각성≥.5·불쾌 충돌 / 각성≥.5·유쾌 잔상 / 각성<.5·유쾌 반복 / 각성<.5·불쾌 흐리게 — 경계에서 서서히 교차
//  응용 연산 (조각의 결) : 가장 가까운 감정의 응용 연산. 어느 감정에서도 2.5칸 이상 멀면 새 감정용(늘리기·분해하기·투명도)
//  색 : 피그마 컬러 팔레트 5색 + 기존 간판 색만, 파스텔 그라데이션
//  8개 감정 자리(격자 1.2칸) 가까이 가면 원래 감정 그래픽으로 자연스럽게 바뀜
window.Gen = (() => {
  const PAL = { orange:'#E1946B', cream:'#FBDDB7', cyan:'#AADBE5', blue:'#9FABD7', lilac:'#E0B7D5' };
  let cv, ctx, W = 579, H = 592, dpr = 1, emoImgs = {}, onChange = null, dirty = true, run = false, raf = 0;
  const state = { v:.65, a:.85 };

  const clamp = (x,a,b) => Math.max(a, Math.min(b, x));
  const smooth = (a,b,x) => { const k = clamp((x-a)/(b-a),0,1); return k*k*(3-2*k); };
  const hex = h => { const n = parseInt(h.slice(1),16); return [n>>16&255, n>>8&255, n&255]; };
  const rgba = (h,a) => { const [r,g,b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
  const rnd = s => { const x = Math.sin(s*127.1 + 311.7)*43758.5453; return x - Math.floor(x); };
  const mk = (w,h) => { const c = document.createElement('canvas'); c.width = Math.max(1,Math.ceil(w)); c.height = Math.max(1,Math.ceil(h)); return c; };

  function info(){
    const { v, a } = state, n = MP.nearest(v, a);
    const morph = v < -.3 ? '삼각형' : v > .3 ? '원' : '비정형';
    const rhythm = a >= .5 ? (v < 0 ? '충돌' : '잔상') : (v >= 0 ? '반복' : '흐리게');
    let tex = n.e.t;
    if (n.d > 2.5) tex = a >= .5 ? '분해하기' : (v >= 0 ? '늘리기' : '투명도');
    return { morph, rhythm, tex, near: n.e, dist: n.d, inside: n.d <= 1.2 };
  }

  // ── 색: 팔레트 + 가까운 두 감정의 간판 색 (자리마다 다른 두 색으로 그라데이션) ──
  function palette(v, a){
    const near = MP.EMO.map(e => { const [c1,r1] = MP.grid(v,a), [c2,r2] = MP.grid(e.v,e.a); return [e, Math.hypot(c1-c2, r1-r2)]; }).sort((x,y) => x[1]-y[1]);
    const pos = Math.max(0,v), neg = Math.max(0,-v);
    const w = [
      [PAL.cream, .3 + pos*(1-a)], [PAL.orange, pos*a*1.2 + .04], [PAL.lilac, .45 + .3*(1-Math.abs(v))],
      [PAL.cyan, (1-a)*.5 + neg*.3], [PAL.blue, neg*1.1 + .04],
      [near[0][0].col[0], .9], [near[0][0].col[1] || near[0][0].col[0], .4], [near[1][0].col[0], .35]
    ].sort((x,y) => y[1]-x[1]);
    return w.slice(0, 5).map(x => x[0]);
  }

  // ── 형태소 조각 (선명한 가장자리 + 파스텔 그라데이션, 입체감 없음) ──
  const tri = th => { const k = 2*Math.PI/3, a = ((th + Math.PI/2) % k + k) % k - k/2; return Math.cos(Math.PI/3) / Math.cos(a); };
  const blob = (th, s) => 1 + .18*Math.sin(2*th + s) + .1*Math.sin(3*th - s*1.3) + .05*Math.sin(5*th + s*.7);
  // kind 0 원 · 1 삼각형 · 2 비정형 / spike: 뾰족하게 (원→네 갈래 별, 삼각형·비정형→여러 갈래 가시)
  function piece(c, x, y, R, kind, seed, o = {}){
    const sx = o.sx || 1, sy = o.sy || 1, rot = o.rot || 0, spike = o.spike || 0;
    c.beginPath();
    const N = 160;
    for (let i = 0; i <= N; i++){
      const th = i/N*Math.PI*2;
      let r = kind === 0 ? 1 : kind === 1 ? tri(th)*.92 : blob(th, seed);
      if (kind === 1) r = Math.min(r, 1.35);
      if (spike){ const n = kind === 0 ? 4 : 9 + Math.floor(rnd(seed)*5), p = Math.abs(Math.cos(th*n/2 + seed*.3));
        r *= kind === 0 ? (.22 + .78*Math.pow(p, 9)) * 1.25 : (.45 + .9*Math.pow(p, 14)*(.6 + .4*rnd(Math.floor((th*n/2 + seed*.3)/Math.PI)+seed))); }
      const px = Math.cos(th)*r*R*sx, py = Math.sin(th)*r*R*sy;
      const qx = px*Math.cos(rot) - py*Math.sin(rot), qy = px*Math.sin(rot) + py*Math.cos(rot);
      i ? c.lineTo(x+qx, y+qy) : c.moveTo(x+qx, y+qy);
    }
    c.closePath();
  }
  function fill(c, x, y, R, A, B, alpha, seed){
    const ang = rnd(seed)*Math.PI*2, g = c.createLinearGradient(x - Math.cos(ang)*R, y - Math.sin(ang)*R, x + Math.cos(ang)*R, y + Math.sin(ang)*R);
    g.addColorStop(0, rgba(A, alpha)); g.addColorStop(.55, rgba(B, alpha*.8)); g.addColorStop(1, rgba(B, alpha*.35));
    c.fillStyle = g; c.fill();
    const hx = x + Math.cos(ang + 2)*R*.35, hy = y + Math.sin(ang + 2)*R*.35, h = c.createRadialGradient(hx, hy, 0, hx, hy, R*.9);
    h.addColorStop(0, `rgba(255,255,255,${.35*alpha})`); h.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = h; c.fill();
  }
  function glow(c, x, y, R, col, a){ const g = c.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; c.beginPath(); c.arc(x, y, R, 0, Math.PI*2); c.fill(); }
  function bubble(c, x, y, r, A, B){ const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(A, .9)); g.addColorStop(.7, rgba(B, .55)); g.addColorStop(1, rgba(B, .25));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.fill(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = Math.max(.6, r*.06); c.stroke(); }

  // ── 리듬 연산: 같은 형태소를 어떻게 놓는가 [x, y, 크기, 회전, 진하기] ──
  function layout(rhythm, v, a){
    const L = [];
    if (rhythm === '잔상'){ // 하나가 지나간 자리에 고르게 옅어지는 자취 (완만한 곡선)
      for (let i = 0; i < 6; i++){ const t = i/5; L.push([.3 - t*.66, -.22 + t*.44 - Math.sin(t*Math.PI)*.08, .34*(1 - t*.4), .25, 1 - t*.78]); }
    } else if (rhythm === '반복'){ // 같은 형태가 둘레를 돌며 되풀이 (크기가 숨 쉬듯 커졌다 작아짐)
      const n = 7, off = v*.5;
      for (let i = 0; i < n; i++){ const ang = off + i/n*Math.PI*2, r = .5; L.push([Math.cos(ang)*r, Math.sin(ang)*r*.94, i % 2 ? .15 : .2, ang + Math.PI/2, .9]); }
      L.push([0, 0, .26, off, .95]);
    } else if (rhythm === '충돌'){ // 두 덩어리가 가운데서 부딪히고, 같은 간격으로 조각이 튕겨 나감
      L.push([-.17, .04, .4, .3, .95]); L.push([.19, -.06, .34, 1.9, .92]);
      for (let i = 0; i < 5; i++){ const ang = i/5*Math.PI*2 + .4, r = .62; L.push([Math.cos(ang)*r, Math.sin(ang)*r*.9, .12, ang, .75]); }
    } else { // 흐리게: 크게 번진 덩어리 위에 하나만 또렷
      L.push([-.18, .08, .52, .2, -.55]); L.push([.22, -.05, .46, 1.4, -.5]);
      L.push([.02, .04, .3, .4, .9]);
    }
    return L;
  }

  // ── 한 장 그리기 ──
  function paint(c, Wd, Hd){
    const { v, a } = state, I = info(), cols = palette(v, a);
    const R = Math.min(Wd, Hd)*.36, cx = Wd/2, cy = Hd/2, T = I.tex;
    const wM = [smooth(.15,.45,v), smooth(-.15,-.45,v), 0]; wM[2] = Math.max(0, 1 - wM[0] - wM[1]);
    const hi = smooth(.47,.53,a), ps = smooth(-.03,.03,v);
    const wR = { '잔상': hi*ps, '충돌': hi*(1-ps), '반복': (1-hi)*ps, '흐리게': (1-hi)*(1-ps) };

    // 간판 바탕 + 은은한 빛 번짐 (카드처럼)
    c.save(); c.beginPath(); c.arc(cx, cy, R*1.06, 0, Math.PI*2); c.fillStyle = '#FFFCFD'; c.fill(); c.restore();
    c.save(); c.beginPath(); c.arc(cx, cy, R*1.3, 0, Math.PI*2); c.clip();
    glow(c, cx - R*.35, cy - R*.2, R*.9, cols[1], .28); glow(c, cx + R*.4, cy + R*.3, R*.8, cols[2], .22);

    for (const rh of Object.keys(wR)){ const wr = wR[rh]; if (wr < .03) continue;
      layout(rh, v, a).forEach(([ux, uy, us, rot, al], i) => {
        const pick = rnd(i*3.7 + 1.3), k = pick < wM[0] ? 0 : pick < wM[0] + wM[1] ? 1 : 2;
        const x = cx + ux*R, y = cy + uy*R; let r = us*R, o = { rot, sx:1, sy:1, spike: T === '뾰족하게' ? 1 : 0 };
        let alpha = Math.abs(al)*wr; const blurred = al < 0;
        if (T === '압축하기'){ o.sx = .55; o.sy = 1.25; }
        if (T === '늘리기'){ o.sx = 1.75; o.sy = .62; }
        if (T === '비틀기'){ o.rot = rot + i*.6; o.sx = 1.3; o.sy = .7; }
        if (T === '투명도') alpha *= .35 + .65*((i*3) % 5)/4;
        const A = cols[i % 3], B = cols[(i+1) % 3];
        c.save(); if (blurred) c.filter = `blur(${R*.05}px)`;
        if (T === '분해하기'){ // 한 형태에서 작은 같은 형태들이 부드럽게 떨어져 나감
          piece(c, x, y, r*.8, k, 1.3 + v, o); fill(c, x, y, r*.8, A, B, alpha, i*5);
          for (let f = 0; f < 3; f++){ const ang = rot + .6 + f*.55, d = r*(1.05 + f*.32), rr = r*(.32 - f*.07);
            piece(c, x + Math.cos(ang)*d, y + Math.sin(ang)*d, rr, k, 1.3 + v, o); fill(c, x + Math.cos(ang)*d, y + Math.sin(ang)*d, rr, B, A, alpha*(.85 - f*.2), i*5+f+1); }
        } else {
          piece(c, x, y, r, k, 1.3 + v, o); fill(c, x, y, r, A, B, alpha, i*5+k);
          if (T === '겹치기'){ for (let q = 1; q <= 2; q++){ const ox = r*.32*q*Math.cos(rot + q*1.9), oy = r*.32*q*Math.sin(rot + q*1.9), rr = r*(1 - q*.16);
              piece(c, x+ox, y+oy, rr, k, 1.3 + v, { ...o, rot: o.rot + q*.5 }); fill(c, x+ox, y+oy, rr, cols[(i+q+1)%3], cols[(i+q)%3], alpha*(.62 - q*.12), i*11+q*3); } }
          if (T === '작은 원 집합'){ for (let d = 0; d < 5; d++){ const t = d/5*Math.PI*2 + i, dx = x + Math.cos(t)*r*.62, dy = y + Math.sin(t)*r*.62; bubble(c, dx, dy, r*.18, cols[(d+i)%3], '#FFFCFD'); } }
        }
        c.restore();
      });
    }
    // 비틀기: 꼬인 띠
    if (T === '비틀기'){ c.save(); c.beginPath(); const y0 = cy + R*.35;
      for (let i = 0; i <= 50; i++){ const u = i/50, px = cx - R*.7 + u*R*1.4, py = y0 + Math.sin(u*Math.PI*2 + v*2)*R*.1 - R*.05*Math.cos(u*Math.PI*4); i ? c.lineTo(px, py) : c.moveTo(px, py); }
      for (let i = 50; i >= 0; i--){ const u = i/50, px = cx - R*.7 + u*R*1.4, py = y0 + Math.sin(u*Math.PI*2 + v*2)*R*.1 + R*.07*Math.cos(u*Math.PI*4); c.lineTo(px, py); }
      c.closePath(); fill(c, cx, y0, R*.7, cols[0], cols[2], .8, 77); c.restore(); }
    // 작은 방울
    for (let i = 0; i < 6; i++){ const t = i/6*Math.PI*2 + .5 + v*.6, d = R*.82, x = cx + Math.cos(t)*d, y = cy + Math.sin(t)*d, r = R*(i % 2 ? .04 : .06);
      bubble(c, x, y, r, cols[i % 3], '#FFFCFD'); }
    c.restore();
    // 원 간판 테두리 (이중선)
    c.save(); c.strokeStyle = 'rgba(40,40,40,.9)'; c.lineWidth = 1.2;
    c.beginPath(); c.arc(cx, cy, R*1.06, 0, Math.PI*2); c.stroke(); c.beginPath(); c.arc(cx, cy, R*1.0, 0, Math.PI*2); c.stroke(); c.restore();
  }

  function compose(c, Wd, Hd){ c.clearRect(0,0,Wd,Hd); paint(c, Wd, Hd); }


  // ── 좌표(점 격자) + 슬라이더 ──
  let sv, sa, pad, dot;
  function init(canvas, ui, imgs, cb){
    cv = canvas; ctx = cv.getContext('2d'); emoImgs = imgs; onChange = cb; sv = ui.sv; sa = ui.sa; pad = ui.pad; dot = ui.dot;
    const drag = (el, set) => { let down = false;
      el.addEventListener('pointerdown', e => { down = true; el.setPointerCapture(e.pointerId); set(e); });
      el.addEventListener('pointermove', e => down && set(e)); el.addEventListener('pointerup', () => down = false); };
    const bind = (el, key, from, to) => {
      drag(el, e => { const r = el.getBoundingClientRect(), k = clamp((e.clientX - r.left)/r.width, 0, 1); state[key] = +(from + (to-from)*k).toFixed(3); changed(); });
      el.addEventListener('keydown', e => { const st = (to-from)*.025;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') state[key] = clamp(state[key]-st, Math.min(from,to), Math.max(from,to));
        else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') state[key] = clamp(state[key]+st, Math.min(from,to), Math.max(from,to)); else return;
        e.preventDefault(); changed(); });
    };
    bind(sv, 'v', -1, 1); bind(sa, 'a', 0, 1);
    drag(pad, e => { const r = pad.getBoundingClientRect(); state.v = +(clamp((e.clientX-r.left)/r.width,0,1)*2-1).toFixed(3); state.a = +(1-clamp((e.clientY-r.top)/r.height,0,1)).toFixed(3); changed(); });
  }
  function changed(){
    dirty = true; const I = info();
    sv.style.setProperty('--k', ((state.v+1)/2*100).toFixed(2) + '%'); sa.style.setProperty('--k', (state.a*100).toFixed(2) + '%');
    dot.style.left = ((state.v+1)/2*100) + '%'; dot.style.top = ((1-state.a)*100) + '%';
    sv.setAttribute('aria-valuenow', state.v.toFixed(2)); sa.setAttribute('aria-valuenow', state.a.toFixed(2));
    onChange && onChange(I, state);
  }
  function size(){ dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth || 579; H = cv.clientHeight || 592;
    const r = cv.getBoundingClientRect(), sc = r.width / W || 1; cv.width = Math.round(W*dpr*sc); cv.height = Math.round(H*dpr*sc); dirty = true; }
  let busy = false;
  function loop(){ if (!run) return; if (dirty && !busy){ dirty = false; busy = true; ctx.setTransform(cv.width/W, 0, 0, cv.height/H, 0, 0); compose(ctx, W, H); busy = false; } raf = requestAnimationFrame(loop); }
  function start(){ run = true; size(); changed(); raf = requestAnimationFrame(loop); }
  function stop(){ run = false; cancelAnimationFrame(raf); }
  // 간판·저장용: 원 간판 부분만 정사각형으로
  function snapshot(px = 1000){
    const R = Math.min(W,H)*.36*1.12, c = mk(px, px), x = c.getContext('2d'), keep = dpr; dpr = px/(R*2);
    const big = mk(W*dpr, H*dpr), bx = big.getContext('2d'); bx.scale(dpr, dpr); compose(bx, W, H); dpr = keep;
    x.drawImage(big, (W/2-R)*(px/(R*2)), (H/2-R)*(px/(R*2)), R*2*(px/(R*2)), R*2*(px/(R*2)), 0, 0, px, px);
    return c;
  }
  addEventListener('resize', () => run && size());
  return { init, start, stop, info, snapshot, get state(){ return state; } };
})();
