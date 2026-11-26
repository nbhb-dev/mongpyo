// 몽표 — 화면 흐름 (01 꿈 입장 → 11 깨어나기)
{
const $ = s => document.querySelector(s);
const S = { filled: {}, signs: {}, signImgs: {}, visits: [], hung: null, no: null, name: '', slept: new Date(), mems: [], land: 'city', emoImgs: {}, objImgs: {}, city: {}, ready: null };
const veil = $('#veil');
let dbP = null, dlP = null;
try { if (window.claude && claude.use){ dbP = claude.use('db'); dlP = claude.use('downloads'); } } catch(e) {}

function show(id){ document.querySelectorAll('.scene').forEach(s => s.classList.toggle('on', s.id === id)); }
const wait = ms => new Promise(r => setTimeout(r, ms));
async function fadeTo(id, color='white', inMs=700, hold=200){
  veil.classList.toggle('black', color === 'black'); veil.style.transitionDuration = inMs+'ms'; veil.classList.add('show');
  await wait(inMs + hold); show(id); await wait(60); veil.classList.remove('show'); await wait(inMs);
}
const pad2 = n => String(n).padStart(2,'0');
const fit = () => document.documentElement.style.setProperty('--k', Math.min(innerWidth/1330, innerHeight/900));
fit(); addEventListener('resize', fit);
const hideGuide = id => { const g = $(id); if (g) g.classList.add('off'); };

// ── 이미지 미리 불러오기 ──
S.ready = (async () => {
  await Promise.all([
    ...MP.EMO.map(async e => { S.emoImgs[e.id] = await MP.loadImg(`assets/emo/${e.id}.png`);
      const g = await MP.loadImg(`assets/sg/${e.id}.png`); S.signs[e.id] = Signs.make(e.id, g); S.signImgs[e.id] = S.signs[e.id].canvas; }),
    ...MP.OBJ.map(async o => { S.objImgs[o.id] = await MP.loadImg(`assets/obj/${o.id}.png`); }),
    ...['facadeA','facadeB','facadeC','skyline','thumb_city'].map(async k => { S.city[k] = await MP.loadImg(`assets/city/${k}.${'jpg'}`); })
  ]);
})();

// ── 입장 번호: 함께 쓰는 저장소에 방문을 남기고 순서를 셈 ──
async function entryNumber(){
  if (S.no) return S.no;
  try {
    const db = dbP ? await Promise.race([dbP, wait(4000).then(() => null)]) : null;
    if (db){
      const at = Date.now();
      await db.collection('visits').add({ at });
      const snap = await db.collection('visits').where('at', '<=', at).limit(1000).get();
      S.no = snap.size; return S.no;
    }
  } catch(e) {}
  let n = 1; try { n = (+localStorage.getItem('mp_no') || 0) + 1; localStorage.setItem('mp_no', n); } catch(e) {}
  S.no = n; return n;
}
const noText = n => String(n).padStart(4,'0');

// ═════ 01 꿈 입장: 졸린 눈이 혼자 깜빡이다, 누르면(또는 카메라 앞에서 눈을 2초 감으면) 완전히 감김 ═════
{
  const s = $('#s01'), bar = $('#gauge i'), eye = $('#eye');
  let done = false;
  async function finish(){
    if (done) return; done = true; window.__eyeDone = true;
    bar.style.transition = 'width 1s ease'; bar.style.width = '100%';
    eye.classList.remove('blinking'); eye.classList.add('close');
    await wait(1100); await fadeTo('s02', 'black', 600, 500); veil.classList.remove('black');
    veil.classList.add('show'); veil.style.transitionDuration = '0ms'; await wait(30); veil.style.transitionDuration = '1400ms'; veil.classList.remove('show');
    start02();
  }
  window.__eyeFinish = finish;
  window.__eyeGauge = k => { if (!done){ bar.style.transition = 'none'; bar.style.width = (k*100) + '%'; } };
  // 길게 누르면 게이지가 실시간으로 차오르고 눈이 점점 감김 · 2초가 다 차면 감기고 넘어감 · 떼면 다시 졸린 눈으로
  let t0 = 0, raf = 0, holding = false;
  const tick = () => { const k = Math.min(1, (performance.now()-t0)/2000); bar.style.transition = 'none'; bar.style.width = k*100 + '%';
    eye.style.transform = `scaleY(${1 - k*.92})`; if (k >= 1){ holding = false; eye.style.transform = ''; finish(); } else raf = requestAnimationFrame(tick); };
  const down = e => { if (done || (e && e.target.closest && e.target.closest('#camBtn'))) return; holding = true; eye.classList.remove('blinking'); t0 = performance.now(); raf = requestAnimationFrame(tick); };
  const up = () => { if (done || !holding) return; holding = false; cancelAnimationFrame(raf);
    bar.style.transition = 'width .4s'; bar.style.width = '0'; eye.style.transition = 'transform .5s ease'; eye.style.transform = '';
    setTimeout(() => { if (!done){ eye.style.transition = ''; eye.classList.add('blinking'); } }, 500); };
  s.addEventListener('pointerdown', down); s.addEventListener('pointerup', up); s.addEventListener('pointerleave', up);
  s.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !holding && !e.repeat) down(); }); s.addEventListener('keyup', up); s.tabIndex = 0;
}

