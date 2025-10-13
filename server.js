const express = require('express');
const oracledb = require('oracledb');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_23_9' });
const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// 🧠 Oracle DB credentials
const dbConfig = {
  user: 'system',          // or your created username
  password: 'oracle',      // your Oracle password
  connectString: 'localhost:1521/XE' // adjust to match SQL Developer
};

// Serve your HTML form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 🧩 Test login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Try to connect using credentials entered from form
    const connection = await oracledb.getConnection({
      user: username,
      password: password,
      connectString: dbConfig.connectString
    });

    await connection.close();
    res.json({ success: true, message: '✅ Database login successful!' });
  } catch (err) {
    console.error('❌ Login failed:', err.message);
    res.status(401).json({ success: false, message: 'Login failed: ' + err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
