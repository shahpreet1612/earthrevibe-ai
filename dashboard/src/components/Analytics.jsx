import { useState, useEffect } from 'react'
import axios from 'axios'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const API = 'http://localhost:3001'
const COLORS = ['#7c5cfc', '#34d399', '#fbbf24', '#f87171', '#60a5fa', '#c084fc', '#fb923c']

const card = {
  background: 'rgba(255,255,255,0.02)',
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.06)',
  backdropFilter: 'blur(10px)',
  padding: 24,
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(10,10,15,0.95)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10, padding: '10px 14px', backdropFilter: 'blur(10px)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f0f5' }}>{label || payload[0].name}</div>
        <div style={{ fontSize: 12, color: '#a78bfa', marginTop: 4 }}>{payload[0].value} comments</div>
      </div>
    )
  }
  return null
}

export default function Analytics() {
  const [comments, setComments] = useState([])
  const [igData, setIgData] = useState(null)

  useEffect(() => {
    axios.get(`${API}/api/comments`).then(r => setComments(r.data))
    axios.get(`${API}/api/analytics`).then(r => setIgData(r.data)).catch(() => {})
  }, [])

  const intentCounts = comments.reduce((acc, c) => {
    acc[c.Intent] = (acc[c.Intent] || 0) + 1; return acc
  }, {})
  const intentData = Object.entries(intentCounts).map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const toneCounts = comments.reduce((acc, c) => {
    if (c.Status === 'approved' && c.Reply1Tone) { acc[c.Reply1Tone] = (acc[c.Reply1Tone] || 0) + 1 }
    return acc
  }, {})
  const toneData = Object.entries(toneCounts).map(([name, value]) => ({ name, value }))

  const statusCounts = comments.reduce((acc, c) => {
    acc[c.Status] = (acc[c.Status] || 0) + 1; return acc
  }, {})

  const autoRate = comments.length > 0
    ? Math.round(((statusCounts['auto_posted'] || 0) / comments.length) * 100)
    : 0

  return (
    <div>
      {/* IG profile card */}
      {igData && (
        <div style={{
          ...card, marginBottom: 20, display: 'flex', gap: 24, alignItems: 'center',
          background: 'linear-gradient(135deg, rgba(124,92,252,0.06), rgba(255,255,255,0.02))',
          border: '1px solid rgba(124,92,252,0.12)',
        }}>
          {igData.profile_picture_url && (
            <img src={igData.profile_picture_url} style={{
              width: 72, height: 72, borderRadius: 16,
              border: '2px solid rgba(124,92,252,0.2)',
              boxShadow: '0 4px 20px rgba(124,92,252,0.15)',
            }} />
          )}
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f0f0f5' }}>@{igData.name}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '6px 0' }}>{igData.biography}</div>
            <div style={{ display: 'flex', gap: 28, marginTop: 10 }}>
              <div>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#7c5cfc' }}>{igData.followers_count?.toLocaleString()}</span>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Followers</div>
              </div>
              <div>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#34d399' }}>{igData.media_count}</span>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Posts</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total Comments', value: comments.length, color: '#7c5cfc', glow: 'rgba(124,92,252,0.08)', icon: '📊' },
          { label: 'Pending', value: statusCounts['pending'] || 0, color: '#fbbf24', glow: 'rgba(251,191,36,0.08)', icon: '⏳' },
          { label: 'Approved', value: statusCounts['approved'] || 0, color: '#34d399', glow: 'rgba(52,211,153,0.08)', icon: '✅' },
          { label: 'Auto-Post Rate', value: `${autoRate}%`, color: '#60a5fa', glow: 'rgba(96,165,250,0.08)', icon: '⚡' },
        ].map((s, i) => (
          <div key={s.label} style={{
            ...card, padding: '20px 22px',
            background: `linear-gradient(135deg, ${s.glow}, rgba(255,255,255,0.02))`,
            animation: `slideUp 0.5s ease-out ${i * 0.08}s backwards`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 36, fontWeight: 700, color: s.color, letterSpacing: '-1px', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
              </div>
              <span style={{ fontSize: 24, opacity: 0.5 }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Intent breakdown */}
        <div style={{ ...card, animation: 'slideUp 0.5s ease-out 0.3s backwards' }}>
          <div style={{
            fontSize: 13, fontWeight: 600, marginBottom: 20, color: '#f0f0f5',
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <span style={{
              background: 'linear-gradient(135deg, rgba(124,92,252,0.2), rgba(124,92,252,0.05))',
              padding: '4px 8px', borderRadius: 6, fontSize: 14
            }}>🎯</span>
            Comment Intent Breakdown
          </div>
          {intentData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={intentData} barCategoryGap="20%">
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(124,92,252,0.05)' }} />
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c5cfc" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#7c5cfc" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <Bar dataKey="value" fill="url(#barGrad)" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: 50, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
              No data yet
            </div>
          )}
        </div>

        {/* Tone performance */}
        <div style={{ ...card, animation: 'slideUp 0.5s ease-out 0.4s backwards' }}>
          <div style={{
            fontSize: 13, fontWeight: 600, marginBottom: 20, color: '#f0f0f5',
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <span style={{
              background: 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(52,211,153,0.05))',
              padding: '4px 8px', borderRadius: 6, fontSize: 14
            }}>🎨</span>
            Reply Tones Approved
          </div>
          {toneData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={toneData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={80} innerRadius={45}
                  paddingAngle={3} strokeWidth={0}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {toneData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', padding: 50, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>🎨</div>
              Approve some comments to see tone data
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
