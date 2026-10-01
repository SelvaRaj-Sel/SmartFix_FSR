import { Router } from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import FSRReport from "../models/FSRReport.js";
import FSRSequence from "../models/FSRSequence.js";
import User from "../models/User.js";

const router = Router();

// Keep uploaded PDFs in memory until they are stored in MongoDB.
// This avoids creating permanent files under uploads/reports.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF files are allowed"));
    }
    cb(null, true);
  },
});

// Middleware to authenticate user
async function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) {
      return res.status(401).json({ message: "Please sign in again" });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user || user.status !== "approved") {
      return res.status(403).json({ message: "Access denied" });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Please sign in again" });
  }
}

// GET /api/reports/next-number - Preview next FSR number for current year
router.get("/next-number", authMiddleware, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    let seq = await FSRSequence.findOne({ year: currentYear });
    if (!seq) {
      seq = { year: currentYear, prefix: "FSR", currentNumber: 0, digits: 3 };
    }
    const nextNum = seq.currentNumber + 1;
    const formattedNo = `${seq.prefix}${seq.year}-${String(nextNum).padStart(seq.digits, "0")}`;
    res.json({
      nextFsrNo: formattedNo,
      year: seq.year,
      engineerName: req.user.name || req.user.email || "",
      engineerId: req.user.employeeid || "",
    });
  } catch (error) {
    console.error("Error generating next FSR number preview:", error);
    res.status(500).json({ message: "Could not generate FSR number preview" });
  }
});

// GET /api/reports - Paginated reports (10 per page) with Date range filter
router.get("/", authMiddleware, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Number(req.query.limit || 10));
    const skip = (page - 1) * limit;

    let filter = {};
    if (req.user.role !== "admin") {
      filter.submittedBy = req.user._id;
    }

    // Custom From Date / To Date filter
    const { startDate, endDate } = req.query;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    const total = await FSRReport.countDocuments(filter);
    const reports = await FSRReport.find(filter)
      .populate("companyId")
      .populate("submittedBy", "name employeeid")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error("Error fetching paginated reports:", error);
    res.status(500).json({ message: "Could not fetch reports" });
  }
});

// POST /api/reports - Submit report with auto-assigned unique FSR number
router.post("/", authMiddleware, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    let seq = await FSRSequence.findOne({ year: currentYear });
    if (!seq) {
      seq = await FSRSequence.create({
        year: currentYear,
        prefix: "FSR",
        currentNumber: 0,
        digits: 3,
      });
    }

    // Increment currentNumber atomically
    seq.currentNumber += 1;
    await seq.save();

    const assignedFsrNo = `${seq.prefix}${seq.year}-${String(seq.currentNumber).padStart(seq.digits, "0")}`;

    const reportData = {
      ...req.body,
      fsrNo: assignedFsrNo,
      engineerName: req.body.engineerName || req.user.name || req.user.email,
      engineerId: req.user.employeeid || req.body.engineerId || "",
      submittedBy: req.user._id,
    };

    // A manually entered company has a name but no saved Company document yet.
    // Do not pass an empty string to an optional ObjectId field.
    if (!reportData.companyId) delete reportData.companyId;

    const report = await FSRReport.create(reportData);
    res.status(201).json({
      report,
      fsrNo: assignedFsrNo,
      message: `Report ${assignedFsrNo} submitted successfully`,
    });
  } catch (error) {
    console.error("Error saving report:", error);
    res.status(500).json({ message: "Could not save field service report" });
  }
});

// GET /api/reports/:id/pdf - View a PDF stored in MongoDB
router.get("/:id/pdf", authMiddleware, async (req, res) => {
  try {
    const report = await FSRReport.findById(req.params.id).select("+pdfData +pdfContentType fsrNo submittedBy");
    if (!report || !report.pdfData) {
      return res.status(404).json({ message: "PDF not found" });
    }
    if (req.user.role !== "admin" && String(report.submittedBy) !== String(req.user._id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const safeFsrNo = String(report.fsrNo || "FSR").replace(/[^a-zA-Z0-9_-]/g, "_");
    res.set({
      "Content-Type": report.pdfContentType || "application/pdf",
      "Content-Disposition": `inline; filename="${safeFsrNo}.pdf"`,
      "Content-Length": report.pdfData.length,
      "Cache-Control": "private, no-store",
    });
    res.send(report.pdfData);
  } catch (error) {
    console.error("Error loading report PDF:", error);
    res.status(500).json({ message: "Could not load PDF" });
  }
});

// POST /api/reports/:id/pdf - Store PDF in MongoDB (not in a server folder)
router.post("/:id/pdf", authMiddleware, upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No PDF file uploaded" });
    }

    const pdfPath = `/api/reports/${req.params.id}/pdf`;
    const report = await FSRReport.findByIdAndUpdate(
      req.params.id,
      {
        pdfUrl: pdfPath,
        pdfData: req.file.buffer,
        pdfContentType: req.file.mimetype,
      },
      { returnDocument: "after" }
    );

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.json({
      success: true,
      pdfUrl: pdfPath,
      message: "PDF stored successfully",
      report,
    });
  } catch (error) {
    console.error("Error saving report PDF:", error);
    res.status(500).json({ message: "Could not save PDF on backend" });
  }
});

export default router;
