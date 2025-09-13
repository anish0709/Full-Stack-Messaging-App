const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { WebSocketServer } = require('ws');
const http = require('http');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Store connected clients by userId
const connectedClients = new Map();

// WebSocket connection handling
wss.on('connection', (ws, req) => {
	console.log('New WebSocket connection');
	
	ws.on('message', (data) => {
		try {
			const message = JSON.parse(data);
			if (message.type === 'auth' && message.userId) {
				// Store client with userId
				connectedClients.set(message.userId, ws);
				ws.userId = message.userId;
				console.log(`User ${message.userId} connected via WebSocket`);
			}
		} catch (err) {
			console.error('WebSocket message parse error:', err);
		}
	});
	
	ws.on('close', () => {
		if (ws.userId) {
			connectedClients.delete(ws.userId);
			console.log(`User ${ws.userId} disconnected from WebSocket`);
		}
	});
});

// Function to broadcast message to relevant users
function broadcastMessage(message, senderId, recipientId) {
	const messageToSend = JSON.stringify({
		type: 'new_message',
		message: message
	});
	
	console.log(`Broadcasting message to sender: ${senderId}, recipient: ${recipientId}`);
	console.log(`Connected clients:`, Array.from(connectedClients.keys()));
	
	// Send to sender
	const senderWs = connectedClients.get(senderId);
	if (senderWs && senderWs.readyState === 1) {
		senderWs.send(messageToSend);
		console.log(`Sent to sender: ${senderId}`);
	} else {
		console.log(`Sender ${senderId} not connected or ready state:`, senderWs?.readyState);
	}
	
	// Send to recipient
	const recipientWs = connectedClients.get(recipientId);
	if (recipientWs && recipientWs.readyState === 1) {
		recipientWs.send(messageToSend);
		console.log(`Sent to recipient: ${recipientId}`);
	} else {
		console.log(`Recipient ${recipientId} not connected or ready state:`, recipientWs?.readyState);
	}
}


// Initialize Postgres connection pool (optional at boot)
let pool;
try {
	pool = new Pool({
		connectionString: process.env.DATABASE_URL,
		ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
		host: process.env.PGHOST,
		port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
		database: process.env.PGDATABASE,
		user: process.env.PGUSER,
		password: process.env.PGPASSWORD,
	});
} catch (err) {
	console.warn('Postgres pool init failed (continuing without DB):', err.message);
}

app.get('/api/health', async (req, res) => {
	const result = { status: 'ok', serverTime: new Date().toISOString() };
	if (pool) {
		try {
			const { rows } = await pool.query('SELECT 1 as db_ok');
			result.db = rows?.[0]?.db_ok === 1 ? 'ok' : 'unknown';
		} catch (err) {
			result.db = 'error';
			result.dbError = err.message;
		}
	} else {
		result.db = 'not_configured';
	}
	res.json(result);
});

// Helper: read current user from header
function getUserId(req) {
	const id = req.header('X-User-Id');
	return id && String(id);
}

