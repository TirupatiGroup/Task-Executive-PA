// Safe structured logger - never log tokens/secrets. Redacts obvious secret keys.

const SENSITIVE_KEYS = [
  'password', 'token', 'accesstoken', 'accesstoken', 'refreshtoken', 'idtoken',
  'secret', 'authorization', 'clientsecret', 'databaseurl', 'jwtsecret',
];

function redact(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 4) return '[deep]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.includes(k.toLowerCase()) ? '[REDACTED]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function formatLine(level, message, meta) {
  const time = new Date().toISOString();
  const base = `[${time}] ${level.toUpperCase()} ${message}`;
  if (meta === undefined) return base;
  try {
    return `${base} ${JSON.stringify(redact(meta))}`;
  } catch {
    return base;
  }
}

const logger = {
  info: (message, meta) => console.log(formatLine('info', message, meta)),
  warn: (message, meta) => console.warn(formatLine('warn', message, meta)),
  error: (message, meta) => console.error(formatLine('error', message, meta)),
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== 'production') console.log(formatLine('debug', message, meta));
  },
};

module.exports = { logger, redact };
