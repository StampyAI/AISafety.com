# Hackathon application pipeline

The `/hackathon` page hosts the event info and an application form. Applications
flow:

```
ApplicationForm.tsx  →  POST /api/hackathon-signup  →  Google Apps Script web app
                                                        ├─ appends a row to the private
                                                        │  "AISafety.com Hackathon 2026
                                                        │  Applications" Google Sheet
                                                        └─ emails the applicant a
                                                           confirmation
```

Applications deliberately do NOT go to Airtable: they include personal data
(emergency contacts, medical and dietary needs) that must stay out of the
shared base, and the team reviews them in a private Google Sheet instead.

## Environment variables

- `HACKATHON_SCRIPT_URL` – the Apps Script web app's `/exec` URL.
- `HACKATHON_FORM_SECRET` – shared secret; the API route includes it in each
  POST and the script rejects requests without it (the `/exec` URL is
  technically public).

When either is unset, dev builds log the application and pretend success (so
the form can be tested locally); production returns a 500.

## Abuse protection

- Honeypot field (`website`) – filled → request is dropped with a fake success.
- Per-IP rate limit, 5/hour, via the existing Upstash Redis (protects the
  Gmail quota behind confirmation emails, ~100 sends/day).
- Every field is length-capped server-side.

## The Apps Script

Lives in the applications Sheet: Extensions → Apps Script, deployed as a web
app ("Execute as: Me", "Who has access: Anyone"), owned by Bryce's Google
account. Redeploy after edits via Deploy → Manage deployments → edit → new
version — this keeps the same `/exec` URL.

Sheet columns, in order: Timestamp, Name, Email, Skills & experience,
Allergies & dietary, Medical & mental health, Room preference, 18+, Emergency
contact, Anything else, Arrival, Departure.

The confirmation email echoes the applicant's answers back to them. It is sent
with both `htmlBody` (what Gmail shows — flows naturally at any window width)
and a plain-text `body` fallback (hard-wrapped at ~76 chars by the mail
pipeline, which is why htmlBody exists).

Current code (secret redacted; the real one is in the deployed script and in
the env vars):

```javascript
var SHARED_SECRET = '<HACKATHON_FORM_SECRET>'

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
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

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]
    sheet.appendRow([
      new Date(),
      data.name || '',
      data.email || '',
      data.skills || '',
      data.dietary || '',
      data.medical || '',
      data.roomPreference || '',
      data.over18 ? 'Yes' : 'No',
      data.emergencyContact || '',
      data.anythingElse || '',
      data.arrival || '',
      data.departure || '',
    ])

    if (data.email) {
      var name = data.name || 'there'

      // Question/answer pairs in form order; empty optional answers are skipped.
      var answers = [
        ['Full name', data.name],
        ['Email', data.email],
        [
          'What skills or experience could you bring to this hackathon?',
          data.skills,
        ],
        [
          'Do you have any allergies or dietary needs/preferences?',
          data.dietary,
        ],
        [
          'Do you have any particular medical or mental health needs you would like us to know about?',
          data.medical,
        ],
        ['Room preference', data.roomPreference],
        ['When would you arrive?', data.arrival],
        ['When would you leave?', data.departure],
        ['Emergency contact', data.emergencyContact],
        ["Anything else you'd like us to know?", data.anythingElse],
        [
          'At least 18 years old by the date of the event',
          data.over18 ? 'Yes' : 'No',
        ],
      ].filter(function (a) {
        return a[1]
      })

      var body =
        'Hi ' +
        name +
        ',\n\n' +
        'Thanks for applying to the AISafety.com Hackathon 2026 ' +
        '(https://aisafety.com/hackathon)! This is an automated email ' +
        'confirming your application submission.\n\n' +
        "Below are the answers you gave. We'll let you know the result of " +
        'your application by 21 August at the latest. In the meantime, feel ' +
        'free to reply to this email with any questions or message Bryce on ' +
        'the AISafety.com Discord server (https://discord.gg/WQG8FAGqun) at ' +
        '@bryceerobertson.\n\n' +
        'Best,\n' +
        'Automated Bryce\n\n\n' +
        'YOUR FORM ANSWERS\n\n' +
        answers
          .map(function (a) {
            return a[0] + ':\n' + a[1]
          })
          .join('\n\n')

      var htmlBody =
        '<p>Hi ' +
        escapeHtml(name) +
        ',</p>' +
        '<p>Thanks for applying to the ' +
        '<a href="https://aisafety.com/hackathon">AISafety.com Hackathon 2026</a>! ' +
        'This is an automated email confirming your application submission.</p>' +
        "<p>Below are the answers you gave. We'll let you know the result of " +
        'your application by 21 August at the latest. In the meantime, feel ' +
        'free to reply to this email with any questions or message Bryce on ' +
        'the <a href="https://discord.gg/WQG8FAGqun">AISafety.com Discord ' +
        'server</a> at @bryceerobertson.</p>' +
        '<p>Best,<br>Automated Bryce</p>' +
        '<br>' +
        '<p><strong>Your form answers</strong></p>' +
        answers
          .map(function (a) {
            return (
              '<p><strong>' +
              escapeHtml(a[0]) +
              '</strong><br>' +
              escapeHtml(a[1]).replace(/\n/g, '<br>') +
              '</p>'
            )
          })
          .join('')

      MailApp.sendEmail({
        to: data.email,
        subject: 'AISafety.com Hackathon 2026 - application received',
        body: body,
        htmlBody: htmlBody,
      })
    }

    return out.setContent(JSON.stringify({ ok: true }))
  } catch (err) {
    return out.setContent(JSON.stringify({ ok: false, error: String(err) }))
  }
}
```
