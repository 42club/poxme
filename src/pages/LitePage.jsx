import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bot, Coins, Sparkles, Wallet } from 'lucide-react'
import { useTonAddress, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react'

import LiteCreateAgentModal from '@/components/agents/LiteCreateAgentModal'
import ConnectWalletModal from '@/components/wallet/ConnectWalletModal'
import ConnectedWalletMenu from '@/components/wallet/ConnectedWalletMenu'
import {
  getPrivyLinkedWalletEntries,
  getSessionWalletAddress,
  hasPrivyWalletSession,
  useConnectWalletChooser,
} from '@/components/wallet/useConnectWalletChooser'
import { getStrategySourceLabel } from '@/components/agents/strategyRuntimeSummary'
import { useAuthSession } from '@/contexts/AuthContext'
import { login as loginWallet } from '@/services/agentApi'
import {
  deleteEngineAgent,
  fetchAgentByWallet,
  fetchEngineAgents,
  pauseEngineAgent,
  setWalletAddress,
  startEngineAgent,
} from '@/services/engineApi'
import {
  POLL_MS,
  STRAT,
  fmt$,
  fmtPct,
  isNewAgent,
  normalizeWalletAddr,
  resolveLiteRiskMeta,
  timeAgo,
} from './lite/constants'
import '@/styles/lite.css'

function Particles() {
  const dots = useMemo(() =>
    Array.from({ length: 25 }, (_, index) => ({
      id: index,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1.5 + Math.random() * 3,
      duration: 15 + Math.random() * 25,
      delay: Math.random() * 12,
      hue: Math.random() > 0.5 ? '248' : '155',
    })), []
  )

  return (
    <div className="lt-particles">
      {dots.map((dot) => (
        <div
          key={dot.id}
          className="lt-particle"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: dot.size,
            height: dot.size,
            animationDuration: `${dot.duration}s`,
            animationDelay: `${dot.delay}s`,
            background: `radial-gradient(circle, hsla(${dot.hue},80%,70%,0.4) 0%, transparent 70%)`,
          }}
        />
      ))}
    </div>
  )
}

function HomeWalletButton({ hasAgent, onConnect, onOpenWizard }) {
  const navigate = useNavigate()
  const [tonConnectUI] = useTonConnectUI()
  const wallet = useTonWallet()
  const { session, logout, user } = useAuthSession()
  const sessionAddress = normalizeWalletAddr(getSessionWalletAddress(session))
  const address = normalizeWalletAddr(wallet?.account?.address || sessionAddress || '')
  const isTonWallet = Boolean(wallet?.account?.address)
  const isManagedSession = Boolean(sessionAddress)
  const privyWalletEntries = hasPrivyWalletSession(session)
    ? getPrivyLinkedWalletEntries(user, address, session)
    : []

  if (!address) {
    return (
      <button className="lt-wallet-btn" onClick={onConnect}>
        <span className="lt-wallet-icon">💎</span>
        Connect Wallet
      </button>
    )
  }

  return (
    <div className="lt-wallet-group">
      {!hasAgent ? (
        <button className="lt-wallet-btn lt-wallet-btn-create" onClick={onOpenWizard}>
          🤖 Create Agent
        </button>
      ) : null}
      <ConnectedWalletMenu
        address={address}
        label={isManagedSession ? 'WDK wallet' : 'Wallet'}
        badgeText={isManagedSession ? 'WDK' : 'TON'}
        linkedWalletEntries={privyWalletEntries}
        icon={isManagedSession ? '✨' : '💎'}
        variant="lite"
        onTopUp={() => navigate('/lite/wallet')}
        onLogout={async () => {
          await logout()
          if (isTonWallet) await tonConnectUI.disconnect().catch(() => {})
        }}
      />
    </div>
  )
}

function getLiteAgentStrategyMeta(agent) {
  if (agent?.activeStrategyTemplateId || agent?.activeStrategyName) {
    return {
      short: agent.activeStrategyName ? agent.activeStrategyName.slice(0, 12) : 'CUSTOM',
      color: '#c4b5fd',
      label: agent.activeStrategyName || getStrategySourceLabel(agent.strategySource),
      desc: agent.activeStrategyDescription || getStrategySourceLabel(agent.strategySource),
      isCustom: true,
    }
  }

  return {
    ...(STRAT[agent?.strategy] || { short: '?', color: '#888', label: 'Unknown', desc: '' }),
    isCustom: false,
  }
}

