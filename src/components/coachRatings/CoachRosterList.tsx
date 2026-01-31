import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, ChevronRight, CheckCircle, Edit3, Users } from 'lucide-react';
import type { CoachRating, DuplicatePlayerWarning } from '../../types';
import { addPlayerSchema, type AddPlayerFormData } from '../../schemas/coachRating';

interface CoachRosterListProps {
  ratings: CoachRating[];
  onSelectPlayer: (rating: CoachRating) => void;
  onAddPlayer: (firstName: string, lastName: string, force?: boolean) => Promise<DuplicatePlayerWarning | null>;
  isLoading?: boolean;
}

export function CoachRosterList({
  ratings,
  onSelectPlayer,
  onAddPlayer,
  isLoading = false,
}: CoachRosterListProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    firstName: string;
    lastName: string;
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddPlayerFormData>({
    resolver: zodResolver(addPlayerSchema),
  });

  const handleAdd = useCallback(async (data: AddPlayerFormData) => {
    const warning = await onAddPlayer(data.playerFirstName, data.playerLastName);
    if (warning) {
      // Show confirmation dialog instead of closing form
      setDuplicateWarning({
        firstName: data.playerFirstName,
        lastName: data.playerLastName,
        message: warning.message,
      });
      return; // Don't close form yet
    }
    // Success - close form
    reset();
    setShowAddForm(false);
  }, [onAddPlayer, reset]);

  const handleConfirmDuplicate = useCallback(async () => {
    if (!duplicateWarning) return;
    await onAddPlayer(duplicateWarning.firstName, duplicateWarning.lastName, true);
    setDuplicateWarning(null);
    reset();
    setShowAddForm(false);
  }, [duplicateWarning, onAddPlayer, reset]);

  const draftCount = ratings.filter(r => r.status === 'draft').length;
  const submittedCount = ratings.filter(r => r.status === 'submitted').length;

  return (
    <div>
      {/* Summary Bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {ratings.length} player{ratings.length !== 1 ? 's' : ''}
          {submittedCount > 0 && (
            <span className="ml-2 text-green-600 dark:text-green-400">
              ({submittedCount} submitted)
            </span>
          )}
          {draftCount > 0 && (
            <span className="ml-2 text-yellow-600 dark:text-yellow-400">
              ({draftCount} draft)
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Player
        </button>
      </div>

      {/* Add Player Form */}
      {showAddForm && (
        <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmit(handleAdd)} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                First Name
              </label>
              <input
                {...register('playerFirstName')}
                type="text"
                placeholder="First name"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.playerFirstName && (
                <p className="mt-1 text-xs text-red-600">{errors.playerFirstName.message}</p>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Last Name
              </label>
              <input
                {...register('playerLastName')}
                type="text"
                placeholder="Last name"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.playerLastName && (
                <p className="mt-1 text-xs text-red-600">{errors.playerLastName.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => { reset(); setShowAddForm(false); setDuplicateWarning(null); }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </form>

          {/* Duplicate Warning Confirmation */}
          {duplicateWarning && (
            <div className="mt-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                {duplicateWarning.message}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmDuplicate}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  Add Anyway
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Player List */}
      {ratings.length > 0 ? (
        <div className="space-y-2">
          {ratings.map(rating => (
            <button
              key={rating.id}
              onClick={() => onSelectPlayer(rating)}
              className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-900 dark:text-white">
                  {rating.playerLastName}, {rating.playerFirstName}
                </span>
                {rating.status === 'submitted' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle className="w-3 h-3" />
                    Submitted
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    <Edit3 className="w-3 h-3" />
                    Draft
                  </span>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          ))}
        </div>
      ) : (
        !isLoading && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              No players to rate yet. Add a player to get started.
            </p>
          </div>
        )
      )}
    </div>
  );
}
