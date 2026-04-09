/**
 * ╔══════════════════════════════════════════════════════════╗
 *   A2Z CYBER — Google Apps Script for Google Sheets
 *   ► HOW TO DEPLOY (MUST FOLLOW EXACTLY) ◄
 *
 *   1. Open your Google Sheet
 *   2. Click "Extensions" → "Apps Script"
 *   3. Delete everything in "Code.gs"
 *   4. Paste the entire contents of THIS FILE
 *   5. Click "Deploy" → "New Deployment"
 *   6. Click "Select type" gear icon → "Web App"
 *      - Description: A2Z Billing API
 *      - Execute as: Me (your-email@gmail.com)
 *      - Who has access: ANYONE (CRITICAL: Do not select "Anyone with Google Account")
 *   7. Click "Deploy". If prompted, "Authorize Access".
 *   8. Copy the "Web App URL" (it ends in /exec).
 *   9. Paste that URL in A2Z CYBER → Settings → Webhook URL.
 * ╚══════════════════════════════════════════════════════════╝
 */

const SHEET_NAME    = 'A2Z Transactions';
const CONFIG_SHEET  = 'A2Z Config';          // ← NEW: stores app config for all devices
const SUMMARY_SHEET = 'Daily Summary';

const HEADERS = [
  'S.No', 'Date', 'Time', 'Customer Name', 'Mobile',
  'Staff', 'Service', 'Job Type', 'Duration / Items',
  'Amount (₹)', 'Payment Mode', 'Start Time', 'End Time', 'Notes', 'Transaction ID'
];

// ─────────────────────────────────────────────────────────
//  HELPER: get or create Transactions sheet
// ─────────────────────────────────────────────────────────
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
    headerRange.setValues([HEADERS]);
    headerRange.setBackground('#050b14');
    headerRange.setFontColor('#00c8ff');
    headerRange.setFontWeight('bold');
    headerRange.setFontSize(10);
    sheet.setFrozenRows(1);
    for (let i = 1; i <= HEADERS.length; i++) {
      sheet.setColumnWidth(i, 140);
    }
  }

  // Ensure all expected headers exist (upgrade path)
  const hdrRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  HEADERS.forEach((h, i) => {
    if (!hdrRow[i]) sheet.getRange(1, i + 1).setValue(h);
  });

  return sheet;
}

// ─────────────────────────────────────────────────────────
//  HELPER: get or create Config sheet
// ─────────────────────────────────────────────────────────
function getOrCreateConfigSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG_SHEET);
    sheet.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]);
    sheet.getRange(1, 1, 1, 2).setBackground('#050b14').setFontColor('#00c8ff').setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 200);
    sheet.setColumnWidth(2, 600);
  }
  return sheet;
}

// ─────────────────────────────────────────────────────────
//  CONFIG READ
// ─────────────────────────────────────────────────────────
function readConfig() {
  const sheet = getOrCreateConfigSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const config = {};
  data.forEach(row => {
    if (row[0]) {
      try { config[row[0]] = JSON.parse(row[1]); }
      catch(e) { config[row[0]] = row[1]; }
    }
  });
  return config;
}

// ─────────────────────────────────────────────────────────
//  CONFIG WRITE
// ─────────────────────────────────────────────────────────
function writeConfig(key, value) {
  const sheet = getOrCreateConfigSheet();
  const lastRow = sheet.getLastRow();
  const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

  if (lastRow >= 2) {
    const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 2, 2).setValue(valueStr);
        return;
      }
    }
  }
  // Key not found → append
  sheet.appendRow([key, valueStr]);
}

