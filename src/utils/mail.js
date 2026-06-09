import Mailgen from "mailgen";
import nodemailer from "nodemailer";

/**
 * Build a nodemailer transporter from environment variables.
 *
 * Priority:
 *   1. Resend  — set RESEND_API_KEY              (recommended for production)
 *   2. Generic SMTP — set SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
 *   3. Mailtrap sandbox — legacy fallback for local dev
 */
const createTransporter = () => {
  // 1. Resend (https://resend.com) — free 3 000 emails/month
  if (process.env.RESEND_API_KEY) {
    return nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: {
        user: "resend",
        pass: process.env.RESEND_API_KEY,
      },
    });
  }

  // 2. Generic SMTP (SendGrid, Postmark, Brevo, your own server …)
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // 3. Mailtrap sandbox — local dev only, emails never reach real inboxes
  return nodemailer.createTransport({
    host: process.env.MAILTRAP_SMTP_HOST || "sandbox.smtp.mailtrap.io",
    port: Number(process.env.MAILTRAP_SMTP_PORT) || 2525,
    auth: {
      user: process.env.MAILTRAP_SMTP_USER,
      pass: process.env.MAILTRAP_SMTP_PASS,
    },
  });
};

/**
 * The "from" address shown to recipients.
 * Use a verified sender on your domain when possible.
 * Resend's shared domain: onboarding@resend.dev (works out of the box)
 */
const getSenderAddress = () => {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  if (process.env.RESEND_API_KEY) return "Project Camp <onboarding@resend.dev>";
  return "Project Camp <noreply@project-camp.app>";
};

const sendEmail = async (options) => {
  const mailGenerator = new Mailgen({
    theme: "default",
    product: {
      name: "Project Camp",
      link:
        process.env.SERVER_URL ||
        "https://project-manager-bee024s-projects.vercel.app",
    },
  });

  const emailTextual = mailGenerator.generatePlaintext(options.mailgenContent);
  const emailHtml = mailGenerator.generate(options.mailgenContent);

  const transporter = createTransporter();

  const mail = {
    from: getSenderAddress(),
    to: options.email,
    subject: options.subject,
    text: emailTextual,
    html: emailHtml,
  };

  try {
    await transporter.sendMail(mail);
  } catch (error) {
    // Log but don't crash — registration still succeeds even if email fails
    console.error("[mail] Failed to send email to", options.email);
    console.error("[mail]", error.message);
  }
};

const emailVerificationMailgenContent = (username, verificationUrl) => {
  return {
    body: {
      name: username,
      intro: "Welcome to Project Camp! We're excited to have you on board.",
      action: {
        instructions:
          "Please verify your email address by clicking the button below. This link expires in 20 minutes.",
        button: {
          color: "#0f766e",
          text: "Verify my email",
          link: verificationUrl,
        },
      },
      outro:
        "If you didn't create an account, you can safely ignore this email.",
    },
  };
};

const forgotPasswordMailgenContent = (username, passwordResetUrl) => {
  return {
    body: {
      name: username,
      intro: "We received a request to reset your Project Camp password.",
      action: {
        instructions:
          "Click the button below to set a new password. This link expires in 20 minutes.",
        button: {
          color: "#0f766e",
          text: "Reset my password",
          link: passwordResetUrl,
        },
      },
      outro:
        "If you didn't request a password reset, you can safely ignore this email.",
    },
  };
};

export {
  emailVerificationMailgenContent,
  forgotPasswordMailgenContent,
  sendEmail,
};
