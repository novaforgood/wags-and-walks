/**************************************
 * Foster management platform - Apps Script
 *
 * Production Sheet 1 script:
 * - Authenticated by script property APPS_SCRIPT_KEY.
 * - GET reads applicant rows for the Next.js app.
 * - POST only sends single emails through Gmail.
 * - Sheet writes are limited to derived flag columns from manual/form triggers.
 **************************************/

const CONFIG = {
  SHEET_NAME: "Sheet1",

  HEADERS: {
    TIMESTAMP: "Submitted On",
    NAME: "Name",
    EMAIL: "Email",
    PHONE: "Phone",
    ADDRESS: "Address",
    AGE: "How old are you",
    OCCUPATION: "What do you do for a living",
    CHILDREN: "How many children are in your home",
    CHILDREN_AGES: "How old are they Check all that apply",
    ADDITIONAL_ADULTS: "Other than yourself how many additional adults do you share your home with",
    ADULT_AGES: "How old are they",
    ADULT_RELATIONSHIP: "What is their relationship to you",
    LIVING_ARRANGEMENT: "What is your living arrangement",
    OWNED_PET: "Have you ever owned a pet before",
    PET_TYPES: "What kind of pets have you owned check all that apply",
    CURRENT_PETS: "Do you currently have any pets at home",
    CURRENT_PET_DETAILS: "Please list ALL pets that you CURRENTLY own Include type dogcat breed age gender length of time in your care etc",
    PETS_SPAYED: "Are your current pets spayedneutered",
    DOG_DAYTIME: "Where will your foster dog be when you are not home",
    DOG_NIGHT: "Where will your foster dog sleep during the night",
    DOG_EXPERIENCE: "How would you rate your experience with dogs",
    AVAILABILITY: "When would you like to take your foster dog home",
    SPECIAL_NEEDS: "Are you willing to foster dogs with special needs If so please check all that apply below",
    SIZE_PREFERENCE: "Please share your preferences in terms of size breed energy level etc Fosters for large dogs 45 lbs are always our biggest need Please note that you do not need a house or yard to foster a large dog Many bigger dogs are just fine in apartments and our team will pair you with a dog that will be a great match",
    MEDICAL_NEEDS: "Are you willing to foster dogs with medical needs",
    PREGNANT_MAMAS: "Are you willing to foster pregnant mamas andor mamas and their litters",
    BEHAVIOR_REHAB: "Are you willing to foster dogs that need training upkeepbehavior rehabilitation",
    REFERRAL_SOURCE: "How did you hear about us",
    REFERRAL_NAME: "If someone referred you please list their name here so we may thank them",
    SOURCE: "Source"
  },

  OUTPUT_HEADERS: {
    UNDER_21: "Flag: Under 21",
    NO_PET_EXP: "Flag: No Pet Experience",
    FLAGS: "Flags",
    REVIEW: "Review Status"
  },

  REVIEW_VALUES: {
    NEEDS_REVIEW: "Needs Review",
    OK: "OK"
  },

  BUILD_ID: "PROD_READ_EMAIL_FLAGS_2026-06-07"
};

/**************************************
 * Auth
 **************************************/
function requireKey_(e, payload) {
  const expected = PropertiesService.getScriptProperties().getProperty("APPS_SCRIPT_KEY");
  if (!expected) return true;

  const queryKey = e && e.parameter ? String(e.parameter.key || "") : "";
  const bodyKey = payload && payload.key ? String(payload.key || "") : "";
  return queryKey === expected || bodyKey === expected;
}

/**************************************
 * FLAGGING (batch) - manually run anytime
 **************************************/
