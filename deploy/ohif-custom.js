(function() {
  var style = document.createElement('style');
  style.textContent = [
    '.research-use { display: none !important; }',
    '.dd-menu { display: none !important; }',
    '.header-logo-image { display: none !important; }',
    '.header-brand svg[name="ohif-logo"] { display: none !important; }',
    '.header-brand svg[name="ohif-text-logo"] { display: none !important; }',
    '.header-brand { display: flex !important; align-items: center !important; }',
    '.bk-pacs-title { color: #fff; font-size: 18px; font-weight: 700; font-family: Roboto, sans-serif; letter-spacing: 1px; margin-left: 8px; white-space: nowrap; }',
    '.bk-pacs-logo { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; }',
    '.bk-pacs-logo svg { width: 30px; height: 30px; }',
    '.bk-lang-switcher { display: flex; align-items: center; gap: 4px; margin-left: auto; margin-right: 15px; }',
    '.bk-lang-btn { background: transparent; border: 1px solid rgba(255,255,255,0.3); color: #fff; padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 12px; font-family: Roboto, sans-serif; transition: all 0.2s; }',
    '.bk-lang-btn:hover { border-color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.1); }',
    '.bk-lang-btn.active { background: #20a5d6; border-color: #20a5d6; color: #fff; }',
    '.header-menu { display: flex !important; align-items: center !important; }',
  ].join('\n');
  document.head.appendChild(style);

  var BK_PACS_SVG = '<svg viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg" width="30" height="30">'
    + '<rect x="2" y="2" width="11" height="11" rx="1" fill="#20a5d6"/>'
    + '<rect x="17" y="2" width="11" height="11" rx="1" fill="#20a5d6" opacity="0.7"/>'
    + '<rect x="2" y="17" width="11" height="11" rx="1" fill="#20a5d6" opacity="0.7"/>'
    + '<rect x="17" y="17" width="11" height="11" rx="1" fill="#20a5d6" opacity="0.4"/>'
    + '</svg>';

  var LANG_CONFIG = {
    zh: { label: '中', title: '中文', i18nCode: 'zh' },
    en: { label: 'EN', title: 'English', i18nCode: 'en' },
    fr: { label: 'FR', title: 'Français', i18nCode: 'fr' }
  };

  var currentLang = localStorage.getItem('bk-pacs-lang') || 'zh';
  var _cachedI18n = null;

  function findI18n() {
    if (_cachedI18n && typeof _cachedI18n.changeLanguage === 'function') {
      return _cachedI18n;
    }
    if (window.i18next && typeof window.i18next.changeLanguage === 'function') {
      _cachedI18n = window.i18next;
      return _cachedI18n;
    }
    var root = document.getElementById('root');
    if (!root) return null;
    var containerKey = Object.keys(root).find(function(k) {
      return k.startsWith('__reactContainere$') || k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$');
    });
    if (!containerKey) return null;
    var fiber = root[containerKey];
    var found = null;
    var visited = new Set();
    function walk(f, depth) {
      if (!f || depth > 120 || found || visited.has(f)) return;
      visited.add(f);
      try {
        var props = f.memoizedProps || f.pendingProps || {};
        if (props.i18n && typeof props.i18n.changeLanguage === 'function') {
          found = props.i18n;
          return;
        }
      } catch(e) {}
      if (f.child) walk(f.child, depth + 1);
      if (f.sibling) walk(f.sibling, depth + 1);
    }
    walk(fiber, 0);
    if (found) _cachedI18n = found;
    return found;
  }

  function applyModifications() {
    var headerBrand = document.querySelector('.header-brand');
    if (!headerBrand) return false;

    if (!headerBrand.querySelector('.bk-pacs-logo')) {
      var logoDiv = document.createElement('div');
      logoDiv.className = 'bk-pacs-logo';
      logoDiv.innerHTML = BK_PACS_SVG;
      headerBrand.insertBefore(logoDiv, headerBrand.firstChild);
    }

    if (!headerBrand.querySelector('.bk-pacs-title')) {
      var titleSpan = document.createElement('span');
      titleSpan.className = 'bk-pacs-title';
      titleSpan.textContent = 'BK-PACS';
      headerBrand.appendChild(titleSpan);
    }

    var svgs = headerBrand.querySelectorAll('svg');
    for (var i = 0; i < svgs.length; i++) {
      var name = svgs[i].getAttribute('name');
      if (name === 'ohif-logo' || name === 'ohif-text-logo') {
        svgs[i].style.display = 'none';
      }
    }

    var headerMenu = document.querySelector('.header-menu');
    if (headerMenu && !headerMenu.querySelector('.bk-lang-switcher')) {
      var switcher = document.createElement('div');
      switcher.className = 'bk-lang-switcher';
      var langs = ['zh', 'en', 'fr'];
      for (var j = 0; j < langs.length; j++) {
        var lang = langs[j];
        var btn = document.createElement('button');
        btn.className = 'bk-lang-btn' + (lang === currentLang ? ' active' : '');
        btn.textContent = LANG_CONFIG[lang].label;
        btn.title = LANG_CONFIG[lang].title;
        btn.setAttribute('data-lang', lang);
        btn.addEventListener('click', (function(l) {
          return function() { switchLanguage(l); };
        })(lang));
        switcher.appendChild(btn);
      }
      headerMenu.insertBefore(switcher, headerMenu.firstChild);
    }

    return true;
  }

  function switchLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('bk-pacs-lang', lang);

    var btns = document.querySelectorAll('.bk-lang-btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle('active', btns[i].getAttribute('data-lang') === lang);
    }

    var i18n = findI18n();
    if (i18n && typeof i18n.changeLanguage === 'function') {
      var i18nCode = LANG_CONFIG[lang] ? LANG_CONFIG[lang].i18nCode : lang;
      i18n.changeLanguage(i18nCode);
    }
  }

  function initLanguage() {
    var savedLang = localStorage.getItem('bk-pacs-lang');
    if (savedLang && savedLang !== 'en') {
      var i18n = findI18n();
      if (i18n && typeof i18n.changeLanguage === 'function') {
        var i18nCode = LANG_CONFIG[savedLang] ? LANG_CONFIG[savedLang].i18nCode : savedLang;
        i18n.changeLanguage(i18nCode);
      }
    }
  }

  var observer = new MutationObserver(function() {
    applyModifications();
  });

  function startObserver() {
    var target = document.getElementById('root') || document.body;
    observer.observe(target, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      applyModifications();
      startObserver();
      setTimeout(initLanguage, 3000);
    });
  } else {
    applyModifications();
    startObserver();
    setTimeout(initLanguage, 3000);
  }

  setInterval(applyModifications, 3000);
})();
