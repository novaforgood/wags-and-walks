const RESET_SPREADSHEET_ID = '1qGIwSyxDdK9L-9OL7aqACq5NUN3-0ZrtouwP8YTKA';
const RESET_SHEET_NAME = 'Form_Responses';
const STATUS_COLUMN_HEADER = 'Applicant Status';
const RESET_TO_STATUS = 'new';

function resetAllStatusesToNew() {
  const ss = SpreadsheetApp.openById(RESET_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(RESET_SHEET_NAME);

  if (!sheet) {
    Logger.log('ERROR: Sheet "' + RESET_SHEET_NAME + '" not found.');
    return;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf(STATUS_COLUMN_HEADER);

  if (statusCol === -1) {
    Logger.log('ERROR: Column "' + STATUS_COLUMN_HEADER + '" not found. Headers found: ' + headers.join(', '));
    return;
  }

  const lastRow = sheet.getLastRow();
  const dataRows = lastRow - 1; // exclude header

  if (dataRows <= 0) {
    Logger.log('No data rows found.');
    return;
  }

  // Build a column of "new" values for every data row
  const newValues = Array.from({ length: dataRows }, () => [RESET_TO_STATUS]);
  sheet.getRange(2, statusCol + 1, dataRows, 1).setValues(newValues);

  Logger.log('Done. Set ' + dataRows + ' rows to "' + RESET_TO_STATUS + '" in column "' + STATUS_COLUMN_HEADER + '".');
}
