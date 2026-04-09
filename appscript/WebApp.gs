/**************************************
 * Foster management platform - Apps Script
 *
 * OPEN TESTING VERSION (NO AUTH, NO SEND LOCK)
 * - Anyone who can reach the web app can read rows and send emails.
 * - Strongly recommended: Deploy access = "Only myself"
 **************************************/



/**************************************
 * CONFIG
 **************************************/
const CONFIG = {
  SHEET_NAME: "Form Responses 1",

  // Flagging input headers (must match your sheet headers exactly)
  HEADERS: {
    TIMESTAMP: "Timestamp",
    FIRST: "First Name",
    LAST: "Last Name",
    EMAIL: "Email",
    AGE: "How old are you?",
    OWNED_PET: "Have you ever owned a pet before?",
    DOG_EXPERIENCE: "How would you rate your experience with dogs?"
  },

  // Output columns we create/write
  OUTPUT_HEADERS: {
    UNDER_21: "Flag: Under 21",
    NO_PET_EXP: "Flag: No Pet Experience",
    FLAGS: "Flags",
    REVIEW: "Review Status",

    // Shared workflow status columns
    APPLICANT_STATUS: "Applicant Status",
    STATUS_UPDATED_AT: "Status Updated At",
    STATUS_UPDATED_BY: "Status Updated By",

    // Email metadata
    EMAIL_SENT: "Email Sent",
    EMAIL_SENT_AT: "Email Sent At"
  },

  REVIEW_VALUES: {
    NEEDS_REVIEW: "Needs Review",
    OK: "OK"
  },

  // Email defaults
  EMAIL_DEFAULTS: {
    DEFAULT_SUBJECT: "Foster Interest",
    DEFAULT_RECIPIENT_OVERRIDE: "",
    MAX_EMAILS_PER_CALL: 90
  },

  // Helps you confirm which deployed version you're hitting
  BUILD_ID: "OPEN_NOAUTH_2026-01-22_21-00_PT"
};

const GROUP_EMAIL = "wags-and-walks@googlegroups.com";

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

  const newLastCol = sheet.getLastColumn();
  const data = sheet.getRange(2, 1, lastRow - 1, newLastCol).getValues();

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

  const newLastCol = sheet.getLastColumn();
  const row = sheet.getRange(rowIndex, 1, 1, newLastCol).getValues()[0];

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
 * GET ENDPOINT (OPEN)
 * Query params:
 *  - offset (default 0)
 *  - limit (default 1000)
 *  - fields (comma-separated headers); if omitted returns all columns
 **************************************/
