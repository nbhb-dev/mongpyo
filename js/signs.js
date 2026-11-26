// 몽표 — 간판 만들기: 피그마의 간판 그래픽(assets/sg) + 카드와 같은 간판 테두리(이중선)를 선명하게 새로 그림
window.Signs = (() => {
  // 간판 모양 (카드 테두리 기준, 즐거움은 거리 화면의 가로 간판)
  const SHAPE = {
    seollem:  { type:'circle',   ar:1 },
    oeroum:   { type:'diamond',  ar:1 },
    huimang:  { type:'capsule',  ar:.38 },
    bunno:    { type:'octagon',  ar:1 },
    geurium:  { type:'stadium',  ar:.74 },
    jeulgeoum:{ type:'capsule',  ar:1.65 },
    pyeonan:  { type:'capsule',  ar:.42 },
    buran:    { type:'triangle', ar:.88 }
  };
  // 모양 경로 (가운데 cx, cy / 가로 w, 세로 h)
  function path(c, type, cx, cy, w, h){
    c.beginPath();
    if (type === 'circle'){ c.ellipse(cx, cy, w/2, h/2, 0, 0, Math.PI*2); }
    else if (type === 'diamond'){ c.moveTo(cx, cy-h/2); c.lineTo(cx+w/2, cy); c.lineTo(cx, cy+h/2); c.lineTo(cx-w/2, cy); c.closePath(); }
    else if (type === 'octagon'){ const k = .29; const pts = [[-.5+k,-.5],[.5-k,-.5],[.5,-.5+k],[.5,.5-k],[.5-k,.5],[-.5+k,.5],[-.5,.5-k],[-.5,-.5+k]];
      pts.forEach(([x,y],i) => i ? c.lineTo(cx+x*w, cy+y*h) : c.moveTo(cx+x*w, cy+y*h)); c.closePath(); }
    else if (type === 'triangle'){ c.moveTo(cx, cy-h/2); c.lineTo(cx+w/2, cy+h/2); c.lineTo(cx-w/2, cy+h/2); c.closePath(); }
    else { // capsule · stadium: 둥근 모서리 사각형
      const r = type === 'stadium' ? Math.min(w,h)*.42 : Math.min(w,h)/2;
      const x = cx-w/2, y = cy-h/2; c.moveTo(x+r, y); c.arcTo(x+w, y, x+w, y+h, r); c.arcTo(x+w, y+h, x, y+h, r); c.arcTo(x, y+h, x, y, r); c.arcTo(x, y, x+w, y, r); c.closePath(); }
  }
  // 간판 한 장: 바탕(종이색) + 그래픽 + 이중 테두리. 반환: { canvas, sil(실루엣), frame:{x,y,w,h} }
  // 그래픽 이미지에서 실제로 그려진 부분만 잘라 냄
  function trim(img){
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) if (d[(y*c.width + i)*4 + 3] > 10){ if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0) return img;
    const o = document.createElement('canvas'); o.width = x1-x0+1; o.height = y1-y0+1; o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height); return o;
  }
  function make(id, graphic, H = 1024){
    if (graphic) graphic = trim(graphic);
    const sp = SHAPE[id] || SHAPE.seollem;
    const fh = H*.8, fw = fh*sp.ar;
    // 그래픽 크기: 세로는 테두리에 맞추고, 가로는 조금 넘쳐도 됨(카드처럼)
    let gw = 0, gh = 0;
    if (graphic){ const s = Math.min(fw*1.5/graphic.width, fh*.95/graphic.height); gw = graphic.width*s; gh = graphic.height*s; }
    const W = Math.ceil(Math.max(fw, gw)*1.06), Ht = Math.ceil(Math.max(fh, gh)*1.06);
    const c = document.createElement('canvas'); c.width = W; c.height = Ht; const x = c.getContext('2d');
    const cx = W/2, cy = Ht/2, lw = Math.max(2, H*.0026);
    x.fillStyle = 'rgba(255,252,253,.94)'; path(x, sp.type, cx, cy, fw, fh); x.fill();
    if (graphic) x.drawImage(graphic, cx-gw/2, cy-gh/2, gw, gh);
    x.strokeStyle = 'rgba(40,40,40,.92)'; x.lineWidth = lw; x.lineJoin = 'round';
    path(x, sp.type, cx, cy, fw, fh); x.stroke();
    if (sp.type === 'triangle'){ const k = .88; path(x, sp.type, cx, cy + fh/6*(1-k), fw*k, fh*k); }
    else { const gap = Math.min(fw, fh)*.07; path(x, sp.type, cx, cy, fw - gap, fh - gap); }
    x.stroke();
    const sil = document.createElement('canvas'); sil.width = W; sil.height = Ht; const s = sil.getContext('2d');
    s.fillStyle = '#fff'; path(s, sp.type, cx, cy, fw, fh); s.fill();
    return { canvas: c, sil, frame: { x: (cx-fw/2)/W, y: (cy-fh/2)/Ht, w: fw/W, h: fh/Ht } };
  }
  // 실루엣 위쪽 가장자리 높이 (u: 0~1 가로 위치) → 0~1 (위에서부터)
  function topAt(sil, u){
    const x = Math.round(Math.min(sil.width-1, Math.max(0, u*sil.width)));
    const d = sil.getContext('2d').getImageData(x, 0, 1, sil.height).data;
    for (let y = 0; y < sil.height; y++) if (d[y*4+3] > 128) return y/sil.height;
    return .5;
  }
  return { SHAPE, make, topAt };
})();
