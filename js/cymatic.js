/* Café Breizh — Cymatic-style particle hero (own code).
   Dense WebGL points morph between 10 pastry silhouettes sampled from
   canvas-drawn shapes. Controls: Pulse / Pause Spin / Play Spin,
   form list, Light/Dark. Mouse moves the sculpture. */
(function () {
  var canvas = document.querySelector('[data-cymatic]');
  if (!canvas) return;
  var gl = canvas.getContext('webgl', { antialias: false, alpha: true });
  if (!gl) { document.documentElement.classList.add('no-gl'); return; }

  var mobile = Math.min(innerWidth, innerHeight) < 600;
  var N = mobile ? 8000 : 16000;
  var S = 260, C = S / 2;

  /* ---------- draw each pastry silhouette, sample its pixels ---------- */
  function drawShape(fn) {
    var c = document.createElement('canvas'); c.width = c.height = S;
    var x = c.getContext('2d');
    x.fillStyle = '#fff'; x.strokeStyle = '#fff';
    fn(x);
    var img = x.getImageData(0, 0, S, S).data, pts = [], i, px, py;
    for (i = 0; i < img.length; i += 4) {
      if (img[i + 3] > 120) { px = (i / 4) % S; py = ((i / 4) / S) | 0; pts.push([px, py]); }
    }
    var a = new Float32Array(N * 3), p, dx, dy, d;
    for (i = 0; i < N; i++) {
      p = pts[(Math.random() * pts.length) | 0] || [C, C];
      dx = (p[0] - C) / C; dy = -(p[1] - C) / C;
      d = Math.min(1, Math.hypot(dx, dy) / 0.95);
      a[i*3]   = dx * 1.25;
      a[i*3+1] = dy * 1.25;
      a[i*3+2] = Math.sqrt(Math.max(0, 1 - d * d)) * 0.34 + (Math.random() - 0.5) * 0.05;
    }
    return a;
  }
  function circle(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
  function capsule(x, cx, cy, w, h, rot) {
    x.save(); x.translate(cx, cy); x.rotate(rot);
    x.beginPath();
    if (x.roundRect) x.roundRect(-w/2, -h/2, w, h, h/2); else x.rect(-w/2, -h/2, w, h);
    x.fill(); x.restore();
  }
  var FORMS = [
    ['Croissant', function (x) {
      /* segmented crescent: 7 overlapping rounds along a shallow arc, fat middle, curled tips */
      var seg = [[38,158,17],[62,138,26],[88,124,34],[112,117,40],[130,115,43],[148,117,40],[172,124,34],[198,138,26],[222,158,17]];
      seg.forEach(function (s) { circle(x, s[0], s[1], s[2]); });
    }],
    ['Baguette', function (x) { capsule(x, C, C, 218, 54, -0.62); }],
    ['Eclair', function (x) { capsule(x, C, C, 168, 62, -0.18); }],
    ['Macaron', function (x) { circle(x, C, C, 64); }],
    ['Lemon Tart', function (x) {
      var i; for (i = 0; i < 12; i++) { var t = i / 12 * Math.PI * 2; circle(x, C + Math.cos(t) * 82, C + Math.sin(t) * 82, 17); }
      circle(x, C, C, 84);
    }],
    ['Madeleine', function (x) {
      x.save(); x.translate(C, C); x.scale(0.72, 1); circle(x, 0, 0, 82); x.restore();
    }],
    ['Brioche', function (x) { circle(x, C, C + 22, 64); circle(x, C, C - 52, 27); }],
    ['Galette', function (x) { circle(x, C, C, 92); }],
    ['Mille-Feuille', function (x) { capsule(x, C, C, 178, 112, 0); }],
    ['Chouquette', function (x) {
      var i; for (i = 0; i < 6; i++) { var t = i / 6 * Math.PI * 2; circle(x, C + Math.cos(t) * 46, C + Math.sin(t) * 46, 27); }
      circle(x, C, C, 28);
    }]
  ];
  var forms = FORMS.map(function (f) { return drawShape(f[1]); });

  /* ---------- shaders ---------- */
  var VS = [
    'attribute vec3 aA; attribute vec3 aB; attribute float aRnd;',
    'uniform float uMix, uTime, uSize, uPR, uAspect, uSpin, uPulse, uS;',
    'uniform vec2 uMouse;',
    'varying float vRnd; varying float vY; varying float vZ;',
    'mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,s, 0.,1.,0., -s,0.,c);}',
    'mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0., 0.,c,-s, 0.,s,c);}',
    'void main(){',
    ' float e = uMix*uMix*(3.-2.*uMix);',
    ' vec3 p = mix(aA, aB, e);',
    ' float pl = sin(length(p.xy)*7.0 - uTime*9.0) * 0.10 * uPulse;',
    ' p.z += pl; p.xy += normalize(p.xy + 0.001) * pl * 0.5;',
    ' p.x += sin(uTime*0.8 + aRnd*19.0)*0.012;',
    ' p.y += cos(uTime*0.7 + aRnd*27.0)*0.012;',
    ' p = rotY(uSpin + uMouse.x*0.6) * rotX(uMouse.y*0.35 + 0.12) * p;',
    ' vY = p.y; vZ = p.z; vRnd = aRnd;',
    ' gl_Position = vec4(p.x * uS, p.y * uS * uAspect, 0.0, 1.0);',
    ' gl_PointSize = uSize * uPR * (0.75 + aRnd*0.6) * (1.0 + p.z*0.35);',
    '}'
  ].join('\n');
  var FS = [
    'precision mediump float;',
    'varying float vRnd; varying float vY; varying float vZ;',
    'void main(){',
    ' vec2 d = gl_PointCoord - 0.5;',
    ' float a = smoothstep(0.5, 0.1, length(d));',
    ' vec3 deep = vec3(0.58, 0.25, 0.02);',
    ' vec3 gold = vec3(0.93, 0.55, 0.05);',
    ' vec3 lite = vec3(0.99, 0.78, 0.35);',
    ' vec3 col = mix(deep, gold, clamp(vY*0.9 + 0.55, 0.0, 1.0));',
    ' col = mix(col, lite, clamp(vZ*0.9, 0.0, 1.0) * 0.55);',
    ' if (vRnd > 0.94) col = vec3(0.85, 0.16, 0.05);',
    ' gl_FragColor = vec4(col, a * 0.95);',
    '}'
  ].join('\n');
  function shader(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  var locA = gl.getAttribLocation(prog, 'aA'), locB = gl.getAttribLocation(prog, 'aB'), locR = gl.getAttribLocation(prog, 'aRnd');
  var U = {};
  ['uMix','uTime','uSize','uPR','uAspect','uSpin','uPulse','uMouse','uS'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });

  var rnd = new Float32Array(N), i;
  for (i = 0; i < N; i++) rnd[i] = Math.random();
  function makeBuf(data, loc, size) {
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    return b;
  }
  var bufA = makeBuf(forms[0], locA, 3);
  var bufB = makeBuf(forms[0], locB, 3);
  makeBuf(rnd, locR, 1);
  function setForm(buf, data) { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); }

  /* ---------- state, controls, list ---------- */
  var cur = 0, mix = 0, morphing = false, lastSwitch = performance.now(), lastUser = performance.now() - 20000;
  var spinFactor = 1, spinTarget = 1, pulse = 0;
  var mx = 0, my = 0, tmx = 0, tmy = 0;
  var HOLD = 3000, MORPH = 1900;

  var listBtns = [].slice.call(document.querySelectorAll('[data-form]'));
  function markActive() { listBtns.forEach(function (b, bi) { b.classList.toggle('is-active', bi === cur); }); }
  function goTo(idx, user) {
    if (idx === cur && !user) return;
    cur = idx; morphing = true; mix = 0; lastSwitch = performance.now();
    setForm(bufB, forms[cur]); markActive();
    if (user) lastUser = performance.now();
  }
  listBtns.forEach(function (b, bi) { b.addEventListener('click', function () { goTo(bi, true); pulse = 1; }); });
  markActive();

  function doPulse() { pulse = 1; }
  var pBtn = document.querySelector('[data-pulse]'); if (pBtn) pBtn.addEventListener('click', doPulse);
  canvas.addEventListener('pointerdown', doPulse);
  var pauseBtn = document.querySelector('[data-pause]'), playBtn = document.querySelector('[data-play]');
  function setSpin(on) {
    spinTarget = on ? 1 : 0;
    if (pauseBtn) pauseBtn.classList.toggle('is-off', !on);
    if (playBtn) playBtn.classList.toggle('is-off', on);
  }
  if (pauseBtn) pauseBtn.addEventListener('click', function () {
    var turnOn = spinTarget === 0;
    setSpin(turnOn);
    pauseBtn.innerHTML = turnOn ? 'Pause Spin ❚❚' : 'Play Spin ▷';
  });
  if (playBtn) playBtn.addEventListener('click', function () { setSpin(true); });
  var themeBtn = document.querySelector('[data-theme]');
  if (themeBtn) themeBtn.addEventListener('click', function () { document.body.classList.toggle('dark'); });

  addEventListener('pointermove', function (e) {
    tmx = (e.clientX / innerWidth) * 2 - 1;
    tmy = (e.clientY / innerHeight) * 2 - 1;
  });

  var pr = Math.min(devicePixelRatio || 1, 2);
  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * pr; canvas.height = h * pr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(U.uAspect, w / h);
    gl.uniform1f(U.uS, w / h >= 1 ? 0.60 : 0.82);
    gl.uniform1f(U.uSize, mobile ? 3.1 : 2.3);
    gl.uniform1f(U.uPR, pr);
  }
  addEventListener('resize', resize); resize();

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!morphing && now - lastSwitch > HOLD && now - lastUser > 15000) {
      goTo((cur + 1) % forms.length, false);
    }
    if (morphing) {
      mix = Math.min(1, (now - lastSwitch) / MORPH);
      if (mix >= 1) { morphing = false; mix = 0; lastSwitch = now; setForm(bufA, forms[cur]); setForm(bufB, forms[cur]); }
    }
    spinFactor += (spinTarget - spinFactor) * 0.05;
    var spin = reduced ? 0 : Math.sin(now * 0.00028) * 0.55 * spinFactor;
    pulse *= 0.965;
    mx += (tmx - mx) * 0.045; my += (tmy - my) * 0.045;
    gl.uniform1f(U.uMix, mix);
    gl.uniform1f(U.uTime, now / 1000);
    gl.uniform1f(U.uSpin, spin);
    gl.uniform1f(U.uPulse, pulse);
    gl.uniform2f(U.uMouse, mx, my);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, N);
  }
  requestAnimationFrame(frame);
})();
