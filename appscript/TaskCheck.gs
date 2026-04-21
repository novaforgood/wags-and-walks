const TEST_EMAIL = 'shanenkuk@gmail.com';
const SPREADSHEET_ID = '1Nf6Do48cgIMcbSiUYVeELA47l4MbmVB0rmRJa9qXLsc';
const TASK_LOG_SHEET = 'Task Log';
const FOSTERS_SHEET = 'Current Fosters';
const FORM_RESPONSES_SHEET = 'Form Responses';

// Current Fosters column indices (1-based)
const COL_ANIMAL_ID = 1;
const COL_DOG_NAME = 3;
const COL_FOSTER_SINCE = 8;
const COL_FOSTER_NAME = 10;
const COL_FOSTER_EMAIL = 13;

// Task log column indices (0-based)
const LOG_ANIMAL_ID = 0;
const LOG_DOG_NAME = 1;
const LOG_TASK_TYPE = 2;
const LOG_TRIGGER_DAY = 3;
const LOG_SENT_DATE = 4;
const LOG_COMPLETED_DATE = 5;
const LOG_RETIRED_DATE = 6;

// --- MAIN ---------------------------------------------------------------

function checkFosterTasks() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const fostersSheet = ss.getSheetByName(FOSTERS_SHEET);
  const taskLogSheet = ss.getSheetByName(TASK_LOG_SHEET) || ss.insertSheet(TASK_LOG_SHEET);

  if (taskLogSheet.getLastRow() === 0) {
    taskLogSheet.appendRow(['Animal ID', 'Dog Name', 'Task Type', 'Trigger Day', 'Email Sent Date', 'Completed Date', 'Retired Date']);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fosterData = fostersSheet.getDataRange().getValues();
  const completedTasks = getCompletedTasksFromForm_(ss);

  const emailsToSend = [];
  const rowsToAppend = [];
  const cellsToUpdate = [];

  const taskLog = taskLogSheet.getDataRange().getValues();

  for (let i = 1; i < fosterData.length; i++) {
    const row = fosterData[i];
    const animalId = String(row[COL_ANIMAL_ID - 1]).trim();
    const dogName = String(row[COL_DOG_NAME - 1]).trim();
    const fosterSince = row[COL_FOSTER_SINCE - 1];
    const fosterName = String(row[COL_FOSTER_NAME - 1]).trim();
    const fosterEmail = String(row[COL_FOSTER_EMAIL - 1]).trim();

    if (!animalId || !fosterSince || !fosterEmail) continue;

    const startDate = new Date(fosterSince);
    startDate.setHours(0, 0, 0, 0);
    const daysInHome = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));

    if (daysInHome < 0) continue;

    processPhotoTrack_(animalId, dogName, fosterName, fosterEmail, daysInHome, today, taskLog, completedTasks, emailsToSend, rowsToAppend, cellsToUpdate);
    processSurveyTrack_(animalId, dogName, fosterName, fosterEmail, daysInHome, today, taskLog, completedTasks, emailsToSend, rowsToAppend, cellsToUpdate);
  }

  if (rowsToAppend.length > 0) {
    const startRow = taskLogSheet.getLastRow() + 1;
    taskLogSheet.getRange(startRow, 1, rowsToAppend.length, 7).setValues(rowsToAppend);
  }

  for (let c = 0; c < cellsToUpdate.length; c++) {
    const cell = cellsToUpdate[c];
    taskLogSheet.getRange(cell.row, cell.col).setValue(cell.value);
  }

  for (let e = 0; e < emailsToSend.length; e++) {
    const email = emailsToSend[e];
    Logger.log('WOULD SEND | ' + email.logLine + '\n  Subject: ' + email.subject);
  }

  Logger.log('Done. Emails: ' + emailsToSend.length + ' | New log rows: ' + rowsToAppend.length + ' | Updates: ' + cellsToUpdate.length);
}

// --- PHOTO TRACK --------------------------------------------------------

