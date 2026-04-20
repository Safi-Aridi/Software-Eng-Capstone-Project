// backend/server.js
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// The dynamic "Pipe" [cite: 101, 110]
app.get('/api/applications', async (req, res) => {
  const { role } = req.query;
  try {
    let query = 'SELECT * FROM applications';
    
    // Role-based filtering as per NFR-SEC-01 [cite: 427, 459-460]
    // ... inside app.get('/api/applications' ...
    if (role === 'mukhtar') {
    query += " WHERE status = 'VERIFIED'"; // Matches types.ts [cite: 330]
    } else if (role === 'officer') {
    query += " WHERE status = 'MUKHTAR_SIGNED'"; // Matches types.ts [cite: 346]
    }

    const result = await pool.query(query + ' ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database Connection Failed" });
  }
});

app.listen(5000, () => console.log('NPIS Backend running on port 5000'));