/**
 * Web app entry points for Sheet 2 (Foster Tracking)
 */
function doGet(e) {
  const params = e.parameter || {};
  const email = (params.email || '').trim().toLowerCase();

  if (!email) {
    return json_({ success: false, error: 'email parameter required' });
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Foster Notes');
  if (!sheet || sheet.getLastRow() < 2) {
    return json_({ success: true, notes: '', notesUpdatedAt: '' });
  }

  const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === email) {
      return json_({ success: true, notes: data[i][1] || '', notesUpdatedAt: data[i][2] || '' });
    }
  }

  return json_({ success: true, notes: '', notesUpdatedAt: '' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ success: false, error: 'Invalid JSON' });
  }

  if (body.action === 'set_notes') {
    return setFosterNotes_(body.email, body.content);
  }

  return json_({ success: false, error: 'Unknown action' });
}

function setFosterNotes_(email, content) {
  if (!email) return json_({ success: false, error: 'email required' });

  const normalized = email.trim().toLowerCase();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Foster Notes');

  if (!sheet) {
    sheet = ss.insertSheet('Foster Notes');
    sheet.getRange(1, 1, 1, 3).setValues([['Foster Email', 'Notes', 'Notes Updated At']]);
    sheet.setFrozenRows(1);
  }

  const now = new Date().toISOString();

  // Upsert: find existing row by email
  if (sheet.getLastRow() >= 2) {
    const emails = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < emails.length; i++) {
      if (String(emails[i][0]).trim().toLowerCase() === normalized) {
        sheet.getRange(i + 2, 2, 1, 2).setValues([[content, now]]);
        return json_({ success: true });
      }
    }
  }

  // Insert new row
  sheet.appendRow([email.trim(), content, now]);
  return json_({ success: true });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Configuration: Change these to match your Form/Sheet exactly
 */
const PARENT_FOLDER_ID = '1DpRCk9_EzcSMqdgKHWxyNHZQPApSApoi'; // The ID of the main folder where dog folders live
const DOG_NAME_COLUMN = "Foster Dog's Name:"; // The exact header text for the dog's name
const FILE_UPLOAD_COLUMN = "Please upload 5-7 usable photos and one video of the dog in their home."; // The exact header text for the file upload question

function autoOrganizeFormFiles(e) {
  try {
    const itemResponses = e.namedValues;
    const dogName = itemResponses[DOG_NAME_COLUMN][0].trim();
    const fileUrlsRaw = itemResponses[FILE_UPLOAD_COLUMN][0];

    if (!fileUrlsRaw) return; // Exit if no files were uploaded

    // 1. Get or Create the Dog's Folder
    const parentFolder = DriveApp.getFolderById(PARENT_FOLDER_ID);
    const folderIterator = parentFolder.getFoldersByName(dogName);
    let targetFolder;

    if (folderIterator.hasNext()) {
      targetFolder = folderIterator.next();
    } else {
      targetFolder = parentFolder.createFolder(dogName);
    }

    // 2. Parse File IDs and Move them
    // Form file uploads are stored as a comma-separated string of URLs
    const fileIds = fileUrlsRaw.split(',').map(url => {
      const match = url.match(/[-\w]{25,}/); // Extracts the ID from the URL
      return match ? match[0] : null;
    }).filter(id => id !== null);

    fileIds.forEach(id => {
      const file = DriveApp.getFileById(id);
      file.moveTo(targetFolder);
    });

    console.log(`Successfully moved ${fileIds.length} files for ${dogName}`);

  } catch (err) {
    console.error("Error organizing files: " + err.toString());
  }
}
