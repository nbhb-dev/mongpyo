// 몽표 — 07 간판 거리: WebGL2 3D 공간 (외부 라이브러리 없음)
// 스크롤 = 앞으로 걷기 · 드래그 = 둘러보기 · 간판 클릭 = 간판 앞으로 다가감
// 건물·보도·가로등·가로수·간판 기둥은 모두 입체(상자)로 세우고, 면마다 빛 방향에 따라 명암을 줌
window.Street = (() => {
  const SLOTS = ['seollem','bunno',null,'geurium','huimang','oeroum','jeulgeoum',null,'buran','pyeonan'];
  const CFG = { end: -190, eye: 4.0, fov: 60, fogDensity: .0078, walk: .00032, step: 17 };
  const FOG = { city:[.9,.9,.9], field:[.92,.92,.92], sea:[.91,.91,.91] };
  const L = (() => { const v = [-.45,.78,.42], n = Math.hypot(...v); return v.map(x => x/n); })();
  let onStep = null, hideSigns = false, gl, canvas, prog, U = {}, T = {}, world = null, run = false, raf = 0, last = 0, walkPhase = 0;
  let P, V, hovered = null, onPick = null, onProgress = null, land = 'city';
  const cam = { prog:0, progT:0, yaw:0, pitch:.04, yawT:0, pitchT:.04, dYaw:0, dPitch:0, mode:'walk', anim:null, pos:[0,4,6] };
  const mouse = { nx:0, ny:0, in:false };

  const VS = `#version 300 es
  layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUV;
  uniform mat4 uP,uV,uM; uniform vec2 uUV,uOff; out vec2 vUV; out float vD; out float vY;
  void main(){ vec4 w = uM * vec4(aPos,1.); vec4 v = uV * w; vD = -v.z; vY = w.y; vUV = aUV * uUV + uOff; gl_Position = uP * v; }`;
  const FS = `#version 300 es
  precision mediump float; in vec2 vUV; in float vD; in float vY;
  uniform sampler2D uT; uniform vec4 uTint; uniform vec3 uFog; uniform float uFogD,uFogK,uFogA,uAO,uCut,uSat; out vec4 o;
  void main(){ vec4 c = texture(uT, vUV) * uTint;
    if (c.a < uCut) discard;
    c.rgb = mix(vec3(dot(c.rgb, vec3(.299,.587,.114))), c.rgb, uSat);
    c.rgb *= 1. - uAO*.42*exp(-max(vY,0.)*.75);
    float f = clamp((1. - exp(-pow(vD*uFogD, 2.))) * uFogK, 0., 1.);
    if (uFogA > .5) c.a *= 1. - f*.9; else c.rgb = mix(c.rgb, uFog, f);
    o = c; }`;

  // ── 행렬 ──
  const M = {
    mul(a,b){ const o=new Array(16); for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;} return o; },
    T:(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1], S:(x,y,z)=>[x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1],
    Ry(a){const c=Math.cos(a),s=Math.sin(a);return[c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1];},
    Rx(a){const c=Math.cos(a),s=Math.sin(a);return[1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1];},
    Rz(a){const c=Math.cos(a),s=Math.sin(a);return[c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1];},
    persp(f,a,n,fa){const t=1/Math.tan(f/2);return[t/a,0,0,0,0,t,0,0,0,0,(fa+n)/(n-fa),-1,0,0,2*fa*n/(n-fa),0];}
  };
  const chain = (...m) => m.reduce((a,b) => M.mul(a,b));
  const model = (x,y,z,ry,sx,sy,rx=0,rz=0) => chain(M.T(x,y,z), M.Ry(ry), M.Rx(rx), M.Rz(rz), M.S(sx,sy,1));
  const flat = -Math.PI/2;

  function init(cv){
    canvas = cv; gl = cv.getContext('webgl2', { antialias:true, premultipliedAlpha:false });
    if (!gl) return false;
    const sh = (t,s) => { const x = gl.createShader(t); gl.shaderSource(x,s); gl.compileShader(x); if(!gl.getShaderParameter(x,gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(x); return x; };
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER,VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER,FS)); gl.linkProgram(prog); gl.useProgram(prog);
    ['uP','uV','uM','uUV','uOff','uT','uTint','uFog','uFogD','uFogK','uFogA','uAO','uCut','uSat'].forEach(n => U[n] = gl.getUniformLocation(prog,n));
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-.5,-.5,0,0,0, .5,-.5,0,1,0, .5,.5,0,1,1, -.5,-.5,0,0,0, .5,.5,0,1,1, -.5,.5,0,0,1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,20,0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,2,gl.FLOAT,false,20,12);
    bindInput();
    return true;
  }

  const aniso = () => gl.getExtension('EXT_texture_filter_anisotropic');
  function tex(src, rep=false){
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    const w = rep ? gl.REPEAT : gl.CLAMP_TO_EDGE; gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,w); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,w);
    const an = aniso(); if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    return t;
  }
  const cv = (w,h,f) => { const c=document.createElement('canvas'); c.width=w; c.height=h; f(c.getContext('2d'),w,h); return c; };
  function noise(c,w,h,base,amp){ const d=c.getImageData(0,0,w,h); for(let i=0;i<d.data.length;i+=4){const v=base+(Math.random()-.5)*amp; d.data[i]=d.data[i+1]=d.data[i+2]=v; d.data[i+3]=255;} c.putImageData(d,0,0); }
  function seeded(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

  // ── 절차적 텍스처 ──
  function shopTex(seed){ const r = seeded(seed);
    return tex(cv(512,256,(c,w,h)=>{
      c.fillStyle = '#3a3836'; c.fillRect(0,0,w,h);
      const n = 2 + Math.floor(r()*2), gw = w/n;
      for (let i = 0; i < n; i++){ const x = i*gw + 14, ww = gw - 28, y = 70, hh = h - 78;
        const g = c.createLinearGradient(0,y,0,y+hh); const warm = r() < .7;
        g.addColorStop(0, warm ? '#f3dcc0' : '#d9dde3'); g.addColorStop(.55, warm ? '#c9a989' : '#9aa1aa'); g.addColorStop(1, '#4a4540');
        c.fillStyle = g; c.fillRect(x,y,ww,hh);
        c.fillStyle = 'rgba(40,38,36,.55)'; for (let k = 0; k < 4; k++) c.fillRect(x + ww*(.15+k*.22), y + hh*.45, ww*.12, hh*.55*(.5+r()*.5));
        c.strokeStyle = '#1f1e1d'; c.lineWidth = 6; c.strokeRect(x,y,ww,hh); c.beginPath(); c.moveTo(x+ww/2,y); c.lineTo(x+ww/2,y+hh); c.stroke(); }
      const aw = r() < .5; c.fillStyle = aw ? '#d9d4cf' : '#2b2928'; c.fillRect(0, 24, w, 34);
      if (aw){ c.fillStyle = '#bdb6b0'; for (let x = 0; x < w; x += 32) c.fillRect(x, 24, 16, 34); }
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0,58,w,8);
    }));
  }
  function makeProcTex(){
    T.asphalt = tex(cv(512,512,(c,w,h)=>{ noise(c,w,h,92,26);
      c.globalAlpha=.08; for(let i=0;i<70;i++){c.fillStyle=Math.random()<.5?'#000':'#fff';c.beginPath();c.ellipse(Math.random()*w,Math.random()*h,4+Math.random()*22,3+Math.random()*12,Math.random()*3,0,7);c.fill();}
      c.globalAlpha=.9; c.fillStyle='#e9e6e0'; c.fillRect(w/2-5,0,10,h*.45); }), true);
    T.pave = tex(cv(256,256,(c,w,h)=>{ noise(c,w,h,176,18); c.strokeStyle='rgba(70,70,70,.35)'; c.lineWidth=2;
      for(let i=0;i<=4;i++){c.beginPath();c.moveTo(0,i*h/4);c.lineTo(w,i*h/4);c.stroke();}
      for(let j=0;j<4;j++) for(let i=0;i<=2;i++){ const x=(i+(j%2)*.5)*w/2; c.beginPath(); c.moveTo(x,j*h/4); c.lineTo(x,(j+1)*h/4); c.stroke(); } }), true);
    T.grass = tex(cv(512,512,(c,w,h)=>{ noise(c,w,h,140,40); c.globalAlpha=.3; for(let i=0;i<1600;i++){ const x=Math.random()*w,y=Math.random()*h; c.strokeStyle=Math.random()<.5?'#3a3a3a':'#e8e8e8'; c.beginPath(); c.moveTo(x,y); c.lineTo(x+(Math.random()-.5)*6,y-6-Math.random()*10); c.stroke(); } }), true);
    T.water = tex(cv(512,512,(c,w,h)=>{ noise(c,w,h,140,26); c.globalAlpha=.4; for(let i=0;i<260;i++){ const y=Math.random()*h, x=Math.random()*w, l=20+Math.random()*80; c.strokeStyle=Math.random()<.6?'#f4f4f4':'#3c3c3c'; c.lineWidth=1+Math.random()*1.5; c.beginPath(); c.moveTo(x,y); c.quadraticCurveTo(x+l/2,y-3,x+l,y); c.stroke(); } }), true);
    T.boards = tex(cv(256,512,(c,w,h)=>{ noise(c,w,h,150,38); c.strokeStyle='rgba(30,30,30,.7)'; c.lineWidth=3; for(let y=0;y<h;y+=32){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();} }), true);
    T.sky = tex(cv(4,256,(c,w,h)=>{ const g=c.createLinearGradient(0,0,0,h); g.addColorStop(0,'#b9b6c2'); g.addColorStop(.55,'#d8d3d6'); g.addColorStop(1,'#ebe3dc'); c.fillStyle=g; c.fillRect(0,0,w,h); }));
    T.leaf = tex(cv(256,256,(c,w,h)=>{ const r = seeded(11); c.clearRect(0,0,w,h);
      for (let i = 0; i < 340; i++){ const a = r()*Math.PI*2, d = Math.sqrt(r())*w*.42, x = w/2 + Math.cos(a)*d, y = h*.48 + Math.sin(a)*d*.86;
        const l = 70 + r()*90 - (y/h)*40; c.fillStyle = `rgb(${l*.92|0},${l|0},${l*.86|0})`; c.beginPath(); c.ellipse(x, y, 5+r()*9, 4+r()*7, r()*3, 0, 7); c.fill(); } }));
    T.white = tex(cv(4,4,c=>{c.fillStyle='#ffffff';c.fillRect(0,0,4,4);}));
    T.glow  = tex(cv(256,256,(c,w)=>{ const g=c.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.4,'rgba(255,255,255,.45)'); g.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle=g; c.fillRect(0,0,w,w); }));
    T.emptyCnv = cv(512,512,(c,w)=>{ c.clearRect(0,0,w,w); const R=w/2-3; c.fillStyle='#FFFCFD'; c.beginPath(); c.arc(w/2,w/2,R,0,7); c.fill();
      c.strokeStyle='#777'; c.lineWidth=3; c.beginPath(); c.arc(w/2,w/2,R,0,7); c.stroke(); c.beginPath(); c.arc(w/2,w/2,R*564/628,0,7); c.stroke(); });
    T.empty = tex(T.emptyCnv);
    T.shops = [shopTex(3), shopTex(8), shopTex(21)];
  }
  // 간판 두께용 실루엣 (흰색)
  function silhouette(src){ return tex(cv(256, Math.round(256*src.height/src.width), (c,w,h) => { c.drawImage(src,0,0,w,h); c.globalCompositeOperation='source-in'; c.fillStyle='#fff'; c.fillRect(0,0,w,h); })); }
  function bubbleTex(img){
    return tex(cv(256,256,(c,w)=>{ const r=w/2-4; const g=c.createRadialGradient(w*.4,w*.35,4,w/2,w/2,r);
      g.addColorStop(0,'rgba(255,255,255,.96)'); g.addColorStop(.6,'rgba(255,255,255,.72)'); g.addColorStop(1,'rgba(248,238,245,.92)');
      c.fillStyle=g; c.beginPath(); c.arc(w/2,w/2,r,0,7); c.fill();
      if (img){ const s=Math.min(150/img.width,150/img.height); c.filter='grayscale(1)'; c.drawImage(img,w/2-img.width*s/2,w/2-img.height*s/2,img.width*s,img.height*s); c.filter='none'; }
      c.strokeStyle='rgba(255,255,255,.95)'; c.lineWidth=3; c.beginPath(); c.arc(w/2,w/2,r,0,7); c.stroke(); }));
  }

  // ── 장면 ──
  async function build(opts){
    land = opts.land || 'city';
    if (!T.white) makeProcTex();
    if (!T.facadeA && opts.city){ for (const k of ['facadeA','facadeB','facadeC','skyline']) T[k] = tex(opts.city[k], k !== 'skyline'); }
    const R = seeded(7), rr = (a,b) => a + R()*(b-a);
    world = { buildings:[], signs:[], bubbles:[], lamps:[], trees:[], posts:[], props:[], towers:[] };
    if (land === 'city'){
      for (const side of [-1,1]){ let z = 18;
        while (z > -320){ const w = rr(12,26), h = rr(18,70), gap = R()<.25 ? rr(3,6) : 0;
          const t = h < 30 ? 'facadeC' : (R()<.5 ? 'facadeA' : 'facadeB');
          world.buildings.push({ side, zc: z - w/2, w, h, t, depth: rr(14,22), shade: rr(.86,1), shop: Math.floor(R()*3), set: R() < .35 ? rr(.6,1.6) : 0 }); z -= w + gap; } }
      for (let z = -4; z > -300; z -= 24) for (const sd of [-1,1]) world.lamps.push({ side: sd, z: z - (sd > 0 ? 12 : 0) });
      // 소품: 볼라드 · 벤치 · 버스 정류장 · 신호등 · 주차된 차 · 먼 고층 건물
      for (let z = 10; z > -300; z -= 6) for (const sd of [-1,1]) world.props.push({ k:'bollard', x: sd*6.9, z: z + (sd>0?3:0) });
      for (let z = -9; z > -300; z -= 31) world.props.push({ k:'bench', x: (Math.round(z)%2 ? 1 : -1)*11.2, z });
      for (const z of [-62, -150, -236]) world.props.push({ k:'shelter', x: (z === -150 ? 1 : -1)*10.4, z });
      for (const z of [-46, -122, -206]){ world.props.push({ k:'cross', z }); for (const sd of [-1,1]) world.props.push({ k:'signal', x: sd*7.1, z: z + sd*3.4 }); }
      for (let z = -20; z > -300; z -= rr(16,30)){ const sd = R() < .5 ? -1 : 1; world.props.push({ k:'car', x: sd*5.2, z, s: rr(.85,1) }); }
      for (let i = 0; i < 54; i++){ const sd = i%2 ? 1 : -1; world.towers.push({ x: sd*rr(34,90), z: rr(-40,-360), w: rr(9,22), h: rr(45,150) }); }
      for (let z = 6; z > -300; z -= rr(7,13)) for (const sd of [-1,1]){ const r = R(); world.props.push({ k: r < .35 ? 'bin' : r < .7 ? 'planter' : 'post', x: sd*rr(7.4,8.2), z: z + rr(-2,2) }); }
      for (let z = -12; z > -300; z -= rr(14,26)) world.props.push({ k:'puddle', x: rr(-5,5), z, w: rr(1.5,3.5), d: rr(1,2.4) });
      for (let z = -10; z > -300; z -= 18) world.props.push({ k:'mist', z });
      for (let z = -30; z > -300; z -= rr(38,60)) world.props.push({ k:'shaft', x: rr(-8,8), z, r: rr(-.35,.35) });
      for (const b of world.buildings){ b.units = []; const n = Math.floor(b.h/7); for (let j = 1; j < n; j++) if (R() < .45) b.units.push([rr(-.4,.4)*b.w, 5 + j*6.5 + rr(-1,1)]); b.awn = R() < .6; }
      for (let z = 4; z > -280; z -= 12) for (const sd of [-1,1]) world.trees.push({ x: sd*10.6, z: z + rr(-1.5,1.5) + (sd>0?6:0), h: rr(6.5,8.5), r: rr(2.3,3.1) });
    } else if (land === 'field'){
      for (let i=0;i<60;i++){ const sd = R()<.5?-1:1; world.trees.push({ x: sd*rr(9,40), z: rr(-260,10), h: rr(6,11), r: rr(2.5,4) }); }
    } else {
      for (let z=8; z>-200; z-=6) world.posts.push(z);
    }
    SLOTS.forEach((id,i) => {
      const side = i%2 ? 1 : -1, z = -14 - i*CFG.step;
      const sg = id && opts.signs ? opts.signs[id] : null, filled = opts.filled && opts.filled[i];
      const s = { slot:i, id, name: id ? MP.emo(id).name : '빈 간판', empty:!id && !filled, filled:!!filled,
        color: id ? MP.emo(id).col[0] : '#E0B7D5', poleX: side*6.2, cy: 6.4, cz: z, ang: -side*.22 };
      s.n = [Math.sin(s.ang),0,Math.cos(s.ang)];
      if (sg) dress(s, sg.canvas, sg.sil, sg.frame);
      else if (filled) dress(s, filled, silCanvas(filled), { x:0, y:0, w:1, h:1 });
      else dress(s, T.emptyCnv, silCanvas(T.emptyCnv), { x:0, y:0, w:1, h:1 });
      world.signs.push(s);
    });
    const mems = opts.memories || [];
    for (let i=0;i<mems.length*3;i++){
      const m = mems[i % mems.length]; const s = world.signs[(i*3) % world.signs.length];
      if (!m.tex) m.tex = bubbleTex(m.img);
      world.bubbles.push({ x: Math.sign(s.poleX)*rr(1.2,5.5), y: rr(2.4,8.6), z: s.cz + (R()<.5?-1:1)*rr(5,8.5), r: rr(.45,1), tex:m.tex, ph: rr(0,6.28) });
    }
    cam.prog = cam.progT = 0; cam.dYaw = 0; cam.dPitch = 0; cam.mode = 'walk'; cam.anim = null;
  }

  // 간판 크기·매달 자리 계산 (테두리 높이 ≈ 4.2m, 줄은 테두리 위쪽 가장자리에 정확히 닿게)
  function silCanvas(img){ const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d');
    x.drawImage(img,0,0); x.globalCompositeOperation='source-in'; x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height); return c; }
  function dress(s, cnv, sil, fr){
    const asp = cnv ? cnv.width/cnv.height : 1;
    let h = 4.2/fr.h, w = h*asp; const fwm = w*fr.w; if (fwm > 6){ const k = 6/fwm; h *= k; w *= k; }
    s.w = w; s.h = h; s.src = cnv; s.tex = cnv ? tex(cnv) : T.empty; s.sil = sil ? tex(sil) : T.empty;
    const sd = Math.sign(s.poleX), frameW = w*fr.w, frameCx = (fr.x + fr.w/2 - .5)*w;
    s.cx = s.poleX - sd*(frameW/2 + .45) - frameCx;
    // 줄 두 개: 테두리 가로 30% 지점, 그 위치의 위쪽 가장자리 높이
    s.hooks = [-.3, .3].map(k => { const u = fr.x + fr.w*(.5 + k); const top = sil ? Signs.topAt(sil, u) : fr.y; return { lx: (u - .5)*w, y: s.cy + h/2 - top*h }; });
    s.frameTop = s.cy + h/2 - fr.y*h;
  }

  // ── 그리기 도구 ──
  function hexRGB(h){ const n=parseInt(h.slice(1),16); return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]; }
  let cut = 0, ao = 0;
  function draw(t, m, tint=[1,1,1,1], uv=[1,1], fogK=1, off=[0,0]){
    gl.bindTexture(gl.TEXTURE_2D,t); gl.uniformMatrix4fv(U.uM,false,m); gl.uniform4fv(U.uTint,tint); gl.uniform2fv(U.uUV,uv); gl.uniform2fv(U.uOff,off); gl.uniform1f(U.uFogK,fogK);
    gl.drawArrays(gl.TRIANGLES,0,6);
  }
  const setCut = v => { if (v !== cut){ cut = v; gl.uniform1f(U.uCut, v); } };
  const setAO = v => { if (v !== ao){ ao = v; gl.uniform1f(U.uAO, v); } };
  const lit = (nx,nz,ny=0) => .5 + .5*Math.max(0, nx*L[0] + ny*L[1] + nz*L[2]);
  // 상자: 중심 (x,y,z), 크기 (sx,sy,sz), y축 회전 ry. faces 텍스처/색, uvFn(면 가로, 세로) → uv 반복
  function box(x,y,z,sx,sy,sz,ry,col,tx=T.white,uvFn=null,top=true){
    const c = Math.cos(ry), s = Math.sin(ry), base = chain(M.T(x,y,z), M.Ry(ry));
    const faces = [ [0,0,sz/2, 0, sx, [ s, c]], [0,0,-sz/2, Math.PI, sx, [-s,-c]], [sx/2,0,0, Math.PI/2, sz, [ c,-s]], [-sx/2,0,0, -Math.PI/2, sz, [-c, s]] ];
    for (const [fx,fy,fz,fr,fw,[nx,nz]] of faces){ const k = lit(nx,nz);
      draw(tx, chain(base, M.T(fx,fy,fz), M.Ry(fr), M.S(fw,sy,1)), [col[0]*k,col[1]*k,col[2]*k,1], uvFn ? uvFn(fw,sy) : [1,1]); }
    if (top){ const k = lit(0,0,1); draw(T.white, chain(base, M.T(0,sy/2,0), M.Rx(flat), M.S(sx,sz,1)), [col[0]*k*.92,col[1]*k*.92,col[2]*k*.92,1]); }
  }
  const vd = (x,y,z) => -(V[2]*x + V[6]*y + V[10]*z + V[14]);
  const pathPos = p => [Math.sin(p*9)*.3, CFG.eye, 6 + (CFG.end-6)*p];
  const ease = t => t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2;

  function updateCam(dt){
    if (cam.mode === 'walk'){
      const before = cam.prog; cam.prog += (cam.progT-cam.prog)*.06; const ph0 = walkPhase; walkPhase += Math.abs(cam.prog - before)*900;
      if (onStep && Math.floor(walkPhase/Math.PI) !== Math.floor(ph0/Math.PI)) onStep();
      const p = pathPos(cam.prog); p[1] += Math.sin(walkPhase)*.06; cam.pos = p;
      cam.yawT = cam.dYaw - mouse.nx*.08; cam.pitchT = .04 + cam.dPitch - mouse.ny*.04;
    } else if (cam.anim){
      const a = cam.anim; a.t = Math.min(1, a.t + dt/a.dur); const k = ease(a.t);
      cam.pos = a.from.pos.map((v,i) => v + (a.to.pos[i]-v)*k);
      cam.yawT = a.from.yaw + (a.to.yaw-a.from.yaw)*k; cam.pitchT = a.from.pitch + (a.to.pitch-a.from.pitch)*k;
      if (a.t >= 1){ const d = a.done; cam.anim = null; d && d(); }
    }
    const s = cam.mode === 'walk' ? .08 : .3;
    cam.yaw += (cam.yawT-cam.yaw)*s; cam.pitch += (cam.pitchT-cam.pitch)*s;
  }

  function render(t){
    const W = canvas.width, H = canvas.height, fog = FOG[land];
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0,0,W,H); gl.clearColor(...fog,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    P = M.persp(CFG.fov*Math.PI/180, W/H, .1, 700);
    V = chain(M.Rx(-cam.pitch), M.Ry(-cam.yaw), M.T(-cam.pos[0],-cam.pos[1],-cam.pos[2]));
    gl.uniformMatrix4fv(U.uP,false,P); gl.uniformMatrix4fv(U.uV,false,V); gl.uniform3fv(U.uFog,fog); gl.uniform1f(U.uFogD,CFG.fogDensity);
    gl.uniform1f(U.uFogA, 0); cut = -1; ao = -1; setCut(0); setAO(0); gl.uniform1f(U.uSat, 0);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(true);
    const w = world, pz = cam.pos[2], near = z => z < pz + 30 && z > pz - 330;

    // 하늘
    draw(T.sky, model(cam.pos[0],120,pz-520,0,1600,420),[1,1,1,1],[1,1],0);
    if (land === 'city'){
      draw(T.skyline, model(0,56,-340,0,240,240), [.92,.92,.95,1],[1,1],.5);
      // 도로 · 보도(턱이 있는 상자) · 횡단보도
      draw(T.asphalt, model(0,0,-150,0,13,360,flat), [1,1,1,1],[1,24]);
      for (const sx of [-1,1]){
        box(sx*9.6,.1,-150,6.2,.2,360,0,[.82,.81,.8],T.pave,(fw,fh)=>[fw/3,fh/3],false);
        draw(T.pave, model(sx*9.6,.201,-150,0,6.2,360,flat),[.95,.94,.93,1],[2,120]);
        box(sx*6.55,.12,-150,.2,.24,360,0,[.9,.9,.89],T.white,null,true);
      }
      for (const t of w.towers){ if (!near(t.z)) continue; box(t.x, t.h/2, t.z, t.w, t.h, t.w, 0, [.8,.8,.8], T[t.h > 90 ? 'facadeA' : 'facadeB'], (fw,fh)=>[fw/13, fh/26], true); }
      const close = z => z < pz + 25 && z > pz - 140;
      for (const p of w.props){
        if (p.k === 'cross'){ if (!near(p.z)) continue; for (let k=0;k<7;k++) draw(T.white, model(-5.4+k*1.8,.01,p.z,0,.95,4.4,flat),[.92,.91,.9,1]); continue; }
        if (!close(p.z)) continue;
        if (p.k === 'bollard') box(p.x,.45,p.z,.18,.9,.18,0,[.42,.42,.42]);
        else if (p.k === 'bench'){ const sd = Math.sign(p.x); box(p.x,.48,p.z,.5,.08,2,0,[.5,.5,.5]); box(p.x + sd*.22,.85,p.z,.08,.6,2,0,[.5,.5,.5]);
          for (const dz of [-.85,.85]) box(p.x,.24,p.z+dz,.45,.48,.08,0,[.3,.3,.3]); }
        else if (p.k === 'shelter'){ const sd = Math.sign(p.x); box(p.x,2.7,p.z,2.2,.15,5,0,[.55,.55,.55]); for (const dz of [-2.3,2.3]) box(p.x+sd*.9,1.35,p.z+dz,.12,2.7,.12,0,[.35,.35,.35]);
          box(p.x+sd*1,1.4,p.z,.06,2.4,4.4,0,[.88,.88,.88]); box(p.x,.5,p.z,.45,.08,3,0,[.45,.45,.45]); }
        else if (p.k === 'signal'){ const sd = Math.sign(p.x); box(p.x,2.4,p.z,.16,4.8,.16,0,[.3,.3,.3]); box(p.x - sd*1.2,4.7,p.z,2.4,.12,.12,0,[.3,.3,.3]);
          box(p.x - sd*2.2,4.3,p.z,.35,.9,.3,0,[.22,.22,.22]); }
        else if (p.k === 'bin'){ box(p.x,.5,p.z,.6,1,.6,0,[.38,.38,.39]); box(p.x,1.03,p.z,.66,.08,.66,0,[.3,.3,.3]); }
        else if (p.k === 'planter'){ box(p.x,.35,p.z,1.1,.7,1.1,0,[.6,.6,.6]); setCut(.5); draw(T.leaf, model(p.x,1.1,p.z,cam.yaw,1.4,1.1),[1,1,1,1]); setCut(0); }
        else if (p.k === 'post'){ box(p.x,1.2,p.z,.1,2.4,.1,0,[.35,.35,.35]); box(p.x,2.3,p.z,.06,.5,.7,0,[.85,.85,.85]); }
        else if (p.k === 'car'){ const s = p.s; box(p.x,.55*s,p.z,1.8*s,.75*s,4.2*s,0,[.55*s,.55*s,.56*s]); box(p.x,1.15*s,p.z+.2,1.6*s,.6*s,2.2*s,0,[.32,.32,.33]);
          for (const dz of [-1.35,1.35]) for (const dx of [-.92,.92]) box(p.x+dx*s,.3,p.z+dz*s,.22,.6,.6,0,[.15,.15,.15]); }
      }
      // 건물: 상자 + 처마 + 1층 가게
      setAO(1);
      for (const b of w.buildings){ if (!near(b.zc)) continue;
        const fx = b.side*(12.7 + b.set + b.depth/2), s = b.shade, col = [s,s,s*.99];
        box(fx, b.h/2, b.zc, b.depth, b.h, b.w, 0, col, T[b.t], (fw,fh)=>[fw/13, fh/26], true);
        box(fx - b.side*.15, b.h + .35, b.zc, b.depth + .7, .7, b.w + .5, 0, [.62,.62,.63]);
        const face = b.side*(12.7 + b.set) - b.side*.06;
        draw(T.shops[b.shop], model(face, 2.3, b.zc, b.side<0?Math.PI/2:-Math.PI/2, b.w*.96, 4.6), [1,1,1,1]);
        if (b.zc < pz + 25 && b.zc > pz - 150){
          if (b.awn) box(face - b.side*.9, 4.85, b.zc, 1.8, .14, b.w*.9, 0, [.7,.7,.7]);
          box(face - b.side*.08, 5.4, b.zc, .16, .5, b.w*.98, 0, [.48,.48,.49]);   // 1층 띠
          for (const [dz, y] of b.units) box(face - b.side*.35, y, b.zc + dz, .7, .55, 1, 0, [.62,.62,.62]); // 실외기
        }
      }
      setAO(0);
      // 가로등
      for (const l of w.lamps){ if (!near(l.z)) continue; const x = l.side*7.2;
        box(x,3.8,l.z,.18,7.6,.18,0,[.33,.33,.34]); box(x,.25,l.z,.45,.5,.45,0,[.3,.3,.31]);
        box(x - l.side*.9,7.55,l.z,1.8,.12,.14,0,[.33,.33,.34]); box(x - l.side*1.7,7.42,l.z,.55,.2,.32,0,[.28,.28,.29]); }
      // 가로수 줄기
      for (const tr of w.trees){ if (!near(tr.z)) continue; box(tr.x, tr.h*.3, tr.z, .32, tr.h*.6, .32, 0, [.36,.34,.32]); }
    } else if (land === 'field'){
      draw(T.grass, model(0,0,-140,0,300,330,flat),[.95,.95,.95,1],[24,26]);
      for (const tr of w.trees) box(tr.x, tr.h*.3, tr.z, .35, tr.h*.6, .35, 0, [.36,.34,.32]);
    } else {
      draw(T.water, model(0,-.4,-150,0,500,400,flat),[1,1,1,1],[20,16],1,[t*.000012, t*.00003]);
      box(0,.05,-95,4,.3,210,0,[.75,.73,.7],T.boards,(fw,fh)=>[1,fh/2]);
      for (const z of w.posts) for (const sx of [-1,1]) box(sx*2.05,.6,z,.22,1.6,.22,0,[.4,.4,.4]);
    }

    // 간판: 기둥 · 받침 · 팔 · 사슬 · 두께
    for (const s of (hideSigns ? [] : w.signs)){ if (!near(s.cz)) continue;
      const sd = Math.sign(s.poleX), top = s.frameTop, armY = top + .7, far = Math.max(...s.hooks.map(k => -sd*k.lx)), armEnd = s.cx - sd*(far + .35);
      const metal = [.93,.92,.92];
      box(s.poleX, (armY+.4)/2, s.cz, .3, armY+.4, .3, 0, metal);
      box(s.poleX, .2, s.cz, .8, .4, .8, 0, [.8,.79,.79]);
      box(s.poleX, armY+.5, s.cz, .42, .2, .42, 0, metal);
      const ax = (s.poleX+armEnd)/2, al = Math.abs(s.poleX-armEnd);
      box(ax, armY, s.cz, al, .22, .22, s.ang, metal);
      box(s.poleX - sd*.55, armY - .45, s.cz, .7, .08, .08, s.ang, [.8,.8,.8]); // 받침대
      for (const hk of s.hooks){ const hx = s.cx + hk.lx*Math.cos(s.ang), hz = s.cz - hk.lx*Math.sin(s.ang), len = armY - hk.y + .02;
        box(hx, hk.y + len/2, hz, .045, len, .045, s.ang, [.62,.62,.63], T.white, null, false);
        box(hx, hk.y + .04, hz, .12, .08, .12, s.ang, [.62,.62,.63]); }
    }
    // 간판 두께 (실루엣을 겹쳐 쌓음)
    setCut(.5);
    for (const s of (hideSigns ? [] : w.signs)){ if (!near(s.cz)) continue;
      const sway = 0;
      for (let i = 0; i < 7; i++){ const d = -.2 + i*.03, k = .74 + i*.03;
        draw(s.sil, model(s.cx + s.n[0]*d, s.cy, s.cz + s.n[2]*d, s.ang+sway, s.w, s.h), [k,k,k*1.01,1], [1,1], .6); }
    }
    // 나뭇잎 (교차한 두 면)
    for (const tr of w.trees){ if (land === 'sea' || !near(tr.z)) continue; const y = tr.h*.72;
      for (const r of [0, Math.PI/2]) draw(T.leaf, model(tr.x, y, tr.z, r + .3, tr.r*2, tr.r*1.8), [1,1,1,1]); }
    setCut(0);

    // ── 반투명·빛 (뒤에서 앞으로) ──
    gl.enable(gl.BLEND); gl.depthMask(false); gl.uniform1f(U.uFogA, 1);
    const list = [];
    const add = (d, f, blend, sat) => list.push({ d, f, blend, sat });
    // 그림자 얼룩
    for (const tr of w.trees){ if (!near(tr.z)) continue; add(9e3, () => draw(T.glow, model(tr.x,.22,tr.z,0,tr.r*2.4,tr.r*2.4,flat),[0,0,0,.28]), 0); }
    for (const s of (hideSigns ? [] : w.signs)){ if (!near(s.cz)) continue; add(9e3, () => draw(T.glow, model(s.poleX,.02,s.cz,0,2.4,2.4,flat),[0,0,0,.3]), 0);
      add(9e3-1, () => draw(T.glow, model(s.cx,.03,s.cz,0,s.w*1.3,1.8,flat),[0,0,0,.22]), 0); }
    for (const p of w.props){ if (!near(p.z)) continue;
      if (p.k === 'mist') add(vd(0,.8,p.z), () => draw(T.glow, model(0,.9,p.z,0,40,3.2),[1,1,1,.16],[1,1],.4), 1);
      else if (p.k === 'shaft') add(vd(p.x,14,p.z), () => draw(T.glow, model(p.x,14,p.z,cam.yaw,5,36,0,p.r),[1,.98,.99,.22],[1,1],.5), 1);
      else if (p.k === 'puddle') add(9e3-.5, () => draw(T.glow, model(p.x,.02,p.z,0,p.w,p.d,flat),[.97,.97,1,.35]), 1);
    }
    // 전깃줄 (가로등 사이를 늘어져 잇는 선)
    for (const l of w.lamps){ if (l.side > 0 || !near(l.z)) continue; const z = l.z, y0 = 7.5;
      for (let k = 0; k < 6; k++){ const u0 = k/6, u1 = (k+1)/6, xa = -7.2 + u0*14.4, xb = -7.2 + u1*14.4, sag = t => y0 - Math.sin(t*Math.PI)*.9;
        const xm = (xa+xb)/2, ym = (sag(u0)+sag(u1))/2, ang = Math.atan2(sag(u1)-sag(u0), xb-xa);
        add(vd(xm,ym,z), () => draw(T.white, model(xm,ym,z,0,(xb-xa)*1.02,.035,0,ang),[.25,.25,.25,.85]), 0); } }
    // 가로등 빛
    for (const l of w.lamps){ if (!near(l.z)) continue; const x = l.side*7.2 - l.side*1.7;
      add(vd(x,7.3,l.z), () => draw(T.glow, model(x,7.25,l.z,cam.yaw,2.2,2.2),[1,.88,.7,.9]), 1);
      add(9e3-2, () => draw(T.glow, model(x,.23,l.z,0,6,6,flat),[1,.9,.75,.35]), 1); }
    // 간판: 감정 색 빛 + 앞면 그래픽
    for (const s of (hideSigns ? [] : w.signs)){ if (!near(s.cz)) continue;
      const hot = hovered === s ? 1 : 0, c = hexRGB(s.color), k = 1 + hot*.03, sway = 0;
      if (!s.empty){
        add(9e3-3, () => draw(T.glow, model(s.cx,.25,s.cz+1,0,s.w*2.4,s.w*2,flat),[...c,.55+hot*.3]), 1, 1);
        add(vd(s.cx,s.cy,s.cz)+.5, () => draw(T.glow, model(s.cx - s.n[0]*.3,s.cy,s.cz - s.n[2]*.3,s.ang,s.w*2,s.h*2),[...c,.35+hot*.3]), 1, 1);
      }
      add(vd(s.cx,s.cy,s.cz)-.01, () => draw(s.tex, model(s.cx + s.n[0]*.012, s.cy, s.cz + s.n[2]*.012, s.ang+sway, s.w*k, s.h*k),[1,1,1,1],[1,1],.35), 0, 1);
    }
    for (const b of (hideSigns ? [] : w.bubbles)){ if (!near(b.z)) continue;
      const y = b.y + Math.sin(t*.0006+b.ph)*.35, x = b.x + Math.cos(t*.0004+b.ph)*.3;
      add(vd(x,y,b.z), () => draw(b.tex, model(x,y,b.z,cam.yaw,b.r*2,b.r*2),[1,1,1,.9],[1,1],.8), 0);
    }
    list.sort((a,b) => b.d - a.d).forEach(o => { gl.uniform1f(U.uSat, o.sat ? 1 : 0); gl.blendFunc(gl.SRC_ALPHA, o.blend ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); o.f(); });
    gl.depthMask(true); gl.disable(gl.BLEND);
  }

  // ── 고르기 ──
  function pick(){
    if (!mouse.in || cam.mode !== 'walk') return null;
    const r = canvas.getBoundingClientRect(), asp = r.width/r.height, th = Math.tan(CFG.fov*Math.PI/360);
    const dx = mouse.nx*th*asp, dy = -mouse.ny*th, dz = -1;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const ex = dx, ey = cp*dy - sp*dz, ez = sp*dy + cp*dz;
    const d = [cy*ex + sy*ez, ey, -sy*ex + cy*ez];
    let best = null, bt = 1e9;
    for (const s of world.signs){
      const n = s.n, o = cam.pos; const den = d[0]*n[0]+d[1]*n[1]+d[2]*n[2]; if (Math.abs(den) < 1e-4) continue;
      const tt = ((s.cx-o[0])*n[0]+(s.cy-o[1])*n[1]+(s.cz-o[2])*n[2]) / den; if (tt <= 0) continue;
      const px = o[0]+d[0]*tt-s.cx, py = o[1]+d[1]*tt-s.cy, pz = o[2]+d[2]*tt-s.cz;
      const lx = px*Math.cos(s.ang) - pz*Math.sin(s.ang);
      if (Math.abs(lx) < s.w/2 && Math.abs(py) < s.h/2 && tt < bt){ bt = tt; best = s; }
    }
    return best && bt < 70 ? best : null;
  }
  function project(x,y,z){ const m = M.mul(P,V); const cx=m[0]*x+m[4]*y+m[8]*z+m[12], cy=m[1]*x+m[5]*y+m[9]*z+m[13], w=m[3]*x+m[7]*y+m[11]*z+m[15];
    return w <= 0 ? null : [(cx/w*.5+.5)*100, (1-(cy/w*.5+.5))*100]; }
  function approach(s, done){
    const from = { pos: cam.pos.slice(), yaw: cam.yaw, pitch: cam.pitch };
    cam.back = from; cam.mode = 'anim'; hovered = null;
    const dist = Math.max(4.2, s.h*1.05);
    const to = [s.cx + s.n[0]*dist, s.cy - .15, s.cz + s.n[2]*dist];
    cam.anim = { t:0, dur:1.5, from, to:{ pos:to, yaw:Math.atan2(s.n[0], s.n[2]), pitch:.02 }, done };
  }
  function retreat(done){
    if (!cam.back){ cam.mode='walk'; done && done(); return; }
    const from = { pos: cam.pos.slice(), yaw: cam.yaw, pitch: cam.pitch };
    cam.mode = 'anim'; cam.anim = { t:0, dur:1.1, from, to: cam.back, done:()=>{ cam.mode='walk'; done && done(); } };
  }
  // ── 입력 ──
  let drag = null;
  function bindInput(){
    canvas.addEventListener('pointerdown', e => { drag = { x:e.clientX, y:e.clientY, yaw:cam.dYaw, pitch:cam.dPitch, moved:0 }; canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag'); });
    canvas.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect();
      mouse.nx = ((e.clientX-r.left)/r.width)*2-1; mouse.ny = ((e.clientY-r.top)/r.height)*2-1; mouse.in = true;
      if (drag){ const dx=e.clientX-drag.x, dy=e.clientY-drag.y; drag.moved=Math.max(drag.moved,Math.hypot(dx,dy));
        cam.dYaw = Math.max(-1.2,Math.min(1.2,drag.yaw+dx*.004)); cam.dPitch = Math.max(-.3,Math.min(.45,drag.pitch+dy*.003)); } });
    canvas.addEventListener('pointerup', () => { canvas.classList.remove('drag'); const click = drag && drag.moved < 6; drag = null;
      if (click && hovered && onPick){ const s = hovered; approach(s, () => onPick(s)); } });
    canvas.addEventListener('pointerleave', () => { mouse.in = false; });
    canvas.addEventListener('wheel', e => { e.preventDefault(); if (cam.mode!=='walk') return; cam.progT = Math.max(0,Math.min(1,cam.progT + e.deltaY*CFG.walk)); }, { passive:false });
    window.addEventListener('keydown', e => { if (!run || cam.mode!=='walk') return;
      if (e.key==='ArrowUp'||e.key==='w') cam.progT=Math.min(1,cam.progT+.02); if (e.key==='ArrowDown'||e.key==='s') cam.progT=Math.max(0,cam.progT-.02); });
    let touchY = null;
    canvas.addEventListener('touchstart', e => { if (e.touches.length===2) touchY = e.touches[0].clientY; }, { passive:true });
    canvas.addEventListener('touchmove', e => { if (e.touches.length===2 && touchY!=null){ const dy = touchY-e.touches[0].clientY; touchY = e.touches[0].clientY; cam.progT=Math.max(0,Math.min(1,cam.progT+dy*.0012)); } }, { passive:true });
  }
  function resize(){ const dpr = Math.min(2, devicePixelRatio||1), r = canvas.getBoundingClientRect(); canvas.width = Math.round(r.width*dpr); canvas.height = Math.round(r.height*dpr); }
  function loop(t){
    if (!run) return;
    const dt = Math.min(.1,(t-last)/1000 || .016); last = t;
    if (canvas.width !== Math.round(canvas.clientWidth*Math.min(2,devicePixelRatio||1))) resize();
    updateCam(dt); render(t);
    hovered = pick();
    if (onProgress) onProgress({ hovered, pos:cam.pos, signs:world.signs, project });
    raf = requestAnimationFrame(loop);
  }
  function approachNearest(){ if (!world || cam.mode!=='walk') return; const z = cam.pos[2];
    const s = world.signs.filter(s => s.cz < z - 2).sort((a,b) => b.cz - a.cz)[0]; if (s && onPick) approach(s, () => onPick(s)); }
  function start(){ if (run) return; run = true; resize(); last = performance.now(); raf = requestAnimationFrame(loop); }
  function stop(){ run = false; cancelAnimationFrame(raf); }
  function setFilled(slot, img){ const s = world && world.signs[slot]; if (!s) return;
    dress(s, img, silCanvas(img), { x:0, y:0, w:1, h:1 }); s.empty = false; s.filled = true; s.color = '#E0B7D5'; }
  function setHideSigns(v){ hideSigns = !!v; }
  return { setHideSigns, init, build, start, stop, retreat, setFilled, approachNearest, SLOTS,
    set onPick(f){ onPick = f; }, set onStep(f){ onStep = f; }, set onProgress(f){ onProgress = f; },
    get mode(){ return cam.mode; }, get world(){ return world; } };
})();