// ═════ 02 초대장 (피그마 '02 초대장 후' 레이어 좌표 그대로) ═════
// [버블 x, y, 지름, 이미지 x, y, w, h, 오브제]
// 피그마 '02 초대장 후' 버블 그룹 좌표 [x, y, 오브제] — 이미지는 피그마 레이어 렌더 그대로
const BUB2 = [[1127,106,'postbox'],[30,434,'phone'],[1112,729,'frame'],[863,683,'keys'],[1023,371,'horse'],[854,24,'bear'],[1051,242,'station'],
  [861,441,'door'],[637,702,'train'],[809,630,'map'],[59,681,'clock'],[240.4,617.3,'ferris'],[313,570,'bench'],[208,372,'carousel'],[58,254,'lock'],[222,123,'traffic']];
function start02(){
  const L = $('#bubs2');
  if (!L.children.length){
    L.innerHTML = BUB2.map(([x,y,id]) => `<img class="bub" data-id="${id}" src="assets/fig/b_${id}.png" alt="" style="left:${x}px;top:${y}px">`).join('');
    L.querySelectorAll('img').forEach(im => im.onload = () => { im.dataset.d = im.naturalWidth; });
  }
  entryNumber().then(n => { $('#no2').textContent = noText(n); $('#no4').textContent = `입장 번호 ${noText(n)}`; });
}
{
  const s = $('#s02'), env = $('#env'), letter = $('#letter');
  let px = 0, py = 0, tx = 0, ty = 0, opened = false;
  const par = () => { px += (tx-px)*.06; py += (ty-py)*.06;
    for (const b of document.querySelectorAll('#bubs2 .bub')){ const d = (+b.dataset.d || 120)/9; b.style.transform = `translate(${px*d}px,${py*d}px)`; }
    if (s.classList.contains('on')) requestAnimationFrame(par); else setTimeout(par, 300); };
  par();
  // 드래그하면 시점이 살짝 돎: 가까운(큰) 버블은 빠르게, 먼(작은) 버블은 느리게
  let drag = null;
  s.addEventListener('pointerdown', e => { if (!env.contains(e.target)) drag = { x:e.clientX, y:e.clientY, tx, ty }; });
  s.addEventListener('pointermove', e => { if (drag){ tx = drag.tx + (e.clientX-drag.x)/innerWidth*2.2; ty = drag.ty + (e.clientY-drag.y)/innerHeight*1.4; } else { tx = (e.clientX/innerWidth - .5)*-.4; ty = (e.clientY/innerHeight - .5)*-.3; } });
  addEventListener('pointerup', () => { drag = null; });
  const open = async () => { Snd.paper();
    if (opened) return; opened = true; hideGuide('#hint2');
    const ex = $('#expand'); ex.style.opacity = 1; letter.style.transform = 'scale(3.2)';
    await wait(900); show('s03'); prep03(); ex.style.opacity = 0;
  };
  env.addEventListener('click', open);
  env.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') open(); });
}

