import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, defs
} from 'recharts'

const API = 'https://earthrevibe-ai.onrender.com'

const PALETTE = {
  olive: '#a8b87c',
  oliveDeep: '#7e8a5a',
  terracotta: '#d4815c',
  gold: '#d4a554',
  rust: '#b85a3a',
  cream: '#f5ede0',
  charcoal: '#0c0b08',
  border: 'rgba(212, 187, 144, 0.1)',
  muted: 'rgba(245, 237, 224, 0.32)',
  text: '#f5ede0',
}

const TONE_COLORS = ['#a8b87c', '#d4815c', '#d4a554', '#7e8a5a', '#b85a3a', '#c8d4a0']

const card = {
  background: 'rgba(245, 237, 224, 0.025)',
  borderRadius: 16,
  border: '1px solid rgba(212, 187, 144, 0.08)',
  backdropFilter: 'blur(20px)',
  padding: 24,
}

const sectionTitle = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: 22,
  fontWeight: 600,
  color: PALETTE.cream,
  letterSpacing: '-0.3px',
  marginBottom: 16,
  display: 'flex',
  alignItems: 'baseline',
  gap: 10,
}

const sectionEyebrow = {
  fontFamily: "'Cormorant Garamond', serif",
  fontStyle: 'italic',
  fontSize: 13,
  color: PALETTE.terracotta,
  letterSpacing: '0.05em',
}

// ─────────────── Helpers ───────────────
function timeAgo(date) {
  if (!date) return '—'
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function fmtTime(date) {
  if (!date) return '—'
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function avatarColor(name) {
  if (!name) return PALETTE.olive
  const seed = name.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  const colors = [PALETTE.olive, PALETTE.terracotta, PALETTE.gold, PALETTE.oliveDeep, PALETTE.rust]
  return colors[seed % colors.length]
}

// Animated counter
function AnimatedNumber({ value, suffix = '', duration = 800 }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const start = performance.now()
    const from = display
    const to = typeof value === 'number' ? value : 0
    let frame
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (to - from) * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  const rounded = Math.round(display)
  return <span>{rounded.toLocaleString('en-IN')}{suffix}</span>
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{
      background: 'rgba(20, 17, 13, 0.95)',
      border: `1px solid ${PALETTE.border}`,
      borderRadius: 10,
      padding: '10px 14px',
      backdropFilter: 'blur(10px)',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: PALETTE.cream, marginBottom: 4 }}>{label || payload[0].name}</div>
      <div style={{ fontSize: 12, color: PALETTE.olive, fontFamily: 'Manrope, sans-serif' }}>
        {payload[0].value} {payload[0].value === 1 ? 'comment' : 'comments'}
      </div>
    </div>
  )
}

