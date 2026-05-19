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
/** email (lowercase) -> ISO first time we saw them on the group roster */
var GROUP_MEMBER_FIRST_SEEN_KEY = 'group_member_first_seen_v1';
/** After first live fetch, only net-new emails are stamped with a real month. */
var GROUP_ONBOARDING_SEEDED_KEY = 'group_onboarding_seeded_v1';
/** Legacy seed — excluded from monthly onboarding counts */
var GROUP_ONBOARDING_LEGACY_ISO = '1970-01-01T00:00:00.000Z';

function doGet(e) {
  try {
    var action = e && e.parameter && e.parameter.action ? String(e.parameter.action) : '';
    if (action === 'group_members') {
      return handleGroupMembers_(e);
    }
    if (action === 'group_onboarding') {
      return handleGroupOnboarding_(e);
    }
    return jsonOut_({ success: false, error: 'Invalid action. Use ?action=group_members or ?action=group_onboarding' });
  } catch (err) {
    return jsonOut_({ success: false, error: String(err) });
  }
}

function handleGroupMembers_(e) {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(GROUP_MEMBERS_CACHE_KEY);
  if (cached) {
    recordGroupMemberFirstSeenFromCachedJson_(cached);
    return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    cached = cache.get(GROUP_MEMBERS_CACHE_KEY);
    if (cached) {
      recordGroupMemberFirstSeenFromCachedJson_(cached);
      return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON);
    }

    var groupEmail = getGroupEmailForDirectory_();
    var members = listWorkspaceGroupMembersPaged_(groupEmail);
    recordGroupMemberFirstSeen_(members);
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

/**
 * Onboarding stats for the overview dashboard.
 * Always refreshes the live member list (not the members JSON cache) so new emails are recorded.
 * Optional ?month=YYYY-MM returns that month in onboarding.selectedMonth.
 *
 * Set a daily time-driven trigger on syncGroupOnboardingCron() so joins are captured even
 * when nobody opens the app (recommended).
 */
function handleGroupOnboarding_(e) {
  var members = loadGroupMembersForOnboarding_();
  var map = recordGroupMemberFirstSeen_(members);
  var monthParam = e && e.parameter && e.parameter.month ? String(e.parameter.month).trim() : '';
  var onboarding = buildOnboardingStats_(map, monthParam);
  return jsonOut_({ success: true, onboarding: onboarding, memberCount: members.length });
}

/** Uses the same 5-minute member cache as group_members when available (much faster). */
function loadGroupMembersForOnboarding_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(GROUP_MEMBERS_CACHE_KEY);
  if (cached) {
    try {
      var payload = JSON.parse(cached);
      if (payload && payload.members && payload.members.length) {
        return payload.members;
      }
    } catch (err) {
      // fall through to live fetch
    }
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    cached = cache.get(GROUP_MEMBERS_CACHE_KEY);
    if (cached) {
      try {
        var payload2 = JSON.parse(cached);
        if (payload2 && payload2.members && payload2.members.length) {
          return payload2.members;
        }
      } catch (err2) {}
    }

    var groupEmail = getGroupEmailForDirectory_();
    var members = listWorkspaceGroupMembersPaged_(groupEmail);
    var json = JSON.stringify({ success: true, members: members });
    if (json.length <= 95000) {
      cache.put(GROUP_MEMBERS_CACHE_KEY, json, GROUP_MEMBERS_CACHE_SEC);
    }
    return members;
  } finally {
    lock.releaseLock();
  }
}

/** Run daily (Apps Script → Triggers) to record new group members without a dashboard visit. */
function syncGroupOnboardingCron() {
  var groupEmail = getGroupEmailForDirectory_();
  var members = listWorkspaceGroupMembersPaged_(groupEmail);
  recordGroupMemberFirstSeen_(members);
}

