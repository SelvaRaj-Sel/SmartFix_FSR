import { Router } from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

const router = Router();

router.use(async (req, res, next) => {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];

    if (!token) {
      return res.status(401).json({ message: "Please sign in again" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await User.findById(payload.userId);

    if (
      !admin ||
      admin.role !== "admin" ||
      admin.status !== "approved"
    ) {
      return res.status(403).json({
        message: "Admin access required",
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Please sign in again",
    });
  }
});

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
}

router.get("/users", async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    res.json({
      users: users.map(publicUser),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not load users" });
  }
});

router.post("/users", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (
      !name ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8
    ) {
      return res.status(400).json({
        message: "Enter a name, valid email, and password of at least 8 characters",
      });
    }

    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: "user",
      status: "approved",
    });

    res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Email already exists" });
    }

    console.error(error);
    res.status(500).json({ message: "Could not create user" });
  }
});

router.patch("/users/:id/status", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const { status } = req.body;

    if (!["approved", "rejected", "disabled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.id === req.admin.id && status !== "approved") {
      return res.status(400).json({
        message: "You cannot disable your own account",
      });
    }

    if (user.role === "admin" && status !== "approved") {
      const adminCount = await User.countDocuments({
        role: "admin",
        status: "approved",
      });

      if (adminCount <= 1) {
        return res.status(400).json({
          message: "Cannot disable the last approved admin",
        });
      }
    }

    user.status = status;
    await user.save();

    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not update user" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.id === req.admin.id) {
      return res.status(400).json({ message: "You cannot remove your own account" });
    }

    if (user.status !== "disabled") {
      return res.status(400).json({
        message: "Disable the user before removing the account",
      });
    }

    await user.deleteOne();
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not remove user" });
  }
});

router.patch("/users/:id/promote", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "user" || user.status !== "approved") {
      return res.status(400).json({
        message: "Only approved users can be promoted",
      });
    }

    user.role = "admin";
    await user.save();

    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not promote user" });
  }
});

router.get("/notifications", async (req, res) => {
  try {
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      notifications: notifications.map((item) => ({
        id: item.id,
        type: item.type,
        userEmail: item.userEmail,
        message: item.message,
        read: item.read,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Could not load notifications",
    });
  }
});

router.get("/notifications/daily", async (req, res) => {
  try {
    const since = new Date(
      Date.now() - 31 * 24 * 60 * 60 * 1000
    );

    const results = await Notification.aggregate([
      {
        $match: {
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Kolkata",
            },
          },
          loginCount: {
            $sum: {
              $cond: [{ $eq: ["$type", "user_login"] }, 1, 0],
            },
          },
          signupCount: {
            $sum: {
              $cond: [{ $eq: ["$type", "signup_request"] }, 1, 0],
            },
          },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    res.json({
      days: results.map((day) => ({
        date: day._id,
        loginCount: day.loginCount,
        signupCount: day.signupCount,
        total: day.total,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Could not load daily counts",
    });
  }
});

router.patch("/notifications/:id/read", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid notification ID",
      });
    }

    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        message: "Notification not found",
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Could not update notification",
    });
  }
});

export default router;
