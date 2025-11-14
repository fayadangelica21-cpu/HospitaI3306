// ==============================
//  SERVER.JS — FULL FIXED VERSION
// ==============================

const express = require("express");
const oracledb = require("oracledb");
const cors = require("cors");
const path = require("path");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");

oracledb.initOracleClient({ libDir: "C:\\oracle\\instantclient_23_9" });

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// ======================= DB CONFIG ==========================
const dbConfig = {
  user: "System",
  password: "oracle",
  connectString: "localhost:1521/xe",
};
app.post("/loginAsAdmin", async (req, res) => {
  const { username, password } = req.body;

  if (username !== "System" || password !== "oracle") {
    return res.status(401).json({
      success: false,
      message: "Invalid admin credentials."
    });
  }

  return res.json({
    success: true,
    message: "Admin login successful."
  });
});

async function getConnection() {
  return await oracledb.getConnection(dbConfig);
}

// =============================================================
// LOGIN
// =============================================================
app.post("/api/login", async (req, res) => {
  const { role, username, password } = req.body;

  if (!role || !username || !password) {
    return res.status(400).json({ message: "⚠️ All fields are required!" });
  }

  let connection;
  try {
    connection = await getConnection();

    const userQuery = await connection.execute(
      `SELECT user_id, username, role, password_hash, is_active 
       FROM users 
       WHERE (username = :username OR email = :username)
       AND role = :role`,
      { username, role },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (userQuery.rows.length === 0) {
      return res.status(401).json({ message: "❌ Invalid username or role." });
    }

    const user = userQuery.rows[0];

    if (user.IS_ACTIVE === 0) {
      return res.status(403).json({
        message: "🚫 Account is inactive. Contact support.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.PASSWORD_HASH);
    if (!isMatch) {
      return res.status(401).json({ message: "❌ Incorrect password." });
    }

    let profileData = null;

    if (role === "patient") {
      const p = await connection.execute(
        `SELECT patient_id, first_name, last_name, phone, gender, address 
         FROM patients WHERE user_id = :user_id`,
        { user_id: user.USER_ID },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      profileData = p.rows[0] || null;
    } else if (role === "doctor") {
      const d = await connection.execute(
        `SELECT doctor_id, first_name, last_name, specialty, phone, email 
         FROM doctors WHERE user_id = :user_id`,
        { user_id: user.USER_ID },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      profileData = d.rows[0] || null;
    }

    res.json({
      message: "✅ Login successful",
      user: {
        user_id: user.USER_ID,
        username: user.USERNAME,
        role: user.ROLE,
        profile: profileData,
      },
    });

  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ message: "⚠️ Server error: " + err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// =============================================================
// SIGNUP
// =============================================================
app.post("/api/signup", async (req, res) => {
  const {
    role,
    username,
    password,
    email,
    firstName,
    lastName,
    specialty,
    phone,
    gender,
    dateOfBirth,
    address,
  } = req.body;

  if (!role || !username || !password) {
    return res.status(400).json({ message: "All fields are required!" });
  }

  let connection;
  try {
    connection = await getConnection();

    const checkUser = await connection.execute(
      `SELECT user_id FROM users WHERE username = :username OR email = :email`,
      { username, email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (checkUser.rows.length > 0) {
      return res.status(400).json({ message: "User already exists. Please login." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const resultUser = await connection.execute(
      `INSERT INTO users (user_id, username, password_hash, email, role, is_active)
       VALUES (users_seq.NEXTVAL, :username, :password_hash, :email, :role, 1)
       RETURNING user_id INTO :user_id`,
      {
        username,
        password_hash: hashedPassword,
        email,
        role,
        user_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      }
    );

    const newUserId = resultUser.outBinds.user_id[0];

    if (role === "patient") {
      await connection.execute(
        `INSERT INTO patients (patient_id, user_id, first_name, last_name, date_of_birth, gender, phone, address)
         VALUES (patients_seq.NEXTVAL, :user_id, :first_name, :last_name, TO_DATE(:dob, 'YYYY-MM-DD'), :gender, :phone, :address)`,
        {
          user_id: newUserId,
          first_name: firstName,
          last_name: lastName,
          dob: dateOfBirth,
          gender,
          phone,
          address,
        }
      );
    } else if (role === "doctor") {
      await connection.execute(
        `INSERT INTO doctors (doctor_id, user_id, first_name, last_name, specialty, phone, email)
         VALUES (doctors_seq.NEXTVAL, :user_id, :first_name, :last_name, :specialty, :phone, :email)`,
        {
          user_id: newUserId,
          first_name: firstName,
          last_name: lastName,
          specialty,
          phone,
          email,
        }
      );
    }

    await connection.commit();
    res.json({ message: "✅ Account created successfully! Please login now." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error: " + err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// =============================================================
// DOCTOR DASHBOARD
// =============================================================
app.get("/api/doctor/:doctor_id/dashboard", async (req, res) => {
  const doctor_id = req.params.doctor_id;

  let connection;
  try {
    connection = await getConnection();

    const profile = await connection.execute(
      `SELECT first_name, last_name, specialty, email, phone 
       FROM doctors WHERE doctor_id = :doctor_id`,
      { doctor_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const patients = await connection.execute(
      `SELECT * FROM V_DOCTOR_MY_PATIENTS WHERE doctor_id = :doctor_id`,
      { doctor_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const appointments = await connection.execute(
      `SELECT * FROM V_DOCTOR_TODAY_APPOINTMENTS WHERE doctor_id = :doctor_id`,
      { doctor_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json({
      profile: profile.rows[0],
      patients: patients.rows,
      appointments: appointments.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error: " + err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// =============================================================
// STAFF: TODAY APPOINTMENTS (VIEW)
// =============================================================
app.get("/api/staff/appointments/today", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT * FROM V_TODAY_APPOINTMENTS_STAFF`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: "❌ Error loading today's appointments (view)" });
  } finally {
    if (conn) await conn.close();
  }
});

// =============================================================
// GET DOCTORS (FOR STAFF)
// =============================================================
app.get("/api/doctors", async (req, res) => {
  let connection;
  try {
    connection = await getConnection();
    const result = await connection.execute(
      `SELECT doctor_id, first_name, last_name, specialty, phone, email 
       FROM doctors ORDER BY first_name`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const doctors = result.rows.map(row => {
      const obj = {};
      for (let key in row) obj[key.toLowerCase()] = row[key];
      return obj;
    });

    res.json(doctors);

  } catch (err) {
    console.error("Error fetching doctors:", err);
    res.status(500).json({ error: "Failed to fetch doctors" });
  } finally {
    if (connection) await connection.close();
  }
});

// =============================================================
// GET PATIENTS (FOR STAFF)
// =============================================================
app.get("/api/patients", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT patient_id, first_name, last_name 
       FROM patients ORDER BY first_name`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json(
      result.rows.map(p => {
        const obj = {};
        for (let key in p) obj[key.toLowerCase()] = p[key];
        return obj;
      })
    );

  } catch (err) {
    res.status(500).json({ error: "Failed to load patients" });
  } finally {
    if (conn) conn.close();
  }
});

// =============================================================
// 📅 CREATE APPOINTMENT (FIXED BIND VARIABLES)
// =============================================================
app.post("/api/appointments", async (req, res) => {
  let { patient_id, doctor_id, date, time, status, notes } = req.body;
  let conn;

  if (!patient_id || !doctor_id || !date || !time) {
    return res.status(400).json({
      error: "Doctor, patient, date and time are required."
    });
  }

  status = status || "scheduled";
  notes = notes || "";

  try {
    conn = await getConnection();

    const [docRes, patRes] = await Promise.all([
      conn.execute(
        `SELECT doctor_id FROM doctors WHERE doctor_id = :id`,
        { id: doctor_id }
      ),
      conn.execute(
        `SELECT patient_id FROM patients WHERE patient_id = :id`,
        { id: patient_id }
      )
    ]);

    if (docRes.rows.length === 0) {
      return res.status(400).json({ error: "Doctor not found." });
    }
    if (patRes.rows.length === 0) {
      return res.status(400).json({ error: "Patient not found." });
    }

    // === FIXED HERE: date → p_date, time → p_time ===
    await conn.execute(
      `INSERT INTO appointments (
         appointment_id,
         patient_id,
         doctor_id,
         appointment_date,
         appointment_time,
         status,
         notes
       )
       VALUES (
         appointments_seq.NEXTVAL,
         :patient_id,
         :doctor_id,
         TO_DATE(:p_date,'YYYY-MM-DD'),
         :p_time,
         :status,
         :notes
       )`,
      {
        patient_id,
        doctor_id,
        p_date: date,
        p_time: time,
        status,
        notes,
      },
      { autoCommit: true }
    );

    return res.json({ success: true, message: "Appointment added successfully." });

  } catch (err) {
    console.error("INSERT APPOINTMENT ERROR:", err);

    let msg = "Failed to add appointment.";
    if (err.errorNum === 1) msg = "This time slot is already booked.";

    return res.status(500).json({
      error: msg,
      details: err.message
    });
  } finally {
    if (conn) await conn.close();
  }
});

// =============================================================
// 📋 GET ALL APPOINTMENTS
// =============================================================
app.get("/api/appointments", async (req, res) => {
  const { doctor_id, patient_id, date, status } = req.query;

  let conn;
  try {
    conn = await getConnection();

    const toNum = x => (x && !isNaN(x) ? Number(x) : null);

    let query = `
      SELECT a.appointment_id,
             TO_CHAR(a.appointment_date,'YYYY-MM-DD') AS date,
             a.appointment_time AS time,
             a.status,
             p.first_name || ' ' || p.last_name AS patient,
             d.first_name || ' ' || d.last_name AS doctor,
             a.patient_id,
             a.doctor_id
      FROM appointments a
      JOIN patients p ON p.patient_id = a.patient_id
      JOIN doctors d ON d.doctor_id = a.doctor_id
      WHERE 1=1
    `;

    const binds = {};

    if (toNum(doctor_id)) {
      query += ` AND a.doctor_id = :doctor_id`;
      binds.doctor_id = toNum(doctor_id);
    }
    if (toNum(patient_id)) {
      query += ` AND a.patient_id = :patient_id`;
      binds.patient_id = toNum(patient_id);
    }
    if (date) {
      query += ` AND a.appointment_date = TO_DATE(:date, 'YYYY-MM-DD')`;
      binds.date = date;
    }
    if (status) {
      query += ` AND a.status = :status`;
      binds.status = status;
    }

    query += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC`;

    const result = await conn.execute(query, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT
    });

    res.json(result.rows.map(r => {
      const obj = {};
      for (let key in r) obj[key.toLowerCase()] = r[key];
      return obj;
    }));

  } catch (err) {
    console.error("GET APPOINTMENTS ERROR:", err);
    res.status(500).json({ error: "Error retrieving appointments" });
  } finally {
    if (conn) await conn.close();
  }
});


// =============================================================
// ✏️ UPDATE APPOINTMENT (FIXED BIND VARIABLES)
// =============================================================
app.put("/api/appointments/:id", async (req, res) => {
  const { date, time, status, notes } = req.body;
  const id = req.params.id;
  let conn;

  try {
    conn = await getConnection();
    await conn.execute(
      `UPDATE appointments
       SET appointment_date = TO_DATE(:p_date,'YYYY-MM-DD'),
           appointment_time = :p_time,
           status = :status,
           notes = :notes
       WHERE appointment_id = :id`,
      {
        p_date: date,
        p_time: time,
        status,
        notes,
        id
      },
      { autoCommit: true }
    );

    res.json({ success: true, message: "Appointment updated" });

  } catch (err) {
    res.status(500).json({ error: "Failed to update appointment", details: err.message });
  } finally {
    if (conn) await conn.close();
  }
});

// =============================================================
// ❌ DELETE APPOINTMENT
// =============================================================
app.delete("/api/appointments/:id", async (req, res) => {
  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `DELETE FROM appointments WHERE appointment_id = :id`,
      { id: req.params.id },
      { autoCommit: true }
    );
    res.json({ success: true, message: "Appointment deleted" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete appointment" });
  }
});

// =============================================================
// FREE SLOTS PER DOCTOR
// =============================================================
app.get("/api/doctor/:id/free-slots", async (req, res) => {
  const doctor_id = req.params.id;
  const date = req.query.date;
  let conn;

  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT appointment_time FROM appointments
       WHERE doctor_id = :doctor_id
       AND appointment_date = TO_DATE(:date,'YYYY-MM-DD')`,
      { doctor_id, date },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const bookedTimes = result.rows.map(r => r.APPOINTMENT_TIME);

    const workingHours = [
      "09:00", "09:30", "10:00", "10:30",
      "11:00", "11:30", "12:00", "12:30",
      "13:00", "13:30", "14:00", "14:30",
      "15:00", "15:30", "16:00", "16:30"
    ];

    const freeSlots = workingHours.filter(t => !bookedTimes.includes(t));

    res.json(freeSlots);

  } catch (err) {
    res.status(500).json({ error: "Failed to load free slots" });
  } finally {
    if (conn) await conn.close();
  }
});

// =============================================================
// START SERVER
// =============================================================
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);
app.post("/api/feedback", async (req, res) => {
  const { user_id, patient_id, doctor_id, content } = req.body;

  if (!user_id || !patient_id || !doctor_id || !content) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  let conn;
  try {
    conn = await getConnection();
    await conn.execute(
      `INSERT INTO comments (
         comment_id, user_id, patient_id, doctor_id, content
       ) VALUES (
         comments_seq.NEXTVAL,
         :user_id,
         :patient_id,
         :doctor_id,
         :content
       )`,
      { user_id, patient_id, doctor_id, content },
      { autoCommit: true }
    );

    res.json({ success: true, message: "Feedback submitted successfully." });

  } catch (err) {
    console.error("Feedback error:", err);
    res.status(500).json({ error: "Failed to submit feedback" });
  } finally {
    if (conn) await conn.close();
  }
});
app.get("/api/doctor/:doctor_id/feedback", async (req, res) => {
  const doctor_id = req.params.doctor_id;
  let conn;

  try {
    conn = await getConnection();
    const result = await conn.execute(
      `SELECT 
         c.comment_id,
         c.content,
         TO_CHAR(c.comment_date, 'YYYY-MM-DD HH24:MI') AS comment_date,
         p.first_name || ' ' || p.last_name AS patient_name
       FROM comments c
       JOIN patients p ON p.patient_id = c.patient_id
       WHERE c.doctor_id = :doctor_id
       ORDER BY c.comment_date DESC`,
      { doctor_id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: "Failed to load feedback" });
  } finally {
    if (conn) await conn.close();
  }
});
