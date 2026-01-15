import { useState } from 'react';
import { Download, RotateCcw, FileText, Printer, Copy, Check, ArrowLeftRight } from 'lucide-react';
import { DraftState, Team, Division } from '../types';
import { exportToCSV, downloadCSV } from '../utils/csvParser';
import {
  generatePublicRosters,
  generateOfficialRecord,
  downloadTextFile,
  openPrintWindow,
  copyToClipboard,
} from '../utils/exports';
import { TradeModal } from './TradeModal';
import { CompleteRosters } from './CompleteRosters';

// Helper to get display name for a team (fallback when empty)
const getTeamDisplayName = (team: Team) => team.name || `Team ${team.draftPosition}`;

interface DraftCompleteProps {
  draftState: DraftState;
  division?: Division | null;
  onReset: () => void;
  onExecuteTrade?: (
    team1Id: string,
    team2Id: string,
    player1Id: string,
    player2Id: string,
    reason: string
  ) => void;
}

export const DraftComplete = ({ draftState, division, onReset, onExecuteTrade }: DraftCompleteProps) => {
  const [copiedRosters, setCopiedRosters] = useState(false);
  const [copiedRecord, setCopiedRecord] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);

  const handleExport = () => {
    const csvContent = exportToCSV(draftState.teams);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csvContent, `draft-results-${timestamp}.csv`);
  };

  // Public Rosters Export
  const handleDownloadPublicRosters = () => {
    const content = generatePublicRosters(draftState.teams, draftState.players);
    const divisionName = division?.name?.replace(/\s+/g, '-') || 'rosters';
    const timestamp = new Date().toISOString().split('T')[0];
    downloadTextFile(content, `${divisionName}-rosters-${timestamp}.txt`);
  };

  const handlePrintPublicRosters = () => {
    const content = generatePublicRosters(draftState.teams, draftState.players);
    const title = `${division?.name || 'Draft'} - Team Rosters`;
    openPrintWindow(content, title);
  };

  const handleCopyPublicRosters = async () => {
    const content = generatePublicRosters(draftState.teams, draftState.players);
    const success = await copyToClipboard(content);
    if (success) {
      setCopiedRosters(true);
      setTimeout(() => setCopiedRosters(false), 2000);
    }
  };

  // Official Record Export
  const handleDownloadOfficialRecord = () => {
    const content = generateOfficialRecord(
      division ?? null,
      draftState.teams,
      draftState.players,
      draftState.picks,
      draftState.trades
    );
    const divisionName = division?.name?.replace(/\s+/g, '-') || 'draft';
    const timestamp = new Date().toISOString().split('T')[0];
    downloadTextFile(content, `${divisionName}-official-record-${timestamp}.txt`);
  };

  const handlePrintOfficialRecord = () => {
    const content = generateOfficialRecord(
      division ?? null,
      draftState.teams,
      draftState.players,
      draftState.picks,
      draftState.trades
    );
    const title = `${division?.name || 'Draft'} - Official Record`;
    openPrintWindow(content, title);
  };

  const handleCopyOfficialRecord = async () => {
    const content = generateOfficialRecord(
      division ?? null,
      draftState.teams,
      draftState.players,
      draftState.picks,
      draftState.trades
    );
    const success = await copyToClipboard(content);
    if (success) {
      setCopiedRecord(true);
      setTimeout(() => setCopiedRecord(false), 2000);
    }
  };

  // Sort teams by total score (descending)
  const sortedTeams = [...draftState.teams].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-lg p-6 sm:p-8 mb-6 text-white">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Draft Complete!</h1>
            <p className="text-lg opacity-90">
              All {draftState.players.length} players have been drafted
            </p>
          </div>

          <div className="flex justify-center gap-3 mt-6 flex-wrap">
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-white text-blue-600 hover:bg-gray-100 rounded-lg font-medium flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              Export to CSV
            </button>
            {onExecuteTrade && (
              <button
                onClick={() => setShowTradeModal(true)}
                className="px-4 py-2 bg-white text-purple-600 hover:bg-gray-100 rounded-lg font-medium flex items-center gap-2"
              >
                <ArrowLeftRight className="w-5 h-5" />
                Make Trade
              </button>
            )}
            <button
              onClick={onReset}
              className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium flex items-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Start New Draft
            </button>
          </div>
        </div>

        {/* Export Options */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Public Rosters Export */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-6 h-6 text-green-600 dark:text-green-400" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Public Rosters
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Alphabetical player lists for families (no scores)
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadPublicRosters}
                className="flex-1 px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={handlePrintPublicRosters}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                title="Print"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                onClick={handleCopyPublicRosters}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                title="Copy to clipboard"
              >
                {copiedRosters ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Official Record Export */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Official Draft Record
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Complete pick history with flags and trades
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadOfficialRecord}
                className="flex-1 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={handlePrintOfficialRecord}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                title="Print"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                onClick={handleCopyOfficialRecord}
                className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                title="Copy to clipboard"
              >
                {copiedRecord ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Team Rankings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Team Rankings by Total Score
          </h2>
          <div className="space-y-2">
            {sortedTeams.map((team, index) => (
              <div
                key={team.id}
                className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="text-2xl font-bold text-gray-400 dark:text-gray-500 w-8">
                  #{index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-lg text-gray-900 dark:text-white">
                    {getTeamDisplayName(team)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {team.roster.length} players
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {team.totalScore.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Total Score</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Full Rosters */}
        <CompleteRosters teams={draftState.teams} />

        {/* Trade History */}
        {draftState.trades.length > 0 && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <ArrowLeftRight className="w-5 h-5 text-purple-600" />
              Trade History
            </h2>
            <div className="space-y-3">
              {draftState.trades.map((trade, index) => {
                const player1 = draftState.players.find(p => p.id === trade.player1Id);
                const player2 = draftState.players.find(p => p.id === trade.player2Id);
                const team1 = draftState.teams.find(t => t.id === trade.team1Id);
                const team2 = draftState.teams.find(t => t.id === trade.team2Id);
                const tradeDate = new Date(trade.timestamp).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={trade.id}
                    className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          Trade {index + 1}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {player1?.firstName} {player1?.lastName} ({getTeamDisplayName(team1!)})
                          <span className="mx-2 text-purple-600">↔</span>
                          {player2?.firstName} {player2?.lastName} ({getTeamDisplayName(team2!)})
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Reason: {trade.reason}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {tradeDate}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Trade Modal */}
      {showTradeModal && onExecuteTrade && (
        <TradeModal
          teams={draftState.teams}
          players={draftState.players}
          onExecuteTrade={onExecuteTrade}
          onClose={() => setShowTradeModal(false)}
        />
      )}
    </div>
  );
};
