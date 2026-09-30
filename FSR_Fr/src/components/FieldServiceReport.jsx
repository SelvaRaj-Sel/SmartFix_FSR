import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import icon from "../assets/logo.png";
import ChangePasswordModal from "./ChangePasswordModal";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export default function FieldServiceReport({ onSubmitReport }) {
  const navigate = useNavigate();

  // Read logged-in engineer details from localStorage
  const currentUser = JSON.parse(localStorage.getItem("smartfix_user") || "null");
  console.log(currentUser)
  const defaultEngineerName = currentUser?.name || currentUser?.username || currentUser?.email || "";
  const defaultEngineerId = currentUser?.employeeid;
  const pdfPageRef = useRef(null);

  const initialForm = {
    fsrNo: "",
    refNo: "",
    date: new Date().toISOString().split("T")[0],
    startDate: "",
    endDate: "",
    visitType: "chargeable",
    category: "service",

    companyId: "",
    locationName: "",
    customerName: "",
    customerAddress: "",
    contactPerson: "",
    mobile: "",
    customerEmail: "",

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
    engineerName: defaultEngineerName,
    engineerId: defaultEngineerId,
    engineerSignDate: new Date().toISOString().split("T")[0],
  };

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [customerSignature, setCustomerSignature] = useState("");
  const [engineerSignature, setEngineerSignature] = useState("");

  const [nextFsrNo, setNextFsrNo] = useState("");
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");

  const [showChangePassword, setShowChangePassword] = useState(false);

  // Fetch next FSR number preview & saved companies
  useEffect(() => {
    async function loadInitialData() {
      const token = localStorage.getItem("smartfix_auth_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      try {
        const [nextRes, compRes] = await Promise.all([
          fetch(`${API_BASE}/reports/next-number`, { headers }).then((r) => r.json()).catch(() => ({})),
          fetch(`${API_BASE}/companies`, { headers }).then((r) => r.json()).catch(() => ({})),
        ]);

        if (nextRes.nextFsrNo) {
          setNextFsrNo(nextRes.nextFsrNo);
          setForm((prev) => ({ ...prev, fsrNo: nextRes.nextFsrNo }));
        }

        if (compRes.companies) {
          setCompanies(compRes.companies);
        }
      } catch (e) {
        console.error("Could not load initial FSR data", e);
      }
    }
    loadInitialData();
  }, []);

  // Hierarchical Selectors logic
  function handleSelectCompany(companyId) {
    setSelectedCompanyId(companyId);
    setSelectedLocationId("");
    setSelectedContactId("");
    if (!companyId) {
      setForm((prev) => ({ ...prev, companyId: "", customerName: "", locationName: "", customerAddress: "", contactPerson: "", mobile: "", customerEmail: "" }));
      return;
    }

    const comp = companies.find((c) => String(c.id || c._id) === String(companyId));
    if (comp) {
      setForm((prev) => ({
        ...prev,
        companyId: comp._id || comp.id,
        customerName: comp.name || "",
        customerAddress: comp.address || "",
        contactPerson: comp.contactPerson || "",
        mobile: comp.mobile || "",
        customerEmail: comp.email || "",
        locationName: "",
      }));
    }
  }

  function handleSelectLocation(locId) {
    setSelectedLocationId(locId);
    setSelectedContactId("");
    if (!locId) {
      setForm((prev) => ({ ...prev, locationName: "", contactPerson: "", mobile: "", customerEmail: "" }));
      return;
    }

    const comp = companies.find((c) => String(c.id || c._id) === String(selectedCompanyId));
    if (comp && comp.locations) {
      const loc = comp.locations.find((l) => String(l._id) === String(locId));
      if (loc) {
        setForm((prev) => ({
          ...prev,
          locationName: loc.locationName || "",
          customerAddress: loc.address || prev.customerAddress,
        }));
      }
    }
  }

  function handleSelectContact(contactId) {
    setSelectedContactId(contactId);
    if (!contactId) {
      setForm((prev) => ({ ...prev, contactPerson: "", mobile: "", customerEmail: "" }));
      return;
    }

    const comp = companies.find((c) => String(c.id || c._id) === String(selectedCompanyId));
    if (comp && comp.locations) {
      const loc = comp.locations.find((l) => String(l._id) === String(selectedLocationId));
      if (loc && loc.contactPersons) {
        const cp = loc.contactPersons.find((p) => String(p._id) === String(contactId));
        if (cp) {
          setForm((prev) => ({
            ...prev,
            contactPerson: cp.name || "",
            mobile: cp.mobile || prev.mobile,
            customerEmail: cp.email || prev.customerEmail,
          }));
        }
      }
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function resizeReportTextArea(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(112, textarea.scrollHeight)}px`;
  }

  function handleBulletFocus(event) {
    if (!event.currentTarget.value) {
      const name = event.currentTarget.name;
      setForm((previous) => ({ ...previous, [name]: "• " }));
      requestAnimationFrame(() => {
        event.currentTarget.setSelectionRange(2, 2);
        resizeReportTextArea(event.currentTarget);
      });
    }
  }

  function handleBulletKeyDown(event) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const textarea = event.currentTarget;
    const { name, value, selectionStart, selectionEnd } = textarea;
    const nextValue = `${value.slice(0, selectionStart)}\n• ${value.slice(selectionEnd)}`;
    setForm((previous) => ({ ...previous, [name]: nextValue }));
    requestAnimationFrame(() => {
      const caret = selectionStart + 3;
      textarea.setSelectionRange(caret, caret);
      resizeReportTextArea(textarea);
    });
  }

  function handleBulletPaste(event) {
    const pastedText = event.clipboardData.getData("text");
    if (!pastedText.includes("\n")) return;
    event.preventDefault();
    const textarea = event.currentTarget;
    const { name, value, selectionStart, selectionEnd } = textarea;
    const bulletedText = pastedText
      .split(/\r?\n/)
      .map((line, index) => index === 0 ? line : `• ${line.replace(/^\s*[•*-]\s*/, "")}`)
      .join("\n");
    const nextValue = value.slice(0, selectionStart) + bulletedText + value.slice(selectionEnd);
    setForm((previous) => ({ ...previous, [name]: nextValue }));
    requestAnimationFrame(() => resizeReportTextArea(textarea));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    try {
      setSubmitting(true);

      if (!onSubmitReport) {
        throw new Error("Connect onSubmitReport to your backend before submitting.");
      }

      // Ensure engineer name from logged-in account is included
      const activeEngineerName = form.engineerName || defaultEngineerName;

      // 1. Submit report to backend (backend assigns official FSR number)
      const res = await onSubmitReport({
        ...form,
        engineerName: activeEngineerName,
        customerSignature,
        engineerSignature,
      });

      const assignedFsrNo = res?.fsrNo || res?.report?.fsrNo;
      const reportId = res?.report?._id || res?.report?.id || res?.reportId;
      if (!assignedFsrNo || !reportId) throw new Error("Backend did not return the saved report ID and FSR number.");

      setForm((prev) => ({ ...prev, fsrNo: assignedFsrNo }));

      // Wait for React to put the assigned number into the dedicated A4 PDF page.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const reportElement = pdfPageRef.current;
      if (!reportElement) throw new Error("The FSR PDF layout is unavailable.");
      const pages = Array.from(reportElement.querySelectorAll("[data-pdf-page]"));
      if (!pages.length) throw new Error("The FSR PDF pages are unavailable.");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;

      for (let page = 0; page < pages.length; page++) {
        const canvas = await html2canvas(pages[page], { scale: 2, useCORS: true, backgroundColor: "#fff" });
        if (page) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pageWidth, pageHeight);
        pdf.setFontSize(8);
        pdf.text(`Page ${page + 1} of ${pages.length}`, 198, 293, { align: "right" });
      }
      const pdfBlob = pdf.output("blob");
      const pdfFormData = new FormData();
      pdfFormData.append("pdf", pdfBlob, `${assignedFsrNo}.pdf`);
      const token = localStorage.getItem("smartfix_auth_token");
      const uploadResponse = await fetch(`${API_BASE}/reports/${reportId}/pdf`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: pdfFormData,
      });
      if (!uploadResponse.ok) throw new Error(`Report saved, but PDF upload failed (${uploadResponse.status}). Please retry PDF upload from the report list.`);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${assignedFsrNo}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage(`Field Service Report ${assignedFsrNo} saved. PDF downloaded.`);
    } catch (error) {
      setMessage(error.message || "Unable to submit the report.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("smartfix_auth_token");
    localStorage.removeItem("smartfix_user");
    navigate("/login", { replace: true });
  }

  let isAdmin = false;
  try {
    isAdmin = currentUser?.role === "admin";
  } catch {}

  const currentCompany = companies.find((c) => String(c.id || c._id) === String(selectedCompanyId));
  const currentLocations = currentCompany?.locations || [];
  const currentLocation = currentLocations.find((l) => String(l._id) === String(selectedLocationId));
  const currentContacts = currentLocation?.contactPersons || [];

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

  const inputClass = "w-full min-w-0 bg-transparent px-2 py-1.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:bg-sky-50";
  const labelClass = "text-xs font-medium text-slate-600";
  const cellClass = "border border-slate-500";

function SignaturePad({ label, value, onChange }) {
    const canvasRef = useRef(null);
    const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!value) return;
    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = value;
  }, [value]);

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
        {value && <button type="button" onClick={clear} className="print-hide rounded  font-semibold text-rose-500">Clear</button>}
        </div>
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          aria-label={`${label}: draw signature`}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={finish}
          className="mt-2 h-24 w-full touch-none rounded border border-slate-300 bg-white cursor-crosshair"
        />
      </div>
    );
  }

  return (
    <div className="report-page min-h-screen bg-slate-100 px-3 text-slate-800 sm:px-6">
      <header className="print-hide mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex gap-2">
          {isAdmin && (
            <Link to="/admin" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Admin dashboard
            </Link>
          )}
          <button type="button" onClick={() => setShowChangePassword(true)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            🔑 Change Password
          </button>
        </div>
        <button type="button" onClick={handleLogout} className="rounded-lg bg-[#06111d] px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          Logout
        </button>
      </header>

      <form onSubmit={handleSubmit} className="print-report mx-auto max-w-5xl bg-white p-3 shadow-xl sm:p-6">
        <div className="border border-slate-600">
          <h1 className="border-b border-slate-600 text-center text-base font-bold tracking-wide sm:text-lg py-1">
            FIELD SERVICE REPORT
          </h1>

          <div className="report-columns grid lg:grid-cols-[1.55fr_1fr]">
            <div className="report-company grid border-b border-slate-600 lg:grid-cols-[190px_1fr] lg:border-r">
              <div className="report-logo flex items-center justify-center border-b border-slate-600 px-4 lg:border-b-0 lg:border-r">
                <div className="text-center">
                  <img src={icon} alt="Smartfix Logo" className="max-h-16 mx-auto" />
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
              <div className={cellClass}>
                <label className="flex min-w-0 items-center gap-2 px-2 py-1">
                  <span className={`${labelClass} shrink-0`}>FSR No:</span>
                  <input
                    readOnly
                    name="fsrNo"
                    value={form.fsrNo || nextFsrNo || "(Auto-Assigned)"}
                    className={`${inputClass} font-bold text-sky-900 cursor-not-allowed bg-slate-100/50`}
                  />
                </label>
              </div>
              <div className={cellClass}>
                <label className="flex min-w-0 items-center gap-2 px-2 py-1">
                  <span className={`${labelClass} shrink-0`}>Date:</span>
                  <input type="date" name="date" value={form.date} onChange={handleChange} className={inputClass} />
                </label>
              </div>
              <div className={cellClass}>
                <label className="flex min-w-0 items-center gap-2 px-2 py-1">
                  <span className={`${labelClass} shrink-0`}>Ref No:</span>
                  <input type="text" name="refNo" value={form.refNo} onChange={handleChange} className={inputClass} />
                </label>
              </div>
              <div className={cellClass}>
                <label className="flex min-w-0 items-center gap-2 px-2 py-1">
                  <span className={`${labelClass} shrink-0`}>Start Date:</span>
                  <input type="date" name="startDate" value={form.startDate} onChange={handleChange} className={inputClass} />
                </label>
              </div>
              <div className={cellClass}>
                <label className="flex min-w-0 items-center gap-2 px-2 py-1">
                  <span className={`${labelClass} shrink-0`}>End Date:</span>
                  <input type="date" name="endDate" value={form.endDate} onChange={handleChange} className={inputClass} />
                </label>
              </div>
            </div>
          </div>

          {/* Customer and visit details */}
          <div className="report-columns grid lg:grid-cols-[1.55fr_1fr]">
            <div className="border-b border-slate-600 lg:border-r">
              {companies.length > 0 && (
                <div className="border-b border-slate-500 bg-sky-50/80 p-2 print-hide space-y-2">
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <select
                      value={selectedCompanyId}
                      onChange={(e) => handleSelectCompany(e.target.value)}
                      className="rounded border border-sky-300 bg-white p-1 text-xs outline-none"
                    >
                      <option value="">-- Select Company --</option>
                      {companies.map((comp) => (
                        <option key={comp.id || comp._id} value={comp.id || comp._id}>
                          {comp.name}
                        </option>
                      ))}
                    </select>

                    <select
                      disabled={!selectedCompanyId || currentLocations.length === 0}
                      value={selectedLocationId}
                      onChange={(e) => handleSelectLocation(e.target.value)}
                      className="rounded border border-sky-300 bg-white p-1 text-xs outline-none disabled:opacity-50"
                    >
                      <option value="">-- Select Location --</option>
                      {currentLocations.map((loc) => (
                        <option key={loc._id} value={loc._id}>
                          📍 {loc.locationName}
                        </option>
                      ))}
                    </select>

                    <select
                      disabled={!selectedLocationId || currentContacts.length === 0}
                      value={selectedContactId}
                      onChange={(e) => handleSelectContact(e.target.value)}
                      className="rounded border border-sky-300 bg-white p-1 text-xs outline-none disabled:opacity-50"
                    >
                      <option value="">-- Select Contact --</option>
                      {currentContacts.map((cp) => (
                        <option key={cp._id} value={cp._id}>
                          👤 {cp.name} ({cp.designation || "Contact"})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="border-b border-slate-500">
                <div className="px-3 pt-2 text-xs font-bold">
                  CUSTOMER DETAILS:
                </div>
               <textarea
                  name="customerAddress"
                  value={form.customerName}
                  onChange={handleChange}
                  placeholder="Customer address"
                  rows={2}
                  className="w-full resize-y px-3 py-1 text-sm outline-none placeholder:text-slate-400 focus:bg-sky-50"
                />
                
                {form.locationName && (
                  <p className="px-3 text-xs font-semibold text-sky-800">
                    Location: {form.locationName}
                  </p>
                )}
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
                <label className="flex min-w-0 items-center gap-2 px-2 py-1">
                  <span className={`${labelClass} shrink-0`}>Contact Person Name:</span>
                  <input type="text" name="contactPerson" value={form.contactPerson} onChange={handleChange} className={inputClass} />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2">
                <label className="flex min-w-0 items-center gap-2 px-2 py-1 border-r border-slate-500">
                  <span className={`${labelClass} shrink-0`}>Mobile:</span>
                  <input type="tel" name="mobile" value={form.mobile} onChange={handleChange} className={inputClass} />
                </label>
                <label className="flex min-w-0 items-center gap-2 px-2 py-1">
                  <span className={`${labelClass} shrink-0`}>Email:</span>
                  <input type="email" name="customerEmail" value={form.customerEmail} onChange={handleChange} className={inputClass} />
                </label>
              </div>
            </div>

            <div className="grid gap-0 border-b border-slate-600">
              <fieldset className="border-b border-slate-500 p-1">
                <legend className="px-1 py-1 text-xs font-bold">VISIT TYPE</legend>
                <div className="grid grid-cols-2 gap-1">
                  {visitTypes.map((item) => (
                    <label key={item.value} className="flex items-center gap-2 text-xs">
                      <input
                        type="radio"
                        name="visitType"
                        value={item.value}
                        checked={form.visitType === item.value}
                        onChange={handleChange}
                        className="h-3.5 w-3.5 text-sky-600 focus:ring-sky-500"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="p-3">
                <legend className="px-1 py-1 text-xs font-bold">CATEGORY</legend>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
                  {categories.map((item) => (
                    <label key={item.value} className="flex items-center gap-2 text-xs">
                      <input
                        type="radio"
                        name="category"
                        value={item.value}
                        checked={form.category === item.value}
                        onChange={handleChange}
                        className="h-3.5 w-3.5 text-sky-600 focus:ring-sky-500"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>

          {/* Details & Actions */}
          {[
            ["Customer Issue / Request", "customerIssue"],
            ["Action Taken", "action"],
          ].map(([label, name]) => (
            <div key={name} className={`report-text-row grid grid-cols-1 sm:grid-cols-[175px_1fr] ${cellClass}`}>
              <label htmlFor={name} className="px-3 py-2 text-xs font-medium text-slate-600">{label}:</label>
              <textarea
                id={name}
                name={name}
                value={form[name]}
                onChange={handleChange}
                onFocus={handleBulletFocus}
                onKeyDown={handleBulletKeyDown}
                onPaste={handleBulletPaste}
                onInput={(event) => resizeReportTextArea(event.currentTarget)}
                className="min-h-28 w-full resize-y overflow-hidden bg-transparent px-3 py-1 text-sm leading-7 text-slate-800 outline-none focus:bg-sky-50"
              />
            </div>
          ))}

          {/* Call Status & Spares */}
          <div className="grid border-b border-slate-600 lg:grid-cols-[300px_1fr]">
  <div className="border-b border-slate-500 px-3 py-2 lg:border-b-0 lg:border-r">
    <p className="mb-3 text-xs font-bold">CALL STATUS:</p>

    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {callStatuses.map((item) => (
        <label
          key={item.value}
          className="inline-flex items-center gap-1 text-xs leading-4"
        >
          <input
            type="radio"
            name="callStatus"
            value={item.value}
            checked={form.callStatus === item.value}
            onChange={handleChange}
            className="m-0 h-3.5 w-3.5"
          />
          <span>{item.label}</span>
        </label>
      ))}
    </div>
  </div>

  <div className="px-3 py-2">
  <label className="inline-flex items-center gap-2 text-xs font-bold">
    <input
      type="checkbox"
      checked={form.callStatus === "spare-required"}
      onChange={(e) =>
        setForm((prev) => ({
          ...prev,
          callStatus: e.target.checked ? "spare-required" : "completed",
        }))
      }
      className="h-4 w-4 accent-sky-600"
    />
    Spare Details / Requirement
  </label>

  {form.callStatus === "spare-required" && (
    <textarea
      id="spareDetails"
      name="spareDetails"
      value={form.spareDetails}
      onChange={handleChange}
      rows={2}
      placeholder="Enter required spare details"
      className="mt-1 block min-h-12 w-full resize-y px-2 py-1 text-sm leading-5 outline-none focus:bg-sky-50"
    />
  )}
</div>
</div>

          {/* Customer Feedback & Man Days */}
         <div className="border-b border-slate-600">
  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-500 px-3 py-2">
    <span className="text-xs font-bold">CUSTOMER FEEDBACK:</span>

    {feedbackOptions.map((opt) => (
      <label key={opt} className="inline-flex items-center gap-1 text-xs">
        <input
          type="radio"
          name="customerFeedback"
          value={opt}
          checked={form.customerFeedback === opt}
          onChange={handleChange}
          className="m-0 h-3.5 w-3.5"
        />
        <span>{opt}</span>
      </label>
    ))}
  </div>

  <h3 className="px-3 py-1 text-xs font-bold uppercase">
    Billing Details
  </h3>

  <div className="grid grid-cols-2 px-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
    {[
      ["No. of Persons", "persons"],
      ["Total No. of Working Days", "workingDays"],
      ["Overtime (Hrs)", "overtimeHours"],
      ["Extra Man Days", "extraManDays"],
      ["Total No. of Man Days", "totalManDays"],
      ["Total No. of Payable Days", "payableDays"],
    ].map(([title, name]) => (
      <label key={name} className="flex min-w-0 py-2 flex-col gap-1">
        <span className="py-1 font-medium leading-4">{title}</span>
        <input
          type="number"
          min="0"
          step="any"
          name={name}
          value={form[name]}
          onChange={handleChange}
          className="w-25 h-8 max-w-full rounded border border-slate-300 px-2 py-2 outline-none focus:border-sky-500"
        />
      </label>
    ))}
  </div>
</div>

          {/* Remarks & Signatures */}
          <div className="grid sm:grid-cols-2">
            <div className="border-r border-slate-500 p-2">
              <label htmlFor="customerRemarks" className="block text-xs font-bold mb-1">Customer Remarks:</label>
              <textarea id="customerRemarks" name="customerRemarks" value={form.customerRemarks} onChange={handleChange} className="w-full min-h-24 text-sm outline-none focus:bg-sky-50" />
              
              <SignaturePad label="Customer Signature & Seal" value={customerSignature} onChange={setCustomerSignature} />
            </div>

            <div className="p-2">
              <label htmlFor="engineerRemarks" className="block text-xs font-bold mb-1">Engineer Remarks:</label>
              <textarea id="engineerRemarks" name="engineerRemarks" value={form.engineerRemarks} onChange={handleChange} className="w-full min-h-24 text-sm outline-none focus:bg-sky-50" />
              
              <SignaturePad label="Engineer Signature" value={engineerSignature} onChange={setEngineerSignature} />
              <p className="mt-1 px-1 text-xs font-bold text-slate-700">{form.engineerName || defaultEngineerName} - {form.engineerId || defaultEngineerId}</p>
              <p className="mt-1 px-1 text-xs font-bold text-slate-700"> </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="print-hide mt-6 flex justify-end gap-3">
          <button type="submit" disabled={submitting} className="rounded-lg bg-sky-700 px-8 py-3 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60">
            {submitting ? "Submitting & Downloading PDF..." : "Submit Report & Download PDF"}
          </button>
        </div>

        {message && (
          <p role="status" className="print-hide mt-4 rounded-lg bg-emerald-50 p-3 text-right text-sm font-bold text-emerald-900 border border-emerald-300">
            {message}
          </p>
        )}
      </form>

      {/* Dedicated A4 layout matching the supplied HTML export. Never capture editable form controls. */}
      <div aria-hidden="true" style={{ position: "fixed", left: "-10000px", top: 0, pointerEvents: "none" }}>
        <FsrPdfPage ref={pdfPageRef} form={form} fsrNo={form.fsrNo || nextFsrNo} icon={icon} customerSignature={customerSignature} engineerSignature={engineerSignature} />
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}


const FsrPdfPage = forwardRef(function FsrPdfPage(
  { form, fsrNo, icon, customerSignature, engineerSignature }, ref
) {
  const measureRef = useRef(null);
  const measureTableRef = useRef(null);
  const [useTwoPages, setUseTwoPages] = useState(false);
  const cell = "border border-[#8b8b8b] px-[7px] py-[6px] items-center [overflow-wrap:anywhere]";
  const label = "font-normal text-[#444]";
  const value = (text) => text === null || text === undefined || text === "" ? "—" : text;
  const detail = (title, text) => <><span className={label}>{title}: </span><span>{value(text)}</span></>;
  const option = (selected, title) => (
    <span className="grid grid-cols-[minmax(0,1fr)_11px] items-center justify-self-start gap-[8px] mb-[3px]">
      <span className="leading-[1.5] [overflow-wrap:anywhere]">{title}</span>
      <span className="inline-flex h-[5px] w-[7px] shrink-0 items-center justify-center rounded-[2px] text-[12px] leading-none">{selected ? "✓" : ""}</span>
    </span>
  );
  const ruled = "whitespace-pre-wrap leading-[18px] [background-image:repeating-linear-gradient(to_bottom,transparent_0px,transparent_17px,#c4c4c4_17px,#c4c4c4_18px)]";
  const workRow = (title, text, height) => (
    <tr>
      <td colSpan={12} className={`${cell} !p-0`}>
        <div className="flex items-stretch">
          <div className="flex w-[28mm] shrink-0 items-center px-[5px] py-[4px] text-[#444]">{title}</div>
          <div className={`${ruled} flex min-w-0 flex-1 items-center px-[5px] py-[4px] text-left [overflow-wrap:anywhere] ${height}`}>{value(text)}</div>
        </div>
      </td>
    </tr>
  );
  const signature = (name, date, image, customer) => (
    <div className="grid grid-cols-[1fr_32mm] items-center gap-[7px]">
      <div className="leading-[18px]">
        <div>{detail("Name", name)}</div><div>{detail("Date", date)}</div>
      </div>
      <div className="text-center">
        <div className="flex h-[38px] items-end justify-center">{image && <img src={image} alt={customer ? "Customer signature" : "Engineer signature"} className="max-h-[38px] max-w-full object-contain" />}</div>
        <div className="text-[11px] text-[#444]">{customer ? "Signature & Seal" : "Signature"}</div>
      </div>
    </div>
  );

  useLayoutEffect(() => {
    const measurement = measureRef.current;
    const table = measureTableRef.current;
    if (!measurement || !table) return;

    // Keep the normal report on one fixed A4 page. Only move the billing
    // section when the complete table genuinely crosses the printable area.
    const measurementStyle = window.getComputedStyle(measurement);
    const printableHeight = measurement.clientHeight
      - parseFloat(measurementStyle.paddingTop)
      - parseFloat(measurementStyle.paddingBottom);
    const contentHeight = table.getBoundingClientRect().height;
    setUseTwoPages(contentHeight > printableHeight + 1);
  }, [form, fsrNo, customerSignature, engineerSignature]);

  const columns = () => (
    <colgroup>{Array.from({ length: 12 }, (_, index) => <col key={index} className="w-[8.333333333333334%]" />)}</colgroup>
  );

  const headerRows = () => (
    <>
      <tr className="h-4"><td colSpan={12} className={`${cell} text-center text-[11px] font-semibold`}>FIELD SERVICE REPORT</td></tr>
      <tr>
        <td colSpan={6} rowSpan={4} className={`${cell} align-middle`}>
          <div className="flex items-center gap-[10px]">
            <div className="w-[40mm] shrink-0"><img src={icon} alt="Smartfix Automation" className="block max-h-[48px] w-full object-contain" /></div>
            <div className="text-[11px] leading-[1.5]">
              <strong className="text-[11px] font-semibold">SMARTFIX AUTOMATION</strong>
              <div>No. 5/12, Chetty Street, Poonamallee,<br />Chennai, Tamil Nadu - 600056<br />Mail: csm@smartfixautomation.com<br />+91 9894571542</div>
            </div>
          </div>
        </td>
        <td colSpan={3} className={cell}>{detail("FSR No", fsrNo)}</td>
        <td colSpan={3} className={cell}>{detail("Date", form.date)}</td>
      </tr>
      <tr><td colSpan={6} className={cell}>{detail("Ref.No", form.refNo)}</td></tr>
      <tr><td colSpan={3} className={cell}>{detail("Start Date", form.startDate)}</td><td colSpan={3} className={cell}>{detail("End Date", form.endDate)}</td></tr>
      <tr><td colSpan={6} className={cell}><div className="mb-[3px] font-semibold">VISIT TYPE:</div><div className="grid grid-cols-2 items-start justify-self-start gap-x-[8px] gap-y-[4px]">{option(form.visitType === "chargeable", "CHARGEABLE")}{option(form.visitType === "non-chargeable", "NON CHARGEABLE")}</div></td></tr>
    </>
  );

  const serviceRows = () => (
    <>
      <tr>
        <td colSpan={7} className={cell}>
          <span className="font-semibold">CUSTOMER DETAILS: </span><span>{value(form.customerName)}</span>
          <div>{value(form.customerAddress)}</div>
          <div className="mt-[3px]">{detail("LOCATION", form.locationName)}</div>
        </td>
        <td colSpan={5} rowSpan={2} className={cell}>
          <div className="mb-[3px] font-semibold">CATEGORY:</div>
          <div className="grid grid-cols-2 items-center gap-x-[10px] gap-y-[6px]">
            {[["service", "SERVICE"], ["emc", "EMC"], ["project", "PROJECT"], ["warranty", "WARRANTY"], ["demo-training", "DEMO/TRAINING"], ["system-study", "SYSTEM STUDY"]].map(([key, title]) => <span key={key}>{option(form.category === key, title)}</span>)}
          </div>
        </td>
      </tr>
      <tr><td colSpan={7} className={cell}><div>{detail("Contact Person Name", form.contactPerson)}</div><div>{detail("Mobile", form.mobile)}<span className="ml-[12px]">{detail("EMAIL", form.customerEmail)}</span></div></td></tr>
      {workRow("Customer Issue:", form.customerIssue, "min-h-[22mm]")}
      {workRow("Action:", form.action, "min-h-[50mm]")}
      <tr><td colSpan={12} className={cell}><div className="grid grid-cols-[20mm_repeat(3,minmax(0,1fr))] items-center justify-items-start gap-x-[2px] gap-y-[2px]"><span>Call Status:</span>{option(form.callStatus === "completed", "Completed")}{option(form.callStatus === "pending", "Pending")}{option(form.callStatus === "spare-required", "Spare Required")}</div></td></tr>
      <tr><td colSpan={12} className={cell}>{detail("Spare Details", form.spareDetails)}</td></tr>
      <tr>
        <td colSpan={12} className={cell}>
          <div className="grid grid-cols-[28mm_repeat(3,minmax(0,1fr))] items-center justify-items-start gap-x-[10px]">
            <span>Customer Feedback:</span>
            {["Extremely Satisfied", "Satisfied", "Dissatisfied"].map((title) => <span key={title}>{option(form.customerFeedback === title, title)}</span>)}
          </div>
        </td>
      </tr>
    </>
  );

  const billingRows = () => (
    <>
      <tr>
        <td colSpan={12} className={`${cell} !p-0`}>
          <table className="w-full table-fixed border-collapse text-[9px] leading-[1.45]">
            <colgroup><col className="w-[19mm]" />{Array.from({ length: 6 }, (_, i) => <col key={i} />)}</colgroup>
            <tbody>
              <tr>
                <td rowSpan={2} className="border-r border-[#8b8b8b] px-[6px] py-[6px] align-middle text-center">Billing Details</td>
                {["No. of Persons", "Total No. of Working Days", "Over Time (Hrs)", "Extra MAN Days (Over Time)", "Total No. of MAN Days", "Total No. of Payable Days"].map((title, i) => <td key={title} className={`border-b border-[#8b8b8b] px-[6px] py-[6px] align-middle [overflow-wrap:anywhere] ${i < 5 ? "border-r" : ""}`}>{title}</td>)}
              </tr>
              <tr>
                {[form.noOfPersons, form.workingDays, form.overtimeHours, form.extraManDays, form.totalManDays, form.payableDays].map((text, i) => <td key={i} className={`h-[8mm] border-[#8b8b8b] px-[6px] py-[6px] align-middle [overflow-wrap:anywhere] ${i < 5 ? "border-r" : ""}`}>{value(text)}</td>)}
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
      <tr>
        <td colSpan={6} className={`${cell} !p-0`}><div className="px-[7px] pt-[6px] pb-[3px] underline">Customer Remarks:</div><div className={`${ruled} flex min-h-[22mm] items-center px-[7px] py-[6px] text-left [overflow-wrap:anywhere]`}>{value(form.customerRemarks)}</div><div className="px-[7px] pt-[5px] pb-[6px]">{signature(form.customerSignName, form.customerSignDate, customerSignature, true)}</div></td>
        <td colSpan={6} className={`${cell} !p-0`}><div className="px-[7px] pt-[6px] pb-[3px] underline">Engineer&apos;s Remarks:</div><div className={`${ruled} flex min-h-[22mm] items-center px-[7px] py-[6px] text-left [overflow-wrap:anywhere]`}>{value(form.engineerRemarks)}</div><div className="px-[7px] pt-[5px] pb-[6px]">{signature(form.engineerName, form.engineerSignDate, engineerSignature, false)}</div></td>
      </tr>
    </>
  );

  const page = (rows, key) => (
    <div key={key} data-pdf-page className="box-border h-[297mm] w-[210mm] shrink-0 overflow-hidden bg-white p-[10mm] text-[11px] leading-[1.45] text-[#333] [font-family:Arial,sans-serif]">
      <table className={`w-full table-fixed border-collapse text-[11px] leading-[1.45] ${key !== "billing" ? "h-full" : ""}`}>
        {columns()}
        <tbody>{rows}</tbody>
      </table>
    </div>
  );

  return (
    <div ref={ref} className="relative w-[210mm]">
      {useTwoPages
        ? <>{page(<>{headerRows()}{serviceRows()}</>, "service")}{page(<>{headerRows()}{billingRows()}</>, "billing")}</>
        : page(<>{headerRows()}{serviceRows()}{billingRows()}</>, "single")}

      <div ref={measureRef} aria-hidden="true" className="invisible absolute left-0 top-0 box-border h-[297mm] w-[210mm] overflow-hidden bg-white p-[10mm] text-[11px] leading-[1.45] [font-family:Arial,sans-serif]">
        <table ref={measureTableRef} className="h-full w-full table-fixed border-collapse text-[11px] leading-[1.45]">
          {columns()}
          <tbody>{headerRows()}{serviceRows()}{billingRows()}</tbody>
        </table>
      </div>
    </div>
  );
});


