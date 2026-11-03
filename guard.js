/* Страховка загрузки. Если за 25 секунд программа так и не нарисовала экран (испорченный кэш телефона, файл не скачался),
   один раз сбрасываем кэш сайта и перезагружаем страницу. Не помогло — честно пишем, что делать, вместо вечного «Загружаем». */
(() => {
  "use strict";
  const KEY = "elyx-boot-retry";
  const stuck = () => !!document.getElementById("boot");
  let done = false;
  async function recover(why) {
    if (done || !stuck()) return;
    done = true;
    let tried = false;
    try { tried = sessionStorage.getItem(KEY) === "1"; } catch { /* приватный режим */ }
    if (!tried) {
      try { sessionStorage.setItem(KEY, "1"); } catch { /* ок */ }
      try { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map((r) => r.unregister())); } catch { /* нет */ }
      try { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); } catch { /* нет */ }
      location.reload();
      return;
    }
    const b = document.getElementById("boot");
    if (b) b.innerHTML = '<div style="font-size:20px;font-weight:600">Второй директор</div>'
      + '<div style="color:#8d929c;max-width:300px;line-height:1.45">Сайт не загрузился (' + why + '). Проверьте интернет и обновите страницу. '
      + 'Если открываете из мессенджера — откройте ссылку в Chrome или Safari.</div>';
  }
  // файл программы не скачался или не прошёл проверку целостности — не ждём 25 секунд
  window.addEventListener("error", (e) => { const t = e.target; if (t && t.tagName === "SCRIPT") setTimeout(() => recover("файл программы"), 1500); }, true);
  window.addEventListener("load", () => setTimeout(() => recover("долго нет ответа"), 25000));
  // экран нарисован — сбрасываем отметку попытки
  setInterval(() => { if (!stuck()) { try { sessionStorage.removeItem(KEY); } catch { /* ок */ } } }, 3000);
})();
