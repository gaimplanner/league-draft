import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Plus, Loader2, X } from 'lucide-react';
import { api } from '../api/client';
import { Coach, CoachRole, CoachCreateData } from '../types';

interface CoachSelectorProps {
  /** Currently selected coach ID */
  value: string | null;
  /** Callback when selection changes */
  onChange: (coachId: string | null, coach: Coach | null) => void;
  /** Filter by role (manager or assistant_coach) */
  role?: CoachRole;
  /** Filter by division ID (only show coaches assigned to this division) */
  divisionId?: string;
  /** If true, also include coaches with no division assignment */
  includeUnassigned?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Disable the selector */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Coaches that are already assigned elsewhere (to prevent duplicates) */
  excludeCoachIds?: string[];
}

export function CoachSelector({
  value,
  onChange,
  role,
  divisionId,
  includeUnassigned = true,
  placeholder = 'Select coach...',
  disabled = false,
  className = '',
  excludeCoachIds = [],
}: CoachSelectorProps) {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load coaches on mount and when filters change
  useEffect(() => {
    loadCoaches();
  }, [role, divisionId, includeUnassigned]);

  const loadCoaches = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getCoaches({
        role,
        divisionId: divisionId ?? undefined,
        includeUnassigned: divisionId ? includeUnassigned : undefined,
      });
      setCoaches(data);
    } catch (err) {
      console.error('Failed to load coaches:', err);
    } finally {
      setLoading(false);
    }
  }, [role, divisionId, includeUnassigned]);

  // Find selected coach
  const selectedCoach = coaches.find(c => c.id === value);

  // Filter coaches by search and exclusions
  const filteredCoaches = coaches.filter(coach => {
    // Exclude already-assigned coaches (but keep the currently selected one)
    if (excludeCoachIds.includes(coach.id) && coach.id !== value) {
      return false;
    }
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        coach.firstName.toLowerCase().includes(query) ||
        coach.lastName.toLowerCase().includes(query) ||
        coach.fullName.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const handleSelect = (coach: Coach | null) => {
    onChange(coach?.id ?? null, coach);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null, null);
  };

  const handleCoachCreated = (newCoach: Coach) => {
    setCoaches(prev => [newCoach, ...prev]);
    onChange(newCoach.id, newCoach);
    setShowAddForm(false);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Selector Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-3 py-2
          border border-gray-300 dark:border-gray-600 rounded-lg
          bg-white dark:bg-gray-800 text-left
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400 dark:hover:border-gray-500'}
          ${isOpen ? 'ring-2 ring-blue-500' : ''}
        `}
      >
        <span className={selectedCoach ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : selectedCoach ? (
            selectedCoach.fullName
          ) : (
            placeholder
          )}
        </span>
        <div className="flex items-center gap-1">
          {selectedCoach && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-64 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-700">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search coaches..."
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Coach List */}
          <div className="max-h-40 overflow-y-auto">
            {filteredCoaches.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No coaches match your search' : 'No coaches available'}
              </div>
            ) : (
              filteredCoaches.map(coach => (
                <button
                  key={coach.id}
                  type="button"
                  onClick={() => handleSelect(coach)}
                  className={`
                    w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700
                    ${coach.id === value ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white'}
                  `}
                >
                  <div className="font-medium">{coach.fullName}</div>
                  {coach.email && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">{coach.email}</div>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Add New Coach Button */}
          <div className="border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full px-3 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add new coach
            </button>
          </div>
        </div>
      )}

      {/* Inline Add Coach Form */}
      {showAddForm && (
        <InlineAddCoachForm
          defaultRole={role}
          onSave={handleCoachCreated}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setIsOpen(false);
            setSearchQuery('');
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------------
// Inline Add Coach Form
// -------------------------------------------------------------------

interface InlineAddCoachFormProps {
  defaultRole?: CoachRole;
  onSave: (coach: Coach) => void;
  onCancel: () => void;
}

function InlineAddCoachForm({ defaultRole, onSave, onCancel }: InlineAddCoachFormProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data: CoachCreateData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: defaultRole || 'manager',
      };
      const coach = await api.createCoach(data);
      onSave(coach);
    } catch {
      setError('Failed to create coach');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Add New Coach
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              {loading && <Loader2 className="w-3 h-3 animate-spin" />}
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
