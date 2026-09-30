import { Router } from "express";
import multer from "multer";
import nodemailer from "nodemailer";

const router = Router();
const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB limit

router.post("/send", upload.array("attachments"), async (req, res) => {
  try {
    const parseList = (field) => {
      if (!field) return [];
      if (Array.isArray(field)) return field;
      try {
        return JSON.parse(field);
      } catch {
        return String(field).split(/[;,]/).map((s) => s.trim()).filter(Boolean);
      }
    };

    const to = parseList(req.body.to);
    const cc = parseList(req.body.cc);
    const bcc = parseList(req.body.bcc);
    const subject = String(req.body.subject || "").trim();
    const message = String(req.body.message || "").trim();

    if (!to.length || !subject || !message) {
      return res.status(400).json({ message: "To, Subject, and Message are required" });
    }

    const attachments = (req.files || []).map((file) => ({
      filename: file.originalname,
      content: file.buffer,
    }));

    // Configure Nodemailer transporter
    let transporter;

    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Create a test account using Ethereal if no SMTP credentials are set
      try {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
      } catch (etherealError) {
        console.log("No SMTP configured and Ethereal fallback unavailable. Simulating send.");
        return res.json({
          success: true,
          message: "Email queued/sent (Simulated - configure SMTP in .env for actual delivery).",
        });
      }
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.SMTP_USER || '"Smartfix FSR" <noreply@smartfix.com>',
      to: to.join(", "),
      cc: cc.length ? cc.join(", ") : undefined,
      bcc: bcc.length ? bcc.join(", ") : undefined,
      subject,
      text: message,
      html: message.replace(/\n/g, "<br/>"),
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log("Preview URL:", previewUrl);
    }

    res.json({
      success: true,
      message: "Email sent successfully!",
      previewUrl: previewUrl || undefined,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
    res.status(500).json({ message: error.message || "Failed to send email" });
  }
});

export default router;
