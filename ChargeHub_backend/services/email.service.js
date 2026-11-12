// Emails go out through Brevo's transactional email API. It uses HTTPS, so it also works on hosts that block SMTP ports.
// BREVO_API_KEY: Brevo → SMTP & API → API keys (Restricted, Transactional email: All)
// EMAIL_FROM:    a sender verified in that Brevo account (Senders, domains, IPs)
const BREVO_URL = process.env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email'; // BREVO_API_URL: tests only
const SEND_TIMEOUT_MS = 20000;

const send = async ({ to, subject, text, html }) => {
  if (!process.env.BREVO_API_KEY || !process.env.EMAIL_FROM) throw new Error('Email is not set up: BREVO_API_KEY and EMAIL_FROM are required');
  const response = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'ChargeHub', email: process.env.EMAIL_FROM }, to: [{ email: to }], subject, textContent: text, htmlContent: html }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Brevo responded ${response.status}: ${body.message || 'no details'}`);
  return { messageId: body.messageId };
};

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Send the charging-session check-in OTP to the user
exports.sendOTPEmail = (to, otp, userName, stationName, validUntil) =>
  send({
    to,
    subject: 'Your ChargeHub charging session code',
    text: `Hello ${userName}, your ChargeHub verification code for ${stationName} is ${otp}. It is valid until ${validUntil}. Share it only with the station provider.`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .otp-box { background: white; border: 2px dashed #10b981; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; }
          .otp { font-size: 36px; font-weight: bold; color: #10b981; letter-spacing: 8px; }
          .info { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #10b981; border-radius: 4px; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          .warning { color: #dc2626; font-size: 14px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚡ ChargeHub</h1>
            <p>Charging Session Verification</p>
          </div>
          <div class="content">
            <h2>Hello ${escapeHtml(userName)}!</h2>
            <p>Your charging session at <strong>${escapeHtml(stationName)}</strong> is ready to be verified.</p>
            <div class="otp-box">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">Your Verification Code</p>
              <div class="otp">${otp}</div>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">Valid until ${escapeHtml(validUntil)}</p>
            </div>
            <div class="info">
              <p><strong>📍 What's this for?</strong></p>
              <p>Share this code with the station provider to verify your charging session, then pay at the station.</p>
            </div>
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> Never share this code with anyone except the station provider. ChargeHub will never ask for it by phone or email.
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} ChargeHub. Powering your EV journey, one charge at a time.</p>
          </div>
        </div>
      </body>
      </html>
    `
  });
