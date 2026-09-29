// Web Audio API bell - no audio files needed, works in any browser.
// Produces a pleasant 2-tone chime (ding-dong) that is attention-grabbing
// but not harsh. Safe to call repeatedly (internal context lazy-init).

let ctx = null;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

function playTone({ freq = 880, duration = 0.22, startAt = 0, gain = 0.22, type = 'sine' }) {
  const ac = ensureCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, ac.currentTime + startAt);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + startAt + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + startAt + duration);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(ac.currentTime + startAt);
  osc.stop(ac.currentTime + startAt + duration + 0.02);
}

const BELL_PRESETS = {
  URGENT: [
    { freq: 1046.5, duration: 0.2, startAt: 0, gain: 0.28 },
    { freq: 1046.5, duration: 0.2, startAt: 0.22, gain: 0.26 },
    { freq: 1318.5, duration: 0.35, startAt: 0.44, gain: 0.28 },
  ],
  WARNING: [
    { freq: 880, duration: 0.2, startAt: 0, gain: 0.22 },
    { freq: 659.25, duration: 0.32, startAt: 0.2, gain: 0.22 },
  ],
  INFO: [
    { freq: 783.99, duration: 0.18, startAt: 0, gain: 0.18 },
    { freq: 987.77, duration: 0.28, startAt: 0.18, gain: 0.18 },
  ],
};

function playSequence(seq) {
  try {
    const ac = ensureCtx();
    if (ac && ac.state === 'suspended') ac.resume();
  } catch (_) { /* ignore */ }
  for (const note of seq) playTone(note);
}

export const bell = {
  play(severity = 'INFO') {
    const preset = BELL_PRESETS[severity] || BELL_PRESETS.INFO;
    playSequence(preset);
  },
  urgent() { this.play('URGENT'); },
  warn() { this.play('WARNING'); },
  info() { this.play('INFO'); },
  custom(seq) { playSequence(seq); },
};

// Browser notification helper - with permission check and click-to-navigate.
export function fireBrowserNotification({ title, body, severity = 'INFO', tag, onClickUrl }) {
  try {
    if (typeof Notification === 'undefined') return null;
    if (Notification.permission !== 'granted') return null;
    const icon = severity === 'URGENT' ? '🔴' : severity === 'WARNING' ? '🟠' : '🔵';
    const fullTitle = icon ? `${icon} ${title}` : title;
    const n = new Notification(fullTitle, {
      body: body || '',
      tag: tag || undefined,
      renotify: !tag,
      silent: true,
    });
    if (onClickUrl) {
      n.onclick = (e) => {
        e.preventDefault();
        window.focus();
        try { window.location.assign(onClickUrl); } catch (_) { /* ignore */ }
        try { n.close(); } catch (_) { /* ignore */ }
      };
    }
    setTimeout(() => { try { n.close(); } catch (_) { /* ignore */ } }, 15000);
    return n;
  } catch (_) {
    return null;
  }
}

// Speech helper - uses browser speechSynthesis for hands-free alerts.
export function speak(text, { voiceEnabled = true, rate = 1.0, pitch = 1.0 } = {}) {
  try {
    if (!voiceEnabled) return;
    if (typeof speechSynthesis === 'undefined') return;
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = Math.max(0.5, Math.min(2, Number(rate) || 1.0));
    u.pitch = Math.max(0.5, Math.min(2, Number(pitch) || 1.0));
    u.volume = 0.9;
    const voices = speechSynthesis.getVoices?.() || [];
    const enIn = voices.find((v) => /en-IN/i.test(v.lang)) || voices.find((v) => /en-GB/i.test(v.lang)) || voices.find((v) => /en/i.test(v.lang));
    if (enIn) u.voice = enIn;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (_) { /* ignore */ }
}