// ═════ 03 · 04 안내서 / 입장권 ═════
function prep03(){
  const d = S.slept = new Date(), h = d.getHours();
  $('#tdate').textContent = `${d.getFullYear()}. ${pad2(d.getMonth()+1)}. ${pad2(d.getDate())}`;
  $('#ttime').textContent = `${h < 12 ? '오전' : '오후'} ${pad2(h%12 || 12)} : ${pad2(d.getMinutes())}`;
}
$('#fold').addEventListener('click', () => { Snd.paper(); $('#paper').classList.add('flip'); setTimeout(() => $('#tname').focus({ preventScroll:true }), 1300); });
$('#tname').addEventListener('keydown', e => { if (e.key === 'Enter') $('#enter').click(); });
$('#enter').addEventListener('click', async () => { Snd.stamp();
  S.name = ($('#tname').value || '').trim() || '이름 없는 여행자';
  $('#stamp').classList.add('on'); await wait(900);
  $('#paper').classList.add('fold'); await wait(1000);
  await fadeTo('s05', 'white', 700, 300); start05();
});

// ═════ 05 기억 고르기 / 06 배경 고르기 (같은 깊이 공간) ═════
const SP = { items: [], camZ: 0, camT: 0, mode: 'mem', run: false };
function buildSpace(){
  const el = $('#space'); el.innerHTML = '';
  let k = 0;
  for (let ring = 0; ring < 4; ring++) MP.OBJ.forEach((o, i) => {
    const a = (i / MP.OBJ.length) * Math.PI*2 + ring*.37, rad = .55 + (k*0.61803 % 1)*.5;
    const it = { o, x: Math.cos(a)*rad*1.25, y: Math.sin(a)*rad*.85, z: -ring*2.6 - (k*0.37 % 1)*2.2, el: document.createElement('div') };
    it.el.className = 'it'; it.el.innerHTML = `<img src="assets/fig/b_${o.id}.png" alt="${o.name}">`;
    it.el.title = o.name; it.el.addEventListener('click', () => pickMem(o));
    el.appendChild(it.el); SP.items.push(it); k++;
  });
}
function loopSpace(){
  if (!SP.run) return;
  SP.camZ += (SP.camT - SP.camZ)*.06;
  const W = innerWidth, H = innerHeight, f = 1.6;
  for (const it of SP.items){
    let z = it.z + SP.camZ; const span = 10.4; while (z > 1.2) z -= span; while (z < 1.2 - span) z += span;
    const d = f - z, s = f/d, size = Math.min(W,H)*.17*s;
    const x = W/2 + it.x*W*.5*s, y = H/2 + it.y*H*.6*s;
    const vis = Math.max(0, Math.min(1, (z + 9)/3)) * Math.max(0, Math.min(1, (1.15 - z)*3));
    const blur = SP.mode === 'land' ? 2.5 : Math.max(0, (-z-3)*.6);
    const depthA = Math.max(.3, Math.min(1, .3 + (s - .45)*.9));
    it.el.style.cssText = `width:${size}px;height:${size}px;transform:translate(${x-size/2}px,${y-size/2}px);opacity:${(SP.mode==='land'?.4:1)*vis*depthA};z-index:${Math.round(100+z*10)};filter:blur(${blur}px);pointer-events:${vis>.6&&s>.7&&SP.mode==='mem'?'auto':'none'}`;
  }
  requestAnimationFrame(loopSpace);
}
function renderTray(){
  $('#tray').innerHTML = Array.from({ length: 10 }, (_, i) => { const o = S.mems[i];
    const st = `style="left:${(20.5 + i*79).toFixed(1)}px"`;
    return o ? `<button class="full" ${st} data-i="${i}" aria-label="${o.name} 빼기"><img src="assets/fig/b_${o.id}.png" alt=""></button>` : `<button ${st} tabindex="-1" aria-hidden="true"></button>`; }).join('');
  $('#next5').disabled = !S.mems.length;
  for (const it of SP.items) it.el.classList.toggle('picked', S.mems.includes(it.o));
}
function pickMem(o){ if (S.mems.includes(o) || S.mems.length >= 10) return; Snd.pick(); hideGuide('#hint5'); S.mems.push(o); renderTray(); }
$('#tray').addEventListener('click', e => { const b = e.target.closest('button.full'); if (!b) return; S.mems.splice(+b.dataset.i, 1); renderTray(); });
function start05(){
  if (!SP.items.length) buildSpace();
  SP.mode = 'mem'; SP.run = true; renderTray(); loopSpace();
  $('#s05h').hidden = false; $('#tray').hidden = false; $('#next5').hidden = false; $('#s06ui').hidden = true;
}
$('#s05').addEventListener('wheel', e => { SP.camT += e.deltaY * .004; if (S.mems.length) hideGuide('#hint5'); }, { passive:true });
{ let ty = null; $('#s05').addEventListener('touchstart', e => ty = e.touches[0].clientY, { passive:true });
  $('#s05').addEventListener('touchmove', e => { if (ty == null) return; SP.camT += (ty - e.touches[0].clientY)*.01; ty = e.touches[0].clientY; }, { passive:true }); }
