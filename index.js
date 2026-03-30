require('dotenv').config();
const express = require('express');
const { pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'DockMail Backend API' });
});

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch (err) {
    res.status(500).json({ ok: false, db: 'error', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`DockMail Backend running on http://localhost:${PORT}`);
});