function processPhotoTrack_(animalId, dogName, fosterName, fosterEmail, daysInHome, today, taskLog, completedTasks, emailsToSend, rowsToAppend, cellsToUpdate) {
  const PHOTO_TASKS = [
    { type: 'PHOTOS_5',  triggerDay: 5,  label: '5-day photos (5-7 usable photos)' },
    { type: 'PHOTOS_10', triggerDay: 10, label: '10-day photos + video (5 photos and 1 video)' }
  ];

  const reachedTasks = PHOTO_TASKS.filter(function(t) { return daysInHome >= t.triggerDay; });
  if (reachedTasks.length === 0) return;

  const activeTask = reachedTasks[reachedTasks.length - 1];

  for (let p = 0; p < PHOTO_TASKS.length; p++) {
    if (PHOTO_TASKS[p].type !== activeTask.type) {
      queueRetire_(taskLog, animalId, PHOTO_TASKS[p].type, today, cellsToUpdate);
    }
  }

  const logEntry = findLogEntry_(taskLog, animalId, activeTask.type);
  const taskKey = animalId + '|' + activeTask.type;

  if (logEntry) {
    if (logEntry[LOG_RETIRED_DATE] || logEntry[LOG_COMPLETED_DATE]) return;
    if (completedTasks.has(taskKey)) {
      queueComplete_(taskLog, animalId, activeTask.type, today, cellsToUpdate);
      return;
    }
    const daysSinceSent = daysDiff_(new Date(logEntry[LOG_SENT_DATE]), today);
    if (daysSinceSent > 0 && daysSinceSent % 3 === 0) {
      queueEmail_(fosterName, fosterEmail, dogName, animalId, activeTask, true, emailsToSend);
    }
  } else {
    if (completedTasks.has(taskKey)) return;
    queueEmail_(fosterName, fosterEmail, dogName, animalId, activeTask, false, emailsToSend);
    rowsToAppend.push([animalId, dogName, activeTask.type, activeTask.triggerDay, today, '', '']);
  }
}

// --- SURVEY TRACK -------------------------------------------------------

function processSurveyTrack_(animalId, dogName, fosterName, fosterEmail, daysInHome, today, taskLog, completedTasks, emailsToSend, rowsToAppend, cellsToUpdate) {
  const surveyDays = buildSurveyDays_(daysInHome);
  const reached = surveyDays.filter(function(d) { return daysInHome >= d; });
  if (reached.length === 0) return;
  const activeSurveyDay = reached[reached.length - 1];

  const activeType = 'SURVEY_' + activeSurveyDay;
  const taskKey = animalId + '|' + activeType;

  for (let s = 0; s < surveyDays.length; s++) {
    if (surveyDays[s] < activeSurveyDay) {
      queueRetire_(taskLog, animalId, 'SURVEY_' + surveyDays[s], today, cellsToUpdate);
    }
  }

  const logEntry = findLogEntry_(taskLog, animalId, activeType);
  const task = { type: activeType, triggerDay: activeSurveyDay, label: activeSurveyDay + '-day foster survey' };

  if (logEntry) {
    if (logEntry[LOG_RETIRED_DATE] || logEntry[LOG_COMPLETED_DATE]) return;
    if (completedTasks.has(taskKey)) {
      queueComplete_(taskLog, animalId, activeType, today, cellsToUpdate);
      return;
    }
    const daysSinceSent = daysDiff_(new Date(logEntry[LOG_SENT_DATE]), today);
    if (daysSinceSent > 0 && daysSinceSent % 3 === 0) {
      queueEmail_(fosterName, fosterEmail, dogName, animalId, task, true, emailsToSend);
    }
  } else {
    if (completedTasks.has(taskKey)) return;
    queueEmail_(fosterName, fosterEmail, dogName, animalId, task, false, emailsToSend);
    rowsToAppend.push([animalId, dogName, activeType, activeSurveyDay, today, '', '']);
  }
}

