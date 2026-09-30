import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Notification from "../models/Notification.js";


const router = Router();

router.post("/signup", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8
    ) {
      return res.status(400).json({
        message: "Enter a valid email and a password of at least 8 characters",
      });
    }

    const exists = await User.exists({ email });

    if (exists) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    await User.create({
      email,
      name: String(req.body.name || "").trim(),
      phone: String(req.body.phone || "").trim(),
      passwordHash: await bcrypt.hash(password, 12),
      role: "user",
      status: "pending",
    });

    // A notification for this signup.
    try {
      await Notification.create({
        type: "signup_request",
        userEmail: email,
        message: `${email} requested access.`,
      });
    } catch (notificationError) {
      console.error("Signup notification failed:", notificationError);
    }

    return res.status(201).json({
      message: "Account created. Wait for admin approval.",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }

    console.error(error);
    return res.status(500).json({ message: "Signup failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    const user = await User.findOne({ email }).select("+passwordHash");

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (user.status !== "approved") {
      const messages = {
        pending: "Your account is waiting for admin approval.",
        rejected: "Your account request was rejected. Contact the admin.",
        disabled: "Your account has been disabled. Contact the admin.",
      };

      return res.status(403).json({
        message: messages[user.status] || "Account access denied",
      });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Create a NEW event on EVERY successful user login.
    if (user.role === "user") {
      try {
        await Notification.create({
          type: "user_login",
          userEmail: user.email,
          message: `${user.email} logged in.`,
        });
      } catch (notificationError) {
        console.error("Login notification failed:", notificationError);
      }
    }

    return res.json({
      token,
      userType: user.role === "admin" ? "admin" : "existing",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Login failed" });
  }
});

router.patch("/change-password", async (req, res) => {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) {
      return res.status(401).json({ message: "Please sign in again" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({
        message: "Provide current password and new password of at least 8 characters",
      });
    }

    const user = await User.findById(payload.userId).select("+passwordHash");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const validCurrent = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!validCurrent) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Could not change password" });
  }
});

export default router;