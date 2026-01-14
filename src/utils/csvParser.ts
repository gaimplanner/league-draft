import Papa from 'papaparse';
import { CSVRow, Player, ParsedCSVData, ColumnMapping, DEFAULT_SCORING_WEIGHTS, ScoringMode, ScoringWeights } from '../types';
import { calculatePlayerScore, calculatePreWeightedScores } from './scoreCalculation';

export const parseCSVFile = (file: File): Promise<ParsedCSVData> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve({
          headers: results.meta.fields || [],
          rows: results.data,
        });
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};

export const parseCSVWithMapping = (
  csvData: ParsedCSVData,
  mapping: ColumnMapping,
  teamCount: number = 8,
  scoringMode: ScoringMode = 'pre-weighted',
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): Player[] => {
  const players: Player[] = csvData.rows.map((row, index) => {
    // Helper function to get mapped value
    const getMappedValue = (field: string): string => {
      const csvColumn = Object.keys(mapping).find((col) => mapping[col] === field);
      return csvColumn ? (row[csvColumn] || '').toString().trim() : '';
    };

    const bib = getMappedValue('bib') || `BIB-${index + 1}`;
    const firstName = getMappedValue('firstName');
    const lastName = getMappedValue('lastName');
    const fullName = `${firstName} ${lastName}`.trim();

    // Parse raw component scores
    const fieldScore = parseFloat(getMappedValue('fieldScore')) || 0;
    const throwScore = parseFloat(getMappedValue('throwScore')) || 0;
    const hitPower = parseFloat(getMappedValue('hitPower')) || 0;
    const hitForm = parseFloat(getMappedValue('hitForm')) || 0;
    const hitContact = parseFloat(getMappedValue('hitContact')) || 0;
    const pitchingStrength = parseFloat(getMappedValue('pitchingStrength')) || 0;
    const pitchingForm = parseFloat(getMappedValue('pitchingForm')) || 0;
    const catchScore = parseFloat(getMappedValue('catchScore')) || 0;
    const runningScore = parseFloat(getMappedValue('runningScore')) || 0;
    const officialAdjust = parseFloat(getMappedValue('officialAdjust')) || 0;

    // Parse imported subtotals (for validation or fallback)
    const importedFieldingSubtotal = parseFloat(getMappedValue('fieldingSubtotal')) || 0;
    const importedHittingSubtotal = parseFloat(getMappedValue('hittingSubtotal')) || 0;
    const importedPitchingSubtotal = parseFloat(getMappedValue('pitchingSubtotal')) || 0;

    // Check if we have raw component scores
    const hasRawScores =
      fieldScore > 0 || throwScore > 0 ||
      hitPower > 0 || hitForm > 0 || hitContact > 0 ||
      pitchingStrength > 0 || pitchingForm > 0;

    const hasImportedSubtotals =
      importedFieldingSubtotal > 0 ||
      importedHittingSubtotal > 0 ||
      importedPitchingSubtotal > 0;

    let fieldingSubtotal: number;
    let hittingSubtotal: number;
    let pitchingSubtotal: number;
    let subjectiveTotal: number;
    let objectiveTotal: number;
    let totalScore: number;

    if (hasRawScores) {
      const playerScoreData = {
        fieldScore,
        throwScore,
        hitPower,
        hitForm,
        hitContact,
        pitchingStrength,
        pitchingForm,
        catchScore,
        runningScore,
        officialAdjust,
      };

      // Use appropriate calculation based on scoring mode
      const calculated = scoringMode === 'pre-weighted'
        ? calculatePreWeightedScores(playerScoreData)
        : calculatePlayerScore(playerScoreData, weights);

      fieldingSubtotal = calculated.fieldingSubtotal;
      hittingSubtotal = calculated.hittingSubtotal;
      pitchingSubtotal = calculated.pitchingSubtotal;
      subjectiveTotal = calculated.subjectiveTotal;
      objectiveTotal = calculated.objectiveTotal;
      totalScore = calculated.totalScore;

      // Validation: Compare calculated vs imported (if imported values also exist, only for raw mode)
      if (scoringMode === 'raw' && hasImportedSubtotals) {
        const fieldingDiff = Math.abs(fieldingSubtotal - importedFieldingSubtotal);
        const hittingDiff = Math.abs(hittingSubtotal - importedHittingSubtotal);
        const pitchingDiff = Math.abs(pitchingSubtotal - importedPitchingSubtotal);

        if (fieldingDiff > 0.1 || hittingDiff > 0.1 || pitchingDiff > 0.1) {
          console.warn(`Score discrepancy for ${fullName}:`, {
            fielding: { calculated: fieldingSubtotal, imported: importedFieldingSubtotal, diff: fieldingDiff },
            hitting: { calculated: hittingSubtotal, imported: importedHittingSubtotal, diff: hittingDiff },
            pitching: { calculated: pitchingSubtotal, imported: importedPitchingSubtotal, diff: pitchingDiff },
          });
        }
      }
    } else if (hasImportedSubtotals) {
      // Use imported subtotals (legacy format without raw scores)
      fieldingSubtotal = importedFieldingSubtotal;
      hittingSubtotal = importedHittingSubtotal;
      pitchingSubtotal = importedPitchingSubtotal;
      subjectiveTotal = fieldingSubtotal + hittingSubtotal + pitchingSubtotal;
      objectiveTotal = catchScore + runningScore;
      totalScore = subjectiveTotal + objectiveTotal + officialAdjust;
    } else {
      // No component scores provided - use zeros but still include official adjust
      fieldingSubtotal = 0;
      hittingSubtotal = 0;
      pitchingSubtotal = 0;
      subjectiveTotal = 0;
      objectiveTotal = catchScore + runningScore; // catchScore/runningScore might still have values
      totalScore = objectiveTotal + officialAdjust; // ALWAYS include official adjust
    }

    // Parse player info
    const littleLeagueAge = parseInt(getMappedValue('littleLeagueAge')) || 0;
    const birthday = getMappedValue('birthday');
    const isAllStar = getMappedValue('isAllStar').toUpperCase() === 'TRUE';
    const isDNE = getMappedValue('isDNE').toUpperCase() === 'TRUE';

    // Parse draft rules (optional)
    const isCoachKid = getMappedValue('isCoachKid').toUpperCase() === 'TRUE';
    const sibling = getMappedValue('sibling') || undefined;

    return {
      id: `player-${index}-${Date.now()}`,
      bib,
      firstName,
      lastName,
      name: fullName,
      // Raw scores
      fieldScore,
      throwScore,
      hitPower,
      hitForm,
      hitContact,
      pitchingStrength,
      pitchingForm,
      catchScore,
      runningScore,
      // Calculated scores
      fieldingSubtotal,
      hittingSubtotal,
      pitchingSubtotal,
      subjectiveTotal,
      objectiveTotal,
      officialAdjust,
      totalScore,
      rank: 0, // Will be calculated after sorting
      projectedRound: 0, // Will be calculated after sorting
      littleLeagueAge,
      birthday,
      isAllStar,
      isDNE,
      isCoachKid,
      sibling,
      isDrafted: false,
    };
  });

  // Sort by total score (descending) and assign ranks
  const sortedPlayers = players
    .sort((a, b) => b.totalScore - a.totalScore)
    .map((player, index) => ({
      ...player,
      rank: index + 1,
      projectedRound: Math.ceil((index + 1) / teamCount),
    }));

  return sortedPlayers;
};