function doGet(e) {
  try {
    var offset = e && e.parameter && e.parameter.offset ? parseInt(e.parameter.offset, 10) : 0;
    var limit = e && e.parameter && e.parameter.limit ? parseInt(e.parameter.limit, 10) : 1000;
    var fieldsParam = e && e.parameter && e.parameter.fields ? String(e.parameter.fields) : "";

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
 **************************************/
function doPost(e) {
  try {
    const payload = parseJsonBody_(e);

    const action = payload.action ? String(payload.action) : "";

    // ---- set_status --------------------------------------------------------
    if (action === "set_status") {
      const email = String(payload.email || "").trim();
      const status = String(payload.status || "").trim();
      const updatedBy = String(payload.updatedBy || "").trim();

      const allowedStatuses = ["new", "in-progress", "approved", "current", "rejected", "rejected_new", "rejected_in-progress", "rejected_approved"];
      if (!email) {
        return json_({ success: false, build: CONFIG.BUILD_ID, error: "email is required" });
      }
      if (allowedStatuses.indexOf(status) === -1) {
        return json_({
          success: false,
          build: CONFIG.BUILD_ID,
          error: "Invalid status \"" + status + "\". Allowed: " + allowedStatuses.join(", ")
        });
      }

      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(15000);

        const sheet = getSheetByNameOrThrow_(CONFIG.SHEET_NAME);
        const headers = getHeaders_(sheet);

        ensureOutputColumns_(sheet, headers, [
          CONFIG.OUTPUT_HEADERS.APPLICANT_STATUS,
          CONFIG.OUTPUT_HEADERS.STATUS_UPDATED_AT,
          CONFIG.OUTPUT_HEADERS.STATUS_UPDATED_BY
        ]);

        const newHeaders = getHeaders_(sheet);
        const col = resolveColumns_(newHeaders, [
          CONFIG.HEADERS.EMAIL,
          CONFIG.OUTPUT_HEADERS.APPLICANT_STATUS,
          CONFIG.OUTPUT_HEADERS.STATUS_UPDATED_AT,
          CONFIG.OUTPUT_HEADERS.STATUS_UPDATED_BY
        ]);

        const lastRow = sheet.getLastRow();
        if (lastRow < 2) {
          return json_({ success: false, build: CONFIG.BUILD_ID, error: "No rows in sheet" });
        }

        const emailKey = email.toLowerCase();
        const emailColValues = sheet
          .getRange(2, col[CONFIG.HEADERS.EMAIL], lastRow - 1, 1)
          .getValues();

        let rowIndex = null;
        for (let i = emailColValues.length - 1; i >= 0; i--) {
          const v = String(emailColValues[i][0] || "").trim().toLowerCase();
          if (v && v === emailKey) {
            rowIndex = i + 2;
            break;
          }
        }

        if (!rowIndex) {
          return json_({ success: false, build: CONFIG.BUILD_ID, error: "Email not found: " + email });
        }

        sheet.getRange(rowIndex, col[CONFIG.OUTPUT_HEADERS.APPLICANT_STATUS]).setValue(status);
        sheet.getRange(rowIndex, col[CONFIG.OUTPUT_HEADERS.STATUS_UPDATED_AT]).setValue(new Date());
        if (updatedBy) {
          sheet.getRange(rowIndex, col[CONFIG.OUTPUT_HEADERS.STATUS_UPDATED_BY]).setValue(updatedBy);
        }

        let groupResult = null;
        if (status === "approved") {
          try {
            MailApp.sendEmail(
              email,
              "You're Approved! Please Join the Group",
              "Click here to request to join:\n\nhttps://groups.google.com/g/wags-and-walks"
            );
            groupResult = "added";
          } catch (err) {
            groupResult = "error: " + err.message;
            Logger.log("Group add failed: " + err.message);
          }
        }

        SpreadsheetApp.flush();
        return json_({
          success: true,
          build: CONFIG.BUILD_ID,
          action: "set_status",
          rowIndex: rowIndex,
          email: email,
          status: status,
          groupResult: groupResult
        });

      } catch (err) {
        return json_({ success: false, build: CONFIG.BUILD_ID, error: String(err) });
      } finally {
        try { lock.releaseLock(); } catch (_) {}
      }
    }

    // ---- set_starred -------------------------------------------------------
    if (action === "set_starred") {
      const result = setStarred_(payload.email, payload.starred);
      return json_(Object.assign({}, result, { build: CONFIG.BUILD_ID }));
    }

    // ---- email sending -----------------------------------------------------
    const subject = String(payload.subject || CONFIG.EMAIL_DEFAULTS.DEFAULT_SUBJECT);
    const emailContent = String(payload.emailContent || "");
    const sendEmails = payload.sendEmails === true;
    const testEmail = payload.testEmail ? String(payload.testEmail).trim() : "";

    const mode = payload.mode ? String(payload.mode) : "ok";
    const skipIfSent = (payload.skipIfSent === undefined) ? true : (payload.skipIfSent === true);

    const recipientOverride = (payload.recipientOverride === undefined)
      ? CONFIG.EMAIL_DEFAULTS.DEFAULT_RECIPIENT_OVERRIDE
      : String(payload.recipientOverride || "").trim();

    const sendToApplicants = payload.sendToApplicants === true;

    if (!emailContent && sendEmails) {
      return json_({ success: false, build: CONFIG.BUILD_ID, error: "emailContent is required when sendEmails=true" });
    }

    const sheet = getSheetByNameOrThrow_(CONFIG.SHEET_NAME);
    const headers = getHeaders_(sheet);

    ensureOutputColumns_(sheet, headers, [
      CONFIG.OUTPUT_HEADERS.EMAIL_SENT,
      CONFIG.OUTPUT_HEADERS.EMAIL_SENT_AT
    ]);
    const newHeaders = getHeaders_(sheet);

    const col = resolveColumns_(newHeaders, [
      CONFIG.HEADERS.FIRST,
      CONFIG.HEADERS.LAST,
      CONFIG.HEADERS.EMAIL,
      CONFIG.OUTPUT_HEADERS.REVIEW,
      CONFIG.OUTPUT_HEADERS.EMAIL_SENT,
      CONFIG.OUTPUT_HEADERS.EMAIL_SENT_AT
    ]);

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) {
      return json_({ success: true, build: CONFIG.BUILD_ID, message: "No recipients", recipients: [], emailsSent: 0 });
    }

    const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    let candidates = values.map(function(row, i) {
      return {
        rowIndex: i + 2,
        firstName: String(row[col[CONFIG.HEADERS.FIRST] - 1] || "").trim(),
        lastName: String(row[col[CONFIG.HEADERS.LAST] - 1] || "").trim(),
        email: String(row[col[CONFIG.HEADERS.EMAIL] - 1] || "").trim(),
        review: String(row[col[CONFIG.OUTPUT_HEADERS.REVIEW] - 1] || "").trim(),
        emailSent: String(row[col[CONFIG.OUTPUT_HEADERS.EMAIL_SENT] - 1] || "").trim()
      };
    }).filter(function(r) { return r.email; });

    candidates = candidates.filter(function(r) {
      if (mode === "all") return true;
      if (mode === "ok") return r.review === CONFIG.REVIEW_VALUES.OK;
      if (mode === "needs_review") return r.review === CONFIG.REVIEW_VALUES.NEEDS_REVIEW;
      return r.review === CONFIG.REVIEW_VALUES.OK;
    });

    if (skipIfSent) {
      candidates = candidates.filter(function(r) { return !/^true$/i.test(r.emailSent); });
    }

    const rowIndices = Array.isArray(payload.rowIndices)
      ? payload.rowIndices.map(function(n) { return parseInt(n, 10); }).filter(function(n) { return Number.isFinite(n); })
      : [];

    if (rowIndices.length) {
      candidates = candidates.filter(function(r) { return rowIndices.indexOf(r.rowIndex) !== -1; });
    }

    const targets = testEmail
      ? (candidates[0] ? [Object.assign({}, candidates[0], { overrideEmail: testEmail, isTest: true })] : [])
      : candidates.map(function(r) { return Object.assign({}, r, { isTest: false }); });

    const previewRecipients = targets.map(function(t) {
      return {
        rowIndex: t.rowIndex || null,
        fullName: (t.firstName + " " + t.lastName).trim(),
        applicantEmail: t.email,
        willSendTo: resolveSendTo_(t.email, recipientOverride, sendToApplicants),
        review: t.review,
        skippedBecauseAlreadySent: false
      };
    });

    if (!sendEmails) {
      return json_({
        success: true,
        build: CONFIG.BUILD_ID,
        message: "Dry run (sendEmails=false). No emails sent.",
        recipients: previewRecipients,
        emailsSent: 0
      });
    }

    let emailsSent = 0;
    const max = CONFIG.EMAIL_DEFAULTS.MAX_EMAILS_PER_CALL;

    for (let i = 0; i < targets.length; i++) {
      if (emailsSent >= max) break;

      const t = targets[i];
      const fullName = (t.firstName + " " + t.lastName).trim();

      const personalized = renderTemplate_(emailContent, {
        fullName: fullName,
        firstName: t.firstName,
        lastName: t.lastName,
        email: t.email
      });

      const to = resolveSendTo_(t.email, recipientOverride, sendToApplicants);

      GmailApp.sendEmail(to, subject, personalized);
      emailsSent += 1;

      if (!t.isTest && t.rowIndex) {
        sheet.getRange(t.rowIndex, col[CONFIG.OUTPUT_HEADERS.EMAIL_SENT]).setValue(true);
        sheet.getRange(t.rowIndex, col[CONFIG.OUTPUT_HEADERS.EMAIL_SENT_AT]).setValue(new Date());
      }

      Utilities.sleep(100);
    }

    SpreadsheetApp.flush();

    return json_({
      success: true,
      build: CONFIG.BUILD_ID,
      message: "Emails processed",
      mode: mode,
      sendToApplicants: sendToApplicants,
      recipientOverride: recipientOverride,
      skipIfSent: skipIfSent,
      emailsSent: emailsSent,
      recipients: previewRecipients
    });

  } catch (err) {
    return json_({ success: false, build: CONFIG.BUILD_ID, error: String(err) });
  }
}

