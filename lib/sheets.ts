import { google } from 'googleapis';
import { InterviewData, CandidateData } from './db';

const getGoogleSheetsClient = () => {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  console.log('[Sheets] Initializing client...');
  console.log('[Sheets] Service account email:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  console.log('[Sheets] Private key exists:', !!privateKey);

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });

  return google.sheets({ version: 'v4', auth });
};

interface CandidateResults {
  candidate: CandidateData;
  interview: InterviewData;
  results: {
    overallScore: number;
    overallFeedback: string;
    topStrengths: string[];
    areasToImprove: string[];
    questionScores: Array<{
      question: string;
      transcript: string;
      score: number;
      reasoning: string;
    }>;
  };
  recordings: Array<{
    question_index: number;
    video_url: string;
  }>;
}

export async function exportToGoogleSheets(
  interviewId: string,
  interviewTitle: string,
  candidateData: CandidateResults
): Promise<string> {
  console.log('[Sheets] exportToGoogleSheets called');
  console.log('[Sheets] Interview ID:', interviewId);
  console.log('[Sheets] Candidate email:', candidateData.candidate.email);

  try {
    const sheets = getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    console.log('[Sheets] Spreadsheet ID:', spreadsheetId);

    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID not configured');
    }

    console.log('[Sheets] Ensuring headers...');
    await ensureHeaders(sheets, spreadsheetId);

    const rowData = prepareRowData(candidateData);
    console.log('[Sheets] Row data prepared, columns:', rowData.length);
    console.log('[Sheets] Row data preview:', rowData.slice(0, 6));

    const existingRowIndex = await findCandidateRow(sheets, spreadsheetId, candidateData.candidate.email);
    console.log('[Sheets] Existing row index:', existingRowIndex, '(-1 means not found)');

    if (existingRowIndex !== -1) {
      console.log('[Sheets] Updating existing row at index:', existingRowIndex);
      await updateRow(sheets, spreadsheetId, existingRowIndex, rowData);
      console.log('[Sheets] Row updated successfully');
    } else {
      console.log('[Sheets] Appending new row...');
      await appendRow(sheets, spreadsheetId, rowData);
      console.log('[Sheets] Row appended successfully');
    }

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    console.log('[Sheets] Export complete:', url);
    return url;
  } catch (error: any) {
    console.error('[Sheets] ERROR:', error.message);
    console.error('[Sheets] Full error:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to export to Google Sheets: ${error.message}`);
  }
}

async function ensureHeaders(sheets: any, spreadsheetId: string): Promise<void> {
  try {
    console.log('[Sheets] Checking for existing headers...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A1:AF1',
    });

    console.log('[Sheets] A1 value:', response.data.values?.[0]?.[0]);

    if (response.data.values?.[0]?.[0]) {
      console.log('[Sheets] Headers already exist, skipping');
      return;
    }
  } catch (error: any) {
    console.warn('[Sheets] Could not read headers (may not exist yet):', error.message);
  }

  console.log('[Sheets] Writing headers...');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Sheet1!A1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        'Name',
        'Email',
        'Phone',
        'Years Experience',
        'Salary Expectations',
        'Overall Score (/10)',
        'Status',
        'Top Strengths',
        'Areas to Improve',
        'Overall Feedback',
        'Q1 Score',
        'Q2 Score',
        'Q3 Score',
        'Q4 Score',
        'Q5 Score',
        'Q6 Score',
        'Q7 Score',
        'Q8 Score',
        'Q9 Score',
        'Q10 Score',
        'Q11 Score',
        'Q12 Score',
        'Q13 Score',
        'Q14 Score',
        'Q15 Score',
        'Recording Links',
        'Submitted At',
        'Processed At',
      ]],
    },
  });
  console.log('[Sheets] Headers written');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 0,
            endRowIndex: 1,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.4, green: 0.5, blue: 0.9 },
              textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat)',
        },
      }],
    },
  });
  console.log('[Sheets] Header styling applied');
}

function prepareRowData(candidateData: CandidateResults): any[] {
  const { candidate, results, recordings } = candidateData;

  const questionScores = results.questionScores.map(q => `${q.score}/2`);
  while (questionScores.length < 15) {
    questionScores.push('N/A');
  }

  const recordingLinks = recordings
    .map((r, i) => `Q${i + 1}: ${r.video_url}`)
    .join('\n');

  return [
    candidate.name,
    candidate.email,
    candidate.phone || 'N/A',
    candidate.years_experience,
    candidate.salary_expectations,
    results.overallScore.toFixed(1),
    candidate.status,
    results.topStrengths.join(', '),
    results.areasToImprove.join(', '),
    results.overallFeedback,
    ...questionScores,
    recordingLinks,
    candidate.registered_at,
    (candidateData.results as any).processedAt || new Date().toISOString(),
  ];
}

async function findCandidateRow(
  sheets: any,
  spreadsheetId: string,
  email: string
): Promise<number> {
  console.log('[Sheets] Searching for candidate email:', email);
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!B:B',
    });

    const values = response.data.values || [];
    console.log('[Sheets] Total rows in email column:', values.length);

    const index = values.findIndex((row: any[]) => row[0] === email);
    console.log('[Sheets] Found at index:', index);
    return index;
  } catch (error: any) {
    console.warn('[Sheets] Could not search for candidate:', error.message);
    return -1;
  }
}

async function appendRow(sheets: any, spreadsheetId: string, rowData: any[]): Promise<void> {
  console.log('[Sheets] Appending to Sheet1!A2...');
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Sheet1!A2',
    valueInputOption: 'RAW',
    requestBody: {
      values: [rowData],
    },
  });
}

async function updateRow(
  sheets: any,
  spreadsheetId: string,
  rowIndex: number,
  rowData: any[]
): Promise<void> {
  // Convert column number to letter(s) - handles AA, AB, etc.
  const getColumnLetter = (col: number): string => {
    let letter = '';
    while (col > 0) {
      const remainder = (col - 1) % 26;
      letter = String.fromCharCode(65 + remainder) + letter;
      col = Math.floor((col - 1) / 26);
    }
    return letter;
  };

  const lastColumn = getColumnLetter(rowData.length);
  const range = `Sheet1!A${rowIndex + 1}:${lastColumn}${rowIndex + 1}`;
  console.log('[Sheets] Updating range:', range);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: {
      values: [rowData],
    },
  });
}

export async function shareSpreadsheet(
  spreadsheetId: string,
  emailToShare: string
): Promise<void> {
  console.log('[Sheets] Sharing spreadsheet with:', emailToShare);
  try {
    const drive = google.drive({ version: 'v3', auth: getGoogleSheetsClient().context._options.auth });

    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        type: 'user',
        role: 'reader',
        emailAddress: emailToShare,
      },
    });
    console.log('[Sheets] Spreadsheet shared successfully');
  } catch (error: any) {
    console.error('[Sheets] Failed to share sheet:', error.message);
  }
}