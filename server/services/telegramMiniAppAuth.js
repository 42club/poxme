import { createHmac, timingSafeEqual } from 'node:crypto'

const JSON_FIELDS = new Set(['user', 'receiver', 'chat'])
const HASH_HEX_RE = /^[a-f0-9]{64}$/i

function normalizeInitData(initDataRaw) {
  const normalized = typeof initDataRaw === 'string' ? initDataRaw.trim() : ''
  if (!normalized) {
    throw new Error('Telegram init_data is required')
  }
  return normalized
}

function parseKnownJsonFields(parsed) {
  for (const key of JSON_FIELDS) {
    const rawValue = parsed[key]
    if (typeof rawValue !== 'string' || !rawValue) continue

    try {
      parsed[key] = JSON.parse(rawValue)
    } catch {
      parsed[key] = null
      parsed[`${key}Raw`] = rawValue
    }
  }

  return parsed
}

export function parseTelegramInitData(initDataRaw) {
  const normalized = normalizeInitData(initDataRaw)
  const params = new URLSearchParams(normalized)
  const parsed = {
    raw: normalized,
    hash: params.get('hash') || '',
    authDate: params.get('auth_date') ? Number(params.get('auth_date')) : null,
  }

  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue
    parsed[key] = value
  }

  return parseKnownJsonFields(parsed)
}

export function validateTelegramInitData(
  initDataRaw,
  {
    botToken,
    maxAgeSec = 86400,
    maxFutureSkewSec = 300,
  } = {},
) {
  if (!botToken) {
    throw new Error('Telegram bot token is not configured')
  }

  const normalized = normalizeInitData(initDataRaw)
  const params = new URLSearchParams(normalized)
  const hash = params.get('hash') || ''

  if (!HASH_HEX_RE.test(hash)) {
    throw new Error('Telegram init_data hash is missing or malformed')
  }

  const keyValuePairs = []
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue
    keyValuePairs.push(`${key}=${value}`)
  }

  keyValuePairs.sort((left, right) => left.localeCompare(right))
  const dataCheckString = keyValuePairs.join('\n')
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest()
  const actualHash = Buffer.from(hash, 'hex')

  if (actualHash.length !== expectedHash.length || !timingSafeEqual(actualHash, expectedHash)) {
    throw new Error('Telegram init_data signature is invalid')
  }

  const parsed = parseTelegramInitData(normalized)
  if (!Number.isFinite(parsed.authDate)) {
    throw new Error('Telegram init_data auth_date is missing')
  }

  const nowSec = Math.floor(Date.now() / 1000)
  if (parsed.authDate < nowSec - maxAgeSec) {
    throw new Error('Telegram init_data has expired')
  }
  if (parsed.authDate > nowSec + maxFutureSkewSec) {
    throw new Error('Telegram init_data auth_date is in the future')
  }

  return parsed
}
