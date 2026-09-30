import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import SendMailForm from "../components/SendMailForm";

const API_BASE = import.meta.env.VITE_API_URL.replace(/\/$/, "");

export default function SendMailPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const reportState = location.state || {};
  const { to = "", cc = "", subject = "",  message = "" } = reportState;

  async function handleSendEmail(formData) {
    const token = localStorage.getItem("smartfix_auth_token");
    const response = await fetch(`${API_BASE}/mail/send`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Could not send email.");
    }
    return data;
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8 text-slate-800">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Email Field Service Report</h1>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ← Back to Report
          </button>
        </div>

        <SendMailForm
          onSend={handleSendEmail}
          initialValues={{
            to: to || "",
            cc: cc || "",
            bcc: "",
            subject: subject || "Field Service Report Summary",
            message: message || "Please find attached field service report details.",
          }}
        />
      </div>
    </div>
  );
}
