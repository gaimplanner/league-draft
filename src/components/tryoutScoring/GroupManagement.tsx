import { useState, useEffect } from 'react';
import type { EvaluationTemplate } from '../../types';
import { useTryoutScoring } from '../../hooks/useTryoutScoring';

interface GroupManagementProps {
  seasonId: string;
  template: EvaluationTemplate;
}

export function GroupManagement({ seasonId }: GroupManagementProps) {
  const { groups, isLoading, error, fetchGroups, generateGroups, addPlayer, deleteGroup } =
    useTryoutScoring();

  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [playerNamesText, setPlayerNamesText] = useState('');
  const [groupSize, setGroupSize] = useState(18);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [addPlayerGroupId, setAddPlayerGroupId] = useState<string | null>(null);
  const [newPlayerFirstName, setNewPlayerFirstName] = useState('');
  const [newPlayerLastName, setNewPlayerLastName] = useState('');

  useEffect(() => {
    fetchGroups(seasonId);
  }, [seasonId, fetchGroups]);

  const handleGenerateGroups = async () => {
    const lines = playerNamesText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const players = lines.map((line) => {
      const parts = line.split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      return { firstName, lastName };
    });

    await generateGroups(seasonId, { players, groupSize });
    setShowGenerateForm(false);
    setPlayerNamesText('');
  };

  const handleAddPlayer = async (groupId: string) => {
    if (!newPlayerFirstName || !newPlayerLastName) return;

    await addPlayer(groupId, {
      firstName: newPlayerFirstName,
      lastName: newPlayerLastName,
    });

    setAddPlayerGroupId(null);
    setNewPlayerFirstName('');
    setNewPlayerLastName('');
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${groupName}? This cannot be undone.`
      )
    ) {
      return;
    }

    await deleteGroup(groupId);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Group Management</h1>
          <button
            onClick={() => setShowGenerateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Generate Groups
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Generate Groups Form */}
        {showGenerateForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Generate Groups</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Player Names (one per line: "First Last")
                </label>
                <textarea
                  value={playerNamesText}
                  onChange={(e) => setPlayerNamesText(e.target.value)}
                  rows={10}
                  placeholder="John Smith&#10;Jane Doe&#10;..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Group Size
                </label>
                <input
                  type="number"
                  value={groupSize}
                  onChange={(e) => setGroupSize(parseInt(e.target.value) || 18)}
                  min={10}
                  max={25}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleGenerateGroups}
                  disabled={isLoading || !playerNamesText.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Generating...' : 'Generate'}
                </button>
                <button
                  onClick={() => {
                    setShowGenerateForm(false);
                    setPlayerNamesText('');
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Groups List */}
        <div className="space-y-4">
          {groups.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
              <p>No groups yet. Generate groups to get started.</p>
            </div>
          ) : (
            groups.map((group) => {
              const isExpanded = expandedGroupId === group.id;
              const isAddingPlayer = addPlayerGroupId === group.id;

              return (
                <div key={group.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                  {/* Group Header */}
                  <div
                    className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between cursor-pointer hover:bg-gray-100"
                    onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                  >
                    <div className="flex items-center gap-4">
                      <h3 className="text-lg font-bold text-gray-900">{group.name}</h3>
                      <span className="text-sm text-gray-500">
                        {group.playerCount} players
                      </span>
                      <span className="text-sm text-gray-500">
                        Rotation: {group.rotationOrder}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id, group.name);
                        }}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                      >
                        Delete
                      </button>
                      <svg
                        className={`w-5 h-5 text-gray-500 transition-transform ${
                          isExpanded ? 'transform rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded Player List */}
                  {isExpanded && (
                    <div className="p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <h4 className="font-medium text-gray-700">Players</h4>
                        <button
                          onClick={() =>
                            setAddPlayerGroupId(isAddingPlayer ? null : group.id)
                          }
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {isAddingPlayer ? 'Cancel' : '+ Add Player'}
                        </button>
                      </div>

                      {/* Add Player Form */}
                      {isAddingPlayer && (
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <input
                              type="text"
                              value={newPlayerFirstName}
                              onChange={(e) => setNewPlayerFirstName(e.target.value)}
                              placeholder="First Name"
                              className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <input
                              type="text"
                              value={newPlayerLastName}
                              onChange={(e) => setNewPlayerLastName(e.target.value)}
                              placeholder="Last Name"
                              className="px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <button
                            onClick={() => handleAddPlayer(group.id)}
                            disabled={!newPlayerFirstName || !newPlayerLastName}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            Add
                          </button>
                        </div>
                      )}

                      {/* Player Table */}
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Bib #
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Name
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {group.players.map((player) => (
                              <tr key={player.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                                  #{player.bibNumber}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {player.firstName} {player.lastName}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
