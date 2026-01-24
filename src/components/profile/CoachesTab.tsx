import { useState, useEffect, useCallback, useMemo } from 'react';
import { UserPlus, Trash2, Edit2, Search, AlertCircle, Loader2, ClipboardList, X, Link, CheckSquare, Square, Plus } from 'lucide-react';
import { api, ApiError } from '../../api/client';
import { Coach, CoachRole, CoachCreateData, CoachUpdateData, DivisionSummary, DivisionPreset, DIVISION_PRESETS } from '../../types';

interface CoachesTabProps {
  isAdmin: boolean;
}

export function CoachesTab({ isAdmin }: CoachesTabProps) {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<CoachRole | ''>('');
  const [showInactive, setShowInactive] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingCoach, setEditingCoach] = useState<Coach | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // All coaches (unfiltered) for pairing dropdown
  const [allCoachesForPairing, setAllCoachesForPairing] = useState<Coach[]>([]);

  const loadCoaches = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getCoaches({
        role: roleFilter || undefined,
        showInactive,
        search: searchQuery || undefined,
      });
      setCoaches(data);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You do not have permission to view coaches.');
        } else {
          setError(err.details?.error as string || 'Failed to load coaches');
        }
      } else {
        setError('Failed to load coaches');
      }
    } finally {
      setLoading(false);
    }
  }, [roleFilter, showInactive, searchQuery]);

  // Load all coaches (unfiltered) for pairing dropdown
  const loadAllCoachesForPairing = useCallback(async () => {
    try {
      const data = await api.getCoaches({ showInactive: false });
      setAllCoachesForPairing(data);
    } catch (err) {
      console.error('Failed to load coaches for pairing:', err);
    }
  }, []);

  useEffect(() => {
    loadCoaches();
  }, [loadCoaches]);

  useEffect(() => {
    loadAllCoachesForPairing();
  }, [loadAllCoachesForPairing]);

  const handleDelete = async (coachId: string) => {
    if (deleteConfirm !== coachId) {
      setDeleteConfirm(coachId);
      return;
    }

    const previousCoaches = [...coaches];
    try {
      setActionLoading(coachId);
      setCoaches(coaches.filter(c => c.id !== coachId));
      setDeleteConfirm(null);
      await api.deleteCoach(coachId);
    } catch (err) {
      setCoaches(previousCoaches);
      if (err instanceof ApiError) {
        setError(err.details?.error as string || 'Failed to delete coach');
      } else {
        setError('Failed to delete coach');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleCoachCreated = (coach: Coach) => {
    setCoaches([coach, ...coaches]);
    setShowAddModal(false);
  };

  const handleCoachUpdated = (updated: Coach) => {
    setCoaches(coaches.map(c => c.id === updated.id ? updated : c));
    setEditingCoach(null);
  };

  const handleBulkCreated = (newCoaches: Coach[]) => {
    setCoaches([...newCoaches, ...coaches]);
    setShowBulkModal(false);
  };

  const formatRole = (role: CoachRole) => {
    return role === 'manager' ? 'Manager' : 'Assistant Coach';
  };

  // Bulk selection handlers
  const allSelected = useMemo(() =>
    coaches.length > 0 && coaches.every(c => selectedIds.has(c.id)),
    [coaches, selectedIds]
  );

  const someSelected = useMemo(() =>
    selectedIds.size > 0 && !allSelected,
    [selectedIds, allSelected]
  );

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(coaches.map(c => c.id)));
    }
  };

  const toggleSelect = (coachId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(coachId)) {
        next.delete(coachId);
      } else {
        next.add(coachId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmMsg = `Are you sure you want to delete ${selectedIds.size} coach${selectedIds.size > 1 ? 'es' : ''}? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    const previousCoaches = [...coaches];
    try {
      setBulkActionLoading(true);
      // Optimistically update UI
      setCoaches(coaches.filter(c => !selectedIds.has(c.id)));

      // Delete all selected coaches
      await Promise.all(
        Array.from(selectedIds).map(id => api.deleteCoach(id))
      );

      clearSelection();
    } catch (err) {
      setCoaches(previousCoaches);
      if (err instanceof ApiError) {
        setError(err.details?.error as string || 'Failed to delete coaches');
      } else {
        setError('Failed to delete some coaches');
      }
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkEditComplete = (updatedCoaches: Coach[]) => {
    // Update the coaches in the list with the new data
    setCoaches(prev => {
      const updatedMap = new Map(updatedCoaches.map(c => [c.id, c]));
      return prev.map(c => updatedMap.get(c.id) || c);
    });
    setShowBulkEditModal(false);
    clearSelection();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
          <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Coaches & Managers ({coaches.length})
        </h3>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <ClipboardList className="w-4 h-4" />
              Bulk Add
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Add Coach
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search coaches..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as CoachRole | '')}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Roles</option>
          <option value="manager">Manager</option>
          <option value="assistant_coach">Assistant Coach</option>
        </select>
        {isAdmin && (
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Show inactive
          </label>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {isAdmin && selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              {selectedIds.size} selected
            </span>
            <button
              onClick={clearSelection}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulkEditModal(true)}
              disabled={bulkActionLoading}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Edit2 className="w-4 h-4" />
              Bulk Edit
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {bulkActionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Coaches List */}
      <div className="space-y-2">
        {coaches.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            {searchQuery || roleFilter ? 'No coaches match your filters.' : 'No coaches yet. Add your first coach to get started.'}
          </div>
        ) : (
          <>
            {/* Select All Header (Admin only) */}
            {isAdmin && coaches.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  {allSelected ? (
                    <CheckSquare className="w-5 h-5 text-blue-600" />
                  ) : someSelected ? (
                    <div className="w-5 h-5 border-2 border-blue-600 rounded flex items-center justify-center">
                      <div className="w-2.5 h-0.5 bg-blue-600" />
                    </div>
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                  Select all
                </button>
              </div>
            )}
            {coaches.map((coach) => {
            const isLoading = actionLoading === coach.id;
            const showDeleteConfirm = deleteConfirm === coach.id;
            const isSelected = selectedIds.has(coach.id);

            return (
              <div
                key={coach.id}
                className={`flex items-center justify-between p-4 rounded-lg ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-300 dark:ring-blue-700'
                    : coach.isActive
                    ? 'bg-gray-50 dark:bg-gray-700/50'
                    : 'bg-gray-100 dark:bg-gray-800/50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Selection Checkbox (Admin only) */}
                  {isAdmin && (
                    <button
                      onClick={() => toggleSelect(coach.id)}
                      className="flex-shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-blue-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                      )}
                    </button>
                  )}
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 dark:text-blue-400 font-medium">
                      {coach.firstName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {coach.fullName}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        coach.role === 'manager'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      }`}>
                        {formatRole(coach.role)}
                      </span>
                      {!coach.isActive && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {coach.email && <span>{coach.email}</span>}
                      {coach.email && coach.phone && <span> &bull; </span>}
                      {coach.phone && <span>{coach.phone}</span>}
                      {!coach.email && !coach.phone && <span className="italic">No contact info</span>}
                    </div>
                    {/* Show division and pairing info */}
                    {(coach.divisionId || coach.pairedWithId) && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {coach.divisionId && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                            Division assigned
                          </span>
                        )}
                        {coach.pairedWithId && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                            <Link className="w-3 h-3" />
                            Paired
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions (Admin only) */}
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                    ) : (
                      <>
                        <button
                          onClick={() => setEditingCoach(coach)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Edit coach"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(coach.id)}
                          className={`p-2 rounded-lg transition-colors ${
                            showDeleteConfirm
                              ? 'bg-red-600 text-white'
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                          }`}
                          title={showDeleteConfirm ? 'Click again to confirm' : 'Delete coach'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          </>
        )}
      </div>

      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <BulkEditModal
          selectedCoaches={coaches.filter(c => selectedIds.has(c.id))}
          onClose={() => setShowBulkEditModal(false)}
          onSave={handleBulkEditComplete}
        />
      )}

      {/* Add Coach Modal */}
      {showAddModal && (
        <CoachFormModal
          allCoaches={allCoachesForPairing}
          onClose={() => setShowAddModal(false)}
          onSave={(coach) => {
            handleCoachCreated(coach);
            loadAllCoachesForPairing(); // Refresh pairing list
          }}
        />
      )}

      {/* Edit Coach Modal */}
      {editingCoach && (
        <CoachFormModal
          coach={editingCoach}
          allCoaches={allCoachesForPairing}
          onClose={() => setEditingCoach(null)}
          onSave={(coach) => {
            handleCoachUpdated(coach);
            loadAllCoachesForPairing(); // Refresh pairing list
          }}
        />
      )}

      {/* Bulk Add Modal */}
      {showBulkModal && (
        <BulkAddCoachesModal
          onClose={() => setShowBulkModal(false)}
          onSave={handleBulkCreated}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------------
// Coach Form Modal (Add/Edit)
// -------------------------------------------------------------------

interface CoachFormModalProps {
  coach?: Coach;
  allCoaches: Coach[];
  onClose: () => void;
  onSave: (coach: Coach) => void;
}

function CoachFormModal({ coach, allCoaches, onClose, onSave }: CoachFormModalProps) {
  const isEdit = !!coach;
  const [firstName, setFirstName] = useState(coach?.firstName || '');
  const [lastName, setLastName] = useState(coach?.lastName || '');
  const [email, setEmail] = useState(coach?.email || '');
  const [phone, setPhone] = useState(coach?.phone || '');
  const [role, setRole] = useState<CoachRole>(coach?.role || 'manager');
  const [divisionId, setDivisionId] = useState<string | null>(coach?.divisionId || null);
  const [pairedWithId, setPairedWithId] = useState<string | null>(coach?.pairedWithId || null);
  const [isActive, setIsActive] = useState(coach?.isActive ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [divisions, setDivisions] = useState<DivisionSummary[]>([]);
  const [divisionsLoading, setDivisionsLoading] = useState(true);

  // Load divisions for the dropdown
  useEffect(() => {
    api.listDivisions()
      .then(setDivisions)
      .catch(err => console.error('Failed to load divisions:', err))
      .finally(() => setDivisionsLoading(false));
  }, []);

  // Get available coaches for pairing (opposite role, not already paired, not self)
  const availableForPairing = allCoaches.filter(c => {
    // Can't pair with self
    if (coach && c.id === coach.id) return false;
    // Must be opposite role (managers pair with assistants, assistants pair with managers)
    if (role === 'manager' && c.role !== 'assistant_coach') return false;
    if (role === 'assistant_coach' && c.role !== 'manager') return false;
    // Only active coaches
    if (!c.isActive) return false;
    // Not already paired with someone else (unless it's the current pairing)
    if (c.pairedWithId && c.pairedWithId !== coach?.id) return false;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (isEdit && coach) {
        const data: CoachUpdateData = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          role,
          divisionId,
          pairedWithId,
          isActive,
        };
        const updated = await api.updateCoach(coach.id, data);

        // If pairing changed, also update the other coach's pairing
        if (pairedWithId !== coach.pairedWithId) {
          // Clear old pairing if there was one
          if (coach.pairedWithId) {
            await api.updateCoach(coach.pairedWithId, { pairedWithId: null });
          }
          // Set new pairing
          if (pairedWithId) {
            await api.updateCoach(pairedWithId, { pairedWithId: coach.id });
          }
        }

        onSave(updated);
      } else {
        const data: CoachCreateData = {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          role,
          divisionId,
          pairedWithId,
        };
        const created = await api.createCoach(data);

        // If pairing set, also update the other coach
        if (pairedWithId) {
          await api.updateCoach(pairedWithId, { pairedWithId: created.id });
        }

        onSave(created);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        // Format validation errors
        if (err.details) {
          const errorMessages: string[] = [];
          for (const [field, messages] of Object.entries(err.details)) {
            if (Array.isArray(messages)) {
              errorMessages.push(`${field}: ${messages.join(', ')}`);
            }
          }
          setError(errorMessages.join('\n') || 'Failed to save coach');
        } else {
          setError('Failed to save coach');
        }
      } else {
        setError('Failed to save coach');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Coach' : 'Add Coach'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <span className="text-sm text-red-700 dark:text-red-300 whitespace-pre-line">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                First Name *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as CoachRole);
                // Clear pairing when role changes since pairing requires opposite roles
                setPairedWithId(null);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="manager">Manager</option>
              <option value="assistant_coach">Assistant Coach</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Division
            </label>
            <select
              value={divisionId || ''}
              onChange={(e) => setDivisionId(e.target.value || null)}
              disabled={divisionsLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="">No division assigned</option>
              {divisions.map(div => (
                <option key={div.id} value={div.id}>
                  {div.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Which division this coach will manage/assist
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Paired With {role === 'manager' ? '(Assistant)' : '(Manager)'}
            </label>
            <select
              value={pairedWithId || ''}
              onChange={(e) => setPairedWithId(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No pairing</option>
              {availableForPairing.map(c => (
                <option key={c.id} value={c.id}>
                  {c.fullName} ({c.role === 'manager' ? 'Manager' : 'Assistant'})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Paired coaches will be placed on the same team
            </p>
          </div>

          {isEdit && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">
                Active
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Coach'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// Bulk Add Coaches Modal
// -------------------------------------------------------------------

interface BulkAddCoachesModalProps {
  onClose: () => void;
  onSave: (coaches: Coach[]) => void;
}

function BulkAddCoachesModal({ onClose, onSave }: BulkAddCoachesModalProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim()) {
      setError('Please paste coach names');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await api.bulkCreateCoaches({ text });
      onSave(result.coaches);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details?.lines) {
          setError((err.details.lines as string[]).join('\n'));
        } else if (err.details?.text) {
          setError((err.details.text as string[])[0]);
        } else {
          setError('Failed to create coaches');
        }
      } else {
        setError('Failed to create coaches');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Bulk Add Coaches
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <p>Paste one coach per line. Supported formats:</p>
            <ul className="list-disc list-inside ml-2 text-xs">
              <li><code>John Smith</code> (defaults to Manager)</li>
              <li><code>John Smith, Manager</code></li>
              <li><code>Jane Doe, Assistant Coach</code></li>
              <li><code>John{'\t'}Smith{'\t'}Manager</code> (tab-separated)</li>
            </ul>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg max-h-40 overflow-y-auto">
              <span className="text-sm text-red-700 dark:text-red-300 whitespace-pre-line">{error}</span>
            </div>
          )}

          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="John Smith, Manager
Jane Doe, Assistant Coach
Bob Wilson"
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !text.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Coaches
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// Bulk Edit Modal
// -------------------------------------------------------------------

interface BulkEditModalProps {
  selectedCoaches: Coach[];
  onClose: () => void;
  onSave: (coaches: Coach[]) => void;
}

function BulkEditModal({ selectedCoaches, onClose, onSave }: BulkEditModalProps) {
  const [divisionId, setDivisionId] = useState<string | null | 'no-change'>('no-change');
  const [role, setRole] = useState<CoachRole | 'no-change'>('no-change');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [divisions, setDivisions] = useState<DivisionSummary[]>([]);
  const [divisionsLoading, setDivisionsLoading] = useState(true);

  // State for creating a new division inline
  const [showCreateDivision, setShowCreateDivision] = useState(false);
  const [newDivisionName, setNewDivisionName] = useState('');
  const [newDivisionPreset, setNewDivisionPreset] = useState<DivisionPreset>('majors');
  const [newDivisionTeamCount, setNewDivisionTeamCount] = useState(8);
  const [creatingDivision, setCreatingDivision] = useState(false);

  // Load divisions for the dropdown
  const loadDivisions = useCallback(async () => {
    try {
      setDivisionsLoading(true);
      const data = await api.listDivisions();
      setDivisions(data);
    } catch (err) {
      console.error('Failed to load divisions:', err);
    } finally {
      setDivisionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDivisions();
  }, [loadDivisions]);

  const handleCreateDivision = async () => {
    if (!newDivisionName.trim()) {
      setError('Division name is required');
      return;
    }

    try {
      setCreatingDivision(true);
      setError(null);

      const preset = DIVISION_PRESETS[newDivisionPreset as keyof typeof DIVISION_PRESETS];

      const newDivision = await api.createDivision({
        name: newDivisionName.trim(),
        preset: newDivisionPreset,
        ageRange: preset.ageRange,
        teamCount: newDivisionTeamCount,
        enforceAgeLimit: preset.enforceAgeLimit,
        maxPerAge: preset.maxPerAge,
      });

      // Refresh divisions list and select the new division
      await loadDivisions();
      setDivisionId(newDivision.id);
      setShowCreateDivision(false);
      setNewDivisionName('');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.details?.error as string || 'Failed to create division');
      } else {
        setError('Failed to create division');
      }
    } finally {
      setCreatingDivision(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (divisionId === 'no-change' && role === 'no-change') {
      setError('Please select at least one field to update');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const updateData: CoachUpdateData = {};
      if (divisionId !== 'no-change') {
        updateData.divisionId = divisionId;
      }
      if (role !== 'no-change') {
        updateData.role = role;
      }

      // Update all selected coaches
      const updatedCoaches = await Promise.all(
        selectedCoaches.map(coach => api.updateCoach(coach.id, updateData))
      );

      onSave(updatedCoaches);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.details?.error as string || 'Failed to update coaches');
      } else {
        setError('Failed to update some coaches');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Bulk Edit ({selectedCoaches.length} coaches)
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Update the following fields for all selected coaches. Leave a field as "No change" to keep existing values.
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Division
            </label>
            <div className="flex gap-2">
              <select
                value={divisionId === null ? 'none' : divisionId}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'no-change') {
                    setDivisionId('no-change');
                  } else if (val === 'none') {
                    setDivisionId(null);
                  } else {
                    setDivisionId(val);
                  }
                }}
                disabled={divisionsLoading}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="no-change">-- No change --</option>
                <option value="none">No division assigned</option>
                {divisions.map(div => (
                  <option key={div.id} value={div.id}>
                    {div.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowCreateDivision(!showCreateDivision)}
                className={`p-2 rounded-lg transition-colors ${
                  showCreateDivision
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title="Create new division"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            {/* Inline division creation form */}
            {showCreateDivision && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                <div className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  Create New Division
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Division Name *
                  </label>
                  <input
                    type="text"
                    value={newDivisionName}
                    onChange={(e) => setNewDivisionName(e.target.value)}
                    placeholder="e.g., Majors 2025"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Preset
                    </label>
                    <select
                      value={newDivisionPreset}
                      onChange={(e) => setNewDivisionPreset(e.target.value as DivisionPreset)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="majors">Majors (10-12)</option>
                      <option value="aaa">AAA (8-10)</option>
                      <option value="aa">AA (7-10)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Teams
                    </label>
                    <select
                      value={newDivisionTeamCount}
                      onChange={(e) => setNewDivisionTeamCount(Number(e.target.value))}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    >
                      {[5, 6, 7, 8, 9, 10].map(n => (
                        <option key={n} value={n}>{n} teams</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateDivision(false);
                      setNewDivisionName('');
                    }}
                    className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateDivision}
                    disabled={creatingDivision || !newDivisionName.trim()}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {creatingDivision && <Loader2 className="w-3 h-3 animate-spin" />}
                    Create & Select
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as CoachRole | 'no-change')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="no-change">-- No change --</option>
              <option value="manager">Manager</option>
              <option value="assistant_coach">Assistant Coach</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Note: Changing role will clear any existing pairings
            </p>
          </div>

          {/* Preview of selected coaches */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-40 overflow-y-auto">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Selected coaches:
            </div>
            <div className="space-y-1">
              {selectedCoaches.map(coach => (
                <div key={coach.id} className="text-sm text-gray-700 dark:text-gray-300">
                  {coach.fullName}
                  <span className="text-gray-400 dark:text-gray-500 ml-2">
                    ({coach.role === 'manager' ? 'Manager' : 'Assistant'})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (divisionId === 'no-change' && role === 'no-change')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Update {selectedCoaches.length} Coaches
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
