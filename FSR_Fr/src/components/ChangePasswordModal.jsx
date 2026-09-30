import { useState } from "react";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export default function ChangePasswordModal({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem("smartfix_auth_token");
      const response = await fetch(`${API_BASE}/auth/change-password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Could not change password.");
      }

      setSuccess("Password updated successfully!");
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1b2b] p-6 text-white shadow-2xl">
        <h2 className="text-xl font-bold">Change Password</h2>
        <p className="mt-1 text-sm text-slate-400">Update your account login password.</p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block text-sm">
            Current Password *
            <input
              required
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]"
            />
          </label>

          <label className="block text-sm">
            New Password (min 8 characters) *
            <input
              required
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]"
            />
          </label>

          <label className="block text-sm">
            Confirm New Password *
            <input
              required
              type="password"
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/20 bg-[#071421] px-3 py-2 text-white outline-none focus:border-[#00A0D2]"
            />
          </label>

          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          {success && <p role="status" className="text-sm text-emerald-300">{success}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#00A0D2] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
