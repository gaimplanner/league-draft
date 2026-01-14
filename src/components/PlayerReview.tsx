import { useState, useEffect } from 'react';
import { List, Grid, ChevronRight, Edit2, Users, Link, X, Wand2, CheckCircle2 } from 'lucide-react';
import { Player, Team, ViewMode } from '../types';
import { autoDetectCoachKids, autoDetectSiblings, CoachKidMatch, SiblingMatch } from '../utils/coachKidDetection';
import { useScoringWeights } from '../hooks/useScoringWeights';
import { ScoringWeightsConfig } from './ScoringWeightsConfig';
import { recalculateAllScores } from '../utils/scoreCalculation';

interface PlayerReviewProps {
  players: Player[];
  teams: Team[];
  onUpdatePlayer: (playerId: string, field: keyof Pick<Player, 'fieldingSubtotal' | 'hittingSubtotal' | 'pitchingSubtotal' | 'catchScore' | 'runningScore' | 'officialAdjust'>, value: number) => void;
  onUpdatePlayerField: (playerId: string, updates: Partial<Player>) => void;
  onTeamsUpdate: (teams: Team[]) => void;
  onLinkSiblings: (playerId1: string, playerId2: string) => void;
  onUnlinkSibling: (playerId: string) => void;
  onNext: () => void;
}

