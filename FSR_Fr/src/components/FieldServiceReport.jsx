import { useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import icon from "../assets/logo.png"

const initialForm = {
  fsrNo: "",
  refNo: "",
  date: "",
  startDate: "",
  endDate: "",
  visitType: "chargeable",
  category: "service",

  // Displayed on the form, excluded from backend submission.
  customerName: "",
  customerAddress: "",
  contactPerson: "",
  mobile: "",

  customerIssue: "",
  rootCause: "",
  action: "",
  callStatus: "completed",
  spareDetails: "",
  customerFeedback: "",
  persons: "",
  workingDays: "",
  overtimeHours: "",
  extraManDays: "",
  totalManDays: "",
  payableDays: "",
  customerRemarks: "",
  engineerRemarks: "",
  customerSignName: "",
  customerSignDate: "",
  engineerName: "",
  engineerSignDate: "",
};

const visitTypes = [
  { value: "chargeable", label: "CHARGEABLE" },
  { value: "non-chargeable", label: "NON CHARGEABLE" },
];

const categories = [
  { value: "service", label: "SERVICE" },
  { value: "emc", label: "EMC" },
  { value: "project", label: "PROJECT" },
  { value: "warranty", label: "WARRANTY" },
  { value: "demo-training", label: "DEMO / TRAINING" },
  { value: "system-study", label: "SYSTEM STUDY" },
];

const callStatuses = [
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "spare-required", label: "Spare Required" },
];

const feedbackOptions = [
  "Extremely Satisfied",
  "Satisfied",
  "Dissatisfied",
];

const inputClass =
  "w-full min-w-0 bg-transparent px-2 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:bg-sky-50";
const labelClass = "text-xs font-medium text-slate-600";
const cellClass = "border border-slate-500";

function TextField({ label, name, value, onChange, type = "text" }) {
  return (
    <label className="flex min-w-0 items-center gap-2 px-2 py-1">
      <span className={`${labelClass} shrink-0`}>{label}:</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        className={inputClass}
      />
    </label>
  );
}

