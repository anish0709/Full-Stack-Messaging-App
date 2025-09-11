const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

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

app.listen(PORT, () => {
	console.log(`API server listening on http://localhost:${PORT}`);
});


