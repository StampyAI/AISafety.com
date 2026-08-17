# Hackathon form pipelines

Two forms share one pipeline: the public application form on `/hackathon`, and
the unlisted attendee-details form on `/hackathon/details` that accepted
applicants get by email.

```
/hackathon        ApplicationForm.tsx  →  POST /api/hackathon-signup   ─┐
                                                                         ├─→  Google Apps Script web app
/hackathon/details DetailsForm.tsx     →  POST /api/hackathon-details  ─┘      ├─ appends a row to the private
                                                                                │  "AISafety.com Hackathon 2026
                                                                                │  Applications" Google Sheet
                                                                                │  (applications → first tab;
                                                                                │   details → "Attendee details" tab)
                                                                                └─ emails the person a confirmation
```

Neither form goes to Airtable: they include personal data (emergency
contacts, medical and dietary needs) that must stay out of the shared base, and
the team reviews them in a private Google Sheet instead.

## The details form (`/hackathon/details`)

Unlisted on purpose – not in the sitemap, search index, footer, `llms.txt`, or
the assistant's page list, and served with `noindex`. Bryce emails the link to
accepted applicants.

`src/app/hackathon/details/questions.ts` is the single source of truth for what
it asks: the form renders from it and the API route validates against it. The
API route turns each answer into a `[label, value]` pair, and the Apps Script
maps those into Sheet columns **by label**, adding a column whenever a new label
appears – so editing, adding, or reordering questions only touches
`questions.ts`; the script and Sheet adapt on their own. (Rewording a question
starts a new column; rename the old header in the Sheet to match if you want
the history in one place.)

## Environment variables

- `HACKATHON_SCRIPT_URL` – the Apps Script web app's `/exec` URL.
- `HACKATHON_FORM_SECRET` – shared secret; the API routes include it in each
  POST and the script rejects requests without it (the `/exec` URL is
  technically public).

Both routes read the same two variables. When either is unset, dev builds log
the submission and pretend success (so the forms can be tested locally);
production returns a 500.

## Abuse protection

- Honeypot field (`website`) – filled → request is dropped with a fake success.
- Per-IP rate limit, 5/hour per form, via the existing Upstash Redis (protects
  the Gmail quota behind confirmation emails, ~100 sends/day).
- Every field is length-capped and, where it has fixed options, checked
  against them server-side.

## The Apps Script

Lives in the applications Sheet: Extensions → Apps Script, deployed as a web
app ("Execute as: Me", "Who has access: Anyone"), owned by Bryce's Google
account. Redeploy after edits via Deploy → Manage deployments → edit → new
version — this keeps the same `/exec` URL. A redeploy publishes the last
_saved_ editor code, so paste + Cmd+S first.

Requests carry `form: 'details'` for the details form; anything else is treated
as an application. The details branch replies `{ ok: true, form: 'details' }`
and `/api/hackathon-details` insists on that echo, so a script version that
predates the details form (which would just append an empty row to the
applications tab) is reported as a failure rather than a silent success.

Applications go to the _first_ tab (keep it first): Timestamp, Name, Email,
Skills & experience, Anything else, Personal links. Details go to the
"Attendee details" tab: Timestamp, then one column per question label in form
order. The script creates that tab if it's missing.

Confirmation emails echo the person's answers back to them. They're sent with
both `htmlBody` (what Gmail shows — flows naturally at any window width) and a
plain-text `body` fallback (hard-wrapped at ~76 chars by the mail pipeline,
which is why htmlBody exists).

Current code (secret redacted; the real one is in the deployed script and in
the env vars):

