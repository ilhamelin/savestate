import 'server-only';
import { serverClient } from '@/integrations/supabase/server';
import { dbCheck } from '@/lib/http';
import { badgeOrder } from '@/domain/badges';

export async function playerBadges(userId: string) {
  const db = await serverClient();
  const [catalogue, earned] = await Promise.all([
    db.from('badges').select('*').limit(100),
    db.from('user_badges').select('*').eq('user_id', userId).limit(100),
  ]);
  dbCheck(catalogue.error);
  dbCheck(earned.error);
  return {
    catalogue: (catalogue.data ?? []).sort(
      (a, b) => badgeOrder(a.id) - badgeOrder(b.id) || a.id.localeCompare(b.id),
    ),
    earned: earned.data ?? [],
  };
}
