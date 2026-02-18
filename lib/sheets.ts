import { google } from 'googleapis';
import { InterviewData, CandidateData } from './db';

const getGoogleSheetsClient = () => {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
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
  try {
    console.log('📊 Starting Google Sheets export...');
    console.log('📊 Interview ID:', interviewId);
    console.log('📊 Candidate:', candidateData.candidate.email);
    
    console.log('🔑 Checking environment variables...');
    console.log('🔑 GOOGLE_SHEETS_SPREADSHEET_ID exists:', !!process.env.GOOGLE_SHEETS_SPREADSHEET_ID);
    console.log('🔑 GOOGLE_SERVICE_ACCOUNT_EMAIL exists:', !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    console.log('🔑 GOOGLE_PRIVATE_KEY exists:', !!process.env.GOOGLE_PRIVATE_KEY);
    console.log('🔑 Spreadsheet ID:', process.env.GOOGLE_SHEETS_SPREADSHEET_ID);
    
    const sheets = getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID not configured');
    }
    
    console.log('📝 Ensuring headers...');
    await ensureHeaders(sheets, spreadsheetId);
    console.log('✅ Headers ensured');
    
    console.log('📦 Preparing row data...');
    const rowData = prepareRowData(candidateData);
    console.log('✅ Row data prepared');
    
    console.log('🔍 Finding existing candidate...');
    const existingRowIndex = await findCandidateRow(sheets, spreadsheetId, candidateData.candidate.email);
    console.log('🔍 Existing row index:', existingRowIndex);
    
    if (existingRowIndex !== -1) {
      console.log('📝 Updating existing row...');
      await updateRow(sheets, spreadsheetId, existingRowIndex, rowData);
      console.log('✅ Row updated');
    } else {
      console.log('📝 Appending new row...');
      await appendRow(sheets, spreadsheetId, rowData);
      console.log('✅ Row appended');
    }
    
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    console.log('✅ Export complete! Sheet URL:', sheetUrl);
    return sheetUrl;
  } catch (error: any) {
    console.error('💥 Google Sheets Export Error:', error);
    console.error('💥 Error message:', error.message);
    console.error('💥 Error stack:', error.stack);
    throw new Error(`Failed to export to Google Sheets: ${error.message}`);
  }
}

async function ensureHeaders(sheets: any, spreadsheetId: string): Promise<void> {
  try {
    console.log('📋 Checking for existing headers...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A1:R1',
    });
    
    if (response.data.values?.[0]?.[0]) {
      console.log('✅ Headers already exist');
      return;
    }
  } catch (error) {
    console.log('⚠️ Headers check failed, will create new headers');
    console.error('⚠️ Error:', error);
  }
  
  console.log('📝 Creating headers...');
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
        'Recording Links',
        'Submitted At',
        'Processed At',
      ]],
    },
  });
  console.log('✅ Headers created');
  
  console.log('🎨 Formatting headers...');
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
  console.log('✅ Headers formatted');
}

function prepareRowData(candidateData: CandidateResults): any[] {
  const { candidate, results, recordings } = candidateData;
  
  const questionScores = results.questionScores.map(q => `${q.score}/2`);
  while (questionScores.length < 5) {
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
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!B:B',
    });
    
    const values = response.data.values || [];
    return values.findIndex((row: any[]) => row[0] === email);
  } catch {
    return -1;
  }
}

async function appendRow(sheets: any, spreadsheetId: string, rowData: any[]): Promise<void> {
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
  const range = `Sheet1!A${rowIndex + 1}:R${rowIndex + 1}`;
  
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
  } catch (error: any) {
    console.error('Failed to share sheet:', error);
  }
}