// Legacy function for backward compatibility
export const parseCSV = (file: File): Promise<Player[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const players: Player[] = results.data.map((row, index) => {
            const firstName = row['First Name']?.trim() || '';
            const lastName = row['Last Name']?.trim() || '';
            const fullName = `${firstName} ${lastName}`.trim();

            // Parse skill subtotals (legacy format - these are already calculated)
            const fieldingSubtotal = parseFloat(row['FIELDING SUBTOTAL']) || 0;
            const hittingSubtotal = parseFloat(row['HITTING SUBTOTAL']) || 0;
            const pitchingSubtotal = parseFloat(row['PITCHING SUBTOTAL']) || 0;
            const catchScore = parseFloat(row['CATCH SCORE']) || 0;
            const runningScore = parseFloat(row['RUNNING Score']) || 0;
            const officialAdjust = parseFloat(row['Official Adjust']) || 0;

            // Calculate total score
            const totalScore =
              fieldingSubtotal +
              hittingSubtotal +
              pitchingSubtotal +
              catchScore +
              runningScore +
              officialAdjust;

            // Parse player info
            const littleLeagueAge = parseInt(row['Little League Age']) || 0;
            const birthday = row['Birthday']?.trim() || '';
            const isAllStar = row['All-Star']?.toUpperCase() === 'TRUE';
            const isDNE = row['DNE']?.toUpperCase() === 'TRUE';

            // Parse draft rules
            const isCoachKid = row['Coach Kid']?.toUpperCase() === 'TRUE';
            const sibling = row['Sibling']?.trim() || undefined;

            return {
              id: `player-${index}-${Date.now()}`,
              bib: `BIB-${index + 1}`, // Auto-generate bib for legacy format
              firstName,
              lastName,
              name: fullName,
              // Raw scores not available in legacy format - set to 0
              fieldScore: 0,
              throwScore: 0,
              hitPower: 0,
              hitForm: 0,
              hitContact: 0,
              pitchingStrength: 0,
              pitchingForm: 0,
              catchScore,
              runningScore,
              // Use imported subtotals for legacy format
              fieldingSubtotal,
              hittingSubtotal,
              pitchingSubtotal,
              subjectiveTotal: fieldingSubtotal + hittingSubtotal + pitchingSubtotal,
              objectiveTotal: catchScore + runningScore,
              officialAdjust,
              totalScore,
              rank: 0, // Will be calculated after sorting
              projectedRound: 0, // Will be calculated after sorting
              littleLeagueAge,
              birthday,
              isAllStar,
              isDNE,
              isCoachKid,
              sibling,
              isDrafted: false,
            };
          });

          // Sort by total score (descending) and assign ranks
          const sortedPlayers = players
            .sort((a, b) => b.totalScore - a.totalScore)
            .map((player, index) => ({
              ...player,
              rank: index + 1,
              projectedRound: Math.ceil((index + 1) / 8),
            }));

          resolve(sortedPlayers);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
};

export const exportToCSV = (teams: any[]): string => {
  const rows: string[][] = [['Team', 'Player', 'Total Score', 'Draft Round', 'Draft Pick']];

  teams.forEach((team) => {
    team.roster.forEach((player: any) => {
      rows.push([
        team.name,
        player.name,
        player.totalScore.toString(),
        player.draftedInRound?.toString() || '',
        player.draftedAtPick?.toString() || '',
      ]);
    });
    // Add team total row
    rows.push([team.name, 'TEAM TOTAL', team.totalScore.toString(), '', '']);
    rows.push([]); // Empty row between teams
  });

  return Papa.unparse(rows);
};

export const downloadCSV = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
