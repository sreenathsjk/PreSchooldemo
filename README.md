 # 🏫 Sri Chaithanya English Medium School
## Admin Management System — README

> **Garladinne, Anantapur District, Andhra Pradesh**
> Full-stack school admin portal — Nursery to 10th Class

---

## 📁 Project Files

| File | Purpose |
|------|---------|
| `sri-chaithanya-school.html` | Main school website (public-facing) |
| `login.html` | Admin login page (Firebase Auth) |
| `dashboard.html` | Admin dashboard shell (all 6 modules) |
| `app.js` | All Firebase logic & module functions |
| `style.css` | Dashboard styles (navy/gold theme) |

> All files must be in the **same folder** for links and imports to work.

---

## 🚀 Quick Setup

### Step 1 — Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add Project** → name it (e.g. `srichaithanya-school`)
3. Disable Google Analytics (optional) → **Create Project**

### Step 2 — Enable Authentication

1. In Firebase Console → **Authentication** → **Get Started**
2. Click **Email/Password** → Enable → **Save**
3. Go to **Users** tab → **Add User**
   - Email: `principal@srichaithanya.in` (or any email you choose)
   - Password: Set a strong password
   - Click **Add User**

### Step 3 — Create Firestore Database

1. In Firebase Console → **Firestore Database** → **Create Database**
2. Choose **Start in test mode** (you can add rules later)
3. Select region: `asia-south1` (Mumbai) for best performance in India
4. Click **Enable**

### Step 4 — Get Your Firebase Config

1. In Firebase Console → **Project Settings** (gear icon)
2. Scroll to **Your apps** → Click **</>** (Web app)
3. Register app name → Click **Register App**
4. Copy the `firebaseConfig` object shown

### Step 5 — Paste Config into Files

Open **`login.html`** and find this block (around line 395):

```javascript
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};
```

Open **`app.js`** and find the same block (around line 32) and paste your config there too.

Replace all `YOUR_*` values with your actual Firebase config values.

---

## 🗃️ Firestore Collections

The system automatically creates these Firestore collections on first use:

| Collection | Stores |
|-----------|--------|
| `sc_students` | Student records |
| `sc_admissions` | Admission applications |
| `sc_attendance` | Daily attendance records |
| `sc_fees` | Fee payment records |
| `sc_teachers` | Teacher profiles |

---

## 📦 Modules & Features

### 1. 🎓 Students
- Add / Edit / Delete student records
- Fields: Name, DOB, Gender, Class, Roll No, Parent, Phone, Address, Aadhaar, Previous School
- Search by name or parent name
- Filter by class (Nursery → 10th)
- Real-time updates via Firebase listener

### 2. 📋 Admissions
- Register new admission applications
- Fields: Applicant name, DOB, Gender, Class applied, Parent, Phone, Previous school, Remarks
- Status management: **Pending / Approved / Rejected** (one-click buttons)
- Edit and delete applications

### 3. 📅 Attendance
- Mark attendance class-by-class or for all students
- Date picker to view/edit any past date
- **Mark All Present** / **Mark All Absent** bulk buttons
- Live counter: Present · Absent · Total
- Saves to Firestore (overwrites same date if re-saved)

### 4. 💰 Fee Management
- Record fees: Tuition, Admission, Exam, Transport, Library, Sports, Other
- Per-student, per-month tracking
- Status: **Paid / Pending** with one-click mark-as-paid
- Summary bar: Total Collected · Total Pending · Record Count
- Filter by student name or payment status

### 5. 👨‍🏫 Teachers
- Add / Edit / Delete teacher profiles
- Fields: Name, Phone, Email, Qualification, Experience, Subjects, Assigned Classes, Salary, Join Date
- Class assignment via checkboxes (Nursery–10th)
- Subject tags displayed in table

### 6. 🏫 Classes
- Auto-generated cards for all 13 classes: Nursery, LKG, UKG, 1st–10th
- Shows: Total enrolled, Boys count, Girls count, Assigned teacher(s)
- Updates live as students and teachers are added

### 7. 📊 Reports
- **Per-student Fee Report** — filtered by date range, PDF + WhatsApp share
- **Per-student Attendance Report** — with % rate, PDF + WhatsApp share
- **All Fee Records** — complete fee history
- **Pending Fees** — students with outstanding dues
- **Today's Attendance** — present/absent/unmarked summary
- **Class-wise Student Strength** — boys/girls breakdown per class

---

## 🌐 Deployment Options

### Option A — GitHub Pages (Free)
1. Create a new GitHub repository (e.g. `srichaithanya-admin`)
2. Upload all 5 files to the repo
3. Go to **Settings → Pages → Branch: main → Save**
4. Your site will be live at `https://yourusername.github.io/srichaithanya-admin/`
5. Access login at `.../login.html`

### Option B — Vercel (Free, Faster)
1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click **New Project** → Import your repo
3. Deploy — Vercel handles everything automatically

### Option C — Direct Upload (Hostinger / cPanel)
1. Open your hosting File Manager
2. Upload all 5 files to `public_html/admin/` (or any subfolder)
3. Access at `https://yourdomain.in/admin/login.html`

---

## 🔒 Firestore Security Rules (Recommended for Production)

After testing, update your Firestore rules in Firebase Console → Firestore → **Rules**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

This ensures only logged-in admins can read or write data.

---

## 📱 Mobile Access

The dashboard is fully responsive. The sidebar collapses on screens under 900px — tap the ☰ hamburger icon to open it. All modals, tables, and forms are mobile-optimized.

---

## 🧰 Technologies Used

| Technology | Usage |
|-----------|-------|
| HTML5 / CSS3 | Structure & styling |
| JavaScript (ES Modules) | App logic |
| Firebase Auth v10 | Admin login & session |
| Firebase Firestore v10 | Real-time database |
| Font Awesome 6.5 | Icons |
| Google Fonts — Cinzel + Poppins | Typography |
| jsPDF + html2canvas | PDF report generation |
| WhatsApp API (`wa.me`) | Report sharing |

---

## 🏫 Class Structure

The system supports all 13 classes:

```
Nursery → LKG → UKG → 1st → 2nd → 3rd → 4th → 5th → 6th → 7th → 8th → 9th → 10th
```

---

## ❓ Troubleshooting

**Login fails with "Invalid credential"**
→ Double-check the Firebase config in both `login.html` and `app.js`. Make sure the admin user was created in Firebase Console → Authentication → Users.

**Blank page or "Loading Dashboard..." stuck**
→ Firebase config is missing or incorrect. Open browser DevTools (F12) → Console to see the error.

**Data not saving / "Permission denied"**
→ Your Firestore is not in test mode. Go to Firebase Console → Firestore → Rules and set them as shown above.

**PDF download not working**
→ Make sure the jsPDF and html2canvas CDN scripts are loading. Check DevTools → Network tab for failed requests.

**Attendance not showing students**
→ Students must be added first via the Students module before attendance can be marked.

---

## 📞 Support

For technical issues or customization, contact the developer through **18Spar Web Agency**.

---

*Sri Chaithanya English Medium School Admin System — Built with ❤️ for Garladinne*
