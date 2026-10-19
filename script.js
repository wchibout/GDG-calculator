(() => {
  const $ = s => document.querySelector(s);
  const main = $('#main'), sub = $('#sub'), degBtn = $('#deg'), themeBtn = $('#theme');
  const root = document.documentElement;
  let expr = '', hist = '', prev = '', deg = true, done = false, err = false;


  const media = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : media.matches;
  const paintTheme = () => themeBtn.setAttribute('aria-checked', isDark());
  try { const t = localStorage.getItem('calc-theme'); if (t) root.dataset.theme = t; } catch {}
  themeBtn.addEventListener('click', () => {
    const t = isDark() ? 'light' : 'dark';
    root.dataset.theme = t;
    try { localStorage.setItem('calc-theme', t); } catch {}
    paintTheme();
  });
  media.addEventListener('change', paintTheme);

  const rad = x => deg ? x * Math.PI / 180 : x;
  const FN = {
    sin: x => Math.sin(rad(x)),
    cos: x => Math.cos(rad(x)),
    tan: x => Math.abs(Math.cos(rad(x))) < 1e-12 ? NaN : Math.tan(rad(x)),
    ln: Math.log, log: Math.log10, '√': Math.sqrt
  };
  const fact = n => {
    if (n < 0 || n > 170 || n % 1) return NaN;
    let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
  };

  function evaluate(src) {
    const t = src.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/')
      .match(/\d+\.?\d*|\.\d+|sin|cos|tan|ln|log|√|π|e|[-+*/^()!%]/g) || [];
    let p = 0;
    const peek = () => t[p], next = () => t[p++];
    const startsValue = k => k && (/^[\d.]/.test(k) || /^(sin|cos|tan|ln|log|√|π|e|\()$/.test(k));

    const sum = () => {
      let v = term();
      while (peek() === '+' || peek() === '-') v = next() === '+' ? v + term() : v - term();
      return v;
    };
    const term = () => {
      let v = unary();
      for (;;) {
        const k = peek();
        if (k === '*' || k === '/') { next(); const r = unary(); v = k === '*' ? v * r : v / r; }
        else if (startsValue(k)) v *= unary();          // implicit multiplication: 2π, 3(4+1)
        else return v;
      }
    };
    const unary = () => {
      if (peek() === '-') { next(); return -unary(); }
      if (peek() === '+') { next(); return unary(); }
      return power();
    };
    const power = () => {
      const b = postfix();
      if (peek() === '^') { next(); return Math.pow(b, unary()); }
      return b;
    };
    const postfix = () => {
      let v = primary();
      for (;;) {
        const k = peek();
        if (k === '!') v = fact(v); else if (k === '%') v /= 100; else return v;
        next();
      }
    };
    const primary = () => {
      const k = next();
      if (k === undefined) throw 0;
      if (k === '(') { const v = sum(); if (peek() === ')') next(); return v; }
      if (k === 'π') return Math.PI;
      if (k === 'e') return Math.E;
      if (FN[k]) { if (next() !== '(') throw 0; const v = sum(); if (peek() === ')') next(); return FN[k](v); }
      if (/^[\d.]/.test(k)) return parseFloat(k);
      throw 0;
    };

    const v = sum();
    if (p < t.length) throw 0;
    return v;
  }
  const fmt = r => {
    if (!isFinite(r)) return null;
    r = Math.abs(r) < 1e-12 ? 0 : +r.toPrecision(12);
    return String(r).replace(/e\+?(-?\d+)/, '×10^($1)').replace(/-/g, '−');
  };

  const OPS = '+−×÷^';

  function add(s) {
    if (done) {
      if (/^[\d.(πe√]|^(sin|cos|tan|ln|log)/.test(s)) expr = '';
      done = false;
    }
    if (OPS.includes(s)) {
      if (!expr && s !== '−') return;
      if (OPS.includes(expr.slice(-1))) expr = expr.slice(0, -1);   // replace the previous operator
    } else if (s === '%' || s === '!') {
      if (!/[\d)πe]$/.test(expr)) return;
    } else if (s === '.') {
      const n = expr.match(/[\d.]*$/)[0];
      if (n.includes('.')) return;
      if (!n) s = '0.';
    } else if (/^\d$/.test(s) && /(^|[^\d.])0$/.test(expr)) {
      expr = expr.slice(0, -1);                                      // no leading zeros
    }
    expr += s;
  }

  const actions = {
    ac() { expr = ''; hist = ''; prev = ''; done = false; },
    del() {
      if (done) { expr = ''; done = false; return; }
      expr = expr.replace(/(sin\(|cos\(|tan\(|ln\(|log\(|√\(|.)$/, '');
    },
    neg() {
      done = false;
      const plain = expr.replace(/\(−([\d.]+)\)$|^−([\d.]+)$/, (_, a, b) => a || b);
      expr = plain !== expr ? plain : expr.replace(/[\d.]+$/, '(−$&)');
    },
    deg() { deg = !deg; degBtn.textContent = deg ? 'deg' : 'rad'; },
    eq() {
      if (!expr) return;
      let s = null;
      try { s = fmt(evaluate(expr)); } catch {}
      if (s === null) { expr = ''; err = true; return; }
      hist = expr; expr = s; done = true;
    }
  };

  const group = v => v.replace(/^(−?)(\d+)(.*)$/, (_, a, b, c) => a + b.replace(/\B(?=(\d{3})+$)/g, ',') + c);

  function render() {
    if (err) { main.textContent = 'Error'; sub.textContent = ''; return; }
    if (done) { sub.textContent = hist; main.textContent = '=' + group(expr); }
    else {
      sub.textContent = expr;
      if (!expr) prev = '';
      else { try { const v = fmt(evaluate(expr)); if (v) prev = v; } catch {} }
      main.textContent = expr ? (prev ? '=' + group(prev) : '=') : '0';
    }
    main.scrollLeft = main.scrollWidth;
    sub.scrollLeft = sub.scrollWidth;
  }

  function press(ins, act) {
    err = false;
    if (ins != null) add(ins); else if (actions[act]) actions[act]();
    render();
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('.pad button');
    if (b) press(b.dataset.i, b.dataset.a);
  });

  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key, map = { '*': '×', '/': '÷', '-': '−' };
    if (/^[\d.+()^%!e]$/.test(k) || map[k]) press(map[k] || k);
    else if (k === 'Enter' || k === '=') press(null, 'eq');
    else if (k === 'Backspace') press(null, 'del');
    else if (k === 'Escape' || k === 'Delete') press(null, 'ac');
    else return;
    e.preventDefault();
  });

  paintTheme();
  render();
})();
