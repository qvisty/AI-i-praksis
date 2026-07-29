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
