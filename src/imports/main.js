(function () {
  'use strict';

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  const logEl = $('log');
  const previewEl = $('preview');
  const templateSel = $('templateComp');
  const imagesPath = $('imagesPath');
  const dataPath = $('dataPath');
  const compsFolder = $('compsFolder');
  const statusCol = $('statusCol');
  const keyMapTA = $('keyMap');

  // KeyMap Builder UI
  const kmModeSimpleBtn = $('kmModeSimple');
  const kmModeJsonBtn = $('kmModeJson');
  const kmModeHint = $('kmModeHint');
  const kmApplyJsonBtn = $('kmApplyJson');
  const kmWarningsEl = $('kmWarnings');
  const kmBuilderEmptyEl = $('kmBuilderEmpty');
  const kmBuilderBody = $('kmBuilderBody');
  const kmBuilderPanel = $('keymapBuilderPanel');
  const kmJsonPanel = $('keymapJsonPanel');

  const strictCB = $('strict');

  // Nested policy UI
  const reuseNestedCB = $('reuseNestedCB') || $('reuseNested');     // <input type="checkbox" id="reuseNestedCB"> (fallback: reuseNested)
  const nestedPolicySel = $('nestedPolicy');  // <select id="nestedPolicy">

  const addToQueueCB = $('addToQueue');
  const autoRenderCB = $('autoRender');
  const outputPath = $('outputPath');

  const omSelect = $('omTemplate');
  const btnRefreshOMs = $('refreshOMs');

  const btnChooseImages = $('chooseImages');
  const btnChooseData = $('chooseData');
  const btnChooseOutput = $('chooseOutput');
  const btnLoadData = $('loadData');
  const btnProcessPending = $('processPending');
  const btnProcessAll = $('processAll');
  const btnRefreshComps = $('refreshComps');
  const btnEditCompsFolder = $('editCompsFolder');

  const dtypeRadios = document.querySelectorAll('input[name="dtype"]');

  // Export controls
  const btnExportData = $('exportData');
  const btnExportKeymap = $('exportKeymap');
  const btnGenerateKeymap = $('generateKeymap');
  const btnImportKeymap = $('btnImportKeymap');
  const exportTypeRadios = document.querySelectorAll('input[name="exportType"]');
  let SELECTED_EXPORT_TYPE =
    (document.querySelector('input[name="exportType"]:checked') || {}).value || 'csv';

  const skIgnoreHiddenCB = $('skIgnoreHidden');
  const skIgnoreLockedCB = $('skIgnoreLocked');

  const btnAsPlaceholder = document.getElementById('btnAsPlaceholder');
  const btnPrefixTilde = document.getElementById('btnPrefixTilde');

  const kmHelpBtn = $('kmHelpToggle');
  const kmHelpBox = $('kmHelp');

  const nameColumnSel = $('nameColumn');
  const usePrefixCB = $('usePrefix');
  const namePrefixInp = $('namePrefix');

  // ---------- Panel menu + Licensing UI ----------
  const btnPanelMenu = $('btnPanelMenu');
  const btnLicense = $('btnLicense');
  const menuLicense = $('menuLicense');
  const menuDocumentation = $('menuDocumentation');
  const licenseIcon = $('licenseIcon');

  const menuCopyDiagnostics = $('menuCopyDiagnostics');
  const menuReportBug = $('menuReportBug');
  const menuAbout = $('menuAbout');

  
  const aboutToolsLink = $('aboutToolsLink');
const licenseModalEl = $('licenseModal');
  const licenseKeyInput = $('licenseKeyInput');
  const licenseModalMsg = $('licenseModalMsg');
  const licenseDetails = $('licenseDetails');
  const licenseToolPageLink = $('licenseToolPageLink');
  const btnValidateLicense = $('btnValidateLicense');
  const btnRefreshLicense = $('btnRefreshLicense');
  const btnDeactivateLicense = $('btnDeactivateLicense');

  const supportModalEl = $('supportModal');
  const supportText = $('supportText');
  const supportModalMsg = $('supportModalMsg');
  const btnCopyBugReport = $('btnCopyBugReport');

  const aboutModalEl = $('aboutModal');
  const aboutVersion = $('aboutVersion');
  const aboutEnv = $('aboutEnv');

  // Update modal DOM refs
  const updateModalEl = $('updateModal');
  const updateModalLatestVersionEl = $('updateModalLatestVersion');
  const updateModalCurrentVersionEl = $('updateModalCurrentVersion');
  const kmExpandedTargets = new Set(); // stores endpoint strings currently expanded
  const kmToggleAllPathsBtn = $('kmToggleAllPaths');


  // ---------- Lemon Squeezy licensing ----------
  const LEMON_LICENSE_API_HOST = 'api.lemonsqueezy.com';
  const EXT_VERSION = '1.0.0';
  const TOOL_PAGE_URL = 'https://www.fastoosh.com/tools/fastoosh-data-automator';
  const DOCUMENTATION_URL = TOOL_PAGE_URL + '/guide/';
  const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

  // ---------- Version check ----------
  const FASTOOSH_API_HOST = 'ksndambbafpzxquxsgdw.supabase.co';
  const FASTOOSH_API_PATH = '/functions/v1/make-server-e07959ec/tools/fastoosh-data-automator/latest-version';
  const FASTOOSH_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzbmRhbWJiYWZwenhxdXhzZ2R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDYzNjMsImV4cCI6MjA4NzMyMjM2M30.bZ2m03ZHXN4eSNiBN1ygE-OU73md-RudERUhKzNEPgg';
  const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day

  const FREE_MAX_ROWS = 10;

// In Free mode we only lock Pro-only controls (the tool remains usable).
const LOCKED_ACTION_IDS = [
  'usePrefix',
  'namePrefix',
  'processAll',
  'reuseNestedCB',
  'nestedPolicy',
  'addToQueue'
];

  const nodeRequire = (window.cep_node && typeof window.cep_node.require === 'function')
    ? window.cep_node.require
    : (typeof require === 'function' ? require : null);

  const HAS_NODE = !!nodeRequire;
  let _fs, _path, _os, _https, _qs, _crypto, _child, _process;
  let _licenseFile = null;
  let _machineId = null;

  const LICENSE_STATE = {
    state: 'unlicensed', // unlicensed | checking | licensed | blocked | error
    message: ''
  };

  function isProTier() {
    return LICENSE_STATE.state === 'licensed';
  }


  const logSectionEl = document.getElementById('logSection');
  const toggleLogSwitch = document.getElementById('toggleLogSwitch');
  const toggleTooltipsSwitch = document.getElementById('toggleTooltipsSwitch');
  const menuToggleTooltipsRow = document.getElementById('menuToggleTooltipsRow');
  const menuToggleLogRow = document.getElementById('menuToggleLogRow');


  (function initLogSwitch(){
    if (!logSectionEl || !toggleLogSwitch) return;

    function apply(show){
      logSectionEl.classList.toggle('is-hidden', !show);
      toggleLogSwitch.checked = !!show;
    }

    // default hidden
    apply(false);

    // switch changes
    toggleLogSwitch.addEventListener('change', function(){
      apply(this.checked);
    });

    // allow clicking the whole row to toggle (optional but nice)
    if (menuToggleLogRow) {
      menuToggleLogRow.addEventListener('click', function(e){
        // ignore direct click on the switch itself
        if (e.target === toggleLogSwitch) return;
        toggleLogSwitch.checked = !toggleLogSwitch.checked;
        apply(toggleLogSwitch.checked);
      });
    }
  })();


  // ----- Tooltips toggle (panel menu) -----
  // Lets the user disable/enable bootstrap tooltips globally.
  function isTooltipsEnabled() {
    try {
      var saved = null;
      try { saved = localStorage.getItem('fda_tooltips'); } catch (e) {}
      if (saved !== null) return saved === '1';
      if (typeof toggleTooltipsSwitch !== 'undefined' && toggleTooltipsSwitch) return !!toggleTooltipsSwitch.checked;
    } catch (e) {}
    return true; // default ON
  }

function setTooltipsEnabled(enabled) {
    try {
      // Remember desired state so we can apply it later if Bootstrap isn't ready yet.
      try { window.__fdaTooltipsDesired = !!enabled; } catch (e) {}

      if (!window.bootstrap || !bootstrap.Tooltip) {
        // Bootstrap may load after our init; retry once it's available.
        try {
          if (!window.__fdaTooltipsRetryScheduled) {
            window.__fdaTooltipsRetryScheduled = true;
            setTimeout(function () {
              window.__fdaTooltipsRetryScheduled = false;
              var desired = true;
              try { desired = (window.__fdaTooltipsDesired !== undefined) ? !!window.__fdaTooltipsDesired : true; } catch (e) {}
              setTooltipsEnabled(desired);
            }, 250);
          }
        } catch (e) {}
        return;
      }

      const triggers = document.querySelectorAll('[data-bs-toggle="tooltip"]');
      triggers.forEach(function(el){
        // Ensure an instance exists; this matches our tooltip init options.
        var inst = bootstrap.Tooltip.getInstance(el);
        if (!inst) {
          inst = new bootstrap.Tooltip(el, {
            trigger: 'hover',
            placement: 'auto',
            delay: { show: 500, hide: 100 },
            container: document.body,
            boundary: 'viewport'
          });
        }
        if (enabled) inst.enable();
        else inst.disable();
      });
    } catch (e) { }
  }

  (function initTooltipsSwitch(){
    if (!toggleTooltipsSwitch) return;

    function apply(enabled){
      toggleTooltipsSwitch.checked = !!enabled;
      // Persist preference
      try { localStorage.setItem('fda_tooltips', enabled ? '1' : '0'); } catch (e) {}
      setTooltipsEnabled(!!enabled);
    }

    // Load saved pref (default ON)
    var saved = null;
    try { saved = localStorage.getItem('fda_tooltips'); } catch (e) {}
    if (saved !== null) {
      apply(saved === '1');
    } else {
      apply(true);
    }

    toggleTooltipsSwitch.addEventListener('change', function(){
      apply(this.checked);
    });

    // Allow clicking the whole row to toggle
    if (menuToggleTooltipsRow) {
      menuToggleTooltipsRow.addEventListener('click', function(e){
        if (e.target === toggleTooltipsSwitch) return;
        toggleTooltipsSwitch.checked = !toggleTooltipsSwitch.checked;
        apply(toggleTooltipsSwitch.checked);
      });
    }
  })();



  function openExternalUrl(url) {
    const target = String(url || '').trim();
    if (!target) return false;
    try {
      if (_child && _process && _process.platform) {
        if (_process.platform === 'win32') {
          _child.exec('start "" "' + target.replace(/"/g, '\"') + '"');
          return true;
        }
        if (_process.platform === 'darwin') {
          _child.exec('open "' + target.replace(/"/g, '\"') + '"');
          return true;
        }
        _child.exec('xdg-open "' + target.replace(/"/g, '\"') + '"');
        return true;
      }
    } catch (e) { }
    try {
      window.open(target, '_blank');
      return true;
    } catch (e) { }
    return false;
  }

  function netErrToString(err) {
    if (!err) return '';
    try {
      const code = err.code ? String(err.code) : '';
      const msg = err.message ? String(err.message) : String(err);
      return (code ? (code + ': ') : '') + msg;
    } catch (e) {
      return String(err);
    }
  }

  function initNodeModules() {
    if (!HAS_NODE) return false;
    try {
      _fs = nodeRequire('fs');
      _path = nodeRequire('path');
      _os = nodeRequire('os');
      _https = nodeRequire('https');
      _qs = nodeRequire('querystring');
      _crypto = nodeRequire('crypto');
      _child = nodeRequire('child_process');
      _process = nodeRequire('process');

      const dir = _path.join(_os.homedir(), '.fastoosh', 'data-automator');
      if (!_fs.existsSync(dir)) _fs.mkdirSync(dir, { recursive: true });
      _licenseFile = _path.join(dir, 'license.json');

      const raw = [
        _os.hostname(),
        (_os.userInfo && _os.userInfo().username) || '',
        _os.platform(),
        _os.arch()
      ].join('|');

      _machineId = _crypto.createHash('sha256').update(raw).digest('hex');
      return true;
    } catch (e) {
      return false;
    }
  }

  function readLocalLicense() {
    if (!_licenseFile || !_fs) return null;
    try {
      if (!_fs.existsSync(_licenseFile)) return null;
      const s = _fs.readFileSync(_licenseFile, 'utf8') || '';
      return JSON.parse(s);
    } catch (e) {
      return null;
    }
  }

  function writeLocalLicense(obj) {
    if (!_licenseFile || !_fs) return false;
    try {
      _fs.writeFileSync(_licenseFile, JSON.stringify(obj, null, 2), 'utf8');
      return true;
    } catch (e) {
      return false;
    }
  }

  function deleteLocalLicense() {
    if (!_licenseFile || !_fs) return false;
    try {
      if (_fs.existsSync(_licenseFile)) _fs.unlinkSync(_licenseFile);
      return true;
    } catch (e) {
      return false;
    }
  }

  function safeByteLength(str) {
    try {
      if (typeof Buffer !== 'undefined' && Buffer && Buffer.byteLength) {
        return Buffer.byteLength(str);
      }
    } catch (e) { }
    try {
      if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(String(str || '')).length;
      }
    } catch (e2) { }
    return String(str || '').length;
  }

  function getInstanceName() {
    const parts = [];
    try { if (_os && typeof _os.hostname === 'function') parts.push(_os.hostname()); } catch (e) { }
    try {
      if (_os && typeof _os.userInfo === 'function') {
        const info = _os.userInfo();
        if (info && info.username) parts.push(info.username);
      }
    } catch (e) { }
    try { if (_os && typeof _os.platform === 'function') parts.push(_os.platform()); } catch (e) { }
    try { if (_os && typeof _os.arch === 'function') parts.push(_os.arch()); } catch (e) { }

    const clean = parts.join(' | ').replace(/\s+/g, ' ').trim();
    return clean || 'Fastoosh Data Automator';
  }

  function lemonPost(pathname, params, cb) {
    if (!_https || !_qs) {
      cb(new Error('Node modules not available.'));
      return;
    }

    const postData = _qs.stringify(params || {});
    const req = _https.request({
      method: 'POST',
      hostname: LEMON_LICENSE_API_HOST,
      path: pathname,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': safeByteLength(postData)
      }
    }, function (res) {
      let body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () {
        try {
          const json = JSON.parse(body || '{}');
          cb(null, json, res.statusCode);
        } catch (e) {
          cb(e, null, res.statusCode);
        }
      });
    });

    req.on('error', function (err) { cb(err); });
    req.write(postData);
    req.end();
  }

  function lemonActivate(licenseKey, instanceName, cb) {
    lemonPost('/v1/licenses/activate', {
      license_key: licenseKey,
      instance_name: instanceName || getInstanceName()
    }, cb);
  }

  function lemonValidate(licenseKey, instanceId, cb) {
    const params = { license_key: licenseKey };
    if (instanceId) params.instance_id = instanceId;
    lemonPost('/v1/licenses/validate', params, cb);
  }

  function lemonDeactivate(licenseKey, instanceId, cb) {
    lemonPost('/v1/licenses/deactivate', {
      license_key: licenseKey,
      instance_id: instanceId
    }, cb);
  }

  function formatIsoDate(iso) {
    const s = String(iso || '').trim();
    if (!s) return '—';
    try {
      const d = new Date(s);
      if (isNaN(d.getTime())) return s;
      return d.toLocaleString();
    } catch (e) {
      return s;
    }
  }

  function getFriendlyLicenseIssue(status, info) {
    const normalized = String(status || '').toLowerCase();
    const expiresAt = info && info.expiresAt ? formatIsoDate(info.expiresAt) : '';

    if (normalized === 'expired') {
      return expiresAt && expiresAt !== '—'
        ? ('Your subscription or license expired on ' + expiresAt + '.')
        : 'Your subscription or license has expired.';
    }
    if (normalized === 'inactive') return 'This subscription is inactive or cancelled.';
    if (normalized === 'disabled') return 'This license has been disabled.';
    if (normalized === 'active') return 'License active.';
    if (!normalized) return 'License status could not be confirmed.';
    return 'License is ' + normalized + '.';
  }

  function mapLicenseApiError(json, fallback) {
    const raw = (json && json.error) ? String(json.error).trim() : '';
    const lc = raw.toLowerCase();

    if (!raw) return fallback || 'Could not verify this license.';

    if (lc.indexOf('activation limit') !== -1 || lc.indexOf('reached the activation limit') !== -1) {
      return 'This key is already active on another device.';
    }
    if (lc.indexOf('inactive') !== -1 || lc.indexOf('cancelled') !== -1 || lc.indexOf('canceled') !== -1) {
      return 'This subscription is inactive or cancelled.';
    }
    if (lc.indexOf('expired') !== -1) {
      return 'Your subscription or license has expired.';
    }
    if (lc.indexOf('disabled') !== -1) {
      return 'This license has been disabled.';
    }
    if (lc.indexOf('invalid') !== -1 || lc.indexOf('not found') !== -1) {
      return 'This license key is invalid.';
    }

    return raw || fallback || 'Could not verify this license.';
  }

  function setLicenseDetailsFromData(local, remote) {
    if (!licenseDetails) return;

    if ((!remote && !local) || (!((remote || {}).licenseKey) && !((local || {}).licenseKey))) {
      licenseDetails.innerHTML = '<div><strong>Status:</strong> unlicensed</div><div><strong>Access:</strong> Free mode on this device.</div><div><strong>Tip:</strong> Paste your Lemon Squeezy key, then click Activate / Save.</div>';
      return;
    }

    const info = remote || local || {};
    const state = LICENSE_STATE.state || 'unlicensed';
    const status = info.status || (state === 'licensed' ? 'active' : state);
    const maskedKey = info.licenseKey ? maskLicenseKey(info.licenseKey) : '—';
    const customer = info.customerEmail || info.email || '—';
    const product = info.productName || 'Fastoosh Data Automator';
    const variant = info.variantName || '—';
    const instanceName = info.instanceName || '—';
    const instanceId = info.instanceId || '—';
    const accessEnds = info.expiresAt ? formatIsoDate(info.expiresAt) : 'Perpetual';
    const lastCheck = info.lastVerifiedAt ? formatIsoDate(info.lastVerifiedAt) : '—';
    const activationUsage = (typeof info.activationUsage === 'number') ? String(info.activationUsage) : '—';
    const activationLimit = (typeof info.activationLimit === 'number') ? String(info.activationLimit) : '—';

    licenseDetails.innerHTML = [
      '<div><strong>Status:</strong> ' + escapeHtml(String(status)) + '</div>',
      '<div><strong>License:</strong> ' + escapeHtml(maskedKey) + '</div>',
      '<div><strong>Product:</strong> ' + escapeHtml(String(product)) + '</div>',
      '<div><strong>Plan:</strong> ' + escapeHtml(String(variant)) + '</div>',
      '<div><strong>Customer:</strong> ' + escapeHtml(String(customer)) + '</div>',
      '<div><strong>This device:</strong> ' + escapeHtml(String(instanceName)) + '</div>',
      '<div><strong>Instance ID:</strong> ' + escapeHtml(String(instanceId)) + '</div>',
      '<div><strong>Device seats:</strong> ' + escapeHtml(String(activationUsage)) + ' / ' + escapeHtml(String(activationLimit)) + '</div>',
      '<div><strong>Access ends:</strong> ' + escapeHtml(String(accessEnds)) + '</div>',
      '<div><strong>Last check:</strong> ' + escapeHtml(String(lastCheck)) + '</div>'
    ].join('');
  }

  function extractLicenseSnapshot(licenseKey, json, fallback) {
    fallback = fallback || {};
    const lk = (json && json.license_key) || {};
    const meta = (json && json.meta) || {};
    const inst = (json && json.instance) || {};

    return {
      licenseKey: licenseKey || fallback.licenseKey || '',
      machineId: _machineId,
      instanceId: inst.id || fallback.instanceId || '',
      instanceName: inst.name || fallback.instanceName || getInstanceName(),
      lastVerifiedAt: Date.now(),
      status: lk.status || fallback.status || '',
      expiresAt: lk.expires_at || fallback.expiresAt || null,
      activationLimit: (typeof lk.activation_limit === 'number') ? lk.activation_limit : (fallback.activationLimit || null),
      activationUsage: (typeof lk.activation_usage === 'number') ? lk.activation_usage : (fallback.activationUsage || null),
      productName: meta.product_name || fallback.productName || null,
      variantName: meta.variant_name || fallback.variantName || null,
      customerName: meta.customer_name || fallback.customerName || null,
      customerEmail: meta.customer_email || fallback.customerEmail || null
    };
  }

  function setLicenseIcon(state, msg) {
    LICENSE_STATE.state = state;
    LICENSE_STATE.message = msg || '';

    if (licenseModalMsg) {
      licenseModalMsg.textContent = msg || '';
      licenseModalMsg.className = 'small mt-2';
      if (state === 'licensed') licenseModalMsg.classList.add('text-success');
      else if (state === 'checking') licenseModalMsg.classList.add('text-warning');
      else if (state === 'blocked' || state === 'error') licenseModalMsg.classList.add('text-danger');
      else licenseModalMsg.classList.add('text-muted');
    }

    if (!licenseIcon || !btnLicense) return;

    licenseIcon.className = '';
    if (state === 'licensed') {
      licenseIcon.className = 'fa-solid fa-circle-check lic-licensed';
      btnLicense.title = 'License: Active';
    } else if (state === 'checking') {
      licenseIcon.className = 'fa-solid fa-spinner fa-spin lic-checking';
      btnLicense.title = 'License: Checking…';
    } else if (state === 'blocked') {
      licenseIcon.className = 'fa-solid fa-triangle-exclamation lic-locked';
      btnLicense.title = 'License: Blocked';
    } else if (state === 'error') {
      licenseIcon.className = 'fa-solid fa-triangle-exclamation lic-locked';
      btnLicense.title = 'License: Error';
    } else {
      licenseIcon.className = 'fa-solid fa-lock lic-locked';
      btnLicense.title = 'License: Unlicensed';
    }
  }

  // ----- Pro-feature tooltip handling (Free tier) -----
  // When a control is locked in Free mode, we prefix its existing tooltip:
  //   "Pro feature : <original tooltip>"
  // We store original tooltips once so Pro can restore them later.
  function ensureTooltipInstance(el) {
    try {
      if (!el || !window.bootstrap || !bootstrap.Tooltip) return;

      // Respect the user's tooltip preference: if tooltips are OFF,
      // never recreate instances (which would make them show again).
      if (!isTooltipsEnabled()) {
        var instOff = bootstrap.Tooltip.getInstance(el);
        if (instOff) instOff.dispose();
        return;
      }

      var inst = bootstrap.Tooltip.getInstance(el);
      if (inst) {
        inst.dispose();
      }
      // Match the tooltip init options in index.html (CEP-safe).
      new bootstrap.Tooltip(el, {
        trigger: 'hover',
        placement: 'auto',
        delay: { show: 500, hide: 100 },
        container: document.body,
        boundary: 'viewport'
      });
    } catch (e) { }
  }

  function getProTooltipTarget(controlId) {
    // Some tooltips live on a wrapping label/span rather than the input itself.
    var el = $(controlId);
    if (!el) return null;
if (controlId === 'reuseNestedCB' || controlId === 'addToQueue' || controlId === 'usePrefix') {
      try { return el.closest('label') || el; } catch (e) { return el; }
    }
    return el;
  }


  function setTooltipPrefixed(el, locked) {
    try {
      if (!el) return;

      // Bootstrap may move `title` to `data-bs-original-title`.
      var current = el.getAttribute('title');
      var bsTitle = el.getAttribute('data-bs-original-title');
      var base = el.getAttribute('data-orig-title');

      if (base == null) {
        base = (current != null && current !== '') ? current : (bsTitle != null ? bsTitle : '');
        // If there's no tooltip content on this element, don't invent one.
        if (!base) return;
        el.setAttribute('data-orig-title', base);
      }

      var next = locked ? ('🔒 Pro feature: ' + base) : base;
      // Use a custom tooltip class so Free-tier pro tooltips can be styled differently.
      if (locked) el.setAttribute('data-bs-custom-class', 'pro-tooltip');
      else el.removeAttribute('data-bs-custom-class');
      el.setAttribute('title', next);
      el.setAttribute('data-bs-original-title', next);
ensureTooltipInstance(el);
    } catch (e) { }
  }

  function applyProTooltips(locked) {
    // Apply prefixed tooltips to all locked Pro-only controls.
    LOCKED_ACTION_IDS.forEach(function (id) {
      var target = getProTooltipTarget(id);
      setTooltipPrefixed(target, locked);
    });
  }

  function setLocked(locked) {
    LOCKED_ACTION_IDS.forEach(function (id) {
      const el = $(id);
      if (!el) return;

      if (id === 'processAll') {
        // Keep enabled for hover so tooltip works; block action via guards.
        if (locked) {
          el.setAttribute('aria-disabled', 'true');
          el.setAttribute('data-locked', '1');
          el.classList.add('pro-locked-btn');
          el.setAttribute('tabindex', '-1');
        } else {
          el.removeAttribute('aria-disabled');
          el.removeAttribute('data-locked');
          el.classList.remove('pro-locked-btn');
          el.removeAttribute('tabindex');
        }
        return;
      }

      el.disabled = !!locked;
      if (locked) el.classList.add('disabled');
      else el.classList.remove('disabled');
    });

// Prefix tooltips for Pro-only controls when locked.
    applyProTooltips(!!locked);

    // Free-tier defaults: keep behavior stable by forcing Pro-only toggles OFF when locked.
    if (locked) {
      try {
        if (usePrefixCB) { usePrefixCB.checked = false; }
        if (namePrefixInp) { namePrefixInp.value = ''; }
        if (reuseNestedCB) { reuseNestedCB.checked = false; }
        if (nestedPolicySel) { nestedPolicySel.value = 'auto'; }
        if (addToQueueCB) { addToQueueCB.checked = false; }

        // Trigger UI sync (show/hide rows, disable dependent controls)
        try { if (usePrefixCB) usePrefixCB.dispatchEvent(new Event('change')); } catch (e) { }
        try { if (reuseNestedCB) reuseNestedCB.dispatchEvent(new Event('change')); } catch (e) { }
        try { if (addToQueueCB && typeof addToQueueCB.onchange === 'function') addToQueueCB.onchange(); } catch (e) { }
      } catch (e) { }
    }
  }

  function openModal(el) {
    try {
      if (!el || !window.bootstrap || !bootstrap.Modal) return;
      const inst = bootstrap.Modal.getOrCreateInstance(el);
      inst.show();
    } catch (e) { }
  }

  function closeModal(el) {
    try {
      if (!el || !window.bootstrap || !bootstrap.Modal) return;
      const inst = bootstrap.Modal.getOrCreateInstance(el);
      inst.hide();
    } catch (e) { }
  }

  function copyToClipboard(text) {
    if (!text) return;

    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { });
      return;
    }

    // fallback
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) { }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function maskLicenseKey(k) {
    const s = String(k || '').trim();
    if (!s) return '';
    if (s.length <= 8) return '****';
    return s.slice(0, 4) + '…' + s.slice(-4);
  }

  function getHostEnvSafe() {
    try {
      if (typeof CSInterface !== 'undefined') {
        const cs = new CSInterface();
        if (cs && typeof cs.getHostEnvironment === 'function') {
          const raw = cs.getHostEnvironment();
          return (typeof raw === 'string') ? JSON.parse(raw) : raw;
        }
      }
    } catch (e) { }

    try {
      if (window.__adobe_cep__ && typeof __adobe_cep__.getHostEnvironment === 'function') {
        return JSON.parse(__adobe_cep__.getHostEnvironment());
      }
    } catch (e2) { }

    return null;
  }

  function getOSInfoSafe(env) {
    try {
      if (typeof CSInterface !== 'undefined') {
        const cs = new CSInterface();
        if (cs && typeof cs.getOSInformation === 'function') {
          const s = cs.getOSInformation();
          if (s) return s;
        }
      }
    } catch (e) { }

    if (env) {
      if (env.appOperatingSystem) return env.appOperatingSystem;
      if (env.os && env.osVersion) return env.os + ' ' + env.osVersion;
      if (env.os) return env.os;
      if (env.platform) return env.platform;
    }

    return (navigator && navigator.userAgent) ? navigator.userAgent : '';
  }

  function getDiagnosticsText() {
    const env = getHostEnvSafe();
    const local = readLocalLicense();

    const lines = [];
    lines.push('Fastoosh Data Automator');
    lines.push('Version: ' + EXT_VERSION);
    lines.push('Product: Lemon Squeezy');

    const app = env && env.appName ? (env.appName + ' ' + (env.appVersion || '')) : '';
    const os = getOSInfoSafe(env);

    if (app) lines.push('Host: ' + app);
    if (os) lines.push('OS: ' + os);
    if (env && env.cepVersion) lines.push('CEP: ' + env.cepVersion);

    lines.push('License state: ' + LICENSE_STATE.state);
    if (LICENSE_STATE.message) lines.push('Message: ' + LICENSE_STATE.message);

    if (local && local.licenseKey) lines.push('License key: ' + maskLicenseKey(local.licenseKey));
    if (local && local.status) lines.push('License status: ' + String(local.status));
    if (local && local.expiresAt) lines.push('Access ends: ' + formatIsoDate(local.expiresAt));
    if (local && local.customerEmail) lines.push('Customer email: ' + String(local.customerEmail));
    if (local && local.instanceId) lines.push('Instance ID: ' + String(local.instanceId));

    lines.push('Machine ID: ' + (_machineId ? _machineId.slice(0, 12) + '…' : 'n/a'));
    lines.push('License file: ' + (_licenseFile || 'n/a'));
    return lines.join('\n');
  }

  function refreshAbout() {
    if (aboutVersion) aboutVersion.textContent = 'Version: ' + EXT_VERSION;

    const env = getHostEnvSafe();
    const local = readLocalLicense();

    const app = env && env.appName ? (env.appName + ' ' + (env.appVersion || '')) : '—';
    const os = getOSInfoSafe(env) || '—';
    const buyer = (local && local.customerEmail) ? String(local.customerEmail) : '—';
    const accessEnds = (local && local.expiresAt) ? formatIsoDate(local.expiresAt) : 'Perpetual';

    const lines = [
      'Host: ' + app,
      'License: ' + (LICENSE_STATE.state || '—'),
      'Buyer email: ' + buyer,
      'Access ends: ' + accessEnds,
      'Machine ID: ' + (_machineId ? (_machineId.slice(0, 12) + '…') : '—'),
    ];

    if (aboutEnv) {
      aboutEnv.innerHTML = lines.map(function (l) {
        return '<div class="about-line">' + escapeHtml(l) + '</div>';
      }).join('');
    }
  }

  function applyLicenseResult(licenseKey, json, opts) {
    opts = opts || {};
    const showModal = (opts.showModal !== false);
    const success = !!(json && (json.valid || json.activated));
    const localFallback = readLocalLicense() || {};

    if (!json || !json.license_key) {
      const msg = mapLicenseApiError(json, 'This license key is invalid.');
      const blockedByActivationLimit = !!(msg && msg.toLowerCase().indexOf('already active on another device') !== -1);
      setLicenseIcon(blockedByActivationLimit ? 'blocked' : 'error', msg);
      setLocked(true);
      setLicenseDetailsFromData(localFallback, null);
      if (showModal) openModal(licenseModalEl);
      return false;
    }

    const snapshot = extractLicenseSnapshot(licenseKey, json, localFallback);
    writeLocalLicense(snapshot);

    const status = String(snapshot.status || '').toLowerCase();
    const blocked = (!success || status === 'disabled' || status === 'expired' || status === 'inactive');
    if (blocked) {
      setLicenseIcon('blocked', getFriendlyLicenseIssue(status, snapshot));
      setLocked(true);
      setLicenseDetailsFromData(snapshot, snapshot);
      if (showModal) openModal(licenseModalEl);
      return false;
    }

    setLicenseIcon('licensed', snapshot.expiresAt ? ('License active. Access ends ' + formatIsoDate(snapshot.expiresAt) + '.') : 'License active.');
    setLocked(false);
    setLicenseDetailsFromData(snapshot, snapshot);
    if (showModal) closeModal(licenseModalEl);
    return true;
  }

  // ---------- Version check helpers ----------

  // Returns true if semver string `a` is strictly greater than `b`.
  function semverGt(a, b) {
    try {
      var pa = String(a || '0').replace(/[^0-9.]/g, '').split('.').map(Number);
      var pb = String(b || '0').replace(/[^0-9.]/g, '').split('.').map(Number);
      for (var i = 0; i < 3; i++) {
        var na = pa[i] || 0;
        var nb = pb[i] || 0;
        if (na > nb) return true;
        if (na < nb) return false;
      }
      return false; // equal
    } catch (e) {
      return false;
    }
  }

  function showUpdateModal(latestVersion) {
    if (updateModalLatestVersionEl) updateModalLatestVersionEl.textContent = latestVersion;
    if (updateModalCurrentVersionEl) updateModalCurrentVersionEl.textContent = EXT_VERSION;
    openModal(updateModalEl);
  }

  // Show a brief Bootstrap toast (success/info/danger)
  function showToast(msg, variant) {
    try {
      var toastEl = $('fdaToast');
      var toastMsgEl = $('fdaToastMsg');
      if (!toastEl || !toastMsgEl) return;
      toastMsgEl.textContent = msg || '';
      toastEl.className = 'toast align-items-center';

      // Accent colour per variant
      var accentColor = variant === 'danger'  ? '#FF5C5C'
                      : variant === 'warning' ? '#E8A838'
                      : variant === 'info'    ? '#7E57C2'
                      :                         '#46B885'; // success (default)

      // Apply panel-themed inline styles so Bootstrap's sheet can't interfere
      toastEl.style.cssText = [
        'background:#1e1e1e',
        'color:#E6E6E6',
        'border:1px solid #4A4A4A',
        'border-left:3px solid ' + accentColor,
        'border-radius:6px',
        'box-shadow:0 4px 14px rgba(0,0,0,0.55)',
        'font-size:12px',
        'min-width:200px',
        'max-width:300px'
      ].join(';');
      toastMsgEl.style.color = '#E6E6E6';

      if (window.bootstrap && bootstrap.Toast) {
        var t = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 3500 });
        t.show();
      }
    } catch (e) {}
  }

  // Core version fetch — opts: { force, showUpToDate }
  function fetchAndCheckVersion(opts) {
    opts = opts || {};

    // Ensure node modules are ready (safe to call multiple times)
    if (!_https) initNodeModules();
    if (!_https) {
      if (opts.showUpToDate) showToast('Could not check — Node not available in this environment.', 'warning');
      return;
    }

    // Rate-limit: skip if checked recently, unless forced
    if (!opts.force) {
      var lastCheck = 0;
      try { lastCheck = parseInt(localStorage.getItem('fda_auto_version_check') || '0', 10) || 0; } catch (e) {}
      if (Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return;
    }

    // Show spinner on the menu button while checking (manual only)
    var menuBtn = $('menuCheckUpdates');
    if (opts.showUpToDate && menuBtn) {
      menuBtn.disabled = true;
      menuBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Checking…';
    }

    var req = _https.request({
      method: 'GET',
      hostname: FASTOOSH_API_HOST,
      path: FASTOOSH_API_PATH,
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + FASTOOSH_ANON_KEY
      }
    }, function (res) {
      var body = '';
      res.on('data', function (c) { body += c; });
      res.on('end', function () {
        // Stamp the check time — only for auto-checks so manual checks don't block the next scheduled run
        if (!opts.force) {
          try { localStorage.setItem('fda_auto_version_check', String(Date.now())); } catch (e) {}
        }

        // Restore menu button
        if (opts.showUpToDate && menuBtn) {
          menuBtn.disabled = false;
          menuBtn.innerHTML = '<i class="fa-solid fa-rotate me-2"></i>Check for updates';
        }

        try {
          var json = JSON.parse(body || '{}');
          var latest = String((json.data && json.data.version) || json.version || '').trim();

          if (!latest) {
            if (opts.showUpToDate) showToast('Could not retrieve version info.', 'danger');
            return;
          }

          if (!semverGt(latest, EXT_VERSION)) {
            // Already up to date
            if (opts.showUpToDate) showToast('You\'re up to date! (v' + EXT_VERSION + ')', 'success');
            return;
          }

          // Update available — for manual check always show; for auto check respect dismissed
          if (!opts.force) {
            var dismissed = '';
            try { dismissed = localStorage.getItem('fda_dismissed_version') || ''; } catch (e) {}
            if (dismissed === latest) return;
          }

          showUpdateModal(latest);
        } catch (e) {
          if (opts.showUpToDate) showToast('Error parsing server response.', 'danger');
        }
      });
    });

    req.setTimeout(5000, function () {
      try { req.destroy(); } catch (e) {}
      if (opts.showUpToDate) {
        if (menuBtn) {
          menuBtn.disabled = false;
          menuBtn.innerHTML = '<i class="fa-solid fa-rotate me-2"></i>Check for updates';
        }
        showToast('Check timed out. Please try again.', 'danger');
      }
    });
    req.on('error', function () {
      if (opts.showUpToDate) {
        if (menuBtn) {
          menuBtn.disabled = false;
          menuBtn.innerHTML = '<i class="fa-solid fa-rotate me-2"></i>Check for updates';
        }
        showToast('Network error. Check your connection.', 'danger');
      }
    });
    req.end();
  }

  // Auto check on startup — silent, rate-limited
  function checkForUpdate() {
    fetchAndCheckVersion({ force: false, showUpToDate: false });
  }

  // Manual check from menu — always fires, shows result either way
  function manualCheckForUpdate() {
    fetchAndCheckVersion({ force: true, showUpToDate: true });
  }

  function checkLicenseOnStartup() {
    const ok = initNodeModules();
    setLocked(true);

    if (!ok) {
      setLicenseIcon('unlicensed', 'Free mode active. Pro activation unavailable (CEP Node not available).');
      setLicenseDetailsFromData(null, null);
      setLocked(true);
      return;
    }

    const local = readLocalLicense();
    if (!local || !local.licenseKey) {
      setLicenseIcon('unlicensed', 'Free mode active. Enter your Lemon Squeezy license key to unlock.');
      setLicenseDetailsFromData(null, null);
      setLocked(true);
      return;
    }

    if (local.machineId && _machineId && local.machineId !== _machineId) {
      setLicenseIcon('blocked', 'This license file belongs to a different machine. Running in Free mode.');
      setLicenseDetailsFromData(local, local);
      setLocked(true);
      return;
    }

    if (licenseKeyInput) licenseKeyInput.value = local.licenseKey;
    setLicenseDetailsFromData(local, local);

    setLicenseIcon('checking', 'Checking license…');
    lemonValidate(local.licenseKey, local.instanceId || null, function (err, json) {
      if (err) {
        const last = local.lastVerifiedAt || 0;
        const age = Date.now() - last;
        if (last && age <= GRACE_MS) {
          setLicenseIcon('licensed', 'Offline mode (recently verified).');
          setLicenseDetailsFromData(local, local);
          setLocked(false);
          return;
        }
        setLicenseIcon('error', 'Could not verify Pro license: ' + netErrToString(err) + '. Running in Free mode.');
        setLicenseDetailsFromData(local, local);
        setLocked(true);
        return;
      }
      applyLicenseResult(local.licenseKey, json, { showModal: false });
    });
  }

  // Smart validate:
  // - If same machine + same key already stored => refresh only (increment=false)
  // - Otherwise => activate (increment=true)
  function shouldActivateForKey(key) {
    if (!_machineId || !_licenseFile || !_fs) initNodeModules();

    const local = readLocalLicense();
    if (!local || !local.licenseKey) return true;

    const localKey = String(local.licenseKey || '').trim();
    const inputKey = String(key || '').trim();

    if (!localKey || localKey !== inputKey) return true;
    if (!local.instanceId) return true;
    if (local.machineId && _machineId && local.machineId !== _machineId) return true;

    return false;
  }

  function wireValidateButtonSmart() {
    if (!btnValidateLicense) return;

    btnValidateLicense.addEventListener('click', function () {
      const key = (licenseKeyInput && licenseKeyInput.value) ? licenseKeyInput.value.trim() : '';
      if (!key) {
        try { deleteLocalLicense(); } catch (e) { }
        setLocked(true);
        setLicenseIcon('unlicensed', 'Free mode active. Enter your Lemon Squeezy license key to unlock.');
        setLicenseDetailsFromData(null, null);
        return;
      }

      const doActivate = shouldActivateForKey(key);
      setLicenseIcon('checking', doActivate ? 'Activating license…' : 'Refreshing license…');

      const done = function (err, json) {
        if (err) {
          setLocked(true);
          setLicenseIcon('error', 'Could not reach Lemon Squeezy: ' + netErrToString(err));
          setLicenseDetailsFromData(readLocalLicense(), null);
          return;
        }
        applyLicenseResult(key, json, { showModal: true });
      };

      if (doActivate) lemonActivate(key, getInstanceName(), done);
      else {
        const local = readLocalLicense() || {};
        lemonValidate(key, local.instanceId || null, done);
      }
    });
  }

  // ---------- State ----------
  let DATA_ROWS = [];
  // ---------- KeyMap Builder state ----------
  let keyMapObj = {};     // Single source of truth for KeyMap (JS object)
  let DATA_HEADERS = [];  // Columns from loaded CSV/JSON (excluding status col)
  let KEYMAP_MODE = 'simple'; // 'simple' | 'json'
  let kmPendingDeleteEndpoint = null;
  const UNMAPPED_KEY = '__UNMAPPED_COL__';
  
  function formatAeTargetPath(endpoint) {
    const s = String(endpoint || '').trim();
    if (!s) return '';
    return s.split('/').join(' \u2192 '); // " → "
    }

  function isPlainObject(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
  }

  function safeParseJSON(s) {
    try { return JSON.parse(String(s || '')); } catch (e) { return null; }
  }

  function normalizeKeyMapObject(obj) {
    // Expected: { "dataKey": ["ae/path", ...], ... }
    const out = {};
    if (!isPlainObject(obj)) return out;

    Object.keys(obj).forEach(function (k) {
      const v = obj[k];
      if (Array.isArray(v)) {
        // keep only string-ish entries
        const arr = v.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
        if (arr.length) out[String(k)] = Array.from(new Set(arr));
      } else if (typeof v === 'string') {
        const s = String(v || '').trim();
        if (s) out[String(k)] = [s];
      }
    });

    return out;
  }

  function getAllEndpointsFromObj(obj) {
    const endpoints = [];
    const seen = {};
    Object.keys(obj || {}).forEach(function (col) {
      const arr = obj[col];
      if (!Array.isArray(arr)) return;
      arr.forEach(function (p) {
        const s = String(p || '').trim();
        if (!s) return;
        if (seen[s]) return;
        seen[s] = true;
        endpoints.push(s);
      });
    });
    return endpoints;
  }

  function findColumnsForEndpoint(obj, endpoint) {
    const cols = [];
    Object.keys(obj || {}).forEach(function (col) {
      const arr = obj[col];
      if (!Array.isArray(arr)) return;
      if (arr.indexOf(endpoint) !== -1) cols.push(col);
    });
    return cols;
  }
  /**
   * Half-automated mode:
   * Keep the detected endpoints, but clear all column mappings.
   * Endpoints are stored under UNMAPPED_KEY so builder dropdowns show "None".
   */
  function demapAllToUnmapped() {
    const endpoints = getAllEndpointsFromObj(keyMapObj);

    // reset object and keep endpoints in a reserved bucket
    keyMapObj = {};
    if (endpoints.length) keyMapObj[UNMAPPED_KEY] = endpoints.slice();

    syncTextareaFromObj();
    renderKeyMapBuilderFromObj();
  }
  function setKeyMapObj(obj) {
    keyMapObj = normalizeKeyMapObject(obj || {});
    syncTextareaFromObj();
    renderKeyMapBuilderFromObj();
  }

  function syncTextareaFromObj() {
    if (!keyMapTA) return;
    try { keyMapTA.value = JSON.stringify(keyMapObj, null, 2); } catch (e) { /* ignore */ }
  }

  function syncObjFromTextarea() {
    if (!keyMapTA) return false;
    const raw = (keyMapTA.value || '').trim();
    if (!raw) {
      setKeyMapObj({});
      return true;
    }
    const parsed = safeParseJSON(raw);
    if (!parsed) return false;
    setKeyMapObj(parsed);
    return true;
  }

  function refreshKeyMapBuilderDropdowns(headers) {
    DATA_HEADERS = Array.isArray(headers) ? headers.slice() : [];
    renderKeyMapBuilderFromObj();
  }

  function setKeyMapMode(mode) {
    const m = (mode === 'json') ? 'json' : 'simple';
    KEYMAP_MODE = m;

    if (kmBuilderPanel) kmBuilderPanel.style.display = (m === 'simple') ? '' : 'none';
    if (kmJsonPanel) kmJsonPanel.style.display = (m === 'json') ? '' : 'none';

    if (kmModeHint) kmModeHint.textContent = (m === 'json') ? 'Advanced JSON' : 'Simple builder';

    // Visual active state (lightweight; no dependency on CSS)
    if (kmModeSimpleBtn) kmModeSimpleBtn.classList.toggle('icon-btn-primary', m === 'simple');
    if (kmModeJsonBtn) kmModeJsonBtn.classList.toggle('icon-btn-primary', m === 'json');

    if (m === 'json') {
      syncTextareaFromObj();
    } else {
      renderKeyMapBuilderFromObj();
    }
  }

  function setKeyMapWarning(html) {
    if (!kmWarningsEl) return;
    kmWarningsEl.innerHTML = html || '';
  }
  function getAeTargetLeaf(endpoint) {
    const s = String(endpoint || '').trim();
    if (!s) return '';
    const parts = s.split('/');
    return parts[parts.length - 1] || s;
  }

  function formatAeTargetForRow(endpoint) {
    return kmExpandedTargets.has(endpoint)
      ? formatAeTargetPath(endpoint) // "A -> B -> C"
      : getAeTargetLeaf(endpoint);   // "C"
  }
  function updateToggleAllPathsButton() {
    if (!kmToggleAllPathsBtn) return;

    const endpoints = getAllEndpointsFromObj(keyMapObj);
    const allExpanded = endpoints.length > 0 && endpoints.every(ep => kmExpandedTargets.has(ep));

    kmToggleAllPathsBtn.title = allExpanded ? 'Hide full paths' : 'Show full paths';
    kmToggleAllPathsBtn.innerHTML = allExpanded
      ? '<i class="fa-solid fa-eye"></i>'        // all expanded = show eye
      : '<i class="fa-solid fa-eye-slash"></i>'; // all collapsed = show eye-slash

  }
  function renderKeyMapBuilderFromObj() {
    if (!kmBuilderBody) return;

    const endpoints = getAllEndpointsFromObj(keyMapObj);
    const hasData = Array.isArray(DATA_HEADERS) && DATA_HEADERS.length > 0;

    if (kmBuilderEmptyEl) {
      const msg = (!endpoints.length)
        ? 'Generate or import a KeyMap to populate endpoints.'
        : (!hasData ? 'Load data to populate columns.' : '');
      kmBuilderEmptyEl.textContent = msg || '';
      kmBuilderEmptyEl.style.display = msg ? '' : 'none';
    }

    kmBuilderBody.innerHTML = '';

    if (!endpoints.length) {
      setKeyMapWarning('');
      if (typeof updateToggleAllPathsButton === 'function') updateToggleAllPathsButton();
      return;
    }

    // Build a "selected column per endpoint" map (first match wins if duplicates exist)
    const endpointToCol = {};
    Object.keys(keyMapObj || {}).forEach(function (col) {
      const arr = keyMapObj[col];
      if (!Array.isArray(arr)) return;
      arr.forEach(function (ep) {
        const s = String(ep || '').trim();
        if (!s) return;
        if (!endpointToCol[s]) endpointToCol[s] = col;
      });
    });

    // Build rows
    endpoints.forEach(function (endpoint) {
      const cols = findColumnsForEndpoint(keyMapObj, endpoint);

      // Treat UNMAPPED_KEY as "None" in the UI
      const rawSelected = cols[0] || '';
      const selected = (rawSelected === UNMAPPED_KEY) ? '' : rawSelected;

      const isMissingSelected = !!(selected && hasData && DATA_HEADERS.indexOf(selected) === -1);

      // Columns used by other endpoints (so we can hide them from this dropdown)
      const usedByOthers = {};
      Object.keys(endpointToCol).forEach(function (ep) {
        const c = endpointToCol[ep];
        if (!c) return;
        if (c === UNMAPPED_KEY) return; // ignore reserved bucket
        if (ep !== endpoint) usedByOthers[c] = true;
      });

      const tr = document.createElement('tr');

      // Endpoint cell (UI only)
      const tdEndpoint = document.createElement('td');
      tdEndpoint.title = formatAeTargetPath(endpoint); // always available on hover
      tdEndpoint.style.minWidth = '0'; // helps wrapping/ellipsis behaviors in some layouts

      const wrap = document.createElement('div');
      wrap.className = 'km-target-wrap';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'km-target-toggle';
      btn.title = kmExpandedTargets.has(endpoint) ? 'Hide full path' : 'Show full path';
      btn.innerHTML = kmExpandedTargets.has(endpoint)
        ? '<i class="fa-solid fa-eye"></i>'        // expanded = showing full path
        : '<i class="fa-solid fa-eye-slash"></i>'; // collapsed = hiding full path


      const label = document.createElement('div');
      label.className = 'km-target-text';
      label.textContent = formatAeTargetForRow(endpoint);

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();

        if (kmExpandedTargets.has(endpoint)) kmExpandedTargets.delete(endpoint);
        else kmExpandedTargets.add(endpoint);

        renderKeyMapBuilderFromObj();
      });

      wrap.appendChild(btn);
      // Delete button (permanent remove with confirmation modal)
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'km-target-delete';
      delBtn.title = 'Remove this target from KeyMap';
      delBtn.innerHTML = '<i class="fa-solid fa-times"></i>';

      delBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openKeyMapDeleteModal(endpoint);
      });

      wrap.appendChild(delBtn);

      wrap.appendChild(label);
      tdEndpoint.appendChild(wrap);
      tr.appendChild(tdEndpoint);

      // Dropdown cell
      const tdSelect = document.createElement('td');
      const sel = document.createElement('select');
      sel.className = 'km-select';
      sel.dataset.endpoint = endpoint;
      sel.disabled = !hasData;

      // Red border when missing column selected
      if (isMissingSelected) {
        sel.style.borderColor = '#dc3545';
        sel.style.boxShadow = '0 0 0 0.2rem rgba(220,53,69,.15)';
      } else {
        // ensure we don't keep stale inline styles after re-render
        sel.style.borderColor = '';
        sel.style.boxShadow = '';
      }

      const optNone = document.createElement('option');
      optNone.value = '';
      optNone.textContent = '— None —';
      sel.appendChild(optNone);

      // Smart options:
      // - Show headers not used by other endpoints
      // - Always show the currently selected header (even if used by others)
      // - If selected is NOT in DATA_HEADERS (missing), still show it
      const options = [];

      (DATA_HEADERS || []).forEach(function (h) {
        if (!usedByOthers[h] || h === selected) options.push(h);
      });

      if (selected && options.indexOf(selected) === -1) {
        // selected might be missing from headers (or filtered), keep visible
        options.unshift(selected);
      }

      options.forEach(function (h) {
        const opt = document.createElement('option');
        opt.value = h;

        const isThisMissingSelected = (isMissingSelected && h === selected);
        opt.textContent = isThisMissingSelected ? ('⚠ ' + h + ' (missing)') : h;

        // Try to color the option text red (works in many CEP/Chromium builds)
        if (isThisMissingSelected) opt.style.color = '#dc3545';

        if (h === selected) opt.selected = true;
        sel.appendChild(opt);
      });

      sel.addEventListener('change', function () {
        const ep = this.dataset.endpoint;
        const newCol = String(this.value || '');

        // Remove endpoint from all existing columns (including UNMAPPED_KEY)
        Object.keys(keyMapObj || {}).forEach(function (col) {
          const arr = keyMapObj[col];
          if (!Array.isArray(arr)) return;
          const idx = arr.indexOf(ep);
          if (idx !== -1) arr.splice(idx, 1);
          if (!arr.length) delete keyMapObj[col];
        });

        // If user picked a column, map to it. If "None", keep it in UNMAPPED_KEY.
        if (newCol) {
          if (!Array.isArray(keyMapObj[newCol])) keyMapObj[newCol] = [];
          if (keyMapObj[newCol].indexOf(ep) === -1) keyMapObj[newCol].push(ep);
        } else {
          if (!Array.isArray(keyMapObj[UNMAPPED_KEY])) keyMapObj[UNMAPPED_KEY] = [];
          if (keyMapObj[UNMAPPED_KEY].indexOf(ep) === -1) keyMapObj[UNMAPPED_KEY].push(ep);
        }

        syncTextareaFromObj();
        renderKeyMapBuilderFromObj();
      });

      tdSelect.appendChild(sel);
      tr.appendChild(tdSelect);

      // Status cell
      const tdStatus = document.createElement('td');
      tdStatus.style.whiteSpace = 'nowrap';

      const statusBits = [];
      const isMissing = !!(selected && hasData && DATA_HEADERS.indexOf(selected) === -1);
      const isMapped = !!selected;

      // dup warning can still stack with anything
      if (cols.length > 1) statusBits.push('<span class="badge bg-warning text-dark">dup</span>');

      // main state (exclusive)
      if (!isMapped) {
        statusBits.push('<span class="badge bg-secondary">unmapped</span>');
      } else if (isMissing) {
        statusBits.push('<span class="badge bg-danger">missing</span>');
      } else {
        statusBits.push('<span class="badge bg-success">mapped</span>');
      }

      tdStatus.innerHTML = statusBits.join(' ');
      tr.appendChild(tdStatus);

      kmBuilderBody.appendChild(tr);
    });

    // Summary warnings
    const missingCols = [];
    const dupCount = endpoints.reduce(function (acc, ep) {
      return acc + (findColumnsForEndpoint(keyMapObj, ep).length > 1 ? 1 : 0);
    }, 0);

    // Missing columns = keyMapObj keys not in DATA_HEADERS (only meaningful if data loaded)
    if (hasData) {
      Object.keys(keyMapObj || {}).forEach(function (col) {
        if (col === UNMAPPED_KEY) return; // ignore reserved bucket
        if (DATA_HEADERS.indexOf(col) === -1) missingCols.push(col);
      });
    }

    const parts = [];
    if (!hasData) parts.push('<span class="text-muted">No data loaded.</span>');
    if (missingCols.length) parts.push('<span class="text-danger">Missing columns: ' + missingCols.slice(0, 5).map(escapeHtml).join(', ') + (missingCols.length > 5 ? '…' : '') + '</span>');
    if (dupCount) parts.push('<span class="text-warning">Duplicate mappings: ' + dupCount + '</span>');

    setKeyMapWarning(parts.join('<br>'));
    if (typeof updateToggleAllPathsButton === 'function') updateToggleAllPathsButton();
  }


  function removeEndpointFromKeyMapObj(endpoint) {
    const ep = String(endpoint || '').trim();
    if (!ep || !keyMapObj) return false;

    let removed = false;

    Object.keys(keyMapObj).forEach(function (col) {
      const arr = keyMapObj[col];
      if (!Array.isArray(arr)) return;

      const before = arr.length;
      // remove all occurrences (including duplicates)
      keyMapObj[col] = arr.filter(function (x) { return String(x) !== ep; });

      if (keyMapObj[col].length !== before) removed = true;

      if (!keyMapObj[col].length) delete keyMapObj[col];
    });

    return removed;
  }

  function openKeyMapDeleteModal(endpoint) {
    kmPendingDeleteEndpoint = endpoint;

    const pathEl = document.getElementById('kmDeletePath');
    if (pathEl) pathEl.textContent = formatAeTargetPath(endpoint);

    const modalEl = document.getElementById('kmDeleteModal');
    if (!modalEl || !window.bootstrap || !bootstrap.Modal) {
      // fallback if bootstrap modal not available
      const ok = confirm('Remove this AE target from KeyMap?\n\n' + formatAeTargetPath(endpoint));
      if (ok) {
        removeEndpointFromKeyMapObj(endpoint);
        syncTextareaFromObj();
        renderKeyMapBuilderFromObj();
      }
      return;
    }

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }

