import { Router } from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import FSRReport from "../models/FSRReport.js";
import FSRSequence from "../models/FSRSequence.js";
import User from "../models/User.js";

const router = Router();

// Ensure uploads/reports directory exists
const uploadDir = path.join(process.cwd(), "uploads", "reports");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".pdf";
    cb(null, `FSR_${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

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
    res.json({ nextFsrNo: formattedNo, year: seq.year });
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
      submittedBy: req.user._id,
    };

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

// POST /api/reports/:id/pdf - Save PDF file on backend
router.post("/:id/pdf", authMiddleware, upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No PDF file uploaded" });
    }

    const relativePath = `/uploads/reports/${req.file.filename}`;
    const report = await FSRReport.findByIdAndUpdate(
      req.params.id,
      { pdfUrl: relativePath },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.json({
      success: true,
      pdfUrl: relativePath,
      message: "PDF saved successfully on backend",
      report,
    });
  } catch (error) {
    console.error("Error saving report PDF:", error);
    res.status(500).json({ message: "Could not save PDF on backend" });
  }
});

export default router;
