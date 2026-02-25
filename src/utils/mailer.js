import nodemailer from "nodemailer";
import dotenv from 'dotenv';

dotenv.config();

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendOTPEmail = async (to, otp) => {
  await transporter.sendMail({
    from: `"Your App" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Verify your email`,
    html: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EFF3F4;padding:32px 16px;font-family:'Poppins',Arial,sans-serif;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;padding:32px 28px;box-shadow:0 20px 40px rgba(69,111,182,0.12);">
              <tr>
                <td align="center" style="padding-bottom:24px;">
                  <div style="display:inline-block;padding:10px 18px;border-radius:999px;background-color:rgba(69,111,182,0.1);color:#456FB6;font-weight:600;font-size:14px;letter-spacing:0.4px;text-transform:uppercase;">
                    Email Verification
                  </div>
                </td>
              </tr>
              <tr>
                <td style="text-align:center;">
                  <h1 style="margin:0 0 16px;font-size:26px;line-height:1.3;color:#1F2937;">Verify your email address</h1>
                  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#4B5563;">
                    Use the one-time password below to finish setting up your account.
                  </p>
                  <div style="display:inline-block;padding:18px 32px;border-radius:14px;background-color:#F4F7FF;margin:12px 0 24px;">
                    <span style="font-size:32px;letter-spacing:8px;font-weight:700;color:#1F2937;">${otp}</span>
                  </div>
                  <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#6B7280;">
                    This code will expire in <strong>5 minutes</strong>.
                  </p>
                  <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#9CA3AF;">
                    Didn’t request this? You can safely ignore this email.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;text-align:center;border-top:1px solid #E5E7EB;margin-top:28px;">
                  <p style="margin:16px 0 8px;font-size:14px;color:#6B7280;">
                    Keep this code secure. Never share it with anyone.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;text-align:center;">
                  <p style="margin:0;font-size:14px;color:#6B7280;">Thanks for trusting us,</p>
                  <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#1F2937;">The Tulip Team</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `,
  });
};

export const sendInviteEmail = async ({ to, inviteLink, inviterName, companyName, role }) => {
  const prettyRole =
    typeof role === "string" && role.length
      ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
      : "User";

  await transporter.sendMail({
    from: `"${companyName || "Your App"}" <${process.env.EMAIL_USER}>`,
    to,
    subject: `You're invited to join ${companyName || "our platform"}`,
    html: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EFF3F4;padding:32px 16px;font-family:'Poppins',Arial,sans-serif;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;padding:32px 28px;box-shadow:0 20px 40px rgba(69,111,182,0.12);">
              <tr>
                <td align="center" style="padding-bottom:24px;">
                  <div style="display:inline-block;padding:10px 18px;border-radius:999px;background-color:rgba(69,111,182,0.1);color:#456FB6;font-weight:600;font-size:14px;letter-spacing:0.4px;text-transform:uppercase;">
                    Invitation
                  </div>
                </td>
              </tr>
              <tr>
                <td style="text-align:center;">
                  <h1 style="margin:0 0 16px;font-size:26px;line-height:1.3;color:#1F2937;">You're invited to join ${companyName || "Tulip"}</h1>
                  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#4B5563;">
                    <strong>${inviterName || "A teammate"}</strong> has invited you to collaborate as a ${prettyRole}.
                  </p>
                  <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#6B7280;">
                    Tap the button below to set up your account. We’ve kept everything light, modern, and easy—just like the ${companyName || "Tulip"} experience.
                  </p>
                  <a href="${inviteLink}" style="display:inline-block;background-color:#456FB6;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:16px;letter-spacing:0.3px;">
                    Accept Invitation
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding-top:28px;text-align:center;border-top:1px solid #E5E7EB;margin-top:28px;">
                  <p style="margin:16px 0 8px;font-size:14px;color:#6B7280;">
                    Having trouble with the button? Paste this link into your browser:
                  </p>
                  <p style="margin:0;font-size:14px;word-break:break-all;">
                    <a href="${inviteLink}" style="color:#456FB6;text-decoration:none;">${inviteLink}</a>
                  </p>
                  <p style="margin:24px 0 0;font-size:13px;color:#9CA3AF;">
                    This invitation expires in 7 days.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;text-align:center;">
                  <p style="margin:0;font-size:14px;color:#6B7280;">Thank you,</p>
                  <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#1F2937;">${companyName || "The Tulip Team"}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `,
  });
};

