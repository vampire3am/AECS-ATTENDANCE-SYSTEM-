import { openDB, type DBSchema } from 'idb';
export type RosterRow = {
  id: string;
  studentId: string;
  fullName: string;
  studentCode: string;
  status: 'present' | 'absent' | 'late' | 'excused' | null;
};
export type SessionModel = {
  actorId: string;
  session: {
    id: string;
    batchId: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    status: string;
    version: number;
  };
  batch: { name: string };
  records: RosterRow[];
};
export type Draft = {
  key: string;
  actorId: string;
  sessionId: string;
  version: number;
  operationId: string;
  records: { studentId: string; status: NonNullable<RosterRow['status']> }[];
  sync: 'PENDING' | 'SYNCED' | 'CONFLICT';
  updatedAt: number;
};
interface OfflineDB extends DBSchema {
  sessions: { key: string; value: SessionModel };
  drafts: { key: string; value: Draft };
}
export const draftKey = (actorId: string, sessionId: string) => `${actorId}:${sessionId}`;
export function authorizedCachedSessions(
  rows: SessionModel[],
  access: { actorId: string; batchIds: string[] },
) {
  const allowed = new Set(access.batchIds);
  return rows.filter((row) => row.actorId === access.actorId && allowed.has(row.session.batchId));
}
export const offlineDb = () =>
  openDB<OfflineDB>('aecs-attend-reset-20261122', 1, {
    upgrade(db) {
      db.createObjectStore('sessions');
      db.createObjectStore('drafts', { keyPath: 'key' });
    },
  });
