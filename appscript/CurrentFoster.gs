function syncCurrentFosterDogs() {
  const CONFIG = {
    endpoint: 'https://service.sheltermanager.com/asmservice',
    account: 'dm1440',
    username: 'integration_api',
    password: 'n0va!321',
    sheetName: 'Current Fosters',
    fosterMovementNames: ['foster', 'permanent foster', 'fostered']
  };

  const animals = fetchShelterAnimals_(CONFIG);
  const fosterDogs = animals.filter((animal) => isCurrentFosterDog_(animal, CONFIG));
  writeFosterDogsSheet_(CONFIG.sheetName, fosterDogs);
}

function fetchShelterAnimals_(config) {
  const params = {
    account: config.account,
    method: 'json_shelter_animals',
    username: config.username,
    password: config.password,
    sensitive: '1'
  };

  const query = Object.keys(params)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
    .join('&');

  const url = config.endpoint + '?' + query;

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      Accept: 'application/json'
    },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error('Shelter Manager API error (' + code + '): ' + body);
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch (err) {
    throw new Error('Response was not valid JSON: ' + body);
  }

  if (!Array.isArray(data)) {
    Logger.log(JSON.stringify(data, null, 2));
    throw new Error('Expected an array from json_shelter_animals. Check Apps Script logs.');
  }

  return data;
}

function isCurrentFosterDog_(animal, config) {
  const speciesName = String(animal.SPECIESNAME || '').toLowerCase().trim();
  const speciesId = Number(animal.SPECIESID || 0);
  const movementType = String(animal.ACTIVEMOVEMENTTYPENAME || '').toLowerCase().trim();
  const currentOwnerName = String(animal.CURRENTOWNERNAME || '').trim();

  const isDog = speciesName === 'dog' || speciesId === 1;
  const isFosterMovement = config.fosterMovementNames.some(name => movementType === name);
  const hasCurrentFoster = currentOwnerName !== '';

  return isDog && isFosterMovement && hasCurrentFoster;
}

function writeFosterDogsSheet_(sheetName, fosterDogs) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  const headers = [
    'Animal ID',
    'Code',
    'Name',
    'Status',
    'Breed',
    'Sex',
    'Age Group',
    'Foster Since',
    'Movement Type',
    'Foster Name',
    'Foster First Name',
    'Foster Last Name',
    'Foster Email',
    'Foster Mobile',
    'Foster Home Phone',
    'Foster Work Phone',
    'Foster Address',
    'Foster City',
    'Foster State/County',
    'Foster Zip/Postcode'
  ];

  const rows = fosterDogs.map(a => {
    const parsed = parseAnimalName_(a.ANIMALNAME);

    return [
      a.ID || '',
      a.SHELTERCODE || a.CODE || '',
      parsed.cleanName || '',
      parsed.status || '',
      a.BREEDNAME || a.BREEDNAME1 || '',
      a.SEXNAME || '',
      a.AGEGROUP || '',
      formatDateValue_(a.ACTIVEMOVEMENTDATE),
      a.ACTIVEMOVEMENTTYPENAME || '',
      a.CURRENTOWNERNAME || '',
      a.CURRENTOWNERFORENAMES || '',
      a.CURRENTOWNERSURNAME || '',
      a.CURRENTOWNEREMAILADDRESS || '',
      a.CURRENTOWNERMOBILETELEPHONE || '',
      a.CURRENTOWNERHOMETELEPHONE || '',
      a.CURRENTOWNERWORKTELEPHONE || '',
      a.CURRENTOWNERADDRESS || '',
      a.CURRENTOWNERTOWN || '',
      a.CURRENTOWNERCOUNTY || '',
      a.CURRENTOWNERPOSTCODE || ''
    ];
  });

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);
}


function parseAnimalName_(name) {
  const result = {
    cleanName: '',
    status: ''
  };

  if (!name) return result;

  let value = String(name).trim();

  // Remove bracketed notes from the displayed name.
  value = value.replace(/\[[^\]]*\]/g, ' ').trim();

  // Capture a leading status like *FTA, *ADOPTING, *TRANSPORT, *POSS FF, *uFTA
  const statusMatch = value.match(/^\*((?:[A-Za-z]+(?:\s+[A-Za-z]+)*)?)\s+/i);
  if (statusMatch) {
    result.status = statusMatch[1].trim().toUpperCase();
    value = value.slice(statusMatch[0].length).trim();
  }

  // Remove litter/group prefixes like a-, bb-, e-, pp-
  value = value.replace(/^[A-Za-z]{1,3}\s*-\s*/i, '');

  result.cleanName = value.replace(/\s+/g, ' ').trim();
  return result;
}



function formatDateValue_(value) {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
