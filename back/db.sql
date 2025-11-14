-- =====================================================================
-- TP2 Requirement: Create Profile for Login Security
-- This profile will lock a user account after 3 failed login attempts.
-- =====================================================================
CREATE PROFILE app_user_profile LIMIT
  FAILED_LOGIN_ATTEMPTS 3
  PASSWORD_LOCK_TIME 1; -- Lock for 1 day

-- =====================================================================
-- TP2 Requirement: Create Roles for Privilege Management
-- =====================================================================
CREATE ROLE patient_role;
CREATE ROLE doctor_role;
CREATE ROLE admin_role;
CREATE ROLE staff_role;

-- Grant basic connection privilege to all roles
GRANT CREATE SESSION TO patient_role;
GRANT CREATE SESSION TO doctor_role;
GRANT CREATE SESSION TO admin_role;
GRANT CREATE SESSION TO staff_role;


-- =====================================================================
-- Original Table Definitions (with Arabic comments)
-- =====================================================================
-- جدول المستخدمين
CREATE TABLE users (
    user_id NUMBER PRIMARY KEY,
    username VARCHAR2(50) NOT NULL,
    password_hash VARCHAR2(255) NOT NULL,
    email VARCHAR2(150),
    role VARCHAR2(20) DEFAULT 'patient' NOT NULL,
    is_active NUMBER(1) DEFAULT 1,
    CONSTRAINT users_role_chk CHECK (role IN ('patient','doctor','admin','staff')),
    CONSTRAINT users_username_uniq UNIQUE(username),
    CONSTRAINT users_email_uniq UNIQUE(email)
);

