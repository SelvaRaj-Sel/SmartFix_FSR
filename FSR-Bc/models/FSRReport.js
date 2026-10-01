import mongoose from "mongoose";

const fsrReportSchema = new mongoose.Schema(
  {
    fsrNo: { type: String, trim: true, required: true },
    refNo: { type: String, trim: true },
    date: { type: String, trim: true },
    startDate: { type: String, trim: true },
    endDate: { type: String, trim: true },
    visitType: { type: String, default: "chargeable" },
    category: { type: String, default: "service" },

    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    locationName: { type: String, trim: true, default: "" },
    customerName: { type: String, trim: true },
    customerAddress: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
    mobile: { type: String, trim: true },
    customerEmail: { type: String, trim: true },

    customerIssue: { type: String, default: "" },
    rootCause: { type: String, default: "" },
    action: { type: String, default: "" },
    callStatus: { type: String, default: "completed" },
    spareDetails: { type: String, default: "" },
    customerFeedback: { type: String, default: "" },
    persons: { type: String, default: "" },
    workingDays: { type: String, default: "" },
    overtimeHours: { type: String, default: "" },
    extraManDays: { type: String, default: "" },
    totalManDays: { type: String, default: "" },
    payableDays: { type: String, default: "" },
    customerRemarks: { type: String, default: "" },
    engineerRemarks: { type: String, default: "" },
    customerSignName: { type: String, default: "" },
    customerSignDate: { type: String, default: "" },
    engineerName: { type: String, default: "" },
    engineerId: { type: String, trim: true, default: "" },
    engineerSignDate: { type: String, default: "" },
    customerSignature: { type: String, default: "" },
    engineerSignature: { type: String, default: "" },

    pdfUrl: { type: String, default: "" },
    pdfData: { type: Buffer, select: false },
    pdfContentType: { type: String, default: "application/pdf", select: false },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model("FSRReport", fsrReportSchema);