/**************************************
 * Internal helpers
 **************************************/
function setStarred_(email, starred) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return { success: false, error: "Sheet not found" };

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const emailCol = headers.findIndex(function(h) { return String(h).trim().toLowerCase() === "email"; });
  const starredCol = headers.findIndex(function(h) { return String(h).trim().toLowerCase() === "starred"; });

  if (emailCol === -1 || starredCol === -1)
    return { success: false, error: "Required column not found" };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: false, error: "No data rows" };

  const emailData = sheet.getRange(2, emailCol + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < emailData.length; i++) {
    if (String(emailData[i][0]).trim().toLowerCase() === String(email).trim().toLowerCase()) {
      sheet.getRange(i + 2, starredCol + 1).setValue(starred ? "TRUE" : "");
      return { success: true };
    }
  }
  return { success: false, error: "Email not found" };
}

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

function resolveSendTo_(applicantEmail, recipientOverride, sendToApplicants) {
  if (recipientOverride && recipientOverride !== "") return recipientOverride;
  return applicantEmail;
}

function renderTemplate_(text, vars) {
  return String(text || "")
    .replace(/\{\{fullName\}\}/g, vars.fullName || "")
    .replace(/\{\{firstName\}\}/g, vars.firstName || "")
    .replace(/\{\{lastName\}\}/g, vars.lastName || "")
    .replace(/\{\{email\}\}/g, vars.email || "");
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
  const lastCol = sheet.getLastColumn();
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

function safeFindCol_(headers, headerName) {
  const idx = headers.indexOf(headerName);
  return idx === -1 ? null : idx + 1;
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

/**************************************
 * Optional convenience: Add a custom menu
 **************************************/
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Foster Tools")
    .addItem("Run Flagging (Batch)", "runFlagging")
    .addToUi();
}
