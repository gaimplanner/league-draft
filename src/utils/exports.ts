import { Team, Player, DraftPick, Division } from '../types';

// Trade interface for official record
export interface Trade {
  id: string;
  timestamp: number;
  team1Id: string;
  team2Id: string;
  player1Id: string; // moving FROM team1 TO team2
  player2Id: string; // moving FROM team2 TO team1
  reason: string;
}

// Helper to get display name for a team
const getTeamDisplayName = (team: Team) => team.name || `Team ${team.draftPosition}`;

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
 * Generate simulation draft board in grid format (Rounds x Teams).
 * Rows = rounds, Columns = teams in draft order, Cells = player picked.
 */
export function generateSimulationDraftBoard(
  teams: Team[],
  draftOrder: string[]
): string {
  // Get teams in draft order
  const orderedTeams = draftOrder.map(id => teams.find(t => t.id === id)).filter((t): t is Team => t !== undefined);

  // Find max rounds (all teams should have same roster size)
  const maxRounds = Math.max(...teams.map(t => t.roster.length));

  // Build header row
  const header = ['Round', 'Picks', ...orderedTeams.map(t => getTeamDisplayName(t))];

  // Build data rows
  const rows: string[][] = [];
  for (let round = 1; round <= maxRounds; round++) {
    const pickStart = (round - 1) * teams.length + 1;
    const pickEnd = round * teams.length;

    const row = [
      round.toString(),
      `${pickStart}-${pickEnd}`,
      ...orderedTeams.map(team => {
        // Find player drafted by this team in this round
        const player = team.roster.find(p => p.draftedInRound === round);
        return player ? `${player.firstName} ${player.lastName}` : '';
      })
    ];
    rows.push(row);
  }

  // Convert to CSV
  return [header, ...rows].map(row => row.join(',')).join('\n');
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
 * Open content in a new window for printing
 */
export function openPrintWindow(content: string, title: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print');
    return;
  }

  printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
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
<body>${content}</body>
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
