# We’re Still Seeing Shadows — Interest Form

A responsive, branching recruitment form styled to match the project’s moss-green, handmade-science aesthetic.

## Files

- `index.html` — form markup and copy
- `styles.css` — visual design
- `script.js` — branching, calendar logic, validation and submission
- `config.js` — Google Apps Script URL and form key
- `google-apps-script/Code.gs` — server-side code that writes responses to Google Sheets

## Connect the form to Google Sheets

### 1. Create the response spreadsheet

1. Create a blank Google Sheet.
2. Rename it something like `Shadows Team Interest Responses`.
3. In the Sheet, choose **Extensions → Apps Script**.

### 2. Add the Apps Script

1. Delete the starter code in the Apps Script editor.
2. Copy everything from `google-apps-script/Code.gs` into the editor.
3. Save the project.
4. Make sure `FORM_KEY` in `Code.gs` matches `formKey` in `config.js`.
5. Run `setupSheet` once from the Apps Script editor.
6. Approve Google’s requested permissions. This creates and formats the `Responses` tab.

### 3. Deploy it as a web app

1. In Apps Script, choose **Deploy → New deployment**.
2. Select **Web app**.
3. Set **Execute as** to **Me**.
4. Set **Who has access** to **Anyone** if your account permits it.
   - Some school or organization accounts restrict public web apps. In that case, use a personal Google account, ask the Workspace administrator, or limit the form to people signed into the permitted organization.
5. Deploy and copy the URL ending in `/exec`.

### 4. Add the URL to the form

Open `config.js` and replace:

```js
googleAppsScriptUrl: "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE"
```

with the copied `/exec` URL.

### 5. Test before sharing

1. Open `index.html` in a browser.
2. Complete one test response.
3. Confirm that a row appears in the `Responses` sheet.
4. Check the branching for several different roles.
5. Delete the test row when finished.

## Put the form online

The form is a static site, so it can be hosted on GitHub Pages, Netlify, Cloudflare Pages, Stanford web hosting or another static host. Upload all three public files together:

- `index.html`
- `styles.css`
- `script.js`
- `config.js`

Keep their filenames and relative locations unchanged.

## Embed it in Notion

After hosting the form, copy its public URL. In Notion, type `/embed`, paste the URL and resize the embed. Notion cannot run the ZIP itself as a live form; the files must be hosted somewhere first.

## Change dates or roles

### Dates

Edit the `EVENTS` array near the top of `script.js`.

### Role-specific date requirements

Edit `ROLE_EVENT_RULES` in `script.js`:

- `required` = essential
- `preferred` = strongly preferred
- `deadline` = deadline or flexible check-in

### Role names

Role labels appear in both `index.html` and the `ROLE_LABELS` object in `script.js`. Keep each checkbox value aligned with the matching JavaScript key.

## Optional email alerts

In `Code.gs`, add an address here:

```js
NOTIFICATION_EMAIL: 'your-email@example.com'
```

Apps Script will email that address each time a new response is saved.

## Security notes

- The form includes a hidden honeypot field to reduce basic bot spam.
- The Apps Script escapes strings beginning with spreadsheet formula characters before writing them to the Sheet.
- The `formKey` is a lightweight check, not a true secret, because it is visible in the public JavaScript.
- Do not use this form to collect highly sensitive information.
