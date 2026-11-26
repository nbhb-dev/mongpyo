// noprotect
// ─────────────────────────────────────────────────────────────
// 몽표 夢標 · 간판 안 감정 그래픽 인터랙션 — 01 설렘
// 리듬 연산 = 잔상
//   · 원래 그래픽 속 요소(레이어)들을 떼어 내 크기를 달리해 화면 가득 흩어 놓고, 천천히 떠다니게 함
//   · 커서가 지나가면 근처 요소들이 부드럽게 옆으로 비켜나며 '쉭' 파헤쳐지고, 지나가면 천천히 제자리로
//   · 잔상: 커서에 seollem_04 요소가 꼬리처럼 천천히 부드럽게 따라옴
// 그래픽은 일러스트에서 내보낸 PNG 그대로 사용 (새로 그리지 않음)
// 화면 비율 16:10 (와이어프레임 960×600) · p5.js 2.x용
// ─────────────────────────────────────────────────────────────

// ① 파일 — 코드에 이름을 그대로 적어야 웹 에디터가 업로드 파일과 연결함
const FILES = [
  'seollem_01.png',
  'seollem_02.png',
  'seollem_03.png',
  'seollem_04.png',
  'seollem_05.png',
  'seollem_06.png',
  'seollem_07.png'
];

// ② 조절값
const P = {
  ratio: 16 / 10,     // 화면 비율 (와이어프레임 1330×900)
  count: 42,          // 화면에 흩어 놓을 요소 개수
  minScale: 0.35,     // 요소 크기 범위 (원래 그래픽 속 크기 대비)
  maxScale: 1.25,
  drift: 0.25,        // 떠다니는 속도
  rise: 0.08,         // 위로 떠오르는 정도 (설렘 = 미래)
  spin: 0.002,        // 천천히 도는 정도
  reach: 150,         // 커서가 요소를 비켜나게 하는 거리 (px, 960 기준)
  part: 70,           // 비켜나는 최대 거리 (px, 960 기준)
  sweep: 0.6,         // 커서가 움직이는 방향으로 함께 쓸려 가는 정도
  ease: 0.05,         // 비켜나고 돌아오는 부드러움 (작을수록 느리고 부드러움)
  trailFile: 'seollem_04.png', // 커서 꼬리로 쓸 요소
  trailCount: 14,     // 꼬리 길이 (개수)
  trailSize: 64,      // 꼬리 맨 앞 크기 (px, 960 기준)
  trailLead: 0.12,    // 꼬리 머리가 커서를 따라가는 속도
  trailFollow: 0.22,  // 꼬리 마디가 앞 마디를 따라가는 속도
  trailAlpha: 210,    // 꼬리 맨 앞 진하기
  bgInner: '#FFF6F9',
  bgOuter: '#FBE9F0'
};

let parts = [], items = [], trail = [], trailPart = null, bgG, U = 1;
let mvx = 0, mvy = 0;

async function setup() {
  const [w, h] = fitSize();
  createCanvas(w, h);
  U = width / 960;
  const results = await Promise.allSettled(FILES.map(n => loadImage(n)));
  results.forEach((r, k) => {
    if (r.status === 'fulfilled') {
      const part = makePart(r.value);
      parts.push(part);
      if (FILES[k] === P.trailFile) trailPart = part;
    } else {
      console.log('불러오지 못한 파일: ' + FILES[k]);
    }
  });
  makeBackground();
  scatter();
  for (let i = 0; i < P.trailCount; i++) {
    trail.push({ x: width / 2, y: height / 2 });
  }
}

function fitSize() {
  let w = windowWidth, h = w / P.ratio;
  if (h > windowHeight) { h = windowHeight; w = h * P.ratio; }
  return [Math.floor(w), Math.floor(h)];
}

// 레이어에서 실제로 그려진 부분만 잘라 쓰기 위해 범위(bbox)를 계산
function makePart(img) {
  const src = img.canvas || img.elt || img;
  const sw = 160, sh = Math.max(1, Math.round(160 * img.height / img.width));
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0, sw, sh);
  let x0 = 0, y0 = 0, x1 = sw, y1 = sh;
  try {
    const d = ctx.getImageData(0, 0, sw, sh).data;
    x0 = sw; y0 = sh; x1 = 0; y1 = 0;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        if (d[(y * sw + x) * 4 + 3] > 12) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 <= x0) { x0 = 0; y0 = 0; x1 = sw; y1 = sh; }
  } catch (e) {
    // 픽셀을 읽을 수 없으면 레이어 전체를 사용
  }
  const fx = img.width / sw, fy = img.height / sh;
  return {
    img,
    sx: x0 * fx, sy: y0 * fy,
    sw: (x1 - x0 + 1) * fx, sh: (y1 - y0 + 1) * fy,
    rel: (x1 - x0 + 1) / sw          // 원래 그래픽 폭 대비 요소 폭
  };
}

