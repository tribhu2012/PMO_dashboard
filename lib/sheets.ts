import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

export async function getSheet(tabName: string) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: tabName,
  });
  const [headers, ...rows] = res.data.values || [];
  return rows.map(row =>
    Object.fromEntries(headers.map((h: string, i: number) => [h, row[i] ?? '']))
  );
}

export async function appendRow(tabName: string, values: string[]) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: tabName,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });
}

export async function updateRow(
  tabName: string,
  rowIndex: number, // 1-based, add 2 to skip header
  values: string[]
) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });
}

export async function appendRows(tabName: string, values: string[][]) {
  if (!values.length) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: tabName,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}

export async function batchUpdateRows(data: { range: string; values: any[][] }[]) {
  if (!data.length) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data,
    },
  });
}