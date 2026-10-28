import React, { useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Header } from '../../components/Header';
import { collaboration } from '../../services/collaboration';
import {
  CommentType,
  DrawingDoc,
  DrawingFile,
  ProjectDoc,
  RevisionStatus,
} from '../../types';

const categories: Array<DrawingDoc['category']> = [
  'architecture',
  'interior',
  'supervision',
  'structural',
  'mep',
  'other',
];

const statusLabels: Record<RevisionStatus, string> = {
  pending_review: 'Pending Review',
  under_review: 'Under Review',
  objection_raised: 'Objection Raised',
  rectification_in_progress: 'Rectification',
  rectified: 'Rectified',
  approved: 'Approved',
  auto_escalated: 'Escalated',
};

const statusVariants: Record<RevisionStatus, 'draft' | 'issued' | 'paid' | 'cancelled' | 'grace' | 'locked'> = {
  pending_review: 'draft',
  under_review: 'issued',
  objection_raised: 'locked',
  rectification_in_progress: 'grace',
  rectified: 'issued',
  approved: 'paid',
  auto_escalated: 'cancelled',
};

export const CollaborationScreen: React.FC = () => {
  const { currentParams, projects, navigateTo } = useTenant();
  const { user, role } = useAuth();
  const { showToast } = useToast();
  const showError = (message: string) => showToast(message, { type: 'error' });
  const project: ProjectDoc | undefined =
    currentParams?.project ||
    projects.find((item) => item.id === currentParams?.projectId);
  const selectedDrawingId: string | undefined = currentParams?.drawingId;
  const selectedRevisionId: string | undefined = currentParams?.revisionId;
  const [refreshKey, setRefreshKey] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DrawingDoc['category']>('architecture');
  const [files, setFiles] = useState<DrawingFile[]>([]);
  const [commentType, setCommentType] = useState<CommentType>('objection');
  const [comment, setComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | undefined>();
  const [approvalConfirmation, setApprovalConfirmation] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');

  if (!project || !user) {
    return (
      <View style={styles.container}>
        <Header title="Project collaboration" showBack onBack={() => navigateTo('projects')} />
        <Text style={styles.errorText}>Project not found or user session is unavailable.</Text>
      </View>
    );
  }

  const isClient = role === 'client';
  const canUpload = role === 'admin' || role === 'architect';
  const currentWorkspace = selectedDrawingId
    ? collaboration.getDrawingWorkspace(selectedDrawingId, user)
    : undefined;
  const drawings = collaboration.getProjectDrawings(project.id, user);
  const projectClients = collaboration.getProjectClients(project.id);

  const refresh = () => setRefreshKey((value) => value + 1);
  void refreshKey;

  const chooseFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const pickedFiles = result.assets.map((asset) => ({
        name: asset.name,
        uri: asset.uri,
        sizeBytes: asset.size || 0,
        mimeType: asset.mimeType || 'application/octet-stream',
      }));
      const unsupported = pickedFiles.find(
        (file) => !/\.(pdf|dwg|jpg|jpeg|png)$/i.test(file.name)
      );
      if (unsupported) {
        showError('Supported drawing formats are PDF, DWG, JPG, and PNG.');
        return;
      }
      if (pickedFiles.some((file) => file.sizeBytes <= 0)) {
        showError('Could not read one or more file sizes. Please choose the files again.');
        return;
      }
      if (pickedFiles.some((file) => file.sizeBytes > 25 * 1024 * 1024)) {
        showError('Each drawing file must be 25 MB or smaller.');
        return;
      }
      if (pickedFiles.some((file) => file.mimeType.startsWith('image/') && file.sizeBytes > 10 * 1024 * 1024)) {
        showError('Progress photos must be 10 MB or smaller.');
        return;
      }
      setFiles((existing) => [...existing, ...pickedFiles]);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'File picker failed.');
    }
  };

  const saveDrawing = () => {
    try {
      const drawing = collaboration.createDrawing(
        project.id,
        { title, description, category, files },
        user
      );
      setTitle('');
      setDescription('');
      setFiles([]);
      refresh();
      showToast('Drawing uploaded. Project reviewers have been notified.', { type: 'success' });
      navigateTo('collaboration', { project, drawingId: drawing.id });
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Drawing upload failed.');
    }
  };

  const uploadRevision = async () => {
    if (!currentWorkspace) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const pickedFiles: DrawingFile[] = result.assets.map((asset) => ({
        name: asset.name,
        uri: asset.uri,
        sizeBytes: asset.size || 0,
        mimeType: asset.mimeType || 'application/octet-stream',
      }));
      if (pickedFiles.some((file) => !/\.(pdf|dwg|jpg|jpeg|png)$/i.test(file.name))) {
        throw new Error('Supported drawing formats are PDF, DWG, JPG, and PNG.');
      }
      collaboration.uploadRevision(currentWorkspace.drawing.id, pickedFiles, user);
      refresh();
      showToast('New revision uploaded. Project reviewers have been notified.', { type: 'success' });
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Revision upload failed.');
    }
  };

  const submitComment = () => {
    if (!currentWorkspace) return;
    try {
      const revision = currentWorkspace.revisions.find(
        (item) => item.id === (selectedRevisionId || currentWorkspace.drawing.currentRevisionId)
      );
      if (!revision) throw new Error('Selected revision not found.');
      collaboration.addComment(
        currentWorkspace.drawing.id,
        revision.id,
        commentType,
        comment,
        user,
        replyTo
      );
      setComment('');
      setReplyTo(undefined);
      refresh();
      showToast('Comment added to the drawing thread.', { type: 'success' });
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Comment could not be added.');
    }
  };

  const inviteClient = () => {
    try {
      collaboration.inviteClient(project.id, clientName, clientEmail, clientPhone, user);
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      refresh();
      showToast('Project invitation created.', { type: 'success' });
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Invitation could not be created.');
    }
  };

  const approve = () => {
    if (!currentWorkspace) return;
    setApprovalConfirmation(true);
  };

  const confirmApproval = () => {
    if (!currentWorkspace) return;
    try {
      collaboration.approveRevision(
        currentWorkspace.drawing.id,
        currentWorkspace.drawing.currentRevisionId,
        user
      );
      setApprovalConfirmation(false);
      refresh();
      showToast('Revision approved and locked.', { type: 'success' });
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Approval failed.');
    }
  };

  const openDrawingFile = async (uri: string) => {
    try {
      await Linking.openURL(uri);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not open this file.');
    }
  };

  if (currentWorkspace) {
    const { drawing, revisions, comments, events } = currentWorkspace;
    const latestRevision = revisions.find((item) => item.id === drawing.currentRevisionId);
    const revision = revisions.find((item) => item.id === selectedRevisionId) || latestRevision;
    if (!revision) {
      return <Text style={styles.errorText}>No revision is available for this drawing.</Text>;
    }
    const isLatestRevision = revision.id === drawing.currentRevisionId;
    const revisionComments = comments.filter((item) => item.revisionId === revision.id);
    const openObjections = comments.filter(
      (item) => item.revisionId === revision.id && item.type === 'objection' && item.status === 'open'
    );

    return (
      <View style={styles.container}>
        <Header
          title={drawing.title}
          subtitle={`${project.name} · R${revision.revisionNumber}`}
          showBack
          onBack={() => navigateTo('collaboration', { project })}
        />
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>{isLatestRevision ? 'Current revision' : 'Revision history item'}</Text>
              <Badge label={statusLabels[revision.status]} variant={statusVariants[revision.status]} />
            </View>
            <Text style={styles.mutedText}>
              {drawing.category.toUpperCase()} · Uploaded {new Date(revision.uploadedAt).toLocaleString()}
            </Text>
            {revision.firstOpenedByClientAt && (
              <Text style={styles.seenText}>Seen by client · {new Date(revision.firstOpenedByClientAt).toLocaleString()}</Text>
            )}
            {drawing.description && <Text style={styles.description}>{drawing.description}</Text>}
            {revision.files.map((file) => (
              <TouchableOpacity
                key={`${revision.id}-${file.name}`}
                style={styles.fileRow}
                onPress={() => openDrawingFile(file.uri)}
              >
                <Text style={styles.fileIcon}>📄</Text>
                <View style={styles.fileText}>
                  <Text style={styles.fileName}>{file.name}</Text>
                  <Text style={styles.mutedText}>{(file.sizeBytes / 1024 / 1024).toFixed(2)} MB · Tap to open</Text>
                </View>
              </TouchableOpacity>
            ))}
            {isClient &&
              isLatestRevision &&
              ['pending_review', 'under_review', 'objection_raised', 'auto_escalated'].includes(revision.status) && (
              <Button
                title="Approve latest revision"
                onPress={approve}
                disabled={openObjections.length > 0}
                style={styles.actionButton}
              />
            )}
            {canUpload && isLatestRevision && (
              <Button
                title="Upload rectified revision"
                onPress={uploadRevision}
                variant="outline"
                style={styles.actionButton}
              />
            )}
            {openObjections.length > 0 && (
              <Text style={styles.warningText}>
                Resolve {openObjections.length} open objection{openObjections.length === 1 ? '' : 's'} before approval.
              </Text>
            )}
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Revision history</Text>
            {revisions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.historyRow}
                onPress={() => navigateTo('collaboration', { project, drawingId: drawing.id, revisionId: item.id })}
              >
                <Text style={styles.historyTitle}>R{item.revisionNumber}</Text>
                <Text style={styles.mutedText}>{new Date(item.uploadedAt).toLocaleDateString()}</Text>
                <Badge label={statusLabels[item.status]} variant={statusVariants[item.status]} />
              </TouchableOpacity>
            ))}
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Status activity log</Text>
            {events
              .filter((event) => event.revisionId === revision.id)
              .map((event) => (
                <View key={event.id} style={styles.eventRow}>
                  <View style={styles.eventMarker} />
                  <View style={styles.eventContent}>
                    <Text style={styles.commentAuthor}>
                      {event.fromStatus ? `${statusLabels[event.fromStatus]} → ` : ''}
                      {statusLabels[event.toStatus]}
                    </Text>
                    <Text style={styles.mutedText}>
                      {event.actorRole.toUpperCase()} · {new Date(event.at).toLocaleString()}
                    </Text>
                    {event.note && <Text style={styles.eventNote}>{event.note}</Text>}
                  </View>
                </View>
              ))}
            {events.filter((event) => event.revisionId === revision.id).length === 0 && (
              <Text style={styles.mutedText}>No status changes recorded.</Text>
            )}
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Comments and objections</Text>
            {revisionComments.map((item) => (
              <View key={item.id} style={[styles.comment, item.parentCommentId && styles.threadReply]}>
                <View style={styles.rowBetween}>
                  <Text style={styles.commentAuthor}>{item.authorName}</Text>
                  <Text style={styles.commentType}>{item.type.replace('_', ' ').toUpperCase()}</Text>
                </View>
                <Text style={styles.commentBody}>{item.body}</Text>
                <Text style={styles.mutedText}>
                  R{revisions.find((rev) => rev.id === item.revisionId)?.revisionNumber ?? '?'} · {new Date(item.createdAt).toLocaleString()}
                  {item.status === 'resolved' ? ' · Resolved' : ''}
                </Text>
                {revision.status !== 'approved' && role !== 'viewer' && (
                  <TouchableOpacity
                    onPress={() => {
                      setReplyTo(item.id);
                      setCommentType('reply');
                    }}
                  >
                    <Text style={styles.resolveLink}>Reply</Text>
                  </TouchableOpacity>
                )}
                {canUpload && item.type === 'objection' && item.status === 'open' && (
                  <TouchableOpacity
                    onPress={() => {
                      try {
                        collaboration.resolveComment(item.id, user);
                        refresh();
                        showToast('Objection marked resolved.', { type: 'success' });
                      } catch (error) {
                        showError(error instanceof Error ? error.message : 'Could not resolve objection.');
                      }
                    }}
                  >
                    <Text style={styles.resolveLink}>Mark resolved</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {revisionComments.length === 0 && <Text style={styles.mutedText}>No comments on this revision yet.</Text>}

            {isLatestRevision && revision.status !== 'approved' && role !== 'viewer' && (
              <View style={styles.commentComposer}>
                {replyTo && <Text style={styles.replyingText}>Replying to a comment · <Text onPress={() => { setReplyTo(undefined); setCommentType(isClient ? 'objection' : 'reply'); }}>Cancel</Text></Text>}
                <View style={styles.typeRow}>
                  {(isClient
                    ? (['objection', 'question', 'approval_note'] as CommentType[])
                    : (['reply', 'question'] as CommentType[])
                  ).map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.typeChip, commentType === type && styles.typeChipSelected]}
                      onPress={() => setCommentType(type)}
                    >
                      <Text style={[styles.typeChipText, commentType === type && styles.typeChipTextSelected]}>
                        {type.replace('_', ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Write a comment about this revision..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  style={styles.textArea}
                />
                <Button title="Send comment" onPress={submitComment} disabled={!comment.trim()} />
              </View>
            )}
          </Card>
        </ScrollView>
        {approvalConfirmation && (
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Approve this revision?</Text>
              <Text style={styles.mutedText}>
                Approval is final for this revision and locks its comments.
              </Text>
              <View style={styles.confirmActions}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setApprovalConfirmation(false)}
                  style={styles.confirmButton}
                />
                <Button
                  title="Approve"
                  onPress={confirmApproval}
                  style={styles.confirmButton}
                />
              </View>
            </View>
          </View>
        )}
      </View>
    );
  }

  const pendingInvite = isClient
    ? projectClients.find(
        (client) =>
          client.email.toLowerCase() === user.email.toLowerCase() &&
          client.inviteStatus === 'invited'
      )
    : undefined;

  return (
    <View style={styles.container}>
      <Header
        title="Drawings & reviews"
        subtitle={`Project ID: ${project.id}`}
        showBack
        onBack={() => navigateTo('project_detail', { project })}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {pendingInvite && (
          <Card>
            <Text style={styles.sectionTitle}>Project invitation</Text>
            <Text style={styles.mutedText}>You have been invited to review drawings for {project.name}.</Text>
            <Button
              title="Accept invitation"
              onPress={() => {
                try {
                  collaboration.acceptProjectInvite(project.id, user);
                  refresh();
                  showToast('Project access accepted.', { type: 'success' });
                } catch (error) {
                  showError(error instanceof Error ? error.message : 'Could not accept invitation.');
                }
              }}
              style={styles.actionButton}
            />
          </Card>
        )}

        {!isClient && role === 'admin' && (
          <Card>
            <Text style={styles.sectionTitle}>Project client reviewers</Text>
            <Text style={styles.mutedText}>Clients only get access to this project, not company invoices.</Text>
            {projectClients.map((client) => (
              <View key={client.id} style={styles.historyRow}>
                <View>
                  <Text style={styles.commentAuthor}>{client.name}</Text>
                  <Text style={styles.mutedText}>{client.email}</Text>
                </View>
                <Badge label={client.inviteStatus} variant={client.inviteStatus === 'accepted' ? 'paid' : 'active'} />
              </View>
            ))}
            <TextInput value={clientName} onChangeText={setClientName} placeholder="Client name" style={styles.input} />
            <TextInput value={clientEmail} onChangeText={setClientEmail} placeholder="Client email" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
            <TextInput value={clientPhone} onChangeText={setClientPhone} placeholder="Phone (optional)" keyboardType="phone-pad" style={styles.input} />
            <Button title="Invite client to this project" onPress={inviteClient} disabled={!clientName.trim() || !clientEmail.trim()} />
          </Card>
        )}

        {canUpload && (
          <Card>
            <Text style={styles.sectionTitle}>Upload a drawing or progress update</Text>
            <Text style={styles.mutedText}>PDF, DWG, JPG, or PNG · 25 MB per file · 100 MB per drawing set</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Drawing title" style={styles.input} />
            <View style={styles.typeRow}>
              {categories.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.typeChip, category === item && styles.typeChipSelected]}
                  onPress={() => setCategory(item)}
                >
                  <Text style={[styles.typeChipText, category === item && styles.typeChipTextSelected]}>
                    {item.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Description (optional)"
              multiline
              style={styles.textArea}
            />
            <Button title={files.length ? `Add files (${files.length})` : 'Choose drawing files'} onPress={chooseFiles} variant="outline" style={styles.actionButton} />
            {files.map((file, index) => (
              <View key={`${file.name}-${index}`} style={styles.historyRow}>
                <Text style={styles.fileName}>{file.name}</Text>
                <TouchableOpacity onPress={() => setFiles((existing) => existing.filter((_, i) => i !== index))}>
                  <Text style={styles.removeLink}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
            <Button title="Upload drawing" onPress={saveDrawing} disabled={!title.trim() || files.length === 0} />
          </Card>
        )}

        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Project drawings</Text>
            <Text style={styles.mutedText}>{drawings.length} total</Text>
          </View>
          {drawings.map((drawing) => {
            const workspace = collaboration.getDrawingWorkspace(drawing.id, user, false);
            const revision = workspace.revisions.find((item) => item.id === drawing.currentRevisionId);
            return (
              <TouchableOpacity
                key={drawing.id}
                style={styles.drawingRow}
                onPress={() => navigateTo('collaboration', { project, drawingId: drawing.id })}
              >
                <View style={styles.drawingIcon}><Text>📐</Text></View>
                <View style={styles.drawingText}>
                  <Text style={styles.drawingTitle}>{drawing.title}</Text>
                  <Text style={styles.mutedText}>{drawing.category.toUpperCase()} · R{revision?.revisionNumber ?? 1}</Text>
                </View>
                {revision && (
                  <Badge label={statusLabels[revision.status]} variant={statusVariants[revision.status]} />
                )}
              </TouchableOpacity>
            );
          })}
          {drawings.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📄</Text>
              <Text style={styles.emptyTitle}>No drawings uploaded yet</Text>
              <Text style={styles.mutedText}>
                {isClient ? 'New project drawings will appear here for your review.' : 'Upload the first drawing to start client review.'}
              </Text>
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 18, width: '100%', maxWidth: 980, alignSelf: 'center', gap: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  mutedText: { fontSize: 12, color: '#64748b', marginTop: 3 },
  description: { color: '#334155', fontSize: 14, marginTop: 12, lineHeight: 20 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  actionButton: { marginTop: 12 },
  fileRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  fileIcon: { fontSize: 22, marginRight: 10 },
  fileText: { flex: 1 },
  fileName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  seenText: { color: '#2563eb', fontSize: 12, fontWeight: '700', marginTop: 8 },
  warningText: { color: '#b45309', fontSize: 12, marginTop: 10 },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  historyTitle: { width: 36, fontSize: 13, fontWeight: '800', color: '#0f172a' },
  eventRow: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  eventMarker: { width: 9, height: 9, borderRadius: 5, marginTop: 4, backgroundColor: '#3b82f6' },
  eventContent: { flex: 1 },
  eventNote: { color: '#475569', fontSize: 12, marginTop: 4 },
  comment: { borderLeftWidth: 3, borderLeftColor: '#cbd5e1', paddingLeft: 12, paddingVertical: 10, marginTop: 8 },
  threadReply: { marginLeft: 18, borderLeftColor: '#93c5fd' },
  replyingText: { color: '#475569', fontSize: 12, marginBottom: 8 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  commentType: { fontSize: 10, fontWeight: '800', color: '#64748b' },
  commentBody: { color: '#334155', fontSize: 14, lineHeight: 20, marginVertical: 5 },
  resolveLink: { color: '#2563eb', fontSize: 12, fontWeight: '700', marginTop: 8 },
  commentComposer: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginVertical: 8 },
  typeChip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7 },
  typeChipSelected: { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' },
  typeChipText: { fontSize: 10, color: '#475569', fontWeight: '700', textTransform: 'capitalize' },
  typeChipTextSelected: { color: '#1d4ed8' },
  textArea: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 11, minHeight: 78, textAlignVertical: 'top', color: '#0f172a', marginBottom: 10 },
  input: { height: 44, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, marginTop: 9, color: '#0f172a' },
  drawingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  drawingIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  drawingText: { flex: 1 },
  drawingTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  empty: { alignItems: 'center', padding: 24 },
  emptyIcon: { fontSize: 30, marginBottom: 7 },
  emptyTitle: { color: '#0f172a', fontWeight: '700', marginBottom: 4 },
  removeLink: { color: '#dc2626', fontSize: 12, fontWeight: '700' },
  errorText: { margin: 20, color: '#b91c1c' },
  confirmOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, backgroundColor: 'rgba(15, 23, 42, 0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  confirmCard: { width: '100%', maxWidth: 420, borderRadius: 14, backgroundColor: '#ffffff', padding: 20 },
  confirmTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  confirmButton: { minWidth: 100 },
});
