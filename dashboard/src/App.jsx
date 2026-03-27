import { useState } from 'react'
import CommentQueue from './components/CommentQueue'
import Analytics from './components/Analytics'
import './App.css'

export default function App() {
  const [tab, setTab] = useState('queue')

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="logo">VIBE</span>
          <span className="logo-sub">Earth Revibe AI</span>
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
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className="live-dot"></div>
          <span className="live-text">LIVE</span>
        </div>
      </header>
      <main className="main">
        {tab === 'queue' ? <CommentQueue /> : <Analytics />}
      </main>
    </div>
  )
}
