// test_harness.js - Headless Browser, DOM & Solar Ephemeris Test Environment
// 100% Offline, Zero-Dependency Test Infrastructure for Namaz Prayer Times

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

function resolvePath(filename) {
  const localPath = path.resolve(__dirname, '..', filename);
  if (fs.existsSync(localPath)) return localPath;
  const targetPath = path.resolve('C:/Users/Shop PC 2/OneDrive/Desktop/Antigravity Files/02-Namaz-Prayer-Times', filename);
  if (fs.existsSync(targetPath)) return targetPath;
  return localPath;
}

const INDEX_HTML_PATH = resolvePath('index.html');
const VERSION_JSON_PATH = resolvePath('version.json');
const PUSH_BAT_PATH = resolvePath('push_to_github.bat');

// --- REFERENCE ASTRONOMICAL & ISLAMIC CALENDAR ORACLE ---
const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;

function fixAngle(a) { a = a % 360.0; return a < 0 ? a + 360.0 : a; }
function fixHour(h) { h = h % 24.0; return h < 0 ? h + 24.0 : h; }

function getJulianDay(year, month, day) {
  if (month <= 2) { year -= 1; month += 12; }
  const a = Math.floor(year / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5;
}

function calculateSolarCoordinates(jd) {
  const T = (jd - 2451545.0) / 36525.0;
  const L0 = fixAngle(280.46646 + 36000.76983 * T);
  const M = fixAngle(357.52911 + 35999.05029 * T);
  const C = (1.914602 - 0.004817 * T) * Math.sin(M * DEG2RAD)
          + (0.019993 - 0.000101 * T) * Math.sin(2 * M * DEG2RAD)
          + 0.000289 * Math.sin(3 * M * DEG2RAD);
  const trueLong = fixAngle(L0 + C);
  const eps = 23.439291 - 0.0130042 * T;
  const sinDec = Math.sin(eps * DEG2RAD) * Math.sin(trueLong * DEG2RAD);
  const declination = Math.asin(sinDec);
  
  const y = Math.tan((eps / 2.0) * DEG2RAD) ** 2;
  const eotRad = y * Math.sin(2 * L0 * DEG2RAD)
               - 2 * 0.0167086 * Math.sin(M * DEG2RAD)
               + 4 * 0.0167086 * y * Math.sin(M * DEG2RAD) * Math.cos(2 * L0 * DEG2RAD)
               - 0.5 * (y ** 2) * Math.sin(4 * L0 * DEG2RAD)
               - 1.25 * (0.0167086 ** 2) * Math.sin(2 * M * DEG2RAD);
  const eotMinutes = 4.0 * (eotRad * RAD2DEG);

  return { declination, eotMinutes };
}

function computeHourAngle(altitudeDeg, latDeg, declinationRad) {
  const altRad = altitudeDeg * DEG2RAD;
  const latRad = latDeg * DEG2RAD;
  const cosH = (Math.sin(altRad) - Math.sin(latRad) * Math.sin(declinationRad)) /
               (Math.cos(latRad) * Math.cos(declinationRad));
  if (cosH > 1.0 || cosH < -1.0) return null;
  return (Math.acos(cosH) * RAD2DEG) / 15.0;
}

function roundForward(decimalHour) {
  const totalSeconds = Math.round(decimalHour * 3600);
  const hours = Math.floor(totalSeconds / 3600) % 24;
  let minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (seconds > 0) minutes++;
  return hours + (minutes / 60.0);
}

function roundBackward(decimalHour) {
  const totalSeconds = Math.floor(decimalHour * 3600);
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours + (minutes / 60.0);
}

function formatTime12(decimalHour) {
  const totalMinutes = Math.round(decimalHour * 60);
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = (hours24 % 12) === 0 ? 12 : (hours24 % 12);
  return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
}

function calculateAccurateHanafiTimes(lat, lng, date, ihtiyatMode = 'MOSQUE') {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const tzOffsetHours = 5.5; // IST UTC+5:30

  const jd = getJulianDay(year, month, day);
  const solar = calculateSolarCoordinates(jd);

  const transitUTC = 12.0 - (lng / 15.0) - (solar.eotMinutes / 60.0);
  const dhuhrTransit = fixHour(transitUTC + tzOffsetHours);

  const h0 = computeHourAngle(-0.8333, lat, solar.declination) || 6.0;
  const sunriseRaw = fixHour(dhuhrTransit - h0);
  const maghribRaw = fixHour(dhuhrTransit + h0);

  const hFajr = computeHourAngle(-18.0, lat, solar.declination);
  const fajrRaw = hFajr ? fixHour(dhuhrTransit - hFajr) : fixHour(sunriseRaw - 1.5);

  const noonAltitude = 90.0 - Math.abs(lat - (solar.declination * RAD2DEG));
  const noonShadow = Math.tan((90.0 - noonAltitude) * DEG2RAD);
  const asrAltitude = Math.atan(1.0 / (2.0 + noonShadow)) * RAD2DEG;
  const hAsr = computeHourAngle(asrAltitude, lat, solar.declination) || 3.0;
  const asrRaw = fixHour(dhuhrTransit + hAsr);

  const hIsha = computeHourAngle(-18.0, lat, solar.declination);
  const ishaRaw = hIsha ? fixHour(dhuhrTransit + hIsha) : fixHour(maghribRaw + 1.5);

  let suhoorBufferMin = 3;
  let maghribBufferMin = 3;
  if (ihtiyatMode === 'ASTRONOMICAL') {
    suhoorBufferMin = 0;
    maghribBufferMin = 0;
  } else if (ihtiyatMode === 'RAMADAN_SAFE') {
    suhoorBufferMin = 10;
    maghribBufferMin = 3;
  }

  const fajr = roundForward(fajrRaw);
  const sunrise = roundBackward(sunriseRaw);
  const dhuhr = roundForward(dhuhrTransit);
  const asr = roundForward(asrRaw);
  const maghrib = roundForward(maghribRaw + (maghribBufferMin / 60.0));
  const isha = roundForward(ishaRaw);
  const suhoor = roundBackward(fajrRaw - (suhoorBufferMin / 60.0));

  const dahwa = roundBackward((fajrRaw + maghribRaw) / 2.0);
  const zawalStart = roundBackward(dhuhrTransit - (12 / 60.0));
  const ishraq = roundForward(sunriseRaw + (15 / 60.0));
  const chasht = roundForward(sunriseRaw + ((dhuhrTransit - sunriseRaw) / 2.0));
  const nightDuration = fixHour(24.0 - maghribRaw + fajrRaw);
  const tahajjudStart = roundBackward(fixHour(maghribRaw + (nightDuration * (2.0 / 3.0))));

  return { fajr, sunrise, dhuhr, asr, maghrib, isha, suhoor, dahwa, zawalStart, ishraq, chasht, tahajjudStart };
}

// Islamic Month Names
const ISLAMIC_MONTH_NAMES = [
  "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani",
  "Jumada al-Ula", "Jumada al-Thaniyah", "Rajab", "Sha'ban",
  "Ramadan", "Shawwal", "Dhul Qi'dah", "Dhul Hijjah"
];

// Authoritative Maghrib-Sunset Islamic Date Function (Specification Contract)
function getAccurateIslamicDate(targetDate, maghribTimeStr, hijriOffset = 0, currentClockDate = null) {
  let shiftDays = parseInt(hijriOffset, 10) || 0;
  const clock = currentClockDate || targetDate;

  // Check if current clock time on targetDate is at or past Maghrib
  let isPastSunset = false;
  if (maghribTimeStr) {
    let maghribHour = 0;
    if (typeof maghribTimeStr === 'number') {
      maghribHour = maghribTimeStr;
    } else if (typeof maghribTimeStr === 'string') {
      const parts = maghribTimeStr.trim().split(/[: ]/);
      if (parts.length >= 2) {
        let h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const ampm = (parts[2] || '').toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        maghribHour = h + (m / 60.0);
      }
    }
    const currentHour = clock.getHours() + (clock.getMinutes() / 60.0) + (clock.getSeconds() / 3600.0);
    if (currentHour >= maghribHour) {
      isPastSunset = true;
      shiftDays += 1;
    }
  }

  const calcDate = new Date(targetDate);
  calcDate.setDate(calcDate.getDate() + shiftDays);

  let day = 1, month = 1, year = 1448;
  try {
    const formatter = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    });
    const parts = formatter.formatToParts(calcDate);
    day = parseInt(parts.find(p => p.type === 'day')?.value, 10);
    month = parseInt(parts.find(p => p.type === 'month')?.value, 10);
    year = parseInt(parts.find(p => p.type === 'year')?.value, 10);
  } catch (e) {
    // Tabular fallback
    day = calcDate.getDate();
    month = 3; // Safar / Rabi
    year = 1448;
  }

  const monthName = ISLAMIC_MONTH_NAMES[month - 1] || `Month ${month}`;
  return {
    day,
    month,
    monthName,
    year,
    formatted: `${day} ${monthName} ${year} AH`,
    isPastSunset
  };
}

