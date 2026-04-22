/**
 * ============================================================
 * BABY STAR COACHING CENTER — ADMIN APP LOGIC
 * app.js  |  Firebase v10 Modular SDK
 * ============================================================
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ─── FIREBASE CONFIG ─────────────────────────────────────────
// 👇 Replace with your actual Firebase project config
 const firebaseConfig = {
  apiKey: "AIzaSyAWJ2M_lJmMUWfFDbItiRh73RRvIGXSYSg",
  authDomain: "preschooldemo-e350e.firebaseapp.com",
  projectId: "preschooldemo-e350e",
  storageBucket: "preschooldemo-e350e.firebasestorage.app",
  messagingSenderId: "1053542139222",
  appId: "1:1053542139222:web:6fc6265efc6ed3bde8c2f7"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ─── COLLECTIONS ─────────────────────────────────────────────
const STUDENTS   = "students";
const ATTENDANCE = "attendance";
const FEES       = "fees";

// ─── APP STATE ───────────────────────────────────────────────
let currentUser  = null;
let studentsCache = [];        // local cache for dropdowns, etc.
let editStudentId = null;      // id of student being edited
let unsubStudents = null;      // realtime listener unsubscribe

// ─── INIT: AUTH GUARD ─────────────────────────────────────────
export function initApp() {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    currentUser = user;
    hidLoader();
    setAdminInfo(user);
    subscribeStudents();       // real-time student list
    loadDashboardStats();
    navigateTo("overview");    // default panel
  });
}

function hidLoader() {
  const loader = document.getElementById("pageLoader");
  if (loader) loader.classList.add("hidden");
}

function setAdminInfo(user) {
  const el = document.getElementById("adminEmail");
  if (el) el.textContent = user.email || "Principal";
}

// ─── NAVIGATION ──────────────────────────────────────────────
export function navigateTo(panel) {
  // Hide all panels
  document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  // Show target
  const target = document.getElementById("panel-" + panel);
  if (target) target.classList.add("active");

  const navBtn = document.querySelector(`[data-panel="${panel}"]`);
  if (navBtn) navBtn.classList.add("active");

  // Update topbar title
  const titles = {
    overview:   "Dashboard Overview",
    students:   "Student Management",
    attendance: "Attendance Management",
    fees:       "Fee Management",
    reports:    "Reports & Analytics"
  };
  const titleEl = document.getElementById("pageTitle");
  if (titleEl) titleEl.textContent = titles[panel] || "Dashboard";

  // Close mobile sidebar
  closeSidebar();

  // Panel-specific loads
  if (panel === "overview")   loadDashboardStats();
  if (panel === "attendance") loadAttendancePage();
  if (panel === "fees")       loadFeesPage();
  if (panel === "reports")    loadReportsPage();
}

// ─── SIDEBAR MOBILE ──────────────────────────────────────────
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
  if (!confirm("Are you sure you want to logout?")) return;
  signOut(auth).then(() => { window.location.href = "login.html"; });
}

// ─── TOAST NOTIFICATION ──────────────────────────────────────
export function showToast(message, type = "success") {
  const icons = { success: "fa-check-circle", error: "fa-exclamation-circle", info: "fa-info-circle" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-icon"><i class="fas ${icons[type]}"></i></div>
    <div style="flex:1">${message}</div>
    <button onclick="this.parentElement.remove()" style="border:none;background:none;cursor:pointer;color:var(--text-muted);padding:2px 4px;font-size:14px;">✕</button>
  `;
  document.getElementById("toastContainer").appendChild(toast);
  setTimeout(() => { if (toast.parentElement) toast.remove(); }, 4500);
}

// ─── MODAL HELPERS ───────────────────────────────────────────
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add("open"); }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove("open"); }
}

export function closeStudentModal()    { closeModal("studentModal"); editStudentId = null; }
export function closeFeeModal()        { closeModal("feeModal"); }
export function closeReportModal()     { closeModal("reportModal"); }
export function closeDeleteModal()     { closeModal("deleteModal"); }

// ─── ─────────────────────────────────────────────────────────
//  DASHBOARD OVERVIEW
// ─── ─────────────────────────────────────────────────────────

async function loadDashboardStats() {
  try {
    // Total students
    const studentsSnap = await getDocs(collection(db, STUDENTS));
    const totalStudents = studentsSnap.size;
    let lkg = 0, ukg = 0;
    studentsSnap.forEach(d => {
      if (d.data().class === "LKG") lkg++;
      else ukg++;
    });

    // Fees
    const feesSnap = await getDocs(collection(db, FEES));
    let totalFees = 0, pendingFees = 0;
    feesSnap.forEach(d => {
      const f = d.data();
      if (f.status === "Paid") totalFees += Number(f.amount) || 0;
      else pendingFees += Number(f.amount) || 0;
    });

    // Today's attendance
    const today = new Date().toISOString().split("T")[0];
    const attSnap = await getDocs(query(
      collection(db, ATTENDANCE),
      where("date", "==", today)
    ));
    let presentToday = 0;
    attSnap.forEach(d => { if (d.data().status === "Present") presentToday++; });
    const attPct = totalStudents > 0
      ? Math.round((presentToday / totalStudents) * 100)
      : 0;

    // Update UI
    setEl("statTotalStudents", totalStudents);
    setEl("statLKG", lkg + " LKG");
    setEl("statUKG", ukg + " UKG");
    setEl("statTotalFees", "₹" + totalFees.toLocaleString("en-IN"));
    setEl("statPendingFees", "₹" + pendingFees.toLocaleString("en-IN") + " pending");
    setEl("statAttendance", attPct + "%");
    setEl("statPresentToday", presentToday + " present today");
    setEl("statTotalFeesCount", feesSnap.size + " records");

  } catch (e) {
    console.error("Stats error:", e);
  }
}

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ─── ─────────────────────────────────────────────────────────
//  STUDENT MANAGEMENT
// ─── ─────────────────────────────────────────────────────────

// Real-time student listener
function subscribeStudents() {
  if (unsubStudents) unsubStudents();
  const q = query(collection(db, STUDENTS), orderBy("createdAt", "desc"));
  unsubStudents = onSnapshot(q, (snap) => {
    studentsCache = [];
    snap.forEach(d => studentsCache.push({ id: d.id, ...d.data() }));
    renderStudentsTable(studentsCache);
    populateStudentDropdowns();
    // Notify dashboard overview table & sidebar badge
    window.dispatchEvent(new CustomEvent("studentsUpdated", { detail: studentsCache }));
  }, (err) => {
    console.error("Student listener error:", err);
  });
}

// Open add student modal
export function openAddStudentModal() {
  editStudentId = null;
  document.getElementById("studentModalTitle").textContent = "Add New Student";
  document.getElementById("studentForm").reset();
  openModal("studentModal");
}

// Open edit student modal
export function openEditStudentModal(id) {
  const student = studentsCache.find(s => s.id === id);
  if (!student) return;

  editStudentId = id;
  document.getElementById("studentModalTitle").textContent = "Edit Student";

  document.getElementById("sName").value   = student.name    || "";
  document.getElementById("sAge").value    = student.age     || "";
  document.getElementById("sClass").value  = student.class   || "LKG";
  document.getElementById("sParent").value = student.parent  || "";
  document.getElementById("sPhone").value  = student.phone   || "";

  openModal("studentModal");
}

// Save student (add or edit)
export async function saveStudent() {
  const name   = document.getElementById("sName").value.trim();
  const age    = document.getElementById("sAge").value.trim();
  const cls    = document.getElementById("sClass").value;
  const parent = document.getElementById("sParent").value.trim();
  const phone  = document.getElementById("sPhone").value.trim();

  if (!name || !age || !parent || !phone) {
    showToast("Please fill in all required fields.", "error");
    return;
  }

  if (isNaN(age) || Number(age) < 2 || Number(age) > 8) {
    showToast("Please enter a valid age between 2 and 8.", "error");
    return;
  }

  const btn = document.getElementById("saveStudentBtn");
  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    const data = { name, age: Number(age), class: cls, parent, phone, updatedAt: serverTimestamp() };

    if (editStudentId) {
      await updateDoc(doc(db, STUDENTS, editStudentId), data);
      showToast(`✅ ${name}'s record updated successfully!`);
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, STUDENTS), data);
      showToast(`🌟 ${name} added successfully!`);
    }

    closeStudentModal();
    loadDashboardStats();
  } catch (e) {
    console.error("Save student error:", e);
    showToast("Failed to save student. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = editStudentId ? "Update Student" : "Add Student";
  }
}

// Confirm delete
let deleteTargetId = null;
let deleteTargetName = "";

export function confirmDeleteStudent(id) {
  const student = studentsCache.find(s => s.id === id);
  if (!student) return;
  deleteTargetId   = id;
  deleteTargetName = student.name;
  document.getElementById("deleteStudentName").textContent = student.name;
  openModal("deleteModal");
}

export async function executeDeleteStudent() {
  if (!deleteTargetId) return;
  const btn = document.getElementById("confirmDeleteBtn");
  btn.disabled = true;
  btn.textContent = "Deleting...";

  try {
    await deleteDoc(doc(db, STUDENTS, deleteTargetId));
    showToast(`🗑️ ${deleteTargetName} removed successfully.`, "info");
    closeDeleteModal();
    loadDashboardStats();
  } catch (e) {
    showToast("Failed to delete student.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Yes, Delete";
    deleteTargetId = null;
  }
}

// Render students table
function renderStudentsTable(students, filterText = "") {
  const tbody = document.getElementById("studentsTableBody");
  if (!tbody) return;

  const filtered = filterText
    ? students.filter(s =>
        s.name.toLowerCase().includes(filterText.toLowerCase()) ||
        s.parent.toLowerCase().includes(filterText.toLowerCase()) ||
        s.class.toLowerCase().includes(filterText.toLowerCase())
      )
    : students;

  // Update count badge
  const badge = document.getElementById("studentCountBadge");
  if (badge) badge.textContent = filtered.length;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="7">
        <div class="empty-state">
          <span class="empty-emoji">👶</span>
          <div class="empty-title">${filterText ? "No students match your search" : "No students added yet"}</div>
          <div class="empty-sub">${filterText ? "Try a different search term." : "Click 'Add Student' to get started."}</div>
        </div>
      </td></tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map((s, idx) => `
    <tr>
      <td><span style="color:var(--text-muted);font-weight:700;">${idx + 1}</span></td>
      <td>
        <div style="font-weight:800;">${escHtml(s.name)}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);">Age: ${s.age} yrs</div>
      </td>
      <td><span class="badge badge-${s.class.toLowerCase()}">${s.class}</span></td>
      <td>${escHtml(s.parent)}</td>
      <td>
        <a href="tel:${s.phone}" style="color:var(--blue);font-weight:700;text-decoration:none;">
          <i class="fas fa-phone" style="font-size:11px;"></i> ${escHtml(s.phone)}
        </a>
      </td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-info btn-sm btn-icon-sm" onclick="window.appFns.openEditStudentModal('${s.id}')" title="Edit">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn btn-danger btn-sm btn-icon-sm" onclick="window.appFns.confirmDeleteStudent('${s.id}')" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

// Search students
export function searchStudents(val) {
  renderStudentsTable(studentsCache, val);
}

// Filter by class
export function filterByClass(cls) {
  if (!cls) renderStudentsTable(studentsCache);
  else renderStudentsTable(studentsCache.filter(s => s.class === cls));
}

// Populate dropdowns
function populateStudentDropdowns() {
  const ids = ["attStudentFilter", "feeStudentSelect", "reportStudentSelect"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = `<option value="">— Select Student —</option>`;
    studentsCache.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${s.name} (${s.class})`;
      el.appendChild(opt);
    });
    if (current) el.value = current;
  });
}

// ─── ─────────────────────────────────────────────────────────
//  ATTENDANCE MANAGEMENT
// ─── ─────────────────────────────────────────────────────────

let attendanceData = {}; // { studentId: "Present" | "Absent" }

async function loadAttendancePage() {
  const dateInput = document.getElementById("attDate");
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }
  await loadAttendanceForDate();
}

export async function loadAttendanceForDate() {
  const dateVal = document.getElementById("attDate")?.value;
  if (!dateVal) return;

  // Load existing attendance
  try {
    const snap = await getDocs(query(
      collection(db, ATTENDANCE),
      where("date", "==", dateVal)
    ));

    attendanceData = {};
    snap.forEach(d => {
      attendanceData[d.data().studentId] = d.data().status;
    });

    renderAttendanceGrid();
  } catch (e) {
    console.error("Load attendance error:", e);
    showToast("Failed to load attendance.", "error");
  }
}

function renderAttendanceGrid() {
  const container = document.getElementById("attendanceGrid");
  if (!container) return;

  // Class filter
  const clsFilter = document.getElementById("attClassFilter")?.value || "";
  let students = studentsCache;
  if (clsFilter) students = students.filter(s => s.class === clsFilter);

  if (students.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <span class="empty-emoji">📅</span>
        <div class="empty-title">No students found</div>
        <div class="empty-sub">Add students first to mark attendance.</div>
      </div>`;
    return;
  }

  container.innerHTML = students.map(s => {
    const status = attendanceData[s.id] || "";
    return `
      <div class="attendance-card" id="att-card-${s.id}">
        <div class="att-student-info">
          <div class="att-name">${escHtml(s.name)}</div>
          <div class="att-class">${s.class} • Age ${s.age}</div>
        </div>
        <div class="att-toggle">
          <button class="att-btn present ${status === 'Present' ? 'selected' : ''}"
            onclick="window.appFns.setAttendance('${s.id}', 'Present', this)">
            <i class="fas fa-check" style="font-size:11px;"></i> P
          </button>
          <button class="att-btn absent ${status === 'Absent' ? 'selected' : ''}"
            onclick="window.appFns.setAttendance('${s.id}', 'Absent', this)">
            <i class="fas fa-times" style="font-size:11px;"></i> A
          </button>
        </div>
      </div>
    `;
  }).join("");

  updateAttendanceSummary(students);
}

export function setAttendance(studentId, status, btn) {
  attendanceData[studentId] = status;

  // Update button styles
  const card = btn.closest(".attendance-card");
  card.querySelectorAll(".att-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");

  updateAttendanceSummary(studentsCache);
}

function updateAttendanceSummary(students) {
  let p = 0, a = 0, unmarked = 0;
  students.forEach(s => {
    if (attendanceData[s.id] === "Present") p++;
    else if (attendanceData[s.id] === "Absent") a++;
    else unmarked++;
  });

  setEl("attPresentCount", p);
  setEl("attAbsentCount",  a);
  setEl("attUnmarkedCount", unmarked);
}

export async function saveAttendance() {
  const dateVal = document.getElementById("attDate")?.value;
  if (!dateVal) {
    showToast("Please select a date first.", "error"); return;
  }

  const entries = Object.keys(attendanceData);
  if (entries.length === 0) {
    showToast("Please mark attendance for at least one student.", "error"); return;
  }

  const btn = document.getElementById("saveAttBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  try {
    // Delete existing for this date, then re-add
    const existing = await getDocs(query(
      collection(db, ATTENDANCE),
      where("date", "==", dateVal)
    ));
    const deletes = existing.docs.map(d => deleteDoc(doc(db, ATTENDANCE, d.id)));
    await Promise.all(deletes);

    // Add new records
    const adds = entries.map(studentId =>
      addDoc(collection(db, ATTENDANCE), {
        studentId,
        date:   dateVal,
        status: attendanceData[studentId],
        savedAt: serverTimestamp()
      })
    );
    await Promise.all(adds);

    showToast(`✅ Attendance saved for ${entries.length} students on ${formatDate(dateVal)}!`);
    loadDashboardStats();
  } catch (e) {
    console.error("Save attendance error:", e);
    showToast("Failed to save attendance. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save Attendance';
  }
}

export function markAllPresent() {
  studentsCache.forEach(s => { attendanceData[s.id] = "Present"; });
  renderAttendanceGrid();
}

export function markAllAbsent() {
  studentsCache.forEach(s => { attendanceData[s.id] = "Absent"; });
  renderAttendanceGrid();
}

// ─── ─────────────────────────────────────────────────────────
//  FEE MANAGEMENT
// ─── ─────────────────────────────────────────────────────────

async function loadFeesPage() {
  await loadFeesTable();
}

async function loadFeesTable(filterStudentId = "", filterStatus = "") {
  const tbody = document.getElementById("feesTableBody");
  if (!tbody) return;

  try {
    const snap = await getDocs(query(collection(db, FEES), orderBy("createdAt", "desc")));
    let fees = [];
    snap.forEach(d => fees.push({ id: d.id, ...d.data() }));

    // Filters
    if (filterStudentId) fees = fees.filter(f => f.studentId === filterStudentId);
    if (filterStatus)    fees = fees.filter(f => f.status === filterStatus);

    // Summary
    let totalPaid = 0, totalPending = 0;
    snap.forEach(d => {
      const f = d.data();
      if (f.status === "Paid") totalPaid += Number(f.amount) || 0;
      else totalPending += Number(f.amount) || 0;
    });

    setEl("feeTotalPaid",    "₹" + totalPaid.toLocaleString("en-IN"));
    setEl("feeTotalPending", "₹" + totalPending.toLocaleString("en-IN"));
    setEl("feeRecordCount",  snap.size);

    if (fees.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="7">
          <div class="empty-state">
            <span class="empty-emoji">💰</span>
            <div class="empty-title">No fee records found</div>
            <div class="empty-sub">Add a fee record to get started.</div>
          </div>
        </td></tr>`;
      return;
    }

    tbody.innerHTML = fees.map(f => {
      const student = studentsCache.find(s => s.id === f.studentId);
      const sName   = student ? student.name : "Unknown";
      const sCls    = student ? student.class : "-";
      return `
        <tr>
          <td><strong>${escHtml(sName)}</strong><br><span style="font-size:0.75rem;color:var(--text-muted);">${sCls}</span></td>
          <td><strong>₹${Number(f.amount).toLocaleString("en-IN")}</strong></td>
          <td>${escHtml(f.month || "-")}</td>
          <td>${formatDate(f.date)}</td>
          <td><span class="badge badge-${f.status === 'Paid' ? 'paid' : 'pending'}">${f.status}</span></td>
          <td>
            <div style="display:flex;gap:6px;">
              ${f.status === 'Pending'
                ? `<button class="btn btn-success btn-sm" onclick="window.appFns.markFeePaid('${f.id}')"><i class="fas fa-check"></i> Mark Paid</button>`
                : ''}
              <button class="btn btn-danger btn-sm btn-icon-sm" onclick="window.appFns.deleteFeeRecord('${f.id}')" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

  } catch (e) {
    console.error("Load fees error:", e);
    showToast("Failed to load fee records.", "error");
  }
}

export function openAddFeeModal() {
  document.getElementById("feeForm").reset();
  document.getElementById("feeDate").value = new Date().toISOString().split("T")[0];
  openModal("feeModal");
}

export async function saveFeeRecord() {
  const studentId = document.getElementById("feeStudentSelect").value;
  const amount    = document.getElementById("feeAmount").value;
  const month     = document.getElementById("feeMonth").value;
  const date      = document.getElementById("feeDate").value;
  const status    = document.getElementById("feeStatus").value;

  if (!studentId || !amount || !date) {
    showToast("Please fill in all required fields.", "error"); return;
  }

  if (isNaN(amount) || Number(amount) <= 0) {
    showToast("Please enter a valid fee amount.", "error"); return;
  }

  const btn = document.getElementById("saveFeeBtn");
  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    await addDoc(collection(db, FEES), {
      studentId, amount: Number(amount), month, date, status,
      createdAt: serverTimestamp()
    });
    const student = studentsCache.find(s => s.id === studentId);
    showToast(`✅ Fee record added for ${student ? student.name : "student"}!`);
    closeFeeModal();
    loadFeesTable();
    loadDashboardStats();
  } catch (e) {
    console.error("Save fee error:", e);
    showToast("Failed to save fee record.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Add Record";
  }
}

export async function markFeePaid(feeId) {
  try {
    await updateDoc(doc(db, FEES, feeId), { status: "Paid", paidAt: serverTimestamp() });
    showToast("✅ Fee marked as Paid!");
    loadFeesTable();
    loadDashboardStats();
  } catch (e) {
    showToast("Failed to update fee record.", "error");
  }
}

export async function deleteFeeRecord(feeId) {
  if (!confirm("Delete this fee record?")) return;
  try {
    await deleteDoc(doc(db, FEES, feeId));
    showToast("🗑️ Fee record deleted.", "info");
    loadFeesTable();
    loadDashboardStats();
  } catch (e) {
    showToast("Failed to delete fee record.", "error");
  }
}

export function filterFees() {
  const studentId = document.getElementById("feeFilterStudent")?.value || "";
  const status    = document.getElementById("feeFilterStatus")?.value  || "";
  loadFeesTable(studentId, status);
}

// ─── ─────────────────────────────────────────────────────────
//  REPORT GENERATION
// ─── ─────────────────────────────────────────────────────────

let currentReport = null; // store generated report data

function loadReportsPage() {
  // Set default dates
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const el1 = document.getElementById("reportFrom");
  const el2 = document.getElementById("reportTo");
  if (el1 && !el1.value) el1.value = firstDay;
  if (el2 && !el2.value) el2.value = today.toISOString().split("T")[0];
}

export async function generateReport() {
  const type      = document.getElementById("reportType").value;
  const studentId = document.getElementById("reportStudentSelect").value;
  const from      = document.getElementById("reportFrom").value;
  const to        = document.getElementById("reportTo").value;

  if (!type || !studentId || !from || !to) {
    showToast("Please fill in all report fields.", "error"); return;
  }

  if (new Date(from) > new Date(to)) {
    showToast("'From' date must be before 'To' date.", "error"); return;
  }

  const btn = document.getElementById("generateReportBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';

  try {
    const student = studentsCache.find(s => s.id === studentId);
    if (!student) { showToast("Student not found.", "error"); return; }

    let reportHTML = "";
    let reportText = "";
    let reportTitle = "";

    if (type === "attendance") {
      const result = await generateAttendanceReport(student, from, to);
      reportHTML  = result.html;
      reportText  = result.text;
      reportTitle = `Attendance Report — ${student.name}`;
    } else if (type === "fees") {
      const result = await generateFeeReport(student, from, to);
      reportHTML  = result.html;
      reportText  = result.text;
      reportTitle = `Fee Report — ${student.name}`;
    }

    // Store for download
    currentReport = { html: reportHTML, text: reportText, title: reportTitle, student, from, to, type };

    // Show in modal
    document.getElementById("reportModalTitle").textContent = reportTitle;
    document.getElementById("reportPreviewContent").innerHTML = reportHTML;
    openModal("reportModal");

  } catch (e) {
    console.error("Report generation error:", e);
    showToast("Failed to generate report. Please try again.", "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-chart-bar"></i> Generate Report';
  }
}

async function generateAttendanceReport(student, from, to) {
  const snap = await getDocs(query(
    collection(db, ATTENDANCE),
    where("studentId", "==", student.id)
  ));

  const records = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.date >= from && data.date <= to) {
      records.push({ date: data.date, status: data.status });
    }
  });

  records.sort((a, b) => a.date.localeCompare(b.date));

  const present = records.filter(r => r.status === "Present").length;
  const absent  = records.filter(r => r.status === "Absent").length;
  const total   = records.length;
  const pct     = total > 0 ? Math.round((present / total) * 100) : 0;

  const rowsHTML = records.length > 0
    ? records.map((r, i) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${i + 1}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${formatDate(r.date)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">
            <span style="padding:3px 10px;border-radius:50px;font-size:0.75rem;font-weight:800;
              background:${r.status === 'Present' ? '#E8F8EA' : '#FFE8E8'};
              color:${r.status === 'Present' ? '#15803D' : '#B91C1C'}">
              ${r.status}
            </span>
          </td>
        </tr>
      `).join("")
    : `<tr><td colspan="3" style="padding:20px;text-align:center;color:#888;">No attendance records for this period.</td></tr>`;

  const html = `
    <div class="report-preview" id="reportPrintArea">
      <div class="report-header-section">
        <div class="report-logo">⭐</div>
        <div class="report-school-name">Baby Star Coaching Center</div>
        <div class="report-school-sub">LKG & UKG | Garladinne, Anantapur District, Andhra Pradesh</div>
        <div class="report-type-title">ATTENDANCE REPORT</div>
        <div style="font-size:0.78rem;color:#888;margin-top:4px;">
          Period: ${formatDate(from)} — ${formatDate(to)}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div style="background:#F5F6FA;border-radius:12px;padding:14px;">
          <div style="font-size:0.72rem;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Student Name</div>
          <div style="font-weight:800;font-size:0.95rem;">${escHtml(student.name)}</div>
        </div>
        <div style="background:#F5F6FA;border-radius:12px;padding:14px;">
          <div style="font-size:0.72rem;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Class</div>
          <div style="font-weight:800;font-size:0.95rem;">${student.class}</div>
        </div>
        <div style="background:#F5F6FA;border-radius:12px;padding:14px;">
          <div style="font-size:0.72rem;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Parent Name</div>
          <div style="font-weight:800;font-size:0.95rem;">${escHtml(student.parent)}</div>
        </div>
        <div style="background:#F5F6FA;border-radius:12px;padding:14px;">
          <div style="font-size:0.72rem;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Contact</div>
          <div style="font-weight:800;font-size:0.95rem;">${escHtml(student.phone)}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;">
        <div style="background:linear-gradient(135deg,#FFF3BB,#FFE0C8);border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:1.6rem;font-weight:800;color:#FF8C42;">${total}</div>
          <div style="font-size:0.72rem;font-weight:800;color:#888;margin-top:2px;">Total Days</div>
        </div>
        <div style="background:linear-gradient(135deg,#D9F5DC,#E8F8EA);border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:1.6rem;font-weight:800;color:#15803D;">${present}</div>
          <div style="font-size:0.72rem;font-weight:800;color:#888;margin-top:2px;">Present</div>
        </div>
        <div style="background:linear-gradient(135deg,#FFE8E8,#FFD6D6);border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:1.6rem;font-weight:800;color:#B91C1C;">${absent}</div>
          <div style="font-size:0.72rem;font-weight:800;color:#888;margin-top:2px;">Absent</div>
        </div>
        <div style="background:linear-gradient(135deg,#D4F5F3,#EDE9FE);border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:1.6rem;font-weight:800;color:#0891B2;">${pct}%</div>
          <div style="font-size:0.72rem;font-weight:800;color:#888;margin-top:2px;">Attendance</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:0.87rem;">
        <thead>
          <tr style="background:#F5F6FA;">
            <th style="padding:10px 12px;text-align:left;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.6px;color:#888;border-bottom:2px solid #eee;">#</th>
            <th style="padding:10px 12px;text-align:left;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.6px;color:#888;border-bottom:2px solid #eee;">Date</th>
            <th style="padding:10px 12px;text-align:left;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.6px;color:#888;border-bottom:2px solid #eee;">Status</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>

      <div style="margin-top:20px;padding:14px;background:#FFFBF0;border-radius:10px;border:1px solid #FFD94A;font-size:0.8rem;color:#888;">
        <strong style="color:#FF8C42;">Note:</strong> This report was generated on ${new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"long", year:"numeric" })} for official school records.
      </div>
    </div>
  `;

  const text = `*Baby Star Coaching Center*\n🎓 Attendance Report\n\n` +
    `Student: ${student.name}\nClass: ${student.class}\nParent: ${student.parent}\n\n` +
    `📅 Period: ${formatDate(from)} to ${formatDate(to)}\n\n` +
    `✅ Present: ${present} days\n❌ Absent: ${absent} days\n📊 Attendance: ${pct}%\n\n` +
    `_Generated by Baby Star Admin System_`;

  return { html, text };
}

async function generateFeeReport(student, from, to) {
  const snap = await getDocs(query(
    collection(db, FEES),
    where("studentId", "==", student.id)
  ));

  const records = [];
  snap.forEach(d => {
    const data = d.data();
    if (data.date >= from && data.date <= to) {
      records.push({ id: d.id, ...data });
    }
  });

  records.sort((a, b) => a.date.localeCompare(b.date));

  const totalPaid    = records.filter(r => r.status === "Paid").reduce((s, r) => s + Number(r.amount), 0);
  const totalPending = records.filter(r => r.status !== "Paid").reduce((s, r) => s + Number(r.amount), 0);
  const totalAmount  = totalPaid + totalPending;

  const rowsHTML = records.length > 0
    ? records.map((r, i) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${i + 1}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${formatDate(r.date)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escHtml(r.month || "—")}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:800;">₹${Number(r.amount).toLocaleString("en-IN")}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;">
            <span style="padding:3px 10px;border-radius:50px;font-size:0.75rem;font-weight:800;
              background:${r.status === 'Paid' ? '#E8F8EA' : '#FFF0E6'};
              color:${r.status === 'Paid' ? '#15803D' : '#C2410C'}">
              ${r.status}
            </span>
          </td>
        </tr>
      `).join("")
    : `<tr><td colspan="5" style="padding:20px;text-align:center;color:#888;">No fee records for this period.</td></tr>`;

  const html = `
    <div class="report-preview" id="reportPrintArea">
      <div class="report-header-section">
        <div class="report-logo">⭐</div>
        <div class="report-school-name">Baby Star Coaching Center</div>
        <div class="report-school-sub">LKG & UKG | Garladinne, Anantapur District, Andhra Pradesh</div>
        <div class="report-type-title">FEE REPORT</div>
        <div style="font-size:0.78rem;color:#888;margin-top:4px;">
          Period: ${formatDate(from)} — ${formatDate(to)}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div style="background:#F5F6FA;border-radius:12px;padding:14px;">
          <div style="font-size:0.72rem;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Student Name</div>
          <div style="font-weight:800;">${escHtml(student.name)}</div>
        </div>
        <div style="background:#F5F6FA;border-radius:12px;padding:14px;">
          <div style="font-size:0.72rem;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Class</div>
          <div style="font-weight:800;">${student.class}</div>
        </div>
        <div style="background:#F5F6FA;border-radius:12px;padding:14px;">
          <div style="font-size:0.72rem;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Parent Name</div>
          <div style="font-weight:800;">${escHtml(student.parent)}</div>
        </div>
        <div style="background:#F5F6FA;border-radius:12px;padding:14px;">
          <div style="font-size:0.72rem;font-weight:800;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Contact</div>
          <div style="font-weight:800;">${escHtml(student.phone)}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
        <div style="background:linear-gradient(135deg,#D9F5DC,#E8F8EA);border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:1.3rem;font-weight:800;color:#15803D;">₹${totalPaid.toLocaleString("en-IN")}</div>
          <div style="font-size:0.72rem;font-weight:800;color:#888;margin-top:2px;">Total Paid</div>
        </div>
        <div style="background:linear-gradient(135deg,#FFF0E6,#FFE0C8);border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:1.3rem;font-weight:800;color:#C2410C;">₹${totalPending.toLocaleString("en-IN")}</div>
          <div style="font-size:0.72rem;font-weight:800;color:#888;margin-top:2px;">Pending</div>
        </div>
        <div style="background:linear-gradient(135deg,#D4F5F3,#EDE9FE);border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:1.3rem;font-weight:800;color:#0891B2;">₹${totalAmount.toLocaleString("en-IN")}</div>
          <div style="font-size:0.72rem;font-weight:800;color:#888;margin-top:2px;">Total Amount</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:0.87rem;">
        <thead>
          <tr style="background:#F5F6FA;">
            <th style="padding:10px 12px;text-align:left;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.6px;color:#888;border-bottom:2px solid #eee;">#</th>
            <th style="padding:10px 12px;text-align:left;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.6px;color:#888;border-bottom:2px solid #eee;">Date</th>
            <th style="padding:10px 12px;text-align:left;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.6px;color:#888;border-bottom:2px solid #eee;">Month</th>
            <th style="padding:10px 12px;text-align:left;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.6px;color:#888;border-bottom:2px solid #eee;">Amount</th>
            <th style="padding:10px 12px;text-align:left;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.6px;color:#888;border-bottom:2px solid #eee;">Status</th>
          </tr>
        </thead>
        <tbody>${rowsHTML}</tbody>
      </table>

      <div style="margin-top:20px;padding:14px;background:#FFFBF0;border-radius:10px;border:1px solid #FFD94A;font-size:0.8rem;color:#888;">
        <strong style="color:#FF8C42;">Note:</strong> This report was generated on ${new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"long", year:"numeric" })} for official school records.
      </div>
    </div>
  `;

  const text = `*Baby Star Coaching Center*\n💰 Fee Report\n\n` +
    `Student: ${student.name}\nClass: ${student.class}\nParent: ${student.parent}\n\n` +
    `📅 Period: ${formatDate(from)} to ${formatDate(to)}\n\n` +
    `✅ Paid: ₹${totalPaid.toLocaleString("en-IN")}\n⏳ Pending: ₹${totalPending.toLocaleString("en-IN")}\n💰 Total: ₹${totalAmount.toLocaleString("en-IN")}\n\n` +
    `_Generated by Baby Star Admin System_`;

  return { html, text };
}

// ─── PDF DOWNLOAD ─────────────────────────────────────────────
export async function downloadReportPDF() {
  if (!currentReport) return;

  try {
    // Use jsPDF for PDF generation
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Title page
    pdf.setFillColor(255, 140, 66);
    pdf.rect(0, 0, 210, 40, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("Baby Star Coaching Center", 105, 16, { align: "center" });

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text("LKG & UKG | Garladinne, Anantapur District, Andhra Pradesh", 105, 24, { align: "center" });

    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    const rType = currentReport.type === "attendance" ? "ATTENDANCE REPORT" : "FEE REPORT";
    pdf.text(rType, 105, 34, { align: "center" });

    // Student info
    pdf.setTextColor(30, 30, 46);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("Student Details", 15, 54);
    pdf.setDrawColor(230, 232, 240);
    pdf.line(15, 56, 195, 56);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    const s = currentReport.student;
    pdf.text(`Name: ${s.name}`, 15, 64);
    pdf.text(`Class: ${s.class}`, 105, 64);
    pdf.text(`Parent: ${s.parent}`, 15, 72);
    pdf.text(`Phone: ${s.phone}`, 105, 72);
    pdf.text(`Period: ${formatDate(currentReport.from)} to ${formatDate(currentReport.to)}`, 15, 80);
    pdf.text(`Generated: ${new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"long", year:"numeric" })}`, 105, 80);

    // Use html2canvas to render the preview and add as image
    const previewEl = document.getElementById("reportPreviewContent");
    if (previewEl && window.html2canvas) {
      const canvas = await window.html2canvas(previewEl, { scale: 1.5, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const imgW = 180;
      const imgH = (canvas.height / canvas.width) * imgW;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 15, 15, imgW, Math.min(imgH, 260));
    }

    pdf.save(`${currentReport.title.replace(/ /g, "_")}.pdf`);
    showToast("✅ PDF downloaded successfully!");
  } catch (e) {
    console.error("PDF error:", e);
    // Fallback: print dialog
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>${currentReport.title}</title>
      <style>body{font-family:sans-serif;padding:20px;} @media print { button{display:none;} }</style>
      </head><body>
      <button onclick="window.print()" style="margin-bottom:20px;padding:10px 20px;background:#FF8C42;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;">
        🖨️ Print / Save as PDF
      </button>
      ${currentReport.html}
      </body></html>
    `);
    win.document.close();
    showToast("📄 Print dialog opened. Choose 'Save as PDF' to download.", "info");
  }
}

// ─── WHATSAPP SHARE ───────────────────────────────────────────
export function shareViaWhatsApp() {
  if (!currentReport) return;
  const phone = currentReport.student.phone.replace(/\D/g, "");
  const msg   = encodeURIComponent(currentReport.text);
  const url   = phone
    ? `https://wa.me/91${phone}?text=${msg}`
    : `https://wa.me/?text=${msg}`;
  window.open(url, "_blank");
  showToast("📤 Opening WhatsApp...", "info");
}

// ─── HELPERS ─────────────────────────────────────────────────
function escHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric"
    });
  } catch { return dateStr; }
}

// ─── EXPORT PUBLIC FUNCTIONS (accessed via window.appFns) ─────
window.appFns = {
  navigateTo,
  toggleSidebar,
  closeSidebar,
  logout,
  openAddStudentModal,
  openEditStudentModal,
  saveStudent,
  closeStudentModal,
  confirmDeleteStudent,
  executeDeleteStudent,
  closeDeleteModal,
  searchStudents,
  filterByClass,
  loadAttendanceForDate,
  setAttendance,
  saveAttendance,
  markAllPresent,
  markAllAbsent,
  filterFees,
  openAddFeeModal,
  saveFeeRecord,
  closeFeeModal,
  markFeePaid,
  deleteFeeRecord,
  generateReport,
  downloadReportPDF,
  shareViaWhatsApp,
  closeReportModal,
  showToast
};