export const PlayerReview = ({ players, teams, onUpdatePlayer, onUpdatePlayerField, onTeamsUpdate, onLinkSiblings, onUnlinkSibling, onNext }: PlayerReviewProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingPlayer, setEditingPlayer] = useState<string | null>(null);
  const [linkingSiblingFor, setLinkingSiblingFor] = useState<string | null>(null);
  const [autoDetectedMatches, setAutoDetectedMatches] = useState<CoachKidMatch[]>([]);
  const [siblingMatches, setSiblingMatches] = useState<SiblingMatch[]>([]);
  const [showAutoDetectModal, setShowAutoDetectModal] = useState(false);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [selectedSiblingPairs, setSelectedSiblingPairs] = useState<Set<string>>(new Set());
  const { weights, updateWeight, resetToDefaults, validation } = useScoringWeights();

  // Recalculate all player scores when weights change
  useEffect(() => {
    if (validation.isValid && players.length > 0) {
      const recalculated = recalculateAllScores(players, weights);
      // Only update if scores actually changed to avoid infinite loops
      const hasChanges = recalculated.some((p, i) =>
        Math.abs(p.totalScore - players[i].totalScore) > 0.01
      );
      if (hasChanges) {
        // Update players through parent callback
        // This is a bit awkward but maintains the existing data flow
        recalculated.forEach(player => {
          onUpdatePlayerField(player.id, {
            fieldingSubtotal: player.fieldingSubtotal,
            hittingSubtotal: player.hittingSubtotal,
            pitchingSubtotal: player.pitchingSubtotal,
            subjectiveTotal: player.subjectiveTotal,
            objectiveTotal: player.objectiveTotal,
            totalScore: player.totalScore,
          });
        });
      }
    }
  }, [weights]);

  const handleEdit = (playerId: string, field: keyof Pick<Player, 'fieldingSubtotal' | 'hittingSubtotal' | 'pitchingSubtotal' | 'catchScore' | 'runningScore' | 'officialAdjust'>, value: string) => {
    const numValue = parseFloat(value) || 0;
    onUpdatePlayer(playerId, field, numValue);
  };

  const handleTeamNameUpdate = (teamId: string, newName: string) => {
    const updatedTeams = teams.map(t =>
      t.id === teamId ? { ...t, name: newName || `Team ${t.draftPosition}` } : t
    );
    onTeamsUpdate(updatedTeams);
  };

  const handleAssistantCoachesUpdate = (teamId: string, assistantCoachesText: string) => {
    // Parse comma-separated list of assistant coach last names
    const assistantCoaches = assistantCoachesText
      .split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0);

    const updatedTeams = teams.map(t =>
      t.id === teamId ? { ...t, assistantCoaches } : t
    );
    onTeamsUpdate(updatedTeams);
  };

  const handleCoachKidToggle = (playerId: string, isCoachKid: boolean) => {
    if (isCoachKid) {
      // Turning ON coach's kid - set flag
      onUpdatePlayerField(playerId, { isCoachKid: true });
    } else {
      // Turning OFF - remove coach assignment
      onUpdatePlayerField(playerId, { isCoachKid: false, coachTeamId: undefined });

      // Remove from team's coachKids array
      const updatedTeams = teams.map(t => ({
        ...t,
        coachKids: t.coachKids.filter(id => id !== playerId)
      }));
      onTeamsUpdate(updatedTeams);
    }
  };

  const handleCoachTeamAssignment = (playerId: string, teamId: string) => {
    // Update player's coachTeamId
    onUpdatePlayerField(playerId, { coachTeamId: teamId });

    // Update team's coachKids array
    const updatedTeams = teams.map(t => {
      if (t.id === teamId) {
        // Add to this team if not already there
        return {
          ...t,
          coachKids: t.coachKids.includes(playerId) ? t.coachKids : [...t.coachKids, playerId]
        };
      } else {
        // Remove from other teams
        return {
          ...t,
          coachKids: t.coachKids.filter(id => id !== playerId)
        };
      }
    });
    onTeamsUpdate(updatedTeams);
  };

  const handleSiblingLink = (playerId: string, siblingId: string) => {
    onLinkSiblings(playerId, siblingId);
    setLinkingSiblingFor(null);
  };

  const handleSiblingUnlink = (playerId: string) => {
    onUnlinkSibling(playerId);
  };

  // Run auto-detection on component mount
  useEffect(() => {
    handleAutoDetect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAutoDetect = () => {
    const coachMatches = autoDetectCoachKids(players, teams);
    const siblingPairs = autoDetectSiblings(players);

    setAutoDetectedMatches(coachMatches);
    setSiblingMatches(siblingPairs);

    if (coachMatches.length > 0 || siblingPairs.length > 0) {
      // Select all matches by default
      setSelectedMatches(new Set(coachMatches.map(m => m.playerId)));
      setSelectedSiblingPairs(new Set(siblingPairs.map(s => `${s.player1Id}-${s.player2Id}`)));
      setShowAutoDetectModal(true);
    }
  };

  const handleToggleMatch = (playerId: string) => {
    setSelectedMatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };

  const handleToggleSiblingPair = (pairKey: string) => {
    setSelectedSiblingPairs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pairKey)) {
        newSet.delete(pairKey);
      } else {
        newSet.add(pairKey);
      }
      return newSet;
    });
  };

  const handleApplyMatches = () => {
    // Apply selected coach's kid matches
    autoDetectedMatches.forEach(match => {
      if (selectedMatches.has(match.playerId)) {
        // Mark as coach's kid and assign to team
        handleCoachKidToggle(match.playerId, true);
        handleCoachTeamAssignment(match.playerId, match.teamId);
      }
    });

    // Apply selected sibling matches
    siblingMatches.forEach(match => {
      const pairKey = `${match.player1Id}-${match.player2Id}`;
      if (selectedSiblingPairs.has(pairKey)) {
        // Link siblings
        handleSiblingLink(match.player1Id, match.player2Id);
      }
    });

    setShowAutoDetectModal(false);
    setAutoDetectedMatches([]);
    setSiblingMatches([]);
    setSelectedMatches(new Set());
    setSelectedSiblingPairs(new Set());
  };

  const handleSelectAll = () => {
    setSelectedMatches(new Set(autoDetectedMatches.map(m => m.playerId)));
    setSelectedSiblingPairs(new Set(siblingMatches.map(s => `${s.player1Id}-${s.player2Id}`)));
  };

  const handleDeselectAll = () => {
    setSelectedMatches(new Set());
    setSelectedSiblingPairs(new Set());
  };

  const PlayerCard = ({ player }: { player: Player }) => {
    const assignedTeam = teams.find(t => t.id === player.coachTeamId);
    const availableSiblings = players.filter(p => p.id !== player.id && !p.siblingId);

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                {player.name}
              </h3>
              <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-mono">
                {player.bib}
              </span>
              {player.isDNE && (
                <span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-2 py-1 rounded">
                  DNE
                </span>
              )}
              {player.isAllStar && (
                <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                  All-Star
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Rank #{player.rank} • Round {player.projectedRound} • Score: {player.totalScore.toFixed(1)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              F:{player.fieldingSubtotal.toFixed(1)} H:{player.hittingSubtotal.toFixed(1)} P:{player.pitchingSubtotal.toFixed(1)} C:{player.catchScore.toFixed(1)} R:{player.runningScore.toFixed(1)}
              {player.officialAdjust !== 0 && ` Adj:${player.officialAdjust > 0 ? '+' : ''}${player.officialAdjust.toFixed(1)}`}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Age: {player.littleLeagueAge} {player.birthday && `• Birthday: ${player.birthday}`}
            </p>
          </div>
          <button
            onClick={() => setEditingPlayer(editingPlayer === player.id ? null : player.id)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Edit scores"
          >
            <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Coach's Kid Controls */}
        <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={player.isCoachKid}
              onChange={(e) => handleCoachKidToggle(player.id, e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              Coach's Kid
            </span>
          </label>

          {player.isCoachKid && (
            <div className="mt-2">
              <select
                value={player.coachTeamId || ''}
                onChange={(e) => handleCoachTeamAssignment(player.id, e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select team...</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
              {assignedTeam && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Assigned to {assignedTeam.name}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sibling Linking */}
        <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">Sibling</span>
            {!player.siblingId && (
              <button
                onClick={() => setLinkingSiblingFor(linkingSiblingFor === player.id ? null : player.id)}
                className="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded flex items-center gap-1"
              >
                <Link className="w-3 h-3" />
                Link
              </button>
            )}
          </div>

          {player.siblingId ? (
            <div className="flex items-center justify-between p-2 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
              <span className="text-sm text-purple-800 dark:text-purple-200">
                {player.sibling}
              </span>
              <button
                onClick={() => handleSiblingUnlink(player.id)}
                className="p-1 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded"
                title="Unlink sibling"
              >
                <X className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </button>
            </div>
          ) : linkingSiblingFor === player.id ? (
            <select
              onChange={(e) => e.target.value && handleSiblingLink(player.id, e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              defaultValue=""
            >
              <option value="">Select sibling...</option>
              {availableSiblings.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} (Rank #{p.rank}, Age {p.littleLeagueAge})
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">No sibling linked</p>
          )}
        </div>

        {/* Score Editing */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {(['fieldingSubtotal', 'hittingSubtotal', 'pitchingSubtotal', 'catchScore', 'runningScore', 'officialAdjust'] as const).map((field) => (
            <div key={field}>
              <label className="text-xs text-gray-600 dark:text-gray-400 capitalize block mb-1">
                {field === 'fieldingSubtotal' ? 'Fielding' :
                 field === 'hittingSubtotal' ? 'Hitting' :
                 field === 'pitchingSubtotal' ? 'Pitching' :
                 field === 'catchScore' ? 'Catch' :
                 field === 'runningScore' ? 'Running' :
                 field === 'officialAdjust' ? 'Adjustment' : field}
              </label>
              {editingPlayer === player.id ? (
                <input
                  type="number"
                  step="0.1"
                  value={player[field]}
                  onChange={(e) => handleEdit(player.id, field, e.target.value)}
                  className="w-full px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              ) : (
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {player[field].toFixed(1)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const coachKidsCount = players.filter(p => p.isCoachKid).length;
  const unassignedCoachKids = players.filter(p => p.isCoachKid && !p.coachTeamId).length;

  // Validate sibling links are bidirectional
  const brokenSiblingLinks = players.filter(p => {
    if (!p.siblingId) return false;
    const sibling = players.find(s => s.id === p.siblingId);
    return !sibling || sibling.siblingId !== p.id;
  });

  const handleNext = () => {
    if (unassignedCoachKids > 0) {
      if (!window.confirm(`${unassignedCoachKids} coach's kid(s) are not assigned to teams. Continue anyway?`)) {
        return;
      }
    }

    if (brokenSiblingLinks.length > 0) {
      alert(`Warning: Found broken sibling links. Please check: ${brokenSiblingLinks.map(p => p.name).join(', ')}`);
      return;
    }

    onNext();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Review Players & Setup Teams</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {players.length} players loaded • {coachKidsCount} coach's kids • Edit scores, assign coaches, link siblings
            </p>
            {unassignedCoachKids > 0 && (
              <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                ⚠ {unassignedCoachKids} coach's kid{unassignedCoachKids > 1 ? 's' : ''} not assigned to a team
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleAutoDetect}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium flex items-center gap-2"
              title="Auto-detect coach's kids by matching last names with team names"
            >
              <Wand2 className="w-5 h-5" />
              <span className="hidden sm:inline">Auto-Detect Coaches</span>
            </button>

            <div className="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${
                  viewMode === 'list'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="List view"
              >
                <List className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${
                  viewMode === 'grid'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="Grid view"
              >
                <Grid className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={handleNext}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2"
            >
              Continue to Draft Setup
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Team Names Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Team Names & Coaches</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {teams.map(team => {
              const teamCoachKids = players.filter(p => p.coachTeamId === team.id);
              return (
                <div key={team.id} className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Head Coach (Team Name)
                    </label>
                    <input
                      type="text"
                      value={team.name}
                      onChange={(e) => handleTeamNameUpdate(team.id, e.target.value)}
                      placeholder={`Team ${team.draftPosition}`}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Assistant Coaches (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={team.assistantCoaches.join(', ')}
                      onChange={(e) => handleAssistantCoachesUpdate(team.id, e.target.value)}
                      placeholder="Smith, Jones"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  {teamCoachKids.length > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Coach's Kids: {teamCoachKids.map(p => p.name).join(', ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Scoring Weights Configuration */}
        <ScoringWeightsConfig
          weights={weights}
          onUpdateWeight={updateWeight}
          onReset={resetToDefaults}
          validation={validation}
        />

        {/* Players Grid/List */}
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-3'
        }>
          {players.map((player) => (
            <PlayerCard key={player.id} player={player} />
          ))}
        </div>
      </div>

      {/* Auto-Detect Modal */}
      {showAutoDetectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Wand2 className="w-6 h-6 text-purple-500" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Auto-Detection Results
                </h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                Found {autoDetectedMatches.length} coach's kid match{autoDetectedMatches.length !== 1 ? 'es' : ''} and {siblingMatches.length} sibling pair{siblingMatches.length !== 1 ? 's' : ''} based on last name matching.
              </p>
            </div>

            <div className="p-6 overflow-y-auto max-h-[50vh]">
              {autoDetectedMatches.length === 0 && siblingMatches.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No matches found. Make sure team names match player last names for coaches, and check for players with shared last names for siblings.
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Coach's Kids Section */}
                  {autoDetectedMatches.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-500" />
                        Coach's Kids ({autoDetectedMatches.length})
                      </h3>
                      <div className="space-y-3">
                  {autoDetectedMatches.map((match) => {
                    const player = players.find(p => p.id === match.playerId);
                    const isSelected = selectedMatches.has(match.playerId);

                    return (
                      <label
                        key={match.playerId}
                        className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleMatch(match.playerId)}
                          className="mt-1 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {match.playerName}
                            {isSelected && (
                              <CheckCircle2 className="inline-block ml-2 w-5 h-5 text-purple-600" />
                            )}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            → {match.teamName}
                          </div>
                          {player && (
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              Rank #{player.rank} • Round {player.projectedRound} • Age {player.littleLeagueAge}
                            </div>
                          )}
                          <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                            {match.reason}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                      </div>
                    </div>
                  )}

                  {/* Siblings Section */}
                  {siblingMatches.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Link className="w-5 h-5 text-purple-500" />
                        Siblings ({siblingMatches.length} pair{siblingMatches.length !== 1 ? 's' : ''})
                      </h3>
                      <div className="space-y-3">
                        {siblingMatches.map((match) => {
                          const player1 = players.find(p => p.id === match.player1Id);
                          const player2 = players.find(p => p.id === match.player2Id);
                          const pairKey = `${match.player1Id}-${match.player2Id}`;
                          const isSelected = selectedSiblingPairs.has(pairKey);

                          return (
                            <label
                              key={pairKey}
                              className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSiblingPair(pairKey)}
                                className="mt-1 w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                              />
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                  {match.player1Name} ↔ {match.player2Name}
                                  {isSelected && (
                                    <CheckCircle2 className="inline-block w-5 h-5 text-purple-600" />
                                  )}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  Shared last name: {match.sharedLastName}
                                </div>
                                {player1 && player2 && (
                                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 flex gap-4">
                                    <span>{player1.name} - Rank #{player1.rank}, Age {player1.littleLeagueAge}</span>
                                    <span>{player2.name} - Rank #{player2.rank}, Age {player2.littleLeagueAge}</span>
                                  </div>
                                )}
                                <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                  {match.reason}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center gap-3">
              <div className="flex gap-2">
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg font-medium"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
                >
                  Deselect All
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAutoDetectModal(false);
                    setAutoDetectedMatches([]);
                    setSiblingMatches([]);
                    setSelectedMatches(new Set());
                    setSelectedSiblingPairs(new Set());
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyMatches}
                  disabled={selectedMatches.size === 0 && selectedSiblingPairs.size === 0}
                  className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Apply {(selectedMatches.size > 0 || selectedSiblingPairs.size > 0) && `(${selectedMatches.size + selectedSiblingPairs.size})`}
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
