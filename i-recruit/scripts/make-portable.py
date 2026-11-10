#!/usr/bin/env python3
"""Turn the static export (out/) into a few self-contained HTML files.

Every page gets its CSS, fonts and images embedded, so the files work when uploaded to any
host, even one that drops sub-folders, and when opened straight from a phone or a file manager.
Usage: python3 scripts/make-portable.py [export_dir] [output_dir]
"""
import base64, mimetypes, os, re, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "out"
DST = sys.argv[2] if len(sys.argv) > 2 else "portable"
PAGES = {"": "index", "employers": "employers", "workers": "workers", "services": "services",
         "about": "about", "contact": "contact", "privacy": "privacy"}
WHATSAPP, EMAIL = "2348169665171", "i.recruitinfodesk@gmail.com"

_cache: dict[str, str] = {}

def data_uri(path: str) -> str:
    if path not in _cache:
        mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
        with open(path, "rb") as f:
            _cache[path] = f"data:{mime};base64," + base64.b64encode(f.read()).decode()
    return _cache[path]

def build_css(html: str) -> str:
    href = re.search(r'<link rel="stylesheet" href="([^"]+)"', html).group(1)
    css_path = os.path.join(SRC, href.lstrip("/"))
    css = open(css_path, encoding="utf-8").read()
    # keep only woff2 sources, then embed them
    css = re.sub(r',\s*url\([^)]*\.woff\)\s*format\("woff"\)', "", css)
    def font(m):
        p = os.path.normpath(os.path.join(os.path.dirname(css_path), m.group(1)))
        return f"url({data_uri(p)})"
    return re.sub(r"url\((\.\./media/[^)]+\.woff2)\)", font, css)

MENU_JS = r"""
(function () {
  var btn = document.querySelector('button[aria-controls="mobile-menu"]');
  if (btn) {
    var menu = null;
    var open = false;
    var menuIcon = btn.innerHTML;
    var closeIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-7 w-7"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    function build() {
      var m = document.createElement('div');
      m.id = 'mobile-menu';
      m.className = 'fixed inset-x-0 top-[72px] bottom-0 z-40 overflow-y-auto bg-charcoal px-5 pb-10 pt-6 lg:hidden';
      var nav = document.createElement('nav');
      nav.className = 'flex flex-col';
      var here = location.pathname.split('/').pop() || 'index.html';
      var links = [['index.html', 'Home']];
      document.querySelectorAll('nav[aria-label="Main"] a').forEach(function (a) {
        var h = a.getAttribute('href');
        if (h.indexOf('#') === -1) links.push([h, a.textContent.trim()]);
      });
      links.forEach(function (l) {
        var a = document.createElement('a');
        a.href = l[0]; a.textContent = l[1];
        a.className = 'border-b border-white/10 py-4 font-display text-3xl font-bold uppercase tracking-wide ' + (l[0] === here ? 'text-orange' : 'text-white');
        nav.appendChild(a);
      });
      var cta = document.createElement('a');
      cta.href = 'employers.html#request'; cta.textContent = 'Request Workers';
      cta.className = 'mt-8 bg-orange px-6 py-4 text-center font-display text-xl font-bold uppercase tracking-wider text-ink';
      nav.appendChild(cta);
      m.appendChild(nav);
      document.querySelector('header').appendChild(m);
      return m;
    }
    function set(v) {
      open = v;
      if (v && !menu) menu = build();
      if (menu) menu.style.display = v ? '' : 'none';
      btn.setAttribute('aria-expanded', String(v));
      btn.setAttribute('aria-label', v ? 'Close menu' : 'Open menu');
      btn.innerHTML = v ? closeIcon : menuIcon;
      document.body.style.overflow = v ? 'hidden' : '';
    }
    btn.addEventListener('click', function () { set(!open); });
    document.addEventListener('click', function (e) {
      if (open && e.target.closest && e.target.closest('#mobile-menu a')) set(false);
    });
  }

  document.querySelectorAll('a[href="#full-size"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var img = a.querySelector('img');
      if (!img) return;
      e.preventDefault();
      fetch(img.currentSrc || img.src).then(function (r) { return r.blob(); }).then(function (b) {
        window.open(URL.createObjectURL(b), '_blank');
      });
    });
  });

  var titles = { 'employers.html': 'Employer staffing request', 'workers.html': 'Worker registration', 'contact.html': 'Send us a message' };
  var title = titles[location.pathname.split('/').pop()];
  var form = document.querySelector('main form');
  if (form && title) {
    var hint = form.querySelector('p[role="status"]');
    function compose() {
      if (!form.reportValidity()) return null;
      var lines = [];
      form.querySelectorAll('input, select, textarea').forEach(function (el) {
        var v = (el.value || '').trim();
        var lab = form.querySelector('label[for="' + el.id + '"]');
        if (v && lab) lines.push(lab.textContent.replace('*', '').trim() + ': ' + v);
      });
      return title + ' (I-Recruit website)\n\n' + lines.join('\n');
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    form.querySelectorAll('button').forEach(function (b) {
      var t = b.textContent;
      if (t.indexOf('WhatsApp') > -1) b.addEventListener('click', function () {
        var text = compose(); if (!text) return;
        window.open('https://wa.me/__WA__?text=' + encodeURIComponent(text), '_blank', 'noopener');
        if (hint) hint.textContent = 'WhatsApp opened with your details filled in. Press send there to finish.';
      });
      if (t.indexOf('email') > -1) b.addEventListener('click', function () {
        var text = compose(); if (!text) return;
        location.href = 'mailto:__EMAIL__?subject=' + encodeURIComponent(title + ' - I-Recruit') + '&body=' + encodeURIComponent(text);
        if (hint) hint.textContent = 'Your email app opened with your details filled in. Press send there to finish.';
      });
    });
  }
})();
""".replace("__WA__", WHATSAPP).replace("__EMAIL__", EMAIL)

