import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;
const DATA_RANGE = "Sheet1!A2:H";

export type HayatRow = {
  /** 1-based row number in the sheet (row 1 is the header). */
  rowNumber: number;
  date: string;
  description: string;
  tag: string;
  amount: number;
  paidBy: "Aybala" | "Erdem";
  aylasShare: number;
  erdemsShare: number;
  notes: string;
};

export type NewHayatRow = {
  date: string;
  description: string;
  tag: string;
  amount: number;
  paidBy: "Aybala" | "Erdem";
  aylasShare: number;
  erdemsShare: number;
  notes: string;
};

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error("Google service account credentials are not set.");
  }
  const key = rawKey.replace(/\\n/g, "\n");
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

function rowToHayatRow(row: string[], index: number): HayatRow {
  const paidByRaw = row[4] ?? "";
  const paidBy: "Aybala" | "Erdem" = paidByRaw === "Erdem" ? "Erdem" : "Aybala";
  return {
    rowNumber: index + 2, // +2: skip header (row 1), convert 0-based index to 1-based row
    date: row[0] ?? "",
    description: row[1] ?? "",
    tag: row[2] ?? "",
    amount: parseFloat(row[3]) || 0,
    paidBy,
    aylasShare: parseFloat(row[5]) || 0,
    erdemsShare: parseFloat(row[6]) || 0,
    notes: row[7] ?? "",
  };
}

/** Reads every data row (row 2 onward) from the shared Hayat sheet. */
export async function getRows(): Promise<HayatRow[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: DATA_RANGE,
  });
  const rows = (res.data.values ?? []) as string[][];
  return rows.map((row, i) => rowToHayatRow(row, i));
}

/**
 * Appends one new row at the end of the sheet. Uses values.append with
 * INSERT_ROWS so the row always lands physically at the bottom — this keeps
 * row numbers stable for every previously-read row, which updateNotes below
 * depends on.
 */
export async function appendRow(row: NewHayatRow): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: DATA_RANGE,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [
        [
          row.date,
          row.description,
          row.tag,
          row.amount,
          row.paidBy,
          row.aylasShare,
          row.erdemsShare,
          row.notes,
        ],
      ],
    },
  });
}

/** Overwrites just the Notes cell (column H) of the given 1-based row. */
export async function updateNotes(rowNumber: number, notes: string): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Sheet1!H${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[notes]],
    },
  });
}