// Auth: register/login (very simple, no passwords)
app.post('/api/auth/register', async (req, res) => {
	const phone = (req.body && req.body.phone ? String(req.body.phone) : '').trim();
	const name = (req.body && req.body.name ? String(req.body.name) : '').trim();
	if (!phone || !name) return res.status(400).json({ error: 'phone and name required' });
	if (!pool) return res.status(500).json({ error: 'db not configured' });
	try {
		const found = await pool.query('SELECT id, phone, name FROM users WHERE phone = $1', [phone]);
		let userRow;
		if (found.rows.length) {
			userRow = found.rows[0];
		} else {
			const ins = await pool.query('INSERT INTO users (phone, name) VALUES ($1, $2) RETURNING id, phone, name', [phone, name]);
			userRow = ins.rows[0];
		}
		// Backfill contacts that reference this phone but aren't linked yet
		await pool.query('UPDATE contacts SET contact_user_id = $1 WHERE contact_phone = $2 AND contact_user_id IS NULL', [userRow.id, phone]);
		return res.status(201).json({ user: userRow });
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});

app.post('/api/auth/login', async (req, res) => {
	const phone = (req.body && req.body.phone ? String(req.body.phone) : '').trim();
	if (!phone) return res.status(400).json({ error: 'phone required' });
	if (!pool) return res.status(500).json({ error: 'db not configured' });
	try {
		const found = await pool.query('SELECT id, phone, name FROM users WHERE phone = $1', [phone]);
		if (!found.rows.length) return res.status(404).json({ error: 'not found' });
		const userRow = found.rows[0];
		// Backfill contacts linkage on login as well
		await pool.query('UPDATE contacts SET contact_user_id = $1 WHERE contact_phone = $2 AND contact_user_id IS NULL', [userRow.id, phone]);
		return res.json({ user: userRow });
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});

// Contacts
app.get('/api/contacts', async (req, res) => {
	const userId = getUserId(req);
	if (!userId) return res.status(401).json({ error: 'missing X-User-Id' });
	if (!pool) return res.json({ contacts: [] });
	try {
		const { rows } = await pool.query(
			'SELECT id, contact_name, contact_phone, contact_user_id FROM contacts WHERE owner_user_id = $1 ORDER BY created_at DESC',
			[userId]
		);
		return res.json({ contacts: rows });
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});

app.post('/api/contacts', async (req, res) => {
	const userId = getUserId(req);
	if (!userId) return res.status(401).json({ error: 'missing X-User-Id' });
	const contact_name = (req.body && req.body.contact_name ? String(req.body.contact_name) : '').trim();
	const contact_phone = (req.body && req.body.contact_phone ? String(req.body.contact_phone) : '').trim();
	if (!contact_name || !contact_phone) return res.status(400).json({ error: 'contact_name and contact_phone required' });
	if (!pool) return res.status(500).json({ error: 'db not configured' });
	try {
		const linked = await pool.query('SELECT id FROM users WHERE phone = $1', [contact_phone]);
		const contactUserId = linked.rows[0]?.id || null;
		const ins = await pool.query(
			'INSERT INTO contacts(owner_user_id, contact_user_id, contact_name, contact_phone) VALUES ($1, $2, $3, $4) RETURNING id, contact_name, contact_phone, contact_user_id',
			[userId, contactUserId, contact_name, contact_phone]
		);
		return res.status(201).json({ contact: ins.rows[0] });
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});

// Conversations and Messages between current user and other user
async function getOrCreateConversationId(userA, userB) {
	// enforce sorted pair in app
	const [a, b] = [userA, userB].sort();
	const found = await pool.query('SELECT id FROM conversations WHERE user_a_id = $1 AND user_b_id = $2', [a, b]);
	if (found.rows.length) return found.rows[0].id;
	const ins = await pool.query('INSERT INTO conversations(user_a_id, user_b_id) VALUES ($1, $2) RETURNING id', [a, b]);
	return ins.rows[0].id;
}

app.get('/api/conversations/:otherUserId/messages', async (req, res) => {
	const userId = getUserId(req);
	const otherUserId = String(req.params.otherUserId);
	console.log('GET /api/conversations/:otherUserId/messages', { userId, otherUserId });
	if (!userId) return res.status(401).json({ error: 'missing X-User-Id' });
	if (!pool) return res.json({ messages: [] });
	try {
		const [a, b] = [userId, otherUserId].sort();
		const conv = await pool.query('SELECT id FROM conversations WHERE user_a_id = $1 AND user_b_id = $2', [a, b]);
		if (!conv.rows.length) return res.json({ messages: [] });
		const convId = conv.rows[0].id;
		const { rows } = await pool.query(
			`SELECT 
				id, 
				text, 
				sender_id, 
				recipient_id, 
				CASE WHEN sender_id = $2 THEN 'outgoing' ELSE 'incoming' END AS direction, 
				created_at 
			FROM messages 
			WHERE conversation_id = $1 
			ORDER BY id ASC 
			LIMIT 200`,
			[convId, userId]
		);
		return res.json({ messages: rows });
	} catch (err) {
		console.error('GET conv messages error:', err);
		return res.status(500).json({ error: err.message });
	}
});

app.post('/api/conversations/:otherUserId/messages', async (req, res) => {
	const userId = getUserId(req);
	const otherUserId = String(req.params.otherUserId);
	const text = (req.body && req.body.text ? String(req.body.text) : '').trim();
	console.log('POST /api/conversations/:otherUserId/messages', { userId, otherUserId, textLength: text.length });
	if (!userId) return res.status(401).json({ error: 'missing X-User-Id' });
	if (!text) return res.status(400).json({ error: 'text required' });
	if (!pool) return res.status(500).json({ error: 'db not configured' });
	try {
		const convId = await getOrCreateConversationId(userId, otherUserId);
		const ins = await pool.query(
			'INSERT INTO messages(conversation_id, sender_id, recipient_id, text, direction) VALUES ($1, $2, $3, $4, $5) RETURNING id, text, sender_id, recipient_id, direction, created_at',
			[convId, userId, otherUserId, text, 'outgoing']
		);
		
		const savedMessage = ins.rows[0];
		
		// Broadcast to both users
		broadcastMessage(savedMessage, userId, otherUserId);
		
		return res.status(201).json(savedMessage);
	} catch (err) {
		console.error('POST conv message error:', err);
		return res.status(500).json({ error: err.message });
	}
});

// Admin: list all users with their contacts (no auth guard for simplicity)
app.get('/api/admin/users', async (req, res) => {
	if (!pool) return res.status(500).json({ error: 'db not configured' });
	try {
		const usersRes = await pool.query(
			'SELECT id, phone, name, created_at FROM users ORDER BY created_at ASC'
		);
		const contactsRes = await pool.query(
			'SELECT id, owner_user_id, contact_user_id, contact_name, contact_phone, created_at FROM contacts ORDER BY created_at ASC'
		);
		const ownerIdToContacts = new Map();
		for (const c of contactsRes.rows) {
			if (!ownerIdToContacts.has(c.owner_user_id)) ownerIdToContacts.set(c.owner_user_id, []);
			ownerIdToContacts.get(c.owner_user_id).push({
				id: c.id,
				contact_user_id: c.contact_user_id,
				contact_name: c.contact_name,
				contact_phone: c.contact_phone,
				created_at: c.created_at,
			});
		}
		const data = usersRes.rows.map((u) => ({
			user: { id: u.id, phone: u.phone, name: u.name, created_at: u.created_at },
			contacts: ownerIdToContacts.get(u.id) || [],
		}));
		return res.json({ users: data });
	} catch (err) {
		return res.status(500).json({ error: err.message });
	}
});


server.listen(PORT, () => {
	console.log(`API server listening on http://localhost:${PORT}`);
});


