import {
  CollaborationNotification,
  CommentType,
  DrawingComment,
  DrawingDoc,
  DrawingFile,
  DrawingRevision,
  ProjectClientDoc,
  RevisionEvent,
  RevisionStatus,
  UserDoc,
} from '../types';

interface CollaborationData {
  clients: ProjectClientDoc[];
  drawings: DrawingDoc[];
  revisions: DrawingRevision[];
  comments: DrawingComment[];
  events: RevisionEvent[];
  notifications: CollaborationNotification[];
}

const STORAGE_KEY = '@arch_collaboration';
const DEMO_CLIENT_EMAIL = 'demo_client@archstudio.com';
const DEMO_CLIENT_UID = 'demo-client-user';
const DEMO_ARCHITECT_EMAIL = 'shadab@archstudio.com';
const memoryCache: Record<string, string> = {};

const emptyData = (): CollaborationData => ({
  clients: [
    {
      id: 'demo-client-project-001',
      projectId: 'proj-001',
      name: 'Malik Tariq',
      email: DEMO_CLIENT_EMAIL,
      inviteStatus: 'accepted',
      invitedBy: 'user-shadab-001',
      invitedAt: '2025-02-01T00:00:00.000Z',
      acceptedAt: '2025-02-02T00:00:00.000Z',
    },
  ],
  drawings: [],
  revisions: [],
  comments: [],
  events: [],
  notifications: [],
});

function readData(): CollaborationData {
  let raw: string | null = memoryCache[STORAGE_KEY] || null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      raw = window.localStorage.getItem(STORAGE_KEY) || raw;
    }
  } catch {
    // Continue with the in-memory cache on platforms without localStorage.
  }
  if (!raw) return emptyData();
  try {
    return { ...emptyData(), ...JSON.parse(raw) } as CollaborationData;
  } catch {
    return emptyData();
  }
}