function ReportTextArea({ label, name, value, onChange, bullet = false }) {
  const textareaRef = useRef(null);

  useLayoutEffect(() => {
    if (!bullet || !textareaRef.current) return;
    const textarea = textareaRef.current;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(180, textarea.scrollHeight)}px`;
  }, [value, bullet]);

  function handleKeyDown(event) {
    if (!bullet || event.key !== "Enter") return;
    event.preventDefault();
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextValue = `${value.slice(0, start)}\n• ${value.slice(end)}`;
    onChange({ target: { name, value: nextValue } });
    requestAnimationFrame(() => {
      textarea.setSelectionRange(start + 3, start + 3);
    });
  }

  function handlePaste(event) {
    if (!bullet) return;
    const pasted = event.clipboardData.getData("text");
    if (!pasted.includes("\n")) return;
    event.preventDefault();
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const normalized = pasted.split(/\r?\n/).map((line, i) =>
      i === 0 ? line : `• ${line.replace(/^\s*[•*-]\s*/, "")}`
    ).join("\n");
    onChange({ target: { name, value: value.slice(0, start) + normalized + value.slice(end) } });
    requestAnimationFrame(() => textarea.setSelectionRange(start + normalized.length, start + normalized.length));
  }

  return (
    <div className={`report-text-row grid grid-cols-1 sm:grid-cols-[175px_1fr] ${cellClass}`}>
      <label
        htmlFor={name}
        className="px-3 py-2 text-xs font-medium text-slate-600"
      >
        {label}:
      </label>
      <textarea
        ref={textareaRef}
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        onFocus={bullet && !value ? () => onChange({ target: { name, value: "• " } }) : undefined}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className={`w-full bg-transparent px-3 py-1 text-sm leading-7 text-slate-800 outline-none focus:bg-sky-50 ${bullet ? "min-h-[180px] resize-none overflow-hidden" : "min-h-36 resize-y"}`}
      />
      <div className="print-text hidden whitespace-pre-wrap break-words px-3 py-2 text-xs leading-6">
        {value || " "}
      </div>
    </div>
  );
}

function SignaturePad({ label, onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  function position(event) {
    const canvas = canvasRef.current;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * canvas.width / bounds.width,
      y: (event.clientY - bounds.top) * canvas.height / bounds.height,
    };
  }

  function start(event) {
    event.preventDefault();
    const canvas = canvasRef.current;
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const context = canvas.getContext("2d");
    const { x, y } = position(event);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 0.1, y + 0.1);
    context.strokeStyle = "#0f172a";
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
  }

  function move(event) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const context = canvasRef.current.getContext("2d");
    const { x, y } = position(event);
    context.lineTo(x, y);
    context.stroke();
  }

  function finish() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  }

  return (
    <div className="signature-block border-t border-slate-500 px-2 py-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">{label}</span>
        <button type="button" onClick={clear} className="print-hide text-sky-700 underline">Clear</button>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={160}
        aria-label={`${label}: draw your signature`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        className="mt-2 h-24 w-full touch-none rounded border border-slate-300 bg-white cursor-crosshair"
      />
    </div>
  );
}

export default function FieldServiceReport({ onSubmitReport }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [customerSignature, setCustomerSignature] = useState("");
  const [engineerSignature, setEngineerSignature] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    // Customer details remain visible on the form but are not sent to the API.
    const {
      customerName,
      customerAddress,
      contactPerson,
      mobile,
      ...reportData
    } = form;

    try {
      setSubmitting(true);

      if (!onSubmitReport) {
        throw new Error(
          "Connect onSubmitReport to your backend before submitting."
        );
      }

      await onSubmitReport({ ...reportData, customerSignature, engineerSignature });
      setMessage("Report submitted successfully.");
    } catch (error) {
      setMessage(error.message || "Unable to submit the report.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleDownload() {
    // In the browser print dialog, choose “Save as PDF”.
    window.print();
  }

  function handleLogout() {
    localStorage.removeItem("smartfix_auth_token");
    localStorage.removeItem("smartfix_user");
    navigate("/login", { replace: true });
  }

  let isAdmin = false;
  try {
    isAdmin = JSON.parse(localStorage.getItem("smartfix_user") || "null")?.role === "admin";
  } catch {
    // Ignore malformed local user data; backend controls admin permissions.
  }

  return (
    <div className="report-page min-h-screen bg-slate-100 px-3 text-slate-800 sm:px-6">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 1mm 5mm 10mm;
            @bottom-right {
              content: "Page " counter(page) " of " counter(pages);
              font: 10px Arial, sans-serif;
              color: #475569;
            }
          }

          body {
            margin: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .report-page {
            box-sizing: border-box;
            width: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white;
          }

          .print-hide {
            display: none !important;
          }

          .print-report {
            box-sizing: border-box;
            width: 200mm !important;
            max-width: 200mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
          }

          .print-report textarea {
            resize: none !important;
            field-sizing: content;
            height: auto !important;
            white-space: pre-wrap;
            overflow: visible !important;
          }

          /* A fixed element repeats on every printed sheet. */
          .report-page::before {
            content: "";
            position: fixed;
            inset: 0;
            border: 1px solid #475569;
            pointer-events: none;
          }

          .print-report > div:first-child {
            border: 0 !important;
          }

          .report-text-row textarea { display: none !important; }
          .report-text-row .print-text { display: block !important; }

          /* Keep the compact columns on A4, below desktop breakpoints. */
          .report-columns {
            grid-template-columns: 1.55fr 1fr !important;
          }

          .report-company {
            grid-template-columns: 120px 1fr !important;
            border-right: 1px solid #475569;
          }

          .report-logo {
            padding: 8px !important;
            border-bottom: 0 !important;
            border-right: 1px solid #475569;
          }

          .report-text-row {
            display: block !important;
            overflow: visible !important;
          }

          .report-text-row > label {
            float: left;
            box-sizing: border-box;
            width: 40mm;
          }

          .report-text-row .print-text {
            margin-left: 40mm;
            min-height: 30mm;
            border-left: 1px solid #64748b;
          }

          .report-signatures {
            grid-template-columns: 1fr 1fr !important;
          }

          .report-billing {
            min-width: 0 !important;
            grid-template-columns: 85px repeat(6, minmax(0, 1fr)) !important;
          }

          .print-report input:not([type="radio"]) {
            padding-top: 3px;
            padding-bottom: 3px;
          }

          .print-report textarea { font-size: 12px; }
          .report-signatures, .signature-block, .report-billing {
            break-inside: avoid;
          }
          .signature-block canvas {
            print-color-adjust: exact;
          }

          input,
          textarea {
            color: #111827 !important;
          }
        }
      `}</style>

      <header className="print-hide mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 py-4">
        
       {isAdmin && (
            <Link to="/admin" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Admin dashboard
            </Link>
          )}
          <button type="button" onClick={handleLogout} className="rounded-lg bg-[#06111d] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Logout
          </button>
      </header>

      <form
        onSubmit={handleSubmit}
        className="print-report mx-auto max-w-5xl bg-white p-3 shadow-xl sm:p-6"
      >
        <div className="border border-slate-600">
          {/* Report title */}
          <h1 className="border-b border-slate-600  text-center text-base font-bold tracking-wide sm:text-lg">
            FIELD SERVICE REPORT
          </h1>

          {/* Header */}
          <div className="report-columns grid lg:grid-cols-[1.55fr_1fr]">
            <div className="report-company grid border-b border-slate-600 lg:grid-cols-[190px_1fr] lg:border-r">
              <div className="report-logo flex items-center justify-center border-b border-slate-600 px-4 lg:border-b-0 lg:border-r">
                <div className="text-center">
                  <img src={icon}/>
                  <p className="font-semibold text-end text-[0.7rem] tracking-wider text-slate-500">Automation</p>
                </div>
              </div>

              <div className="space-y-0.5 px-3 py-2 text-xs leading-5 text-slate-600">
                <p className="font-bold text-slate-800">SMARTFIX AUTOMATION</p>
                <p>No. 5/12, Chetty Street, Poonamallee,</p>
                <p>Chennai, Tamil Nadu - 600056.</p>
                <p>Email: csm@smartfixautomation.com</p>
                <p>Mob: +91 9894 571 542</p>
              </div>
            </div>

            <div className="grid grid-cols-2 border-b border-slate-600">
              {[
                ["FSR No", "fsrNo", "text"],
                ["Date", "date", "date"],
                ["Ref No", "refNo", "text"],
                ["Start Date", "startDate", "date"],
                ["End Date", "endDate", "date"],
              ].map(([label, name, type]) => (
                <div key={name} className={cellClass}>
                  <TextField
                    label={label}
                    name={name}
                    type={type}
                    value={form[name]}
                    onChange={handleChange}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Customer and visit details */}
          <div className="report-columns grid lg:grid-cols-[1.55fr_1fr]">
            <div className="border-b border-slate-600 lg:border-r">
              <div className="border-b border-slate-500">
                <div className="px-3 pt-2 text-xs font-bold">
                  CUSTOMER DETAILS:
                </div>
                <input
                  name="customerName"
                  value={form.customerName}
                  onChange={handleChange}
                  placeholder="Customer / company name"
                  className={`${inputClass} px-3`}
                />
                <textarea
                  name="customerAddress"
                  value={form.customerAddress}
                  onChange={handleChange}
                  placeholder="Customer address"
                  rows={2}
                  className="w-full resize-y px-3 py-1 text-sm outline-none placeholder:text-slate-400 focus:bg-sky-50"
                />
              </div>
              <div className="border-b border-slate-500">
                <TextField
                  label="Contact Person Name"
                  name="contactPerson"
                  value={form.contactPerson}
                  onChange={handleChange}
                />
              </div>
              <TextField
                label="Mobile"
                name="mobile"
                type="tel"
                value={form.mobile}
                onChange={handleChange}
              />
            </div>

            <div className="grid gap-0 border-b border-slate-600">
              <fieldset className="border-b border-slate-500 p-3">
                <legend className="px-1 py-1 text-xs font-bold">VISIT TYPE</legend>
                <div className="grid grid-cols-2 gap-2">
                  {visitTypes.map((item) => (
                    <label
                      key={item.value}
                      className="flex items-center gap-2 text-xs"
                    >
                      <input
                        type="radio"
                        name="visitType"
                        value={item.value}
                        checked={form.visitType === item.value}
                        onChange={handleChange}
                        className="accent-sky-600"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="p-3">
                <legend className="px-1 text-xs font-bold">CATEGORY</legend>
                <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                  {categories.map((item) => (
                    <label
                      key={item.value}
                      className="flex items-center gap-2 text-xs"
                    >
                      <input
                        type="radio"
                        name="category"
                        value={item.value}
                        checked={form.category === item.value}
                        onChange={handleChange}
                        className="accent-sky-600"
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>

          {/* Main report */}
          <ReportTextArea
            label="Customer Issue"
            name="customerIssue"
            value={form.customerIssue}
            onChange={handleChange}
            bullet
            
          />
          
          <ReportTextArea
            label="Action"
            name="action"
            value={form.action}
            onChange={handleChange}
            bullet
          />

          {/* Status */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border border-slate-500 px-3 py-2">
            <span className={labelClass}>Call Status:</span>
            {callStatuses.map((status) => (
              <label
                key={status.value}
                className="flex items-center gap-2 text-xs"
              >
                {status.label}
                <input
                  type="radio"
                  name="callStatus"
                  value={status.value}
                  checked={form.callStatus === status.value}
                  onChange={handleChange}
                  className="accent-sky-600"
                />
              </label>
            ))}
          </div>

          <div className={cellClass}>
            <TextField
              label="Spare Details"
              name="spareDetails"
              value={form.spareDetails}
              onChange={handleChange}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border border-slate-500 px-3 py-2">
            <span className={labelClass}>Customer Feedback:</span>
            {feedbackOptions.map((option) => (
              <label key={option} className="flex items-center gap-2 text-xs">
                {option}
                <input
                  type="radio"
                  name="customerFeedback"
                  value={option}
                  checked={form.customerFeedback === option}
                  onChange={handleChange}
                  className="accent-sky-600"
                />
              </label>
            ))}
          </div>

          {/* Billing details */}
          <div className="overflow-x-auto">
            <div className="report-billing grid min-w-[760px] grid-cols-[110px_repeat(6,minmax(100px,1fr))] text-center text-xs">
              <div className={`${cellClass} flex items-center justify-center font-semibold`}>
                Billing Details
              </div>

              {[
                ["No. of Persons", "persons"],
                ["Total No. of Working Days", "workingDays"],
                ["Over Time (Hrs)", "overtimeHours"],
                ["Extra MAN Days (Over Time)", "extraManDays"],
                ["Total No. of MAN Days", "totalManDays"],
                ["Total No. of Payable Days", "payableDays"],
              ].map(([label, name]) => (
                <label key={name} className={`${cellClass} flex flex-col`}>
                  <span className="flex min-h-12 items-center justify-center border-b border-slate-500 px-1 py-1">
                    {label}
                  </span>
                  <input
                    name={name}
                    type="number"
                    min="0"
                    step="any"
                    value={form[name]}
                    onChange={handleChange}
                    className="w-full px-2 py-2 text-center outline-none focus:bg-sky-50"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Remarks and signatures */}
          <div className="report-signatures grid md:grid-cols-2">
            <div className="border border-slate-500 md:border-r-0">
              <label
                htmlFor="customerRemarks"
                className="block px-2 py-1 text-xs font-bold"
              >
                Customer Remarks:
              </label>
              <textarea
                id="customerRemarks"
                name="customerRemarks"
                value={form.customerRemarks}
                onChange={handleChange}
                className="min-h-28 w-full resize-y px-2 text-sm leading-7 outline-none focus:bg-sky-50"
              />
              <div className="grid grid-cols-2 border-t border-slate-500">
                <TextField
                  label="Name"
                  name="customerSignName"
                  value={form.customerSignName}
                  onChange={handleChange}
                />
                <TextField
                  label="Date"
                  name="customerSignDate"
                  type="date"
                  value={form.customerSignDate}
                  onChange={handleChange}
                />
              </div>
              <SignaturePad label="Customer Signature & Seal" onChange={setCustomerSignature} />
            </div>

            <div className="border border-slate-500">
              <label
                htmlFor="engineerRemarks"
                className="block px-2 py-1 text-xs font-bold"
              >
                Engineer&apos;s Remarks:
              </label>
              <textarea
                id="engineerRemarks"
                name="engineerRemarks"
                value={form.engineerRemarks}
                onChange={handleChange}
                className="min-h-28 w-full resize-y px-2 text-sm leading-7 outline-none focus:bg-sky-50"
              />
              <div className="grid grid-cols-2 border-t border-slate-500">
                <TextField
                  label="Name"
                  name="engineerName"
                  value={form.engineerName}
                  onChange={handleChange}
                />
                <TextField
                  label="Date"
                  name="engineerSignDate"
                  type="date"
                  value={form.engineerSignDate}
                  onChange={handleChange}
                />
              </div>
              <SignaturePad label="Engineer Signature" onChange={setEngineerSignature} />
            </div>
          </div>
        </div>

        {/* Bottom buttons */}
        <div className="print-hide mt-6 flex flex-col justify-end gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleDownload}
            className="rounded-lg border border-sky-700 px-6 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-50"
          >
            Download PDF
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-sky-700 px-8 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit Report"}
          </button>
        </div>

        {message && (
          <p role="status" className="print-hide mt-3 text-right text-sm">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
