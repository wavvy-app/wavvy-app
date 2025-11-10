import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface CandidateConfirmationEmailProps {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  questionsCount: number;
  submittedDate: string;
}

interface RecruiterNotificationEmailProps {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  interviewId: string;
  overallScore?: number;
  recruiterEmail: string;
}

interface RecruiterResultsEmailProps {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  overallScore: number;
  topStrengths: string[];
  areasToImprove: string[];
  sheetUrl: string;
  recruiterEmail: string;
  questionsCount?: number;
  submittedDate?: string;
}

export async function sendCandidateConfirmationEmail({
  candidateName,
  candidateEmail,
  jobTitle,
  questionsCount,
  submittedDate,
}: CandidateConfirmationEmailProps) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Wavvy Interviews <onboarding@resend.dev>',
      to: candidateEmail,
      subject: `Interview Submitted - ${jobTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Interview Confirmation</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6;">
            
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
                <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 600; letter-spacing: -0.5px;">Interview Submitted Successfully</h1>
              </div>
              
              <div style="background: white; padding: 32px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
                
                <p style="font-size: 16px; margin: 0 0 8px 0; color: #6b7280;">Hi <strong style="color: #1f2937;">${candidateName}</strong>,</p>
                
                <p style="font-size: 16px; margin: 0 0 24px 0; color: #4b5563;">
                  Thank you for completing your video interview for the <strong style="color: #1f2937;">${jobTitle}</strong> position!
                </p>
                
                <p style="font-size: 16px; margin: 0 0 32px 0; color: #4b5563;">
                  We've received your responses and our team will review them shortly.
                </p>
                
                <div style="background: linear-gradient(135deg, #f0f4ff 0%, #e5edff 100%); padding: 24px; border-radius: 10px; margin-bottom: 24px; border: 1px solid #dbeafe;">
                  <h2 style="font-size: 17px; margin: 0 0 16px 0; color: #1e40af; font-weight: 600;">Interview Details</h2>
                  <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #dbeafe;">
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #dbeafe; color: #4b5563; font-size: 15px;">Position:</td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #dbeafe; color: #1f2937; font-weight: 500; font-size: 15px; text-align: right;">${jobTitle}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #dbeafe; color: #4b5563; font-size: 15px;">Questions Answered:</td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #dbeafe; color: #1f2937; font-weight: 500; font-size: 15px; text-align: right;">${questionsCount}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; color: #4b5563; font-size: 15px;">Submitted:</td>
                      <td style="padding: 10px 0; color: #1f2937; font-weight: 500; font-size: 15px; text-align: right;">${submittedDate}</td>
                    </tr>
                  </table>
                </div>
                
                <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 24px; border-radius: 10px; border-left: 4px solid #10b981;">
                  <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #065f46; font-weight: 600;">What's Next?</h3>
                  <p style="margin: 0; font-size: 15px; color: #047857; line-height: 1.6;">
                    Our team is carefully reviewing your responses and will reach out with next steps.
                  </p>
                </div>
                
              </div>
              
              <div style="background: white; padding: 24px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); text-align: center;">
                <p style="font-size: 14px; color: #6b7280; margin: 0 0 16px 0;">
                  If you have any questions, feel free to reply to this email.
                </p>
                <p style="font-size: 15px; margin: 0; color: #4b5563;">
                  Best regards,<br/>
                  <strong style="color: #1f2937;">The Hiring Team</strong>
                </p>
              </div>
              
              <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
                <p style="margin: 5px 0;">This is an automated message from Wavvy Interview Platform</p>
                <p style="margin: 5px 0;">© 2024 Wavvy. All rights reserved.</p>
              </div>
              
            </div>
            
          </body>
        </html>
      `,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, emailId: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Email sending failed: ${message}`);
  }
}

export async function sendRecruiterResultsEmail({
  candidateName,
  candidateEmail,
  jobTitle,
  overallScore,
  topStrengths,
  areasToImprove,
  sheetUrl,
  recruiterEmail,
  questionsCount,
  submittedDate,
}: RecruiterResultsEmailProps) {
  try {
    const scoreColor = overallScore >= 7 ? '#10b981' : overallScore >= 5 ? '#f59e0b' : '#ef4444';
    const scoreEmoji = '⭐';

    const { data, error } = await resend.emails.send({
      from: 'Wavvy Interviews <onboarding@resend.dev>',
      to: recruiterEmail,
      subject: `Interview Results: ${candidateName} - ${jobTitle} (${overallScore}/10)`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Interview Results</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6;">
            
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
                <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 600; letter-spacing: -0.5px;">Interview Results Ready</h1>
              </div>
              
              <div style="background: white; padding: 32px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
                
                <h2 style="font-size: 20px; margin: 0 0 8px 0; color: #1f2937; font-weight: 600;">Candidate: ${candidateName}</h2>
                
                ${questionsCount && submittedDate ? `
                <p style="font-size: 14px; margin: 0 0 24px 0; color: #6b7280;">
                  Interview completed: ${submittedDate} | ${questionsCount} questions answered
                </p>
                ` : ''}
                
                <div style="background: linear-gradient(135deg, #f0f4ff 0%, #e5edff 100%); padding: 24px; border-radius: 10px; margin-bottom: 24px; border: 1px solid #dbeafe;">
                  <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #dbeafe;">
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #dbeafe; color: #4b5563; font-size: 15px;">Position:</td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #dbeafe; color: #1f2937; font-weight: 500; font-size: 15px; text-align: right;">${jobTitle}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #dbeafe; color: #4b5563; font-size: 15px;">Email:</td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #dbeafe; color: #1f2937; font-weight: 500; font-size: 15px; text-align: right;">${candidateEmail}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; color: #4b5563; font-size: 15px;">Overall Score:</td>
                      <td style="padding: 10px 0; text-align: right;">
                        <span style="font-size: 20px; font-weight: 600; color: ${scoreColor};">${scoreEmoji} ${overallScore}/10</span>
                      </td>
                    </tr>
                  </table>
                </div>
                
                <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); padding: 24px; border-radius: 10px; margin-bottom: 20px; border-left: 4px solid #10b981;">
                  <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #065f46; font-weight: 600;">Top Strengths</h3>
                  <ul style="margin: 0; padding-left: 20px; color: #047857;">
                    ${topStrengths.map(s => `<li style="margin-bottom: 8px; font-size: 15px;">${s}</li>`).join('')}
                  </ul>
                </div>
                
                <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 24px; border-radius: 10px; margin-bottom: 30px; border-left: 4px solid #f59e0b;">
                  <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #92400e; font-weight: 600;">Areas to Improve</h3>
                  <ul style="margin: 0; padding-left: 20px; color: #b45309;">
                    ${areasToImprove.map(a => `<li style="margin-bottom: 8px; font-size: 15px;">${a}</li>`).join('')}
                  </ul>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${sheetUrl}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                    View Full Results in Google Sheets
                  </a>
                </div>
                
                <p style="font-size: 13px; color: #9ca3af; text-align: center; margin: 20px 0 0 0;">
                  Powered by AI-driven interview analysis
                </p>
                
              </div>
              
              <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
                <p style="margin: 5px 0;">Powered by Wavvy Interview Platform</p>
                <p style="margin: 5px 0;">© 2024 Wavvy. All rights reserved.</p>
              </div>
              
            </div>
            
          </body>
        </html>
      `,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, emailId: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Email sending failed: ${message}`);
  }
}

export async function sendRecruiterNotificationEmail({
  candidateName,
  candidateEmail,
  jobTitle,
  interviewId,
  overallScore,
  recruiterEmail,
}: RecruiterNotificationEmailProps) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Wavvy Interviews <onboarding@resend.dev>',
      to: recruiterEmail,
      subject: `New Interview Submission - ${candidateName} for ${jobTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Interview Submission</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background: #f3f4f6;">
            
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
                <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 600; letter-spacing: -0.5px;">New Interview Submission</h1>
              </div>
              
              <div style="background: white; padding: 32px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);">
                
                <p style="font-size: 16px; margin: 0 0 24px 0; color: #4b5563;">
                  <strong style="color: #1f2937;">${candidateName}</strong> has completed their interview for the <strong style="color: #1f2937;">${jobTitle}</strong> position.
                </p>
                
                <div style="background: linear-gradient(135deg, #f0f4ff 0%, #e5edff 100%); padding: 24px; border-radius: 10px; margin-bottom: 24px; border: 1px solid #dbeafe;">
                  <h3 style="font-size: 17px; margin: 0 0 16px 0; color: #1e40af; font-weight: 600;">Candidate Details</h3>
                  <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #dbeafe;">
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #dbeafe; color: #4b5563; font-size: 15px;">Name:</td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #dbeafe; color: #1f2937; font-weight: 500; font-size: 15px; text-align: right;">${candidateName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #dbeafe; color: #4b5563; font-size: 15px;">Email:</td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #dbeafe; color: #1f2937; font-weight: 500; font-size: 15px; text-align: right;">${candidateEmail}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; ${overallScore ? 'border-bottom: 1px solid #dbeafe;' : ''} color: #4b5563; font-size: 15px;">Position:</td>
                      <td style="padding: 10px 0; ${overallScore ? 'border-bottom: 1px solid #dbeafe;' : ''} color: #1f2937; font-weight: 500; font-size: 15px; text-align: right;">${jobTitle}</td>
                    </tr>
                    ${overallScore ? `
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #dbeafe; color: #4b5563; font-size: 15px;">Initial Score:</td>
                      <td style="padding: 10px 0; border-bottom: 1px solid #dbeafe; color: #1f2937; font-weight: 500; font-size: 15px; text-align: right;">${overallScore}/10</td>
                    </tr>
                    ` : ''}
                    <tr>
                      <td style="padding: 10px 0; color: #4b5563; font-size: 15px;">Interview ID:</td>
                      <td style="padding: 10px 0; color: #1f2937; font-weight: 500; font-size: 15px; text-align: right;">${interviewId}</td>
                    </tr>
                  </table>
                </div>
                
                <p style="font-size: 15px; margin: 0; color: #4b5563;">
                  Review the full interview results in your dashboard or Google Sheet.
                </p>
                
              </div>
              
              <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
                <p style="margin: 5px 0;">This is an automated notification from Wavvy Interview Platform</p>
                <p style="margin: 5px 0;">© 2024 Wavvy. All rights reserved.</p>
              </div>
              
            </div>
            
          </body>
        </html>
      `,
    });

    if (error) {
      throw new Error(error.message);
    }

    return { success: true, emailId: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Email sending failed: ${message}`);
  }
}