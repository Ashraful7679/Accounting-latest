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
  if (!activity) return 'Unknown activity';
  const { action, performedBy, targetUser, metadata } = activity;
  
  if (!performedBy) return `An action was performed on ${activity.entityType || 'a document'}`;

  const isPerformer = performedBy.id === currentUserId;
  const isTarget = targetUser?.id === currentUserId;
  const performerName = isPerformer ? 'You' : `${performedBy.firstName || 'Someone'} ${performedBy.lastName || ''}`;
  const targetName = isTarget ? 'you' : (targetUser ? `${targetUser.firstName || ''} ${targetUser.lastName || ''}` : '');
  const entityLabel = activity.entityType?.replace(/_/g, ' ').charAt(0).toUpperCase() + activity.entityType?.slice(1).replace(/_/g, ' ') || 'Document';
  const docNo = metadata?.docNumber || metadata?.entityNumber || 'document';

  switch (action) {
    case 'CREATED':
    case 'STATUS_REACHED_DRAFT':
      if (isPerformer) {
        return `${entityLabel} ${docNo} created by you, waiting for verification.`;
      }
      return `${entityLabel} ${docNo} created by ${performerName}, waiting for verification by you.`;

    case 'VERIFIED':
    case 'STATUS_REACHED_VERIFIED':
      if (isPerformer) {
        return `${entityLabel} ${docNo} verified by you, waiting for approval.`;
      }
      return `${entityLabel} ${docNo} verified by ${performerName}, waiting for ${isTarget ? 'your approval' : 'approval'}.`;

    case 'APPROVED':
    case 'STATUS_REACHED_APPROVED':
      if (isPerformer) {
        return `${entityLabel} ${docNo} approved by you.`;
      }
      return `${entityLabel} ${docNo} approved by ${performerName}.`;

    case 'REJECTED':
    case 'REJECTED_MANAGER':
    case 'STATUS_REACHED_REJECTED':
      const reason = metadata?.reason ? `Reason: ${metadata.reason}.` : '';
      if (isTarget) {
        return `${entityLabel} ${docNo} rejected by ${performerName}. ${reason} Please modify and resubmit.`;
      }
      if (isPerformer) {
        return `${entityLabel} ${docNo} rejected by you. ${reason}`;
      }
      return `${entityLabel} ${docNo} rejected by ${performerName}. ${reason}`;

    case 'REJECTED_OWNER':
      const ownerReason = metadata?.reason ? `Reason: ${metadata.reason}.` : '';
      if (isTarget) {
        return `${entityLabel} ${docNo} rejected by Owner. ${ownerReason} Waiting for correction.`;
      }
      return `${entityLabel} ${docNo} rejected by Owner. ${ownerReason}`;

    default:
      return `${performerName} performed ${action} on ${activity.entityType} ${docNo}`;
  }
}