function recordGroupMemberFirstSeen_(members) {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty(GROUP_MEMBER_FIRST_SEEN_KEY) || '{}';
  var map;
  try {
    map = JSON.parse(raw);
  } catch (err) {
    map = {};
  }
  if (!map || typeof map !== 'object') map = {};

  var seeded = props.getProperty(GROUP_ONBOARDING_SEEDED_KEY) === '1';
  var now = new Date().toISOString();
  var changed = false;

  if (!seeded) {
    for (var s = 0; s < members.length; s++) {
      var seedEmail = String(members[s].email || '').trim().toLowerCase();
      if (!seedEmail) continue;
      if (!map[seedEmail]) {
        map[seedEmail] = GROUP_ONBOARDING_LEGACY_ISO;
        changed = true;
      }
    }
    props.setProperty(GROUP_ONBOARDING_SEEDED_KEY, '1');
  }

  for (var i = 0; i < members.length; i++) {
    var email = String(members[i].email || '').trim().toLowerCase();
    if (!email) continue;
    if (!map[email]) {
      map[email] = now;
      changed = true;
    }
  }
  if (changed) {
    props.setProperty(GROUP_MEMBER_FIRST_SEEN_KEY, JSON.stringify(map));
  }
  return map;
}

function buildOnboardingStats_(map, requestedMonthKey) {
  var tz = Session.getScriptTimeZone();
  var countsByMonth = {};
  for (var email in map) {
    if (!Object.prototype.hasOwnProperty.call(map, email)) continue;
    var key = monthKeyFromIso_(map[email], tz);
    if (!key) continue;
    countsByMonth[key] = (countsByMonth[key] || 0) + 1;
  }

  var now = new Date();
  var currentKey = monthKeyFromDate_(now, tz);
  var prevKey = previousMonthKey_(currentKey);

  var onboarding = {
    timeZone: tz,
    currentMonth: {
      key: currentKey,
      label: monthLabelFromKey_(currentKey),
      count: countsByMonth[currentKey] || 0
    },
    previousMonth: {
      key: prevKey,
      label: monthLabelFromKey_(prevKey),
      count: countsByMonth[prevKey] || 0
    },
    countsByMonth: countsByMonth,
    memberCount: Object.keys(map).length
  };

  if (requestedMonthKey && /^\d{4}-\d{2}$/.test(requestedMonthKey)) {
    onboarding.selectedMonth = {
      key: requestedMonthKey,
      label: monthLabelFromKey_(requestedMonthKey),
      count: countsByMonth[requestedMonthKey] || 0
    };
  }

  return onboarding;
}

function monthKeyFromIso_(iso, tz) {
  var d = new Date(iso);
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) return '';
  return monthKeyFromDate_(d, tz);
}

function monthKeyFromDate_(d, tz) {
  return Utilities.formatDate(d, tz, 'yyyy-MM');
}

function previousMonthKey_(key) {
  var parts = key.split('-');
  if (parts.length !== 2) return '';
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  if (isNaN(y) || isNaN(m)) return '';
  var d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() - 1);
  return Utilities.formatDate(d, scriptTimeZone_(), 'yyyy-MM');
}

function scriptTimeZone_() {
  try {
    return Session.getScriptTimeZone();
  } catch (e) {
    return 'America/Los_Angeles';
  }
}

function monthLabelFromKey_(key) {
  var parts = key.split('-');
  if (parts.length !== 2) return key;
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  if (isNaN(y) || isNaN(m)) return key;
  var d = new Date(y, m - 1, 1);
  return Utilities.formatDate(d, scriptTimeZone_(), 'MMMM yyyy');
}

function recordGroupMemberFirstSeenFromCachedJson_(cachedJson) {
  try {
    var payload = JSON.parse(cachedJson);
    if (payload && payload.members && payload.members.length) {
      recordGroupMemberFirstSeen_(payload.members);
    }
  } catch (err) {
    // Ignore cache parse errors; live fetch will repair on next miss.
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
