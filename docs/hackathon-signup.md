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

Sheet columns, in order: Timestamp, Name, Email, Tracks, Skills & experience,
Allergies & dietary, Medical & mental health, Room preference, 18+, Emergency
contact, Anything else, Successful projects, Arrival, Departure.

The confirmation email is sent with both `htmlBody` (what Gmail shows — flows
naturally at any window width) and a plain-text `body` fallback (hard-wrapped
at ~76 chars by the mail pipeline, which is why htmlBody exists).

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
      (data.tracks || []).join(', '),
      data.skills || '',
      data.dietary || '',
      data.medical || '',
      data.roomPreference || '',
      data.over18 ? 'Yes' : 'No',
      data.emergencyContact || '',
      data.anythingElse || '',
      data.successfulProjects || '',
      data.arrival || '',
      data.departure || '',
    ])

    if (data.email) {
      var name = data.name || 'there'
      // Plain-text fallback (some clients only show this); Gmail shows htmlBody.
      var body =
        'Hi ' +
        name +
        ',\n\n' +
        'Thanks for applying to the AISafety.com Hackathon 2026!\n\n' +
        'The details:\n' +
        '- Dates: Thursday 17 - Sunday 20 September 2026\n' +
        '- Venue: CEEALAR (the EA Hotel) in Blackpool, England (ceealar.org)\n' +
        '- Accommodation and meals are provided\n\n' +
        "Applications close 10 August. Spots are limited, so we'll be in " +
        'touch to confirm your place and share more details before the ' +
        'event.\n\n' +
        'If you have any questions, just reply to this email.\n\n' +
        'The AISafety.com team'
      var htmlBody =
        '<p>Hi ' +
        escapeHtml(name) +
        ',</p>' +
        '<p>Thanks for applying to the AISafety.com Hackathon 2026!</p>' +
        '<p>The details:<br>' +
        '&ndash; Dates: Thursday 17 &ndash; Sunday 20 September 2026<br>' +
        '&ndash; Venue: CEEALAR (the EA Hotel) in Blackpool, England ' +
        '(<a href="https://www.ceealar.org">ceealar.org</a>)<br>' +
        '&ndash; Accommodation and meals are provided</p>' +
        "<p>Applications close 10 August. Spots are limited, so we'll be in " +
        'touch to confirm your place and share more details before the ' +
        'event.</p>' +
        '<p>If you have any questions, just reply to this email.</p>' +
        '<p>The AISafety.com team</p>'
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
