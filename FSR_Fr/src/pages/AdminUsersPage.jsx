import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

const API_BASE = (import.meta.env.VITE_API_URL).replace(/\/$/, "");
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
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dailyCounts, setDailyCounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyUserId, setBusyUserId] = useState(null);
  const [busyNotificationId, setBusyNotificationId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("pending");
  const currentUser = JSON.parse(localStorage.getItem("smartfix_user") || "null");

  const loadData = useCallback(async (showLoader = false) => {
    if (showLoader) setRefreshing(true);
    try {
      const [usersResult, notificationsResult, dailyResult] = await Promise.all([
        apiRequest("/admin/users"),
        apiRequest("/admin/notifications"),
        apiRequest("/admin/notifications/daily"),
      ]);
      setUsers(usersResult.users || []);
      setNotifications(notificationsResult.notifications || []);
      setDailyCounts(dailyResult.days || []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("smartfix_auth_token") || currentUser?.role !== "admin") {
      navigate("/login", { replace: true });
      return;
    }
    loadData();
    const timer = window.setInterval(() => loadData(), 30000);
    return () => window.clearInterval(timer);
  }, [loadData, navigate]);

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
    if (!window.confirm(`Promote ${user.email} to admin? They will be able to manage all users.`)) return;
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
    if (!window.confirm(`Permanently remove ${user.email}? This cannot be undone.`)) return;
    setBusyUserId(id);
    setError(""); setNotice("");
    try {
      await apiRequest(`/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" });
      setUsers((previous) => previous.filter((item) => getId(item) !== id));
      setNotice(`${user.email} was removed.`);
    } catch (err) { setError(err.message); }
    finally { setBusyUserId(null); }
  }

  async function createUser(event) {
    event.preventDefault();
    setCreating(true); setError(""); setNotice("");
    try {
      await apiRequest("/admin/users", { method: "POST", body: JSON.stringify(newUser) });
      setShowCreate(false);
      setNewUser({ name: "", email: "", password: "" });
      setFilter("all");
      await loadData();
      setNotice("New user created and approved.");
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  }

  async function markNotificationRead(item) {
    const id = getId(item);
    setBusyNotificationId(id);
    try {
      await apiRequest(`/admin/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
      setNotifications((previous) => previous.map((n) => getId(n) === id ? { ...n, read: true } : n));
    } catch (err) { setError(err.message); }
    finally { setBusyNotificationId(null); }
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
            <p className="mt-1 text-sm text-slate-400">Manage accounts and access requests.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/dashboard" className="rounded-xl border border-cyan-400/30 px-4 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10">Open FSR</Link>
            <button type="button" onClick={() => { setShowCreate(true); setError(""); }} className="rounded-xl bg-[#00A0D2] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#008db9]">+ New user</button>
            <button type="button" disabled={refreshing} onClick={() => loadData(true)} className="rounded-xl border border-white/20 px-4 py-2.5 text-sm hover:bg-white/10 disabled:opacity-50">{refreshing ? "Refreshing..." : "Refresh"}</button>
            <button type="button" onClick={logout} className="rounded-xl border border-red-400/30 px-4 py-2.5 text-sm text-red-300 hover:bg-red-400/10">Logout</button>
          </div>
        </header>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-300">{error}</p>}
        {notice && <p role="status" className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-300">{notice}</p>}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Pending requests" value={pendingCount} color="text-amber-300" />
          <StatCard label="Approved accounts" value={approvedCount} color="text-emerald-300" />
          <StatCard label="Unread notifications" value={unreadCount} color="text-cyan-300" />
          <StatCard label="Logins today (IST)" value={todayLogins} color="text-sky-300" />
        </section>

        <div className="mt-7 grid items-start gap-6 xl:grid-cols-[1.5fr_1fr]">
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1b2b]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5">
              <div><h2 className="text-lg font-bold">Users</h2><p className="text-sm text-slate-400">Approve, disable, or promote accounts.</p></div>
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
            <div className="border-b border-white/10 p-5"><h2 className="text-lg font-bold">Notifications</h2><p className="text-sm text-slate-400">Daily login counts and activity in India time.</p></div>
            {loading ? <p className="p-6 text-sm text-slate-400">Loading notifications...</p> : notifications.length === 0 ? <p className="p-6 text-sm text-slate-400">No notifications yet.</p> : (
              <div className="max-h-[680px] divide-y divide-white/10 overflow-y-auto">
                {groupedNotifications.map(([date, items]) => <div key={date}>
                  <div className="sticky top-0 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#10283c] px-5 py-3 text-xs font-semibold text-cyan-200">
                    <span>{formatDay(date)}</span>
                    <span>{dailyCounts.find((day) => day.date === date)?.loginCount ?? items.filter((item) => item.type === "user_login").length} logins · {dailyCounts.find((day) => day.date === date)?.signupCount ?? items.filter((item) => item.type === "signup_request").length} signups</span>
                  </div>
                  {items.map((item) => <article key={getId(item)} className={`border-b border-white/10 p-5 ${item.read ? "" : "bg-cyan-400/[0.06]"}`}>
                  <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold">{item.type === "user_login" ? "User logged in" : "New signup request"}</h3>{!item.read && <span className="mt-1 h-2 w-2 rounded-full bg-[#00A0D2]" />}</div>
                  <p className="mt-1 break-words text-sm text-slate-300">{item.message || item.userEmail || "Account activity"}</p>
                  <p className="mt-2 text-xs text-slate-500">Login / request time: {formatDate(item.createdAt)} IST</p>
                  {!item.read && <button type="button" disabled={busyNotificationId === getId(item)} onClick={() => markNotificationRead(item)} className="mt-3 text-xs font-semibold text-[#00A0D2] hover:underline disabled:opacity-50">Mark as read</button>}
                </article>)}
                </div>)}
              </div>
            )}
          </section>
        </div>
      </div>

      {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div role="dialog" aria-modal="true" aria-labelledby="create-user-title" className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1b2b] p-6 shadow-2xl">
          <h2 id="create-user-title" className="text-xl font-bold">Create user</h2>
          <p className="mt-1 text-sm text-slate-400">This user is approved immediately. Share the password privately.</p>
          <form onSubmit={createUser} className="mt-5 space-y-4">
            {[ ["Name", "name", "text"], ["Email", "email", "email"], ["Temporary password", "password", "password"] ].map(([label, field, type]) =>
              <label key={field} className="block text-sm">{label}
                <input required type={type} minLength={field === "password" ? 8 : undefined} autoComplete="off" value={newUser[field]} onChange={(event) => setNewUser((previous) => ({ ...previous, [field]: event.target.value }))} className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]" />
              </label>
            )}
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" disabled={creating} onClick={() => setShowCreate(false)} className="rounded-lg border border-white/20 px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={creating} className="rounded-lg bg-[#00A0D2] px-4 py-2 text-sm font-semibold disabled:opacity-50">{creating ? "Creating..." : "Create user"}</button>
            </div>
          </form>
        </div>
      </div>}
    </main>
  );
}