function writeData(data: CollaborationData): void {
  const raw = JSON.stringify(data);
  memoryCache[STORAGE_KEY] = raw;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, raw);
    }
  } catch {
    // The feature remains usable for the current session on storage-limited browsers.
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function deepLink(projectId: string, drawingId?: string, revisionId?: string): string {
  if (!drawingId || !revisionId) return `archinvoice://project/${projectId}`;
  return `archinvoice://project/${projectId}/drawing/${drawingId}/rev/${revisionId}`;
}

function notify(
  data: CollaborationData,
  recipients: string[],
  event: Omit<CollaborationNotification, 'id' | 'recipientEmail' | 'read' | 'createdAt'>
): void {
  const now = new Date().toISOString();
  recipients.forEach((email) => {
    data.notifications.unshift({
      ...event,
      id: makeId('notification'),
      recipientEmail: email.toLowerCase(),
      read: false,
      createdAt: now,
    });
  });
}

function userRole(user: UserDoc): 'client' | 'architect' | 'admin' {
  if (user.role === 'client') return 'client';
  return user.role === 'admin' ? 'admin' : 'architect';
}

function requireProjectClient(data: CollaborationData, projectId: string, user: UserDoc): ProjectClientDoc {
  const client = data.clients.find(
    (item) => item.projectId === projectId && item.email.toLowerCase() === user.email.toLowerCase()
  );
  if (!client || client.inviteStatus !== 'accepted') {
    throw new Error('You do not have access to this project.');
  }
  return client;
}

function requireDrawing(data: CollaborationData, drawingId: string): DrawingDoc {
  const drawing = data.drawings.find((item) => item.id === drawingId);
  if (!drawing) throw new Error('Drawing not found.');
  return drawing;
}

function requireRevision(data: CollaborationData, revisionId: string): DrawingRevision {
  const revision = data.revisions.find((item) => item.id === revisionId);
  if (!revision) throw new Error('Revision not found.');
  return revision;
}

const allowedTransitions: Record<RevisionStatus, RevisionStatus[]> = {
  pending_review: ['under_review', 'auto_escalated'],
  under_review: ['objection_raised', 'approved'],
  objection_raised: ['rectification_in_progress', 'approved'],
  rectification_in_progress: ['rectified'],
  rectified: ['pending_review'],
  approved: [],
  auto_escalated: ['under_review', 'objection_raised', 'approved'],
};

function transition(
  data: CollaborationData,
  revision: DrawingRevision,
  next: RevisionStatus,
  actor: UserDoc,
  note?: string
): void {
  if (!allowedTransitions[revision.status].includes(next)) {
    throw new Error(`Cannot change revision from ${revision.status} to ${next}.`);
  }
  data.events.push({
    id: makeId('event'),
    revisionId: revision.id,
    fromStatus: revision.status,
    toStatus: next,
    actorUid: actor.uid,
    actorRole: userRole(actor),
    note,
    at: new Date().toISOString(),
  });
  revision.status = next;
}

function recordInitialStatus(data: CollaborationData, revision: DrawingRevision, actor: UserDoc): void {
  data.events.push({
    id: makeId('event'),
    revisionId: revision.id,
    fromStatus: null,
    toStatus: revision.status,
    actorUid: actor.uid,
    actorRole: userRole(actor),
    note: 'Revision uploaded',
    at: revision.uploadedAt,
  });
}

function validateFiles(files: DrawingFile[]): void {
  if (files.length === 0) throw new Error('Choose at least one drawing or progress file.');
  if (files.some((file) => !file.name || !file.uri || file.sizeBytes <= 0)) {
    throw new Error('One or more selected files are invalid.');
  }
  if (files.some((file) => file.sizeBytes > 25 * 1024 * 1024)) {
    throw new Error('Each drawing file must be 25 MB or smaller.');
  }
  if (files.some((file) => file.mimeType.startsWith('image/') && file.sizeBytes > 10 * 1024 * 1024)) {
    throw new Error('Progress photos must be 10 MB or smaller.');
  }
  if (files.reduce((total, file) => total + file.sizeBytes, 0) > 100 * 1024 * 1024) {
    throw new Error('A drawing set cannot exceed 100 MB.');
  }
}

export const collaboration = {
  getProjectClients(projectId: string): ProjectClientDoc[] {
    return readData().clients.filter((client) => client.projectId === projectId);
  },

  getClientProjectIds(email: string): string[] {
    return readData().clients
      .filter(
        (client) =>
          client.email.toLowerCase() === email.toLowerCase() &&
          client.inviteStatus !== 'revoked'
      )
      .map((client) => client.projectId);
  },

  getClientAccount(email: string): ProjectClientDoc | undefined {
    return readData().clients.find(
      (client) =>
        client.email.toLowerCase() === email.toLowerCase() &&
        client.inviteStatus !== 'revoked'
    );
  },

  acceptProjectInvite(projectId: string, user: UserDoc): void {
    if (user.role !== 'client') throw new Error('Sign in with the invited client account to accept this project.');
    const data = readData();
    const invite = data.clients.find(
      (client) =>
        client.projectId === projectId &&
        client.email.toLowerCase() === user.email.toLowerCase() &&
        client.inviteStatus === 'invited'
    );
    if (!invite) throw new Error('No pending project invitation was found for this account.');
    invite.inviteStatus = 'accepted';
    invite.acceptedAt = new Date().toISOString();
    writeData(data);
  },

  inviteClient(projectId: string, name: string, email: string, phone: string | undefined, user: UserDoc): ProjectClientDoc {
    if (user.role !== 'admin') throw new Error('Only firm admins can invite project clients.');
    const cleanEmail = email.trim().toLowerCase();
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Enter a client name and a valid email address.');
    }
    const data = readData();
    const existing = data.clients.find(
      (client) => client.projectId === projectId && client.email.toLowerCase() === cleanEmail
    );
    if (existing && existing.inviteStatus !== 'revoked') {
      throw new Error('This client is already invited to the project.');
    }
    const client: ProjectClientDoc = {
      id: makeId('client'),
      projectId,
      name: name.trim(),
      email: cleanEmail,
      phone: phone?.trim() || undefined,
      inviteStatus: 'invited',
      invitedBy: user.uid,
      invitedAt: new Date().toISOString(),
    };
    data.clients.push(client);
    notify(data, [cleanEmail], {
      type: 'invite',
      projectId,
      title: 'Project invitation',
      body: `You have been invited to review project ${projectId}. Sign in to accept.`,
      deepLink: deepLink(projectId),
    });
    writeData(data);
    return client;
  },

  getProjectDrawings(projectId: string, user: UserDoc): DrawingDoc[] {
    const data = readData();
    if (user.role === 'client') {
      const membership = data.clients.find(
        (client) =>
          client.projectId === projectId &&
          client.email.toLowerCase() === user.email.toLowerCase() &&
          client.inviteStatus !== 'revoked'
      );
      if (!membership) throw new Error('You do not have access to this project.');
      if (membership.inviteStatus !== 'accepted') return [];
    }
    return data.drawings
      .filter((drawing) => drawing.projectId === projectId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  getDrawingWorkspace(drawingId: string, user: UserDoc, markOpened = true): {
    drawing: DrawingDoc;
    revisions: DrawingRevision[];
    comments: DrawingComment[];
    events: RevisionEvent[];
  } {
    const data = readData();
    const drawing = requireDrawing(data, drawingId);
    if (user.role === 'client') requireProjectClient(data, drawing.projectId, user);
    const revisions = data.revisions
      .filter((revision) => revision.drawingId === drawingId)
      .sort((a, b) => b.revisionNumber - a.revisionNumber);
    const currentRevision = revisions.find((item) => item.id === drawing.currentRevisionId);
    if (markOpened && user.role === 'client' && currentRevision?.status === 'pending_review') {
      transition(data, currentRevision, 'under_review', user, 'Client opened revision');
      currentRevision.firstOpenedByClientAt = new Date().toISOString();
      writeData(data);
    }
    return {
      drawing,
      revisions,
      comments: data.comments
        .filter((comment) => comment.drawingId === drawingId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      events: data.events
        .filter((event) => revisions.some((revision) => revision.id === event.revisionId))
        .sort((a, b) => a.at.localeCompare(b.at)),
    };
  },

  createDrawing(
    projectId: string,
    input: { title: string; category: DrawingDoc['category']; description?: string; files: DrawingFile[] },
    user: UserDoc
  ): DrawingDoc {
    if (user.role === 'client' || user.role === 'viewer') {
      throw new Error('Only project architects and admins can upload drawings.');
    }
    if (!input.title.trim()) throw new Error('Drawing title is required.');
    validateFiles(input.files);
    const data = readData();
    const now = new Date().toISOString();
    const drawingId = makeId('drawing');
    const revisionId = makeId('revision');
    const drawing: DrawingDoc = {
      id: drawingId,
      projectId,
      title: input.title.trim(),
      category: input.category,
      description: input.description?.trim() || undefined,
      currentRevisionId: revisionId,
      currentRevisionNumber: 1,
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    };
    const revision: DrawingRevision = {
      id: revisionId,
      drawingId,
      revisionNumber: 1,
      files: input.files,
      status: 'pending_review',
      uploadedBy: user.uid,
      uploadedAt: now,
    };
    data.drawings.push(drawing);
    data.revisions.push(revision);
    recordInitialStatus(data, revision, user);
    const clientEmails = data.clients
      .filter((client) => client.projectId === projectId && client.inviteStatus === 'accepted')
      .map((client) => client.email);
    notify(data, clientEmails, {
      type: 'drawing_uploaded',
      projectId,
      drawingId,
      revisionId,
      title: `Drawing uploaded — ${input.title}`,
      body: `${input.title} R1 is ready for your review.`,
      deepLink: deepLink(projectId, drawingId, revisionId),
    });
    writeData(data);
    return drawing;
  },

  uploadRevision(
    drawingId: string,
    files: DrawingFile[],
    user: UserDoc
  ): DrawingRevision {
    if (user.role === 'client' || user.role === 'viewer') {
      throw new Error('Only project architects and admins can upload revisions.');
    }
    validateFiles(files);
    const data = readData();
    const drawing = requireDrawing(data, drawingId);
    const current = requireRevision(data, drawing.currentRevisionId);
    if (!['objection_raised', 'rectification_in_progress', 'approved', 'auto_escalated'].includes(current.status)) {
      throw new Error('The current revision must be reviewed or approved before you can upload a revision.');
    }
    const now = new Date().toISOString();
    const revision: DrawingRevision = {
      id: makeId('revision'),
      drawingId,
      revisionNumber: drawing.currentRevisionNumber + 1,
      files,
      status: 'pending_review',
      uploadedBy: user.uid,
      uploadedAt: now,
    };
    data.revisions.push(revision);
    recordInitialStatus(data, revision, user);
    drawing.currentRevisionId = revision.id;
    drawing.currentRevisionNumber = revision.revisionNumber;
    drawing.updatedAt = now;
    data.comments
      .filter(
        (comment) =>
          comment.drawingId === drawingId &&
          comment.revisionId === current.id &&
          comment.type === 'objection' &&
          comment.status === 'open'
      )
      .forEach((comment) => {
        comment.status = 'resolved';
      });
    const recipients = data.clients
      .filter((client) => client.projectId === drawing.projectId && client.inviteStatus === 'accepted')
      .map((client) => client.email);
    notify(data, recipients, {
      type: 'drawing_uploaded',
      projectId: drawing.projectId,
      drawingId,
      revisionId: revision.id,
      title: `Revision R${revision.revisionNumber} uploaded — ${drawing.title}`,
      body: `${drawing.title} R${revision.revisionNumber} is ready for your review.`,
      deepLink: deepLink(drawing.projectId, drawingId, revision.id),
    });
    writeData(data);
    return revision;
  },

  addComment(
    drawingId: string,
    revisionId: string,
    type: CommentType,
    body: string,
    user: UserDoc,
    parentCommentId?: string
  ): DrawingComment {
    const cleanBody = body.trim();
    if (!cleanBody) throw new Error('Write a comment before sending.');
    const data = readData();
    const drawing = requireDrawing(data, drawingId);
    const revision = requireRevision(data, revisionId);
    if (user.role === 'viewer') throw new Error('View-only users cannot comment.');
    if (revision.status === 'approved') throw new Error('Approved revisions are locked for comments.');
    if (user.role === 'client') requireProjectClient(data, drawing.projectId, user);
    if (type === 'objection' && user.role !== 'client') {
      throw new Error('Only project clients can raise objections.');
    }
    const comment: DrawingComment = {
      id: makeId('comment'),
      drawingId,
      revisionId,
      authorUid: user.uid,
      authorName: user.displayName,
      authorEmail: user.email,
      authorRole: userRole(user),
      type,
      body: cleanBody,
      status: 'open',
      parentCommentId,
      createdAt: new Date().toISOString(),
    };
    data.comments.push(comment);
    if (type === 'objection' && revision.status !== 'objection_raised') {
      transition(data, revision, 'objection_raised', user, 'Client raised an objection');
    }
    const recipientEmails =
      user.role === 'client'
        ? [DEMO_ARCHITECT_EMAIL]
        : data.clients
            .filter((client) => client.projectId === drawing.projectId && client.inviteStatus === 'accepted')
            .map((client) => client.email);
    notify(data, recipientEmails, {
      type: 'comment_added',
      projectId: drawing.projectId,
      drawingId,
      revisionId,
      title: `${type === 'objection' ? 'Client objection' : 'New comment'} — ${drawing.title}`,
      body: cleanBody,
      deepLink: deepLink(drawing.projectId, drawingId, revisionId),
    });
    writeData(data);
    return comment;
  },

  resolveComment(commentId: string, user: UserDoc): void {
    if (user.role === 'client' || user.role === 'viewer') {
      throw new Error('Only architects and admins can resolve comments.');
    }
    const data = readData();
    const comment = data.comments.find((item) => item.id === commentId);
    if (!comment) throw new Error('Comment not found.');
    if (comment.type !== 'objection' || comment.status !== 'open') {
      throw new Error('Only open objections can be marked resolved.');
    }
    comment.status = 'resolved';
    const revision = requireRevision(data, comment.revisionId);
    const unresolved = data.comments.some(
      (item) =>
        item.revisionId === revision.id &&
        item.type === 'objection' &&
        item.status === 'open'
    );
    if (!unresolved && revision.status === 'objection_raised') {
      transition(data, revision, 'rectification_in_progress', user, 'All objections resolved');
    }
    writeData(data);
  },

  approveRevision(drawingId: string, revisionId: string, user: UserDoc): void {
    if (user.role !== 'client') throw new Error('Only a project client can approve a drawing.');
    const data = readData();
    const drawing = requireDrawing(data, drawingId);
    requireProjectClient(data, drawing.projectId, user);
    const revision = requireRevision(data, revisionId);
    if (revision.id !== drawing.currentRevisionId) {
      throw new Error('Only the latest revision can be approved.');
    }
    const hasOpenObjections = data.comments.some(
      (comment) =>
        comment.revisionId === revisionId &&
        comment.type === 'objection' &&
        comment.status === 'open'
    );
    if (hasOpenObjections) throw new Error('Resolve or withdraw open objections before approving.');
    transition(data, revision, 'approved', user, 'Approved by client');
    revision.approvedAt = new Date().toISOString();
    revision.approvedBy = user.uid;
    drawing.updatedAt = revision.approvedAt;
    notify(data, [DEMO_ARCHITECT_EMAIL], {
      type: 'approved',
      projectId: drawing.projectId,
      drawingId,
      revisionId,
      title: `Drawing approved — ${drawing.title}`,
      body: `${drawing.title} R${revision.revisionNumber} was approved by ${user.displayName}.`,
      deepLink: deepLink(drawing.projectId, drawingId, revisionId),
    });
    writeData(data);
  },

  getNotifications(email: string): CollaborationNotification[] {
    return readData().notifications
      .filter((item) => item.recipientEmail === email.toLowerCase())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  markNotificationRead(notificationId: string, email: string): void {
    const data = readData();
    const notification = data.notifications.find(
      (item) => item.id === notificationId && item.recipientEmail === email.toLowerCase()
    );
    if (!notification) throw new Error('Notification not found.');
    notification.read = true;
    writeData(data);
  },

};