$('#next5').addEventListener('click', () => {
  SP.mode = 'land'; SP.camT += 3;
  for (const id of ['#s05h','#tray','#next5']) $(id).hidden = true;
  $('#s06ui').hidden = false; renderLands();
});
// 07 → 06 배경 다시 고르기
$('#back7').addEventListener('click', async () => {
  Street.stop(); Snd.street(false); leaveNear();
  await fadeTo('s05', 'white', 600, 200);
  SP.mode = 'land'; SP.run = true; loopSpace();
  for (const id of ['#s05h','#tray','#next5']) $(id).hidden = true;
  $('#s06ui').hidden = false; renderLands();
});

// 06: 풍경 카드 — 피그마 자리표시 그대로 (사진은 assets/land/<id>.jpg 를 넣으면 그 사진이 들어감)
let landIdx = 1;
function landBox(id){ const d = document.createElement('div'); d.className = 'ph'; d.textContent = '풍경 사진';
  const im = new Image(); im.alt = ''; im.onload = () => { d.textContent = ''; d.appendChild(im); }; im.src = `assets/land/${id}.jpg`; return d; }
function renderLands(){
  const L = $('#land'); L.innerHTML = '';
  const order = [(landIdx+2)%3, landIdx, (landIdx+1)%3];
  const POS = [[322,389,191.9],[524.6,325,281],[815.7,389,191.9]];
  order.forEach((i, k) => { const ld = MP.LANDS[i], b = document.createElement('button'); b.className = 'lc ' + (k === 1 ? 'c' : 's');
    const [x,y,w] = POS[k]; b.style.cssText = `left:${x}px;top:${y}px;width:${w}px`;
    b.appendChild(landBox(ld.id)); const sp = document.createElement('span'); sp.textContent = ld.name; b.appendChild(sp);
    b.addEventListener('click', () => { if (k !== 1){ landIdx = i; hideGuide('#hint6'); renderLands(); } }); L.appendChild(b); });
  S.land = MP.LANDS[landIdx].id;
}
window.addEventListener('keydown', e => { if ($('#s06ui').hidden || !$('#s05').classList.contains('on')) return; if (e.key==='ArrowLeft'){ landIdx = (landIdx+2)%3; renderLands(); } if (e.key==='ArrowRight'){ landIdx = (landIdx+1)%3; renderLands(); } });
$('#go6').addEventListener('click', async () => { await S.ready; SP.run = false; await enter07(); });

