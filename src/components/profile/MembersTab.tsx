import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Trash2, Shield, ShieldOff, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { api, ApiError } from '../../api/client';
import { LeagueMember, LeagueInvitation, LeagueMembershipRole } from '../../types';
import { InviteModal } from './InviteModal';
import { JoinLinkSection } from './JoinLinkSection';

interface MembersTabProps {
  leagueId: string;
  leagueName: string;
  isAdmin: boolean;
  currentUserId: string;
}

export function MembersTab({ leagueId, leagueName, isAdmin, currentUserId }: MembersTabProps) {
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [invitations, setInvitations] = useState<LeagueInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [membersData, invitationsData] = await Promise.all([
        api.listLeagueMembers(leagueId),
        isAdmin ? api.listLeagueInvitations(leagueId) : Promise.resolve([]),
      ]);
      setMembers(membersData);
      setInvitations(invitationsData);
    } catch (err) {
      // Handle all error types including 403 (Issue #27 - admin 403 handling)
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You no longer have permission to view members. Your admin access may have been revoked.');
        } else {
          setError(err.details?.error as string || 'Failed to load members');
        }
      } else {
        setError('Failed to load members');
      }
    } finally {
      setLoading(false);
    }
  }, [leagueId, isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRemoveMember = async (userId: string) => {
    if (deleteConfirm !== userId) {
      setDeleteConfirm(userId);
      return;
    }

    // Store previous state for rollback (Issue #27 - optimistic updates)
    const previousMembers = [...members];

    try {
      setActionLoading(userId);
      // Optimistically update UI
      setMembers(members.filter(m => m.userId !== userId));
      setDeleteConfirm(null);
      // Then make API call
      await api.removeLeagueMember(leagueId, userId);
    } catch (err) {
      // Rollback on failure
      setMembers(previousMembers);
      // Handle all error types including 403 (Issue #27 - admin 403 handling)
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You no longer have permission to remove members. Your admin access may have been revoked.');
        } else {
          setError(err.details?.error as string || 'Failed to remove member');
        }
      } else {
        setError('Failed to remove member');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: LeagueMembershipRole) => {
    // Store previous state for rollback (Issue #27 - optimistic updates)
    const previousMembers = [...members];
    const member = members.find(m => m.userId === userId);
    if (!member) return;

    try {
      setActionLoading(userId);
      // Optimistically update UI
      setMembers(members.map(m => m.userId === userId ? { ...m, role: newRole } : m));
      // Then make API call
      const updated = await api.updateMemberRole(leagueId, userId, newRole);
      // Update with actual server response
      setMembers(prev => prev.map(m => m.userId === userId ? updated : m));
    } catch (err) {
      // Rollback on failure
      setMembers(previousMembers);
      // Handle all error types including 403 (Issue #27 - admin 403 handling)
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You no longer have permission to change roles. Your admin access may have been revoked.');
        } else {
          setError(err.details?.error as string || 'Failed to update role');
        }
      } else {
        setError('Failed to update role');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    // Store previous state for rollback (Issue #27 - optimistic updates)
    const previousInvitations = [...invitations];

    try {
      setActionLoading(invitationId);
      // Optimistically update UI
      setInvitations(invitations.filter(i => i.id !== invitationId));
      // Then make API call
      await api.cancelInvitation(leagueId, invitationId);
    } catch (err) {
      // Rollback on failure
      setInvitations(previousInvitations);
      // Handle all error types including 403 (Issue #27 - admin 403 handling)
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You no longer have permission to cancel invitations. Your admin access may have been revoked.');
        } else {
          setError(err.details?.error as string || 'Failed to cancel invitation');
        }
      } else {
        setError('Failed to cancel invitation');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleInviteSent = (invitation: LeagueInvitation) => {
    setInvitations([invitation, ...invitations]);
    setShowInviteModal(false);
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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

      {/* Join Link Section (Admin only) */}
      {isAdmin && (
        <JoinLinkSection leagueId={leagueId} />
      )}

      {/* Invite Button (Admin only) */}
      {isAdmin && (
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Members ({members.length})
          </h3>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Invite Member
          </button>
        </div>
      )}

      {/* Members List */}
      <div className="space-y-2">
        {members.map((member) => {
          const isCurrentUser = member.userId === currentUserId;
          const isLoading = actionLoading === member.userId;
          const showDeleteConfirm = deleteConfirm === member.userId;

          return (
            <div
              key={member.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    {(member.firstName || member.email).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {member.firstName || member.lastName
                        ? `${member.firstName} ${member.lastName}`.trim()
                        : member.email}
                    </span>
                    {isCurrentUser && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">(you)</span>
                    )}
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      member.role === 'admin'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                        : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                    }`}>
                      {member.role}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {member.email} &bull; Joined {formatDate(member.joinedAt)}
                  </div>
                </div>
              </div>

              {/* Actions (Admin only, not for self) */}
              {isAdmin && !isCurrentUser && (
                <div className="flex items-center gap-2">
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  ) : (
                    <>
                      {/* Toggle Role */}
                      <button
                        onClick={() => handleUpdateRole(
                          member.userId,
                          member.role === 'admin' ? 'member' : 'admin'
                        )}
                        className={`p-2 rounded-lg transition-colors ${
                          member.role === 'admin'
                            ? 'text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                        title={member.role === 'admin' ? 'Demote to member' : 'Promote to admin'}
                      >
                        {member.role === 'admin' ? (
                          <ShieldOff className="w-4 h-4" />
                        ) : (
                          <Shield className="w-4 h-4" />
                        )}
                      </button>

                      {/* Remove */}
                      <button
                        onClick={() => handleRemoveMember(member.userId)}
                        className={`p-2 rounded-lg transition-colors ${
                          showDeleteConfirm
                            ? 'bg-red-600 text-white'
                            : 'text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                        }`}
                        title={showDeleteConfirm ? 'Click again to confirm' : 'Remove member'}
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
      </div>

      {/* Pending Invitations (Admin only) */}
      {isAdmin && invitations.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Pending Invitations ({invitations.length})
          </h3>
          <div className="space-y-2">
            {invitations.map((invitation) => {
              const isLoading = actionLoading === invitation.id;

              return (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {invitation.email}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Invited as {invitation.role} &bull; Expires {formatDate(invitation.expiresAt)}
                      </div>
                    </div>
                  </div>

                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  ) : (
                    <button
                      onClick={() => handleCancelInvitation(invitation.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Cancel invitation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          leagueId={leagueId}
          leagueName={leagueName}
          onClose={() => setShowInviteModal(false)}
          onInviteSent={handleInviteSent}
        />
      )}
    </div>
  );
}
