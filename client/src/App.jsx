import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const [health, setHealth] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })

  const [contacts, setContacts] = useState([])
  const [activeContact, setActiveContact] = useState(null)
  const [messagesByOtherUser, setMessagesByOtherUser] = useState({}) // { otherUserId: [msgs] }
  const [draft, setDraft] = useState('')
  const [ws, setWs] = useState(null)

  // Auth form state
  const [authPhone, setAuthPhone] = useState('')
  const [authName, setAuthName] = useState('')

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'error' }))
  }, [])

  // Load contacts after login
  useEffect(() => {
    if (!currentUser) return
    fetch('/api/contacts', { headers: { 'X-User-Id': currentUser.id } })
      .then((r) => r.json())
      .then((data) => setContacts(data.contacts || []))
      .catch(() => {})
  }, [currentUser])

  // WebSocket connection
  useEffect(() => {
    if (!currentUser) {
      if (ws) {
        ws.close()
        setWs(null)
      }
      return
    }

    const websocket = new WebSocket('ws://localhost:3001')
    
    websocket.onopen = () => {
      console.log('WebSocket connected')
      // Authenticate with user ID
      websocket.send(JSON.stringify({
        type: 'auth',
        userId: currentUser.id
      }))
    }

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'new_message') {
          const message = data.message
          const otherUserId = message.sender_id === currentUser.id ? message.recipient_id : message.sender_id
          
          setMessagesByOtherUser((prev) => ({
            ...prev,
            [otherUserId]: [...(prev[otherUserId] || []), message]
          }))
        }
      } catch (err) {
        console.error('WebSocket message error:', err)
      }
    }

    websocket.onclose = () => {
      console.log('WebSocket disconnected')
      setWs(null)
    }

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    setWs(websocket)

    return () => {
      websocket.close()
    }
  }, [currentUser])

  // Load messages for selected contact
  useEffect(() => {
    if (!currentUser || !activeContact || !activeContact.contact_user_id) return
    const otherUserId = activeContact.contact_user_id
    fetch(`/api/conversations/${otherUserId}/messages`, {
      headers: { 'X-User-Id': currentUser.id },
    })
      .then((r) => r.json())
      .then((data) => {
        setMessagesByOtherUser((prev) => ({
          ...prev,
          [otherUserId]: data.messages || [],
        }))
      })
      .catch(() => {})
  }, [currentUser, activeContact])

  function currentMessages() {
    if (!activeContact || !activeContact.contact_user_id) return []
    return messagesByOtherUser[activeContact.contact_user_id] || []
  }

  async function handleSend() {
    const text = draft.trim()
    if (!text) return
    if (!currentUser) return alert('Please login first')
    if (!activeContact || !activeContact.contact_user_id) return alert('Select a registered contact')
    const otherUserId = activeContact.contact_user_id

    // Optimistic append
    const optimistic = {
      id: Date.now(),
      sender_id: currentUser.id,
      recipient_id: otherUserId,
      text,
      direction: 'outgoing',
    }
    setMessagesByOtherUser((prev) => ({
      ...prev,
      [otherUserId]: [...(prev[otherUserId] || []), optimistic],
    }))
    setDraft('')

    try {
      const res = await fetch(`/api/conversations/${otherUserId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUser.id },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('failed')
      const saved = await res.json()
      setMessagesByOtherUser((prev) => ({
        ...prev,
        [otherUserId]: (prev[otherUserId] || []).map((m) => (m.id === optimistic.id ? saved : m)),
      }))
    } catch (e) {
      // Rollback optimistic on error
      setMessagesByOtherUser((prev) => ({
        ...prev,
        [otherUserId]: (prev[otherUserId] || []).filter((m) => m.id !== optimistic.id),
      }))
      setDraft(text)
      alert('Failed to send message')
    }
  }

  async function register() {
    if (!authPhone || !authName) return alert('Enter name and phone')
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: authPhone, name: authName }),
    })
    if (!res.ok) return alert('Register failed')
    const data = await res.json()
    localStorage.setItem('user', JSON.stringify(data.user))
    setCurrentUser(data.user)
    setAuthName('')
    setAuthPhone('')
  }

  async function login() {
    if (!authPhone) return alert('Enter phone')
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: authPhone }),
    })
    if (!res.ok) return alert('Login failed')
    const data = await res.json()
    localStorage.setItem('user', JSON.stringify(data.user))
    setCurrentUser(data.user)
    setAuthPhone('')
  }

  function logout() {
    if (ws) {
      ws.close()
      setWs(null)
    }
    localStorage.removeItem('user')
    setCurrentUser(null)
    setActiveContact(null)
    setMessagesByOtherUser({})
  }

  async function createContact(e) {
    e.preventDefault()
    if (!currentUser) return alert('Login first')
    const form = e.target
    const contact_name = form.contact_name.value.trim()
    const contact_phone = form.contact_phone.value.trim()
    if (!contact_name || !contact_phone) return

    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': currentUser.id },
      body: JSON.stringify({ contact_name, contact_phone }),
    })
    if (!res.ok) return alert('Create contact failed')
    const data = await res.json()
    setContacts((prev) => [data.contact, ...prev])
    form.reset()
  }

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand">Relatim</div>
        <div className="top-actions">
          <button className="top-btn" onClick={() => setActiveTab('chat')}>Message</button>
          <button className="top-btn" onClick={() => setActiveTab('contacts')}>Contacts</button>
          {currentUser ? (
            <button className="top-btn" onClick={logout}>Logout</button>
          ) : null}
        </div>
      </header>

      {!currentUser ? (
        <div style={{ padding: '16px' }}>
          <h3>Login / Register</h3>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input placeholder="Name" value={authName} onChange={(e)=>setAuthName(e.target.value)} />
            <input placeholder="Phone" value={authPhone} onChange={(e)=>setAuthPhone(e.target.value)} />
            <button onClick={register}>Register</button>
            <button onClick={login}>Login</button>
          </div>
        </div>
      ) : null}

      <div className="main">
        <aside className={`threads ${sidebarOpen ? 'open' : ''}`}>
          <div className="thread-header">
            <button className="back-btn" onClick={() => setSidebarOpen(false)}>← Back</button>
          </div>

          {activeTab === 'contacts' ? (
            <div style={{ padding: '12px' }}>
              <form onSubmit={createContact} style={{ display: 'grid', gap: '8px', marginBottom: '12px' }}>
                <input name="contact_name" placeholder="Contact name" />
                <input name="contact_phone" placeholder="Contact phone" />
                <button type="submit">Add Contact</button>
              </form>
              {(contacts || []).map((c) => (
                <div key={c.id} className="thread-item">
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong>{c.contact_name}</strong>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>{c.contact_phone}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {(contacts || []).map((c) => (
                <div
                  key={c.id}
                  className={`thread-item ${activeContact?.id === c.id ? 'active' : ''}`}
                  onClick={() => { setActiveContact(c); setSidebarOpen(false) }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <strong>{c.contact_name}</strong>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>{c.contact_phone}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        <section className="chat-window">
          <div className="chat-header">
            <button className="menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
            <span className="chat-title">
              {activeTab === 'contacts' ? 'Contacts' : (activeContact?.contact_name || 'Select a contact')}
            </span>
          </div>

          {activeTab === 'contacts' ? (
            <div style={{ padding: 16 }}>
              <p>Select a contact on the left to start chatting.</p>
            </div>
          ) : (
            <>
              <div className="messages">
                {currentMessages().map((m) => {
                  const direction = m.direction ? m.direction : (m.sender_id === currentUser?.id ? 'outgoing' : 'incoming')
                  return (
                    <div key={m.id} className={`message ${direction}`}>
                      {m.text}
                    </div>
                  )
                })}
              </div>
              <div className="composer">
                <input
                  placeholder={currentUser ? (activeContact?.contact_user_id ? 'Type a message' : 'Contact not registered yet') : 'Login to send messages'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
                  disabled={!currentUser || !activeContact || !activeContact.contact_user_id}
                />
                <button onClick={handleSend} disabled={!currentUser || !activeContact || !activeContact.contact_user_id}>Send</button>
              </div>
            </>
          )}
        </section>
      </div>

      <footer className="status">API: {health ? JSON.stringify(health) : 'checking...'}</footer>
    </div>
  )
}

export default App
