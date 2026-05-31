# Shelf It Right - Library of Congress Music Score Training

Shelf It Right is a browser-based training game for learning how to compare and shelve music score call numbers. It is built for Stony Brook University Music Library student training.

Live game: https://sbuvictor.github.io/music-sorting-game/

## Current Status

Last reviewed: May 31, 2026.

The live game currently teaches Library of Congress Classification call-number ordering for music scores. It is not a Dewey Decimal training game.

The current version includes:

- A short lesson before each tested module
- Semi-random question generation so retakes produce new labels
- 20 questions per module
- Three instructional modules
- A final sorting activity with randomized labels
- Desktop drag-and-drop support
- Mobile and keyboard tap-to-place support for the final sorting activity
- General email validation
- Score submission to a connected Google Sheet (for @stonybrook.edu players)
- Grade email delivery through Google Apps Script

## What It Teaches

The game focuses on comparing Library of Congress music score labels from top to bottom:

- `M` class music score labels
- Main class number comparison
- Cutter comparison
- Later line details, especially line 4
- Years, volumes, parts, numbers, copy numbers, and local-looking score details when earlier lines match

## What It Does Not Teach Yet

This is important: the game is not a complete Library of Congress Classification course.

Current limits:

- It focuses on `M` music score labels, not the full `M`, `ML`, and `MT` landscape.
- It does not teach Dewey Decimal classification.
- It does not cover every possible music score call-number edge case.
- It should be treated as a training aid for shelving logic, not as a replacement for local cataloging documentation or supervisor guidance.

## How The Game Works

1. The learner enters their real name, preferred name, and email.
2. Each module starts with a lesson and worked example.
3. The learner answers 20 semi-random comparison questions per module.
4. The learner completes a final order-sorting activity.
5. The game builds a score payload and submits it to the Apps Script endpoint.
6. The backend records the result in the Google Sheet and sends a grade email.

Scoring:

- 60 quiz points: 20 questions x 3 modules
- 1 final sorting point
- Maximum score: 61
- Passing requires each module to meet the module threshold and the final sorting activity to be correct.

## Data And Email

The frontend posts results to a Google Apps Script web app URL stored in `index.html` as `APP_SCRIPT_URL`.

The Apps Script backend:

- Accepts any valid email address, but only records @stonybrook.edu submissions to the connected Google Sheet
- Sends a grade/score email with `MailApp` to all players
- Stores email status fields such as `Sent` or `Failed`

Honest caveat: the browser submission uses `no-cors`, so the page can confirm that it sent the request, but it cannot read the Apps Script response directly. The reliable confirmation is the sheet row and the email status/email receipt.

## Files

- `index.html` - the full game frontend, question generation, lessons, scoring, and submit logic
- `Code.gs` - Apps Script backend source kept at the repo root for easy copying
- `apps-script/Code.gs` - same backend source, kept in an Apps Script-specific folder

The two `Code.gs` copies should stay in sync.

## Deployment Notes

GitHub Pages hosts the game from this repository.

Google Apps Script is separate. Updating `Code.gs` in GitHub does not automatically update the deployed Apps Script project. If the backend changes, the Apps Script project must be updated and redeployed manually.

If the Apps Script deployment URL changes, update `APP_SCRIPT_URL` in `index.html` and publish the change to GitHub Pages.

## Built With

- HTML
- CSS
- Vanilla JavaScript
- GitHub Pages
- Google Apps Script
- Google Sheets
- `MailApp` for grade emails

## Known Limitations

- No committed automated test suite yet; testing has been done with browser automation and endpoint smoke tests.
- No admin dashboard for reviewing attempts.
- Email identity is validated by address pattern, not by a login flow.
- The frontend cannot display the actual Apps Script JSON response because of the `no-cors` submission mode.
- The content is intentionally scoped to the current music score training use case.

## Development Notes

Created by Victor Santiago with AI-assisted implementation support.

This project was built through an iterative collaboration: human direction, music library domain knowledge, testing, and design decisions paired with AI-assisted coding, debugging, and documentation updates.