// ═════ 07 간판 거리 ═════
const stOK = Street.init($('#gl'));
const dotsEl = $('#dots'); dotsEl.innerHTML = Street.SLOTS.map(() => '<i></i>').join('');
const near = $('#near');
dotsEl.querySelectorAll('i').forEach((d, i) => d.style.left = (i*49.95) + 'px');
let curSign = null;
async function enter07(){
  const lit = new Set(S.mems.map(o => o.emo));
  const memories = S.mems.map(o => ({ img: S.objImgs[o.id], emo: o.emo }));
  await Street.build({ land: S.land, lit, memories, signs: S.signs, filled: S.filled, city: S.city });
  await fadeTo('s07', 'white', 800, 300); Street.start(); Snd.street(true); placeName('간판 거리');
  setTimeout(() => hideGuide('#hint7'), 9000);
}
Street.onStep = () => Snd.step();
// 항상 떠 있는 여행자 정보 칸
const LANDNAME = { city:'도시', field:'들판', sea:'바다' };
let lastInfo = '';
function placeName(t){ const el = $('#place'); el.textContent = t; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
Street.onProgress = ({ hovered, pos, signs }) => {
  const passed = signs.filter(s => s.cz > pos[2]).length;
  const nextS = signs.find(s => s.cz < pos[2] - 1);
  const where = nextS ? `다음 간판 · ${nextS.name}  ${Math.max(0, Math.round(pos[2] - nextS.cz))}m` : '거리의 끝';
  const key = passed + where;
  if (key !== lastInfo){ lastInfo = key;
    $('#infoName').textContent = S.name || '이름 없는 여행자'; $('#infoNo').textContent = 'No.' + String(S.no||0).padStart(4,'0');
    $('#infoWhere').textContent = `간판 거리 · ${LANDNAME[S.land] || '도시'}`; $('#infoNext').textContent = where;
    $('#infoMem').innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${S.mems[i] ? 'on' : ''}"></i>`).join(''); }
  [...dotsEl.children].forEach((d, i) => d.className = i < passed ? 'on' : i === passed ? 'now' : '');
  $('#gl').classList.toggle('hot', !!hovered && Street.mode === 'walk');
};
Street.onPick = s => {
  curSign = s; hideGuide('#hint7');
  const img = $('#bigSign img'); img.hidden = s.empty; $('#emptySign').hidden = !s.empty;
  $('#nearMsg').textContent = s.empty ? '손을 대면 이 간판이 당신의 마음을 읽습니다' : '길게 누르면 이 간판의 꿈으로 들어갑니다';
  if (!s.empty) img.src = s.src.toDataURL ? s.src.toDataURL() : s.src.src;
  $('#gl').classList.add('blur'); near.classList.add('on'); $('#nearUI').hidden = false; $('#hand').classList.remove('push');
};
function leaveNear(){ near.classList.remove('on'); $('#nearUI').hidden = true; $('#gl').classList.remove('blur'); resetGauge(); }
// 간판 밖(흐려진 도시)을 누르면 다시 걷기
near.addEventListener('click', () => { leaveNear(); Street.retreat(); });
const pf = $('#pressFill');
function resetGauge(){ pf.style.strokeDashoffset = 383.3; $('#press').classList.remove('on'); $('#hand').classList.remove('push'); }
{ // 간판에 손을 대고 길게 누르면 게이지가 차오름 → 들어가기
  const big = $('#bigSign'); let t0 = 0, raf = 0;
  const tick = () => { const k = Math.min(1, (performance.now()-t0)/1500); pf.style.strokeDashoffset = 383.3*(1-k); if (k >= 1) touched(); else raf = requestAnimationFrame(tick); };
  big.addEventListener('pointerdown', () => { if (!curSign) return; Snd.gauge(); $('#hand').classList.add('push'); $('#press').classList.add('on'); t0 = performance.now(); raf = requestAnimationFrame(tick); });
  const up = () => { cancelAnimationFrame(raf); if (pf.style.strokeDashoffset !== '0') resetGauge(); };
  big.addEventListener('pointerup', up); big.addEventListener('pointerleave', up);
  async function touched(){ cancelAnimationFrame(raf); Street.stop(); Snd.street(false); if (!curSign.empty && curSign.id) Snd.enter();
    if (curSign.empty || !curSign.id){ await fadeTo('s10', 'white', 500, 150); enter10(curSign); }
    else { S.visits.push(curSign.id); const m = $('#enterMsg'); m.classList.add('on'); await fadeTo('s08', 'white', 450, 1300); enter08(curSign);
      setTimeout(() => m.classList.remove('on'), 150); } }
}
window.__backToStreet = () => backToStreet();
async function backToStreet(){ leaveNear(); await fadeTo('s07', 'white', 500, 150); Street.start(); Street.retreat(); Snd.street(true); }

// ═════ 08 간판 안 · 09 감정 설명 카드 ═════
// 각 감정의 p5 인터랙션: p5/<감정 id>/index.html 을 넣으면 여기에 뜸 (예: p5/seollem/index.html)
const frame = $('#p5frame');
async function enter08(s){
  const e = MP.emo(s.id); fillCard(e);
  frame.hidden = true; frame.removeAttribute('src');
  // p5로 만든 감정 인터랙션이 있는 감정 (p5/<감정 id>/index.html)
  const P5 = { seollem: true };
  if (P5[e.id]){ frame.src = `p5/${e.id}/index.html`; frame.hidden = false; }
}
$('#exit8').addEventListener('click', async () => { closeCard(); frame.hidden = true; frame.removeAttribute('src'); await backToStreet(); });
$('#qbtn').addEventListener('click', () => $('#card').classList.add('on'));
const closeCard = () => $('#card').classList.remove('on');
$('#close9').addEventListener('click', closeCard);
window.addEventListener('keydown', e => { if (e.key === 'Escape') closeCard(); });
function fillCard(e){
  $('#cName').textContent = e.name; $('#cScene').textContent = e.scene;
  [0,1,2].forEach(i => $('#ic'+i).src = `assets/icon/${e.id}_${i}.png`);
  const tl = { future:'미래', present:'현재', past:'과거' }[e.time];
  $('#cNum').textContent = `정서 ${e.v > 0 ? '+' : ''}${e.v.toFixed(2)} / 각성 ${e.a.toFixed(2)} / ${tl}`;
  const [c, r] = MP.grid(e.v, e.a); let h = '';
  for (let y = 0; y <= 10; y++) for (let x = 0; x <= 20; x++) h += `<i class="${x===10||y===5?'ax':''}" style="left:${x*23}px;top:${y*20}px"></i>`;
  h += `<i class="me" style="left:${Math.round(c)*23}px;top:${Math.round(r)*20}px;background:${e.col[0]}"></i>`;
  $('#cGrid').innerHTML = h;
}

// ═════ 10 빈 간판 · 그래픽 생성기 ═════
{
  const $ = s => document.querySelector(s);
  let inited = false, sign = null;
  window.enter10 = s => {
    sign = s; $('#msg10').textContent = '';
    if (!inited){ inited = true;
      let h = ''; for (let y = 0; y <= 10; y++) for (let x = 0; x <= 20; x++) h += `<i class="${x===10||y===5?'ax':''}" style="left:${(x*27.039).toFixed(2)}px;top:${(y*23.512).toFixed(2)}px"></i>`;
      $('#padGrid').innerHTML = h;
      Gen.init($('#gen'), { sv: $('#slV'), sa: $('#slA'), pad: $('#padHit'), dot: $('#padDot') }, S.signImgs, (I, st) => {
        $('#iM').textContent = I.morph; $('#iR').textContent = I.rhythm; $('#iT').textContent = I.tex; $('#iN').textContent = I.near.name;
        $('#valV').textContent = (st.v > 0 ? '+' : '') + st.v.toFixed(2); $('#valA').textContent = st.a.toFixed(2);
      });
      for (const id of ['#slV','#slA','#padHit']) $(id).addEventListener('pointerdown', () => $('#hint10').classList.add('off'));
    }
    Gen.start();
  };
  const back = async () => { Gen.stop(); await window.__backToStreet(); };
  $('#back10').addEventListener('click', back);
  $('#hang10').addEventListener('click', async () => { const img = Gen.snapshot(900); Street.setFilled(sign.slot, img); S.filled[sign.slot] = img;
    S.hung = img; S.mine = { v: Gen.state.v, a: Gen.state.a }; S.visits.push('mine'); await back(); });
  $('#save10').addEventListener('click', async () => {
    const msg = $('#msg10');
    try { const dl = dlP ? await Promise.race([dlP, new Promise(r => setTimeout(() => r(null), 1500))]) : null;
      if (!dl){ const blob = await new Promise(r => (typeof Gen !== 'undefined' && msg.id === 'msg10' ? Gen.snapshot(1400) : document.querySelector('#rec11')).toBlob(r, 'image/png'));
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = msg.id === 'msg10' ? '몽표_나의간판.png' : '몽표_꿈여정표.png'; document.body.appendChild(a); a.click(); a.remove(); msg.textContent = '저장했어요.'; return; }
      const blob = await new Promise(r => Gen.snapshot(1400).toBlob(r, 'image/png'));
      await dl.save({ filename: '몽표_나의간판.png', data: blob }); msg.textContent = '저장했어요.';
    } catch(e){ msg.textContent = '저장하지 않았어요.'; }
  });
}

// ═════ 11 깨어나기 · 꿈 여정표 (피그마 '11 깨어나기 - 여정표') ═════
{
  const $ = q => document.querySelector(q);
  $('#wake').addEventListener('click', async () => { Street.stop(); Snd.street(false); Snd.wake(); await fadeTo('s11', 'white', 900, 300); enter11(); });
  $('#again').addEventListener('click', () => location.reload());
  const pt = id => { if (id === 'mine') return S.mine ? { v:S.mine.v, a:S.mine.a, name:'나의 간판' } : null; const e = MP.emo(id); return e ? { v:e.v, a:e.a, name:e.name } : null; };
  // 점 격자 위에 지나온 꿈 경로
  function grid(c, x0, y0, W, H, dot, ids, labels){
    for (let j = 0; j <= 10; j++) for (let i = 0; i <= 20; i++){ c.fillStyle = (i===10||j===5) ? '#B9A2AF' : '#777'; c.beginPath(); c.arc(x0 + i*W/20, y0 + j*H/10, dot/2, 0, 7); c.fill(); }
    const P = ids.map(pt).filter(Boolean).map(p => { const [col,row] = MP.grid(p.v, p.a); return [x0 + col*W/20, y0 + row*H/10, p.name]; });
    c.strokeStyle = '#987D8D'; c.lineWidth = labels ? 4 : 2.2; c.lineJoin = 'round'; c.beginPath(); P.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y)); c.stroke();
    P.forEach(([x,y,n]) => { c.fillStyle = '#987D8D'; c.beginPath(); c.arc(x, y, labels ? 9 : 5, 0, 7); c.fill();
      if (labels){ c.font = '700 16px "Noto Serif KR",serif'; c.textAlign = 'center'; c.fillText(n, x, y + 30); } });
  }
  const pad2 = n => String(n).padStart(2,'0');
  function enter11(){
    const ids = S.visits.slice();
    const g = $('#map11'), gc = g.getContext('2d'); g.width = 1420; g.height = 640; gc.scale(2,2); gc.clearRect(0,0,710,320);
    grid(gc, 3, 3, 701.8, 306.1, 5.88, ids, true);
    const row = $('#signs11'); row.innerHTML = '';
    ids.forEach(id => { const im = id === 'mine' ? S.hung : S.signImgs[id]; if (!im) return;
      const fr = id === 'mine' ? { h: .946 } : S.signs[id].frame, k = 150/(im.height*fr.h);
      const el = new Image(); el.src = im.toDataURL(); el.style.height = (im.height*k) + 'px'; el.style.width = (im.width*k) + 'px'; row.appendChild(el); });
    if (!row.children.length) row.innerHTML = '<span class="empty11">아직 들어간 꿈 간판이 없어요</span>';
    drawReceipt(ids);
    const st = $('#stamp11'); st.classList.remove('on');
    setTimeout(() => { st.classList.add('on'); Snd.stamp(); stamped = true; drawReceipt(ids); }, 1100);
  }
  let stamped = false;
  const STAMP11 = new Image(); STAMP11.src = 'assets/fig/stamp11.png';
  function drawReceipt(ids){
    const c = $('#rec11'), x = c.getContext('2d'), K = 2; c.width = 431*K; c.height = 759*K; x.scale(K,K);
    x.fillStyle = '#fff'; x.fillRect(0,0,431,759);
    x.strokeStyle = '#8F7A86'; x.setLineDash([1.5,2.5]); x.lineWidth = 1.2; x.strokeRect(.75,.75,429.5,757.5); x.setLineDash([]);
    const T = (t, X, Y, size, w, col, al='left') => { x.font = `${w} ${size}px "Noto Serif KR",serif`; x.fillStyle = col; x.textAlign = al; x.textBaseline = 'top'; x.fillText(t, X, Y); };
    T('꿈 여정표', 216, 39, 24, 700, '#987D8D', 'center');
    T(`입장 번호 ${String(S.no||0).padStart(4,'0')}`, 216, 87, 12, 900, '#777', 'center');
    x.strokeStyle = '#D9D9D9'; x.setLineDash([3,3]); x.beginPath(); x.moveTo(27,124.5); x.lineTo(406,124.5); x.stroke(); x.setLineDash([]);
    const now = new Date(), d = S.slept || now, tm = t => `${pad2(t.getHours())} : ${pad2(t.getMinutes())}`;
    const lines = [S.name || '이름 없는 여행자', `${d.getFullYear()}.${pad2(d.getMonth()+1)}.${pad2(d.getDate())}`, '', '잠든 시각', tm(d), '', '깨어난 시각', tm(now), '', '', '고른 기억'];
    lines.forEach((t,i) => T(t, 27, 151 + i*16, 11, 700, '#777'));
    // 만든 간판
    x.strokeStyle = '#777'; x.lineWidth = 1; x.beginPath(); x.arc(251+77.5, 155+78.5, 77.5, 0, 7); x.stroke();
    if (S.hung){ x.save(); x.beginPath(); x.arc(328.5, 233.5, 76, 0, 7); x.clip(); x.drawImage(S.hung, 252, 157, 153, 153); x.restore(); }
    else T('만든 간판', 328.5, 227, 12, 900, '#777', 'center');
    // 고른 기억 10칸
    const XS = [27, 106, 186, 263, 341];
    for (let k = 0; k < 10; k++){ const cx = XS[k%5] + 29.5, cy = (k < 5 ? 350 : 429) + 30; x.strokeStyle = '#777'; x.beginPath(); x.arc(cx, cy, 29.5, 0, 7); x.stroke();
      const o = S.mems[k], im = o && S.objImgs[o.id]; if (im){ const s = 40/Math.max(im.width, im.height); x.filter = 'grayscale(1)'; x.drawImage(im, cx - im.width*s/2, cy - im.height*s/2, im.width*s, im.height*s); x.filter = 'none'; } }
    if (stamped && STAMP11.complete) x.drawImage(STAMP11, 26, 25, 80, 80);
    T('꿈의 경로', 27, 522, 11, 700, '#777');
    grid(x, 30, 570, 365, 157.5, 2.9, ids, false);
  }
  $('#save11').addEventListener('click', async () => {
    const msg = $('#msg11');
    try { const dl = dlP ? await Promise.race([dlP, new Promise(r => setTimeout(() => r(null), 1500))]) : null;
      if (!dl){ const blob = await new Promise(r => (typeof Gen !== 'undefined' && msg.id === 'msg10' ? Gen.snapshot(1400) : document.querySelector('#rec11')).toBlob(r, 'image/png'));
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = msg.id === 'msg10' ? '몽표_나의간판.png' : '몽표_꿈여정표.png'; document.body.appendChild(a); a.click(); a.remove(); msg.textContent = '저장했어요.'; return; }
      const blob = await new Promise(r => $('#rec11').toBlob(r, 'image/png'));
      await dl.save({ filename: '몽표_꿈여정표.png', data: blob }); msg.textContent = '저장했어요.';
    } catch(e){ msg.textContent = '저장하지 않았어요.'; }
  });
}

