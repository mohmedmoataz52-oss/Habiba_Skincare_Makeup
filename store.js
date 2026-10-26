/* HABIBA shared catalogue. Reads Supabase when configured; otherwise reads the published JSON. Browser drafts never override published products. */
(function () {
  'use strict';

  var DASH_KEY = 'habiba_local_dashboard_v1';
  var CONFIG_URL = 'habiba-store-config.json';
  var READ_TIMEOUT_MS = 3000;

  var DEFAULT_SETTINGS = {
    shippingThreshold: 1000,
    defaultDiscount: 0,
    promoEnabled: false,
    promoLabel: '',
    storeName: 'Habiba Skin Care',
    announcementText: 'حبيبة',
    tickerSpeed: 18
  };

  var state = {
    settings: Object.assign({}, DEFAULT_SETTINGS),
    products: [],
    bundles: [],
    source: 'defaults'
  };

  /* ---------- readers ---------- */
  /* Reads the published config file without ever throwing.
     Tries fetch first (http/https only), then XMLHttpRequest
     (which also works for local file:// pages in most browsers).
     Always resolves — a missing/unreadable file simply yields null. */
  function readConfigFile() {
    return new Promise(function (resolve) {
      var settled = false;
      function finish(cfg) {
        if (settled) return;
        settled = true;
        resolve(cfg || null);
      }

      // Safety net: never let a hung request freeze the page.
      setTimeout(function () { finish(null); }, READ_TIMEOUT_MS);

      function viaXhr() {
        try {
          if (typeof window.XMLHttpRequest !== 'function') return finish(null);
          var x = new window.XMLHttpRequest();
          x.open('GET', CONFIG_URL, true);
          x.onload = function () {
            var cfg = null;
            try {
              var ok = (x.status === 0 || (x.status >= 200 && x.status < 300));
              if (ok) cfg = JSON.parse(x.responseText);
            } catch (e) { cfg = null; }
            finish(cfg);
          };
          x.onerror = function () { finish(null); };
          x.ontimeout = function () { finish(null); };
          x.send();
        } catch (e) {
          finish(null);
        }
      }

      var httpish = false;
      try {
        httpish = /^https?:$/i.test(String((window.location && window.location.protocol) || ''));
      } catch (e) { httpish = false; }

      if (httpish && typeof window.fetch === 'function') {
        try {
          window.fetch(CONFIG_URL + '?t=' + Date.now(), { cache: 'no-store' })
            .then(function (r) { return (r && r.ok) ? r.json() : null; })
            .then(function (json) { finish(json); })
            .catch(function () { viaXhr(); });
        } catch (e) {
          // Some browsers throw synchronously (this was the old freeze).
          viaXhr();
        }
      } else {
        viaXhr();
      }
    });
  }

  /* ---------- load & merge ---------- */
  function merge(fileCfg) {
    var merged = {
      settings: Object.assign({}, DEFAULT_SETTINGS, (fileCfg && fileCfg.settings) || {}),
      products: (fileCfg && fileCfg.products) || [],
      bundles: (fileCfg && fileCfg.bundles) || [],
      updatedAt: (fileCfg && (fileCfg.generatedAt || fileCfg.updatedAt)) || null,
      source: fileCfg ? 'config-file' : 'defaults'
    };

    return merged;
  }

  function publish() {
    try { applyToPage(); } catch (e) { /* never break a page for a label */ }
    try {
      window.dispatchEvent(new CustomEvent('habiba:store-updated', { detail: state }));
    } catch (e) { /* CustomEvent may be missing on very old browsers */ }
    return state;
  }

  var pendingLoad=null;
  function load() {
    if(pendingLoad)return pendingLoad;
    pendingLoad=loadOnce().finally(function(){pendingLoad=null;});return pendingLoad;
  }
  function loadOnce() {
    return (window.HabibaBackend && HabibaBackend.configured ? HabibaBackend.read().then(function(row){ return row.document; }) : readConfigFile()).then(function (fileCfg) {
      state = merge(fileCfg);
      return publish();
    }).catch(function () {
      // Preserve the last successful catalogue during a temporary connection failure.
      if(state.source !== 'defaults'){return publish();}
      document.documentElement.setAttribute('data-store-error','1');
      return state;
    });
  }

  /* ---------- public helpers ---------- */
  function money(n) {
    return 'EGP ' + (Number(n) || 0).toLocaleString('en-EG');
  }

  function getSettings() { return state.settings; }
  function getProducts() { return state.products || []; }
  function getBundles() { return state.bundles || []; }

  /* Discount + free-delivery info for a subtotal.
     Returns { pct, disc, free, threshold } */
  function promo(subtotal) {
    var s = getSettings();
    var sub = Number(subtotal) || 0;
    var pct = s.promoEnabled ? (Math.min(100, Math.max(0, Number(s.defaultDiscount) || 0))) : 0;
    var disc = Math.round(sub * pct / 100);
    var threshold = Math.max(0, Number(s.shippingThreshold) || 0);
    return {
      pct: pct,
      disc: disc,
      free: threshold > 0 && sub >= threshold,
      threshold: threshold
    };
  }

  function isFreeDelivery(subtotal) { return promo(subtotal).free; }

  /* ---------- page DOM updates ---------- */
  function applyToPage() {
    if(state.source === 'defaults') return;
    if (!document || !document.querySelectorAll) return;
    var s = getSettings();
    var threshold = Math.max(0, Number(s.shippingThreshold) || 0);
    var barText = s.freeShippingText || null;
    if (!barText) {
      barText = threshold === 0
        ? 'FREE SHIPPING ON ALL ORDERS'
        : 'FREE SHIPPING ON ORDERS OVER EGP ' + threshold.toLocaleString('en-EG');
    }

    // 1) Top announcement bar (free delivery threshold).
    // Elements start hidden in the HTML and are revealed here, so an old
    // hardcoded value can never flash or stick on screen — and a failed
    // config read can no longer leave the bar invisible.
    var bars = document.querySelectorAll('[data-shipping-announcement]');
    for (var i = 0; i < bars.length; i++) {
      bars[i].textContent = barText;
      bars[i].style.visibility = 'visible';
      bars[i].setAttribute('data-store-filled', '1');
    }

    // 2) Scrolling ticker in the middle of the page (discount text etc.)
    var ticker = (s.announcementText && s.announcementText.trim()) || s.storeName || 'حبيبة';
    document.querySelectorAll('.bundles-ticker').forEach(function(strip) {
      if (strip.dataset.message === ticker) return;
      strip.dataset.message = ticker;
      strip.textContent = '';
      var track = document.createElement('div'); track.className = 'habiba-marquee';
      for (var group=0; group<2; group++) {
        var part = document.createElement('div'); part.className = 'habiba-marquee-group';
        if(group) part.setAttribute('aria-hidden','true');
        for(var n=0;n<4;n++) {
          var label=document.createElement('span'); label.textContent=ticker;
          var dot=document.createElement('span'); dot.textContent='✦'; dot.setAttribute('aria-hidden','true');
          part.append(label,dot);
        }
        track.appendChild(part);
      }
      strip.appendChild(track); strip.style.visibility='visible';
    });

    // 3) Ticker speed — the number of seconds one full pass takes.
    //    Saved by the private dashboard (settings.tickerSpeed) and applied
    //    here through a CSS variable, so every strip on every page moves at
    //    exactly the same speed. A missing/garbage value falls back to 18s.
    var speed = Number(s.tickerSpeed);
    if (!isFinite(speed) || speed <= 0) speed = 18;
    speed = Math.min(120, Math.max(4, speed));
    try {
      document.documentElement.style.setProperty('--ticker-speed', speed + 's');
    } catch (e) { /* ignore */ }

    try {
      document.documentElement.setAttribute('data-store-ready', '1');
      document.documentElement.setAttribute('data-store-source', String(state.source || 'defaults'));
    } catch (e) { /* ignore */ }
  }

  /* Run the page updates as soon as the DOM exists, and again whenever the
     config resolves. This is what guarantees the shipping bar and the
     free-delivery threshold are always active. */
  function runWhenDomReady() {
    try {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { applyToPage(); });
      } else {
        applyToPage();
      }
    } catch (e) { /* ignore */ }
  }

  /* ---------- dashboard product -> category page shape ---------- */
  var CATEGORY_BY_PAGE = {
    'Skin Care': 'Skin Care',
    'Hair Care': 'Hair Care',
    'Body Care': 'Body Care',
    'Makeup': 'Makeup',
    'Perfume': 'Perfume',
    'Bikini Area': 'Underarm & Bikini Butter',
    'Underarm': 'Underarm & Bikini Butter',
    'Bundles': '__bundles__'
  };

  function mapDashboardProduct(p, pageCategory) {
    var price = Number(p.salePrice !== '' && p.salePrice != null ? p.salePrice : p.price) || Number(p.price) || 0;
    var regular = Number(p.price) || 0;
    var onSale = p.salePrice !== '' && p.salePrice != null && Number(p.salePrice) < regular && regular > 0;
    return {
      id: p.id,
      brand: p.brand || 'Habiba Skin Care',
      name: p.name || 'Beauty product',
      type: p.type || pageCategory,
      price: price,
      oldPrice: regular || price,
      rating: Number(p.rating) || 0,
      reviews: Number(p.reviews) || 0,
      color: p.color || '',
      stock: p.stock,
      category: p.category,
      shade: p.shade || '',
      tag: p.bestSeller ? 'Best Seller' : (onSale ? 'Sale' : 'New'),
      image: p.image || '',
      description: p.description || '',
      fromDashboard: true
    };
  }

  function productsForPage(pageTitle) {
    var cat = CATEGORY_BY_PAGE[pageTitle] || pageTitle;
    var out = [];
    getProducts().forEach(function (p) {
      if (!p) return;
      if ((p.category || '') === cat) out.push(mapDashboardProduct(p, cat));
    });
    return out;
  }

  /* ---------- export ----------
     Defined synchronously so nothing that reads HabibaStore can break,
     whatever happens to the config file or to fetch(). */
  window.HabibaStore = {
    ready: null,
    reload: load,
    money: money,
    getSettings: getSettings,
    getProducts: getProducts,
    getBundles: getBundles,
    promo: promo,
    isFreeDelivery: isFreeDelivery,
    productsForPage: productsForPage,
    applyToPage: applyToPage,
    version: 2
  };

  runWhenDomReady();

  try {
    window.HabibaStore.ready = load();
    if(window.HabibaBackend && HabibaBackend.configured && !location.pathname.endsWith('dashboard.html')) {
      setInterval(function(){if(!document.hidden) load();},30000);
      window.addEventListener('focus',load);
    }
  } catch (e) {
    state = merge(null);
    publish();
    window.HabibaStore.ready = Promise.resolve(state);
  }
})();
