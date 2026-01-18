import { Team, Player, DraftPick, Division, Trade } from '../types';
import { getTeamDisplayName } from './teamUtils';

/**
 * Escape HTML entities to prevent XSS attacks.
 * Used when inserting user-generated content into HTML documents.
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Generate public rosters for distribution to families.
 * NO scores, NO draft order, NO rankings - just alphabetical player lists.
 */
export function generatePublicRosters(teams: Team[], _players: Player[]): string {
  const output = teams
    .sort((a, b) => getTeamDisplayName(a).localeCompare(getTeamDisplayName(b)))
    .map(team => {
      const teamName = getTeamDisplayName(team);
      const headerLine = '═'.repeat(45);
      const dividerLine = '─'.repeat(45);

      // Get roster sorted alphabetically by last name
      const roster = team.roster
        .sort((a, b) => a.lastName.localeCompare(b.lastName))
        .map(p => `  ${p.lastName}, ${p.firstName}`)
        .join('\n');

      // Get manager name (team name is usually the coach's last name)
      const managerName = team.name ? `Coach ${team.name}` : 'TBD';

      // Get assistant coaches
      const assistantCoaches = team.assistantCoaches && team.assistantCoaches.length > 0
        ? team.assistantCoaches.map(c => `Coach ${c}`).join(', ')
        : 'None';

      return `
${headerLine}
         ${teamName.toUpperCase()}
${headerLine}

Manager: ${managerName}
Assistant Coaches: ${assistantCoaches}

ROSTER:
${dividerLine}
${roster || '  (No players)'}
${dividerLine}
`;
    })
    .join('\n');

  return output.trim();
}

/**
 * Generate official draft record for league archives.
 * Includes all picks by round, flags, and trade log.
 */
export function generateOfficialRecord(
  division: Division | null,
  teams: Team[],
  players: Player[],
  picks: DraftPick[],
  trades: Trade[] = []
): string {
  const divisionName = division?.name || 'Draft';
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const headerLine = '═'.repeat(65);
  const sectionLine = '─'.repeat(65);

  // Group picks by round
  const picksByRound: Record<number, DraftPick[]> = {};
  picks.forEach(pick => {
    if (!picksByRound[pick.round]) {
      picksByRound[pick.round] = [];
    }
    picksByRound[pick.round].push(pick);
  });

  let output = `
${headerLine}
          ${divisionName.toUpperCase()} - OFFICIAL DRAFT RECORD
                    ${date}
${headerLine}
`;

  // Add picks by round
  Object.entries(picksByRound)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([round, roundPicks]) => {
      output += `\nROUND ${round}\n`;
      output += `${sectionLine}\n`;

      roundPicks.forEach(pick => {
        const team = teams.find(t => t.id === pick.teamId);
        if (!team) return;

        const teamName = getTeamDisplayName(team).padEnd(18);

        // Handle skipped picks
        if (pick.wasSkipped) {
          output += `Pick ${pick.pick.toString().padStart(2)}:  ${teamName} →  SKIPPED ⏭️\n`;
          return;
        }

        const player = players.find(p => p.id === pick.playerId);
        if (!player) return;

        // Build flags string
        const flags: string[] = [];
        if (player.isAllStar) flags.push('⭐');
        if (player.isCoachKid) flags.push('🔵');
        if (player.siblingId) flags.push('👥');
        const flagStr = flags.length > 0 ? ' ' + flags.join('') : '';

        const playerName = `${player.firstName} ${player.lastName}`;
        const bibNum = player.bib ? `(#${player.bib})` : '';

        output += `Pick ${pick.pick.toString().padStart(2)}:  ${teamName} →  ${playerName} ${bibNum}${flagStr}\n`;
      });
    });

  // Add legend
  output += `
${headerLine}

LEGEND:
  ⭐ = All-Star
  🔵 = Coach's Kid
  👥 = Sibling
`;

  // Add trades if any
  if (trades.length > 0) {
    output += `
${sectionLine}
TRADES:
${sectionLine}
`;
    trades.forEach((trade, i) => {
      const player1 = players.find(p => p.id === trade.player1Id);
      const player2 = players.find(p => p.id === trade.player2Id);
      const team1 = teams.find(t => t.id === trade.team1Id);
      const team2 = teams.find(t => t.id === trade.team2Id);

      if (!player1 || !player2 || !team1 || !team2) return;

      const tradeDate = new Date(trade.timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      output += `Trade ${i + 1}: ${player1.firstName} ${player1.lastName} (${getTeamDisplayName(team1)}) ↔ ${player2.firstName} ${player2.lastName} (${getTeamDisplayName(team2)})\n`;
      output += `         Reason: ${trade.reason}\n`;
      output += `         Approved: ${tradeDate}\n\n`;
    });
  }

  output += `${headerLine}\n`;

  return output.trim();
}

