# Phase 3: Tryout Day Scoring - Context

**Gathered:** 2026-01-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Volunteers can score players at tryout stations in real-time via mobile browser, with bib-based player lookup, group rotation management, and a bulk-entry fallback for paper-based scoring -- all with scorer identity tracked for accountability. Group setup, rotation scheduling, and progress monitoring are included. Creating tryout events, composite scoring, and draft integration are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Mobile Scoring Flow
- Numpad bib entry as primary player lookup, with name search fallback for unknown/lost bibs
- After scoring all fields for a player, show brief confirmation (checkmark/flash) then auto-advance to next player
- Scrollable player list showing all players in the group, with the active player expanded for scoring
- Large tap buttons for subjective scale scores (e.g., row of 1-5 buttons) -- easy one-handed tap in outdoor conditions
- Numeric input for objective fields (times, counts)

### Group & Rotation Setup
- System auto-generates groups of ~15-20 players from registered players
- Bib numbers auto-assigned when groups are generated (sequential)
- Admin defines predefined rotation schedule before tryout day -- groups follow a fixed order through stations
- Admin can add late-arriving players to existing groups on the fly during tryouts
- No-shows simply remain unscored -- no special handling needed

### Bulk Entry Fallback
- Always available as an alternative scoring path, not just a backup
- Spreadsheet-style grid layout: rows = players, columns = score fields for the selected station
- If a player already has mobile-entered scores for a station, warn admin and require confirmation before overwriting
- Support pasting from external spreadsheets (Excel/Google Sheets) into the grid

### Progress & Monitoring
- Station completion grid: groups vs stations with color coding showing completion status
- Pull-to-refresh for updates -- no real-time WebSocket infrastructure
- Scorer identity tracked in score data but not displayed on the dashboard (scores-only view)
- Same progress grid serves as post-tryout completion check -- no separate summary view needed

### Claude's Discretion
- Color coding scheme for the completion grid
- Exact confirmation animation/style after scoring
- Group size algorithm (targeting ~15-20)
- Numpad and name search UI layout
- Grid keyboard navigation for bulk entry
- How rotation schedule is presented to admin

</decisions>

<specifics>
## Specific Ideas

- Mobile scoring must work one-handed outdoors on a phone browser -- large touch targets throughout
- Bib numpad should be the default entry point, with name search as a secondary option (not equal prominence)
- The bulk entry grid should feel like a spreadsheet -- familiar data entry pattern for admins coming from Excel/Sheets workflows

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 03-tryout-day-scoring*
*Context gathered: 2026-01-29*