function getAgentStatusCopy(agent) {
  if (!agent) {
    return {
      title: 'No agent yet',
      description: 'Create your first Lite agent to start using the market.',
    }
  }

  if (agent.lastIdleReason) {
    return {
      title: agent.lastIdleIndexSymbol ? `Watching ${agent.lastIdleIndexSymbol}` : 'Waiting for setup',
      description: agent.lastIdleReason,
    }
  }

  if (agent.status === 'active') {
    return {
      title: 'Agent is live',
      description: 'The agent is running and monitoring the market for the next valid setup.',
    }
  }

  if (agent.status === 'paused') {
    return {
      title: 'Agent paused',
      description: agent.pauseReason || 'Resume the agent when you want it back in the market.',
    }
  }

  return {
    title: `${agent.status || 'idle'}`.toUpperCase(),
    description: 'This agent is currently not executing trades.',
  }
}

function MyAgentHomeCard({ agent, onPause, onResume, onDelete }) {
  const strategyMeta = getLiteAgentStrategyMeta(agent)
  const riskMeta = resolveLiteRiskMeta(agent.riskLevel)
  const equity = Number(agent.equity || 0) || Number(agent.virtualBalance || 0) + Number(agent.positionValue || 0)
  const closedTrades = Number(agent.winningTrades || 0) + Number(agent.losingTrades || 0)
  const winRate = closedTrades > 0 ? ((Number(agent.winningTrades || 0) / closedTrades) * 100).toFixed(2) : '0.00'
  const pnlColor = Number(agent.pnl || 0) >= 0 ? '#6ee7b7' : '#fca5a5'
  const statusCopy = getAgentStatusCopy(agent)
  const lastActivityAt = agent.lastIdleAt || agent.updatedAt || agent.createdAt || null

  return (
    <article className="lt-home-agent-card">
      <div className="lt-myagent-head">
        <div className="lt-myagent-badges">
          <span className="lt-badge-user">MY AGENT</span>
          {isNewAgent(agent.createdAt) ? <span className="lt-badge-new">NEW</span> : null}
          <span className="lt-modal-status" data-active={agent.status === 'active'}>
            {agent.status === 'active' ? '● LIVE' : `○ ${(agent.status || 'idle').toUpperCase()}`}
          </span>
        </div>

        <div className="lt-myagent-identity">
          <span className="lt-modal-avatar">{agent.icon || '🤖'}</span>
          <div className="lt-myagent-info">
            <div className="lt-modal-name">
              <span>{agent.name}</span>
              <span className="lt-pill lt-myagent-cash-pill">Cash {fmt$(agent.virtualBalance || 0)}</span>
            </div>
            <div className="lt-modal-strat">
              <span className="lt-pill" style={{ background: `${strategyMeta.color}22`, color: strategyMeta.color, borderColor: `${strategyMeta.color}44` }}>
                {strategyMeta.label}
              </span>
              {!strategyMeta.isCustom ? (
                <span className="lt-pill" style={{ background: `${riskMeta.color}15`, color: riskMeta.color, borderColor: `${riskMeta.color}33` }}>
                  {riskMeta.icon} {riskMeta.label}
                </span>
              ) : null}
            </div>
          </div>
          <div className="lt-modal-pnl" style={{ color: pnlColor }}>
            {fmtPct(agent.pnlPercent || 0)}
          </div>
        </div>
      </div>

      <div className="lt-modal-hero">
        <div className="lt-hero-item">
          <span className="lt-hero-label">EQUITY</span>
          <span className="lt-hero-value">{fmt$(equity)}</span>
        </div>
        <div className="lt-hero-sep" />
        <div className="lt-hero-item">
          <span className="lt-hero-label">REALIZED</span>
          <span className="lt-hero-value" style={{ color: Number(agent.realizedPnl || 0) >= 0 ? '#6ee7b7' : '#fca5a5' }}>
            {fmt$(agent.realizedPnl || 0)}
          </span>
        </div>
        <div className="lt-hero-sep" />
        <div className="lt-hero-item">
          <span className="lt-hero-label">WIN RATE</span>
          <span className="lt-hero-value">{winRate}%</span>
        </div>
        <div className="lt-hero-sep" />
        <div className="lt-hero-item">
          <span className="lt-hero-label">TRADES</span>
          <span className="lt-hero-value">{agent.totalTrades || 0}</span>
        </div>
      </div>

      <div className="lt-myagent-ctrls">
        {agent.status === 'active' ? (
          <button className="lt-ma-btn lt-ma-btn-pause" onClick={onPause}>⏸ Pause</button>
        ) : (
          <button className="lt-ma-btn lt-ma-btn-resume" onClick={onResume}>▶ Resume</button>
        )}
        <button className="lt-ma-btn lt-ma-btn-delete" onClick={onDelete}>🗑 Remove</button>
      </div>

      <div className="lt-myagent-idle">
        <div className="lt-myagent-idle-head">
          <span>Agent status</span>
          <span>{lastActivityAt ? timeAgo(lastActivityAt) : (agent.status || 'idle')}</span>
        </div>
        <strong>{statusCopy.title}</strong>
        <p>{statusCopy.description}</p>
        <div className="lt-myagent-idle-flags">
          <span className={`lt-myagent-idle-flag ${agent.status === 'active' ? 'lt-myagent-idle-flag-ok' : ''}`}>
            {agent.status || 'idle'}
          </span>
          {agent.activeStrategyMode ? <span className="lt-myagent-idle-flag">{agent.activeStrategyMode}</span> : null}
          {agent.subscriptionOwner ? <span className="lt-myagent-idle-flag">{agent.subscriptionOwner}</span> : null}
        </div>
      </div>

      <div className="lt-modal-grid2">
        <div className="lt-grid2-item">
          <span className="lt-grid2-l">Cash</span>
          <span className="lt-grid2-v">{fmt$(agent.virtualBalance || 0)}</span>
        </div>
        <div className="lt-grid2-item">
          <span className="lt-grid2-l">Position</span>
          <span className="lt-grid2-v">{Number(agent.position || 0).toFixed(2)}</span>
        </div>
        <div className="lt-grid2-item">
          <span className="lt-grid2-l">Position Value</span>
          <span className="lt-grid2-v">{fmt$(agent.positionValue || 0)}</span>
        </div>
        <div className="lt-grid2-item">
          <span className="lt-grid2-l">Unrealized</span>
          <span className="lt-grid2-v" style={{ color: Number(agent.unrealizedPnl || 0) >= 0 ? '#6ee7b7' : '#fca5a5' }}>
            {fmt$(agent.unrealizedPnl || 0)}
          </span>
        </div>
        <div className="lt-grid2-item">
          <span className="lt-grid2-l">Royalties</span>
          <span className="lt-grid2-v">{fmt$(agent.royaltyIncome || 0)}</span>
        </div>
        <div className="lt-grid2-item">
          <span className="lt-grid2-l">Max DD</span>
          <span className="lt-grid2-v">{Number(agent.maxDrawdown || 0).toFixed(2)}%</span>
        </div>
      </div>

      <div className="lt-modal-strategy-desc">
        <span className="lt-modal-desc-icon" style={{ color: strategyMeta.color }}>◆</span>
        {strategyMeta.desc || 'Your Lite agent is ready to trade, subscribe to markets, and install strategies.'}
      </div>

      <div className="lt-home-card-links">
        <Link className="lt-strategy-primary" to="/lite/market">
          <Coins size={14} />
          <span>Open market</span>
        </Link>
        <Link className="lt-strategy-ghost" to="/lite/strategies">
          <Sparkles size={14} />
          <span>Strategy market</span>
        </Link>
        <Link className="lt-strategy-ghost" to="/lite/wallet">
          <Wallet size={14} />
          <span>Managed wallet</span>
        </Link>
      </div>
    </article>
  )
}

