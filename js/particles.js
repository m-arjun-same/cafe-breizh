/* Café Breizh — own WebGL particle hero (sample).
   Particles morph between forms: sphere → ring → star → B → crescent.
   Raw WebGL1 points, no library. Mouse parallax like the reference hero. */
(function () {
  var canvas = document.querySelector('[data-particles]');
  if (!canvas) return;
  var gl = canvas.getContext('webgl', { antialias: false, alpha: true });
  if (!gl) { document.documentElement.classList.add('no-gl'); return; }

  var mobile = Math.min(innerWidth, innerHeight) < 600;
  var N = mobile ? 4200 : 9000;

  /* ---------- form generators (each returns Float32Array of xyz) ---------- */
  function sphere() {
    var a = new Float32Array(N * 3), i, u, v, t, r = 1.05;
    for (i = 0; i < N; i++) {
      u = Math.random(); v = Math.random();
      t = 2 * Math.PI * u; var p = Math.acos(2 * v - 1);
      a[i*3]   = r * Math.sin(p) * Math.cos(t);
      a[i*3+1] = r * Math.cos(p) * 0.92;
      a[i*3+2] = r * Math.sin(p) * Math.sin(t);
    } return a;
  }
  function ring() {
    var a = new Float32Array(N * 3), i, t, R = 1.12, rr;
    for (i = 0; i < N; i++) {
      t = Math.random() * Math.PI * 2;
      rr = R + (Math.random() - 0.5) * 0.30;
      a[i*3]   = rr * Math.cos(t);
      a[i*3+1] = rr * Math.sin(t) * 0.92 + (Math.random() - 0.5) * 0.10;
      a[i*3+2] = (Math.random() - 0.5) * 0.22;
    } return a;
  }
  function star() {
    var a = new Float32Array(N * 3), i, t, k, r;
    for (i = 0; i < N; i++) {
      t = Math.random() * Math.PI * 2;
      k = 0.62 + 0.38 * Math.abs(Math.cos(t * 2.5 + Math.PI / 2));
      r = (0.35 + Math.random() * 0.85) * k;
      a[i*3]   = r * Math.cos(t) * 1.15;
      a[i*3+1] = r * Math.sin(t);
      a[i*3+2] = (Math.random() - 0.5) * 0.18;
    } return a;
  }
  function crescent() {
    var a = new Float32Array(N * 3), i, t, r, x, y, d;
    for (i = 0; i < N; i++) {
      do {
        t = Math.random() * Math.PI * 2;
        r = 0.25 + Math.random() * 0.95;
        x = r * Math.cos(t); y = r * Math.sin(t);
        d = Math.hypot(x - 0.55, y - 0.28);
      } while (d < 0.78);
      a[i*3] = x * 1.1; a[i*3+1] = y; a[i*3+2] = (Math.random() - 0.5) * 0.18;
    } return a;
  }
  function letterB() {
    var c = document.createElement('canvas'); c.width = 220; c.height = 220;
    var x = c.getContext('2d');
    x.fillStyle = '#fff'; x.font = '900 190px Archivo, Arial, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('B', 110, 118);
    var img = x.getImageData(0, 0, 220, 220).data, pts = [], i;
    for (i = 0; i < img.length; i += 4) {
      if (img[i + 3] > 120) {
        var px = (i / 4) % 220, py = Math.floor(i / 4 / 220);
        pts.push([(px - 110) / 88, -(py - 110) / 88]);
      }
    }
    var a = new Float32Array(N * 3);
    for (i = 0; i < N; i++) {
      var p = pts[(Math.random() * pts.length) | 0] || [0, 0];
      a[i*3] = p[0]; a[i*3+1] = p[1]; a[i*3+2] = (Math.random() - 0.5) * 0.14;
    } return a;
  }

  var forms = [sphere(), ring(), star(), letterB(), crescent()];
  var names = ['Sphere', 'Ring', 'Star', 'B', 'Crescent'];
  var label = document.querySelector('[data-form-name]');

  /* ---------- shaders ---------- */
  var VS = [
    'attribute vec3 aA; attribute vec3 aB; attribute float aRnd;',
    'uniform float uMix, uTime, uSize, uPixelRatio;',
    'uniform vec2 uMouse;',
    'varying float vRnd; varying float vZ;',
    'mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,s, 0.,1.,0., -s,0.,c);}',
    'mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0., 0.,c,-s, 0.,s,c);}',
    'void main(){',
    ' float e = uMix*uMix*(3.-2.*uMix);',
    ' vec3 p = mix(aA, aB, e);',
    ' p.x += sin(uTime*0.7 + aRnd*17.0)*0.018;',
    ' p.y += cos(uTime*0.6 + aRnd*23.0)*0.018;',
    ' p = rotY(uTime*0.12 + uMouse.x*0.55) * rotX(uMouse.y*0.35 + sin(uTime*0.2)*0.08) * p;',
    ' vec4 mv = vec4(p, 1.0); mv.z -= 3.1;',
    ' gl_Position = vec4(mv.x * 0.62, mv.y * 0.62 * uAspectFix, mv.z * 0.3, 1.0);',
    ' vZ = p.z; vRnd = aRnd;',
    ' gl_PointSize = uSize * uPixelRatio * (0.7 + aRnd*0.7) * (1.0 + p.z*0.25);',
    '}'
  ].join('\n').replace('uAspectFix', 'uAspect');
  VS = VS.replace('uniform vec2 uMouse;', 'uniform vec2 uMouse; uniform float uAspect;');
  var FS = [
    'precision mediump float;',
    'varying float vRnd; varying float vZ;',
    'void main(){',
    ' vec2 d = gl_PointCoord - 0.5;',
    ' float a = smoothstep(0.5, 0.08, length(d));',
    ' vec3 jaune = vec3(0.996, 0.725, 0.078);',
    ' vec3 creme = vec3(0.937, 0.937, 0.890);',
    ' vec3 orange = vec3(0.941, 0.220, 0.071);',
    ' vec3 col = vRnd < 0.62 ? jaune : (vRnd < 0.88 ? creme : orange);',
    ' col *= 0.82 + vZ * 0.28;',
    ' gl_FragColor = vec4(col, a * 0.92);',
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

  var locA = gl.getAttribLocation(prog, 'aA');
  var locB = gl.getAttribLocation(prog, 'aB');
  var locR = gl.getAttribLocation(prog, 'aRnd');
  var uMix = gl.getUniformLocation(prog, 'uMix');
  var uTime = gl.getUniformLocation(prog, 'uTime');
  var uSize = gl.getUniformLocation(prog, 'uSize');
  var uPR = gl.getUniformLocation(prog, 'uPixelRatio');
  var uMouse = gl.getUniformLocation(prog, 'uMouse');
  var uAspect = gl.getUniformLocation(prog, 'uAspect');

  var rnd = new Float32Array(N);
  for (var i = 0; i < N; i++) rnd[i] = Math.random();
  function makeBuf(data, loc, size) {
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    return b;
  }
  var bufA = makeBuf(forms[0], locA, 3);
  var bufB = makeBuf(forms[1], locB, 3);
  makeBuf(rnd, locR, 1);
  function setForm(buf, data) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }

  /* ---------- cycle + interaction ---------- */
  var cur = 0, mix = 0, morphing = false, lastSwitch = performance.now();
  var HOLD = 2600, MORPH = 1700;
  var mx = 0, my = 0, tmx = 0, tmy = 0;
  addEventListener('pointermove', function (e) {
    tmx = (e.clientX / innerWidth) * 2 - 1;
    tmy = (e.clientY / innerHeight) * 2 - 1;
  });
  addEventListener('deviceorientation', function (e) {
    if (e.gamma == null) return;
    tmx = Math.max(-1, Math.min(1, e.gamma / 30));
    tmy = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
  });

  var pr = Math.min(devicePixelRatio || 1, 2);
  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * pr; canvas.height = h * pr;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uAspect, w / h);
    gl.uniform1f(uSize, mobile ? 3.4 : 3.0);
    gl.uniform1f(uPR, pr);
  }
  addEventListener('resize', resize); resize();
  if (label) label.textContent = names[0];

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function frame(now) {
    requestAnimationFrame(frame);
    var t = now / 1000;
    if (!reduced) {
      if (!morphing && now - lastSwitch > HOLD) {
        morphing = true; lastSwitch = now;
        cur = (cur + 1) % forms.length;
        setForm(bufB, forms[(cur + 1) % forms.length] === forms[cur] ? forms[cur] : forms[cur]);
        if (label) label.textContent = names[cur];
      }
      if (morphing) {
        mix = Math.min(1, (now - lastSwitch) / MORPH);
        if (mix >= 1) {
          morphing = false; mix = 0; lastSwitch = now;
          setForm(bufA, forms[cur]);
          setForm(bufB, forms[cur]);
        }
      }
    }
    mx += (tmx - mx) * 0.045; my += (tmy - my) * 0.045;
    gl.uniform1f(uMix, mix);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uMouse, mx, my);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.POINTS, 0, N);
  }
  requestAnimationFrame(frame);
})();