/**
 * Send email to a stakeholder when they are added to a new document.
 * @param {{ to: string, documentName: string, documentID: string, role: string, addedByName?: string, approvalLink?: string }} params
 */
export const sendDocumentStakeholderEmail = async ({
  to,
  documentName,
  documentID,
  role,
  addedByName,
  approvalLink,
}) => {
  const prettyRole =
    typeof role === "string" && role.length
      ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
      : "Stakeholder";
  const addedBy = addedByName && addedByName.trim() ? addedByName.trim() : "A teammate";

  const hasApprovalLink = approvalLink && approvalLink.trim().length > 0;
  const ctaBlock = hasApprovalLink
    ? `
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#6B7280;">
        Use the button below to open the document and submit your review or approval. This link is unique to you and expires in 30 days.
      </p>
      <a href="${approvalLink}" style="display:inline-block;background-color:#456FB6;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:16px;letter-spacing:0.3px;">
        Review &amp; Approve Document
      </a>
      <p style="margin:24px 0 0;font-size:14px;color:#6B7280;">
        Having trouble with the button? Paste this link into your browser:
      </p>
      <p style="margin:8px 0 0;font-size:14px;word-break:break-all;">
        <a href="${approvalLink}" style="color:#456FB6;text-decoration:none;">${approvalLink}</a>
      </p>
    `
    : `
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#6B7280;">
        Log in to Tulip to view the document and complete your review or approval.
      </p>
    `;

  await transporter.sendMail({
    from: `"Tulip" <${process.env.EMAIL_USER}>`,
    to,
    subject: `You've been added as ${prettyRole} to document: ${documentName || documentID}`,
    html: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EFF3F4;padding:32px 16px;font-family:'Poppins',Arial,sans-serif;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;padding:32px 28px;box-shadow:0 20px 40px rgba(69,111,182,0.12);">
              <tr>
                <td align="center" style="padding-bottom:24px;">
                  <div style="display:inline-block;padding:10px 18px;border-radius:999px;background-color:rgba(69,111,182,0.1);color:#456FB6;font-weight:600;font-size:14px;letter-spacing:0.4px;text-transform:uppercase;">
                    Document Stakeholder
                  </div>
                </td>
              </tr>
              <tr>
                <td style="text-align:center;">
                  <h1 style="margin:0 0 16px;font-size:26px;line-height:1.3;color:#1F2937;">You've been added to a document</h1>
                  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#4B5563;">
                    <strong>${addedBy}</strong> has added you as a <strong>${prettyRole}</strong> to the following document.
                  </p>
                  <div style="display:inline-block;padding:18px 24px;border-radius:14px;background-color:#F4F7FF;margin:12px 0 24px;text-align:left;">
                    <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">Document</p>
                    <p style="margin:0;font-size:18px;font-weight:600;color:#1F2937;">${documentName || "Untitled"}</p>
                    <p style="margin:8px 0 0;font-size:13px;color:#9CA3AF;">ID: ${documentID || "—"}</p>
                  </div>
                  ${ctaBlock}
                </td>
              </tr>
              <tr>
                <td style="padding-top:24px;text-align:center;border-top:1px solid #E5E7EB;">
                  <p style="margin:0;font-size:14px;color:#6B7280;">Thank you,</p>
                  <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#1F2937;">The Tulip Team</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `,
  });
};