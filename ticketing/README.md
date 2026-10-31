# Shadows invitations

This adds `/tickets/` and `/reserve/` to the existing GitHub Pages site. The old `/ticket-gen/` address redirects to `/tickets/`. The home page is unchanged.

The pages use Sometype Mono, the centered ASCII deer, and background `#274e13`. The printable cards follow the supplied ticket reference. There are no QR codes.

## What works

- Team password checked on the server, with an eight-hour session.
- One ticket per separate invitation, or all admissions on one shared card.
- Optional names, printable US Letter PDFs, and an editable email draft for each invitation.
- Two-word invitation codes from `nature_adjectives_nouns_100.xlsx`, `Nature Words!A2:A101` and `C2:C101`. All 10,000 combinations are used before falling back to adjective/adjective/noun codes with column B. Codes are never reused, including after cancellation or voiding. Capitalization, spaces, and hyphens are ignored when redeeming a code.
- November 18, 19, and 20, 2026, initially 7:30 pm Pacific and 35 admissions per night. Both capacity and time can be edited from the guest list.
- Capacity checks, one redemption per invitation, safe retries, code-and-email access for changing or cancelling, invitation voiding, and CSV guest lists.
- Google Sheets adapter with Invitations, Reservations, and Performances tabs.

Email invitations open a complete editable draft in the cast member's email app. The cast member reviews it and sends it themselves. The website never transmits an email. Reservation confirmations are displayed on screen and can be downloaded. Later arrival instructions still need to be composed and approved separately.

## Local preview

```sh
npm install
npm run preview
```

Open <http://127.0.0.1:4177/tickets/> or <http://127.0.0.1:4177/reserve/>. The password is read from `.preview/admin-password` or the `SHADOWS_PREVIEW_PASSWORD` environment variable. A fresh checkout without either uses `forest-preview` for local testing only.

Local events are saved in `.preview/invitations.jsonl`. This directory is ignored by Git and blocked by the preview server. Preview bookings do not reserve real seats. PDFs made in the preview contain a local-test label and local website address.

```sh
npm test
```

The tests cover real concurrent HTTP booking attempts, persistence across a restart, group capacity, authorization, code normalization and exhaustion, duplicate redemption, retry safety, changes, cancellation, and voiding.

## Connect Google Sheets before opening real reservations

The public pages are connected to the Apps Script deployment in `ticketing/config.js`. The production Google Sheet is [Shadows — invitations & reservations](https://docs.google.com/spreadsheets/d/1jQYXOXXAk8c-bHnsN-AIjONHv-E-ypT6yCKk_P3usCA/edit), owned by `shochman@stanford.edu`. Local preview continues to use its own separate server and local data.

To set up a replacement deployment, use the steps below. Clearing `apiUrl` closes public reservations without changing any existing bookings.

1. Create a private Google Sheet for the show's guest list. Open **Extensions → Apps Script**.
2. Copy `backend/Code.gs` into **Code.gs**. Add two more script files: **Core.gs** from `backend/Core.js`, and **Words.gs** from `backend/Words.js`.
3. In **Project Settings → Script properties**, add `TEAM_PASSWORD` with the chosen team password. Do not put it into public JavaScript or Git.
4. Run `setupTickets` once and approve Google's spreadsheet permission prompt. It creates the tabs and stores the password hash and session secret in Script properties. The temporary `TEAM_PASSWORD` value is removed after setup.
5. Deploy as a **Web app**, executing as **Me**, with access for **Anyone**. An organization account may restrict this; use an account whose policy permits public reservation requests. Only the password-protected team actions can inspect guest details or create invitations.
6. Copy the deployment URL ending in `/exec` into `apiUrl` in `ticketing/config.js`, then commit and push that change to GitHub Pages.
7. Test a real invitation from the production domain. Verify that a booking appears in the Reservations tab, that the count increases in Performances, and that the code and booking email can change and cancel it. Use a fresh invitation for opening night.

`PUBLIC_ORIGIN` defaults to `https://stillseeingshadows.com`. If the website origin changes, update that Script property; responses are sent only to that exact website. The adapter uses an HTML form and iframe with an authenticated response nonce instead of relying on cross-origin fetch headers. It checks the response origin and never sends credentials in URLs.

After changing Apps Script source, publish a new deployment version. Never put the old recruitment-form deployment URL into this configuration: that is a separate service.

## Sheet behavior

The hidden Events tab is the durable source of truth. Every mutation is appended under a script-wide lock before a successful response is returned. The three visible tabs are rebuilt from this journal. If rebuilding fails after a booking has saved, the booking still succeeds and the team dashboard retries the projection. Do not manually change or delete Events rows. Edit capacity and time in the team page; editing the visible spreadsheet summaries does not change the reservation engine.

Keep the workbook private to the people who manage reservations. It contains guest contact details; Do not publish the Sheet or use it as a public website data source. Invitation words are designed to be memorable; booking changes require both the invitation code and the current booking email. The Apps Script adapter limits code and password checks to 60 per minute globally.

## Dependencies

The PDF and font libraries in `vendor/` are committed so GitHub Pages needs no build. Run `npm run vendor` after updating the locked packages. Sometype Mono is bundled locally under its SIL Open Font License. `pdf-lib` and `@pdf-lib/fontkit` use the MIT license. The fonts and PDF libraries are never loaded from a third-party CDN during booking.

Google references: [Web apps](https://developers.google.com/apps-script/guides/web), [LockService](https://developers.google.com/apps-script/reference/lock/lock-service), and [HTML service restrictions](https://developers.google.com/apps-script/guides/html/restrictions).
