import { NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';
import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

export async function POST() {
  try {
    const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;

    // Get current headers
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'issues!1:1',
    });

    const headers = headerRes.data.values[0] || [];
    
    // Check if issue_type already exists
    if (headers.includes('issue_type')) {
      return NextResponse.json({ message: 'issue_type column already exists' });
    }

    // Add issue_type to the headers
    headers.push('issue_type');

    // Update the header row
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'issues!1:1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });

    return NextResponse.json({ 
      success: true,
      message: 'issue_type column added',
      headers
    });
  } catch (error) {
    console.error('Error adding column:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
