import { useConversations } from './useConversations';

export function useTotalUnreadCount() {
  const { data: conversations } = useConversations();
  
  const totalUnread = conversations?.reduce((acc, conv) => acc + (conv.unread_count || 0), 0) || 0;
  
  return totalUnread;
}
