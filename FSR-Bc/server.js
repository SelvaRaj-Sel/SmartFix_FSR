import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

const app = express();
const PORT = Number(process.env.PORT || 5000)

app.use(cors({
  origin: process.env.FRONTEND_URL,
}));

app.use(express.json());


app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

async function startServer() {
  if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
    throw new Error("MONGO_URI and JWT_SECRET are required");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  }

  const existingAdminEmail = await User.findOne({ email: adminEmail });

if (!existingAdminEmail) {
  await User.create({
    email: adminEmail,
    name: "Admin",
    passwordHash: await bcrypt.hash(adminPassword, 12),
    role: "admin",
    status: "approved",
  });

  console.log("Default admin created");
} else if (existingAdminEmail.role !== "admin") {
  throw new Error(
    "ADMIN_EMAIL already belongs to a user. Choose another admin email."
  );
}

  app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});
