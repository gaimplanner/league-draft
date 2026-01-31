import type { Player, CompositeExportPlayerData } from '../types';

/**
 * Map composite export data to full Player objects for the draft system.
 *
 * The export endpoint provides Player-compatible fields but without IDs
 * (since these are new Player records). This mapper adds unique IDs and
 * strips evaluation-only metadata (tier, coachAggregate, etc.) that are
 * only used for the preview table.
 */
export function mapCompositeToPlayers(
  exportPlayers: CompositeExportPlayerData[]
): Player[] {
  const timestamp = Date.now();
  return exportPlayers.map((ep, index) => ({
    id: `player-eval-${ep.rank}-${timestamp}-${index}`,
    bib: ep.bib,
    firstName: ep.firstName,
    lastName: ep.lastName,
    name: ep.name,
    fieldScore: ep.fieldScore,
    throwScore: ep.throwScore,
    hitPower: ep.hitPower,
    hitForm: ep.hitForm,
    hitContact: ep.hitContact,
    pitchingStrength: ep.pitchingStrength,
    pitchingForm: ep.pitchingForm,
    catchScore: ep.catchScore,
    runningScore: ep.runningScore,
    fieldingSubtotal: ep.fieldingSubtotal,
    hittingSubtotal: ep.hittingSubtotal,
    pitchingSubtotal: ep.pitchingSubtotal,
    subjectiveTotal: ep.subjectiveTotal,
    objectiveTotal: ep.objectiveTotal,
    officialAdjust: ep.officialAdjust,
    totalScore: ep.totalScore,
    rank: ep.rank,
    projectedRound: ep.projectedRound,
    littleLeagueAge: ep.littleLeagueAge,
    birthday: ep.birthday,
    isAllStar: ep.isAllStar,
    isDNE: ep.isDNE,
    isCoachKid: ep.isCoachKid,
    isDrafted: ep.isDrafted,
    // Optional fields left undefined for admin to configure in review phase
  }));
}
