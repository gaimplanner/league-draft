import { ArrowLeft, Wand2, Upload, Users, BarChart3, Download } from 'lucide-react';
import { Division } from '../types';

interface TeamBuilderFlowProps {
  division: Division;
  onBack: () => void;
}

/**
 * TeamBuilderFlow - Placeholder component for League Generated Teams mode.
 *
 * This component will be expanded in future PRs to include:
 * - Excel import with Registration Data tab parsing
 * - Request resolution (teammate and coach requests)
 * - Auto-assignment algorithm execution
 * - Results view with happiness indicators
 * - Integration with existing trade module for swaps
 * - Export functionality
 */
export const TeamBuilderFlow = ({ division, onBack }: TeamBuilderFlowProps) => {
  const steps = [
    {
      icon: Upload,
      title: 'Import Excel',
      description: 'Upload player data with Registration Data tab containing friend requests and coach preferences',
      status: 'upcoming' as const,
    },
    {
      icon: Users,
      title: 'Configure Teams',
      description: 'Assign coaches, review locked players (coach kids, siblings)',
      status: 'upcoming' as const,
    },
    {
      icon: Wand2,
      title: 'Generate Teams',
      description: 'Run auto-assignment algorithm balancing skills and honoring requests',
      status: 'upcoming' as const,
    },
    {
      icon: BarChart3,
      title: 'Review & Adjust',
      description: 'View happiness scores, make manual swaps if needed',
      status: 'upcoming' as const,
    },
    {
      icon: Download,
      title: 'Export',
      description: 'Export final rosters and happiness report',
      status: 'upcoming' as const,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Divisions
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Division Info */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-4">
            <Wand2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
              League Generated Teams
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {division.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {division.teamCount} teams • Ages {division.ageRange.min}-{division.ageRange.max}
          </p>
        </div>

        {/* Coming Soon Notice */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
            Team Builder Coming Soon
          </h2>
          <p className="text-amber-700 dark:text-amber-300">
            The automatic team generation feature is under development. Once complete, you'll be able to
            import player data, honor friend requests, and automatically create balanced teams.
          </p>
        </div>

        {/* Steps Preview */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            How it will work
          </h3>
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={index} className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                  <step.icon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {index + 1}. {step.title}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features Preview */}
        <div className="mt-8 grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Balanced Teams
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Algorithm ensures all teams are within ±10% of the mean total score.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Friend Requests
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Honors two-way and one-way teammate requests when possible.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Coach Assignments
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Respects coach preferences and auto-places coach kids.
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">
              Happiness Report
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              See which requests were honored with exportable report.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
