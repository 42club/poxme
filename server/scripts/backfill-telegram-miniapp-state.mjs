import { fileURLToPath } from 'url'
import { resolve } from 'path'
import pg from 'pg'
import config from '../config.js'
import {
  closeRuntimeAuthStore,
  ensureRuntimeAuthStoreReady,
  getAppUser,
  getNextManagedWalletAccountIndex,
  getWallet,
  insertManagedWalletRecord,
  insertWallet,
  listUserWalletsByUserId,
  updateAppUserPrimaryWallet,
  upsertUser,
  upsertUserWallet,
  upsertWalletConnection,
  deleteWallet,
} from '../runtimeAuthStore.js'
import { closeDb, findUserAgentByWallet, rawDb } from '../runtimeEngineStore.js'
import { createWalletProviderRegistry } from '../services/walletProviderRegistry.js'
import { createUserManagedWalletProvisioningService } from '../services/userManagedWalletProvisioning.js'
import { createWdkWalletService } from '../services/wdkWallet.js'

const { Client } = pg
const updateUserAgentWalletStatement = rawDb.prepare(`
  UPDATE user_agents
  SET wallet_address = ?, updated_at = ?
  WHERE id = ?
`)

function isMainModule() {
  if (!process.argv[1]) return false
  return resolve(process.argv[1]) === fileURLToPath(import.meta.url)
}

function sanitizeWalletAddress(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.toLowerCase().startsWith('telegram:')) return null
  return trimmed
}

function buildSyntheticTelegramWallet(telegramUserId) {
  return `telegram:${String(telegramUserId || '').trim()}`.toLowerCase()
}

function createProvisioningService() {
  const wdkWalletService = createWdkWalletService({
    insertWallet,
    getWallet,
    deleteWallet,
    getNextManagedWalletAccountIndex,
    isTestnet: config.isTestnet,
    tonApiBase: config.tonApiBase,
    masterSeed: config.managedWallets.masterSeed,
  })

  const walletProviderRegistry = createWalletProviderRegistry({
    wdkWalletService,
  })

  return createUserManagedWalletProvisioningService({
    walletProviderRegistry,
    upsertUser,
    upsertWalletConnection,
    insertManagedWalletRecord,
    upsertUserWallet,
    listUserWalletsByUserId,
    getAppUser,
    updateAppUserPrimaryWallet,
  })
}

async function fetchTelegramBackfillCandidates(client) {
  const result = await client.query(
    `SELECT
      ai.user_id,
      ai.provider_user_id AS telegram_user_id,
      COALESCE(au.primary_wallet_address, '') AS primary_wallet_address,
      EXISTS (
        SELECT 1
        FROM auth_sessions s
        WHERE s.user_id = ai.user_id
          AND s.auth_provider = 'telegram-mini-app'
          AND (
            COALESCE(s.active_wallet_address, '') LIKE 'telegram:%'
            OR COALESCE(s.address, '') LIKE 'telegram:%'
            OR COALESCE(s.active_wallet_address, '') = ''
          )
      ) AS has_broken_session,
      EXISTS (
        SELECT 1
        FROM user_wallets uw
        WHERE uw.user_id = ai.user_id
          AND uw.wallet_kind = 'managed'
          AND uw.wallet_provider = 'wdk-ton'
          AND uw.is_active = 1
      ) AS has_managed_wallet
    FROM auth_identities ai
    JOIN app_users au ON au.id = ai.user_id
    WHERE ai.provider = 'telegram'
      AND ai.identity_type = 'mini_app'
    ORDER BY au.created_at ASC`,
  )
  return result.rows
}

async function updateTelegramSessions(client, { userId, walletAddress }) {
  const now = Date.now()
  const result = await client.query(
    `UPDATE auth_sessions
      SET address = $1,
          active_wallet_address = $1,
          last_seen_at = $2
    WHERE user_id = $3
      AND auth_provider = 'telegram-mini-app'
      AND (
        COALESCE(address, '') LIKE 'telegram:%'
        OR COALESCE(active_wallet_address, '') LIKE 'telegram:%'
        OR COALESCE(active_wallet_address, '') = ''
      )`,
    [walletAddress, now, userId],
  )
  return Number(result.rowCount || 0)
}

