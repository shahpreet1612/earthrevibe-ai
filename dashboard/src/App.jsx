import { useState, useEffect } from 'react'
import CommentQueue from './components/CommentQueue'
import Analytics from './components/Analytics'
import './App.css'

export default function App() {
  const [tab, setTab] = useState('queue')
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="brand-mark">VB</div>
          <div className="brand-text">
            <span className="logo">VIBE</span>
            <span className="logo-sub">Earth Revibe AI</span>
          </div>
        </div>
        <nav className="nav">
          <button
            className={tab === 'queue' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setTab('queue')}>
            Comment Queue
          </button>
          <button
            className={tab === 'analytics' ? 'nav-btn active' : 'nav-btn'}
            onClick={() => setTab('analytics')}>
            Analytics
          </button>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="num" style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
            {timeStr} IST
          </span>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div className="live-dot"></div>
            <span className="live-text">LIVE</span>
          </div>
        </div>
      </header>
      <main className="main">
        {tab === 'queue' ? <CommentQueue /> : <Analytics />}
      </main>
    </div>
  )
}
