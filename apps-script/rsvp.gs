/**
 * RSVP receiver for the wedding site.
 * Paste into Extensions → Apps Script of the Google Sheet that should collect RSVPs,
 * then deploy as a web app (see README.md → "RSVP setup").
 */
const SHEET_NAME = 'RSVPs';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) sheet.appendRow(['Time', 'Name', 'Attending', 'Guests']);

    const p = e.parameter || {};
    if (p.website) return json({ ok: true }); // honeypot filled: ignore bots quietly

    // Trim, cap length, and stop values being read as spreadsheet formulas
    const clean = v => String(v || '').trim().slice(0, 120).replace(/^[=+\-@]/, "'$&");
    sheet.appendRow([new Date(), clean(p.name), clean(p.attending), clean(p.guests)]);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false });
  } finally {
    lock.releaseLock();
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