function repairSyntheticAgentWallet({ telegramUserId, walletAddress, dryRun }) {
  const syntheticWalletAddress = buildSyntheticTelegramWallet(telegramUserId)
  const currentRealAgent = findUserAgentByWallet(walletAddress)
  if (currentRealAgent) {
    return { repaired: false, reason: 'real_agent_exists' }
  }

  const syntheticAgent = findUserAgentByWallet(syntheticWalletAddress)
  if (!syntheticAgent) {
    return { repaired: false, reason: 'synthetic_agent_missing' }
  }

  if (!dryRun) {
    const updatedAt = Date.now()
    const result = updateUserAgentWalletStatement.run(walletAddress, updatedAt, syntheticAgent.id)
    if (!Number(result.changes || 0)) {
      return { repaired: false, reason: 'update_noop' }
    }

    const repairedAgent = findUserAgentByWallet(walletAddress)
    if (!repairedAgent || repairedAgent.id !== syntheticAgent.id) {
      return { repaired: false, reason: 'verification_failed' }
    }
  }

  return {
    repaired: true,
    agentId: syntheticAgent.id,
    agentName: syntheticAgent.name,
  }
}

export async function backfillTelegramMiniAppState({ dryRun = false } = {}) {
  if (config.db.driver !== 'postgres' || !config.db.databaseUrl) {
    throw new Error('This backfill requires DB_DRIVER=postgres and DATABASE_URL')
  }
  if (!config.managedWallets.masterSeed) {
    throw new Error('WDK master seed is required for Telegram wallet backfill')
  }

  await ensureRuntimeAuthStoreReady()
  const provisioningService = createProvisioningService()
  const client = new Client({ connectionString: config.db.databaseUrl })
  await client.connect()

  const summary = {
    scanned: 0,
    candidates: 0,
    provisioned: 0,
    sessionRepairs: 0,
    agentRepairs: 0,
    skipped: 0,
    details: [],
  }

  try {
    const candidates = await fetchTelegramBackfillCandidates(client)
    summary.scanned = candidates.length

    for (const candidate of candidates) {
      const userId = candidate.user_id
      const telegramUserId = candidate.telegram_user_id
      const initialPrimaryWallet = sanitizeWalletAddress(candidate.primary_wallet_address)
      const syntheticWalletAddress = buildSyntheticTelegramWallet(telegramUserId)
      const syntheticAgent = findUserAgentByWallet(syntheticWalletAddress)
      const needsRepair = !initialPrimaryWallet || candidate.has_broken_session || Boolean(syntheticAgent)

      if (!needsRepair) {
        summary.skipped += 1
        continue
      }

      summary.candidates += 1
      const detail = {
        userId,
        telegramUserId,
        hadPrimaryWallet: Boolean(initialPrimaryWallet),
        hadBrokenSession: Boolean(candidate.has_broken_session),
        hadSyntheticAgent: Boolean(syntheticAgent),
      }

      const existingWallets = await listUserWalletsByUserId(userId)
      const existingManagedWallet = existingWallets
        .find((wallet) => wallet.walletKind === 'managed' && wallet.walletProvider === 'wdk-ton' && wallet.isActive)

      let provisioning = {
        created: false,
        managedWallet: existingManagedWallet || null,
      }

      if (!dryRun) {
        provisioning = await provisioningService.ensureManagedWalletForUser({
          userId,
          ownerAddress: initialPrimaryWallet,
          source: 'telegram-mini-app-backfill',
          label: 'Telegram managed wallet',
        })

        if (provisioning.created) {
          summary.provisioned += 1
          detail.provisionedWallet = provisioning.managedWallet?.walletAddress || null
        }
      } else if (!initialPrimaryWallet && !existingManagedWallet) {
        detail.wouldProvision = true
      }

      const nextAppUser = await getAppUser(userId)
      const walletAddress = sanitizeWalletAddress(nextAppUser?.primaryWalletAddress)
        || sanitizeWalletAddress(provisioning.managedWallet?.walletAddress)
        || null

      if (!walletAddress) {
        detail.error = 'wallet_not_resolved'
        summary.details.push(detail)
        continue
      }

      if (!dryRun) {
        const repairedSessions = await updateTelegramSessions(client, { userId, walletAddress })
        summary.sessionRepairs += repairedSessions
        detail.repairedSessions = repairedSessions
      }

      const repairedAgent = repairSyntheticAgentWallet({
        telegramUserId,
        walletAddress,
        dryRun,
      })

      if (repairedAgent.repaired) {
        summary.agentRepairs += 1
      }
      detail.agentRepair = repairedAgent
      detail.walletAddress = walletAddress
      summary.details.push(detail)
    }
  } finally {
    await client.end()
    await closeRuntimeAuthStore()
    closeDb()
  }

  return summary
}

if (isMainModule()) {
  const dryRun = process.argv.includes('--dry-run')
  backfillTelegramMiniAppState({ dryRun })
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2))
      process.exit(0)
    })
    .catch((error) => {
      console.error(error?.stack || error?.message || String(error))
      process.exit(1)
    })
}
