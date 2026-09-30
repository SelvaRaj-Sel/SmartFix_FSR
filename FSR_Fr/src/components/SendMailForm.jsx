import { useState } from "react";

const initialValues = {
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  message: "",
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const splitAddresses = (value) =>
  value.split(/[;,]/).map((address) => address.trim()).filter(Boolean);

/**
 * Standalone mail UI. Provide onSend(formData) to connect your backend.
 * Backend fields: to, cc, bcc (JSON arrays), subject, message, attachments (files).
 */
export default function SendMailForm({ onSend, initialValues: propInitialValues, initialAttachments = [] }) {
  const defaultValues = {
    to: propInitialValues?.to || "",
    cc: propInitialValues?.cc || "",
    bcc: propInitialValues?.bcc || "",
    subject: propInitialValues?.subject || "",
    message: propInitialValues?.message || "",
  };
  const [values, setValues] = useState(defaultValues);
  const [attachments, setAttachments] = useState(initialAttachments || []);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fileKey, setFileKey] = useState(0);

  const update = (event) => {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const to = splitAddresses(values.to);
    const cc = splitAddresses(values.cc);
    const bcc = splitAddresses(values.bcc);
    if (!to.length || ![...to, ...cc, ...bcc].every((address) => emailPattern.test(address))) {
      setError("Enter valid email addresses in To, CC and BCC.");
      return;
    }
    if (!onSend) {
      setError("Connect onSend to your backend email API first.");
      return;
    }

    const data = new FormData();
    data.append("to", JSON.stringify(to));
    data.append("cc", JSON.stringify(cc));
    data.append("bcc", JSON.stringify(bcc));
    data.append("subject", values.subject.trim());
    data.append("message", values.message.trim());
    attachments.forEach((file) => data.append("attachments", file));

    try {
      setSending(true);
      await onSend(data);
      setSuccess("Email sent successfully.");
      setValues(initialValues);
      setAttachments([]);
      setFileKey((previous) => previous + 1);
    } catch (err) {
      setError(err.message || "Could not send the email.");
    } finally {
      setSending(false);
    }
  }

  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100";

  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-lg sm:p-8">
      <h2 className="text-xl font-bold text-slate-900">Send Email</h2>
      <p className="mt-1 text-sm text-slate-500">Add recipients and attach files before sending.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        {[
          ["To", "to", true, "customer@example.com"],
          ["CC", "cc", false, "Optional"],
          ["BCC", "bcc", false, "Hidden from other recipients"],
          ["Subject", "subject", true, "Email subject"],
        ].map(([label, name, required, placeholder]) => (
          <label key={name} className="block text-sm font-medium text-slate-700">
            {label}{required ? " *" : ""}
            <input
              name={name}
              type="text"
              required={required}
              value={values[name]}
              onChange={update}
              placeholder={placeholder}
              className={inputClass}
            />
          </label>
        ))}
        <p className="text-xs text-slate-500">For multiple recipients, separate email addresses with commas.</p>
        <label className="block text-sm font-medium text-slate-700">
          Message *
          <textarea
            name="message"
            required
            rows={6}
            value={values.message}
            onChange={update}
            placeholder="Write your message..."
            className={inputClass}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Attach files (PDF, images, etc.)
          <input
            key={fileKey}
            type="file"
            multiple
            onChange={(event) => setAttachments(Array.from(event.target.files || []))}
            className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-sky-100 file:px-3 file:py-1 file:text-sky-800"
          />
        </label>
        {attachments.length > 0 && (
          <ul className="list-inside list-disc text-xs text-slate-600">
            {attachments.map((file, index) => <li key={`${file.name}-${index}`}>{file.name}</li>)}
          </ul>
        )}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {success && <p role="status" className="text-sm text-green-700">{success}</p>}
        <div className="flex justify-end pt-2">
          <button type="submit" disabled={sending} className="rounded-lg bg-sky-700 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60">
            {sending ? "Sending..." : "Send Email"}
          </button>
        </div>
      </form>
    </section>
  );
}