function buildSurveyDays_(daysInHome) {
  const days = [7, 14, 21];
  if (daysInHome >= 30) {
    const extras = Math.floor((daysInHome - 30) / 14) + 1;
    for (let n = 1; n <= extras; n++) {
      days.push(30 + (n - 1) * 14);
    }
  }
  return days;
}

// --- HELPERS ------------------------------------------------------------

function findLogEntry_(taskLog, animalId, taskType) {
  for (let i = 1; i < taskLog.length; i++) {
    if (String(taskLog[i][LOG_ANIMAL_ID]) === animalId && taskLog[i][LOG_TASK_TYPE] === taskType) {
      return taskLog[i];
    }
  }
  return null;
}

function findLogRow_(taskLog, animalId, taskType) {
  for (let i = 1; i < taskLog.length; i++) {
    if (String(taskLog[i][LOG_ANIMAL_ID]) === animalId && taskLog[i][LOG_TASK_TYPE] === taskType) {
      return i + 1;
    }
  }
  return null;
}

function queueRetire_(taskLog, animalId, taskType, today, cellsToUpdate) {
  const sheetRow = findLogRow_(taskLog, animalId, taskType);
  if (!sheetRow) return;
  const entry = taskLog[sheetRow - 1];
  if (entry[LOG_RETIRED_DATE] || entry[LOG_COMPLETED_DATE]) return;
  cellsToUpdate.push({ row: sheetRow, col: LOG_RETIRED_DATE + 1, value: today });
  Logger.log('RETIRE | ' + animalId + ' | ' + taskType);
}

function queueComplete_(taskLog, animalId, taskType, today, cellsToUpdate) {
  const sheetRow = findLogRow_(taskLog, animalId, taskType);
  if (!sheetRow) return;
  const entry = taskLog[sheetRow - 1];
  if (entry[LOG_COMPLETED_DATE]) return;
  cellsToUpdate.push({ row: sheetRow, col: LOG_COMPLETED_DATE + 1, value: today });
  Logger.log('COMPLETE | ' + animalId + ' | ' + taskType);
}

function queueEmail_(fosterName, fosterEmail, dogName, animalId, task, isFollowUp, emailsToSend) {
  const subject = isFollowUp
    ? '[FOLLOW-UP] Task needed for ' + dogName + ' - ' + task.label
    : 'Task needed for ' + dogName + ' - ' + task.label;

  const body = isFollowUp
    ? 'Hi ' + fosterName + ',\n\nJust following up! We still need the ' + task.label + ' for ' + dogName + '.\n\nAnimal ID: ' + animalId + '\n[Form link here]\n\nThanks,\nThe Foster Team'
    : 'Hi ' + fosterName + ',\n\nTime to submit: ' + task.label + ' for ' + dogName + '.\n\nAnimal ID: ' + animalId + '\n[Form link here]\n\nThanks,\nThe Foster Team';

  emailsToSend.push({
    subject: subject,
    body: body,
    logLine: (isFollowUp ? 'FOLLOW-UP' : 'INITIAL') + ' | ' + dogName + ' (' + animalId + ') | ' + task.type
  });
}

// --- FORM RESPONSES -----------------------------------------------------

function getCompletedTasksFromForm_(ss) {
  const completed = new Set();
  const formSheet = ss.getSheetByName(FORM_RESPONSES_SHEET);
  if (!formSheet) return completed;
  const data = formSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const animalId = String(data[i][1]).trim();
    const taskType = String(data[i][2]).trim();
    if (animalId && taskType) completed.add(animalId + '|' + taskType);
  }
  return completed;
}

// --- UTILS --------------------------------------------------------------

function daysDiff_(dateA, dateB) {
  const a = new Date(dateA); a.setHours(0, 0, 0, 0);
  const b = new Date(dateB); b.setHours(0, 0, 0, 0);
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}

// --- TRIGGER SETUP ------------------------------------------------------

function createDailyTrigger() {
  ScriptApp.newTrigger('checkFosterTasks')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
}
