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

async function getSheetIdByTitle(sheets: ReturnType<typeof getSheets>, title: string): Promise<number> {
  const res = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: "sheets.properties",
  });
  const sheet = res.data.sheets?.find((s) => s.properties?.title === title);
  if (sheet?.properties?.sheetId == null) {
    throw new Error(`Could not find sheet tab "${title}" in spreadsheet.`);
  }
  return sheet.properties.sheetId;
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
 * Inserts one new row at the top of the data (row 2, right below the
 * header) so the most recent transaction always shows first. Inserts a
 * blank row first so existing rows shift down, then writes the values into
 * it, rather than appending at the bottom.
 */
export async function appendRow(row: NewHayatRow): Promise<void> {
  const sheets = getSheets();
  const sheetId = await getSheetIdByTitle(sheets, "Sheet1");

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: 1, endIndex: 2 },
            inheritFromBefore: false,
          },
        },
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: "Sheet1!A2:H2",
    valueInputOption: "USER_ENTERED",
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

/**
 * Deletes the sheet row that was written for a given transaction (the
 * app tags its own rows with `ft:{transactionId}` in Notes, per
 * SELF_WRITE_PREFIX in hayat-sync.ts). Returns false without erroring if no
 * matching row is found — e.g. it was already removed by hand.
 */
export async function deleteRowByTransactionId(transactionId: string): Promise<boolean> {
  const sheets = getSheets();
  const rows = await getRows();
  const marker = `ft:${transactionId}`;
  const match = rows.find((r) => r.notes.includes(marker));
  if (!match) return false;

  const sheetId = await getSheetIdByTitle(sheets, "Sheet1");
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: match.rowNumber - 1, endIndex: match.rowNumber },
          },
        },
      ],
    },
  });
  return true;
}