// ─────────────── Main Component ───────────────
export default function Analytics() {
  const [comments, setComments] = useState([])
  const [igData, setIgData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())

  // Initial load + live refresh every 30s
  useEffect(() => {
    const load = () => {
      axios.get(`${API}/api/comments`).then(r => {
        setComments(r.data)
        setLoading(false)
      }).catch(() => setLoading(false))
    }
    load()
    axios.get(`${API}/api/analytics`).then(r => setIgData(r.data)).catch(() => {})
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  // Tick the "X seconds ago" labels every 5s
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(t)
  }, [])

  // ─── Derived metrics (useMemo to avoid recalc on every render) ───
  const m = useMemo(() => {
    const total = comments.length
    const autoPosted = comments.filter(c => c.Status === 'auto_posted')
    const approved = comments.filter(c => c.Status === 'approved')
    const pending = comments.filter(c => c.Status === 'pending')
    const skipped = comments.filter(c => c.Status === 'skipped')
    const autoRate = total ? Math.round((autoPosted.length / total) * 100) : 0

    // Response time on auto-posted (ApprovedAt - Timestamp)
    const withTimes = autoPosted.filter(c => c.ApprovedAt && c.Timestamp)
    const avgRespSec = withTimes.length
      ? withTimes.reduce((s, c) => s + Math.max(0, (new Date(c.ApprovedAt).getTime() - new Date(c.Timestamp).getTime()) / 1000), 0) / withTimes.length
      : 0

    // Last activity
    const sorted = [...comments].sort((a, b) => new Date(b.Timestamp || 0).getTime() - new Date(a.Timestamp || 0).getTime())
    const last = sorted[0]

    // Intent breakdown
    const intentCounts = {}
    comments.forEach(c => { if (c.Intent) intentCounts[c.Intent] = (intentCounts[c.Intent] || 0) + 1 })
    const intentData = Object.entries(intentCounts).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // Tone usage
    const toneCounts = {}
    autoPosted.concat(approved).forEach(c => {
      const tone = c.Reply1Tone
      if (tone) toneCounts[tone] = (toneCounts[tone] || 0) + 1
    })
    const toneData = Object.entries(toneCounts).map(([name, value]) => ({ name, value }))

    // Tone with rating
    const goodTones = {}; const badTones = {}
    comments.forEach(c => {
      if (c.Rating === 'good' && c.Reply1Tone) goodTones[c.Reply1Tone] = (goodTones[c.Reply1Tone] || 0) + 1
      if (c.Rating === 'bad' && c.Reply1Tone) badTones[c.Reply1Tone] = (badTones[c.Reply1Tone] || 0) + 1
    })

    // Top posts (group by truncated caption)
    const postCounts = {}
    comments.forEach(c => {
      const key = (c.PostCaption || 'Earth Revibe post').substring(0, 80)
      postCounts[key] = (postCounts[key] || 0) + 1
    })
    const topPosts = Object.entries(postCounts)
      .map(([caption, count]) => ({ caption, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Top commenters
    const commenterCounts = {}
    comments.forEach(c => {
      const key = c.AuthorName || 'Unknown'
      if (key === 'Instagram User' || key === 'Unknown') return
      commenterCounts[key] = (commenterCounts[key] || 0) + 1
    })
    const topCommenters = Object.entries(commenterCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    // Live feed — most recent processed comments
    const liveFeed = sorted.slice(0, 10)

    // Comment flow: last 24 hours, hourly buckets
    const flow = []
    for (let i = 23; i >= 0; i--) {
      const slot = new Date()
      slot.setMinutes(0, 0, 0)
      slot.setHours(slot.getHours() - i)
      const slotStart = slot.getTime()
      const slotEnd = slotStart + 60 * 60 * 1000
      const count = comments.filter(c => {
        const ts = new Date(c.Timestamp || 0).getTime()
        return ts >= slotStart && ts < slotEnd
      }).length
      flow.push({ label: slot.getHours().toString().padStart(2, '0'), count })
    }

    return {
      total, autoPosted, approved, pending, skipped, autoRate, avgRespSec,
      last, intentData, toneData, goodTones, badTones,
      topPosts, topCommenters, liveFeed, flow,
    }
  }, [comments])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80, color: PALETTE.muted }}>Loading the dashboard…</div>
  }

  // ═══════════════════════════════════════════════════
  return (
    <div>
      {/* ═══ HERO KPIs ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          {
            label: 'Total Handled', value: m.total, color: PALETTE.cream,
            sub: m.last ? `last ${timeAgo(m.last.Timestamp)}` : 'no activity yet',
            tint: 'rgba(245, 237, 224, 0.04)',
          },
          {
            label: 'Auto-Reply Rate', value: m.autoRate, suffix: '%', color: PALETTE.olive,
            sub: `${m.autoPosted.length} of ${m.total || '—'} replies`,
            tint: PALETTE.olive + '14',
          },
          {
            label: 'Pending Review', value: m.pending.length, color: PALETTE.gold,
            sub: m.pending.length ? 'needs your call' : 'clean — nothing waiting',
            tint: PALETTE.gold + '14',
          },
          {
            label: 'Avg Response', value: Math.round(m.avgRespSec), suffix: 's', color: PALETTE.terracotta,
            sub: m.avgRespSec ? 'comment → reply' : 'no auto-replies yet',
            tint: PALETTE.terracotta + '14',
          },
          {
            label: 'Followers', value: igData?.followers_count || 0, color: PALETTE.gold,
            sub: igData ? `${igData.media_count} posts` : 'loading…',
            tint: PALETTE.gold + '14',
          },
        ].map((s, i) => (
          <div key={s.label} style={{
            ...card,
            background: `linear-gradient(135deg, ${s.tint}, rgba(245, 237, 224, 0.015))`,
            animation: `slideUp 0.5s ease-out ${i * 0.08}s backwards`,
          }}>
            <div style={{
              fontSize: 10, color: PALETTE.muted, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12,
            }}>
              {s.label}
            </div>
            <div className="num" style={{
              fontSize: 38, fontWeight: 700, color: s.color,
              lineHeight: 1, letterSpacing: '-1.5px',
            }}>
              <AnimatedNumber value={s.value} suffix={s.suffix || ''} />
            </div>
            <div style={{ fontSize: 11, color: PALETTE.muted, marginTop: 8 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ═══ PROFILE BANNER ═══ */}
      {igData && (
        <div style={{
          ...card, marginBottom: 24, padding: 22,
          background: `linear-gradient(135deg, ${PALETTE.olive}1a, ${PALETTE.terracotta}0c, rgba(245, 237, 224, 0.015))`,
          border: `1px solid ${PALETTE.olive}33`,
          display: 'flex', alignItems: 'center', gap: 20,
          animation: 'slideUp 0.5s ease-out 0.4s backwards',
        }}>
          {igData.profile_picture_url && (
            <img src={igData.profile_picture_url} alt="" style={{
              width: 64, height: 64, borderRadius: 14,
              border: `2px solid ${PALETTE.olive}44`,
              boxShadow: `0 4px 20px ${PALETTE.olive}22`,
            }} />
          )}
          <div style={{ flex: 1 }}>
            <div className="serif" style={{ fontSize: 22, fontWeight: 600, color: PALETTE.cream, letterSpacing: '-0.3px' }}>
              @{igData.name}
            </div>
            <div style={{ fontSize: 12, color: PALETTE.muted, marginTop: 4, lineHeight: 1.5, maxWidth: 540 }}>
              {igData.biography}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            <div style={{ textAlign: 'right' }}>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: PALETTE.olive }}>
                {igData.followers_count?.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 10, color: PALETTE.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>
                Followers
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="num" style={{ fontSize: 22, fontWeight: 700, color: PALETTE.terracotta }}>
                {igData.media_count}
              </div>
              <div style={{ fontSize: 10, color: PALETTE.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>
                Posts
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ LIVE FEED + COMMENT FLOW ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, marginBottom: 24 }}>
        {/* Live Activity Feed */}
        <div style={{ ...card, animation: 'slideUp 0.5s ease-out 0.5s backwards', maxHeight: 420, overflowY: 'auto' }}>
          <div style={{ ...sectionEyebrow, marginBottom: 2 }}>§ live</div>
          <div style={sectionTitle}>Activity stream</div>
          {m.liveFeed.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: PALETTE.muted, fontSize: 12 }}>
              Quiet for now — comments will appear here as they happen.
            </div>
          ) : (
            <div>
              {m.liveFeed.map((c, i) => (
                <div key={c.id || i} style={{
                  display: 'flex', gap: 10, padding: '10px 0',
                  borderBottom: i === m.liveFeed.length - 1 ? 'none' : `1px dashed ${PALETTE.border}`,
                  animation: `slideRight 0.4s ease-out ${i * 0.04}s backwards`,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: avatarColor(c.AuthorName) + '33',
                    color: avatarColor(c.AuthorName),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {(c.AuthorName || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: PALETTE.cream, fontWeight: 600 }}>
                      {c.AuthorName || 'someone'}
                      <span style={{ color: PALETTE.muted, fontWeight: 400, fontSize: 11, marginLeft: 6 }}>
                        · {timeAgo(c.Timestamp)}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: PALETTE.muted, marginTop: 2, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      "{c.CommentText}"
                    </div>
                    {c.Status === 'auto_posted' && c.ApprovedReply && (
                      <div style={{
                        fontSize: 11, color: PALETTE.olive, marginTop: 3,
                        padding: '4px 8px', borderRadius: 6,
                        background: 'rgba(168, 184, 124, 0.08)',
                        display: 'inline-block', maxWidth: '100%',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        ↳ replied: "{c.ApprovedReply}"
                      </div>
                    )}
                    {c.Status === 'pending' && (
                      <span style={{
                        fontSize: 10, color: PALETTE.gold, marginTop: 3, display: 'inline-block',
                        padding: '2px 6px', borderRadius: 4, background: 'rgba(212, 165, 84, 0.1)',
                      }}>
                        pending review
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comment flow chart */}
        <div style={{ ...card, animation: 'slideUp 0.5s ease-out 0.6s backwards' }}>
          <div style={{ ...sectionEyebrow, marginBottom: 2 }}>§ flow</div>
          <div style={sectionTitle}>Comments over 24 hours</div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={m.flow} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="flowGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE.olive} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={PALETTE.olive} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: PALETTE.muted }}
                axisLine={{ stroke: PALETTE.border }} tickLine={false}
                interval={2} />
              <YAxis tick={{ fontSize: 10, fill: PALETTE.muted }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: PALETTE.olive, strokeWidth: 1, strokeDasharray: '3 3' }} />
              <Area type="monotone" dataKey="count" stroke={PALETTE.olive} strokeWidth={2}
                fill="url(#flowGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ═══ INTENT + TONE ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ ...card, animation: 'slideUp 0.5s ease-out 0.7s backwards' }}>
          <div style={{ ...sectionEyebrow, marginBottom: 2 }}>§ intent</div>
          <div style={sectionTitle}>What people are saying</div>
          {m.intentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={m.intentData} barCategoryGap="22%" margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="intentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PALETTE.terracotta} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={PALETTE.terracotta} stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: PALETTE.muted }}
                  axisLine={{ stroke: PALETTE.border }} tickLine={false}
                  angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: PALETTE.muted }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(212, 129, 92, 0.06)' }} />
                <Bar dataKey="value" fill="url(#intentGrad)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: 60, color: PALETTE.muted, fontSize: 12 }}>
              Process some comments to see the breakdown.
            </div>
          )}
        </div>

        <div style={{ ...card, animation: 'slideUp 0.5s ease-out 0.8s backwards' }}>
          <div style={{ ...sectionEyebrow, marginBottom: 2 }}>§ voice</div>
          <div style={sectionTitle}>Reply tones used</div>
          {m.toneData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={m.toneData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" outerRadius={80} innerRadius={48}
                    paddingAngle={3} strokeWidth={0}>
                    {m.toneData.map((_, i) => <Cell key={i} fill={TONE_COLORS[i % TONE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 12 }}>
                {m.toneData.map((t, i) => (
                  <div key={t.name} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '5px 0', fontSize: 12,
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 10, height: 10, borderRadius: 2,
                        background: TONE_COLORS[i % TONE_COLORS.length],
                      }} />
                      <span style={{ color: PALETTE.cream }}>{t.name}</span>
                    </span>
                    <span className="num" style={{ color: PALETTE.muted }}>{t.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 60, color: PALETTE.muted, fontSize: 12 }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>◐</div>
              Reply tone breakdown will appear once the AI starts posting.
            </div>
          )}
        </div>
      </div>

      {/* ═══ TOP POSTS + TOP COMMENTERS ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Top posts */}
        <div style={{ ...card, animation: 'slideUp 0.5s ease-out 0.9s backwards' }}>
          <div style={{ ...sectionEyebrow, marginBottom: 2 }}>§ posts</div>
          <div style={sectionTitle}>Posts driving conversation</div>
          {m.topPosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: PALETTE.muted, fontSize: 12 }}>
              No posts tracked yet.
            </div>
          ) : (
            <div>
              {m.topPosts.map((p, i) => {
                const max = m.topPosts[0]?.count || 1
                const pct = (p.count / max) * 100
                return (
                  <div key={i} style={{ marginBottom: 14, animation: `slideRight 0.4s ease-out ${i * 0.06}s backwards` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, gap: 12 }}>
                      <span style={{
                        fontSize: 12, color: PALETTE.cream, flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        <span className="num" style={{ color: PALETTE.terracotta, marginRight: 8, fontWeight: 600 }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        {p.caption.length > 70 ? p.caption.substring(0, 70) + '…' : p.caption}
                      </span>
                      <span className="num" style={{ fontSize: 12, color: PALETTE.olive, fontWeight: 600, flexShrink: 0 }}>
                        {p.count}
                      </span>
                    </div>
                    <div style={{ height: 4, background: PALETTE.border, borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: `linear-gradient(90deg, ${PALETTE.terracotta}, ${PALETTE.gold})`,
                        borderRadius: 2, transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Top commenters */}
        <div style={{ ...card, animation: 'slideUp 0.5s ease-out 1.0s backwards' }}>
          <div style={{ ...sectionEyebrow, marginBottom: 2 }}>§ community</div>
          <div style={sectionTitle}>Top voices</div>
          {m.topCommenters.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: PALETTE.muted, fontSize: 12 }}>
              The community is just getting started.
            </div>
          ) : (
            <div>
              {m.topCommenters.map((u, i) => (
                <div key={u.name} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                  borderBottom: i === m.topCommenters.length - 1 ? 'none' : `1px dashed ${PALETTE.border}`,
                  animation: `slideRight 0.4s ease-out ${i * 0.06}s backwards`,
                }}>
                  <span className="num" style={{
                    fontSize: 13, color: i === 0 ? PALETTE.gold : PALETTE.muted,
                    fontWeight: 700, width: 22,
                  }}>
                    {i === 0 ? '✦' : String(i + 1).padStart(2, '0')}
                  </span>
                  <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: avatarColor(u.name) + '33',
                    color: avatarColor(u.name),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                  }}>
                    {u.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: PALETTE.cream }}>
                    {u.name}
                  </div>
                  <div className="num" style={{ fontSize: 13, color: PALETTE.olive, fontWeight: 600 }}>
                    {u.count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <div style={{
        textAlign: 'center', fontSize: 11, color: PALETTE.muted, padding: '24px 0 8px',
        fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic',
      }}>
        VIBE · slow growth, sharp replies · live data refreshes every 30s
      </div>
    </div>
  )
}
