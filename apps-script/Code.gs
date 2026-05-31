/************************************************************
 Shelf It Right - score recorder and grade emailer

 Deploy this as a Google Apps Script web app attached to the
 Music Score Training Scoreboard spreadsheet.
************************************************************/

const SCOREBOARD_CONFIG = {
  SPREADSHEET_ID: '1w39dQTMuLyqoRxltH6POUSoQ8GWEFWyHoN483xW0zqk',
  SHEET_NAME: 'Training Scoreboard',
  MAX_SCORE: 61,
  EMAIL_FROM_NAME: 'Shelf It Right',
  REQUIRED_EMAIL_PATTERN: /^[A-Za-z0-9._%+-]+@stonybrook\.edu$/i
};

const SCOREBOARD_HEADERS = [
  'Timestamp',
  'Real Name',
  'Preferred Name',
  'SBU Email',
  'Module 1 Completed',
  'Module 1 Passed',
  'Module 2 Completed',
  'Module 2 Passed',
  'Module 3 Completed',
  'Module 3 Passed',
  'Module 4 Completed',
  'Module 4 Passed',
  'Total Modules Completed',
  'Total Modules Passed',
  'Cumulative Check Passed',
  'Final Drag-and-Drop Passed',
  'Total Score',
  'Pass/Fail',
  'Attempt Count',
  'Email Status',
  'Email Sent At',
  'Email Error'
];

function doGet() {
  return jsonResponse_({
    ok: true,
    message: 'Shelf It Right submission endpoint is live.',
    features: ['record-submission', 'email-grade']
  });
}

function doPost(e) {
  let rowNumber = null;

  try {
    const payload = normalizePayload_(parsePayload_(e));
    const validationError = validatePayload_(payload);

    if (validationError) {
      return jsonResponse_({
        ok: false,
        error: validationError
      });
    }

    const isSbuEmail = SCOREBOARD_CONFIG.REQUIRED_EMAIL_PATTERN.test(payload.sbuEmail);
    if (isSbuEmail) {
      rowNumber = appendSubmission_(payload);
    }

    const emailResult = sendGradeEmail_(payload);
    
    if (isSbuEmail && rowNumber) {
      updateEmailStatus_(rowNumber, emailResult);
    }

    return jsonResponse_({
      ok: true,
      message: emailResult.ok
        ? (isSbuEmail ? 'Submission recorded and grade email sent.' : 'Grade email sent.')
        : (isSbuEmail ? 'Submission recorded, but grade email could not be sent.' : 'Grade email could not be sent.'),
      emailSent: emailResult.ok
    });
  } catch (err) {
    if (rowNumber) {
      updateEmailStatus_(rowNumber, {
        ok: false,
        error: String(err && err.message ? err.message : err)
      });
    }

    return jsonResponse_({
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  }
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('No submission body was received.');
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    throw new Error('Submission body was not valid JSON.');
  }
}

function normalizePayload_(raw) {
  const payload = raw || {};

  return {
    timestamp: String(payload.timestamp || new Date().toISOString()),
    realName: cleanText_(payload.realName),
    preferredName: cleanText_(payload.preferredName),
    sbuEmail: cleanText_(payload.sbuEmail).toLowerCase(),
    module1Completed: Boolean(payload.module1Completed),
    module1Passed: Boolean(payload.module1Passed),
    module2Completed: Boolean(payload.module2Completed),
    module2Passed: Boolean(payload.module2Passed),
    module3Completed: Boolean(payload.module3Completed),
    module3Passed: Boolean(payload.module3Passed),
    module4Completed: Boolean(payload.module4Completed),
    module4Passed: Boolean(payload.module4Passed),
    totalModulesCompleted: safeNumber_(payload.totalModulesCompleted),
    totalModulesPassed: safeNumber_(payload.totalModulesPassed),
    cumulativeCheckPassed: Boolean(payload.cumulativeCheckPassed),
    finalDragDropPassed: Boolean(payload.finalDragDropPassed),
    totalScore: safeNumber_(payload.totalScore),
    passFail: cleanText_(payload.passFail) === 'Pass' ? 'Pass' : 'Fail',
    attemptCount: safeNumber_(payload.attemptCount) || 1
  };
}

function validatePayload_(payload) {
  if (!payload.realName) {
    return 'Real Name is required.';
  }

  if (!payload.preferredName) {
    return 'Preferred Name is required.';
  }

  if (!payload.sbuEmail) {
    return 'Email is required.';
  }

  const generalEmailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/i;
  if (!generalEmailPattern.test(payload.sbuEmail)) {
    return 'A valid email address is required.';
  }

  return '';
}

function appendSubmission_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getScoreSheet_();
    ensureHeaders_(sheet);
    sheet.appendRow(buildRow_(payload, 'Pending', '', ''));
    return sheet.getLastRow();
  } finally {
    lock.releaseLock();
  }
}

