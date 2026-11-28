// أندرويد: ملفات التنزيل (نسخة احتياطية / Excel / تقارير) لا تعمل في WebView،
// فنحفظها مؤقتاً ثم نفتح قائمة المشاركة/الحفظ.
(function () {
  var C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  var P = C.Plugins || {};
  var orig = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var a = this;
    if (a.hasAttribute('download') && /^(blob:|data:)/.test(a.href) && P.Filesystem && P.Share) {
      saveShare(a.href, a.getAttribute('download') || 'file');
      return;
    }
    return orig.apply(this, arguments);
  };
  async function saveShare(href, name) {
    try {
      var blob = await (await fetch(href)).blob();
      var b64 = await new Promise(function (res, rej) {
        var r = new FileReader();
        r.onload = function () { res(String(r.result).split(',')[1]); };
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
      name = name.replace(/[\\\/:*?"<>|]/g, '_');
      var w = await P.Filesystem.writeFile({ path: name, data: b64, directory: 'CACHE' });
      await P.Share.share({ title: name, url: w.uri, dialogTitle: 'حفظ / مشاركة الملف' });
    } catch (e) {
      if (e && /cancel/i.test(String(e.message || e))) return;
      alert('تعذر حفظ الملف: ' + (e && e.message || e));
    }
  }
})();