```javascript
var SHARED_SECRET = '<HACKATHON_FORM_SECRET>'
var DETAILS_SHEET = 'Attendee details'

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Plain-text + HTML renderings of [question, answer] pairs, for the emails.
 *  Empty answers are skipped. */
function renderAnswers(answers) {
  var filled = answers.filter(function (a) {
    return a[1]
  })
  return {
    text: filled
      .map(function (a) {
        return a[0] + ':\n' + a[1]
      })
      .join('\n\n'),
    html: filled
      .map(function (a) {
        return (
          '<p><strong>' +
          escapeHtml(a[0]) +
          '</strong><br>' +
          escapeHtml(a[1]).replace(/\n/g, '<br>') +
          '</p>'
        )
      })
      .join(''),
  }
}

/** Application form (/hackathon): fixed columns on the first tab. */
function handleApplication(data) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]
  sheet.appendRow([
    new Date(),
    data.name || '',
    data.email || '',
    data.skills || '',
    data.anythingElse || '',
    data.links || '',
  ])

  if (!data.email) return

  var answers = renderAnswers([
    ['Name', data.name],
    ['Email', data.email],
    [
      'What skills or experience could you bring to this hackathon?',
      data.skills,
    ],
    ['Personal links', data.links],
    ["Anything else you'd like us to know?", data.anythingElse],
  ])

  var body =
    'Hi,\n\n' +
    'Thanks for applying to the AISafety.com Hackathon 2026 ' +
    '(https://aisafety.com/hackathon)! This is an automated email ' +
    'confirming your application submission.\n\n' +
    'Below are the answers you gave. Since applications have officially ' +
    "closed, we can't promise a decision, but we'll be in touch if we're " +
    'able to offer you a place. In the meantime, feel free to reply to this ' +
    'email with any questions or message Bryce on the AISafety.com Discord ' +
    'server (https://discord.gg/WQG8FAGqun) at @bryceerobertson.\n\n' +
    'Best,\n' +
    'Automated Bryce\n\n\n' +
    'YOUR FORM ANSWERS\n\n' +
    answers.text

  var htmlBody =
    '<p>Hi,</p>' +
    '<p>Thanks for applying to the ' +
    '<a href="https://aisafety.com/hackathon">AISafety.com Hackathon 2026</a>! ' +
    'This is an automated email confirming your application submission.</p>' +
    '<p>Below are the answers you gave. Since applications have officially ' +
    "closed, we can't promise a decision, but we'll be in touch if we're " +
    'able to offer you a place. In the meantime, feel free to reply to this ' +
    'email with any questions or message Bryce on the ' +
    '<a href="https://discord.gg/WQG8FAGqun">AISafety.com Discord server</a> ' +
    'at @bryceerobertson.</p>' +
    '<p>Best,<br>Automated Bryce</p>' +
    '<br>' +
    '<p><strong>Your form answers</strong></p>' +
    answers.html

  MailApp.sendEmail({
    to: data.email,
    subject: 'AISafety.com Hackathon 2026 - application received',
    body: body,
    htmlBody: htmlBody,
  })
}

/** Attendee-details form (/hackathon/details): answers arrive as
 *  [label, value] pairs and are written into the DETAILS_SHEET tab by label,
 *  adding a column for any label not seen before. */
function handleDetails(details) {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sheet = ss.getSheetByName(DETAILS_SHEET) || ss.insertSheet(DETAILS_SHEET)
  var answers = (details.answers || []).map(function (a) {
    return [String(a[0]), a[1] == null ? '' : String(a[1])]
  })

  var lastCol = sheet.getLastColumn()
  var headers = lastCol
    ? sheet
        .getRange(1, 1, 1, lastCol)
        .getValues()[0]
        .map(function (h) {
          return String(h)
        })
    : []
  if (headers.length === 0) {
    headers = ['Timestamp']
    sheet.getRange(1, 1).setValue('Timestamp')
    sheet.setFrozenRows(1)
  }

  var row = headers.map(function () {
    return ''
  })
  answers.forEach(function (a) {
    var col = headers.indexOf(a[0])
    if (col === -1) {
      headers.push(a[0])
      col = headers.length - 1
      // A fresh tab has 26 columns; grow it before writing past the edge.
      if (col + 1 > sheet.getMaxColumns()) {
        sheet.insertColumnsAfter(
          sheet.getMaxColumns(),
          col + 1 - sheet.getMaxColumns()
        )
      }
      sheet.getRange(1, col + 1).setValue(a[0])
      row.push('')
    }
    row[col] = a[1]
  })
  var ts = headers.indexOf('Timestamp')
  if (ts !== -1) row[ts] = new Date()
  sheet.appendRow(row)

  if (!details.email) return

  var rendered = renderAnswers(answers)

  var body =
    'Hi,\n\n' +
    'Thanks for sending us your details for the AISafety.com Hackathon 2026 ' +
    '(17–20 September at CEEALAR in Blackpool). This is an automated email ' +
    'confirming we received them – your answers are below.\n\n' +
    'If anything changes – especially your dates – just reply to this ' +
    'email. See you in Blackpool!\n\n' +
    'Best,\n' +
    'Automated Bryce\n\n\n' +
    'YOUR ANSWERS\n\n' +
    rendered.text

  var htmlBody =
    '<p>Hi,</p>' +
    '<p>Thanks for sending us your details for the ' +
    '<a href="https://aisafety.com/hackathon">AISafety.com Hackathon 2026</a> ' +
    '(17–20 September at CEEALAR in Blackpool). This is an automated email ' +
    'confirming we received them – your answers are below.</p>' +
    '<p>If anything changes – especially your dates – just reply to this ' +
    'email. See you in Blackpool!</p>' +
    '<p>Best,<br>Automated Bryce</p>' +
    '<br>' +
    '<p><strong>Your answers</strong></p>' +
    rendered.html

  MailApp.sendEmail({
    to: details.email,
    subject: 'AISafety.com Hackathon 2026 - your details',
    body: body,
    htmlBody: htmlBody,
  })
}

function doPost(e) {
  var out = ContentService.createTextOutput().setMimeType(
    ContentService.MimeType.JSON
  )

  try {
    var data = JSON.parse(e.postData.contents)

    if (data.secret !== SHARED_SECRET) {
      return out.setContent(
        JSON.stringify({ ok: false, error: 'unauthorized' })
      )
    }

    if (data.form === 'details') {
      handleDetails(data.details || {})
      return out.setContent(JSON.stringify({ ok: true, form: 'details' }))
    }

    handleApplication(data)
    return out.setContent(JSON.stringify({ ok: true }))
  } catch (err) {
    return out.setContent(JSON.stringify({ ok: false, error: String(err) }))
  }
}
```