function buildRow_(payload, emailStatus, emailSentAt, emailError) {
  return [
    payload.timestamp,
    payload.realName,
    payload.preferredName,
    payload.sbuEmail,
    yesNo_(payload.module1Completed),
    yesNo_(payload.module1Passed),
    yesNo_(payload.module2Completed),
    yesNo_(payload.module2Passed),
    yesNo_(payload.module3Completed),
    yesNo_(payload.module3Passed),
    yesNo_(payload.module4Completed),
    yesNo_(payload.module4Passed),
    payload.totalModulesCompleted,
    payload.totalModulesPassed,
    yesNo_(payload.cumulativeCheckPassed),
    yesNo_(payload.finalDragDropPassed),
    payload.totalScore,
    payload.passFail,
    payload.attemptCount,
    emailStatus,
    emailSentAt,
    emailError
  ];
}

function sendGradeEmail_(payload) {
  try {
    const subject = 'Shelf It Right training result: ' + payload.passFail +
      ' (' + payload.totalScore + '/' + SCOREBOARD_CONFIG.MAX_SCORE + ')';
    const body = buildPlainTextEmail_(payload);
    const htmlBody = buildHtmlEmail_(payload);

    MailApp.sendEmail({
      to: payload.sbuEmail,
      subject: subject,
      body: body,
      htmlBody: htmlBody,
      name: SCOREBOARD_CONFIG.EMAIL_FROM_NAME
    });

    return {
      ok: true,
      sentAt: new Date().toISOString(),
      error: ''
    };
  } catch (err) {
    return {
      ok: false,
      sentAt: '',
      error: String(err && err.message ? err.message : err)
    };
  }
}

function updateEmailStatus_(rowNumber, emailResult) {
  const sheet = getScoreSheet_();
  ensureHeaders_(sheet);
  sheet.getRange(rowNumber, 20, 1, 3).setValues([[
    emailResult.ok ? 'Sent' : 'Failed',
    emailResult.sentAt || '',
    emailResult.error || ''
  ]]);
}

function buildPlainTextEmail_(payload) {
  const name = payload.preferredName || payload.realName || 'there';

  return [
    'Hello ' + name + ',',
    '',
    'Your Shelf It Right training result has been recorded.',
    '',
    'Result: ' + payload.passFail,
    'Score: ' + payload.totalScore + ' / ' + SCOREBOARD_CONFIG.MAX_SCORE,
    'Modules passed: ' + payload.totalModulesPassed + ' / 4',
    'Final drag-and-drop: ' + (payload.finalDragDropPassed ? 'Passed' : 'Not passed'),
    '',
    'Module details:',
    '- Module 1: ' + (payload.module1Passed ? 'Passed' : 'Not passed'),
    '- Module 2: ' + (payload.module2Passed ? 'Passed' : 'Not passed'),
    '- Module 3: ' + (payload.module3Passed ? 'Passed' : 'Not passed'),
    '- Module 4: ' + (payload.module4Passed ? 'Passed' : 'Not passed'),
    '',
    'Thank you for completing the training.'
  ].join('\n');
}

function buildHtmlEmail_(payload) {
  const name = htmlEscape_(payload.preferredName || payload.realName || 'there');
  const resultColor = payload.passFail === 'Pass' ? '#006b3f' : '#990000';

  return [
    '<p>Hello ' + name + ',</p>',
    '<p>Your <strong>Shelf It Right</strong> training result has been recorded.</p>',
    '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;">',
    '<tr><td><strong>Result</strong></td><td style="color:' + resultColor + ';"><strong>' + htmlEscape_(payload.passFail) + '</strong></td></tr>',
    '<tr><td><strong>Score</strong></td><td>' + payload.totalScore + ' / ' + SCOREBOARD_CONFIG.MAX_SCORE + '</td></tr>',
    '<tr><td><strong>Modules passed</strong></td><td>' + payload.totalModulesPassed + ' / 4</td></tr>',
    '<tr><td><strong>Final drag-and-drop</strong></td><td>' + (payload.finalDragDropPassed ? 'Passed' : 'Not passed') + '</td></tr>',
    '</table>',
    '<p><strong>Module details</strong></p>',
    '<ul>',
    '<li>Module 1: ' + (payload.module1Passed ? 'Passed' : 'Not passed') + '</li>',
    '<li>Module 2: ' + (payload.module2Passed ? 'Passed' : 'Not passed') + '</li>',
    '<li>Module 3: ' + (payload.module3Passed ? 'Passed' : 'Not passed') + '</li>',
    '<li>Module 4: ' + (payload.module4Passed ? 'Passed' : 'Not passed') + '</li>',
    '</ul>',
    '<p>Thank you for completing the training.</p>'
  ].join('');
}

function getScoreSheet_() {
  const ss = SpreadsheetApp.openById(SCOREBOARD_CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SCOREBOARD_CONFIG.SHEET_NAME);

  if (!sheet) {
    throw new Error('Could not find sheet tab: ' + SCOREBOARD_CONFIG.SHEET_NAME);
  }

  return sheet;
}

function ensureHeaders_(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, SCOREBOARD_HEADERS.length);
  const current = headerRange.getValues()[0];
  const needsUpdate = SCOREBOARD_HEADERS.some(function(header, index) {
    return current[index] !== header;
  });

  if (needsUpdate) {
    headerRange.setValues([SCOREBOARD_HEADERS]);
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function cleanText_(value) {
  return String(value == null ? '' : value).trim().slice(0, 500);
}

function safeNumber_(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function yesNo_(value) {
  return value ? 'Yes' : 'No';
}

function htmlEscape_(value) {
  return String(value).replace(/[&<>"']/g, function(char) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char];
  });
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
