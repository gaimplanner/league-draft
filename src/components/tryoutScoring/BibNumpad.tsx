import { useState } from 'react';
import type { GroupPlayer } from '../../types';

interface BibNumpadProps {
  onBibEnter: (bibNumber: number) => void;
  players?: GroupPlayer[];
}

export function BibNumpad({ onBibEnter, players = [] }: BibNumpadProps) {
  const [bib, setBib] = useState('');
  const [showNameSearch, setShowNameSearch] = useState(false);
  const [nameQuery, setNameQuery] = useState('');

  const handleKeyPress = (digit: string) => {
    setBib((prev) => prev + digit);
  };

  const handleClear = () => {
    setBib('');
  };

  const handleSubmit = () => {
    if (bib) {
      onBibEnter(parseInt(bib));
      setBib('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && bib) {
      handleSubmit();
    }
  };

  const filteredPlayers = players.filter((p) => {
    const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
    return fullName.includes(nameQuery.toLowerCase());
  });

  return (
    <div className="p-4">
      {!showNameSearch ? (
        <>
          {/* Bib Number Input */}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={bib}
            onChange={(e) => setBib(e.target.value.replace(/\D/g, ''))}
            onKeyDown={handleKeyDown}
            placeholder="Bib Number"
            className="w-full min-h-[56px] text-3xl text-center mb-4 border-2 rounded-lg focus:border-blue-500 focus:outline-none"
          />

          {/* Numpad Grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <button
                key={digit}
                onClick={() => handleKeyPress(String(digit))}
                className="min-h-[64px] min-w-[64px] text-2xl font-bold bg-blue-500 text-white rounded-lg active:bg-blue-600 hover:bg-blue-600 transition-colors"
              >
                {digit}
              </button>
            ))}
            <button
              onClick={handleClear}
              className="min-h-[64px] text-lg bg-gray-300 rounded-lg hover:bg-gray-400 active:bg-gray-400 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => handleKeyPress('0')}
              className="min-h-[64px] text-2xl font-bold bg-blue-500 text-white rounded-lg active:bg-blue-600 hover:bg-blue-600 transition-colors"
            >
              0
            </button>
            <button
              onClick={handleSubmit}
              className="min-h-[64px] text-lg bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 active:bg-green-600 transition-colors"
            >
              OK
            </button>
          </div>

          {/* Name Search Toggle */}
          <button
            onClick={() => setShowNameSearch(true)}
            className="w-full text-sm text-gray-500 underline hover:text-gray-700"
          >
            Search by name
          </button>
        </>
      ) : (
        <>
          {/* Name Search View */}
          <div className="mb-4">
            <input
              type="text"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Player name..."
              className="w-full min-h-[56px] text-xl px-4 border-2 rounded-lg focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Matching Players List */}
          <div className="mb-4 max-h-[400px] overflow-y-auto">
            {filteredPlayers.length > 0 ? (
              <div className="space-y-2">
                {filteredPlayers.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => {
                      onBibEnter(player.bibNumber);
                      setNameQuery('');
                      setShowNameSearch(false);
                    }}
                    className="w-full min-h-[56px] px-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 flex items-center justify-between"
                  >
                    <span className="text-lg font-medium">
                      {player.firstName} {player.lastName}
                    </span>
                    <span className="text-sm text-gray-500 font-bold bg-gray-100 px-3 py-1 rounded">
                      #{player.bibNumber}
                    </span>
                  </button>
                ))}
              </div>
            ) : nameQuery ? (
              <div className="text-center text-gray-500 py-8">No players found</div>
            ) : null}
          </div>

          {/* Back to Numpad */}
          <button
            onClick={() => {
              setShowNameSearch(false);
              setNameQuery('');
            }}
            className="w-full text-sm text-gray-500 underline hover:text-gray-700"
          >
            Back to bib entry
          </button>
        </>
      )}
    </div>
  );
}
