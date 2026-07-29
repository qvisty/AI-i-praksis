// Sætter en "Kopiér"-knap på alle prompt-bokse, så deltagerne kan kopiere med ét klik.
document.querySelectorAll('.prompt[data-copy]').forEach(function (box) {
  var text = box.textContent.trim();
  var btn = document.createElement('button');
  btn.className = 'copy';
  btn.type = 'button';
  btn.textContent = 'Kopiér';
  btn.addEventListener('click', function () {
    navigator.clipboard.writeText(text).then(function () {
      btn.textContent = 'Kopieret ✓';
      setTimeout(function () { btn.textContent = 'Kopiér'; }, 2000);
    });
  });
  box.appendChild(btn);
});

// Sætter en "Print handout"-knap på alle øvelsessektioner. Knappen printer
// sektionen som et rent A4-ark med sidehoved, klar til kopiering.
document.querySelectorAll('main section').forEach(function (section) {
  var exercise = section.querySelector('.exercise');
  if (!exercise) return;
  var btn = document.createElement('button');
  btn.className = 'print-btn';
  btn.type = 'button';
  btn.textContent = 'Print handout';
  btn.addEventListener('click', function () {
    var head = document.createElement('div');
    head.className = 'handout-head';
    var brand = document.createElement('strong');
    brand.textContent = 'AI i praksis';
    var module = document.createElement('span');
    module.textContent = document.title;
    head.appendChild(brand);
    head.appendChild(module);
    section.insertBefore(head, section.firstChild);
    var foot = document.createElement('div');
    foot.className = 'handout-foot';
    foot.textContent = '© 2026 Jesper Qvist. AI i praksis, qvisty.github.io/AI-i-praksis';
    section.appendChild(foot);
    document.body.classList.add('print-handout');
    section.classList.add('print-target');
    var cleanup = function () {
      document.body.classList.remove('print-handout');
      section.classList.remove('print-target');
      head.remove();
      foot.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  });
  exercise.appendChild(btn);
});

// Toner sektionerne blidt ind, når de ruller ind i billedet.
var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reducedMotion && 'IntersectionObserver' in window) {
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  document.querySelectorAll('main section').forEach(function (el) {
    el.classList.add('reveal');
    observer.observe(el);
  });
}
