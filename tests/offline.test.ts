import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import {
  authorizedCachedSessions,
  draftKey,
  offlineDb,
  type Draft,
  type SessionModel,
} from '../lib/offline';
describe('Offline draft storage', () => {
  it('hides cached rosters when their course/batch access or account is no longer authorized', () => {
    const actorId = crypto.randomUUID(),
      batchId = crypto.randomUUID();
    const model: SessionModel = {
      actorId,
      session: {
        id: crypto.randomUUID(),
        batchId,
        sessionDate: '2026-11-23',
        startTime: '07:00',
        endTime: '08:00',
        status: 'open',
        version: 1,
      },
      batch: { name: 'Private batch' },
      records: [],
    };
    expect(authorizedCachedSessions([model], { actorId, batchIds: [] })).toEqual([]);
    expect(
      authorizedCachedSessions([model], { actorId: crypto.randomUUID(), batchIds: [batchId] }),
    ).toEqual([]);
    expect(authorizedCachedSessions([model], { actorId, batchIds: [batchId] })).toEqual([model]);
  });
  it('does not expose rosters or drafts saved before the authorized live-data reset', async () => {
    const legacy = await openDB('aecs-attend', 1, {
      upgrade(db) {
        db.createObjectStore('sessions');
        db.createObjectStore('drafts');
      },
    });
    await legacy.put('sessions', { batch: { name: 'Deleted batch' } }, 'deleted');
    await legacy.put('drafts', { records: ['deleted'] }, 'deleted');
    const current = await offlineDb();
    expect(await current.getAll('sessions')).toEqual([]);
    expect(await current.getAll('drafts')).toEqual([]);
    legacy.close();
    current.close();
  });
  it('persists drafts across database reopen and isolates staff accounts', async () => {
    const actor = crypto.randomUUID(),
      sessionId = crypto.randomUUID();
    const key = draftKey(actor, sessionId);
    const draft: Draft = {
      key,
      actorId: actor,
      sessionId,
      operationId: crypto.randomUUID(),
      version: 1,
      records: [{ studentId: crypto.randomUUID(), status: 'present' }],
      sync: 'PENDING',
      updatedAt: Date.now(),
    };
    const db = await offlineDb();
    await db.put('drafts', draft);
    db.close();
    const reopened = await offlineDb();
    expect(await reopened.get('drafts', key)).toEqual(draft);
    expect(await reopened.get('drafts', draftKey(crypto.randomUUID(), sessionId))).toBeUndefined();
  });
  it('preserves a conflicting draft while accepting the server copy', async () => {
    const db = await offlineDb();
    const actor = crypto.randomUUID(),
      sessionId = crypto.randomUUID(),
      key = draftKey(actor, sessionId);
    const draft: Draft = {
      key,
      actorId: actor,
      sessionId,
      version: 1,
      operationId: crypto.randomUUID(),
      records: [],
      sync: 'CONFLICT',
      updatedAt: Date.now(),
    };
    await db.put('drafts', draft);
    await db.put('drafts', { ...draft, key: `${key}:preserved:1` });
    await db.put('drafts', { ...draft, version: 2, sync: 'SYNCED' });
    expect((await db.get('drafts', `${key}:preserved:1`))?.sync).toBe('CONFLICT');
    expect((await db.get('drafts', key))?.version).toBe(2);
  });
  it('stores an assigned roster for offline navigation', async () => {
    const db = await offlineDb();
    const sessionId = crypto.randomUUID(),
      actorId = crypto.randomUUID();
    const model: SessionModel = {
      actorId,
      session: {
        id: sessionId,
        batchId: crypto.randomUUID(),
        sessionDate: '2026-11-22',
        startTime: '07:00',
        endTime: '08:00',
        status: 'open',
        version: 1,
      },
      batch: { name: 'IELTS morning' },
      records: [],
    };
    await db.put('sessions', model, draftKey(actorId, sessionId));
    expect((await db.get('sessions', draftKey(actorId, sessionId)))?.batch.name).toBe(
      'IELTS morning',
    );
  });
});
