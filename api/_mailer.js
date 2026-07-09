import nodemailer from 'nodemailer';

// Free email sending via a regular Gmail account + an "App Password" (not
// your normal Gmail password -- generate one at
// https://myaccount.google.com/apppasswords with 2-Step Verification turned
// on). No paid email service required. Add these two values as environment
// variables in the Vercel project settings:
//   GMAIL_USER          -- the Gmail address to send from
//   GMAIL_APP_PASSWORD  -- the 16-character app password (no spaces)
// Until both are set, sendMail() throws a clear error instead of silently
// failing, so callers can surface a useful message.
let transporter = null;

function getTransporter() {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    const err = new Error(
      'Email sending is not configured yet -- add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel project settings.'
    );
    err.status = 503;
    throw err;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

export async function sendMail({ to, subject, text, html, attachments }) {
  const t = getTransporter();
  return t.sendMail({
    from: `"Hearth" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
    attachments,
  });
}
