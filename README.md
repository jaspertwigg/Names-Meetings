# Names & Meetings

A small app for remembering the people you meet and what they told you.

- Add a person with their name and a short tagline (e.g. *"Sam's dad, loves cycling"*).
- Log each time you meet them: the date, where, and what you talked about
  (e.g. *"Going on holiday to Japan next month"*).
- Search across names, taglines and meeting notes, so you can look up "Japan" and find John.

**Live app:** https://jaspertwigg.github.io/Names-Meetings/

## Your data

Everything is saved in your browser on the device you use (no account, no server).
That means:

- Data doesn't sync between your phone and computer.
- Clearing your browser's site data will delete it.

Use **⋮ → Export backup** now and then to download a backup file, and **Import backup**
to restore it or move it to another device.

On a phone, use "Add to Home Screen" to open it like an app. It works offline too.

## Development

Plain HTML/CSS/JS with no build step: open `index.html` in a browser.
Pushing to `main` deploys to GitHub Pages via `.github/workflows/pages.yml`.
