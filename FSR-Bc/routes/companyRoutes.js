import { Router } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Company from "../models/Company.js";
import User from "../models/User.js";

const router = Router();

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

// Middleware to check admin access
function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
}

// GET /api/companies - Get all companies (accessible by logged-in approved users)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    res.json({ companies });
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({ message: "Could not fetch companies" });
  }
});

// POST /api/companies - Create company (Admin only)
router.post("/", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, address, contactPerson, email, mobile, locations } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Company name is required" });
    }

    const company = await Company.create({
      name: String(name).trim(),
      address: String(address || "").trim(),
      contactPerson: String(contactPerson || "").trim(),
      email: String(email || "").trim().toLowerCase(),
      mobile: String(mobile || "").trim(),
      locations: Array.isArray(locations) ? locations : [],
    });

    res.status(201).json({ company });
  } catch (error) {
    console.error("Error creating company:", error);
    res.status(500).json({ message: "Could not create company" });
  }
});

// PUT /api/companies/:id - Update company (Admin only)
router.put("/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid company ID" });
    }

    const { name, address, contactPerson, email, mobile, locations } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: "Company name is required" });
    }

    const updateFields = {
      name: String(name).trim(),
      address: String(address || "").trim(),
      contactPerson: String(contactPerson || "").trim(),
      email: String(email || "").trim().toLowerCase(),
      mobile: String(mobile || "").trim(),
    };
    if (Array.isArray(locations)) {
      updateFields.locations = locations;
    }

    const company = await Company.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true }
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json({ company });
  } catch (error) {
    console.error("Error updating company:", error);
    res.status(500).json({ message: "Could not update company" });
  }
});

// DELETE /api/companies/:id - Delete company (Admin only)
router.delete("/:id", authMiddleware, adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid company ID" });
    }

    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json({ success: true, message: "Company deleted successfully" });
  } catch (error) {
    console.error("Error deleting company:", error);
    res.status(500).json({ message: "Could not delete company" });
  }
});

// POST /api/companies/:id/locations - Add Location to Company (Admin only)
router.post("/:id/locations", authMiddleware, adminOnly, async (req, res) => {
  try {
    const { locationName, address, contactPersons } = req.body;
    if (!locationName || !String(locationName).trim()) {
      return res.status(400).json({ message: "Location name is required" });
    }

    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    company.locations.push({
      locationName: String(locationName).trim(),
      address: String(address || "").trim(),
      contactPersons: Array.isArray(contactPersons) ? contactPersons : [],
    });

    await company.save();
    res.status(201).json({ company });
  } catch (error) {
    console.error("Error adding location:", error);
    res.status(500).json({ message: "Could not add location" });
  }
});

// DELETE /api/companies/:id/locations/:locId - Delete Location (Admin only)
router.delete("/:id/locations/:locId", authMiddleware, adminOnly, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    company.locations = company.locations.filter(
      (loc) => String(loc._id) !== String(req.params.locId)
    );
    await company.save();
    res.json({ company });
  } catch (error) {
    console.error("Error deleting location:", error);
    res.status(500).json({ message: "Could not delete location" });
  }
});

export default router;
