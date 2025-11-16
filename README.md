# Quanta HIMS — Hospital Information Management System

### Lebanese University – Faculty of Sciences III  
**Course:** Database 2 (I3306)  
**Lab Work TP1 + TP2 + TP3 (Final Project Submission)**  

**Instructor:** Dr N.Hakam

**Student:** Angelica Charbel Fayad
**File Number** 31080 
**Student:** Gergess Charbel Fayad
**File Number** 32415 
**Student:** Ata Gergess Harb
**File Number** 30808 
---

## 🏥 Project Description
Quanta HIMS (Hospital Information Management System) is a simplified web-based hospital system that manages doctors, patients, appointments and medical records while enforcing **data confidentiality** through **database roles and views**.

The system supports four different user roles, each with different privileges and UI dashboards.

---

## 👥 User Roles & Access

| Role | Abilities | Database Access (Views / Permissions) |
|-----|-----------|--------------------------------------|
| **Doctor** | View own profile, view/edit their patients’ appointment statuses | `V_DOCTOR_MY_PATIENTS` |
====== User : drsahar , Password : 1234 ==== (role selected doctor)

| **Patient** | View doctors list, view their own medical file & appointments | `V_DOCTOR_PUBLIC_PROFILE` |
====== User : neharb , Password : 1234 ==== (role selected patient)

| **Staff** | Manage appointment scheduling, view daily appointment schedule | ()`V_TODAY_APPOINTMENTS_STAFF` |
====== User : System , Password : oracle ==== (role selected admin)

---

## 🗄️ Database Design (TP1 + TP2 + TP3)

### Main Tables:
- `users`
- `doctors`
- `patients`
- `appointments`
- `medical_records`
- `comments`

### Sequences:
- `users_seq`, `doctors_seq`, `patients_seq`, `appointments_seq`, `medical_records_seq`, `comments_seq`

### Role-Based Access Created:
- `admin_role`
- `doctor_role`
- `patient_role`
- `staff_role`

### Views for Data Confidentiality (TP3):
| View Name | Purpose | Used By |
|----------|---------|---------|
| `V_DOCTOR_MY_PATIENTS` | Doctor sees only their own patients | Doctor Dashboard |
| `V_DOCTOR_PUBLIC_PROFILE` | Patient sees only non-sensitive doctor info | Patient Dashboard |
| `V_TODAY_APPOINTMENTS_STAFF` | Staff sees today's appointments only | Staff Dashboard |

---

## 🧱 Project Structure

QuantaHIMS/
│
├── back/
│ ├── db.sql
│ ├── server.js
│ └── package.json
│
├── front/
│ ├── login.html
│ ├── signUp.html
│ ├── doctor-dashboard.html
│ ├── patient-dashboard.html
│ ├── staff-dashboard.html
----Other Pages To Be implemented---│
└── img/
## ⚙️ How to Run

### 1. Import Database in Oracle SQL:
```sql
@db.sql
cd back
npm install
node server.js

| Role Selected | Redirect Page            |
| ------------- | ------------------------ |
| Doctor        | `doctor-dashboard.html`  |
| Patient       | `patient-dashboard.html` |
| Staff         | `staff-dashboard.html`   |

