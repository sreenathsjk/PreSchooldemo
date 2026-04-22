🌟 BABY STAR COACHING CENTER – School Website & Admin Dashboard

A complete preschool website + management system for
BABY STAR COACHING CENTER (L.K.G & U.K.G) located in Garladinne, Anantapur.

This project combines:

- 🎨 Public School Website (for parents)
- 🔐 Admin Dashboard (for school management)
- ☁️ Firebase Backend (for real-time data storage)

---

📍 School Details

Name: BABY STAR COACHING CENTER L.K.G & U.K.G
Location: Near APG Bank, Opp. Srinivasa Ayyangar Bakery, Garladinne (V&M), Anantapur District, Andhra Pradesh, India

---

🚀 Features

🌐 Public Website

- Responsive, mobile-friendly design
- School introduction & programs (LKG & UKG)
- Activities showcase (arts, music, storytelling, yoga, etc.)
- Gallery & testimonials
- Admission information
- Contact section with map

---

🔐 Admin Dashboard

👶 Student Management

- Add / Edit / Delete students
- Store details (name, class, parent info)

📅 Attendance Management

- Mark daily attendance
- Track student-wise records

💰 Fee Management

- Add fee details
- Track paid / pending fees

📄 Reports

- Generate:
  - Attendance reports
  - Fee reports
- Download reports as PDF
- Share via WhatsApp

📊 Dashboard Overview

- Total students
- Fees collected
- Attendance summary

---

🛠️ Tech Stack

- HTML5
- CSS3
- JavaScript (Vanilla)
- Firebase (v9 Modular SDK)
  - Authentication
  - Firestore Database
- jsPDF (for report generation)
- Font Awesome (icons)

---

📁 Project Structure

/project-folder
│
├── index.html        → Public website
├── login.html        → Admin login
├── dashboard.html    → Admin panel
├── style.css         → Styles
├── app.js            → Firebase + logic
└── README.md         → Project documentation

---

🔥 Firebase Setup

1. Go to Firebase Console

2. Create a new project

3. Enable:
   
   - Authentication (Email/Password)
   - Firestore Database

4. Replace Firebase config in "app.js":

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_BUCKET",
  messagingSenderId: "YOUR_ID",
  appId: "YOUR_APP_ID"
};

---

🔐 Security (IMPORTANT)

- Enable Firebase Authentication
- Use Firestore security rules to restrict access
- Only admin should have dashboard access

---

🌍 Deployment (GitHub Pages)

1. Upload project to GitHub repository
2. Go to Settings → Pages
3. Select branch (main)
4. Your site will be live 🎉

---

📲 Future Improvements

- Parent login portal
- SMS/WhatsApp fee reminders
- Mobile app version
- Multi-school SaaS platform

---

👨‍💻 Developed For

This project is built for managing a preschool efficiently with modern web tools.

---

📧 Contact

For queries or customization:

- Phone: +91 XXXXX XXXXX
- Email: example@gmail.com

---

⭐ Support

If you like this project, give it a ⭐ on GitHub!