// ═════ 공통 마감: 버튼 소리 · 소리 켜고 끄기 · 거리 질감 ═════
{
  document.addEventListener('click', e => { if (e.target.closest('.btn, #tray button.full, .lc')) Snd.click(); }, true);
  document.addEventListener('pointerover', e => { const b = e.target.closest('.btn'); if (b && !b.contains(e.relatedTarget)) Snd.hover(); });
  const sb = document.querySelector('#soundBtn'), paint = () => { sb.textContent = Snd.on ? '소리 켬' : '소리 끔'; sb.classList.toggle('off', !Snd.on); };
  sb.addEventListener('click', e => { e.stopPropagation(); Snd.toggle(); paint(); }); paint();
  // 필름 그레인: 고운 입자 몇 장을 번갈아 보여 줌 (긁힘·얼룩 없이 부드럽게)
  const frames = [0,1,2].map(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 300; const x = c.getContext('2d');
    const d = x.createImageData(300, 300); for (let i = 0; i < d.data.length; i += 4){ const v = 128 + (Math.random()+Math.random()-1)*60; d.data[i] = d.data[i+1] = d.data[i+2] = v; d.data[i+3] = 255; }
    x.putImageData(d, 0, 0); return c.toDataURL(); });
  const c = { toDataURL: () => frames[0] };
  let gi = 0; setInterval(() => { const g = document.querySelector('#grunge'); if (g && g.offsetParent) g.style.backgroundImage = `url(${frames[gi = (gi+1) % 3]})`; }, 90);
  document.querySelector('#grunge').style.backgroundImage = `url(${c.toDataURL()})`;

}
}
