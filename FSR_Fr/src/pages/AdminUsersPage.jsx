import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import ChangePasswordModal from "../components/ChangePasswordModal";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const getId = (item) => String(item.id || item._id);

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("smartfix_auth_token");
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("smartfix_auth_token");
      localStorage.removeItem("smartfix_user");
      window.location.assign("/login");
    }
    throw new Error(data.message || `Request failed (${response.status})`);
  }
  return data;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
  }).format(date);
}

function dayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function formatDay(key) {
  if (key === "unknown") return "Unknown date";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b1b2b] p-5 shadow-lg shadow-black/10">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

const statusStyle = {
  pending: "bg-amber-400/10 text-amber-300 ring-amber-400/25",
  approved: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25",
  rejected: "bg-red-400/10 text-red-300 ring-red-400/25",
  disabled: "bg-slate-400/10 text-slate-300 ring-slate-400/25",
};

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("users"); // "users", "companies", "fsr-config", "reports"
  const [users, setUsers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dailyCounts, setDailyCounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyUserId, setBusyUserId] = useState(null);
  const [busyNotificationId, setBusyNotificationId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("pending");

  // Password Modals state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [resettingUser, setResettingUser] = useState(null);
  const [resetPasswordVal, setResetPasswordVal] = useState("");

  // Company & Location CRUD state
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [companyForm, setCompanyForm] = useState({ name: "", address: "", contactPerson: "", email: "", mobile: "" });
  
  const [locationCompanyId, setLocationCompanyId] = useState(null);
  const [locationForm, setLocationForm] = useState({ locationName: "", address: "" });
  
  const [contactLocationTarget, setContactLocationTarget] = useState(null);
  const [contactForm, setContactForm] = useState({ name: "", designation: "", email: "", mobile: "" });

  // FSR Sequence Config state
  const [seqConfig, setSeqConfig] = useState({ year: new Date().getFullYear(), prefix: "FSR", currentNumber: 0, digits: 3 });
  const [savingSeqConfig, setSavingSeqConfig] = useState(false);

  // Paginated Reports & Filter State (10 per page)
  const [reports, setReports] = useState([]);
  const [reportPage, setReportPage] = useState(1);
  const [reportPagination, setReportPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reportsLoading, setReportsLoading] = useState(false);

  const currentUser = JSON.parse(localStorage.getItem("smartfix_user") || "null");

  const loadData = useCallback(async (showLoader = false) => {
    if (showLoader) setRefreshing(true);
    try {
      const [usersResult, notificationsResult, dailyResult, companiesResult, fsrConfigResult] = await Promise.all([
        apiRequest("/admin/users"),
        apiRequest("/admin/notifications"),
        apiRequest("/admin/notifications/daily"),
        apiRequest("/companies").catch(() => ({ companies: [] })),
        apiRequest("/admin/fsr-config").catch(() => ({ currentYearConfig: null })),
      ]);
      setUsers(usersResult.users || []);
      setNotifications(notificationsResult.notifications || []);
      setDailyCounts(dailyResult.days || []);
      setCompanies(companiesResult.companies || []);
      if (fsrConfigResult.currentYearConfig) {
        setSeqConfig(fsrConfigResult.currentYearConfig);
      }
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch paginated reports (10 per page) with Date Range Filter
  const fetchReports = useCallback(async (pageNum = 1, startD = fromDate, endD = toDate) => {
    setReportsLoading(true);
    try {
      let queryParams = `?page=${pageNum}&limit=10`;
      if (startD) queryParams += `&startDate=${startD}`;
      if (endD) queryParams += `&endDate=${endD}`;

      const res = await apiRequest(`/reports${queryParams}`);
      setReports(res.reports || []);
      if (res.pagination) {
        setReportPagination(res.pagination);
        setReportPage(res.pagination.page);
      }
    } catch (err) {
      console.error("Error loading reports:", err);
    } finally {
      setReportsLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    if (!localStorage.getItem("smartfix_auth_token") || currentUser?.role !== "admin") {
      navigate("/login", { replace: true });
      return;
    }
    loadData();
    fetchReports(1);
    const timer = window.setInterval(() => loadData(), 30000);
    return () => window.clearInterval(timer);
  }, [loadData, fetchReports, navigate]);

  function logout() {
    localStorage.removeItem("smartfix_auth_token");
    localStorage.removeItem("smartfix_user");
    navigate("/login", { replace: true });
  }

  async function updateUserStatus(user, status) {
    const id = getId(user);
    if (status === "disabled" && !window.confirm(`Disable ${user.email}? They will lose access immediately.`)) return;
    if (status === "approved" && user.status === "disabled" && !window.confirm(`Restore access for ${user.email}?`)) return;
    setBusyUserId(id);
    setError(""); setNotice("");
    try {
      await apiRequest(`/admin/users/${encodeURIComponent(id)}/status`, {
        method: "PATCH", body: JSON.stringify({ status }),
      });
      await loadData();
      setNotice(`${user.email}: ${status}.`);
    } catch (err) { setError(err.message); }
    finally { setBusyUserId(null); }
  }

  async function promoteUser(user) {
    const id = getId(user);
    if (!window.confirm(`Promote ${user.email} to admin?`)) return;
    setBusyUserId(id);
    setError(""); setNotice("");
    try {
      await apiRequest(`/admin/users/${encodeURIComponent(id)}/promote`, { method: "PATCH" });
      await loadData();
      setNotice(`${user.email} is now an admin.`);
    } catch (err) { setError(err.message); }
    finally { setBusyUserId(null); }
  }

  async function removeUser(user) {
    const id = getId(user);
    if (!window.confirm(`Permanently remove ${user.email}?`)) return;
    setBusyUserId(id);
    setError(""); setNotice("");
    try {
      await apiRequest(`/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((item) => getId(item) !== id));
      setNotice(`${user.email} was removed.`);
    } catch (err) { setError(err.message); }
    finally { setBusyUserId(null); }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    if (!resettingUser) return;
    setError(""); setNotice("");
    try {
      await apiRequest(`/admin/users/${encodeURIComponent(getId(resettingUser))}/reset-password`, {
        method: "PATCH",
        body: JSON.stringify({ newPassword: resetPasswordVal }),
      });
      setNotice(`Password reset successfully for ${resettingUser.email}.`);
      setResettingUser(null);
      setResetPasswordVal("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function createUser(event) {
    event.preventDefault();
    setError(""); setNotice("");
    try {
      await apiRequest("/admin/users", { method: "POST", body: JSON.stringify(newUser) });
      setShowCreate(false);
      setNewUser({ name: "", employeeid: "", email: "", password: "" });
      setFilter("all");
      await loadData();
      setNotice("New user created and approved.");
    } catch (err) { setError(err.message); }
  }

  async function markNotificationRead(item) {
    const id = getId(item);
    setBusyNotificationId(id);
    try {
      await apiRequest(`/admin/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => getId(n) === id ? { ...n, read: true } : n));
    } catch (err) { setError(err.message); }
    finally { setBusyNotificationId(null); }
  }

  // Company CRUD actions
  function openAddCompany() {
    setEditingCompany(null);
    setCompanyForm({ name: "", address: "", contactPerson: "", email: "", mobile: "" });
    setShowCompanyModal(true);
  }

  function openEditCompany(company) {
    setEditingCompany(company);
    setCompanyForm({
      name: company.name || "",
      address: company.address || "",
      contactPerson: company.contactPerson || "",
      email: company.email || "",
      mobile: company.mobile || "",
    });
    setShowCompanyModal(true);
  }

  async function saveCompany(event) {
    event.preventDefault();
    setError(""); setNotice("");
    try {
      if (editingCompany) {
        await apiRequest(`/companies/${encodeURIComponent(getId(editingCompany))}`, {
          method: "PUT",
          body: JSON.stringify({ ...companyForm, locations: editingCompany.locations || [] }),
        });
        setNotice(`Company "${companyForm.name}" updated.`);
      } else {
        await apiRequest("/companies", {
          method: "POST",
          body: JSON.stringify({ ...companyForm, locations: [] }),
        });
        setNotice(`Company "${companyForm.name}" created.`);
      }
      setShowCompanyModal(false);
      await loadData();
    } catch (err) { setError(err.message); }
  }

  async function deleteCompany(company) {
    if (!window.confirm(`Delete company "${company.name}"?`)) return;
    setError(""); setNotice("");
    try {
      await apiRequest(`/companies/${encodeURIComponent(getId(company))}`, { method: "DELETE" });
      setNotice(`Company "${company.name}" deleted.`);
      await loadData();
    } catch (err) { setError(err.message); }
  }

  // Location Actions
  async function addLocationToCompany(event) {
    event.preventDefault();
    if (!locationCompanyId) return;
    setError(""); setNotice("");
    try {
      await apiRequest(`/companies/${encodeURIComponent(locationCompanyId)}/locations`, {
        method: "POST",
        body: JSON.stringify(locationForm),
      });
      setNotice("Location added to company.");
      setLocationCompanyId(null);
      setLocationForm({ locationName: "", address: "" });
      await loadData();
    } catch (err) { setError(err.message); }
  }

  async function deleteLocation(companyId, locId) {
    if (!window.confirm("Delete this location?")) return;
    setError(""); setNotice("");
    try {
      await apiRequest(`/companies/${encodeURIComponent(companyId)}/locations/${encodeURIComponent(locId)}`, {
        method: "DELETE",
      });
      setNotice("Location removed.");
      await loadData();
    } catch (err) { setError(err.message); }
  }

  // Contact Person Actions
  async function addContactToLocation(event) {
    event.preventDefault();
    if (!contactLocationTarget) return;
    const { companyId, locId } = contactLocationTarget;
    const comp = companies.find((c) => getId(c) === String(companyId));
    if (!comp) return;

    const updatedLocations = (comp.locations || []).map((loc) => {
      if (String(loc._id) === String(locId)) {
        return {
          ...loc,
          contactPersons: [...(loc.contactPersons || []), contactForm],
        };
      }
      return loc;
    });

    try {
      await apiRequest(`/companies/${encodeURIComponent(companyId)}`, {
        method: "PUT",
        body: JSON.stringify({ name: comp.name, address: comp.address, contactPerson: comp.contactPerson, email: comp.email, mobile: comp.mobile, locations: updatedLocations }),
      });
      setNotice("Contact person added to location.");
      setContactLocationTarget(null);
      setContactForm({ name: "", designation: "", email: "", mobile: "" });
      await loadData();
    } catch (err) { setError(err.message); }
  }

  // FSR Sequence Config Save
  async function saveFsrConfig(event) {
    event.preventDefault();
    setSavingSeqConfig(true); setError(""); setNotice("");
    try {
      const res = await apiRequest("/admin/fsr-config", {
        method: "POST",
        body: JSON.stringify(seqConfig),
      });
      setNotice(res.message || "FSR numbering config updated.");
      await loadData();
    } catch (err) { setError(err.message); }
    finally { setSavingSeqConfig(false); }
  }

  // Date Filter Form Submit
  function handleFilterSubmit(event) {
    event.preventDefault();
    fetchReports(1, fromDate, toDate);
  }

  function handleClearFilter() {
    setFromDate("");
    setToDate("");
    fetchReports(1, "", "");
  }

  const visibleUsers = filter === "all" ? users : users.filter((user) => user.status === filter);
  const pendingCount = users.filter((user) => user.status === "pending").length;
  const approvedCount = users.filter((user) => user.status === "approved").length;
  const unreadCount = notifications.filter((item) => !item.read).length;
  const todayKey = dayKey(new Date());
  const todayLogins = dailyCounts.find((day) => day.date === todayKey)?.loginCount || 0;
  const groupedNotifications = Object.entries(
    notifications.reduce((groups, item) => {
      const key = dayKey(item.createdAt);
      (groups[key] ||= []).push(item);
      return groups;
    }, {})
  ).sort(([a], [b]) => b.localeCompare(a));
  const actionClass = "rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <main className="min-h-screen bg-[#06111d] px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-5 border-b border-white/10 pb-6">
          <div>
            <p className="text-sm font-bold tracking-[0.22em] text-[#00A0D2]">SMARTFIX AUTOMATION</p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-slate-400">System management, user access, companies & FSR reports.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard" className="rounded-xl border border-cyan-400/30 px-4 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10">Open FSR</Link>
            <button type="button" onClick={() => setShowChangePassword(true)} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm hover:bg-white/10">🔑 Change Password</button>
            <button type="button" onClick={() => { setShowCreate(true); setError(""); }} className="rounded-xl bg-[#00A0D2] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#008db9]">+ New User</button>
            <button type="button" disabled={refreshing} onClick={() => loadData(true)} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm hover:bg-white/10 disabled:opacity-50">{refreshing ? "Refreshing..." : "Refresh"}</button>
            <button type="button" onClick={logout} className="rounded-xl border border-red-400/30 px-4 py-2.5 text-sm text-red-300 hover:bg-red-400/10">Logout</button>
          </div>
        </header>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-300">{notice}</p>}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Pending requests" value={pendingCount} color="text-amber-300" />
          <StatCard label="Approved accounts" value={approvedCount} color="text-emerald-300" />
          <StatCard label="Companies Managed" value={companies.length} color="text-cyan-300" />
          <StatCard label="Total Reports Found" value={reportPagination.total} color="text-sky-300" />
        </section>

        {/* Tab Navigation */}
        <div className="mt-8 flex flex-wrap border-b border-white/10 gap-4 sm:gap-8">
          {[
            ["users", `Users & Reset Password (${users.length})`],
            ["companies", `Companies, Locations & Contacts (${companies.length})`],
            ["fsr-config", "Annual FSR Numbering Setup"],
            ["reports", `FSR Reports (${reportPagination.total})`],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`pb-3 text-sm font-bold border-b-2 transition ${
                activeTab === key ? "border-[#00A0D2] text-[#00A0D2]" : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* TAB 1: USERS & PASSWORD RESET */}
        {activeTab === "users" && (
          <div className="mt-7 grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1b2b]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5">
                <div><h2 className="text-lg font-bold">Users</h2><p className="text-sm text-slate-400">Approve, reset password, disable, or promote accounts.</p></div>
                <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter users" className="rounded-lg border border-white/15 bg-[#071421] px-3 py-2 text-sm text-white">
                  {["pending", "approved", "rejected", "disabled", "all"].map((value) => <option key={value} value={value}>{value === "all" ? "All users" : value[0].toUpperCase() + value.slice(1)}</option>)}
                </select>
              </div>
              {loading ? <p className="p-6 text-sm text-slate-400">Loading users...</p> : visibleUsers.length === 0 ? <p className="p-6 text-sm text-slate-400">No users found.</p> : (
                <div className="divide-y divide-white/10">
                  {visibleUsers.map((user) => {
                    const id = getId(user);
                    const isSelf = id === String(currentUser?.id);
                    return <article key={id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{user.name || user.email}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-xs capitalize ring-1 ${statusStyle[user.status] || statusStyle.disabled}`}>{user.status}</span>
                          <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-xs text-cyan-300">{user.role}</span>
                        </div>
                        <p className="mt-1 break-all text-sm text-slate-300">{user.email}</p>
                        <p className="mt-1 text-xs text-slate-500">Joined: {formatDate(user.createdAt)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => { setResettingUser(user); setResetPasswordVal(""); }} className={`${actionClass} border-amber-400/30 text-amber-300 hover:bg-amber-400/10`}>Reset Password</button>
                        {user.status === "pending" && <>
                          <button disabled={busyUserId === id} onClick={() => updateUserStatus(user, "rejected")} className={`${actionClass} border-red-400/30 text-red-300`}>Reject</button>
                          <button disabled={busyUserId === id} onClick={() => updateUserStatus(user, "approved")} className={`${actionClass} border-emerald-400/30 text-emerald-300`}>Approve</button>
                        </>}
                        {(user.status === "disabled" || user.status === "rejected") && <button disabled={busyUserId === id} onClick={() => updateUserStatus(user, "approved")} className={`${actionClass} border-emerald-400/30 text-emerald-300`}>Restore</button>}
                        {user.status === "disabled" && !isSelf && <button disabled={busyUserId === id} onClick={() => removeUser(user)} className={`${actionClass} border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20`}>Remove</button>}
                        {user.status === "approved" && user.role === "user" && <button disabled={busyUserId === id} onClick={() => promoteUser(user)} className={`${actionClass} border-cyan-400/30 text-cyan-300`}>Promote to admin</button>}
                        {user.status === "approved" && !isSelf && <button disabled={busyUserId === id} onClick={() => updateUserStatus(user, "disabled")} className={`${actionClass} border-red-400/30 text-red-300`}>Disable</button>}
                      </div>
                    </article>;
                  })}
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1b2b]">
              <div className="border-b border-white/10 p-5"><h2 className="text-lg font-bold">Notifications</h2><p className="text-sm text-slate-400">Daily activity in India time.</p></div>
              {loading ? <p className="p-6 text-sm text-slate-400">Loading notifications...</p> : notifications.length === 0 ? <p className="p-6 text-sm text-slate-400">No notifications yet.</p> : (
                <div className="max-h-[680px] divide-y divide-white/10 overflow-y-auto">
                  {groupedNotifications.map(([date, items]) => <div key={date}>
                    <div className="sticky top-0 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#10283c] px-5 py-3 text-xs font-semibold text-cyan-200">
                      <span>{formatDay(date)}</span>
                      <span>{dailyCounts.find((day) => day.date === date)?.loginCount ?? items.filter((item) => item.type === "user_login").length} logins</span>
                    </div>
                    {items.map((item) => <article key={getId(item)} className={`border-b border-white/10 p-5 ${item.read ? "" : "bg-cyan-400/[0.06]"}`}>
                    <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold">{item.type === "user_login" ? "User logged in" : "New signup request"}</h3>{!item.read && <span className="mt-1 h-2 w-2 rounded-full bg-[#00A0D2]" />}</div>
                    <p className="mt-1 break-words text-sm text-slate-300">{item.message || item.userEmail || "Account activity"}</p>
                    <p className="mt-2 text-xs text-slate-500">Time: {formatDate(item.createdAt)} IST</p>
                    {!item.read && <button type="button" disabled={busyNotificationId === getId(item)} onClick={() => markNotificationRead(item)} className="mt-3 text-xs font-semibold text-[#00A0D2] hover:underline disabled:opacity-50">Mark as read</button>}
                  </article>)}
                  </div>)}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: COMPANIES, LOCATIONS & CONTACT PERSONS */}
        {activeTab === "companies" && (
          <section className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1b2b] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <h2 className="text-xl font-bold">Company Master (Multiple Locations & Contacts)</h2>
                <p className="text-sm text-slate-400">Manage companies with multiple plant/office locations and distinct contact persons.</p>
              </div>
              <button type="button" onClick={openAddCompany} className="rounded-xl bg-[#00A0D2] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#008db9]">+ Add Company</button>
            </div>

            {companies.length === 0 ? (
              <p className="p-8 text-center text-slate-400">No companies created yet. Click "+ Add Company" above.</p>
            ) : (
              <div className="mt-6 space-y-6">
                {companies.map((company) => {
                  const compId = getId(company);
                  return (
                    <div key={compId} className="rounded-2xl border border-white/10 bg-[#071421] p-6 shadow-md">
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
                        <div>
                          <h3 className="text-xl font-bold text-cyan-300">{company.name}</h3>
                          {company.address && <p className="mt-1 text-xs text-slate-300"><strong>Main HQ Address:</strong> {company.address}</p>}
                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
                            {company.contactPerson && <span>👤 Primary Contact: {company.contactPerson}</span>}
                            {company.email && <span>✉️ {company.email}</span>}
                            {company.mobile && <span>📞 {company.mobile}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setLocationCompanyId(compId); setLocationForm({ locationName: "", address: "" }); }} className="rounded-lg bg-emerald-600/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-600/50">+ Add Location</button>
                          <button type="button" onClick={() => openEditCompany(company)} className="rounded-lg border border-cyan-400/30 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/10">Edit</button>
                          <button type="button" onClick={() => deleteCompany(company)} className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10">Delete</button>
                        </div>
                      </div>

                      {/* Locations & Contact Persons List */}
                      <div className="mt-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Locations & Contact Persons ({company.locations?.length || 0}):</h4>
                        {(!company.locations || company.locations.length === 0) ? (
                          <p className="mt-2 text-xs italic text-slate-500">No plant/branch locations added yet. Click "+ Add Location".</p>
                        ) : (
                          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {company.locations.map((loc) => {
                              const locId = String(loc._id);
                              return (
                                <div key={locId} className="rounded-xl border border-white/10 bg-[#0b1b2b] p-4 text-xs">
                                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                    <h5 className="font-bold text-white text-sm">📍 {loc.locationName}</h5>
                                    <button type="button" onClick={() => deleteLocation(compId, locId)} className="text-red-400 hover:underline">Remove</button>
                                  </div>
                                  {loc.address && <p className="mt-2 text-slate-300"><strong>Address:</strong> {loc.address}</p>}
                                  
                                  <div className="mt-3 border-t border-white/10 pt-2">
                                    <div className="flex items-center justify-between">
                                      <span className="font-semibold text-slate-400">Contacts ({loc.contactPersons?.length || 0}):</span>
                                      <button type="button" onClick={() => { setContactLocationTarget({ companyId: compId, locId }); setContactForm({ name: "", designation: "", email: "", mobile: "" }); }} className="text-cyan-300 hover:underline">+ Contact</button>
                                    </div>
                                    <ul className="mt-2 space-y-1">
                                      {loc.contactPersons?.map((cp, idx) => (
                                        <li key={idx} className="rounded bg-black/30 p-2 text-[0.75rem] text-slate-300">
                                          <p className="font-bold text-cyan-200">{cp.name} {cp.designation ? `(${cp.designation})` : ""}</p>
                                          <p>📞 {cp.mobile || "N/A"} | ✉️ {cp.email || "N/A"}</p>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: ANNUAL FSR NUMBERING CONFIGURATION */}
        {activeTab === "fsr-config" && (
          <section className="mt-7 max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0b1b2b] p-6">
            <h2 className="text-xl font-bold">Annual FSR Numbering Setup</h2>
            <p className="mt-1 text-sm text-slate-400">Configure auto-assigned FSR unique numbers (e.g. FSR2026-001, FSR2026-002) for the year once annually.</p>

            <form onSubmit={saveFsrConfig} className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  FSR Prefix
                  <input
                    required
                    type="text"
                    value={seqConfig.prefix}
                    onChange={(e) => setSeqConfig({ ...seqConfig, prefix: e.target.value.toUpperCase() })}
                    placeholder="FSR"
                    className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]"
                  />
                </label>

                <label className="block text-sm">
                  Year
                  <input
                    required
                    type="number"
                    value={seqConfig.year}
                    onChange={(e) => setSeqConfig({ ...seqConfig, year: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm">
                  Current Sequence Counter
                  <input
                    required
                    type="number"
                    min={0}
                    value={seqConfig.currentNumber}
                    onChange={(e) => setSeqConfig({ ...seqConfig, currentNumber: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]"
                  />
                  <span className="text-xs text-slate-400">Next report assigned: {seqConfig.prefix}{seqConfig.year}-{String(seqConfig.currentNumber + 1).padStart(seqConfig.digits || 3, "0")}</span>
                </label>

                <label className="block text-sm">
                  Zero Padding Digits
                  <input
                    required
                    type="number"
                    min={1}
                    max={6}
                    value={seqConfig.digits}
                    onChange={(e) => setSeqConfig({ ...seqConfig, digits: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]"
                  />
                </label>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={savingSeqConfig}
                  className="rounded-xl bg-[#00A0D2] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#008db9] disabled:opacity-50"
                >
                  {savingSeqConfig ? "Saving Config..." : "Save Annual Numbering Config"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* TAB 4: ADMIN REPORT LIST WITH DATE RANGE FILTER & PAGINATION (10 PER PAGE) */}
        {activeTab === "reports" && (
          <section className="mt-7 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1b2b] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <h2 className="text-xl font-bold">Admin FSR Reports List</h2>
                <p className="text-sm text-slate-400">View and inspect submitted Field Service Reports with PDF files (10 per page).</p>
              </div>

              {/* Custom From Date / To Date Filter Form */}
              <form onSubmit={handleFilterSubmit} className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">From Date:</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="rounded-lg border border-white/20 bg-[#071421] px-3 py-1.5 text-xs text-white outline-none"
                  />
                </label>

                <label className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">To Date:</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="rounded-lg border border-white/20 bg-[#071421] px-3 py-1.5 text-xs text-white outline-none"
                  />
                </label>

                <button
                  type="submit"
                  className="rounded-lg bg-[#00A0D2] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#008db9]"
                >
                  Filter
                </button>

                {(fromDate || toDate) && (
                  <button
                    type="button"
                    onClick={handleClearFilter}
                    className="rounded-lg border border-white/20 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
                  >
                    Clear Filter
                  </button>
                )}
              </form>
            </div>

            {reportsLoading ? (
              <p className="p-8 text-center text-slate-400">Loading reports...</p>
            ) : reports.length === 0 ? (
              <p className="p-8 text-center text-slate-400">No FSR reports found for the selected date range.</p>
            ) : (
              <>
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/10 bg-[#071421] text-slate-300">
                      <tr>
                        <th className="p-3">FSR Number</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Company Name</th>
                        <th className="p-3">Contact Person</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Engineer ID</th>
                        <th className="p-3">Engineer Name</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {reports.map((rep) => {
                        const pdfPath = rep.pdfUrl ? `${API_BASE.replace(/\/api$/, "")}${rep.pdfUrl}` : null;
                        return (
                          <tr key={getId(rep)} className="hover:bg-white/[0.02]">
                            <td className="p-3 font-bold text-cyan-300">{rep.fsrNo}</td>
                            <td className="p-3">{rep.date || formatDate(rep.createdAt)}</td>
                            <td className="p-3 font-semibold">{rep.customerName || "—"}</td>
                            <td className="p-3">{rep.contactPerson || "—"}</td>
                            <td className="p-3"><span className="rounded bg-sky-500/10 px-2 py-0.5 text-sky-300">{rep.callStatus}</span></td>
                            <td className="p-3 uppercase">{rep.engineerId || "—"}</td>
                            <td className="p-3 font-medium text-slate-200">{rep.engineerName || "—"}</td>
                            <td className="p-3 text-right">
                              {pdfPath ? (
                                <a
                                  href={pdfPath}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/30 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-400/10"
                                >
                                  📄 View PDF
                                </a>
                              ) : (
                                <span className="text-slate-500 italic">PDF Unavailable</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls (10 items per page) */}
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs">
                  <span className="text-slate-400">
                    Showing Page <strong>{reportPagination.page}</strong> of <strong>{reportPagination.totalPages}</strong> (Total {reportPagination.total} reports)
                  </span>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={reportPage <= 1}
                      onClick={() => fetchReports(reportPage - 1)}
                      className="rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      disabled={reportPage >= reportPagination.totalPages}
                      onClick={() => fetchReports(reportPage + 1)}
                      className="rounded-lg border border-white/20 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </div>

      {/* User Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1b2b] p-6 shadow-2xl">
            <h2 className="text-xl font-bold">Create User</h2>
            
            <form onSubmit={createUser} className="mt-5 space-y-4">
              {[ ["Name", "name", "text"], ["Employee ID", "employeeid", "text"], ["Email", "email", "email"], ["Initial Password", "password", "password"] ].map(([label, field, type]) =>
                <label key={field} className="block text-sm">{label}
                  <input required type={type} minLength={field === "password" ? 8 : undefined} autoComplete="off" value={newUser[field]} onChange={(e) => setNewUser({ ...newUser, [field]: e.target.value })} className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]" />
                </label>
              )}
              {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-white/20 px-4 py-2 text-sm">Cancel</button>
                <button type="submit" className="rounded-lg bg-[#00A0D2] px-4 py-2 text-sm font-semibold">Create User</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset User Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1b2b] p-6 shadow-2xl">
            <h2 className="text-xl font-bold">Reset Password</h2>
            <p className="mt-1 text-sm text-slate-400">Reset password for <strong>{resettingUser.email}</strong>.</p>
            <form onSubmit={handleResetPassword} className="mt-5 space-y-4">
              <label className="block text-sm">
                New Temporary Password (min 8 chars) *
                <input
                  required
                  type="password"
                  minLength={8}
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]"
                />
              </label>
              {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setResettingUser(null)} className="rounded-lg border border-white/20 px-4 py-2 text-sm">Cancel</button>
                <button type="submit" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950">Reset Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal (Self) */}
      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}

      {/* Company Add/Edit Modal */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b1b2b] p-6 shadow-2xl">
            <h2 className="text-xl font-bold">{editingCompany ? "Edit Company Details" : "Add New Company"}</h2>
            <form onSubmit={saveCompany} className="mt-5 space-y-4">
              <label className="block text-sm">
                Company Name *
                <input required type="text" value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]" />
              </label>
              <label className="block text-sm">
                Headquarters Address
                <textarea rows={2} value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  Primary Contact Person
                  <input type="text" value={companyForm.contactPerson} onChange={(e) => setCompanyForm({ ...companyForm, contactPerson: e.target.value })} className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]" />
                </label>
                <label className="block text-sm">
                  Mobile / Phone
                  <input type="text" value={companyForm.mobile} onChange={(e) => setCompanyForm({ ...companyForm, mobile: e.target.value })} className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]" />
                </label>
              </div>
              <label className="block text-sm">
                Email
                <input type="email" value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })} className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]" />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCompanyModal(false)} className="rounded-lg border border-white/20 px-4 py-2 text-sm">Cancel</button>
                <button type="submit" className="rounded-lg bg-[#00A0D2] px-5 py-2 text-sm font-semibold">{editingCompany ? "Update" : "Create"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Location Modal */}
      {locationCompanyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1b2b] p-6 shadow-2xl">
            <h2 className="text-xl font-bold">Add Plant / Branch Location</h2>
            <form onSubmit={addLocationToCompany} className="mt-5 space-y-4">
              <label className="block text-sm">
                Location Name (e.g. Plant 2 - Hosur) *
                <input required type="text" value={locationForm.locationName} onChange={(e) => setLocationForm({ ...locationForm, locationName: e.target.value })} className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]" />
              </label>
              <label className="block text-sm">
                Address
                <textarea rows={2} value={locationForm.address} onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })} className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]" />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setLocationCompanyId(null)} className="rounded-lg border border-white/20 px-4 py-2 text-sm">Cancel</button>
                <button type="submit" className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold">Save Location</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Contact Person Modal */}
      {contactLocationTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1b2b] p-6 shadow-2xl">
            <h2 className="text-xl font-bold">Add Contact Person to Location</h2>
            <form onSubmit={addContactToLocation} className="mt-5 space-y-4">
              <label className="block text-sm">
                Contact Person Name *
                <input required type="text" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]" />
              </label>
              <label className="block text-sm">
                Designation / Role
                <input type="text" value={contactForm.designation} onChange={(e) => setContactForm({ ...contactForm, designation: e.target.value })} placeholder="e.g. Plant Manager" className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  Mobile
                  <input type="text" value={contactForm.mobile} onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })} className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]" />
                </label>
                <label className="block text-sm">
                  Email
                  <input type="email" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]" />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setContactLocationTarget(null)} className="rounded-lg border border-white/20 px-4 py-2 text-sm">Cancel</button>
                <button type="submit" className="rounded-lg bg-cyan-600 px-5 py-2 text-sm font-semibold">Save Contact</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