CREATE TABLE patients (
    patient_id NUMBER PRIMARY KEY,
    user_id NUMBER NOT NULL,
    first_name VARCHAR2(50) NOT NULL,
    last_name VARCHAR2(50) NOT NULL,
    date_of_birth DATE,
    gender VARCHAR2(10),
    phone VARCHAR2(20),
    address VARCHAR2(200),
    CONSTRAINT patients_user_fk FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE doctors (
    doctor_id NUMBER PRIMARY KEY,
    user_id NUMBER NOT NULL,
    first_name VARCHAR2(50) NOT NULL,
    last_name VARCHAR2(50) NOT NULL,
    specialty VARCHAR2(100),
    phone VARCHAR2(20),
    email VARCHAR2(150),
    CONSTRAINT doctors_user_fk FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Note: I've added "appointment_time" to your appointments table as it's used in your server.js
CREATE TABLE appointments (
    appointment_id NUMBER PRIMARY KEY,
    patient_id NUMBER NOT NULL,
    doctor_id NUMBER NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time VARCHAR2(10), -- e.g., '10:30 AM'
    status VARCHAR2(20) DEFAULT 'scheduled',
    notes VARCHAR2(500),
    CONSTRAINT appointments_patient_fk FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    CONSTRAINT appointments_doctor_fk FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    CONSTRAINT appointments_status_chk CHECK (status IN ('scheduled','completed','cancelled'))
);

CREATE TABLE medical_records (
    record_id NUMBER PRIMARY KEY,
    patient_id NUMBER NOT NULL,
    doctor_id NUMBER,
    record_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description VARCHAR2(1000),
    file_path VARCHAR2(500),
    CONSTRAINT medical_records_patient_fk FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    CONSTRAINT medical_records_doctor_fk FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
);

CREATE TABLE comments (
    comment_id NUMBER PRIMARY KEY,
    user_id NUMBER NOT NULL,
    patient_id NUMBER,
    comment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    content VARCHAR2(1000) NOT NULL,
    CONSTRAINT comments_user_fk FOREIGN KEY (user_id) REFERENCES users(user_id),
    CONSTRAINT comments_patient_fk FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
);

-- =====================================================================
-- TP3 Requirement: Create Views for Data Confidentiality
-- These views provide a security layer, allowing us to grant access
-- to specific data slices without exposing the whole table.
-- =====================================================================

-- View for staff to see today's appointments without patient's personal details
-- CREATE OR REPLACE VIEW V_TODAY_APPOINTMENTS_STAFF AS
-- SELECT
--     d.first_name || ' ' || d.last_name AS doctor_name,
--     p.first_name || ' ' || p.last_name AS patient_name,
--     a.appointment_time,
--     a.status
-- FROM appointments a
-- JOIN doctors d ON a.doctor_id = d.doctor_id
-- JOIN patients p ON a.patient_id = p.patient_id
-- WHERE a.appointment_date = TRUNC(SYSDATE);
CREATE OR REPLACE VIEW V_DOCTOR_TODAY_APPOINTMENTS AS
SELECT 
  a.appointment_id,
  a.doctor_id,
  p.first_name || ' ' || p.last_name AS patient_name,
  a.appointment_time,
  a.status
FROM appointments a
JOIN patients p ON a.patient_id = p.patient_id
WHERE a.appointment_date = TRUNC(SYSDATE);
select * from V_DOCTOR_TODAY_APPOINTMENTS;
-- View for a doctor to see their own patients (names and basic info only)
CREATE OR REPLACE VIEW V_DOCTOR_MY_PATIENTS AS
SELECT
    a.doctor_id,
    p.patient_id,
    p.first_name,
    p.last_name,
    p.gender,
    p.phone
FROM patients p
JOIN appointments a ON p.patient_id = a.patient_id
GROUP BY a.doctor_id, p.patient_id, p.first_name, p.last_name, p.gender, p.phone;

-- View for patients to see doctor profiles without sensitive info
CREATE OR REPLACE VIEW V_DOCTOR_PUBLIC_PROFILE AS
SELECT
    doctor_id,
    first_name,
    last_name,
    specialty,
    phone
FROM doctors;
CREATE OR REPLACE VIEW V_PATIENT_MY_RECORDS AS
SELECT
  record_id,
  patient_id,
  doctor_id,
  TO_CHAR(record_date, 'YYYY-MM-DD HH24:MI') AS record_date,
  description,
  file_path
FROM medical_records;


-- Granting privileges on these views to the roles
GRANT SELECT ON V_TODAY_APPOINTMENTS_STAFF TO staff_role;
GRANT SELECT ON V_DOCTOR_MY_PATIENTS TO doctor_role;
GRANT SELECT ON V_DOCTOR_PUBLIC_PROFILE TO patient_role;
-- Admins typically get wider permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON patients TO admin_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON doctors TO admin_role;

GRANT SELECT ON V_PATIENT_MY_RECORDS TO patient_role;

ALTER TABLE appointments
  ADD CONSTRAINT uq_doc_slot UNIQUE (doctor_id, appointment_date, appointment_time);

-- ڤيو مبسطة للطاقم لكل المواعيد بلا حقول حساسة إضافية
CREATE OR REPLACE VIEW V_APPOINTMENTS_PUBLIC AS
SELECT a.appointment_id, a.patient_id, a.doctor_id,
       a.appointment_date, a.appointment_time, a.status, a.notes
FROM appointments a;

GRANT SELECT, INSERT, UPDATE, DELETE ON appointments TO admin_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON appointments TO staff_role;
GRANT SELECT ON V_APPOINTMENTS_PUBLIC TO staff_role;
CREATE OR REPLACE VIEW V_DOCTOR_TODAY_APPOINTMENTS AS
SELECT 
  a.appointment_id,
  p.first_name || ' ' || p.last_name AS patient_name,
  a.appointment_time,
  a.status
FROM appointments a
JOIN patients p ON a.patient_id = p.patient_id
WHERE a.doctor_id = :doctor_id 
  AND a.appointment_date = TRUNC(SYSDATE);
  ---- To Read Today Appointments--
GRANT SELECT ON V_DOCTOR_TODAY_APPOINTMENTS TO doctor_role;
ALTER TABLE comments ADD doctor_id NUMBER;
ALTER TABLE comments ADD CONSTRAINT comments_doctor_fk 
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id);
CREATE OR REPLACE VIEW V_DOCTOR_TODAY_APPOINTMENTS AS
SELECT 
  a.appointment_id,
  a.doctor_id,
  p.first_name || ' ' || p.last_name AS patient_name,
  a.appointment_time,
  a.status
FROM appointments a
JOIN patients p ON a.patient_id = p.patient_id
WHERE a.appointment_date = TRUNC(SYSDATE);
ALTER TABLE appointments
  ADD appointment_time VARCHAR2(10);