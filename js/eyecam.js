// 몽표 — 01 카메라로 눈 감기 (선택 기능)
// 카메라 영상에서 얼굴 표정을 읽는 MediaPipe Face Landmarker로 눈 깜빡임 값을 받아, 두 눈을 2초 감고 있으면 꿈으로 들어감
// 카메라를 막는 화면(예: claude.ai 링크 미리보기)에서는 버튼을 눌러도 안내 문구만 뜸
{
  const btn = document.querySelector('#camBtn'), video = document.querySelector('#camView'), msg = document.querySelector('#msg01');
  const VER = '0.10.14', CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
  const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
  const HOLD = 2000, THRESH = .5;
  let running = false;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) btn.hidden = true;
  btn.addEventListener('click', async e => {
    e.stopPropagation(); if (running) return; running = true;
    btn.textContent = '카메라를 켜는 중…';
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false }); }
    catch (err){ btn.textContent = err && err.name === 'NotAllowedError' ? '카메라 권한을 허용해 주세요 (주소창 왼쪽 자물쇠)' : '이 화면에서는 카메라를 쓸 수 없어요'; running = false; return; }
    video.srcObject = stream; video.hidden = false; await video.play().catch(() => {});
    let lm;
    try {
      const { FaceLandmarker, FilesetResolver } = await import(`${CDN}/vision_bundle.mjs`);
      const fs = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
      const opt = d => ({ baseOptions: { modelAssetPath: MODEL, delegate: d }, outputFaceBlendshapes: true, runningMode: 'VIDEO', numFaces: 1 });
      try { lm = await FaceLandmarker.createFromOptions(fs, opt('GPU')); } catch (e1){ lm = await FaceLandmarker.createFromOptions(fs, opt('CPU')); }
    } catch (err){ console.warn('eyecam', err); btn.textContent = '눈 인식을 불러오지 못했어요 · 화면을 길게 눌러 주세요'; stream.getTracks().forEach(t => t.stop()); video.hidden = true; running = false; return; }
    btn.textContent = '눈을 2초 동안 감아 보세요';
    if (msg) msg.textContent = '화면을 길게 누르거나, 눈을 2초 동안 감아 보세요';
    let closedSince = 0, lastT = -1;
    const loop = () => {
      if (window.__eyeDone){ stream.getTracks().forEach(t => t.stop()); video.hidden = true; btn.hidden = true; return; }
      if (video.readyState >= 2 && video.currentTime !== lastT){
        lastT = video.currentTime;
        const r = lm.detectForVideo(video, performance.now());
        const bs = r.faceBlendshapes && r.faceBlendshapes[0] ? r.faceBlendshapes[0].categories : null;
        if (bs){
          const get = n => (bs.find(c => c.categoryName === n) || { score: 0 }).score;
          const closed = get('eyeBlinkLeft') > THRESH && get('eyeBlinkRight') > THRESH;
          const now = performance.now();
          if (closed){ if (!closedSince) closedSince = now; const k = Math.min(1, (now - closedSince)/HOLD); window.__eyeGauge && window.__eyeGauge(k); if (k >= 1){ window.__eyeFinish && window.__eyeFinish(); } }
          else if (closedSince){ closedSince = 0; window.__eyeGauge && window.__eyeGauge(0); }
        }
      }
      requestAnimationFrame(loop);
    };
    loop();
  });
}
