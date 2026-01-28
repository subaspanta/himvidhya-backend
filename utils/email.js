const nodemailer = require("nodemailer");

const sendResetEmail = async (to, resetURL) => {
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
      user: process.env.EMAIL_SENDER_USER,
      pass: process.env.EMAIL_SENDER_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  await transporter.sendMail({
    to,
    subject: "Password Reset Request - ChatApp",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; border: 1px solid #eee; border-radius: 8px; padding: 32px 24px; background: #fafbfc;">
        <h2 style="color: #2d3748;">Reset Your Password</h2>
        <p style="color: #4a5568; font-size: 16px;">Hello,</p>
        <p style="color: #4a5568; font-size: 16px;">
          We received a request to reset your password for your ChatApp account. Click the button below to set a new password. This link is valid for 10 minutes.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetURL}" style="display: inline-block; padding: 12px 28px; background: #3182ce; color: #fff; border-radius: 4px; text-decoration: none; font-size: 16px; font-weight: bold;">Reset Password</a>
        </div>
        <p style="color: #718096; font-size: 14px;">If you did not request a password reset, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
        <p style="color: #a0aec0; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} ChatApp. All rights reserved.</p>
      </div>
    `,
  });
};

module.exports = { sendResetEmail };
