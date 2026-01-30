import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { GroupPlayer, StationDefinition } from '../../types';

interface PlayerScoreCardProps {
  player: GroupPlayer;
  station: StationDefinition;
  existingScores?: Record<string, number>;
  onSubmit: (scores: Record<string, number>) => void;
  showConfirmation: boolean;
}

export function PlayerScoreCard({
  player,
  station,
  existingScores = {},
  onSubmit,
  showConfirmation,
}: PlayerScoreCardProps) {
  const { register, watch, setValue, reset } = useForm<Record<string, number>>({
    defaultValues: existingScores,
  });

  // Watch all fields to detect when all are filled
  const formValues = watch();

  // Check if all fields are filled
  useEffect(() => {
    const allFilled = station.fields.every((field) => {
      const value = formValues[field.id];
      return value !== undefined && value !== null && String(value).trim() !== '';
    });

    if (allFilled) {
      // Convert form values to numbers and submit
      const scores: Record<string, number> = {};
      station.fields.forEach((field) => {
        scores[field.id] = Number(formValues[field.id]);
      });
      onSubmit(scores);
      // Reset form for next player
      reset();
    }
  }, [formValues, station.fields, onSubmit, reset]);

  return (
    <div className="relative bg-white rounded-lg shadow-md p-4">
      {/* Confirmation Overlay */}
      {showConfirmation && (
        <div className="absolute inset-0 bg-green-500 bg-opacity-90 rounded-lg flex items-center justify-center z-10 animate-fade-in">
          <div className="text-center">
            <svg
              className="w-16 h-16 text-white mx-auto mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-2xl font-bold text-white">Scored!</p>
          </div>
        </div>
      )}

      {/* Player Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-2xl">
          #{player.bibNumber}
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">
            {player.firstName} {player.lastName}
          </h2>
        </div>
      </div>

      {/* Score Fields */}
      <div className="space-y-4">
        {station.fields.map((field) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {field.name}
              {field.description && <span className="text-gray-500 ml-1">({field.description})</span>}
            </label>

            {field.type === 'scale' ? (
              <div className="flex gap-2">
                {Array.from({ length: field.max - field.min + 1 }, (_, i) => field.min + i).map((value) => {
                  const currentValue = formValues[field.id];
                  const isSelected = currentValue === value || Number(currentValue) === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setValue(field.id, value)}
                      className={`flex-1 min-h-[56px] rounded-lg text-xl font-bold transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 active:bg-gray-300'
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            ) : (
              <input
                type="text"
                inputMode={field.type === 'time' ? 'decimal' : 'numeric'}
                pattern={field.type === 'time' ? '[0-9]*\\.?[0-9]*' : '[0-9]*'}
                {...register(field.id, {
                  setValueAs: (v) => (v === '' ? null : Number(v)),
                })}
                placeholder={field.unit ? `Enter ${field.unit}` : `Enter ${field.name.toLowerCase()}`}
                className="w-full min-h-[56px] text-xl px-4 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
            )}

            {/* Anchors for scale fields */}
            {field.type === 'scale' && field.anchors && (
              <div className="mt-1 text-xs text-gray-500 flex justify-between">
                <span>{field.anchors[String(field.min)]}</span>
                <span>{field.anchors[String(field.max)]}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