function runFlagging() {
  const sheet = getSheetByNameOrThrow_(CONFIG.SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log("No responses.");
    return;
  }

  const headers = getHeaders_(sheet);
  ensureOutputColumns_(sheet, headers, [
    CONFIG.OUTPUT_HEADERS.UNDER_21,
    CONFIG.OUTPUT_HEADERS.NO_PET_EXP,
    CONFIG.OUTPUT_HEADERS.FLAGS,
    CONFIG.OUTPUT_HEADERS.REVIEW,
  ]);

  const newHeaders = getHeaders_(sheet);
  const col = resolveColumns_(newHeaders, [
    CONFIG.HEADERS.AGE,
    CONFIG.HEADERS.OWNED_PET,
    CONFIG.HEADERS.DOG_EXPERIENCE,
    CONFIG.OUTPUT_HEADERS.UNDER_21,
    CONFIG.OUTPUT_HEADERS.NO_PET_EXP,
    CONFIG.OUTPUT_HEADERS.FLAGS,
    CONFIG.OUTPUT_HEADERS.REVIEW
  ]);

  const data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  const under21Vals = [];
  const noPetVals = [];
  const flagsVals = [];
  const reviewVals = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const computed = computeFlagsForRow_(row, col);
    const existingReview = String(row[col[CONFIG.OUTPUT_HEADERS.REVIEW] - 1] || "").trim();
    const review = existingReview
      ? existingReview
      : (computed.flags.length > 0 ? CONFIG.REVIEW_VALUES.NEEDS_REVIEW : CONFIG.REVIEW_VALUES.OK);

    under21Vals.push([computed.isUnder21]);
    noPetVals.push([computed.noPetExperience]);
    flagsVals.push([computed.flagsText]);
    reviewVals.push([review]);
  }

  sheet.getRange(2, col[CONFIG.OUTPUT_HEADERS.UNDER_21], under21Vals.length, 1).setValues(under21Vals);
  sheet.getRange(2, col[CONFIG.OUTPUT_HEADERS.NO_PET_EXP], noPetVals.length, 1).setValues(noPetVals);
  sheet.getRange(2, col[CONFIG.OUTPUT_HEADERS.FLAGS], flagsVals.length, 1).setValues(flagsVals);
  sheet.getRange(2, col[CONFIG.OUTPUT_HEADERS.REVIEW], reviewVals.length, 1).setValues(reviewVals);

  SpreadsheetApp.flush();
  Logger.log("Flagging complete. Processed " + data.length + " rows.");
}

/**************************************
 * FLAGGING (single-row) - for form submit trigger
 **************************************/
function onFormSubmit(e) {
  try {
    if (!e || !e.range) return;
    const rowIndex = e.range.getRow();
    if (rowIndex < 2) return;
    flagRow_(rowIndex);
  } catch (err) {
    Logger.log("onFormSubmit error: " + String(err));
  }
}

function flagRow_(rowIndex) {
  const sheet = getSheetByNameOrThrow_(CONFIG.SHEET_NAME);
  const headers = getHeaders_(sheet);
  ensureOutputColumns_(sheet, headers, [
    CONFIG.OUTPUT_HEADERS.UNDER_21,
    CONFIG.OUTPUT_HEADERS.NO_PET_EXP,
    CONFIG.OUTPUT_HEADERS.FLAGS,
    CONFIG.OUTPUT_HEADERS.REVIEW,
  ]);

  const newHeaders = getHeaders_(sheet);
  const col = resolveColumns_(newHeaders, [
    CONFIG.HEADERS.AGE,
    CONFIG.HEADERS.OWNED_PET,
    CONFIG.HEADERS.DOG_EXPERIENCE,
    CONFIG.OUTPUT_HEADERS.UNDER_21,
    CONFIG.OUTPUT_HEADERS.NO_PET_EXP,
    CONFIG.OUTPUT_HEADERS.FLAGS,
    CONFIG.OUTPUT_HEADERS.REVIEW
  ]);

  const row = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  const computed = computeFlagsForRow_(row, col);
  const existingReview = String(row[col[CONFIG.OUTPUT_HEADERS.REVIEW] - 1] || "").trim();
  const review = existingReview
    ? existingReview
    : (computed.flags.length > 0 ? CONFIG.REVIEW_VALUES.NEEDS_REVIEW : CONFIG.REVIEW_VALUES.OK);

  sheet.getRange(rowIndex, col[CONFIG.OUTPUT_HEADERS.UNDER_21]).setValue(computed.isUnder21);
  sheet.getRange(rowIndex, col[CONFIG.OUTPUT_HEADERS.NO_PET_EXP]).setValue(computed.noPetExperience);
  sheet.getRange(rowIndex, col[CONFIG.OUTPUT_HEADERS.FLAGS]).setValue(computed.flagsText);
  sheet.getRange(rowIndex, col[CONFIG.OUTPUT_HEADERS.REVIEW]).setValue(review);
  SpreadsheetApp.flush();
}

/**************************************
 * GET ENDPOINT
 * Query params:
 *  - key
 *  - offset (default 0)
 *  - limit (default 1000)
 *  - fields (comma-separated headers); if omitted returns all columns
 **************************************/
