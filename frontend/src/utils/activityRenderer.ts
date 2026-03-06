'use client';

export interface ActivityLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  performedBy: { id: string; firstName: string; lastName: string };
  targetUser?: { id: string; firstName: string; lastName: string } | null;
  metadata?: any;
  createdAt: string;
}

export function renderActivityMessage(activity: ActivityLog, currentUserId: string, currentUserRole: string): string {
  const { action, performedBy, targetUser, metadata } = activity;
  const isPerformer = performedBy.id === currentUserId;
  const isTarget = targetUser?.id === currentUserId;
  const performerName = isPerformer ? 'You' : `${performedBy.firstName} ${performedBy.lastName}`;
  const targetName = isTarget ? 'you' : (targetUser ? `${targetUser.firstName} ${targetUser.lastName}` : '');
  const docNo = metadata?.docNumber || 'document';

  switch (action) {
    case 'CREATED':
      if (isPerformer) {
        return `Journal ${docNo} created by you, waiting for verification.`;
      }
      return `Journal ${docNo} created by ${performerName}, waiting for verification by you.`;

    case 'VERIFIED':
      if (isPerformer) {
        return `Journal ${docNo} verified by you, waiting for approval.`;
      }
      return `Journal ${docNo} verified by ${performerName}, waiting for ${isTarget ? 'your approval' : 'approval'}.`;

    case 'APPROVED':
      if (isPerformer) {
        return `Journal ${docNo} approved by you.`;
      }
      return `Journal ${docNo} approved by ${performerName}.`;

    case 'REJECTED_MANAGER':
      const reason = metadata?.reason ? `Reason: ${metadata.reason}.` : '';
      if (isTarget) {
        return `Journal ${docNo} rejected by ${performerName}. ${reason} Please modify and resubmit.`;
      }
      if (isPerformer) {
        return `Journal ${docNo} rejected by you. ${reason}`;
      }
      return `Journal ${docNo} rejected by ${performerName}. ${reason}`;

    case 'REJECTED_OWNER':
      const ownerReason = metadata?.reason ? `Reason: ${metadata.reason}.` : '';
      if (isTarget) {
        return `Journal ${docNo} rejected by Owner. ${ownerReason} Waiting for correction.`;
      }
      return `Journal ${docNo} rejected by Owner. ${ownerReason}`;

    default:
      return `${performerName} performed ${action} on ${activity.entityType} ${docNo}`;
  }
}