export default function LitePage() {
  const connectChooser = useConnectWalletChooser({ mode: 'lite' })
  const { session } = useAuthSession()
  const wallet = useTonWallet()
  const tonRawAddress = useTonAddress(false)
  const sessionWalletAddress = normalizeWalletAddr(getSessionWalletAddress(session))
  const walletAddress = normalizeWalletAddr(tonRawAddress || wallet?.account?.address || sessionWalletAddress || '')

  const [agents, setAgents] = useState([])
  const [myAgentId, setMyAgentId] = useState(null)
  const [agentLookupLoading, setAgentLookupLoading] = useState(false)

  const loadAgents = useCallback(async () => {
    const data = await fetchEngineAgents()
    setAgents(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    let alive = true

    const run = async () => {
      try {
        const data = await fetchEngineAgents()
        if (!alive) return
        setAgents(Array.isArray(data) ? data : [])
      } catch {}
    }

    run()
    const iv = window.setInterval(run, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(iv)
    }
  }, [])

  useEffect(() => {
    setWalletAddress(walletAddress || null)

    if (!walletAddress) {
      setMyAgentId(null)
      setAgentLookupLoading(false)
      return
    }

    let cancelled = false
    const cachedId = localStorage.getItem(`odrob_agent_${walletAddress}`)
    setAgentLookupLoading(true)

    loginWallet(walletAddress)
      .then(() => fetchAgentByWallet(walletAddress))
      .then(({ agent }) => {
        if (cancelled) return
        if (agent) {
          setMyAgentId(agent.id)
          localStorage.setItem(`odrob_agent_${walletAddress}`, agent.id)
          setAgents((prev) => {
            const rest = prev.filter((item) => item.id !== agent.id)
            return [agent, ...rest]
          })
        } else {
          setMyAgentId(null)
          localStorage.removeItem(`odrob_agent_${walletAddress}`)
        }
      })
      .catch(() => {
        if (cancelled) return
        if (cachedId) setMyAgentId(cachedId)
      })
      .finally(() => {
        if (!cancelled) setAgentLookupLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [walletAddress])

  const normalizedWallet = normalizeWalletAddr(walletAddress)
  const myAgent = useMemo(() => {
    if (!normalizedWallet && !myAgentId) return null
    return agents.find((agent) => agent.id === myAgentId)
      || agents.find((agent) => agent.isUserAgent && normalizeWalletAddr(agent.walletAddress) === normalizedWallet)
      || null
  }, [agents, myAgentId, normalizedWallet])

  useEffect(() => {
    if (myAgent && myAgent.id !== myAgentId) {
      setMyAgentId(myAgent.id)
    }
  }, [myAgent, myAgentId])

  const openWizard = useCallback(() => {
    const target = document.getElementById('lite-create-agent')
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const handleAgentCreated = useCallback(async (created) => {
    setMyAgentId(created.id)
    if (walletAddress) localStorage.setItem(`odrob_agent_${walletAddress}`, created.id)
    setAgents((prev) => {
      const rest = prev.filter((item) => item.id !== created.id)
      return [created, ...rest]
    })
    await loadAgents().catch(() => {})
  }, [loadAgents, walletAddress])

  const handlePause = useCallback(async () => {
    if (!myAgentId) return
    try {
      await pauseEngineAgent(myAgentId)
      await loadAgents()
    } catch (error) {
      console.warn('Pause failed', error)
    }
  }, [loadAgents, myAgentId])

  const handleResume = useCallback(async () => {
    if (!myAgentId) return
    try {
      await startEngineAgent(myAgentId)
      await loadAgents()
    } catch (error) {
      console.warn('Resume failed', error)
    }
  }, [loadAgents, myAgentId])

  const handleDelete = useCallback(async () => {
    if (!myAgentId) return
    if (!window.confirm('Remove your agent from Lite?')) return

    try {
      await deleteEngineAgent(myAgentId)
      setMyAgentId(null)
      setAgents((prev) => prev.filter((agent) => agent.id !== myAgentId))
      if (walletAddress) localStorage.removeItem(`odrob_agent_${walletAddress}`)
    } catch (error) {
      console.warn('Delete failed', error)
    }
  }, [myAgentId, walletAddress])

  const headline = !walletAddress
    ? 'Connect wallet'
    : myAgent
      ? 'My Agent'
      : 'Create Agent'

  return (
    <div className="lite-root">
      <Particles />

      <header className="lt-header">
        <div className="lt-logo">
          <span className="lt-logo-icon">⚡</span>
          <span className="lt-logo-text">ODROB</span>
          <span className="lt-logo-badge">LITE</span>
        </div>

        <div className="lt-price-block">
          <div className="lt-price-top">
            <span className="lt-live-dot" /> LITE HOME
          </div>
          <div className="lt-price lt-price-same">{headline}</div>
        </div>

        <div className="lt-header-end">
          <Link className="lt-header-idx-btn" to="/lite/market" title="Open Lite market">
            <Coins size={15} />
          </Link>
          <Link className="lt-header-idx-btn" to="/lite/strategies" title="Open strategy market">
            <Sparkles size={15} />
          </Link>
          <Link className="lt-header-idx-btn" to="/lite/wallet" title="Open managed wallet">
            <Wallet size={15} />
          </Link>
          <HomeWalletButton hasAgent={Boolean(myAgent)} onConnect={connectChooser.openChooser} onOpenWizard={openWizard} />
        </div>
      </header>

      <main className="lt-page-shell">
        <div className="lt-page-content">
          <div className="lt-page-head lt-home-hero">
            <div>
              <div className="lt-page-kicker">MAIN PAGE</div>
              <h1><Bot size={18} /> Lite Agent Home</h1>
              <p>
                Main `Lite` now focuses on your agent: create it here without a popup, manage it from this screen,
                and use the separate market page for the trading flow.
              </p>
            </div>
            <div className="lt-page-links">
              <Link className="lt-strategy-primary" to="/lite/market">
                <Coins size={14} />
                <span>Open market</span>
              </Link>
              <Link className="lt-strategy-ghost" to="/lite/strategies">
                <Sparkles size={14} />
                <span>Strategies</span>
              </Link>
            </div>
          </div>

          {!walletAddress ? (
            <section className="lt-home-layout">
              <article className="lt-home-panel">
                <span className="lt-page-kicker">WALLET REQUIRED</span>
                <h2>Connect your wallet to create a Lite agent.</h2>
                <p>
                  After connection this page will show the inline creation wizard. The market screen remains available
                  separately if you want to browse first.
                </p>
                <div className="lt-home-card-links">
                  <button className="lt-strategy-primary" onClick={connectChooser.openChooser}>
                    <Bot size={14} />
                    <span>Connect wallet</span>
                  </button>
                  <Link className="lt-strategy-ghost" to="/lite/market">
                    <Coins size={14} />
                    <span>Browse market</span>
                  </Link>
                </div>
              </article>

              <article className="lt-home-panel lt-home-panel-secondary">
                <span className="lt-page-kicker">HOW IT WORKS</span>
                <h2>Create on home. Trade on market.</h2>
                <p>
                  The old Lite market layout has been moved to a dedicated page so the home screen can stay focused on
                  creation and management of your personal agent.
                </p>
              </article>
            </section>
          ) : agentLookupLoading && !myAgent ? (
            <section className="lt-home-loading">
              <div className="lt-spin-lg" />
              <strong>Checking this wallet for an existing agent…</strong>
              <span>If nothing is found, the create-agent wizard will appear here.</span>
            </section>
          ) : myAgent ? (
            <section className="lt-home-layout">
              <MyAgentHomeCard agent={myAgent} onPause={handlePause} onResume={handleResume} onDelete={handleDelete} />

              <aside className="lt-home-side">
                <article className="lt-home-panel">
                  <span className="lt-page-kicker">NEXT STEP</span>
                  <h2>Market moved to its own page.</h2>
                  <p>
                    Use the market screen for browsing indexes and live flow. This screen stays focused on your agent.
                  </p>
                  <div className="lt-home-card-links">
                    <Link className="lt-strategy-primary" to="/lite/market">
                      <Coins size={14} />
                      <span>Go to market</span>
                    </Link>
                  </div>
                </article>

                <article className="lt-home-panel lt-home-panel-secondary">
                  <span className="lt-page-kicker">AGENT SNAPSHOT</span>
                  <h2>{myAgent.name}</h2>
                  <p>Created {myAgent.createdAt ? timeAgo(myAgent.createdAt) : 'recently'}.</p>
                  <div className="lt-home-mini-stats">
                    <div className="lt-home-mini-stat">
                      <span>P&L</span>
                      <strong className={(myAgent.pnl || 0) >= 0 ? 'c-green' : 'c-red'}>{fmtPct(myAgent.pnlPercent || 0)}</strong>
                    </div>
                    <div className="lt-home-mini-stat">
                      <span>Status</span>
                      <strong>{myAgent.status || 'idle'}</strong>
                    </div>
                    <div className="lt-home-mini-stat">
                      <span>Wallet</span>
                      <strong>{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</strong>
                    </div>
                  </div>
                </article>
              </aside>
            </section>
          ) : (
            <section className="lt-home-layout lt-home-layout-create">
              <article className="lt-home-panel">
                <span className="lt-page-kicker">CREATE FLOW</span>
                <h2>No agent found for this wallet.</h2>
                <p>
                  The creation wizard is embedded directly on the Lite home page. Launch your first agent here, then
                  use the new market page for trading and subscriptions.
                </p>
                <div className="lt-home-card-links">
                  <Link className="lt-strategy-ghost" to="/lite/market">
                    <Coins size={14} />
                    <span>Open market first</span>
                  </Link>
                  <Link className="lt-strategy-ghost" to="/lite/wallet">
                    <Wallet size={14} />
                    <span>Top up wallet</span>
                  </Link>
                </div>
              </article>

              <section id="lite-create-agent" className="lt-home-wizard-panel">
                <LiteCreateAgentModal
                  inline
                  walletAddress={walletAddress}
                  onCreated={handleAgentCreated}
                />
              </section>
            </section>
          )}
        </div>
      </main>

      <ConnectWalletModal {...connectChooser.modalProps} />
    </div>
  )
}
