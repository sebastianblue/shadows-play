/* Browser adaptation of Niklas Kleemann's ascii-rain (MIT).
   https://github.com/nkleemann/ascii-rain · see ascii-rain-LICENSE.txt */
(function () {
  'use strict';
  const canvas = document.getElementById('reserve-rain');
  const context = canvas.getContext('2d');
  if (!context) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let columnWidth, lineHeight, columns, rows, drops = [], timer;

  function paint() {
    context.clearRect(0, 0, columns * columnWidth, rows * lineHeight);
    for (const drop of drops) {
      context.fillText(drop.speed <= 2 ? '|' : ':', drop.column * columnWidth, drop.row * lineHeight);
    }
  }

  function resize() {
    if (reducedMotion.matches || document.hidden) return;
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    const { fontStyle, fontWeight, fontSize, fontFamily, color, lineHeight: bodyLineHeight } = getComputedStyle(document.body);
    context.font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;
    context.fillStyle = color;
    context.textBaseline = 'top';
    columnWidth = context.measureText('|').width;
    lineHeight = parseFloat(bodyLineHeight);
    columns = Math.ceil(width / columnWidth);
    rows = Math.ceil(height / lineHeight);
    const compact = columns < 100 && rows < 40;
    const count = Math.min(250, Math.floor(columns * (compact ? 0.75 : 1.5)));
    drops = Array.from({ length: count }, () => ({
      column: Math.floor(Math.random() * columns),
      row: Math.floor(Math.random() * rows),
      speed: 1 + Math.floor(Math.random() * (compact ? 3 : 4))
    }));
    paint();
  }

  function advance() {
    for (const drop of drops) {
      drop.row += drop.speed;
      if (drop.row >= rows) drop.row = Math.floor(Math.random() * Math.min(10, rows));
    }
    paint();
  }

  function sync() {
    window.clearInterval(timer);
    canvas.hidden = reducedMotion.matches;
    if (!canvas.hidden && !document.hidden) {
      resize();
      timer = window.setInterval(advance, 60);
    }
  }

  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', sync);
  reducedMotion.addEventListener('change', sync);
  document.fonts?.ready.then(resize);
  sync();
})();
