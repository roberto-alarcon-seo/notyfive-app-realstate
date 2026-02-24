import { useFollowups } from './useFollowups';

export function useFollowupBadgeCount() {
  const { data: followups } = useFollowups();

  if (!followups) return 0;

  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return followups.filter(f => new Date(f.due_at) <= endOfToday).length;
}