// --- HEADLESS DOM SIMULATOR ---
class MockClassList {
  constructor(el) {
    this.el = el;
    this.classes = new Set();
    if (el._className) {
      el._className.split(/\s+/).filter(Boolean).forEach(c => this.classes.add(c));
    }
  }
  add(...tokens) {
    tokens.forEach(t => this.classes.add(t));
    this._sync();
  }
  remove(...tokens) {
    tokens.forEach(t => this.classes.delete(t));
    this._sync();
  }
  contains(token) {
    return this.classes.has(token);
  }
  toggle(token, force) {
    if (force !== undefined) {
      if (force) this.add(token); else this.remove(token);
      return force;
    }
    if (this.contains(token)) {
      this.remove(token);
      return false;
    } else {
      this.add(token);
      return true;
    }
  }
  _sync() {
    this.el._className = Array.from(this.classes).join(' ');
  }
}

class MockElement {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this._className = '';
    this.classList = new MockClassList(this);
    this.style = {};
    this.attributes = new Map();
    this.eventListeners = new Map();
    this.children = [];
    this.parentElement = null;
    this._innerHTML = '';
    this._innerText = '';
    this.value = '';
    this.checked = false;
    this.title = '';
  }

  get className() { return this._className; }
  set className(val) {
    this._className = val || '';
    this.classList = new MockClassList(this);
  }

  get innerHTML() { return this._innerHTML; }
  set innerHTML(val) {
    this._innerHTML = String(val);
    this._innerText = this._innerHTML.replace(/<[^>]*>/g, '').trim();
    if (!this._innerHTML) {
      this.children = [];
    }
  }

  get innerText() { return this._innerText; }
  set innerText(val) {
    this._innerText = String(val);
    this._innerHTML = String(val);
  }

  get textContent() { return this._innerText; }
  set textContent(val) {
    this._innerText = String(val);
    this._innerHTML = String(val);
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }
  setAttribute(name, val) {
    this.attributes.set(name, String(val));
    if (name === 'id') this.id = val;
    if (name === 'class') this.className = val;
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(event, listener) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(listener);
  }
  removeEventListener(event, listener) {
    if (this.eventListeners.has(event)) {
      const list = this.eventListeners.get(event).filter(l => l !== listener);
      this.eventListeners.set(event, list);
    }
  }
  dispatchEvent(event) {
    const list = this.eventListeners.get(event.type) || [];
    list.forEach(cb => cb(event));
  }
  click() {
    this.dispatchEvent({ type: 'click', target: this, preventDefault: () => {} });
  }
  focus() {
    this.dispatchEvent({ type: 'focus', target: this });
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentElement = null;
    }
    return child;
  }

  getBoundingClientRect() {
    // Default standard accessible bounding box unless overridden
    return {
      width: 44,
      height: 44,
      top: 0,
      bottom: 44,
      left: 0,
      right: 44
    };
  }
}

class MockCanvasContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.drawCalls = [];
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.textAlign = 'left';
    this.textBaseline = 'alphabetic';
    this.font = '10px sans-serif';
  }

  fillRect(x, y, w, h) { this.drawCalls.push({ method: 'fillRect', args: [x, y, w, h], fillStyle: this.fillStyle }); }
  clearRect(x, y, w, h) { this.drawCalls.push({ method: 'clearRect', args: [x, y, w, h] }); }
  strokeRect(x, y, w, h) { this.drawCalls.push({ method: 'strokeRect', args: [x, y, w, h], strokeStyle: this.strokeStyle }); }
  beginPath() { this.drawCalls.push({ method: 'beginPath' }); }
  moveTo(x, y) { this.drawCalls.push({ method: 'moveTo', args: [x, y] }); }
  lineTo(x, y) { this.drawCalls.push({ method: 'lineTo', args: [x, y] }); }
  arc(...args) { this.drawCalls.push({ method: 'arc', args }); }
  stroke() { this.drawCalls.push({ method: 'stroke', strokeStyle: this.strokeStyle }); }
  fill() { this.drawCalls.push({ method: 'fill', fillStyle: this.fillStyle }); }
  fillText(text, x, y) { this.drawCalls.push({ method: 'fillText', text, x, y, font: this.font, fillStyle: this.fillStyle }); }
  measureText(text) { return { width: (text ? text.length * 10 : 0) }; }
  save() { this.drawCalls.push({ method: 'save' }); }
  restore() { this.drawCalls.push({ method: 'restore' }); }
  translate(x, y) { this.drawCalls.push({ method: 'translate', args: [x, y] }); }
  rotate(rad) { this.drawCalls.push({ method: 'rotate', args: [rad] }); }
  roundRect(x, y, w, h, r) { this.drawCalls.push({ method: 'roundRect', args: [x, y, w, h, r] }); }
  createLinearGradient() {
    return { addColorStop: () => {} };
  }
  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    this.drawCalls.push({ method: 'createRadialGradient', args: [x0, y0, r0, x1, y1, r1] });
    return { addColorStop: () => {} };
  }
}