def convert(slug: str, name: str, css: str) -> str:
    path = os.path.join(SRC, slug, "index.html") if slug else os.path.join(SRC, "index.html")
    html = open(path, encoding="utf-8").read()
    # drop framework scripts and preload hints; keep JSON-LD
    html = re.sub(r'<script(?![^>]*application/ld\+json)[^>]*>.*?</script>', "", html, flags=re.S)
    html = re.sub(r'<link rel="(?:preload|preconnect|modulepreload)"[^>]*/?>', "", html)
    html = re.sub(r'<link rel="stylesheet" href="[^"]+"[^>]*/?>', lambda m: f"<style>{css}</style>", html, count=1)
    html = re.sub(r'<link rel="icon" href="[^"]+"', lambda m: f'<link rel="icon" href="{data_uri(os.path.join(SRC, "icon.svg"))}"', html)
    html = re.sub(r'<link rel="canonical"[^>]*/?>', "", html)
    html = re.sub(r'(<img[^>]*?\ssrc=")(/images/[^"]+)(")',
                  lambda m: m.group(1) + data_uri(os.path.join(SRC, m.group(2).lstrip("/"))) + m.group(3), html)
    # certificate links open the full-size image; the script below opens it from the embedded copy
    html = re.sub(r'href="/images/[^"]+"', 'href="#full-size"', html)
    # page links: /about/#x -> about.html#x ; / -> index.html
    def link(m):
        target, frag = m.group(1), m.group(2) or ""
        return f'href="{PAGES.get(target, target)}.html{frag}"'
    html = re.sub(r'href="/([a-z]*)/?(#[^"]*)?"', link, html)
    html = html.replace('</body>', f"<script>{MENU_JS}</script></body>")
    return html

def main() -> None:
    os.makedirs(DST, exist_ok=True)
    css = build_css(open(os.path.join(SRC, "index.html"), encoding="utf-8").read())
    total = 0
    for slug, name in PAGES.items():
        out = convert(slug, name, css)
        with open(os.path.join(DST, name + ".html"), "w", encoding="utf-8") as f:
            f.write(out)
        total += len(out)
        print(f"{name}.html  {len(out)//1024} KB")
    print("total", total // 1024, "KB")

main()
