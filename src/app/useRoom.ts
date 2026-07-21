import { useEffect, useMemo, useState } from 'react';
import {
  readServerOffset,
  subscribeMeta,
  subscribePlayers,
  subscribeResult,
  subscribeSecret,
} from '../firebase/rooms';
import type { PlayerSecret, PublicResult, RoomMeta, RoomPlayer } from '../firebase/rooms';

export interface RoomState {
  meta: RoomMeta | null;
  players: Record<string, RoomPlayer>;
  secret: PlayerSecret | null;
  result: PublicResult | null;
  /** Diferença entre o relógio do servidor e o local, em ms. */
  serverOffset: number;
  loading: boolean;
}

/** Assina tudo o que a sala precisa e mantém o estado sincronizado. */
export function useRoom(code: string, uid: string | null): RoomState {
  const [meta, setMeta] = useState<RoomMeta | null>(null);
  const [players, setPlayers] = useState<Record<string, RoomPlayer>>({});
  const [secret, setSecret] = useState<PlayerSecret | null>(null);
  const [result, setResult] = useState<PublicResult | null>(null);
  const [serverOffset, setServerOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    const unsubscribeMeta = subscribeMeta(code, (value) => {
      setMeta(value);
      setLoading(false);
    });
    const unsubscribePlayers = subscribePlayers(code, setPlayers);
    const unsubscribeResult = subscribeResult(code, setResult);
    return () => {
      unsubscribeMeta();
      unsubscribePlayers();
      unsubscribeResult();
    };
  }, [code]);

  useEffect(() => {
    if (!code || !uid) return;
    return subscribeSecret(code, uid, setSecret);
  }, [code, uid]);

  useEffect(() => {
    let active = true;
    void readServerOffset().then((offset) => {
      if (active) setServerOffset(offset);
    });
    return () => {
      active = false;
    };
  }, []);

  return useMemo(
    () => ({ meta, players, secret, result, serverOffset, loading }),
    [meta, players, secret, result, serverOffset, loading],
  );
}

/** Lista ordenada por entrada, estável entre aparelhos. */
export function sortPlayers(players: Record<string, RoomPlayer>): [string, RoomPlayer][] {
  return Object.entries(players).sort(
    (a, b) => (a[1].joinedAt ?? 0) - (b[1].joinedAt ?? 0) || a[0].localeCompare(b[0]),
  );
}
