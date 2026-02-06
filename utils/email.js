const nodemailer = require("nodemailer");

const sendOTPEmail = async (to, otp) => {
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
      user: process.env.EMAIL_SENDER_USER,
      pass: process.env.EMAIL_SENDER_PASSWORD,
    },
  });

  await transporter.sendMail({
    to,
    subject: "Password Reset OTP - olo",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; padding: 32px 24px; background: #fafbfc;">
        <h2 style="color: #2d3748;">Reset Your Password</h2>
        <p style="color: #4a5568; font-size: 16px;">Hello,</p>
        <p style="color: #4a5568; font-size: 16px;">
          We received a request to reset your password for your olo account. Use the code below to reset your password. This code is valid for 10 minutes.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <div style="display: inline-block; padding: 16px 32px; background: #f7fafc; border: 2px dashed #3182ce; border-radius: 8px;">
            <p style="font-size: 32px; font-weight: bold; color: #2d3748; margin: 0; letter-spacing: 8px;">${otp}</p>
          </div>
        </div>
        <p style="color: #718096; font-size: 14px;">If you did not request a password reset, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="color: #a0aec0; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} olo. All rights reserved.</p>
      </div>
    `,
  });
};

// Keep backward compatibility
const sendResetEmail = sendOTPEmail;

module.exports = { sendOTPEmail, sendResetEmail };
