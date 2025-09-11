import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [health, setHealth] = useState(null)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'error' }))
  }, [])

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand">Relatim</div>
        <div className="top-actions">
          <button className="top-btn">Message</button>
          <button className="top-btn">Dashboard</button>
        </div>
      </header>
      <div className="main">
        <aside className="sidebar">
          <div className="tabs">
            <button
              className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              Chat
            </button>
            <button
              className={`tab ${activeTab === 'contacts' ? 'active' : ''}`}
              onClick={() => setActiveTab('contacts')}
            >
              Contacts
            </button>
          </div>
        </aside>
        <section className="content">
          {activeTab === 'chat' ? (
            <div className="chat-window">
              <div className="threads">
                <div className="thread-item active">Alice</div>
                <div className="thread-item">Bob</div>
              </div>
              <div className="messages">
                <div className="message incoming">Hi there!</div>
                <div className="message outgoing">Hello 👋</div>
              </div>
              <div className="composer">
                <input placeholder="Type a message" />
                <button>Send</button>
              </div>
            </div>
          ) : (
            <div className="contacts">
              <div className="contact">Alice</div>
              <div className="contact">Bob</div>
              <div className="contact">Charlie</div>
            </div>
          )}
        </section>
      </div>
      <footer className="status">
        API: {health ? JSON.stringify(health) : 'checking...'}
      </footer>
    </div>
  )
}

export default App
