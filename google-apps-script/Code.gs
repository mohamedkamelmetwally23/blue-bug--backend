/** Set API_URL and WEBHOOK_SECRET in Apps Script Project Properties. */
function onOperationsEdit(event) {
  const sheet = event.range.getSheet();
  if (sheet.getName() !== 'Operations' || event.range.getRow() === 1) return;

  const properties = PropertiesService.getScriptProperties();
  const apiUrl = properties.getProperty('API_URL');
  const secret = properties.getProperty('WEBHOOK_SECRET');
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const values = sheet.getRange(event.range.getRow(), 1, 1, lastColumn).getDisplayValues()[0];
  const row = {};
  headers.forEach(function(header, index) { row[header] = values[index]; });

  if (!row.recordId && !row['Record ID']) {
    const recordIdColumn = headers.findIndex(function(header) { return header.toLowerCase().replace(/\s/g, '') === 'recordid'; });
    if (recordIdColumn < 0) throw new Error('The sheet requires a recordId column.');
    const id = Utilities.getUuid();
    sheet.getRange(event.range.getRow(), recordIdColumn + 1).setValue(id);
    row[headers[recordIdColumn]] = id;
  }

  UrlFetchApp.fetch(apiUrl + '/google-sheets/webhook', {
    method: 'post', contentType: 'application/json',
    headers: { 'x-webhook-secret': secret },
    payload: JSON.stringify({ row: row }), muteHttpExceptions: false
  });
}