// wire confirm button once
(function initKeyMapDeleteModal(){
  const btn = document.getElementById('kmDeleteConfirmBtn');
  if (!btn) return;

  btn.addEventListener('click', function () {
    const ep = kmPendingDeleteEndpoint;
    kmPendingDeleteEndpoint = null;

    const didRemove = removeEndpointFromKeyMapObj(ep);

    syncTextareaFromObj();
    renderKeyMapBuilderFromObj();

    const modalEl = document.getElementById('kmDeleteModal');
    if (modalEl && window.bootstrap && bootstrap.Modal) {
      bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }

    if (!didRemove) {
      // optional: log to your UI
      // log('ℹ️ AE target was not found in KeyMap (maybe already removed).');
    }
  });
})();



  let SELECTED_DTYPE = (document.querySelector('input[name="dtype"]:checked') || {}).value || 'csv';

  // ---------- CEP bridge ----------
  function evalScript(code, cb) {
    try {
      if (window.__adobe_cep__ && typeof window.__adobe_cep__.evalScript === 'function') {
        window.__adobe_cep__.evalScript(code, cb);
      } else {
        log('⚠️ CEP bridge not available. Open via Window → Extensions (Legacy).');
        cb && cb(null);
      }
    } catch (e) {
      log('⚠️ evalScript error: ' + e);
      cb && cb(null);
    }
  }

  function aeAlert(msg) {
    try {
      var s = String(msg || '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n');
      evalScript('alert("' + s + '")', function () { });
    } catch (e) {
      try { alert(msg); } catch (e2) { }
    }
  }

  function callHost(fn, args, cb) {
    const ser = (v) =>
      String(v)
        .replace(/\\/g, '/')
        .replace(/"/g, '\\"')
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');

    const code =
      'Fastoosh.' +
      fn +
      '(' +
      (args ? args.map((a) => '"' + ser(a) + '"').join(',') : '') +
      ')';

    try {
      if (window.__adobe_cep__ && typeof window.__adobe_cep__.evalScript === 'function') {
        window.__adobe_cep__.evalScript(code, cb);
      } else {
        cb && cb(null);
      }
    } catch (e) {
      cb && cb(null);
    }
  }

  // ---------- UI helpers ----------
  function getSkeletonIgnoreOptions() {
    return {
      ignoreHidden: !!(skIgnoreHiddenCB && skIgnoreHiddenCB.checked),
      ignoreLocked: !!(skIgnoreLockedCB && skIgnoreLockedCB.checked),
    };
  }

  function log(msg) {
    const ts = new Date().toLocaleTimeString();
    logEl.textContent += `[${ts}] ${msg}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function filterPending(rows, statusKey) {
    const key = String(statusKey || 'status').toLowerCase();
    return (rows || []).filter(r => String(r[key] || '').toLowerCase() === 'ready');
  }

  function renderPreviewPending(rows, statusKey) {
    const pend = filterPending(rows, statusKey);
    if (!pend.length) {
      previewEl.innerHTML = '<em>✅ All rows are done — nothing ready.</em>';
      if (btnProcessPending) btnProcessPending.disabled = true;
      return;
    }
    if (btnProcessPending) btnProcessPending.disabled = false;

    const headers = Object.keys(pend[0] || {});
    let html = '<table class="grid"><thead><tr>' +
      headers.map(h => `<th>${h}</th>`).join('') +
      '</tr></thead><tbody>';
    pend.forEach(r => {
      html += '<tr>' + headers.map(h => `<td>${(r[h] ?? '')}</td>`).join('') + '</tr>';
    });
    html += '</tbody></table>';
    previewEl.innerHTML = html;
  }

  // ---------- Parsing ----------
  function parseCSV(text) {
    if (!text) return [];
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n').filter(l => l.trim().length);
    if (!lines.length) return [];
    const sample = lines.slice(0, Math.min(5, lines.length));
    const cand = [',', ';', '\t'], score = { ',': 0, ';': 0, '\t': 0 };
    sample.forEach(l => cand.forEach(ch => score[ch] += l.split(ch).length - 1));
    const delim = cand.reduce((b, ch) => score[ch] > score[b] ? ch : b, ',');
    const rows = lines.map(l => l.split(delim));
    const headers = rows.shift().map(h => h.trim());
    const out = [];
    rows.forEach(r => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = (r[i] === undefined ? '' : String(r[i]).trim()));
      if (Object.values(obj).some(v => v !== '')) out.push(obj);
    });
    return out;
  }

  function normalizeJSON(data) {
    const src = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
    return src.map(row => {
      const flat = {};
      for (var k in row) {
        if (!row.hasOwnProperty(k)) continue;
        const v = row[k];
        if (Array.isArray(v) && v[0] && typeof v[0] === 'object' && ('value' in v[0])) {
          flat[k] = v[0].value;
        } else {
          flat[k] = v;
        }
      }
      return flat;
    });
  }

  // Convert simple row -> Fastoosh items format (PRESERVE empty cells)
  function rowToItems(row, statusKey) {
    const out = {};
    const mediaExt = /\.(jpg|jpeg|png|psd|ai|eps|pdf|tif|tiff|gif|mov|mp4|m4v|avi|webm|mkv)$/i;
    for (var k in row) {
      if (!row.hasOwnProperty(k)) continue;
      if (String(k).toLowerCase() === String(statusKey).toLowerCase()) continue;

      const raw = row[k];
      const val = (raw === undefined || raw === null) ? "" : String(raw);
      const isMedia = mediaExt.test(val);
      out[k] = [{ value: val, type: isMedia ? "media" : "text" }];
    }
    return { items: [out] };
  }

  // ---------- Host calls ----------
  function refreshComps() {
    callHost('listComps', null, (json) => {
      try {
        const arr = JSON.parse(json || '[]');

        let html = '<option value="">Select template comp…</option>';
        html += arr.map(n => `<option value="${n}">${n}</option>`).join('');

        templateSel.innerHTML = html;
        log('Comps listed: ' + arr.length);

        evalScript(
          '(function(){' +
          'var p = app.project;' +
          'if (p && p.activeItem && p.activeItem instanceof CompItem) return p.activeItem.name;' +
          'return "";' +
          '})()',
          function (activeName) {
            if (!activeName) return;
            if (arr.indexOf(activeName) !== -1) {
              templateSel.value = activeName;
              log('Auto-selected active comp as template: ' + activeName);
            }
          }
        );

      } catch (e) {
        log('List comps parse error: ' + e);
      }
    });
  }

  function refreshOutputModules() {
    callHost('listOutputModules', null, (json) => {
      try {
        const arr = JSON.parse(json || '[]');
        if (!Array.isArray(arr)) throw new Error('invalid OM list');
        omSelect.innerHTML = arr.map(n => `<option value="${n}">${n}</option>`).join('');
        log(`Output modules: ${arr.length} found`);
      } catch (e) {
        log('⚠️ Cannot list output modules: ' + e);
        if (omSelect) omSelect.innerHTML = '';
      }
    });
  }

  function readTextFile(p, cb) {
    callHost('readTextFile', [p], (txt) => cb(txt && txt !== 'null' ? txt : null));
  }

  function ensureOutputFolderIfNeeded(next) {
    if (!isProTier()) return next();
    if (!addToQueueCB.checked) return next();
    let out = (outputPath.value || '').trim();
    if (out) return next();
    callHost('chooseFolder', null, (p) => {
      if (p && p !== 'null') {
        outputPath.value = p;
        log('📁 Selected render output: ' + p);
        next();
      } else {
        log('⚠️ Render output not chosen. Aborting queuing.');
      }
    });
  }

  function processRows(rows) {
    const tComp = (templateSel && templateSel.value) ? templateSel.value : '';
    const folder = compsFolder.value || 'Generated_Comps';
    const photos = imagesPath.value || '';
    const statusKey = statusCol.value || 'status';
    const strict = !!strictCB.checked;


    // Free tier safety: enforce limits even if UI is bypassed.
    const proTier = isProTier();
    if (!proTier && rows && rows.length > FREE_MAX_ROWS) {
      rows = rows.slice(0, FREE_MAX_ROWS);
    }

    if (!tComp) {
      aeAlert('Please select a template comp in Project Setup before processing.');
      log('⚠️ Process aborted: no template comp selected.');
      return;
    }

    // --- Nested precomps: checkbox + dropdown ---
    const advancedNested = !!(proTier && reuseNestedCB && reuseNestedCB.checked);

    let nestedPolicy = 'auto'; // default
    if (advancedNested && nestedPolicySel) {
      const raw = (nestedPolicySel.value || '').trim();
      if (raw === 'auto' || raw === 'duplicate' || raw === 'reuse') {
        nestedPolicy = raw;
      }
    }

    // Boolean kept for backward compatibility (Host uses this now)
    const reuseNested = (advancedNested && nestedPolicy === 'reuse');

    // --- KeyMap ---
    let keyMap = {};
    try { keyMap = JSON.parse(keyMapTA.value || '{}'); }
    catch (e) {
      log('KeyMap JSON invalid; using {}');
      keyMap = {};
    }

    // --- Naming options ---
    const rawNameColumn = nameColumnSel ? (nameColumnSel.value || '') : '';
    const usePrefix = (proTier && usePrefixCB) ? !!usePrefixCB.checked : false;
    const namePrefix = namePrefixInp ? (namePrefixInp.value || '') : '';

    let nameColumn = '';
    let nameMode = 'auto';

    if (usePrefix) {
      nameColumn = '';
      nameMode = 'auto';
    } else if (rawNameColumn) {
      nameColumn = rawNameColumn;
      nameMode = 'column';
    } else {
      nameColumn = '';
      nameMode = 'auto';
    }

    const dataFileName = (dataPath.value || '').split(/[\/\\]/).pop() || '';
    log('Nested advanced: ' + advancedNested + ' | policy=' + nestedPolicy);

    const payload = {
      rows: rows.map(r => rowToItems(r, statusKey)),
      photosFolder: photos,
      templateCompName: tComp,
      compsFolderName: folder,
      strictMode: strict,

      // OLD boolean
      reuseNested: reuseNested,

      // NEW explicit policy
      nestedPolicy: nestedPolicy,

      keyMap: keyMap,
      dataFileName: dataFileName,
      nameOptions: {
        mode: nameMode,   // 'auto' | 'column'
        column: nameColumn,
        prefix: namePrefix
      },
      renderOptions: {
        addToQueue: !!addToQueueCB.checked,
        autoRender: !!autoRenderCB.checked,
        outputDir: outputPath.value || '',
        outputModuleTemplate: (omSelect && omSelect.value) ? omSelect.value : ''
      }
    };

    const s = encodeURIComponent(JSON.stringify(payload));
    evalScript(
      'Fastoosh.processBatch(decodeURIComponent("' + s + '"))',
      function (res) {
        log(res != null ? String(res) : '⚠️ JSX returned no message.');
      }
    );
  }

  // ---------- Events ----------

  if (btnAsPlaceholder) {
    btnAsPlaceholder.addEventListener('click', function (e) {
      const removeMode = (e.altKey || e.metaKey) ? '1' : '0';
      callHost('renameSelectedAsPlaceholder', [removeMode], (res) => {
        const _logEl = document.getElementById('log');
        if (_logEl) {
          const ts = new Date().toLocaleTimeString();
          _logEl.textContent += `[${ts}] ${res || 'Done.'}\n`;
          _logEl.scrollTop = _logEl.scrollHeight;
        }
      });
    });
  }

  const btnMarkIgnored = document.getElementById('btnMarkIgnored');
  if (btnMarkIgnored) {
    btnMarkIgnored.addEventListener('click', function (e) {
      const removeFlag = (e.altKey || e.metaKey || e.ctrlKey) ? "1" : "0";
      callHost('markSelectedIgnored', [removeFlag], (res) => {
        log(res || 'Done.');
      });
    });
  }

  if (kmHelpBtn && kmHelpBox) {
    kmHelpBtn.addEventListener('click', () => kmHelpBox.classList.toggle('hidden'));
  }

  dtypeRadios.forEach(r => r.addEventListener('change', (e) => {
    SELECTED_DTYPE = e.target.value;
  }));

  exportTypeRadios.forEach(r => r.addEventListener('change', (e) => {
    SELECTED_EXPORT_TYPE = e.target.value;
  }));

  btnChooseImages.onclick = function () {
    callHost('chooseFolder', null, (p) => {
      if (p && p !== 'null') {
        imagesPath.value = p;
        log('📁 Selected images folder: ' + p);
      }
    });
  };

  btnChooseData.onclick = function () {
    const filter = SELECTED_DTYPE === 'json' ? '*.json' : '*.csv';
    callHost('chooseFileWithFilter', [filter], (p) => {
      if (p && p !== 'null') {
        dataPath.value = p;
        log('📁 Selected data file: ' + p);
      } else {
        log('❌ No file selected.');
      }
    });
  };

  btnChooseOutput && (btnChooseOutput.onclick = function () {
    callHost('chooseFolder', null, (p) => {
      if (p && p !== 'null') {
        outputPath.value = p;
        log('📁 Selected render output: ' + p);
      }
    });
  });

  btnEditCompsFolder.onclick = function () {
    const v = prompt('AE folder name for generated comps:', compsFolder.value || 'Generated_Comps');
    if (v !== null) compsFolder.value = v;
  };

  addToQueueCB.onchange = function () {
    const show = addToQueueCB.checked;
    $('outBlock').style.display = show ? '' : 'none';
    $('autoBlock').style.display = show ? '' : 'none';
    if ($('omBlock')) $('omBlock').style.display = show ? '' : 'none';
    if (show) refreshOutputModules();
  };

  if (btnRefreshOMs) btnRefreshOMs.onclick = refreshOutputModules;

  btnLoadData.onclick = function () {
    const p = dataPath.value;
    if (!p) {
      log('⚠️ No data file selected. Choose a CSV/JSON file first.');
      aeAlert('No data file selected.\n\nPlease choose a CSV or JSON data file before clicking "Load data".');
      return;
    }
    readTextFile(p, (txt) => {
      if (!txt) {
        log('⚠️ Could not read file: ' + p);
        return;
      }

      if (txt === "ERR_BAD_ENCODING") {
        log('❌ Encoding error: File is not UTF-8.');
        aeAlert(
          "Your CSV contains accents but is NOT encoded in UTF-8.\n\n" +
          "Please re-save the file as:\n" +
          "- Excel: CSV UTF-8 (Comma delimited)\n" +
          "- Google Sheets: Download → CSV\n" +
          "- LibreOffice/Numbers: Export UTF-8 (+ BOM if possible)\n"
        );
        return;
      }

      if (txt === "ERR_NOT_FOUND" || txt === "ERR_OPEN_FAIL") {
        log('❌ Cannot open file: ' + p);
        return;
      }

      try {
        if (SELECTED_DTYPE === 'csv') {
          DATA_ROWS = parseCSV(txt);
          log('Loaded ' + DATA_ROWS.length + ' rows from CSV.');
        } else {
          const parsed = JSON.parse(txt);
          DATA_ROWS = normalizeJSON(parsed);
          log('Loaded ' + DATA_ROWS.length + ' rows from JSON.');
        }



        // Free tier: clamp loaded rows and notify user when data exceeds the limit.
        try {
          const totalRows = (DATA_ROWS && DATA_ROWS.length) ? DATA_ROWS.length : 0;
          if (!isProTier() && totalRows > FREE_MAX_ROWS) {
            aeAlert(
              'Free version limitation\n\n' +
              'This data file contains ' + totalRows + ' rows.\n' +
              'We will proceed with only the first ' + FREE_MAX_ROWS + ' rows.'
            );
            DATA_ROWS = DATA_ROWS.slice(0, FREE_MAX_ROWS);
            log('Free tier: using first ' + FREE_MAX_ROWS + ' rows (of ' + totalRows + ').');
          }
        } catch (e) { }

                const firstRow = (DATA_ROWS && DATA_ROWS.length) ? DATA_ROWS[0] : null;
        if (firstRow && nameColumnSel) {
          const statusKey = (statusCol.value || 'status').toLowerCase();
          const headers = Object.keys(firstRow);

          let opts = '<option value="">(auto naming)</option>';
          headers.forEach(h => {
            if (String(h).toLowerCase() === statusKey) return;
            opts += `<option value="${h}">${h}</option>`;
          });

          nameColumnSel.innerHTML = opts;

          // KeyMap Builder: refresh column dropdowns
          try {
            const statusKey2 = (statusCol.value || 'status').toLowerCase();
            DATA_HEADERS = headers.filter(h => String(h).toLowerCase() !== statusKey2);
            refreshKeyMapBuilderDropdowns(DATA_HEADERS);
          } catch (e) { }

          log('Updated name column choices (' + headers.length + ' headers).');
        }

        renderPreviewPending(DATA_ROWS, statusCol.value || 'status');

        const sc = statusCol.value || 'status';
        const pend = filterPending(DATA_ROWS, sc);
        log(`Ready rows found: ${pend.length} (status column: '${sc}')`);
      } catch (e) {
        log('Parse error: ' + e);
      }
    });
  };

  if (btnExportData) {
    btnExportData.onclick = function () {
      const compName = (templateSel && templateSel.value) ? templateSel.value : '';
      const kind = (document.querySelector('input[name="exportType"]:checked') || {}).value || 'csv';
      const suggested = (kind === 'json') ? 'data_skeleton.json' : 'data_header.csv';

      if (!compName) {
        aeAlert('Please select a template comp in Project Setup before exporting a skeleton.');
        log('⚠️ Export skeleton aborted: no template comp selected.');
        return;
      }

      callHost('promptSave', [kind, suggested], (chosenPath) => {
        if (!chosenPath || chosenPath === 'null') {
          log('❌ Export cancelled.');
          return;
        }
        let out = chosenPath.replace(/\\/g, '/');
        if (kind === 'csv' && !/\.csv$/i.test(out)) out = out.replace(/\.[^\/\.]+$/, '') + '.csv';
        if (kind === 'json' && !/\.json$/i.test(out)) out = out.replace(/\.[^\/\.]+$/, '') + '.json';

        const ignoreOpts = getSkeletonIgnoreOptions();

        log(`Export skeleton → ${kind.toUpperCase()} → ${out}`);
        callHost(
          'exportSkeleton',
          [
            out,
            compName,
            kind,
            ignoreOpts.ignoreHidden ? '1' : '0',
            ignoreOpts.ignoreLocked ? '1' : '0'
          ],
          (res) => {
            log(res || ('✅ Exported ' + kind.toUpperCase() + ' skeleton to: ' + out));
          }
        );
      });
    };
  }

  if (btnGenerateKeymap) {
    btnGenerateKeymap.onclick = function () {
      const compName = (templateSel && templateSel.value) ? templateSel.value : '';
      if (!compName) {
        aeAlert('No template comp selected.\nPick a template before generating a KeyMap.');
        log('⚠️ KeyMap generation aborted: no template comp selected.');
        return;
      }

      const opts = getSkeletonIgnoreOptions();

      log('🔍 Generating KeyMap from template: ' + compName + ' …');
      callHost(
        'generateKeymapText',
        [
          compName,
          opts.ignoreHidden ? '1' : '0',
          opts.ignoreLocked ? '1' : '0'
        ],
        (res) => {
          if (!res) {
            log('❌ KeyMap generation failed or returned empty data.');
            return;
          }
          try {
            keyMapTA.value = res;

            // Sync builder/object
            const ok = syncObjFromTextarea();
            if (!ok) {
              log('⚠️ Generated KeyMap could not be parsed as JSON for the builder.');
              // keep textarea as-is, but don't demap (we don't have a valid object)
              return;
            }

            // Half-automated: keep endpoints, clear mappings (dropdowns start as None)
            demapAllToUnmapped();

            log('✅ KeyMap generated into the textarea (respecting ignore options).');
          } catch (e) {
            log('❌ Could not update KeyMap textarea: ' + e);
          }
        }
      );
    };
  }


  if (btnExportKeymap) {
    btnExportKeymap.onclick = function () {
      const raw = (keyMapTA && keyMapTA.value) ? keyMapTA.value.trim() : '';

      if (!raw) {
        aeAlert(
          "KeyMap is empty.\n\n" +
          "Generate a keymap first or paste/edit your own JSON before exporting."
        );
        log('❌ Keymap export aborted: textarea is empty.');
        return;
      }

      const suggested = 'keymap.json';
      callHost('promptSave', ['json', suggested], (chosenPath) => {
        if (!chosenPath || chosenPath === 'null') {
          log('❌ Keymap export cancelled.');
          return;
        }

        let out = chosenPath.replace(/\\/g, '/');
        if (!/\.json$/i.test(out)) {
          out = out.replace(/\.[^\/\.]+$/, '') + '.json';
        }

        log(`Export keymap → ${out}`);

        callHost('saveTextFile', [out, raw], (res) => {
          if (res && String(res).indexOf('OK') === 0) {
            log('✅ Keymap written: ' + out);
          } else {
            const msg = res || 'Unknown error';
            log('⚠️ Keymap export may have failed: ' + msg);
            aeAlert("Keymap export may have failed.\n\n" + msg);
          }
        });
      });
    };
  }

  if (btnImportKeymap) {
    btnImportKeymap.onclick = function () {
      callHost('chooseFileWithFilter', ['*.json'], (p) => {
        if (!p || p === 'null') {
          log('❌ No keymap file selected.');
          return;
        }

        log('📁 Selected KeyMap file: ' + p);

        readTextFile(p, (txt) => {
          if (!txt) {
            log('⚠️ Could not read keymap file: ' + p);
            aeAlert('Could not read the selected KeyMap file.');
            return;
          }

          if (txt === 'ERR_BAD_ENCODING') {
            log('❌ Encoding error while reading KeyMap.');
            aeAlert(
              "The KeyMap file is not encoded as UTF-8.\n\n" +
              "Please re-save it as UTF-8 and try again."
            );
            return;
          }

          if (txt === 'ERR_NOT_FOUND' || txt === 'ERR_OPEN_FAIL') {
            log('❌ Cannot open KeyMap file: ' + p);
            aeAlert(
              "Cannot open the selected KeyMap file.\n\n" +
              "Check the path and permissions, then try again."
            );
            return;
          }

          try {
            const obj = JSON.parse(txt);
            keyMapTA.value = JSON.stringify(obj, null, 2);
            // Sync builder/object
            if (!syncObjFromTextarea()) {
              log('⚠️ Imported KeyMap could not be parsed as JSON for the builder.');
            }
            log('✅ KeyMap imported and pretty-printed into the textarea.');
          } catch (e) {
            keyMapTA.value = txt;
            log('⚠️ KeyMap file is not valid JSON. Raw content inserted.');
            aeAlert(
              "The selected KeyMap file is not valid JSON.\n\n" +
              "Raw content was inserted into the KeyMap box.\n" +
              "Fix the JSON or regenerate the KeyMap."
            );
          }
        });
      });
    };
  }

  btnProcessPending.onclick = function () {
    if (!DATA_ROWS || !DATA_ROWS.length) {
      log('⚠️ No data loaded.');
      aeAlert('⚠️ No data loaded.\n\nChoose a CSV/JSON and click "Load Data" first.');
      return;
    }

    const sc = statusCol.value || 'status';
    const pend = filterPending(DATA_ROWS, sc);

    if (!pend.length) {
      log('✅ No ready rows (status column: "' + sc + '").');
      aeAlert('✅ No ready rows.\n\nChange some rows to "ready" and reload the file.');
      return;
    }

    log('Processing ' + pend.length + ' ready rows…');
    ensureOutputFolderIfNeeded(() => processRows(pend));
  };

  btnProcessAll.onclick = function () {
    if (!DATA_ROWS || !DATA_ROWS.length) {
      log('⚠️ No data loaded.');
      aeAlert('⚠️ No data loaded.\n\nChoose a CSV/JSON and click "Load Data" first.');
      return;
    }

    if (!isProTier()) {
      aeAlert('Process all is a Pro feature.\n\nIn the free version, the tool processes up to ' + FREE_MAX_ROWS + ' rows.');
      log('🔒 Pro feature blocked: Process all');
      return;
    }

    log('Processing all ' + DATA_ROWS.length + ' rows…');
    ensureOutputFolderIfNeeded(() => processRows(DATA_ROWS));
  };

  btnRefreshComps && (btnRefreshComps.onclick = refreshComps);

  function init() {
    // Free tier default: lock Pro-only controls until license check completes.
    try { setLocked(true); } catch (e) { }
    // --- Panel menu + licensing wiring ---
    if (btnLicense) btnLicense.addEventListener('click', function () { setLicenseDetailsFromData(readLocalLicense(), null); openModal(licenseModalEl); });
    if (menuLicense) menuLicense.addEventListener('click', function () { setLicenseDetailsFromData(readLocalLicense(), null); openModal(licenseModalEl); });

    if (menuDocumentation) menuDocumentation.addEventListener('click', function () {
      openExternalUrl(DOCUMENTATION_URL);
    });

    if (menuAbout) menuAbout.addEventListener('click', function () {
      refreshAbout();
      openModal(aboutModalEl);
    });

    if (licenseToolPageLink) licenseToolPageLink.addEventListener('click', function (e) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      openExternalUrl(TOOL_PAGE_URL);
    });

    if (aboutToolsLink) aboutToolsLink.addEventListener('click', function (e) {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      openExternalUrl('https://www.fastoosh.com/tools/');
    });
if (menuCopyDiagnostics) menuCopyDiagnostics.addEventListener('click', function () {
      const txt = getDiagnosticsText();
      copyToClipboard(txt);
      if (supportModalMsg) {
        supportModalMsg.textContent = 'Diagnostics copied to clipboard.';
        supportModalMsg.className = 'small mt-2 text-success';
      }
    });

    if (menuReportBug) menuReportBug.addEventListener('click', function () {
      if (supportModalMsg) { supportModalMsg.textContent = ''; supportModalMsg.className = 'small mt-2'; }
      openModal(supportModalEl);
    });

    if (btnCopyBugReport) btnCopyBugReport.addEventListener('click', function () {
      const userText = (supportText && supportText.value) ? supportText.value.trim() : '';
      const payload = [
        '--- BUG REPORT ---',
        userText || '(no details provided)',
        '',
        '--- DIAGNOSTICS ---',
        getDiagnosticsText()
      ].join('\n');
      copyToClipboard(payload);
      if (supportModalMsg) {
        supportModalMsg.textContent = 'Report copied to clipboard.';
        supportModalMsg.className = 'small mt-2 text-success';
      }
    });

    if (btnRefreshLicense) btnRefreshLicense.addEventListener('click', function () {
      const local = readLocalLicense();
      const key = (licenseKeyInput && licenseKeyInput.value) ? licenseKeyInput.value.trim() : ((local && local.licenseKey) ? String(local.licenseKey).trim() : '');
      if (!key) { setLicenseIcon('unlicensed', 'Paste your license key first.'); setLicenseDetailsFromData(null, null); return; }
      const instanceId = (local && local.instanceId) ? local.instanceId : null;
      setLicenseIcon('checking', 'Refreshing license…');
      lemonValidate(key, instanceId, function (err, json) {
        if (err) { setLicenseIcon('error', 'Could not verify license: ' + netErrToString(err)); setLicenseDetailsFromData(local, null); return; }
        applyLicenseResult(key, json, { showModal: true });
      });
    });

    if (btnDeactivateLicense) btnDeactivateLicense.addEventListener('click', function () {
      const local = readLocalLicense();
      const key = (licenseKeyInput && licenseKeyInput.value) ? licenseKeyInput.value.trim() : ((local && local.licenseKey) ? String(local.licenseKey).trim() : '');
      const instanceId = local && local.instanceId ? String(local.instanceId).trim() : '';
      if (!key || !instanceId) {
        setLicenseIcon('unlicensed', 'No activated device was found to deactivate.');
        setLicenseDetailsFromData(local, null);
        return;
      }

      setLicenseIcon('checking', 'Deactivating this device…');
      lemonDeactivate(key, instanceId, function (err, json) {
        if (err) {
          setLicenseIcon('error', 'Could not deactivate device: ' + netErrToString(err));
          setLicenseDetailsFromData(local, null);
          return;
        }

        if (!json || !json.deactivated) {
          setLicenseIcon('error', mapLicenseApiError(json, 'Could not deactivate this device.'));
          setLicenseDetailsFromData(local, null);
          return;
        }

        try { deleteLocalLicense(); } catch (e) { }
        if (licenseKeyInput) licenseKeyInput.value = '';
        setLocked(true);
        setLicenseIcon('unlicensed', 'This device was deactivated.');
        setLicenseDetailsFromData(null, null);
      });
    });

    // Validate is now smart (activate only when needed; otherwise refresh)
    wireValidateButtonSmart();


    // --- KeyMap Builder wiring ---
    if (kmModeSimpleBtn) kmModeSimpleBtn.addEventListener('click', function () {
      // When coming from JSON mode, try to parse textarea first
      if (KEYMAP_MODE === 'json') {
        const ok = syncObjFromTextarea();
        if (!ok) {
          aeAlert('KeyMap JSON is not valid. Fix it (or regenerate) then click Apply JSON.');
          return;
        }
      }
      setKeyMapMode('simple');
    });

    if (kmModeJsonBtn) kmModeJsonBtn.addEventListener('click', function () {
      setKeyMapMode('json');
    });

    if (kmApplyJsonBtn) kmApplyJsonBtn.addEventListener('click', function () {
      const ok = syncObjFromTextarea();
      if (!ok) {
        aeAlert('KeyMap JSON is not valid. Please fix the JSON and try again.');
        return;
      }
      log('✅ KeyMap JSON applied to the builder.');
      setKeyMapMode('simple');
    });
    if (kmToggleAllPathsBtn) {
      kmToggleAllPathsBtn.addEventListener('click', function (e) {
        e.preventDefault();

        const endpoints = getAllEndpointsFromObj(keyMapObj);
        if (!endpoints.length) return;

        const allExpanded = endpoints.every(ep => kmExpandedTargets.has(ep));

        if (allExpanded) {
          endpoints.forEach(ep => kmExpandedTargets.delete(ep));
        } else {
          endpoints.forEach(ep => kmExpandedTargets.add(ep));
        }

        renderKeyMapBuilderFromObj();
      });
    }

    // Initialize object from textarea (if any) + default mode
    if (keyMapTA && keyMapTA.value && keyMapTA.value.trim()) {
      if (!syncObjFromTextarea()) {
        // leave as-is; user can fix in JSON mode
        setKeyMapMode('json');
      } else {
        setKeyMapMode('simple');
      }
    } else {
      setKeyMapObj({});
      setKeyMapMode('simple');
    }

    // License check on startup
    checkLicenseOnStartup();

    // Version check — runs after initNodeModules() was called by checkLicenseOnStartup
    checkForUpdate();

    // Wire up update modal buttons
    var btnUpdateDownload = $('btnUpdateDownload');
    var btnUpdateChangelog = $('btnUpdateChangelog');
    var btnUpdateDismiss = $('btnUpdateDismiss');

    if (btnUpdateDownload) {
      btnUpdateDownload.addEventListener('click', function () {
        // LemonSqueezy customer portal — works for every buyer regardless of Fastoosh account
        openExternalUrl('https://app.lemonsqueezy.com/my-orders');
      });
    }

    if (btnUpdateChangelog) {
      btnUpdateChangelog.addEventListener('click', function () {
        openExternalUrl(TOOL_PAGE_URL);
      });
    }

    if (btnUpdateDismiss) {
      btnUpdateDismiss.addEventListener('click', function () {
        // Remember dismissed version so we don't show again until a newer one exists
        var latestEl = $('updateModalLatestVersion');
        var v = latestEl ? latestEl.textContent.trim() : '';
        if (v && v !== '\u2014' && v !== '-') {
          try { localStorage.setItem('fda_dismissed_version', v); } catch (e) {}
        }
        closeModal(updateModalEl);
      });
    }

    // Manual "Check for updates" menu item
    var menuCheckUpdates = $('menuCheckUpdates');
    if (menuCheckUpdates) {
      menuCheckUpdates.addEventListener('click', function () {
        // Close the dropdown first
        try {
          var ddEl = $('btnPanelMenu');
          if (ddEl && window.bootstrap && bootstrap.Dropdown) {
            var dd = bootstrap.Dropdown.getInstance(ddEl);
            if (dd) dd.hide();
          }
        } catch (e) {}
        manualCheckForUpdate();
      });
    }

    refreshComps();
    addToQueueCB.onchange();

    // usePrefix UI logic
    if (usePrefixCB) {
      usePrefixCB.addEventListener('change', function () {
        const row = document.getElementById('namePrefixRow');
        if (row) row.style.display = usePrefixCB.checked ? '' : 'none';

        if (nameColumnSel) {
          nameColumnSel.disabled = !!usePrefixCB.checked;
          if (usePrefixCB.checked) nameColumnSel.classList.add('disabled');
          else nameColumnSel.classList.remove('disabled');
        }
      });
    }

    // Nested precomps checkbox controls dropdown visibility
    if (reuseNestedCB) {
      const nestedPolicyRow = document.getElementById('nestedPolicyRow');

      function syncNestedUI() {
        const enabled = !!reuseNestedCB.checked;
        if (nestedPolicyRow) nestedPolicyRow.style.display = enabled ? '' : 'none';
        if (nestedPolicySel) nestedPolicySel.disabled = !enabled;
        if (!enabled && nestedPolicySel) nestedPolicySel.value = 'auto';
      }

      reuseNestedCB.addEventListener('change', syncNestedUI);
      syncNestedUI();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