function doGet(e) {
  try {
    if (!requireKey_(e, null)) {
      return json_({ success: false, build: CONFIG.BUILD_ID, error: "Unauthorized" });
    }

    const offset = e && e.parameter && e.parameter.offset ? parseInt(e.parameter.offset, 10) : 0;
    const limit = e && e.parameter && e.parameter.limit ? parseInt(e.parameter.limit, 10) : 1000;
    const fieldsParam = e && e.parameter && e.parameter.fields ? String(e.parameter.fields) : "";

    const sheet = getSheetByNameOrThrow_(CONFIG.SHEET_NAME);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) {
      return json_({ success: true, build: CONFIG.BUILD_ID, total: 0, returned: 0, rows: [] });
    }

    const headers = getHeaders_(sheet);
    const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    const start = Math.max(0, Number.isFinite(offset) ? offset : 0);
    const lim = Number.isFinite(limit) ? Math.max(1, limit) : 1000;
    const paged = values.slice(start, Math.min(values.length, start + lim));
    const requestedFields = fieldsParam
      ? fieldsParam.split(",").map(function(s) { return s.trim(); }).filter(Boolean)
      : headers.slice();

    const rows = paged.map(function(row, i) {
      const obj = rowToObjectFields_(headers, row, requestedFields);
      obj.rowIndex = start + i + 2;
      return obj;
    });

    return json_({
      success: true,
      build: CONFIG.BUILD_ID,
      total: values.length,
      returned: rows.length,
      offset: start,
      limit: lim,
      fields: requestedFields,
      rows: rows
    });
  } catch (err) {
    return json_({ success: false, build: CONFIG.BUILD_ID, error: String(err) });
  }
}

/**************************************
 * POST ENDPOINT
 * Supported action:
 *  - send_single_email: { to, subject, body, htmlBody? }
 **************************************/
function doPost(e) {
  try {
    const payload = parseJsonBody_(e);
    if (!requireKey_(e, payload)) {
      return json_({ success: false, build: CONFIG.BUILD_ID, error: "Unauthorized" });
    }

    const action = payload.action ? String(payload.action) : "";
    if (action !== "send_single_email") {
      return json_({
        success: false,
        build: CONFIG.BUILD_ID,
        error: "Unsupported action: " + action
      });
    }

    const to = String(payload.to || "").trim();
    const subject = String(payload.subject || "").trim();
    const body = String(payload.body || "").trim();
    const htmlBody = payload.htmlBody ? String(payload.htmlBody).trim() : "";
    if (!to || !subject || !body) {
      return json_({ success: false, build: CONFIG.BUILD_ID, error: "to, subject, and body are required" });
    }

    if (htmlBody) {
      GmailApp.sendEmail(to, subject, body, { htmlBody: htmlBody });
    } else {
      GmailApp.sendEmail(to, subject, body);
    }
    return json_({ success: true, build: CONFIG.BUILD_ID });
  } catch (err) {
    return json_({ success: false, build: CONFIG.BUILD_ID, error: String(err) });
  }
}

/**************************************
 * Internal helpers
 **************************************/
function computeFlagsForRow_(row, col) {
  const age = String(row[col[CONFIG.HEADERS.AGE] - 1] || "").trim();
  const ownedPet = String(row[col[CONFIG.HEADERS.OWNED_PET] - 1] || "").trim();
  const dogExp = String(row[col[CONFIG.HEADERS.DOG_EXPERIENCE] - 1] || "").trim();

  const isUnder21 = /under\s*21/i.test(age);
  const neverOwnedPet = /^no$/i.test(ownedPet);
  const neverDog = /never\s+(fostered|had)\b/i.test(dogExp);
  const noPetExperience = neverOwnedPet || neverDog;

  const flags = [];
  if (isUnder21) flags.push("UNDER_21");
  if (noPetExperience) flags.push("NO_PET_EXPERIENCE");

  return {
    isUnder21: isUnder21,
    noPetExperience: noPetExperience,
    flags: flags,
    flagsText: flags.join("; ")
  };
}

function parseJsonBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Missing postData.contents");
  }
  return JSON.parse(e.postData.contents);
}

function getSheetByNameOrThrow_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error("Sheet not found: " + name);
  return sheet;
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function resolveColumns_(headers, requiredHeaderNames) {
  const map = {};
  for (let i = 0; i < requiredHeaderNames.length; i++) {
    const h = requiredHeaderNames[i];
    const idx = headers.indexOf(h);
    if (idx === -1) {
      throw new Error("Missing required header: \"" + h + "\"");
    }
    map[h] = idx + 1;
  }
  return map;
}

function ensureOutputColumns_(sheet, headers, requiredOutputHeaders) {
  const missing = requiredOutputHeaders.filter(function(h) { return headers.indexOf(h) === -1; });
  if (missing.length === 0) return;

  const startCol = sheet.getLastColumn() + 1;
  sheet.getRange(1, startCol, 1, missing.length).setValues([missing]);
}

function rowToObjectFields_(headers, row, fields) {
  const obj = {};
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const idx = headers.indexOf(f);
    if (idx !== -1) obj[f] = row[idx];
  }
  return obj;
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Foster Tools")
    .addItem("Run Flagging (Batch)", "runFlagging")
    .addToUi();
}
