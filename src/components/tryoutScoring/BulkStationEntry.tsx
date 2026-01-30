/**
 * BulkStationEntry Component
 *
 * Spreadsheet-style grid for bulk score entry. Admin selects a group and station,
 * then enters scores for all players in the group. Supports pasting from Excel/Google Sheets.
 */

import React, { useState, useEffect } from 'react';
import {
  DataSheetGrid,
  textColumn,
  floatColumn,
  keyColumn,
} from 'react-datasheet-grid';
import 'react-datasheet-grid/dist/style.css';
import type { EvaluationTemplate, TryoutGroup, StationScore } from '../../types';
import { api } from '../../api/client';

interface BulkStationEntryProps {
  seasonId: string;
  template: EvaluationTemplate;
  groups: TryoutGroup[];
}

interface GridRow {
  bibNumber: string;
  name: string;
  playerId: string;
  [key: string]: string | number; // Dynamic score fields
}

export const BulkStationEntry: React.FC<BulkStationEntryProps> = ({
  seasonId,
  template,
  groups,
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [gridData, setGridData] = useState<GridRow[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingScoresCount, setExistingScoresCount] = useState(0);
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [, setPlayersWithScores] = useState<Set<string>>(new Set());

  // Find selected group and station
  const selectedGroup = groups.find(g => g.id === selectedGroupId);
  const selectedStation = template.stations?.find(s => s.id === selectedStationId);

  // Load existing scores when group + station selected
  useEffect(() => {
    if (!selectedGroupId || !selectedStationId || !selectedGroup) {
      setGridData([]);
      setColumns([]);
      setExistingScoresCount(0);
      setShowOverwriteWarning(false);
      setPlayersWithScores(new Set());
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch existing scores for this group + station
        const existingScores = await api.listStationScores(seasonId, {
          groupId: selectedGroupId,
          stationId: selectedStationId,
        });

        // Create a map of playerId -> scores
        const scoresMap = new Map<string, StationScore>();
        existingScores.forEach(score => {
          scoresMap.set(score.playerId, score);
        });

        // Build grid rows from group players
        const rows: GridRow[] = selectedGroup.players.map(player => {
          const existingScore = scoresMap.get(player.id);
          const row: GridRow = {
            bibNumber: player.bibNumber.toString(),
            name: `${player.firstName} ${player.lastName}`,
            playerId: player.id,
          };

          // Pre-fill scores if they exist
          if (existingScore && selectedStation) {
            selectedStation.fields.forEach(field => {
              const scoreValue = existingScore.scores[field.id];
              row[field.id] = scoreValue !== undefined ? scoreValue : '';
            });
          } else if (selectedStation) {
            // Initialize empty scores
            selectedStation.fields.forEach(field => {
              row[field.id] = '';
            });
          }

          return row;
        });

        setGridData(rows);

        // Track players with existing scores
        const playersWithScoresSet = new Set<string>();
        scoresMap.forEach((_, playerId) => playersWithScoresSet.add(playerId));
        setPlayersWithScores(playersWithScoresSet);

        // Count existing scores
        setExistingScoresCount(playersWithScoresSet.size);
        setShowOverwriteWarning(playersWithScoresSet.size > 0);

        // Build columns
        if (selectedStation) {
          const cols: any[] = [
            {
              ...keyColumn('bibNumber', textColumn),
              title: 'Bib #',
              disabled: true,
              minWidth: 80,
            },
            {
              ...keyColumn('name', textColumn),
              title: 'Name',
              disabled: true,
              minWidth: 180,
            },
            ...selectedStation.fields.map(field => ({
              ...keyColumn(field.id, field.type === 'scale' ? textColumn : floatColumn),
              title: field.name,
              minWidth: 120,
            })),
          ];
          setColumns(cols);
        }
      } catch (err) {
        console.error('Failed to load scores:', err);
        setError('Failed to load existing scores. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedGroupId, selectedStationId, selectedGroup, selectedStation, seasonId, template]);

  // Validate score values against field min/max
  const validateScores = (row: GridRow): string | null => {
    if (!selectedStation) return null;

    for (const field of selectedStation.fields) {
      const value = row[field.id];
      if (value !== null && value !== undefined && value !== '') {
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numValue)) {
          return `Invalid value for ${field.name}: must be a number`;
        }
        if (field.min !== undefined && numValue < field.min) {
          return `${field.name}: value ${numValue} is below minimum ${field.min}`;
        }
        if (field.max !== undefined && numValue > field.max) {
          return `${field.name}: value ${numValue} exceeds maximum ${field.max}`;
        }
      }
    }
    return null;
  };

  // Handle save
  const handleSave = async () => {
    if (!selectedStation || !selectedGroup) return;

    setError(null);
    setSuccessMessage(null);

    // Filter rows with at least one score entered
    const rowsToSave = gridData.filter(row => {
      return selectedStation.fields.some(field => {
        const value = row[field.id];
        return value !== null && value !== undefined && value !== '';
      });
    });

    if (rowsToSave.length === 0) {
      setError('No scores to save. Please enter at least one score.');
      return;
    }

    // Validate all rows
    for (const row of rowsToSave) {
      const validationError = validateScores(row);
      if (validationError) {
        setError(`Bib ${row.bibNumber}: ${validationError}`);
        return;
      }
    }

    // Warn about overwriting if needed
    if (showOverwriteWarning && existingScoresCount > 0) {
      const confirmed = window.confirm(
        `${existingScoresCount} players already have scores for this station. ` +
        `Saving will overwrite existing scores. Continue?`
      );
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      // Build scores array
      const scores = rowsToSave.map(row => {
        const scoreValues: Record<string, number> = {};
        selectedStation.fields.forEach(field => {
          const value = row[field.id];
          if (value !== null && value !== undefined && value !== '') {
            scoreValues[field.id] = typeof value === 'string' ? parseFloat(value) : value;
          }
        });
        return {
          playerId: row.playerId,
          scores: scoreValues,
        };
      });

      // Submit bulk scores
      const result = await api.bulkCreateStationScores(seasonId, {
        stationId: selectedStationId,
        scores,
      });

      setSuccessMessage(
        `Saved ${result.created + result.updated} scores ` +
        `(${result.created} new, ${result.updated} updated)`
      );
      setShowOverwriteWarning(false);

      // Reload data to update hasExistingScore flags
      const existingScores = await api.listStationScores(seasonId, {
        groupId: selectedGroupId,
        stationId: selectedStationId,
      });
      const playersWithScoresSet = new Set<string>();
      existingScores.forEach(score => {
        playersWithScoresSet.add(score.playerId);
      });
      setPlayersWithScores(playersWithScoresSet);
      setExistingScoresCount(existingScores.length);
    } catch (err) {
      console.error('Failed to save scores:', err);
      setError(err instanceof Error ? err.message : 'Failed to save scores. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Bulk Score Entry</h2>

        {/* Group and Station Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="group-select" className="block text-sm font-medium text-gray-700 mb-1">
              Select Group
            </label>
            <select
              id="group-select"
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                setError(null);
                setSuccessMessage(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select a group --</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>
                  {group.name} ({group.playerCount} players)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="station-select" className="block text-sm font-medium text-gray-700 mb-1">
              Select Station
            </label>
            <select
              id="station-select"
              value={selectedStationId}
              onChange={(e) => {
                setSelectedStationId(e.target.value);
                setError(null);
                setSuccessMessage(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select a station --</option>
              {template.stations?.map(station => (
                <option key={station.id} value={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Warning banner for overwriting */}
        {showOverwriteWarning && existingScoresCount > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  {existingScoresCount} players already have scores for this station. Saving will overwrite existing scores.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success message */}
        {successMessage && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading scores...</p>
          </div>
        )}

        {/* Grid */}
        {!loading && selectedGroupId && selectedStationId && gridData.length > 0 && (
          <div className="mb-4">
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <p className="text-sm text-gray-600 mb-2">
                Enter scores in the grid below. You can paste from Excel or Google Sheets.
              </p>
              <p className="text-xs text-gray-500">
                Tip: Copy a column from your spreadsheet and paste it into the corresponding column here.
              </p>
            </div>
            <div className="mt-4" style={{ height: 600 }}>
              <DataSheetGrid
                value={gridData}
                onChange={setGridData}
                columns={columns}
                height={600}
              />
            </div>
          </div>
        )}

        {/* No data message */}
        {!loading && selectedGroupId && selectedStationId && gridData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No players in this group.
          </div>
        )}

        {/* Save button */}
        {selectedGroupId && selectedStationId && gridData.length > 0 && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Scores'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
