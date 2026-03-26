import { randomUUID } from 'crypto'
import { Router } from 'express'
import { authLimiter } from '../middleware/index.js'
import { fail, ok, validate, privyVerifySchema, setActiveWalletSchema } from '../validation/index.js'
import { validateTelegramInitData } from '../services/telegramMiniAppAuth.js'
import { setSessionCookie } from '../utils/sessionCookies.js'

export default function authRoutes({
  auth,
  config,
  privyAuthService,
  managedWalletProvisioning,
  findPersistedUserAgentByWallet,
  savePersistedUserAgent,
  createAppUser,
  getAppUser,
  getAppUserByPrimaryWallet,
  updateAppUserPrimaryWallet,
  getAuthIdentity,
  getAuthSession,
  getMiniAppPreferences,
  upsertAuthIdentity,
  listAuthIdentitiesByUserId,
  listUserWalletsByUserId,
  getUserWalletByAddress,
  listWalletConnectionsByOwner,
  listManagedWalletsByOwner,
  createAuthSession,
  updateAuthSessionActiveWallet,
  upsertMiniAppPreferences,
}) {
  const router = Router()
  const cookieName = config.auth.sessionCookieName
  const sessionTtlMs = config.auth.sessionTtlMs
  const telegramSessionTtlMs = config.telegram?.sessionTtlMs || sessionTtlMs

  function isSyntheticTelegramWalletAddress(value) {
    return typeof value === 'string' && value.trim().toLowerCase().startsWith('telegram:')
  }

  function sanitizeWalletAddress(value) {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed && !isSyntheticTelegramWalletAddress(trimmed) ? trimmed : null
  }

  function resolvePrivyAccessToken(req) {
    const authorizationHeader = typeof req.headers.authorization === 'string'
      ? req.headers.authorization.replace(/^Bearer\s+/i, '').trim()
      : ''
    const bodyAccessToken = typeof req.body?.accessToken === 'string'
      ? req.body.accessToken.trim()
      : ''
    return bodyAccessToken || authorizationHeader || null
  }

  function resolveTelegramInitData(req) {
    const authorizationHeader = typeof req.headers.authorization === 'string'
      ? req.headers.authorization.trim()
      : ''
    const headerMatch = authorizationHeader.match(/^tma\s+(.+)$/i)
    if (headerMatch?.[1]) {
      return headerMatch[1].trim()
    }

    const bodyInitData = typeof req.body?.initDataRaw === 'string'
      ? req.body.initDataRaw.trim()
      : ''
    return bodyInitData || null
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
  }

  function normalizeMiniAppSettings(rawSettings = {}) {
    return {
      notificationsEnabled: rawSettings.notificationsEnabled !== false,
      compactNavigation: rawSettings.compactNavigation !== false,
      hapticsEnabled: rawSettings.hapticsEnabled !== false,
      appearance: rawSettings.appearance === 'system' ? 'system' : 'dark',
    }
  }

  function normalizeMiniAppState(rawState = {}) {
    return isPlainObject(rawState) ? rawState : {}
  }

  function serializeMiniAppPreferences(preferences) {
    return {
      settings: normalizeMiniAppSettings(preferences?.settings || {}),
      state: normalizeMiniAppState(preferences?.state || {}),
      updatedAt: preferences?.updatedAt || null,
    }
  }

  function summarizeManagedWallet(wallets = []) {
    return wallets.find((wallet) => wallet.walletKind === 'managed' && wallet.walletProvider === 'wdk-ton') || null
  }

  function summarizePrivyWallets(authIdentities = []) {
    const walletMap = new Map()

    authIdentities
      .filter((identity) => identity.provider === 'privy')
      .forEach((identity) => {
        const wallets = Array.isArray(identity.metadata?.wallets) ? identity.metadata.wallets : []
        wallets.forEach((wallet, index) => {
          const address = typeof wallet?.address === 'string' ? wallet.address.trim() : ''
          if (!address) return
          const chainType = typeof wallet?.chainType === 'string'
            ? wallet.chainType
            : (typeof wallet?.chain_type === 'string' ? wallet.chain_type : null)
          const walletClient = typeof wallet?.walletClient === 'string'
            ? wallet.walletClient
            : (typeof wallet?.wallet_client === 'string' ? wallet.wallet_client : 'privy')
          const dedupeKey = `${String(chainType || '').toLowerCase()}:${address.toLowerCase()}`
          if (walletMap.has(dedupeKey)) return
          walletMap.set(dedupeKey, {
            id: wallet.id || `${identity.identityType || 'privy'}:${address}:${index}`,
            address,
            chainType,
            walletClient,
            walletClientType: wallet.walletClientType || wallet.wallet_client_type || walletClient,
          })
        })
      })

    return Array.from(walletMap.values())
  }

  function summarizePrivyIdentity(authIdentities = []) {
    const privyIdentity = authIdentities.find((identity) => identity.provider === 'privy' && identity.providerUserId)
    if (!privyIdentity) return null

    const wallets = summarizePrivyWallets(authIdentities)

    return {
      userId: privyIdentity.providerUserId,
      imported: privyIdentity.identityType === 'custom_auth',
      customAuthLinked: authIdentities.some((identity) => identity.provider === 'privy' && identity.identityType === 'custom_auth'),
      accessTokenLinked: authIdentities.some((identity) => identity.provider === 'privy' && identity.identityType === 'privy-access-token'),
      wallets,
    }
  }

  function summarizeTelegramIdentity(authIdentities = []) {
    const telegramIdentity = authIdentities.find((identity) => identity.provider === 'telegram' && identity.identityType === 'mini_app')
    if (!telegramIdentity) return null

    const telegramUser = telegramIdentity.metadata?.telegramUser || null
    return {
      userId: telegramIdentity.providerUserId,
      authDate: telegramIdentity.metadata?.authDate || null,
      queryId: telegramIdentity.metadata?.queryId || null,
      startParam: telegramIdentity.metadata?.startParam || null,
      chatType: telegramIdentity.metadata?.chatType || null,
      canSendAfter: telegramIdentity.metadata?.canSendAfter || null,
      user: telegramUser ? {
        id: telegramUser.id ?? null,
        firstName: telegramUser.first_name || '',
        lastName: telegramUser.last_name || null,
        username: telegramUser.username || null,
        languageCode: telegramUser.language_code || null,
        photoUrl: telegramUser.photo_url || null,
        isPremium: Boolean(telegramUser.is_premium),
      } : null,
    }
  }

  async function resolveAppUserForPrivyVerification({ verifiedUserId, requestAuth }) {
    const privyAccessIdentity = await getAuthIdentity('privy', verifiedUserId, 'privy-access-token')
    if (privyAccessIdentity?.userId) {
      return {
        identity: privyAccessIdentity,
        appUser: await getAppUser(privyAccessIdentity.userId),
      }
    }

    const importedPrivyIdentity = await getAuthIdentity('privy', verifiedUserId, 'custom_auth')
    if (importedPrivyIdentity?.userId) {
      return {
        identity: importedPrivyIdentity,
        appUser: await getAppUser(importedPrivyIdentity.userId),
      }
    }

    if (requestAuth?.userId) {
      return {
        identity: null,
        appUser: await getAppUser(requestAuth.userId),
      }
    }

    if (requestAuth?.activeWalletAddress) {
      return {
        identity: null,
        appUser: await getAppUserByPrimaryWallet(requestAuth.activeWalletAddress),
      }
    }

    return {
      identity: null,
      appUser: null,
    }
  }

  async function repairSyntheticTelegramAgentWallet({ providerUserId, walletAddress }) {
    const resolvedWalletAddress = sanitizeWalletAddress(walletAddress)
    if (!providerUserId || !resolvedWalletAddress || !findPersistedUserAgentByWallet || !savePersistedUserAgent) {
      return false
    }

    const existingRealAgent = await findPersistedUserAgentByWallet(resolvedWalletAddress)
    if (existingRealAgent) return false

    const syntheticWalletAddress = `telegram:${providerUserId}`.toLowerCase()
    const syntheticAgent = await findPersistedUserAgentByWallet(syntheticWalletAddress)
    if (!syntheticAgent) return false

    await savePersistedUserAgent({
      ...syntheticAgent,
      walletAddress: resolvedWalletAddress,
      updatedAt: Date.now(),
    })
    return true
  }

  function buildSessionPayload({ session, appUser, authIdentities, linkedWallets, miniAppPreferences }) {
    const managedWallet = summarizeManagedWallet(linkedWallets)
    const authSource = session?.authProvider || session?.auth_provider || 'session'
    const activeWalletAddress = sanitizeWalletAddress(session?.activeWalletAddress)
      || sanitizeWalletAddress(session?.active_wallet_address)
      || (authSource === 'telegram-mini-app'
        ? sanitizeWalletAddress(appUser?.primaryWalletAddress)
        : (sanitizeWalletAddress(session?.address) || sanitizeWalletAddress(appUser?.primaryWalletAddress)))
    const privy = summarizePrivyIdentity(authIdentities)
    const telegram = summarizeTelegramIdentity(authIdentities)
    return {
      authenticated: true,
      userId: appUser?.id || session?.userId || null,
      authSource,
      authLevel: session?.authLevel || session?.auth_level || 'wallet_verified',
      privyUserId: session?.privyUserId || session?.privy_user_id || privy?.userId || null,
      privy,
      telegram,
      authMethods: authIdentities.map((identity) => ({
        provider: identity.provider,
        type: identity.identityType,
        providerUserId: identity.providerUserId,
        email: identity.email || null,
      })),
      linkedWallets,
      managedWallet,
      activeWalletAddress,
      canTrade: Boolean(activeWalletAddress),
      canCreateAgent: Boolean(activeWalletAddress),
      canPublishStrategy: Boolean(activeWalletAddress),
      session: {
        id: session?.id || null,
        expiresAt: session?.expiresAt || session?.expires_at || null,
      },
      user: appUser ? {
        id: appUser.id,
        primaryWalletAddress: appUser.primaryWalletAddress,
        status: appUser.status,
        metadata: appUser.metadata,
      } : null,
      miniAppPreferences: serializeMiniAppPreferences(miniAppPreferences),
    }
  }

  router.post('/auth/telegram/verify', authLimiter, async (req, res) => {
    try {
      if (!config.telegram?.botToken) {
        return fail(res, 'Telegram Mini App authentication is not configured on the server', 503)
      }

      const initDataRaw = resolveTelegramInitData(req)
      if (!initDataRaw) {
        return fail(res, 'Telegram init_data is required', 400)
      }

      const verifiedInitData = validateTelegramInitData(initDataRaw, {
        botToken: config.telegram.botToken,
        maxAgeSec: config.telegram.initDataMaxAgeSec,
      })

      const telegramUser = verifiedInitData.user
      if (!telegramUser?.id) {
        return fail(res, 'Telegram init_data does not contain an authorized user', 400)
      }

      const providerUserId = String(telegramUser.id)
      const requestWalletAddress = sanitizeWalletAddress(req.auth?.activeWalletAddress)
      const existingIdentity = await getAuthIdentity('telegram', providerUserId, 'mini_app')
      if (existingIdentity?.userId && req.auth?.userId && existingIdentity.userId !== req.auth.userId) {
        return fail(res, 'This Telegram account is already linked to another user', 403)
      }

      let appUser = existingIdentity?.userId ? await getAppUser(existingIdentity.userId) : null
      if (!appUser && req.auth?.userId) {
        appUser = await getAppUser(req.auth.userId)
      }
      if (!appUser && requestWalletAddress) {
        appUser = await getAppUserByPrimaryWallet(requestWalletAddress)
      }
      const createdAppUser = !appUser
      if (!appUser) {
        appUser = await createAppUser({
          id: randomUUID(),
          primaryWalletAddress: requestWalletAddress,
          metadata: {
            createdBy: 'telegram-mini-app',
            telegramUserId: providerUserId,
            telegramUsername: telegramUser.username || null,
          },
        })
      }

      await upsertAuthIdentity({
        id: existingIdentity?.id,
        userId: appUser.id,
        provider: 'telegram',
        providerUserId,
        identityType: 'mini_app',
        subject: verifiedInitData.query_id || providerUserId,
        verifiedAt: Date.now(),
        metadata: {
          authDate: verifiedInitData.authDate,
          hash: verifiedInitData.hash,
          queryId: verifiedInitData.query_id || null,
          chatType: verifiedInitData.chat_type || null,
          startParam: verifiedInitData.start_param || null,
          canSendAfter: verifiedInitData.can_send_after ? Number(verifiedInitData.can_send_after) : null,
          telegramUser,
        },
      })

      let provisioning = null
      if (config.telegram.autoProvisionWdkWallet) {
        try {
          provisioning = await managedWalletProvisioning.ensureManagedWalletForUser({
            userId: appUser.id,
            ownerAddress: sanitizeWalletAddress(appUser.primaryWalletAddress) || requestWalletAddress,
            source: 'telegram-mini-app-auto-provision',
            label: 'Telegram managed wallet',
          })
          appUser = provisioning.appUser
        } catch (provisioningError) {
          console.warn('Telegram managed wallet auto-provision skipped:', provisioningError.message)
        }
      }

      const activeWalletAddress = requestWalletAddress
        || sanitizeWalletAddress(provisioning?.managedWallet?.walletAddress)
        || sanitizeWalletAddress(appUser.primaryWalletAddress)
        || null
      if (!appUser.primaryWalletAddress && activeWalletAddress) {
        appUser = await updateAppUserPrimaryWallet(appUser.id, activeWalletAddress)
      }
      if (activeWalletAddress) {
        await repairSyntheticTelegramAgentWallet({ providerUserId, walletAddress: activeWalletAddress })
      }

      const session = await createAuthSession({
        address: activeWalletAddress || `telegram:${providerUserId}`,
        activeWalletAddress,
        userAgent: req.headers['user-agent'] || '',
        ip: req.ip || req.socket?.remoteAddress || '',
        ttlMs: telegramSessionTtlMs,
        userId: appUser.id,
        authProvider: 'telegram-mini-app',
        authLevel: 'telegram_verified',
      })
      setSessionCookie(res, cookieName, session.id, { isProd: config.isProd, maxAge: telegramSessionTtlMs })

      const linkedWallets = await listUserWalletsByUserId(appUser.id)
      const authIdentities = await listAuthIdentitiesByUserId(appUser.id)
      const miniAppPreferences = await getMiniAppPreferences(appUser.id)

      ok(res, {
        ...buildSessionPayload({
          session,
          appUser,
          authIdentities,
          linkedWallets,
          miniAppPreferences,
        }),
        managedWalletProvisioned: Boolean(provisioning?.created),
      }, createdAppUser || provisioning?.created ? 201 : 200)
    } catch (error) {
      console.error('Telegram Mini App auth verify failed:', error.message)
      fail(res, 'Failed to verify Telegram Mini App authentication', 401, error.message)
    }
  })

  router.post('/auth/privy/verify', authLimiter, async (req, res) => {
    try {
      if (!privyAuthService.isConfigured) {
        return fail(res, 'Privy authentication is not configured on the server', 503)
      }

      const parseResult = privyVerifySchema.safeParse(req.body || {})
      if (!parseResult.success) {
        const accessTokenFromHeader = resolvePrivyAccessToken(req)
        if (!accessTokenFromHeader) {
          return fail(res, parseResult.error.issues[0]?.message || 'Privy access token is required', 400, parseResult.error.flatten())
        }
      }

      const accessToken = resolvePrivyAccessToken(req)
      if (!accessToken) return fail(res, 'Privy access token is required', 400)

      const verified = await privyAuthService.verifyAccessToken(accessToken)
      let { identity, appUser } = await resolveAppUserForPrivyVerification({
        verifiedUserId: verified.userId,
        requestAuth: req.auth,
      })

      if (!appUser) {
        appUser = await createAppUser({
          id: randomUUID(),
          primaryWalletAddress: req.auth?.activeWalletAddress || null,
          metadata: {
            createdBy: 'privy-auth',
            privyUserId: verified.userId,
          },
        })
      }

      identity = await upsertAuthIdentity({
        id: identity?.id,
        userId: appUser.id,
        provider: 'privy',
        providerUserId: verified.userId,
        identityType: 'privy-access-token',
        subject: verified.userId,
        verifiedAt: Date.now(),
        metadata: {
          sessionId: verified.sessionId,
          appId: verified.appId,
          issuer: verified.issuer,
        },
      })

      let provisioning = null
      if (config.privy.autoProvisionWdkWallet) {
        try {
          provisioning = await managedWalletProvisioning.ensureManagedWalletForUser({
            userId: appUser.id,
            ownerAddress: appUser.primaryWalletAddress || req.auth?.activeWalletAddress || null,
            source: 'privy-auth-auto-provision',
            label: 'Privy managed wallet',
          })
          appUser = provisioning.appUser
        } catch (provisioningError) {
          console.warn('Privy managed wallet auto-provision skipped:', provisioningError.message)
        }
      }

      const activeWalletAddress = req.auth?.activeWalletAddress
        || provisioning?.managedWallet?.walletAddress
        || appUser.primaryWalletAddress
        || null

      if (!appUser.primaryWalletAddress && activeWalletAddress) {
        appUser = await updateAppUserPrimaryWallet(appUser.id, activeWalletAddress)
      }

      const session = await createAuthSession({
        address: activeWalletAddress,
        activeWalletAddress,
        userAgent: req.headers['user-agent'] || '',
        ip: req.ip || req.socket?.remoteAddress || '',
        ttlMs: sessionTtlMs,
        userId: appUser.id,
        authProvider: 'privy',
        authLevel: 'wallet_verified',
        privyUserId: verified.userId,
      })
      setSessionCookie(res, cookieName, session.id, { isProd: config.isProd, maxAge: sessionTtlMs })

      const linkedWallets = await listUserWalletsByUserId(appUser.id)
      const authIdentities = await listAuthIdentitiesByUserId(appUser.id)
      const miniAppPreferences = await getMiniAppPreferences(appUser.id)

      ok(res, {
        ...buildSessionPayload({ session, appUser, authIdentities, linkedWallets, miniAppPreferences }),
        managedWalletProvisioned: Boolean(provisioning?.created),
      }, provisioning?.created ? 201 : 200)
    } catch (err) {
      console.error('Privy auth verify failed:', err.message)
      fail(res, 'Failed to verify Privy authentication', 401, err.message)
    }
  })

  router.get('/auth/session', async (req, res, next) => {
    try {
    if (!req.sessionId && !req.userAddress) {
      return ok(res, {
        authenticated: false,
        userId: null,
        authSource: null,
        privyUserId: null,
        privy: null,
        telegram: null,
        authMethods: [],
        linkedWallets: [],
        managedWallet: null,
        activeWalletAddress: null,
        canTrade: false,
        canCreateAgent: false,
        canPublishStrategy: false,
        miniAppPreferences: serializeMiniAppPreferences(null),
      })
    }

    if (req.auth?.userId) {
      let appUser = await getAppUser(req.auth.userId)
      let authSession = req.sessionId ? await getAuthSession(req.sessionId) : null
      let linkedWallets = await listUserWalletsByUserId(req.auth.userId)
      const authIdentities = await listAuthIdentitiesByUserId(req.auth.userId)
      const miniAppPreferences = await getMiniAppPreferences(req.auth.userId)
      let provisioning = null

      const effectiveAuthSource = authSession?.auth_provider || req.auth.authSource
      const effectiveActiveWallet = sanitizeWalletAddress(authSession?.active_wallet_address)
        || sanitizeWalletAddress(req.auth.activeWalletAddress)
        || null
      if (effectiveAuthSource === 'telegram-mini-app' && !effectiveActiveWallet && config.telegram.autoProvisionWdkWallet) {
        try {
          provisioning = await managedWalletProvisioning.ensureManagedWalletForUser({
            userId: req.auth.userId,
            ownerAddress: sanitizeWalletAddress(appUser?.primaryWalletAddress),
            source: 'telegram-mini-app-auto-provision',
            label: 'Telegram managed wallet',
          })
          appUser = provisioning.appUser
          linkedWallets = await listUserWalletsByUserId(req.auth.userId)
          if (req.sessionId && provisioning?.managedWallet?.walletAddress) {
            await updateAuthSessionActiveWallet(req.sessionId, provisioning.managedWallet.walletAddress)
            authSession = await getAuthSession(req.sessionId)
          }
        } catch (provisioningError) {
          console.warn('Telegram session wallet auto-provision skipped:', provisioningError.message)
        }
      }
      const telegramIdentity = authIdentities.find((identity) => identity.provider === 'telegram' && identity.identityType === 'mini_app')
      const repairedWalletAddress = sanitizeWalletAddress(provisioning?.managedWallet?.walletAddress)
        || sanitizeWalletAddress(appUser?.primaryWalletAddress)
      if (telegramIdentity?.providerUserId && repairedWalletAddress) {
        await repairSyntheticTelegramAgentWallet({
          providerUserId: telegramIdentity.providerUserId,
          walletAddress: repairedWalletAddress,
        })
      }

      return ok(res, {
        ...buildSessionPayload({
          session: authSession || {
            id: req.sessionId,
            userId: req.auth.userId,
            authProvider: req.auth.authSource,
            authLevel: req.auth.authLevel,
            activeWalletAddress: sanitizeWalletAddress(req.auth.activeWalletAddress),
          },
          appUser,
          authIdentities,
          linkedWallets,
          miniAppPreferences,
        }),
        managedWalletProvisioned: Boolean(provisioning?.created),
      })
    }

    const linkedWallets = req.userAddress ? await listWalletConnectionsByOwner(req.userAddress) : []
    const managedWallets = req.userAddress ? await listManagedWalletsByOwner(req.userAddress) : []
    return ok(res, {
      authenticated: Boolean(req.userAddress),
      userId: null,
      authSource: 'session',
      privyUserId: req.auth?.privyUserId || null,
      privy: req.auth?.privyUserId ? { userId: req.auth.privyUserId, imported: false, customAuthLinked: false, accessTokenLinked: false } : null,
      telegram: null,
      authMethods: [],
      linkedWallets,
      managedWallet: managedWallets[0] || null,
      activeWalletAddress: req.userAddress || null,
      canTrade: Boolean(req.userAddress),
      canCreateAgent: Boolean(req.userAddress),
      canPublishStrategy: Boolean(req.userAddress),
      miniAppPreferences: serializeMiniAppPreferences(null),
    })
    } catch (error) {
      next(error)
    }
  })

  router.get('/auth/mini-app/preferences', async (req, res, next) => {
    try {
      if (!req.auth?.userId) return fail(res, 'Authenticated session required', 401)
      const preferences = await getMiniAppPreferences(req.auth.userId)
      return ok(res, serializeMiniAppPreferences(preferences))
    } catch (error) {
      next(error)
    }
  })

  router.put('/auth/mini-app/preferences', async (req, res, next) => {
    try {
      if (!req.auth?.userId) return fail(res, 'Authenticated session required', 401)

      const existing = serializeMiniAppPreferences(await getMiniAppPreferences(req.auth.userId))
      const incomingSettings = isPlainObject(req.body?.settings) ? req.body.settings : {}
      const incomingState = isPlainObject(req.body?.state) ? req.body.state : {}
      const preferences = await upsertMiniAppPreferences({
        userId: req.auth.userId,
        settings: normalizeMiniAppSettings({
          ...existing.settings,
          ...incomingSettings,
        }),
        state: normalizeMiniAppState({
          ...existing.state,
          ...incomingState,
        }),
      })

      return ok(res, serializeMiniAppPreferences(preferences))
    } catch (error) {
      next(error)
    }
  })

  router.post('/auth/active-wallet', auth, validate(setActiveWalletSchema), async (req, res, next) => {
    try {
    const walletAddress = req.body.walletAddress
    const walletProvider = req.body.walletProvider || 'wdk-ton'

    if (!req.sessionId) return fail(res, 'Active session required', 401)

    if (req.auth?.userId) {
      const linkedWallet = await getUserWalletByAddress(walletAddress, walletProvider)
      if (!linkedWallet || linkedWallet.userId !== req.auth.userId || !linkedWallet.isActive) {
        return fail(res, 'Wallet is not linked to the current user', 403)
      }
      await updateAuthSessionActiveWallet(req.sessionId, walletAddress)
      return ok(res, { activeWalletAddress: walletAddress, linkedWallet })
    }

    const linkedWallet = (await listWalletConnectionsByOwner(req.userAddress || '')).find((candidate) => candidate.walletAddress === walletAddress)
    if (!linkedWallet) return fail(res, 'Wallet is not linked to the current session owner', 403)

    await updateAuthSessionActiveWallet(req.sessionId, walletAddress)
    ok(res, { activeWalletAddress: walletAddress, linkedWallet })
    } catch (error) {
      next(error)
    }
  })

  return router
}