// 요소들을 화면 전체에 흩어 놓기
function scatter() {
  items = [];
  if (!parts.length) return;
  const graphicW = min(width, height) * 0.62;   // 원래 그래픽이 화면에 놓였을 때의 기준 폭
  for (let i = 0; i < P.count; i++) {
    const part = parts[i % parts.length];
    const sc = random(P.minScale, P.maxScale);
    const w = part.rel * graphicW * sc;
    items.push({
      part,
      x: random(width), y: random(height),
      w, h: w * part.sh / part.sw,
      ang: random(-0.3, 0.3),
      spin: random(-1, 1) * P.spin,
      seed: random(1000),
      depth: sc,                 // 클수록 앞쪽
      ox: 0, oy: 0               // 커서 때문에 비켜난 정도
    });
  }
  items.sort((a, b) => a.depth - b.depth); // 작은 것(먼 것) 먼저 그림
}

function makeBackground() {
  bgG = createGraphics(width, height);
  const ctx = bgG.drawingContext;
  const g = ctx.createRadialGradient(width / 2, height / 2, 10, width / 2, height / 2, max(width, height) * 0.7);
  g.addColorStop(0, P.bgInner); g.addColorStop(1, P.bgOuter);
  ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);
}

function draw() {
  if (!items.length) {
    background(P.bgOuter);
    return;
  }
  image(bgG, 0, 0);
  const t = millis() / 1000;
  const mouseIn = mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height;

  // 커서 움직임을 부드럽게 평균 (갑작스러운 흔들림 방지)
  mvx = lerp(mvx, mouseX - pmouseX, 0.1);
  mvy = lerp(mvy, mouseY - pmouseY, 0.1);
  const R = P.reach * U;

  for (const it of items) {
    // 1) 떠다님: 노이즈 흐름을 따라 천천히, 조금씩 위로
    const a = noise(it.seed, t * 0.05) * TWO_PI * 2;
    it.x += cos(a) * P.drift * U;
    it.y += sin(a) * P.drift * U - P.rise * U;
    it.ang += it.spin;

    // 2) 파헤쳐짐: 커서 가까이 있으면 바깥쪽 + 커서가 가는 방향으로 비켜날 목표를 정하고,
    //    지금 위치에서 그 목표로 천천히 다가감 (튕김·진동 없음). 커서가 멀어지면 목표가 0 → 천천히 제자리로
    let tx = 0, ty = 0;
    if (mouseIn) {
      const dx = it.x - mouseX, dy = it.y - mouseY;
      const d = Math.hypot(dx, dy);
      if (d < R && d > 0.001) {
        const f = (1 - d / R) ** 2;                 // 가까울수록 크게, 가장자리는 아주 약하게
        tx = (dx / d) * P.part * U * f + mvx * P.sweep * 10 * f;
        ty = (dy / d) * P.part * U * f + mvy * P.sweep * 10 * f;
      }
    }
    it.ox = lerp(it.ox, tx, P.ease);
    it.oy = lerp(it.oy, ty, P.ease);

    // 화면 밖으로 나가면 반대편에서 다시 들어옴
    const m = max(it.w, it.h);
    if (it.x < -m) it.x = width + m;
    if (it.x > width + m) it.x = -m;
    if (it.y < -m) it.y = height + m;
    if (it.y > height + m) it.y = -m;
  }

  // 3) 요소 그리기 (작은 것 먼저)
  for (const it of items) {
    tint(255, map(it.depth, P.minScale, P.maxScale, 150, 255));
    drawItem(it, it.x + it.ox, it.y + it.oy, it.ang + it.ox * 0.002);
  }

  // 4) 잔상: 커서에 seollem_04가 꼬리처럼 천천히 따라옴
  if (trailPart) {
    const hx = mouseIn ? mouseX : trail[0].x, hy = mouseIn ? mouseY : trail[0].y;
    trail[0].x = lerp(trail[0].x, hx, P.trailLead);
    trail[0].y = lerp(trail[0].y, hy, P.trailLead);
    for (let i = 1; i < trail.length; i++) {
      trail[i].x = lerp(trail[i].x, trail[i - 1].x, P.trailFollow);
      trail[i].y = lerp(trail[i].y, trail[i - 1].y, P.trailFollow);
    }
    for (let i = trail.length - 1; i >= 0; i--) {
      const k = i / max(1, trail.length - 1);       // 0 = 머리, 1 = 꼬리 끝
      const w = P.trailSize * U * lerp(1, 0.35, k);
      tint(255, P.trailAlpha * (1 - k) ** 1.4);
      const p = trailPart;
      image(p.img, trail[i].x - w / 2, trail[i].y - w * p.sh / p.sw / 2, w, w * p.sh / p.sw, p.sx, p.sy, p.sw, p.sh);
    }
  }
  noTint();
}

function drawItem(it, x, y, ang) {
  const p = it.part;
  push();
  translate(x, y);
  rotate(ang);
  image(p.img, -it.w / 2, -it.h / 2, it.w, it.h, p.sx, p.sy, p.sw, p.sh);
  pop();
}

function keyPressed() {
  if (key === 's' || key === 'S') {
    saveCanvas('몽표_설렘', 'png');
  }
}

function windowResized() {
  const [w, h] = fitSize();
  resizeCanvas(w, h);
  U = width / 960;
  makeBackground();
  scatter();
}
