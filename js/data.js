// 몽표 — 감정·기억 데이터
window.MP = {
  EMO: [
    { id:'seollem',   name:'설렘',   scene:'새 학기의 첫날',      v:.65, a:.85, time:'future',  m:'원',     r:'잔상',  t:'겹치기',       col:['#FAC2E2','#FBD3A8','#F6B3D3'], bg:['#FFF6F9','#FBE9F0'] },
    { id:'jeulgeoum', name:'즐거움', scene:'토요일의 놀이공원',  v:.90, a:.70, time:'present', m:'원',     r:'잔상',  t:'뾰족하게',     col:['#FBD3A8','#F7C9A0','#F6B3D3'], bg:['#FFF8F1','#FBEBDD'] },
    { id:'huimang',   name:'희망',   scene:'내일의 약속',        v:.55, a:.45, time:'future',  m:'원',     r:'반복',  t:'겹치기',       col:['#C3E8BE','#A8DDA6','#FBD3A8'], bg:['#F7FCF5','#E9F5E6'] },
    { id:'pyeonan',   name:'편안함', scene:'어린 시절의 집',     v:.60, a:.08, time:'present', m:'원',     r:'반복',  t:'작은 원 집합', col:['#F6CFC4','#FBD3A8','#D9C8EE'], bg:['#FFF8F5','#F8ECE7'] },
    { id:'oeroum',    name:'외로움', scene:'아무도 없는 역',     v:-.60,a:.12, time:'present', m:'삼각형', r:'흐리게',t:'비틀기',       col:['#AEB5E1','#B8D8EC','#C9CFE8'], bg:['#F6F7FC','#E8EBF6'] },
    { id:'bunno',     name:'분노',   scene:'풀리지 않는 이해',   v:-.90,a:.95, time:'present', m:'삼각형', r:'충돌',  t:'뾰족하게',     col:['#E5997D','#EE6F5B','#F2C2A8'], bg:['#FFF6F2','#F9E4DC'] },
    { id:'geurium',   name:'그리움', scene:'가장 기다리는 사람', v:-.15,a:.30, time:'past',    m:'비정형', r:'흐리게',t:'겹치기',       col:['#B9C6EE','#A9D6DE','#CDD4F0'], bg:['#F6F8FD','#E8EDF8'] },
    { id:'buran',     name:'불안',   scene:'낯선 도시로의 방문', v:-.55,a:.80, time:'future',  m:'삼각형', r:'충돌',  t:'압축하기',     col:['#B8E7E7','#C3B5E8','#9FD3DA'], bg:['#F4FBFB','#E4F2F3'] }
  ],
  // 기억 오브제 → 가까운 감정
  OBJ: [
    { id:'clock',    name:'자명종',      emo:'seollem' },
    { id:'bear',     name:'곰인형',      emo:'pyeonan' },
    { id:'ferris',   name:'관람차',      emo:'jeulgeoum' },
    { id:'horse',    name:'회전목마 말', emo:'jeulgeoum' },
    { id:'carousel', name:'회전목마',    emo:'jeulgeoum' },
    { id:'keys',     name:'열쇠 꾸러미', emo:'huimang' },
    { id:'door',     name:'나무 문',     emo:'pyeonan' },
    { id:'postbox',  name:'우체통',      emo:'geurium' },
    { id:'phone',    name:'다이얼 전화', emo:'geurium' },
    { id:'frame',    name:'액자',        emo:'geurium' },
    { id:'bench',    name:'벤치',        emo:'oeroum' },
    { id:'train',    name:'지하철',      emo:'oeroum' },
    { id:'station',  name:'역 표지판',   emo:'oeroum' },
    { id:'map',      name:'지도',        emo:'buran' },
    { id:'traffic',  name:'신호등',      emo:'buran' },
    { id:'lock',     name:'자물쇠',      emo:'bunno' }
  ],
  LANDS: [ { id:'field', name:'들판' }, { id:'city', name:'도시' }, { id:'sea', name:'바다' } ],
  emo(id){ return this.EMO.find(e => e.id === id); },
  // 격자 좌표 (20×10): 열 = (정서+1)×10, 행 = (1−각성)×10
  grid(v, a){ return [(v + 1) * 10, (1 - a) * 10]; },
  nearest(v, a){
    let best = null, bd = 1e9; const [c, r] = this.grid(v, a);
    for (const e of this.EMO) { const [c2, r2] = this.grid(e.v, e.a); const d = Math.hypot(c - c2, r - r2); if (d < bd) { bd = d; best = e; } }
    return { e: best, d: bd };
  },
  loadImg(src){ return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(src)); i.src = src; }); }
};
