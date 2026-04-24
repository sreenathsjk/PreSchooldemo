 /**
 * ============================================================
 * SRI CHAITHANYA ENGLISH MEDIUM SCHOOL
 * Admin App Logic — app.js | Firebase v10 Modular SDK
 * Garladinne, Anantapur, Andhra Pradesh
 * Modules: Students · Admissions · Attendance · Fees · Teachers · Classes
 * ============================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, getDocs, getDoc, doc,
  updateDoc, deleteDoc, query, where, orderBy,
  serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ─── FIREBASE CONFIG ─────────────────────────────────────────
// 👇 Replace with your actual Firebase project config
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── COLLECTIONS ─────────────────────────────────────────────
const COL = {
  STUDENTS:   "sc_students",
  ADMISSIONS: "sc_admissions",
  ATTENDANCE: "sc_attendance",
  FEES:       "sc_fees",
  TEACHERS:   "sc_teachers"
};

const ALL_CLASSES = ["Nursery","LKG","UKG","1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th"];

// ─── APP STATE ───────────────────────────────────────────────
let currentUser     = null;
let studentsCache   = [];
let teachersCache   = [];
let admissionsCache = [];
let feesCache       = [];
let attendanceData  = {};   // { studentId: "Present"|"Absent" }
let currentReport   = null;
let editStudentId   = null;
let editTeacherId   = null;
let editAdmissionId = null;
let deleteTarget    = { id: null, col: null, name: "" };

// ─── INIT ─────────────────────────────────────────────────────
export function initApp() {
  onAuthStateChanged(auth, (user) => {
    if (!user) { window.location.href = "login.html"; return; }
    currentUser = user;
    hideLoader();
    setEl("adminEmail", user.email || "Principal");
    subscribeStudents();
    subscribeTeachers();
    subscribeAdmissions();
    subscribeFees();
    loadDashboardStats();
    navigateTo("overview");
  });
}

function hideLoader() {
  const el = document.getElementById("pageLoader");
  if (el) el.classList.add("hidden");
}

// ─── NAVIGATION ──────────────────────────────────────────────
export function navigateTo(panel) {
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  const t = document.getElementById("panel-" + panel);
  if (t) t.classList.add("active");
  const nb = document.querySelector(`[data-panel="${panel}"]`);
  if (nb) nb.classList.add("active");

  const titles = {
    overview:   "Dashboard Overview",
    students:   "Student Management",
    admission:  "Admission Management",
    attendance: "Attendance Management",
    fees:       "Fee Management",
    teachers:   "Teacher Management",
    classes:    "Class Management",
    reports:    "Reports & Analytics"
  };
  setEl("pageTitle", titles[panel] || "Dashboard");
  closeSidebar();

  if (panel === "overview")   loadDashboardStats();
  if (panel === "attendance") loadAttendancePage();
  if (panel === "fees")       loadFeesPage();
  if (panel === "classes")    renderClassesPanel();
  if (panel === "reports")    initReportDates();
}

// ─── SIDEBAR ─────────────────────────────────────────────────
export function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebarOverlay").classList.toggle("open");
}
export function closeSidebar() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebarOverlay").classList.remove("open");
}

// ─── LOGOUT ──────────────────────────────────────────────────
export function logout() {
  if (!confirm("Logout from Sri Chaithanya School Admin?")) return;
  signOut(auth).then(() => { window.location.href = "login.html"; });
}

// ─── TOAST ───────────────────────────────────────────────────
export function showToast(message, type = "success") {
  const icons = { success: "fa-check-circle", error: "fa-exclamation-circle", info: "fa-info-circle" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon"><i class="fas ${icons[type] || icons.info}"></i></div>
    <div style="flex:1">${message}</div>
    <button onclick="this.parentElement.remove()" style="border:none;background:none;cursor:pointer;color:var(--text-muted);padding:2px 6px;font-size:14px;">✕</button>
  `;
  document.getElementById("toastContainer").appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 4500);
}

// ─── MODAL HELPERS ───────────────────────────────────────────
function openModal(id)  { const el = document.getElementById(id); if (el) el.classList.add("open"); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove("open"); }

export function closeStudentModal()   { closeModal("studentModal"); editStudentId = null; }
export function closeTeacherModal()   { closeModal("teacherModal"); editTeacherId = null; }
export function closeAdmissionModal() { closeModal("admissionModal"); editAdmissionId = null; }
export function closeFeeModal()       { closeModal("feeModal"); }
export function closeDeleteModal()    { closeModal("deleteModal"); }
export function closeReportModal()    { closeModal("reportModal"); }

// ─────────────────────────────────────────────────────────────
//  OVERVIEW STATS
// ─────────────────────────────────────────────────────────────
async function loadDashboardStats() {
  try {
    // Students
    const totalStudents = studentsCache.length;
    const classCounts = {};
    studentsCache.forEach(s => { classCounts[s.class] = (classCounts[s.class] || 0) + 1; });
    const topClass = Object.entries(classCounts).sort((a,b) => b[1]-a[1])[0];

    // Fees
    let collected = 0, pending = 0;
    feesCache.forEach(f => {
      if (f.status === "Paid") collected += Number(f.amount) || 0;
      else pending += Number(f.amount) || 0;
    });

    // Today's attendance
    const today = new Date().toISOString().split("T")[0];
    const attSnap = await getDocs(query(collection(db, COL.ATTENDANCE), where("date", "==", today)));
    let presentToday = 0;
    attSnap.forEach(d => { if (d.data().status === "Present") presentToday++; });
    const attPct = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;

    // Teachers
    const totalTeachers = teachersCache.length;

    // Admissions pending
    const pendingAdm = admissionsCache.filter(a => a.status === "Pending").length;

    setEl("statTotalStudents", totalStudents);
    setEl("statClassBreakdown", topClass ? `Most in: ${topClass[0]} (${topClass[1]})` : "Nursery to 10th");
    setEl("statAttendance", attPct + "%");
    setEl("statPresentToday", `${presentToday} present today`);
    setEl("statTotalFees", "₹" + collected.toLocaleString("en-IN"));
    setEl("statPendingFees", "₹" + pending.toLocaleString("en-IN") + " pending");
    setEl("statTeachers", totalTeachers);
    setEl("statNewAdmissions", `${pendingAdm} pending admission${pendingAdm !== 1 ? "s" : ""}`);
  } catch(e) { console.error("Stats error:", e); }
}

// ─────────────────────────────────────────────────────────────
//  STUDENTS
// ─────────────────────────────────────────────────────────────
function subscribeStudents() {
  const q = query(collection(db, COL.STUDENTS), orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    studentsCache = [];
    snap.forEach(d => studentsCache.push({ id: d.id, ...d.data() }));
    renderStudentsTable(studentsCache);
    populateStudentDropdowns();
    window.dispatchEvent(new CustomEvent("studentsUpdated", { detail: studentsCache }));
  }, err => console.error("Students listener:", err));
}

export function openAddStudentModal() {
  editStudentId = null;
  setEl("studentModalTitle", "Add New Student");
  setEl("saveStudentBtnText", "Add Student");
  document.getElementById("studentForm").reset();
  openModal("studentModal");
}

export function openEditStudentModal(id) {
  const s = studentsCache.find(x => x.id === id);
  if (!s) return;
  editStudentId = id;
  setEl("studentModalTitle", "Edit Student");
  setEl("saveStudentBtnText", "Update Student");
  setValue("sName", s.name);
  setValue("sDob", s.dob);
  setValue("sGender", s.gender);
  setValue("sClass", s.class);
  setValue("sRoll", s.roll);
  setValue("sParent", s.parent);
  setValue("sPhone", s.phone);
  setValue("sAddress", s.address);
  setValue("sAadhaar", s.aadhaar);
  setValue("sPrevSchool", s.prevSchool);
  openModal("studentModal");
}

export async function saveStudent() {
  const name   = val("sName");
  const dob    = val("sDob");
  const gender = val("sGender");
  const cls    = val("sClass");
  const roll   = val("sRoll");
  const parent = val("sParent");
  const phone  = val("sPhone");

  if (!name || !dob || !gender || !cls || !parent || !phone) {
    showToast("Please fill all required fields.", "error"); return;
  }

  const btn = document.getElementById("saveStudentBtn");
  btn.disabled = true;

  try {
    const data = {
      name, dob, gender, class: cls, roll, parent, phone,
      address:    val("sAddress"),
      aadhaar:    val("sAadhaar"),
      prevSchool: val("sPrevSchool"),
      updatedAt:  serverTimestamp()
    };
    if (editStudentId) {
      await updateDoc(doc(db, COL.STUDENTS, editStudentId), data);
      showToast(`✅ ${name} updated successfully!`);
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, COL.STUDENTS), data);
      showToast(`🎓 ${name} added successfully!`);
    }
    closeStudentModal();
    loadDashboardStats();
  } catch(e) {
    console.error(e);
    showToast("Failed to save student.", "error");
  } finally {
    btn.disabled = false;
  }
}

function renderStudentsTable(students, filterText = "", filterClass = "") {
  const tbody = document.getElementById("studentsTableBody");
  if (!tbody) return;
  let list = students;
  if (filterText) list = list.filter(s =>
    s.name?.toLowerCase().includes(filterText.toLowerCase()) ||
    s.parent?.toLowerCase().includes(filterText.toLowerCase())
  );
  if (filterClass) list = list.filter(s => s.class === filterClass);

  setEl("studentCountBadge", list.length);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="empty-emoji">🎓</span><div class="empty-title">${filterText ? "No students match your search" : "No students yet"}</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((s, i) => `
    <tr>
      <td><span style="color:var(--text-muted);font-weight:600;">${i+1}</span></td>
      <td>
        <div style="font-weight:700;">${escHtml(s.name)}</div>
        <div style="font-size:0.73rem;color:var(--text-muted);">${s.roll ? "Roll: " + s.roll : ""}</div>
      </td>
      <td><span class="badge badge-${(s.class||"").toLowerCase()}">${s.class || "—"}</span></td>
      <td><span class="badge badge-${(s.gender||"").toLowerCase()}">${s.gender || "—"}</span></td>
      <td>${escHtml(s.parent)}</td>
      <td><a href="tel:${s.phone}" style="color:var(--blue);font-weight:600;text-decoration:none;"><i class="fas fa-phone" style="font-size:11px;"></i> ${escHtml(s.phone)}</a></td>
      <td>
        <div style="display:flex;gap:5px;">
          <button class="btn btn-info btn-icon-sm" onclick="window.appFns.openEditStudentModal('${s.id}')" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-icon-sm" onclick="window.appFns.confirmDelete('${s.id}','${COL.STUDENTS}','${escAttr(s.name)}')" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join("");
}

export function searchStudents(v) { renderStudentsTable(studentsCache, v); }
export function filterByClass(cls) { renderStudentsTable(studentsCache, "", cls); }

// ─────────────────────────────────────────────────────────────
//  ADMISSIONS
// ─────────────────────────────────────────────────────────────
function subscribeAdmissions() {
  const q = query(collection(db, COL.ADMISSIONS), orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    admissionsCache = [];
    snap.forEach(d => admissionsCache.push({ id: d.id, ...d.data() }));
    renderAdmissionsTable(admissionsCache);
    window.dispatchEvent(new CustomEvent("admissionsUpdated", { detail: admissionsCache }));
  }, err => console.error("Admissions listener:", err));
}

export function openAddAdmissionModal() {
  editAdmissionId = null;
  setEl("admissionModalTitle", "New Admission Application");
  setEl("saveAdmissionBtnText", "Submit Admission");
  document.getElementById("admissionForm").reset();
  setValue("admDate", new Date().toISOString().split("T")[0]);
  openModal("admissionModal");
}

export function openEditAdmissionModal(id) {
  const a = admissionsCache.find(x => x.id === id);
  if (!a) return;
  editAdmissionId = id;
  setEl("admissionModalTitle", "Edit Admission");
  setEl("saveAdmissionBtnText", "Update Admission");
  setValue("admName", a.name);
  setValue("admDob", a.dob);
  setValue("admGender", a.gender);
  setValue("admClass", a.class);
  setValue("admParent", a.parent);
  setValue("admPhone", a.phone);
  setValue("admDate", a.date);
  setValue("admStatus", a.status);
  setValue("admPrevSchool", a.prevSchool);
  setValue("admRemarks", a.remarks);
  openModal("admissionModal");
}

export async function saveAdmission() {
  const name   = val("admName");
  const dob    = val("admDob");
  const gender = val("admGender");
  const cls    = val("admClass");
  const parent = val("admParent");
  const phone  = val("admPhone");

  if (!name || !dob || !gender || !cls || !parent || !phone) {
    showToast("Please fill all required fields.", "error"); return;
  }

  const btn = document.getElementById("saveAdmissionBtn");
  btn.disabled = true;

  try {
    const data = {
      name, dob, gender, class: cls, parent, phone,
      date: val("admDate"), status: val("admStatus") || "Pending",
      prevSchool: val("admPrevSchool"), remarks: val("admRemarks"),
      updatedAt: serverTimestamp()
    };
    if (editAdmissionId) {
      await updateDoc(doc(db, COL.ADMISSIONS, editAdmissionId), data);
      showToast(`✅ ${name}'s admission updated!`);
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, COL.ADMISSIONS), data);
      showToast(`📋 Admission for ${name} submitted!`);
    }
    closeAdmissionModal();
    loadDashboardStats();
  } catch(e) {
    console.error(e);
    showToast("Failed to save admission.", "error");
  } finally {
    btn.disabled = false;
  }
}

export async function updateAdmissionStatus(id, status) {
  try {
    await updateDoc(doc(db, COL.ADMISSIONS, id), { status, updatedAt: serverTimestamp() });
    showToast(`Admission status set to ${status}.`, "info");
    loadDashboardStats();
  } catch(e) { showToast("Failed to update status.", "error"); }
}

function renderAdmissionsTable(admissions, filterText = "", filterStatus = "") {
  const tbody = document.getElementById("admissionsTableBody");
  if (!tbody) return;
  let list = admissions;
  if (filterText)   list = list.filter(a => a.name?.toLowerCase().includes(filterText.toLowerCase()) || a.parent?.toLowerCase().includes(filterText.toLowerCase()));
  if (filterStatus) list = list.filter(a => a.status === filterStatus);

  setEl("admissionCountBadge", list.length);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><span class="empty-emoji">📋</span><div class="empty-title">No admissions found</div></div></td></tr>`;
    return;
  }
  const statusColors = { Approved: "approved", Pending: "pending", Rejected: "rejected" };
  tbody.innerHTML = list.map((a, i) => `
    <tr>
      <td><span style="color:var(--text-muted);font-weight:600;">${i+1}</span></td>
      <td>
        <div style="font-weight:700;">${escHtml(a.name)}</div>
        <div style="font-size:0.73rem;color:var(--text-muted);">${a.gender || ""}</div>
      </td>
      <td><span class="badge badge-${(a.class||"").toLowerCase()}">${a.class || "—"}</span></td>
      <td>${escHtml(a.parent)}</td>
      <td><a href="tel:${a.phone}" style="color:var(--blue);font-weight:600;text-decoration:none;">${escHtml(a.phone)}</a></td>
      <td style="font-size:0.8rem;">${a.date ? formatDate(a.date) : "—"}</td>
      <td><span class="badge badge-${statusColors[a.status] || "pending"}">${a.status || "Pending"}</span></td>
      <td>
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
          <button class="btn btn-success btn-sm" onclick="window.appFns.updateAdmissionStatus('${a.id}','Approved')" title="Approve" style="padding:4px 8px;font-size:0.72rem;">✓</button>
          <button class="btn btn-danger btn-sm" onclick="window.appFns.updateAdmissionStatus('${a.id}','Rejected')" title="Reject" style="padding:4px 8px;font-size:0.72rem;">✗</button>
          <button class="btn btn-info btn-icon-sm" onclick="window.appFns.openEditAdmissionModal('${a.id}')" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-icon-sm" onclick="window.appFns.confirmDelete('${a.id}','${COL.ADMISSIONS}','${escAttr(a.name)}')" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join("");
}

export function searchAdmissions(v) { renderAdmissionsTable(admissionsCache, v); }
export function filterAdmissions(status) { renderAdmissionsTable(admissionsCache, "", status); }

// ─────────────────────────────────────────────────────────────
//  ATTENDANCE
// ─────────────────────────────────────────────────────────────
async function loadAttendancePage() {
  const dateInput = document.getElementById("attDate");
  if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split("T")[0];
  await loadAttendanceForDate();
}

export async function loadAttendanceForDate() {
  const dateVal = document.getElementById("attDate")?.value;
  if (!dateVal) return;
  try {
    const snap = await getDocs(query(collection(db, COL.ATTENDANCE), where("date", "==", dateVal)));
    attendanceData = {};
    snap.forEach(d => { attendanceData[d.data().studentId] = d.data().status; });
    renderAttendanceGrid();
  } catch(e) {
    console.error(e);
    showToast("Failed to load attendance.", "error");
  }
}

function renderAttendanceGrid() {
  const container = document.getElementById("attendanceGrid");
  if (!container) return;
  const clsFilter = document.getElementById("attClassFilter")?.value || "";
  let students = clsFilter ? studentsCache.filter(s => s.class === clsFilter) : studentsCache;

  if (students.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><span class="empty-emoji">📅</span><div class="empty-title">No students${clsFilter ? " in "+clsFilter : " yet"}</div></div>`;
    updateAttendanceCounts();
    return;
  }

  container.innerHTML = students.map(s => {
    const status = attendanceData[s.id] || "";
    return `
      <div class="attendance-card" id="att-card-${s.id}">
        <div class="att-student-info">
          <div class="att-name">${escHtml(s.name)}</div>
          <div class="att-class">${s.class} ${s.roll ? "· Roll " + s.roll : ""}</div>
        </div>
        <div class="att-toggle">
          <button class="att-btn present ${status === "Present" ? "selected" : ""}" onclick="window.appFns.setAttendance('${s.id}','Present',this)">
            <i class="fas fa-check" style="font-size:10px;"></i> P
          </button>
          <button class="att-btn absent ${status === "Absent" ? "selected" : ""}" onclick="window.appFns.setAttendance('${s.id}','Absent',this)">
            <i class="fas fa-times" style="font-size:10px;"></i> A
          </button>
        </div>
      </div>`;
  }).join("");
  updateAttendanceCounts();
}

export function setAttendance(studentId, status, btn) {
  attendanceData[studentId] = status;
  const card = document.getElementById("att-card-" + studentId);
  if (card) {
    card.querySelectorAll(".att-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
  }
  updateAttendanceCounts();
}

function updateAttendanceCounts() {
  const clsFilter = document.getElementById("attClassFilter")?.value || "";
  const students  = clsFilter ? studentsCache.filter(s => s.class === clsFilter) : studentsCache;
  const total   = students.length;
  const present = students.filter(s => attendanceData[s.id] === "Present").length;
  const absent  = students.filter(s => attendanceData[s.id] === "Absent").length;
  setEl("attPresentCount", present);
  setEl("attAbsentCount", absent);
  setEl("attTotalCount", total);
}

export async function saveAttendance() {
  const dateVal = document.getElementById("attDate")?.value;
  if (!dateVal) { showToast("Please select a date.", "error"); return; }

  const entries = Object.entries(attendanceData);
  if (entries.length === 0) { showToast("No attendance marked yet.", "error"); return; }

  try {
    // Delete existing records for this date
    const existSnap = await getDocs(query(collection(db, COL.ATTENDANCE), where("date", "==", dateVal)));
    const delPromises = [];
    existSnap.forEach(d => delPromises.push(deleteDoc(doc(db, COL.ATTENDANCE, d.id))));
    await Promise.all(delPromises);

    // Write new records
    const addPromises = entries.map(([studentId, status]) => {
      const student = studentsCache.find(s => s.id === studentId);
      return addDoc(collection(db, COL.ATTENDANCE), {
        studentId, status, date: dateVal,
        studentName: student?.name || "",
        class:       student?.class || "",
        createdAt:   serverTimestamp()
      });
    });
    await Promise.all(addPromises);

    const present = entries.filter(([,s]) => s === "Present").length;
    showToast(`✅ Attendance saved — ${present} present, ${entries.length - present} absent.`);
    loadDashboardStats();
  } catch(e) {
    console.error(e);
    showToast("Failed to save attendance.", "error");
  }
}

export function markAllPresent() {
  const clsFilter = document.getElementById("attClassFilter")?.value || "";
  const students  = clsFilter ? studentsCache.filter(s => s.class === clsFilter) : studentsCache;
  students.forEach(s => { attendanceData[s.id] = "Present"; });
  renderAttendanceGrid();
}
export function markAllAbsent() {
  const clsFilter = document.getElementById("attClassFilter")?.value || "";
  const students  = clsFilter ? studentsCache.filter(s => s.class === clsFilter) : studentsCache;
  students.forEach(s => { attendanceData[s.id] = "Absent"; });
  renderAttendanceGrid();
}

// ─────────────────────────────────────────────────────────────
//  FEES
// ─────────────────────────────────────────────────────────────
function subscribeFees() {
  const q = query(collection(db, COL.FEES), orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    feesCache = [];
    snap.forEach(d => feesCache.push({ id: d.id, ...d.data() }));
    renderFeesTable(feesCache);
  }, err => console.error("Fees listener:", err));
}

async function loadFeesPage() {
  renderFeesTable(feesCache);
  updateFeeSummary(feesCache);
}

export function openAddFeeModal() {
  document.getElementById("feeForm").reset();
  setValue("feeDate", new Date().toISOString().split("T")[0]);
  openModal("feeModal");
}

export async function saveFeeRecord() {
  const studentId = val("feeStudentSelect");
  const amount    = val("feeAmount");
  const feeType   = val("feeType");
  const date      = val("feeDate");
  const status    = val("feeStatus");

  if (!studentId || !amount || !feeType || !date || !status) {
    showToast("Please fill all required fields.", "error"); return;
  }

  const btn = document.getElementById("saveFeeBtn");
  btn.disabled = true;

  const student = studentsCache.find(s => s.id === studentId);
  try {
    await addDoc(collection(db, COL.FEES), {
      studentId, studentName: student?.name || "", class: student?.class || "",
      amount: Number(amount), feeType,
      month:  val("feeMonth"), date, status,
      notes:  val("feeNotes"),
      createdAt: serverTimestamp()
    });
    showToast(`💰 Fee record added for ${student?.name || "student"}!`);
    closeFeeModal();
    loadDashboardStats();
  } catch(e) {
    console.error(e);
    showToast("Failed to add fee record.", "error");
  } finally { btn.disabled = false; }
}

export async function markFeePaid(id) {
  try {
    await updateDoc(doc(db, COL.FEES, id), { status: "Paid", updatedAt: serverTimestamp() });
    showToast("Fee marked as Paid!", "info");
    loadDashboardStats();
  } catch(e) { showToast("Failed to update.", "error"); }
}

function renderFeesTable(fees, filterText = "", filterStatus = "") {
  const tbody = document.getElementById("feesTableBody");
  if (!tbody) return;
  let list = fees;
  if (filterText)   list = list.filter(f => f.studentName?.toLowerCase().includes(filterText.toLowerCase()));
  if (filterStatus) list = list.filter(f => f.status === filterStatus);

  updateFeeSummary(list);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><span class="empty-emoji">💰</span><div class="empty-title">No fee records</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((f, i) => `
    <tr>
      <td><span style="color:var(--text-muted);font-weight:600;">${i+1}</span></td>
      <td style="font-weight:700;">${escHtml(f.studentName)}</td>
      <td><span class="badge badge-${(f.class||"").toLowerCase()}">${f.class || "—"}</span></td>
      <td style="font-weight:700;color:var(--navy);">₹${Number(f.amount||0).toLocaleString("en-IN")}</td>
      <td style="font-size:0.8rem;">${f.month || "—"}</td>
      <td style="font-size:0.8rem;">${f.feeType || "—"}</td>
      <td style="font-size:0.8rem;">${f.date ? formatDate(f.date) : "—"}</td>
      <td><span class="badge badge-${(f.status||"").toLowerCase()}">${f.status || "Pending"}</span></td>
      <td>
        <div style="display:flex;gap:5px;">
          ${f.status !== "Paid" ? `<button class="btn btn-success btn-sm" onclick="window.appFns.markFeePaid('${f.id}')" style="padding:4px 9px;font-size:0.72rem;">Paid</button>` : ""}
          <button class="btn btn-danger btn-icon-sm" onclick="window.appFns.confirmDelete('${f.id}','${COL.FEES}','fee record')" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join("");
}

function updateFeeSummary(list) {
  let col = 0, pend = 0;
  (list || feesCache).forEach(f => {
    if (f.status === "Paid") col += Number(f.amount) || 0;
    else pend += Number(f.amount) || 0;
  });
  setEl("feeTotalCollected", "₹" + col.toLocaleString("en-IN"));
  setEl("feeTotalPending",   "₹" + pend.toLocaleString("en-IN"));
  setEl("feeTotalRecords",   (list || feesCache).length);
}

export function filterFees(v)          { renderFeesTable(feesCache, v); }
export function filterFeesByStatus(s)  { renderFeesTable(feesCache, "", s); }

// ─────────────────────────────────────────────────────────────
//  TEACHERS
// ─────────────────────────────────────────────────────────────
function subscribeTeachers() {
  const q = query(collection(db, COL.TEACHERS), orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    teachersCache = [];
    snap.forEach(d => teachersCache.push({ id: d.id, ...d.data() }));
    renderTeachersTable(teachersCache);
    window.dispatchEvent(new CustomEvent("teachersUpdated", { detail: teachersCache }));
  }, err => console.error("Teachers listener:", err));
}

export function openAddTeacherModal() {
  editTeacherId = null;
  setEl("teacherModalTitle", "Add New Teacher");
  setEl("saveTeacherBtnText", "Add Teacher");
  document.getElementById("teacherForm").reset();
  // Uncheck all class checkboxes
  document.querySelectorAll("[name='tClass']").forEach(cb => {
    cb.checked = false;
    cb.parentElement.style.borderColor = "var(--border)";
    cb.parentElement.style.background  = "var(--card-bg)";
  });
  openModal("teacherModal");
}

export function openEditTeacherModal(id) {
  const t = teachersCache.find(x => x.id === id);
  if (!t) return;
  editTeacherId = id;
  setEl("teacherModalTitle", "Edit Teacher");
  setEl("saveTeacherBtnText", "Update Teacher");
  setValue("tName", t.name);
  setValue("tPhone", t.phone);
  setValue("tEmail", t.email);
  setValue("tQualification", t.qualification);
  setValue("tExperience", t.experience);
  setValue("tSubjects", t.subjects);
  setValue("tJoinDate", t.joinDate);
  setValue("tSalary", t.salary);

  const assignedClasses = t.classes || [];
  document.querySelectorAll("[name='tClass']").forEach(cb => {
    cb.checked = assignedClasses.includes(cb.value);
    cb.parentElement.style.borderColor = cb.checked ? "var(--gold)" : "var(--border)";
    cb.parentElement.style.background  = cb.checked ? "var(--gold-light)" : "var(--card-bg)";
  });
  openModal("teacherModal");
}

export async function saveTeacher() {
  const name          = val("tName");
  const phone         = val("tPhone");
  const qualification = val("tQualification");
  const subjects      = val("tSubjects");

  if (!name || !phone || !qualification || !subjects) {
    showToast("Please fill all required fields.", "error"); return;
  }

  const assignedClasses = [];
  document.querySelectorAll("[name='tClass']:checked").forEach(cb => assignedClasses.push(cb.value));

  const btn = document.getElementById("saveTeacherBtn");
  btn.disabled = true;

  try {
    const data = {
      name, phone, qualification, subjects,
      email:      val("tEmail"),
      experience: val("tExperience"),
      joinDate:   val("tJoinDate"),
      salary:     val("tSalary"),
      classes:    assignedClasses,
      updatedAt:  serverTimestamp()
    };
    if (editTeacherId) {
      await updateDoc(doc(db, COL.TEACHERS, editTeacherId), data);
      showToast(`✅ ${name} updated successfully!`);
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, COL.TEACHERS), data);
      showToast(`👨‍🏫 ${name} added as teacher!`);
    }
    closeTeacherModal();
    loadDashboardStats();
  } catch(e) {
    console.error(e);
    showToast("Failed to save teacher.", "error");
  } finally { btn.disabled = false; }
}

function renderTeachersTable(teachers, filterText = "") {
  const tbody = document.getElementById("teachersTableBody");
  if (!tbody) return;
  let list = filterText
    ? teachers.filter(t =>
        t.name?.toLowerCase().includes(filterText.toLowerCase()) ||
        t.subjects?.toLowerCase().includes(filterText.toLowerCase()))
    : teachers;

  setEl("teacherCountBadge", list.length);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><span class="empty-emoji">👨‍🏫</span><div class="empty-title">No teachers added yet</div></div></td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((t, i) => {
    const subjectTags = (t.subjects || "").split(",").map(s => `<span class="subject-tag">${escHtml(s.trim())}</span>`).join("");
    const classBadges = (t.classes || []).map(c => `<span class="badge badge-${c.toLowerCase()}">${c}</span>`).join(" ");
    return `
      <tr>
        <td><span style="color:var(--text-muted);font-weight:600;">${i+1}</span></td>
        <td>
          <div style="font-weight:700;">${escHtml(t.name)}</div>
          <div style="font-size:0.73rem;color:var(--text-muted);">${t.joinDate ? "Joined: "+formatDate(t.joinDate) : ""}</div>
        </td>
        <td>${subjectTags || "—"}</td>
        <td style="max-width:160px;">${classBadges || "—"}</td>
        <td><a href="tel:${t.phone}" style="color:var(--blue);font-weight:600;text-decoration:none;">${escHtml(t.phone)}</a></td>
        <td style="font-size:0.82rem;">${escHtml(t.qualification || "—")}</td>
        <td>
          <div style="display:flex;gap:5px;">
            <button class="btn btn-info btn-icon-sm" onclick="window.appFns.openEditTeacherModal('${t.id}')" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-icon-sm" onclick="window.appFns.confirmDelete('${t.id}','${COL.TEACHERS}','${escAttr(t.name)}')" title="Delete"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
  }).join("");
}

export function searchTeachers(v) { renderTeachersTable(teachersCache, v); }

// ─────────────────────────────────────────────────────────────
//  CLASSES PANEL
// ─────────────────────────────────────────────────────────────
function renderClassesPanel() {
  const grid = document.getElementById("classesGrid");
  if (!grid) return;

  const classIcons = {
    Nursery:"🌱",LKG:"🌼",UKG:"🌻","1st":"📗","2nd":"📘","3rd":"📙","4th":"📕",
    "5th":"📓","6th":"🔭","7th":"⚗️","8th":"🧮","9th":"📐","10th":"🏅"
  };

  grid.innerHTML = ALL_CLASSES.map(cls => {
    const count      = studentsCache.filter(s => s.class === cls).length;
    const teachers   = teachersCache.filter(t => (t.classes || []).includes(cls));
    const maleCount  = studentsCache.filter(s => s.class === cls && s.gender === "Male").length;
    const femaleCount= studentsCache.filter(s => s.class === cls && s.gender === "Female").length;

    return `
      <div style="background:var(--card-bg);border-radius:var(--radius);border:1.5px solid var(--border);padding:20px;box-shadow:var(--shadow-sm);transition:var(--transition);"
           onmouseover="this.style.borderColor='var(--gold)';this.style.boxShadow='var(--shadow-md)'"
           onmouseout="this.style.borderColor='var(--border)';this.style.boxShadow='var(--shadow-sm)'">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="font-size:2rem;">${classIcons[cls] || "📚"}</div>
          <span class="badge badge-${cls.toLowerCase()}">${cls}</span>
        </div>
        <div style="font-family:var(--font-display);font-size:1.6rem;font-weight:700;color:var(--navy);line-height:1;">${count}</div>
        <div style="font-size:0.74rem;color:var(--text-muted);font-weight:600;margin-top:3px;">Students Enrolled</div>
        <div class="divider" style="margin:10px 0;"></div>
        <div style="font-size:0.76rem;color:var(--text-muted);display:flex;gap:10px;flex-wrap:wrap;">
          <span><i class="fas fa-mars" style="color:var(--blue);margin-right:3px;"></i>${maleCount} Boys</span>
          <span><i class="fas fa-venus" style="color:var(--pink);margin-right:3px;"></i>${femaleCount} Girls</span>
        </div>
        <div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted);">
          <i class="fas fa-chalkboard-teacher" style="color:var(--gold);margin-right:4px;"></i>
          ${teachers.length > 0 ? teachers.map(t => escHtml(t.name)).join(", ") : "<span style='color:var(--orange)'>No teacher assigned</span>"}
        </div>
      </div>`;
  }).join("");
}

// ─────────────────────────────────────────────────────────────
//  DELETE (universal)
// ─────────────────────────────────────────────────────────────
export function confirmDelete(id, collectionName, name) {
  deleteTarget = { id, col: collectionName, name };
  setEl("deleteTargetName", name);
  openModal("deleteModal");
}

export async function executeDelete() {
  if (!deleteTarget.id) return;
  const btn = document.getElementById("confirmDeleteBtn");
  btn.disabled = true;
  btn.textContent = "Deleting...";
  try {
    await deleteDoc(doc(db, deleteTarget.col, deleteTarget.id));
    showToast(`🗑️ "${deleteTarget.name}" deleted.`, "info");
    closeDeleteModal();
    loadDashboardStats();
  } catch(e) {
    showToast("Failed to delete.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Yes, Delete";
    deleteTarget = { id: null, col: null, name: "" };
  }
}

// ─────────────────────────────────────────────────────────────
//  REPORTS
// ─────────────────────────────────────────────────────────────
function initReportDates() {
  const today = new Date().toISOString().split("T")[0];
  const monthAgo = new Date(Date.now() - 30*24*60*60*1000).toISOString().split("T")[0];
  setValue("reportFrom", monthAgo);
  setValue("reportTo", today);
}

export async function generateReport() {
  const studentId = val("reportStudentSelect");
  const type      = val("reportType");
  const from      = val("reportFrom");
  const to        = val("reportTo");

  if (!studentId) { showToast("Please select a student.", "error"); return; }
  if (!from || !to) { showToast("Please select a date range.", "error"); return; }

  const student = studentsCache.find(s => s.id === studentId);
  if (!student) { showToast("Student not found.", "error"); return; }

  try {
    let result;
    if (type === "fee") {
      const snap = await getDocs(query(collection(db, COL.FEES), where("studentId", "==", studentId)));
      const fees = [];
      snap.forEach(d => fees.push(d.data()));
      const filtered = fees.filter(f => f.date >= from && f.date <= to);
      result = buildFeeReport(student, filtered, from, to);
    } else {
      const snap = await getDocs(query(collection(db, COL.ATTENDANCE), where("studentId", "==", studentId)));
      const att = [];
      snap.forEach(d => att.push(d.data()));
      const filtered = att.filter(a => a.date >= from && a.date <= to);
      result = buildAttendanceReport(student, filtered, from, to);
    }
    currentReport = result;
    setEl("reportModalTitle", result.title);
    document.getElementById("reportPreviewContent").innerHTML = result.html;
    openModal("reportModal");
  } catch(e) {
    console.error(e);
    showToast("Failed to generate report.", "error");
  }
}

function buildFeeReport(student, fees, from, to) {
  let paid = 0, pending = 0;
  fees.forEach(f => {
    if (f.status === "Paid") paid += Number(f.amount) || 0;
    else pending += Number(f.amount) || 0;
  });
  const rows = fees.map((f,i) => `
    <tr style="border-bottom:1px solid #eee;">
      <td style="padding:8px 10px;">${i+1}</td>
      <td style="padding:8px 10px;">${f.date ? formatDate(f.date) : "—"}</td>
      <td style="padding:8px 10px;">${f.month || "—"}</td>
      <td style="padding:8px 10px;">${f.feeType || "—"}</td>
      <td style="padding:8px 10px;font-weight:700;">₹${Number(f.amount||0).toLocaleString("en-IN")}</td>
      <td style="padding:8px 10px;"><span style="padding:3px 9px;border-radius:50px;font-size:0.72rem;font-weight:700;background:${f.status==="Paid"?"#e8f8ee":"#fff0ec"};color:${f.status==="Paid"?"#27ae60":"#e17055"}">${f.status}</span></td>
    </tr>`).join("");

  const html = `
    <div style="font-family:'Poppins',sans-serif;font-size:0.88rem;">
      <div style="background:linear-gradient(135deg,#0a1628,#1a2f52);color:white;padding:20px 24px;border-radius:12px;margin-bottom:16px;text-align:center;">
        <div style="font-family:'Cinzel',serif;font-size:1.2rem;font-weight:700;color:#e8b44a;">Sri Chaithanya English Medium School</div>
        <div style="font-size:0.72rem;opacity:0.6;margin-top:4px;letter-spacing:1.5px;">GARLADINNE · ANANTAPUR · ANDHRA PRADESH</div>
        <div style="margin-top:10px;font-size:1rem;font-weight:700;letter-spacing:1px;">FEE REPORT</div>
        <div style="font-size:0.78rem;opacity:0.7;margin-top:3px;">${formatDate(from)} to ${formatDate(to)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div style="background:#f5f6fa;border-radius:10px;padding:12px;"><div style="font-size:0.68rem;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:3px;">Student</div><div style="font-weight:700;">${escHtml(student.name)}</div></div>
        <div style="background:#f5f6fa;border-radius:10px;padding:12px;"><div style="font-size:0.68rem;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:3px;">Class</div><div style="font-weight:700;">${student.class}</div></div>
        <div style="background:#f5f6fa;border-radius:10px;padding:12px;"><div style="font-size:0.68rem;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:3px;">Parent</div><div style="font-weight:700;">${escHtml(student.parent)}</div></div>
        <div style="background:#f5f6fa;border-radius:10px;padding:12px;"><div style="font-size:0.68rem;font-weight:700;color:#888;text-transform:uppercase;margin-bottom:3px;">Phone</div><div style="font-weight:700;">${escHtml(student.phone)}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;">
        <div style="background:#e8f8ee;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:1.2rem;font-weight:800;color:#27ae60;">₹${paid.toLocaleString("en-IN")}</div><div style="font-size:0.7rem;color:#888;margin-top:2px;">Total Paid</div></div>
        <div style="background:#fff0ec;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:1.2rem;font-weight:800;color:#e17055;">₹${pending.toLocaleString("en-IN")}</div><div style="font-size:0.7rem;color:#888;margin-top:2px;">Pending</div></div>
        <div style="background:#fdf3dc;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:1.2rem;font-weight:800;color:#c9933a;">₹${(paid+pending).toLocaleString("en-IN")}</div><div style="font-size:0.7rem;color:#888;margin-top:2px;">Total</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#f5f6fa;">
          <th style="padding:9px 10px;text-align:left;font-size:0.68rem;text-transform:uppercase;color:#888;border-bottom:2px solid #eee;">#</th>
          <th style="padding:9px 10px;text-align:left;font-size:0.68rem;text-transform:uppercase;color:#888;border-bottom:2px solid #eee;">Date</th>
          <th style="padding:9px 10px;text-align:left;font-size:0.68rem;text-transform:uppercase;color:#888;border-bottom:2px solid #eee;">Month</th>
          <th style="padding:9px 10px;text-align:left;font-size:0.68rem;text-transform:uppercase;color:#888;border-bottom:2px solid #eee;">Type</th>
          <th style="padding:9px 10px;text-align:left;font-size:0.68rem;text-transform:uppercase;color:#888;border-bottom:2px solid #eee;">Amount</th>
          <th style="padding:9px 10px;text-align:left;font-size:0.68rem;text-transform:uppercase;color:#888;border-bottom:2px solid #eee;">Status</th>
        </tr></thead>
        <tbody>${rows || "<tr><td colspan='6' style='text-align:center;padding:20px;color:#aaa;'>No records in this period</td></tr>"}</tbody>
      </table>
      <div style="margin-top:14px;padding:10px 14px;background:#fffbf0;border-radius:8px;border:1px solid #e8b44a;font-size:0.76rem;color:#888;">
        <strong style="color:#c9933a;">Note:</strong> Report generated on ${new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"})} by Sri Chaithanya School Admin System.
      </div>
    </div>`;

  const waText = `*Sri Chaithanya English Medium School*\n💰 Fee Report\n\nStudent: ${student.name}\nClass: ${student.class}\nParent: ${student.parent}\n\n📅 Period: ${formatDate(from)} to ${formatDate(to)}\n\n✅ Paid: ₹${paid.toLocaleString("en-IN")}\n⏳ Pending: ₹${pending.toLocaleString("en-IN")}\n💰 Total: ₹${(paid+pending).toLocaleString("en-IN")}\n\n_Generated by Sri Chaithanya Admin Portal_`;

  return { title: `Fee Report — ${student.name}`, html, text: waText, student, from, to, type: "fee" };
}

function buildAttendanceReport(student, records, from, to) {
  const total   = records.length;
  const present = records.filter(r => r.status === "Present").length;
  const absent  = records.filter(r => r.status === "Absent").length;
  const pct     = total > 0 ? Math.round((present / total) * 100) : 0;

  const rows = records.sort((a,b) => a.date > b.date ? 1 : -1).map((r,i) => `
    <tr style="border-bottom:1px solid #eee;">
      <td style="padding:8px 10px;">${i+1}</td>
      <td style="padding:8px 10px;">${r.date ? formatDate(r.date) : "—"}</td>
      <td style="padding:8px 10px;"><span style="padding:3px 9px;border-radius:50px;font-size:0.72rem;font-weight:700;background:${r.status==="Present"?"#e8f8ee":"#fdecea"};color:${r.status==="Present"?"#27ae60":"#e74c3c"}">${r.status}</span></td>
    </tr>`).join("");

  const html = `
    <div style="font-family:'Poppins',sans-serif;font-size:0.88rem;">
      <div style="background:linear-gradient(135deg,#0a1628,#1a2f52);color:white;padding:20px 24px;border-radius:12px;margin-bottom:16px;text-align:center;">
        <div style="font-family:'Cinzel',serif;font-size:1.2rem;font-weight:700;color:#e8b44a;">Sri Chaithanya English Medium School</div>
        <div style="font-size:0.72rem;opacity:0.6;margin-top:4px;letter-spacing:1.5px;">GARLADINNE · ANANTAPUR · ANDHRA PRADESH</div>
        <div style="margin-top:10px;font-size:1rem;font-weight:700;letter-spacing:1px;">ATTENDANCE REPORT</div>
        <div style="font-size:0.78rem;opacity:0.7;margin-top:3px;">${formatDate(from)} to ${formatDate(to)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        <div style="background:#f5f6fa;border-radius:10px;padding:12px;"><div style="font-size:0.68rem;font-weight:700;color:#888;margin-bottom:3px;">STUDENT</div><div style="font-weight:700;">${escHtml(student.name)}</div></div>
        <div style="background:#f5f6fa;border-radius:10px;padding:12px;"><div style="font-size:0.68rem;font-weight:700;color:#888;margin-bottom:3px;">CLASS</div><div style="font-weight:700;">${student.class}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px;">
        <div style="background:#e8f8ee;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:1.2rem;font-weight:800;color:#27ae60;">${present}</div><div style="font-size:0.68rem;color:#888;">Present</div></div>
        <div style="background:#fdecea;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:1.2rem;font-weight:800;color:#e74c3c;">${absent}</div><div style="font-size:0.68rem;color:#888;">Absent</div></div>
        <div style="background:#f5f6fa;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:1.2rem;font-weight:800;color:#0a1628;">${total}</div><div style="font-size:0.68rem;color:#888;">Total Days</div></div>
        <div style="background:#fdf3dc;border-radius:10px;padding:12px;text-align:center;"><div style="font-size:1.2rem;font-weight:800;color:#c9933a;">${pct}%</div><div style="font-size:0.68rem;color:#888;">Rate</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:#f5f6fa;">
          <th style="padding:9px 10px;text-align:left;font-size:0.68rem;text-transform:uppercase;color:#888;border-bottom:2px solid #eee;">#</th>
          <th style="padding:9px 10px;text-align:left;font-size:0.68rem;text-transform:uppercase;color:#888;border-bottom:2px solid #eee;">Date</th>
          <th style="padding:9px 10px;text-align:left;font-size:0.68rem;text-transform:uppercase;color:#888;border-bottom:2px solid #eee;">Status</th>
        </tr></thead>
        <tbody>${rows || "<tr><td colspan='3' style='text-align:center;padding:20px;color:#aaa;'>No records in this period</td></tr>"}</tbody>
      </table>
      <div style="margin-top:14px;padding:10px 14px;background:#fffbf0;border-radius:8px;border:1px solid #e8b44a;font-size:0.76rem;color:#888;">
        <strong style="color:#c9933a;">Note:</strong> Report generated on ${new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric"})} by Sri Chaithanya School Admin System.
      </div>
    </div>`;

  const waText = `*Sri Chaithanya English Medium School*\n📅 Attendance Report\n\nStudent: ${student.name}\nClass: ${student.class}\n\n📅 Period: ${formatDate(from)} to ${formatDate(to)}\n\n✅ Present: ${present}\n❌ Absent: ${absent}\n📊 Total: ${total} days\n📈 Rate: ${pct}%\n\n_Generated by Sri Chaithanya Admin Portal_`;

  return { title: `Attendance Report — ${student.name}`, html, text: waText, student, from, to, type: "attendance" };
}

// Quick Reports
export async function generateAllFeesReport() {
  const html = `
    <div style="font-family:'Poppins',sans-serif;">
      <div style="background:linear-gradient(135deg,#0a1628,#1a2f52);color:white;padding:16px 20px;border-radius:10px;margin-bottom:14px;text-align:center;">
        <div style="font-family:'Cinzel',serif;font-size:1.1rem;font-weight:700;color:#e8b44a;">Sri Chaithanya School — All Fee Records</div>
        <div style="font-size:0.72rem;opacity:0.6;margin-top:3px;">Generated: ${new Date().toLocaleDateString("en-IN")}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:0.83rem;">
        <thead><tr style="background:#f5f6fa;">
          ${["#","Student","Class","Amount","Type","Month","Date","Status"].map(h=>`<th style="padding:8px 10px;text-align:left;font-size:0.67rem;text-transform:uppercase;color:#888;border-bottom:2px solid #eee;">${h}</th>`).join("")}
        </tr></thead>
        <tbody>
          ${feesCache.map((f,i) => `<tr style="border-bottom:1px solid #f0f0f0;">
            <td style="padding:7px 10px;">${i+1}</td>
            <td style="padding:7px 10px;font-weight:700;">${escHtml(f.studentName)}</td>
            <td style="padding:7px 10px;">${f.class||"—"}</td>
            <td style="padding:7px 10px;font-weight:700;">₹${Number(f.amount||0).toLocaleString("en-IN")}</td>
            <td style="padding:7px 10px;">${f.feeType||"—"}</td>
            <td style="padding:7px 10px;">${f.month||"—"}</td>
            <td style="padding:7px 10px;">${f.date?formatDate(f.date):"—"}</td>
            <td style="padding:7px 10px;"><span style="padding:2px 8px;border-radius:50px;font-size:0.68rem;font-weight:700;background:${f.status==="Paid"?"#e8f8ee":"#fff0ec"};color:${f.status==="Paid"?"#27ae60":"#e17055"}">${f.status}</span></td>
          </tr>`).join("") || "<tr><td colspan='8' style='padding:20px;text-align:center;color:#aaa;'>No records found</td></tr>"}
        </tbody>
      </table>
    </div>`;
  currentReport = { title: "All Fee Records", html, text: "All Fee Records — Sri Chaithanya School", type: "fees-all" };
  setEl("reportModalTitle", "All Fee Records");
  document.getElementById("reportPreviewContent").innerHTML = html;
  openModal("reportModal");
}

export async function generatePendingFeesReport() {
  const pending = feesCache.filter(f => f.status === "Pending");
  const total   = pending.reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const html = `
    <div style="font-family:'Poppins',sans-serif;">
      <div style="background:linear-gradient(135deg,#e17055,#fab1a0);color:white;padding:16px 20px;border-radius:10px;margin-bottom:14px;text-align:center;">
        <div style="font-size:1.1rem;font-weight:700;">⚠️ Pending Fee Records — Sri Chaithanya School</div>
        <div style="font-size:0.75rem;opacity:0.8;margin-top:3px;">Total Pending: ₹${total.toLocaleString("en-IN")}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:0.83rem;">
        <thead><tr style="background:#fff0ec;">${["#","Student","Class","Amount","Type","Month"].map(h=>`<th style="padding:8px 10px;text-align:left;font-size:0.67rem;text-transform:uppercase;color:#e17055;border-bottom:2px solid #fab1a0;">${h}</th>`).join("")}</tr></thead>
        <tbody>
          ${pending.map((f,i) => `<tr style="border-bottom:1px solid #f0f0f0;">
            <td style="padding:7px 10px;">${i+1}</td>
            <td style="padding:7px 10px;font-weight:700;">${escHtml(f.studentName)}</td>
            <td style="padding:7px 10px;">${f.class||"—"}</td>
            <td style="padding:7px 10px;font-weight:700;color:#e17055;">₹${Number(f.amount||0).toLocaleString("en-IN")}</td>
            <td style="padding:7px 10px;">${f.feeType||"—"}</td>
            <td style="padding:7px 10px;">${f.month||"—"}</td>
          </tr>`).join("") || "<tr><td colspan='6' style='padding:20px;text-align:center;color:#aaa;'>No pending fees! 🎉</td></tr>"}
        </tbody>
      </table>
    </div>`;
  currentReport = { title: "Pending Fees", html, text: `Pending Fees: ₹${total.toLocaleString("en-IN")} — Sri Chaithanya School` };
  setEl("reportModalTitle", "Pending Fee Records");
  document.getElementById("reportPreviewContent").innerHTML = html;
  openModal("reportModal");
}

export async function generateTodayAttendanceReport() {
  const today = new Date().toISOString().split("T")[0];
  const snap  = await getDocs(query(collection(db, COL.ATTENDANCE), where("date", "==", today)));
  const att   = {};
  snap.forEach(d => { att[d.data().studentId] = d.data().status; });
  const present = studentsCache.filter(s => att[s.id] === "Present");
  const absent  = studentsCache.filter(s => att[s.id] === "Absent");
  const unmark  = studentsCache.filter(s => !att[s.id]);

  const pct = studentsCache.length > 0 ? Math.round((present.length/studentsCache.length)*100) : 0;
  const html = `
    <div style="font-family:'Poppins',sans-serif;">
      <div style="background:linear-gradient(135deg,#00b894,#00cec9);color:white;padding:16px 20px;border-radius:10px;margin-bottom:14px;text-align:center;">
        <div style="font-size:1.1rem;font-weight:700;">📅 Today's Attendance — ${formatDate(today)}</div>
        <div style="font-size:0.8rem;opacity:0.8;margin-top:3px;">${present.length} Present · ${absent.length} Absent · ${pct}% Attendance Rate</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
        <div style="background:#e8f8ee;border-radius:10px;padding:14px;"><div style="font-weight:800;font-size:0.88rem;color:#27ae60;margin-bottom:8px;">✅ Present (${present.length})</div>${present.map(s=>`<div style="font-size:0.82rem;padding:3px 0;border-bottom:1px solid #c8f0d4;">${escHtml(s.name)} <span style="color:#888;font-size:0.72rem;">(${s.class})</span></div>`).join("") || "<div style='color:#aaa;font-size:0.8rem;'>None</div>"}</div>
        <div style="background:#fdecea;border-radius:10px;padding:14px;"><div style="font-weight:800;font-size:0.88rem;color:#e74c3c;margin-bottom:8px;">❌ Absent (${absent.length})</div>${absent.map(s=>`<div style="font-size:0.82rem;padding:3px 0;border-bottom:1px solid #f5c6c6;">${escHtml(s.name)} <span style="color:#888;font-size:0.72rem;">(${s.class})</span></div>`).join("") || "<div style='color:#aaa;font-size:0.8rem;'>None</div>"}</div>
      </div>
      ${unmark.length > 0 ? `<div style="background:#fff8e1;border-radius:10px;padding:14px;border:1px solid #ffd54f;"><div style="font-weight:700;font-size:0.84rem;color:#f59e0b;margin-bottom:6px;">⚠️ Not Marked (${unmark.length})</div>${unmark.map(s=>`<span style="display:inline-block;font-size:0.78rem;background:#fff;border:1px solid #ffd54f;border-radius:6px;padding:2px 8px;margin:2px;">${escHtml(s.name)}</span>`).join("")}</div>` : ""}
    </div>`;
  currentReport = { title: "Today's Attendance", html, text: `Today's Attendance — ${formatDate(today)}\nPresent: ${present.length} · Absent: ${absent.length} · Rate: ${pct}%\n\n_Sri Chaithanya School Admin_` };
  setEl("reportModalTitle", "Today's Attendance");
  document.getElementById("reportPreviewContent").innerHTML = html;
  openModal("reportModal");
}

export async function generateClasswiseReport() {
  const rows = ALL_CLASSES.map(cls => {
    const count   = studentsCache.filter(s => s.class === cls).length;
    const male    = studentsCache.filter(s => s.class === cls && s.gender === "Male").length;
    const female  = studentsCache.filter(s => s.class === cls && s.gender === "Female").length;
    return { cls, count, male, female };
  });
  const total = rows.reduce((s,r) => s+r.count, 0);
  const html = `
    <div style="font-family:'Poppins',sans-serif;">
      <div style="background:linear-gradient(135deg,#0a1628,#1a2f52);color:white;padding:16px 20px;border-radius:10px;margin-bottom:14px;text-align:center;">
        <div style="font-family:'Cinzel',serif;font-size:1.1rem;font-weight:700;color:#e8b44a;">Sri Chaithanya School — Class-wise Student Strength</div>
        <div style="font-size:0.75rem;opacity:0.7;margin-top:3px;">Total Enrolled: ${total} students</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:0.84rem;">
        <thead><tr style="background:#f5f6fa;">${["Class","Total","Boys","Girls"].map(h=>`<th style="padding:9px 12px;text-align:left;font-size:0.68rem;text-transform:uppercase;color:#888;border-bottom:2px solid #eee;">${h}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map(r => `<tr style="border-bottom:1px solid #f0f0f0;">
            <td style="padding:9px 12px;font-weight:700;">${r.cls}</td>
            <td style="padding:9px 12px;font-weight:800;color:var(--navy,#0a1628);">${r.count}</td>
            <td style="padding:9px 12px;color:#0984e3;">${r.male}</td>
            <td style="padding:9px 12px;color:#fd79a8;">${r.female}</td>
          </tr>`).join("")}
          <tr style="background:#fdf3dc;font-weight:800;">
            <td style="padding:10px 12px;font-family:'Cinzel',serif;font-size:0.88rem;">TOTAL</td>
            <td style="padding:10px 12px;font-size:1.1rem;color:#c9933a;">${total}</td>
            <td style="padding:10px 12px;color:#0984e3;">${rows.reduce((s,r)=>s+r.male,0)}</td>
            <td style="padding:10px 12px;color:#fd79a8;">${rows.reduce((s,r)=>s+r.female,0)}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
  currentReport = { title: "Class-wise Report", html, text: `Class-wise Student Strength — Sri Chaithanya School\nTotal: ${total} students` };
  setEl("reportModalTitle", "Class-wise Student Strength");
  document.getElementById("reportPreviewContent").innerHTML = html;
  openModal("reportModal");
}

// ─── PDF DOWNLOAD ────────────────────────────────────────────
export async function downloadReportPDF() {
  if (!currentReport) return;
  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    pdf.setFillColor(10, 22, 40);
    pdf.rect(0, 0, 210, 38, "F");
    pdf.setTextColor(232, 180, 74);
    pdf.setFontSize(16); pdf.setFont("helvetica", "bold");
    pdf.text("Sri Chaithanya English Medium School", 105, 14, { align: "center" });
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
    pdf.text("Garladinne, Anantapur, Andhra Pradesh | Nursery to 10th Class", 105, 21, { align: "center" });
    pdf.setFontSize(12); pdf.setFont("helvetica", "bold");
    pdf.text(currentReport.title.toUpperCase(), 105, 31, { align: "center" });
    const previewEl = document.getElementById("reportPreviewContent");
    if (previewEl && window.html2canvas) {
      const canvas = await window.html2canvas(previewEl, { scale: 1.5, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const imgW = 180; const imgH = (canvas.height / canvas.width) * imgW;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 15, 15, imgW, Math.min(imgH, 260));
    }
    pdf.save(`${currentReport.title.replace(/\s+/g, "_")}.pdf`);
    showToast("✅ PDF downloaded!");
  } catch(e) {
    console.error(e);
    const win = window.open("", "_blank");
    win.document.write(`<html><head><title>${currentReport.title}</title><style>body{font-family:sans-serif;padding:20px;}@media print{button{display:none}}</style></head><body><button onclick="window.print()" style="margin-bottom:20px;padding:10px 20px;background:#c9933a;color:white;border:none;border-radius:8px;cursor:pointer;">🖨️ Print / Save PDF</button>${currentReport.html}</body></html>`);
    win.document.close();
    showToast("📄 Print dialog opened.", "info");
  }
}

// ─── WHATSAPP ─────────────────────────────────────────────────
export function shareViaWhatsApp() {
  if (!currentReport) return;
  const phone = currentReport.student?.phone?.replace(/\D/g, "") || "";
  const msg   = encodeURIComponent(currentReport.text);
  const url   = phone ? `https://wa.me/91${phone}?text=${msg}` : `https://wa.me/?text=${msg}`;
  window.open(url, "_blank");
  showToast("📤 Opening WhatsApp...", "info");
}

// ─── POPULATE DROPDOWNS ───────────────────────────────────────
function populateStudentDropdowns() {
  ["feeStudentSelect", "reportStudentSelect"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = `<option value="">— Select Student —</option>`;
    studentsCache.forEach(s => {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = `${s.name} (${s.class})`;
      el.appendChild(o);
    });
    if (cur) el.value = cur;
  });
}

// ─── HELPERS ─────────────────────────────────────────────────
function setEl(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function setValue(id, v) { const el = document.getElementById(id); if (el) el.value = v || ""; }
function val(id)         { const el = document.getElementById(id); return el ? el.value.trim() : ""; }

function escHtml(str = "") {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function escAttr(str = "") {
  return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
}
function formatDate(dateStr) {
  if (!dateStr) return "—";
  try { return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }); }
  catch { return dateStr; }
}

// ─── EXPORT (window.appFns) ──────────────────────────────────
window.appFns = {
  navigateTo, toggleSidebar, closeSidebar, logout, showToast,
  // Students
  openAddStudentModal, openEditStudentModal, saveStudent, closeStudentModal,
  searchStudents, filterByClass,
  // Admissions
  openAddAdmissionModal, openEditAdmissionModal, saveAdmission, closeAdmissionModal,
  updateAdmissionStatus, searchAdmissions, filterAdmissions,
  // Attendance
  loadAttendanceForDate, setAttendance, saveAttendance, markAllPresent, markAllAbsent,
  // Fees
  openAddFeeModal, saveFeeRecord, closeFeeModal, markFeePaid, filterFees, filterFeesByStatus,
  // Teachers
  openAddTeacherModal, openEditTeacherModal, saveTeacher, closeTeacherModal, searchTeachers,
  // Delete
  confirmDelete, executeDelete, closeDeleteModal,
  // Reports
  generateReport, generateAllFeesReport, generatePendingFeesReport,
  generateTodayAttendanceReport, generateClasswiseReport,
  downloadReportPDF, shareViaWhatsApp, closeReportModal,
};
