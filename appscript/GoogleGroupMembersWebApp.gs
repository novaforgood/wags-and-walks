/**
 * Google Group directory — membership list for Next.js /api/google-group-members
 *
 * DEPLOYMENT (separate Apps Script project linked to GOOGLE_GROUPS_SCRIPT_URL):
 * 1. Enable Admin SDK: Resources → Cloud Platform project → enable Admin SDK API.
 * 2. Enable Advanced Service: Services → Admin Directory API → ON.
 * 3. Run as user who can read the group's member list (Workspace admin / delegated).
 * 4. Deploy as Web app: Execute as "Me", Who has access per your security model.
 * 5. Merge this doGet with your existing entrypoint if you already have one.
 *
 * Mitigates "Service invoked too many times: premium groups read":
 * - CacheService: serve cached JSON for several minutes (tune CACHE_SEC).
 * - LockService: one live Groups API fetch at a time per script.
 * - Utilities.sleep(1000) between paginated AdminDirectory.Members.list calls.
 */

var GROUP_MEMBERS_CACHE_KEY = 'group_members_json_v2';
var GROUP_MEMBERS_CACHE_SEC = 300; // max 600 for getPublicCache; script cache up to 21600

function doGet(e) {
  try {
    var action = e && e.parameter && e.parameter.action ? String(e.parameter.action) : '';
    if (action === 'group_members') {
      return handleGroupMembers_(e);
    }
    return jsonOut_({ success: false, error: 'Invalid action. Use ?action=group_members' });
  } catch (err) {
    return jsonOut_({ success: false, error: String(err) });
  }
}

function handleGroupMembers_(e) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(GROUP_MEMBERS_CACHE_KEY);
  if (cached) {
    return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    cached = cache.get(GROUP_MEMBERS_CACHE_KEY);
    if (cached) {
      return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
    }

    var groupEmail = getGroupEmailForDirectory_();
    var members = listWorkspaceGroupMembersPaged_(groupEmail);
    var payload = { success: true, members: members };
    var json = JSON.stringify(payload);
    if (json.length > 95000) {
      return jsonOut_({ success: false, error: 'Member list too large for cache; trim or use pagination.' });
    }
    cache.put(GROUP_MEMBERS_CACHE_KEY, json, GROUP_MEMBERS_CACHE_SEC);
    return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/** Group address (same as Google Group email / group key for Admin Directory). */
function getGroupEmailForDirectory_() {
  var p = PropertiesService.getScriptProperties().getProperty('GROUP_DIRECTORY_EMAIL');
  if (p && String(p).trim()) return String(p).trim();
  throw new Error('Set Script property GROUP_DIRECTORY_EMAIL to the Google Group address (Project Settings → Script properties).');
}

/**
 * Lists all members (email + display name when available).
 * Requires Advanced Service AdminDirectory enabled.
 */
function listWorkspaceGroupMembersPaged_(groupEmail) {
  var out = [];
  var pageToken = null;
  var first = true;
  do {
    if (!first) {
      Utilities.sleep(1000);
    }
    first = false;
    var args = { maxResults: 200 };
    if (pageToken) args.pageToken = pageToken;
    var resp = AdminDirectory.Members.list(groupEmail, args);
    var list = resp.members || [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      var email = String(m.email || '').trim();
      if (!email) continue;
      var name = String(m.name || m.displayName || '').trim() || undefined;
      out.push({ email: email, name: name });
    }
    pageToken = resp.nextPageToken || null;
  } while (pageToken);
  return out;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
