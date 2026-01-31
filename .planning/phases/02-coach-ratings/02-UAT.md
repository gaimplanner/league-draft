---
status: complete
phase: 02-coach-ratings
source: 02-01-SUMMARY.md, 02-02-SUMMARY.md
started: 2026-01-29T22:00:00Z
updated: 2026-01-30T18:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Navigate to Coach Ratings
expected: From the main app, click "Coach Ratings" in DivisionSelector. The Coach Rating page loads with a season selector dropdown.
result: pass

### 2. Add a Player to Roster
expected: On the "My Ratings" tab, use the add-player form to enter a first/last name and create a new rating entry. The player appears in the roster list with a "Draft" status badge.
result: pass

### 3. Rate a Player (Physical Skills)
expected: Click a player in the roster to open the rating form. Physical skill categories from the template are displayed with 1-5 radio buttons and anchor labels (e.g., descriptions for each score level). Select scores and save as draft.
result: pass

### 4. Rate a Player (Soft Skills)
expected: The same rating form also shows soft skill categories (e.g., baseball IQ, hustle, coachability) grouped separately from physical skills. Select scores for soft skills.
result: pass

### 5. Save Draft and Resume Later
expected: After partially scoring a player, click "Save Draft". Return to the roster, then re-open the same player. Previously saved scores are pre-populated in the form.
result: pass

### 6. Submit a Completed Rating
expected: After scoring all categories for a player, click "Submit". The player's status changes from "Draft" to "Submitted" in the roster list. Submitted ratings cannot be further edited.
result: pass

### 7. Duplicate Player Prevention
expected: Try adding a player with the same first/last name (case-insensitive) that already exists in your roster for this season. The system prevents the duplicate.
result: issue
reported: "we should not prevent, we should only warn. some kids have same names, they would get a unique bib ID and ID in the system."
severity: major

### 8. Admin Progress Dashboard
expected: As an admin, switch to the "Progress Dashboard" tab. A table shows each coach with their submitted/draft/total rating counts and a progress bar.
result: pass

### 9. Template Auto-Lock
expected: After creating a rating for a season, the linked evaluation template becomes locked. Attempting to edit the template shows guidance to create a new version instead.
result: pass

## Summary

total: 9
passed: 8
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Adding a player with the same name as an existing player should warn but allow, not block"
  status: failed
  reason: "User reported: we should not prevent, we should only warn. some kids have same names, they would get a unique bib ID and ID in the system."
  severity: major
  test: 7
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