/**
 * Generate simulation draft board with two sections:
 * 1. Grid view (Rounds x Teams) - quick visual of who each team got, with team totals
 * 2. Pick-by-pick - sequential draft order showing Round, Pick #, Team, Player, Score
 */
export function generateSimulationDraftBoard(
  teams: Team[],
  draftOrder: string[]
): string {
  // Get teams in draft order
  const orderedTeams = draftOrder.map(id => teams.find(t => t.id === id)).filter((t): t is Team => t !== undefined);

  // Find max rounds (all teams should have same roster size)
  const maxRounds = Math.max(...teams.map(t => t.roster.length));

  // === SECTION 1: GRID VIEW ===
  const gridHeader = ['Round', 'Picks', ...orderedTeams.map(t => getTeamDisplayName(t))];
  const gridRows: string[][] = [];

  for (let round = 1; round <= maxRounds; round++) {
    const pickStart = (round - 1) * teams.length + 1;
    const pickEnd = round * teams.length;

    const row = [
      round.toString(),
      `${pickStart}-${pickEnd}`,
      ...orderedTeams.map(team => {
        const player = team.roster.find(p => p.draftedInRound === round);
        return player ? `${player.firstName} ${player.lastName}` : '';
      })
    ];
    gridRows.push(row);
  }

  // Add team total scores row
  const totalRow = [
    'TOTAL',
    '',
    ...orderedTeams.map(team => team.totalScore.toFixed(1))
  ];
  gridRows.push(totalRow);

  // === SECTION 2: PICK BY PICK ===
  // Collect all drafted players and sort by pick number
  const allPicks: { round: number; pick: number; team: string; player: string; score: number }[] = [];

  teams.forEach(team => {
    team.roster.forEach(player => {
      if (player.draftedAtPick && player.draftedInRound) {
        allPicks.push({
          round: player.draftedInRound,
          pick: player.draftedAtPick,
          team: getTeamDisplayName(team),
          player: `${player.firstName} ${player.lastName}`,
          score: player.totalScore
        });
      }
    });
  });

  allPicks.sort((a, b) => a.pick - b.pick);

  const pickHeader = ['Round', 'Pick', 'Team', 'Player', 'Score'];
  const pickRows = allPicks.map(p => [
    p.round.toString(),
    p.pick.toString(),
    p.team,
    p.player,
    p.score.toFixed(1)
  ]);

  // Combine sections
  const output = [
    '=== DRAFT BOARD ===',
    [gridHeader, ...gridRows].map(row => row.join(',')).join('\n'),
    '',
    '=== PICK BY PICK ===',
    [pickHeader, ...pickRows].map(row => row.join(',')).join('\n')
  ].join('\n');

  return output;
}

/**
 * Download text content as a file
 */
export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download CSV content as a file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Open content in a new window for printing.
 * Content is escaped to prevent XSS attacks from user-generated data.
 */
export function openPrintWindow(content: string, title: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print');
    return;
  }

  // Escape both title and content to prevent XSS
  const safeTitle = escapeHtml(title);
  const safeContent = escapeHtml(content);

  printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>${safeTitle}</title>
  <style>
    body {
      font-family: 'Courier New', Courier, monospace;
      white-space: pre-wrap;
      padding: 20px;
      line-height: 1.4;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>${safeContent}</body>
</html>
  `);
  printWindow.document.close();
  printWindow.print();
}

/**
 * Copy content to clipboard
 */
export async function copyToClipboard(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = content;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch {
      document.body.removeChild(textArea);
      return false;
    }
  }
}
