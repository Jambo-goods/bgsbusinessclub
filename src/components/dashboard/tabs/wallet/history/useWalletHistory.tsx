
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
  receipt_confirmed?: boolean;
}

export interface CombinedHistoryItem {
  id: string;
  date: Date;
  formattedDate: string;
  amount: number;
  description: string;
  status: string;
  type: string;
  source: 'transaction' | 'notification';
  confirmed?: boolean;
  title?: string;
  metadata?: any;
  created_at: string;
  itemType?: 'transaction' | 'notification';
}

export default function useWalletHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [combinedItems, setCombinedItems] = useState<CombinedHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      
      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session) {
        setError("Veuillez vous connecter pour voir votre historique");
        return;
      }

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', session.session.user.id)
        .order('created_at', { ascending: false })
        .limit(15);

      if (transactionsError) throw transactionsError;
      
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.session.user.id)
        .in('type', ['deposit', 'withdrawal', 'investment'])
        .order('created_at', { ascending: false })
        .limit(15);
        
      if (notificationsError) throw notificationsError;
      
      console.log("Transactions récupérées:", transactionsData);
      console.log("Notifications récupérées:", notificationsData);
      
      const typedTransactions = transactionsData?.map(item => ({
        ...item,
        type: item.type as 'deposit' | 'withdrawal' | 'investment',
        itemType: 'transaction' as const
      })) || [];
      
      const typedNotifications = notificationsData?.map(item => {
        const notificationData = item.data as Record<string, any> || {};
        
        return {
          id: item.id,
          title: item.title,
          description: item.message,
          created_at: item.created_at,
          type: item.type,
          read: item.seen,
          category: typeof notificationData === 'object' && notificationData.category ? notificationData.category : 'info',
          metadata: typeof notificationData === 'object' ? notificationData : { data: notificationData },
          itemType: 'notification' as const
        };
      }) || [];
      
      setTransactions(typedTransactions);
      setNotifications(typedNotifications);
      
      // Create properly formatted combined items
      const combinedHistoryItems: CombinedHistoryItem[] = [
        ...typedTransactions.map(tx => {
          // Ensure the created_at is valid before creating a Date
          let date: Date;
          try {
            date = new Date(tx.created_at);
            // Check if date is valid
            if (isNaN(date.getTime())) {
              console.warn("Invalid date for transaction:", tx.id, tx.created_at);
              date = new Date(); // Fallback to current date
            }
          } catch (e) {
            console.warn("Error parsing date for transaction:", tx.id, tx.created_at, e);
            date = new Date(); // Fallback to current date
          }
          
          return {
            id: tx.id,
            date: date,
            formattedDate: format(date, 'dd MMMM yyyy', { locale: fr }),
            amount: tx.amount,
            description: tx.description,
            status: tx.status,
            type: tx.type,
            source: 'transaction' as const,
            confirmed: tx.receipt_confirmed,
            created_at: tx.created_at,
            itemType: tx.itemType
          };
        }),
        ...typedNotifications.map(notification => {
          // Extract amount from notification metadata if available
          const amount = notification.metadata?.amount || 0;
          
          // Ensure the created_at is valid before creating a Date
          let date: Date;
          try {
            date = new Date(notification.created_at);
            // Check if date is valid
            if (isNaN(date.getTime())) {
              console.warn("Invalid date for notification:", notification.id, notification.created_at);
              date = new Date(); // Fallback to current date
            }
          } catch (e) {
            console.warn("Error parsing date for notification:", notification.id, notification.created_at, e);
            date = new Date(); // Fallback to current date
          }
          
          return {
            id: notification.id,
            date: date,
            formattedDate: format(date, 'dd MMMM yyyy', { locale: fr }),
            amount: amount,
            description: notification.description,
            status: notification.metadata?.status || '',
            type: notification.type,
            source: 'notification' as const,
            created_at: notification.created_at,
            title: notification.title,
            metadata: notification.metadata,
            itemType: notification.itemType
          };
        })
      ].sort((a, b) => b.date.getTime() - a.date.getTime());
      
      setCombinedItems(combinedHistoryItems);
      setError(null);
    } catch (err) {
      console.error("Erreur lors de la récupération des données:", err);
      setError("Erreur lors du chargement de l'historique");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    const channel = supabase
      .channel('public:notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${supabase.auth.getSession().then(({ data }) => data.session?.user.id)}`
      }, () => {
        console.log('New notification received, refreshing data');
        fetchData(false);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'wallet_transactions',
        filter: `user_id=eq.${supabase.auth.getSession().then(({ data }) => data.session?.user.id)}`
      }, () => {
        console.log('Transaction updated, refreshing data');
        fetchData(false);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'wallet_transactions',
        filter: `user_id=eq.${supabase.auth.getSession().then(({ data }) => data.session?.user.id)}`
      }, () => {
        console.log('New transaction inserted, refreshing data');
        fetchData(false);
      })
      .subscribe();
    
    const pollingInterval = setInterval(() => {
      fetchData(false);
    }, 60000);
    
    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollingInterval);
    };
  }, [fetchData]);

  const handleRefresh = () => {
    fetchData(false);
  };

  return {
    combinedItems,
    isLoading,
    isRefreshing,
    error,
    handleRefresh
  };
}
