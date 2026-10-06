# wedding-invitation

Harshit & Deeksha's wedding invitation site. Static HTML/CSS/JS, hosted on GitHub Pages.

## RSVP setup

RSVPs from the form are saved to a Google Sheet you own.

1. Create a Google Sheet (e.g. "Wedding RSVPs").
2. In the sheet, open **Extensions → Apps Script**, replace the code with [`apps-script/rsvp.gs`](apps-script/rsvp.gs), and save.
3. Click **Deploy → New deployment**, choose type **Web app**, set
   - **Execute as:** Me
   - **Who has access:** Anyone

   then **Deploy** and approve the permissions prompt.
4. Copy the **Web app URL** (ends in `/exec`) into `RSVP_ENDPOINT` at the top of [`js/rsvp.js`](js/rsvp.js).
5. Optionally set `WHATSAPP_NUMBER` in the same file (country code + number, digits only, e.g. `919876543210`) to show the "RSVP on WhatsApp" button.

Responses appear in a tab named **RSVPs** with the time, name, attending (Yes/No) and number of guests.
If you change `rsvp.gs` later, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.