class MockHTMLCanvasElement extends MockElement {
  constructor(width = 1080, height = 1350) {
    super('canvas');
    this.width = width;
    this.height = height;
    this._ctx = new MockCanvasContext2D(this);
  }
  getContext(type) {
    if (type === '2d') return this._ctx;
    return null;
  }
  toBlob(callback, type = 'image/png', quality = 0.95) {
    const mockBlob = {
      size: 1080 * 1350 * 4,
      type: type,
      name: 'Namaz_Timetable.png'
    };
    if (callback) setTimeout(() => callback(mockBlob), 0);
  }
  toDataURL(type = 'image/png') {
    return `data:${type};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
  }
}

class MockDocument {
  constructor() {
    this.elementsById = new Map();
    this.body = new MockElement('body');
    this.head = new MockElement('head');
    this.eventListeners = new Map();
    this.visibilityState = 'visible';
  }

  registerElement(id, el) {
    this.elementsById.set(id, el);
    return el;
  }

  getElementById(id) {
    if (this.elementsById.has(id)) {
      return this.elementsById.get(id);
    }
    // Auto-create element if queried so tests never crash on missing DOM element
    const el = new MockElement('div', id);
    this.elementsById.set(id, el);
    return el;
  }

  querySelector(selector) {
    if (selector.startsWith('#')) {
      return this.getElementById(selector.slice(1));
    }
    if (selector === 'body') return this.body;
    if (selector === 'head') return this.head;
    for (const el of this.elementsById.values()) {
      if (selector.startsWith('.') && el.classList.contains(selector.slice(1))) {
        return el;
      }
    }
    return null;
  }

  querySelectorAll(selector) {
    const matched = [];
    if (selector.startsWith('.')) {
      const cls = selector.slice(1);
      for (const el of this.elementsById.values()) {
        if (el.classList.contains(cls)) matched.push(el);
      }
    }
    return matched;
  }

  createElement(tagName) {
    if (tagName.toLowerCase() === 'canvas') {
      return new MockHTMLCanvasElement(1080, 1350);
    }
    return new MockElement(tagName);
  }

  addEventListener(event, cb) {
    if (!this.eventListeners.has(event)) this.eventListeners.set(event, []);
    this.eventListeners.get(event).push(cb);
  }

  dispatchEvent(event) {
    const list = this.eventListeners.get(event.type) || [];
    list.forEach(cb => cb(event));
  }
}

class MockLocalStorage {
  constructor() {
    this.store = new Map();
    this.shouldThrow = false;
  }
  getItem(key) {
    if (this.shouldThrow) throw new Error('SecurityError: localStorage is disabled');
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, val) {
    if (this.shouldThrow) throw new Error('QuotaExceededError: storage full');
    this.store.set(key, String(val));
  }
  removeItem(key) {
    if (this.shouldThrow) throw new Error('SecurityError');
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

// Extract script tag contents from index.html
function extractScriptFromHtml(htmlContent) {
  const match = htmlContent.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/i);
  return match ? match[1] : '';
}

// Load and execute application in sandboxed environment
function loadApp(options = {}) {
  const htmlContent = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  const scriptContent = extractScriptFromHtml(htmlContent);

  const document = new MockDocument();
  const localStorage = new MockLocalStorage();
  if (options.initialStorage) {
    for (const [k, v] of Object.entries(options.initialStorage)) {
      localStorage.setItem(k, v);
    }
  }
  if (options.storageThrows) {
    localStorage.shouldThrow = true;
  }

  let capturedShareData = null;
  let shareCalled = false;
  let shareError = null;

  const navigator = {
    geolocation: {
      getCurrentPosition: (success, error, opts) => {
        if (options.geoCoords) {
          success({ coords: options.geoCoords });
        } else if (options.geoError) {
          error({ code: 1, message: 'User denied geolocation' });
        } else {
          success({ coords: { latitude: 21.1960, longitude: 72.7940 } });
        }
      }
    },
    share: async (data) => {
      shareCalled = true;
      capturedShareData = data;
      if (options.shareThrows) {
        throw new Error('AbortError: Share was cancelled');
      }
      return true;
    },
    canShare: (data) => {
      if (options.canShareFiles !== undefined) return options.canShareFiles;
      return true;
    },
    clipboard: {
      writeText: async (text) => {
        options.lastClipboardText = text;
        return true;
      }
    }
  };

  // Mock Date if specified
  const OriginalDate = global.Date;
  class MockDate extends OriginalDate {
    constructor(...args) {
      if (args.length === 0 && options.mockDate) {
        super(options.mockDate);
      } else if (args.length === 0) {
        super();
      } else {
        super(...args);
      }
    }
    static now() {
      return options.mockDate ? new Date(options.mockDate).getTime() : OriginalDate.now();
    }
  }

  let alertMessage = null;
  const window = {
    location: { href: 'https://hamidgazi.github.io/namaz/', reload: () => {} },
    localStorage,
    navigator,
    Date: MockDate,
    AudioContext: class {
      createOscillator() { return { type: '', frequency: { setValueAtTime: () => {} }, connect: () => {}, start: () => {}, stop: () => {} }; }
      createGain() { return { gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} }; }
      get currentTime() { return 0; }
      get destination() { return {}; }
    },
    alert: (msg) => { alertMessage = msg; },
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    setInterval: (fn, ms) => {
      if (options.enableInterval) return setInterval(fn, ms);
      return 1;
    },
    clearTimeout: (id) => clearTimeout(id),
    clearInterval: (id) => clearInterval(id),
    Intl: Intl
  };

  // Populate known DOM element IDs from index.html
  const knownIds = [
    'txtCityHeader', 'txtDateHeader', 'txtDayBadge', 'heroCard',
    'heroPrayerTitle', 'heroArabicTitle', 'heroTimeTarget', 'heroCountdown',
    'heroCurrentDesc', 'heroUpcomingTag', 'heroProgressBar', 'heroPrevLabel',
    'heroNextLabel', 'heroProgressPercent', 'heroCountdownLabel',
    'modalCity', 'modalSettings', 'btnOpenCityModal', 'btnCloseCity',
    'btnOpenSettings', 'btnCloseSettings', 'inputCitySearch', 'cityListContainer',
    'btnDetectGps', 'selIhtiyat', 'chkAutoSilent', 'txtMosqueStatus',
    'btnPrevDay', 'btnNextDay', 'btnTodayReset', 'btnResetToTodayInline',
    'extraSection', 'accordionToggle', 'footerCity', 'browsingBanner',
    'txtBrowsingBannerLabel', 'rowFajr', 'rowSunrise', 'rowDhuhr',
    'rowAsr', 'rowMaghrib', 'rowIsha', 'timeFajr', 'timeSunrise',
    'timeDhuhr', 'timeAsr', 'timeMaghrib', 'timeIsha', 'txtSehriTime',
    'txtIftarTime', 'timeDahwa', 'timeZawal', 'timeIshraq', 'timeChasht',
    'timeTahajjud', 'labelDhuhr', 'arDhuhr', 'badgeJummah', 'btnHeroChime',
    'btnTestAzan', 'btnShareApp', 'btnShareImage', 'drawerSunnah',
    'btnOpenSunnahDrawer', 'btnCloseSunnahDrawer', 'selHijriAdjustment',
    'headerVersionBadge', 'footerVersionText', 'settingsVersionBadge',
    'txtBannerNewVersion', 'btnCheckUpdateFooter', 'btnCheckUpdateSettings',
    'btnReloadUpdate', 'txtUpdateStatus', 'updateBanner', 'fastingStrip'
  ];

  knownIds.forEach(id => {
    const el = document.getElementById(id);
    if (id.startsWith('btn')) el.setAttribute('role', 'button');
    if (id.startsWith('row')) el.className = 'prayer-card';
  });

  // Parse elements and attributes from index.html markup so DOM reflects real classes
  const tagRegex = /<([a-z0-9]+)\s+([^>]*?)>/gi;
  let m;
  let autoIdCount = 0;
  while ((m = tagRegex.exec(htmlContent)) !== null) {
    const tagName = m[1];
    const attrsStr = m[2];
    const idMatch = attrsStr.match(/\bid=["']([^"']+)["']/i);
    const classMatch = attrsStr.match(/\bclass=["']([^"']+)["']/i);
    const dataPrayerMatch = attrsStr.match(/\bdata-prayer=["']([^"']+)["']/i);
    const titleMatch = attrsStr.match(/\btitle=["']([^"']+)["']/i);
    const roleMatch = attrsStr.match(/\brole=["']([^"']+)["']/i);

    if (idMatch || classMatch) {
      const id = idMatch ? idMatch[1] : `auto_elem_${++autoIdCount}`;
      const el = document.getElementById(id);
      el.tagName = tagName.toUpperCase();
      if (classMatch) el.className = classMatch[1];
      if (dataPrayerMatch) el.setAttribute('data-prayer', dataPrayerMatch[1]);
      if (titleMatch) el.setAttribute('title', titleMatch[1]);
      if (roleMatch) el.setAttribute('role', roleMatch[1]);
      if (tagName.toLowerCase() === 'button') el.setAttribute('role', 'button');
    }
  }

  const sandbox = {
    window,
    document,
    localStorage,
    navigator,
    Date: MockDate,
    Intl,
    alert: window.alert,
    setTimeout: window.setTimeout,
    setInterval: window.setInterval,
    clearTimeout: window.clearTimeout,
    clearInterval: window.clearInterval,
    console: console,
    Math: Math,
    HTMLCanvasElement: MockHTMLCanvasElement,
    CanvasRenderingContext2D: MockCanvasContext2D,
    URL: {
      createObjectURL: (blob) => `blob:mock-url-${Math.random().toString(36).slice(2)}`,
      revokeObjectURL: () => {}
    },
    File: class MockFile {
      constructor(parts, name, opts = {}) {
        this.parts = parts;
        this.name = name;
        this.type = opts.type || '';
        this.size = parts && parts[0] ? parts[0].size || 1024 : 1024;
      }
    }
  };

  vm.createContext(sandbox);

  let scriptError = null;
  try {
    vm.runInContext(scriptContent, sandbox);
  } catch (err) {
    scriptError = err;
  }

  return {
    sandbox,
    window,
    document,
    localStorage,
    navigator,
    scriptError,
    getAlertMessage: () => alertMessage,
    getShareData: () => capturedShareData,
    wasShareCalled: () => shareCalled,
    htmlContent,
    eval: (code) => vm.runInContext(code, sandbox),
    getAppState: () => {
      try { return vm.runInContext('appState', sandbox); } catch(e) { return null; }
    }
  };
}

module.exports = {
  INDEX_HTML_PATH,
  VERSION_JSON_PATH,
  PUSH_BAT_PATH,
  getJulianDay,
  calculateSolarCoordinates,
  computeHourAngle,
  roundForward,
  roundBackward,
  formatTime12,
  calculateAccurateHanafiTimes,
  getAccurateIslamicDate,
  ISLAMIC_MONTH_NAMES,
  loadApp,
  MockDocument,
  MockElement,
  MockHTMLCanvasElement,
  MockLocalStorage
};