// ─────────────────────────────────────────────────────────
//  doPost — main entry point for all POST requests
// ─────────────────────────────────────────────────────────
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('No data received in postData');
    }

    const payload = JSON.parse(e.postData.contents);
    const action  = payload.action || 'upsert';

    // ── CONFIG actions ──────────────────────────────────
    if (action === 'saveConfig') {
      // payload.config = { staffList, services, rushItems, quotes, webhookUrl }
      const configToSave = payload.config || {};
      Object.keys(configToSave).forEach(key => {
        writeConfig(key, configToSave[key]);
      });
      return ok({ message: 'Config saved' });
    }

    if (action === 'getConfig') {
      const config = readConfig();
      return ok(config);
    }

    // ── Transaction actions (existing) ──────────────────
    const sheet = getOrCreateSheet();
    const data  = payload.transaction || payload;
    const targetId  = data.id || '';
    const lastRow   = sheet.getLastRow();

    let existingRowIndex = -1;
    if (targetId && lastRow > 1) {
      const ids = sheet.getRange(2, 15, lastRow - 1, 1).getValues(); // col 15 = Transaction ID
      for (let i = 0; i < ids.length; i++) {
        if (ids[i][0] === targetId) {
          existingRowIndex = i + 2;
          break;
        }
      }
    }

    if (action === 'delete') {
      if (existingRowIndex > -1) sheet.deleteRow(existingRowIndex);
      return ok({ message: 'Deleted' });
    }

    // UPSERT
    const now   = new Date();
    const txDate = data.date ? new Date(data.date) : now;

    let durationStr = data.displayDuration || '';
    if (data.jobType === 'timer' && !durationStr && data.durationMinutes) {
      durationStr = `${data.durationMinutes} min`;
    } else if (data.items && data.items.length && !durationStr) {
      durationStr = data.items.map(i => `${i.name}×${i.qty}@₹${i.price}`).join(', ');
    }

    const row = [
      existingRowIndex > -1 ? sheet.getRange(existingRowIndex, 1).getValue() : lastRow,
      txDate.toLocaleDateString('en-IN'),
      txDate.toLocaleTimeString('en-IN'),
      data.customerName || '',
      data.mobile || '',
      data.staff || '',
      data.service || '',
      data.jobType || '',
      durationStr,
      parseFloat(data.amount || 0).toFixed(2),
      data.paymentMode || 'cash',                                    // Payment Mode
      data.startTime ? new Date(data.startTime).toLocaleTimeString('en-IN') : '',
      data.endTime   ? new Date(data.endTime).toLocaleTimeString('en-IN')   : '',
      data.notes || '',
      targetId
    ];

    if (existingRowIndex > -1) {
      sheet.getRange(existingRowIndex, 1, 1, HEADERS.length).setValues([row]);
    } else {
      sheet.appendRow(row);
      const newLastRow = sheet.getLastRow();
      sheet.getRange(newLastRow, 10).setFontColor('#006644').setFontWeight('bold');
      if (newLastRow % 2 === 0) {
        sheet.getRange(newLastRow, 1, 1, HEADERS.length).setBackground('#f8fff8');
      }
      updateDailySummary(data);
    }

    return ok({ row: existingRowIndex > -1 ? existingRowIndex : sheet.getLastRow() });

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─────────────────────────────────────────────────────────
//  doGet — returns transactions list OR config based on ?action=
// ─────────────────────────────────────────────────────────
function doGet(e) {
  try {
    const action = e && e.parameter && e.parameter.action;
    const callback = e && e.parameter && e.parameter.callback;

    let result;
    if (action === 'getConfig') {
      result = readConfig();
    } else {
      const sheet = getOrCreateSheet();
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        result = [];
      } else {
        const data = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
        result = data.map(r => ({
          date: r[1] instanceof Date ? r[1].toISOString() : r[1],
          customerName: r[3],
          mobile: r[4], staff: r[5], service: r[6], jobType: r[7],
          displayDuration: r[8], amount: r[9], paymentMode: r[10] || 'cash',
          notes: r[13], id: r[14] || ''
        }));
      }
    }

    if (callback) {
      const output = callback + "(" + JSON.stringify(result) + ")";
      return ContentService.createTextOutput(output).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    const cb = e && e.parameter && e.parameter.callback;
    if (cb) return ContentService.createTextOutput(cb + "(" + JSON.stringify({error: err.toString()}) + ")").setMimeType(ContentService.MimeType.JAVASCRIPT);
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─────────────────────────────────────────────────────────
//  HELPER: return JSON response
// ─────────────────────────────────────────────────────────
function ok(data) {
  const body = typeof data === 'string' ? data : JSON.stringify({ status: 'success', ...( Array.isArray(data) ? { data } : data ) });
  // If data is already an array wrap it properly
  const out = Array.isArray(data) ? JSON.stringify(data) : JSON.stringify({ status: 'success', ...data });
  return ContentService
    .createTextOutput(out)
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────────────────
//  Daily Summary (unchanged from before)
// ─────────────────────────────────────────────────────────
function updateDailySummary(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let summary = ss.getSheetByName(SUMMARY_SHEET);

  if (!summary) {
    summary = ss.insertSheet(SUMMARY_SHEET);
    summary.getRange(1, 1, 1, 5).setValues([['Date', 'Total Customers', 'Total Income (₹)', 'Timer Jobs', 'Service Jobs']]);
    summary.getRange(1, 1, 1, 5).setBackground('#050b14').setFontColor('#00c8ff').setFontWeight('bold');
    summary.setFrozenRows(1);
  }

  const today = new Date().toLocaleDateString('en-IN');
  const values = summary.getDataRange().getValues();
  let found = false;

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === today) {
      summary.getRange(i + 1, 2).setValue(values[i][1] + 1);
      summary.getRange(i + 1, 3).setValue(parseFloat(values[i][2] || 0) + parseFloat(data.amount || 0));
      if (data.jobType === 'timer')   summary.getRange(i + 1, 4).setValue(values[i][3] + 1);
      if (data.jobType === 'service') summary.getRange(i + 1, 5).setValue(values[i][4] + 1);
      found = true;
      break;
    }
  }

  if (!found) {
    summary.appendRow([
      today,
      1,
      parseFloat(data.amount || 0).toFixed(2),
      data.jobType === 'timer'   ? 1 : 0,
      data.jobType === 'service' ? 1 : 0
    ]);
  }
}
