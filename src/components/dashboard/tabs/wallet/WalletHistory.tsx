import React, { useEffect, useState, useRef } from "react";
import { Separator } from "@/components/ui/separator";
import { History, ArrowUpRight, ArrowDownLeft, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { notificationService } from "@/services/notifications";

interface Transaction {
  id: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  description: string | null;
  created_at: string;
  status: string;
  raw_timestamp?: string;
}

interface PostgresChangePayload {
  new: Record<string, any>;
  old?: Record<string, any>;
}

interface WalletHistoryProps {
  refreshBalance?: () => Promise<void>;
}

export default function WalletHistory({ refreshBalance }: WalletHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const subscriptionsRef = useRef<any[]>([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    fetchTransactions();
    
    setupRealtimeSubscriptions();
    
    return () => {
      isMountedRef.current = false;
      
      if (subscriptionsRef.current.length > 0) {
        subscriptionsRef.current.forEach(channel => {
          if (channel) supabase.removeChannel(channel);
        });
        subscriptionsRef.current = [];
      }
    };
  }, []);

  const fetchTransactions = async (showLoading = true) => {
    if (!isMountedRef.current) return;
    
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

      const userId = session.session.user.id;
      console.log("Fetching wallet transactions for user:", userId);
      
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (transactionsError) {
        console.error("Error fetching transactions:", transactionsError);
        throw transactionsError;
      }
      
      const { data: investmentsData, error: investmentsError } = await supabase
        .from('investments')
        .select(`
          *,
          projects (name)
        `)
        .eq('user_id', userId)
        .order('date', { ascending: false });
      
      if (investmentsError) {
        console.error("Error fetching investments:", investmentsError);
      }
      
      const { data: transfersData, error: transfersError } = await supabase
        .from('bank_transfers')
        .select('*')
        .eq('user_id', userId);
        
      if (transfersError) {
        console.error("Error fetching bank transfers:", transfersError);
        throw transfersError;
      }

      const { data: withdrawalsData, error: withdrawalsError } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', userId);
        
      if (withdrawalsError) {
        console.error("Error fetching withdrawal requests:", withdrawalsError);
        throw withdrawalsError;
      }
      
      if (!isMountedRef.current) return;
      
      console.log("Fetched transactions:", transactionsData ? transactionsData.length : 0);
      console.log("Fetched bank transfers:", transfersData ? transfersData.length : 0);
      console.log("Fetched withdrawal requests:", withdrawalsData ? withdrawalsData.length : 0);
      
      const transfersAsTransactions: Transaction[] = transfersData ? transfersData.map(transfer => {
        let timestamp = transfer.processed_at || transfer.confirmed_at || new Date().toISOString();
        
        return {
          id: transfer.id,
          amount: transfer.amount || 0,
          type: 'deposit' as const,
          description: `Virement bancaire reçu (réf: ${transfer.reference})`,
          created_at: timestamp,
          status: transfer.status === 'received' || transfer.status === 'reçu' ? 'completed' : 'pending',
          raw_timestamp: timestamp
        };
      }) : [];

      const withdrawalsAsTransactions: Transaction[] = withdrawalsData ? withdrawalsData.map(withdrawal => {
        let bankInfo: any = {};
        if (typeof withdrawal.bank_info === 'string') {
          try {
            bankInfo = JSON.parse(withdrawal.bank_info);
          } catch (e) {
            console.error("Error parsing bank_info string:", e);
          }
        } else if (withdrawal.bank_info && typeof withdrawal.bank_info === 'object') {
          bankInfo = withdrawal.bank_info;
        }
        
        const bankName = bankInfo?.bankName || 'Votre banque';
        const accountNumber = bankInfo?.accountNumber || '****';
        const lastFour = typeof accountNumber === 'string' ? accountNumber.slice(-4) : '****';
        
        const transactions: Transaction[] = [];
        
        const requestTransaction: Transaction = {
          id: `${withdrawal.id}-request`,
          amount: withdrawal.amount || 0,
          type: 'withdrawal' as const,
          description: `Demande de retrait vers ${bankName} (${lastFour})`,
          created_at: withdrawal.requested_at || new Date().toISOString(),
          status: withdrawal.status,
          raw_timestamp: withdrawal.requested_at || new Date().toISOString()
        };
        
        transactions.push(requestTransaction);
        
        if (withdrawal.processed_at) {
          let statusDesc = '';
          
          if (withdrawal.status === 'completed' || withdrawal.status === 'approved') {
            statusDesc = 'Retrait confirmé';
          } else if (withdrawal.status === 'rejected') {
            statusDesc = 'Retrait rejeté';
          } else {
            statusDesc = 'Retrait traité';
          }
          
          const confirmationTransaction: Transaction = {
            id: `${withdrawal.id}-confirmation`,
            amount: withdrawal.amount || 0,
            type: 'withdrawal' as const,
            description: `${statusDesc} vers ${bankName} (${lastFour})`,
            created_at: withdrawal.processed_at,
            status: withdrawal.status,
            raw_timestamp: withdrawal.processed_at
          };
          
          transactions.push(confirmationTransaction);
        }
        
        return transactions;
      }).flat() : [];
      
      const investmentTransactionsMap = new Map();
      
      const typedTransactions = transactionsData ? transactionsData.map(tx => {
        if (tx.description && tx.description.toLowerCase().includes('investissement dans')) {
          const projectNameMatch = tx.description.match(/Investissement dans (.+)/);
          if (projectNameMatch && projectNameMatch[1]) {
            investmentTransactionsMap.set(projectNameMatch[1].trim(), true);
          }
        }
        
        return {
          id: tx.id,
          amount: tx.amount,
          type: tx.type as 'deposit' | 'withdrawal',
          description: tx.description,
          created_at: tx.created_at,
          status: tx.status,
          raw_timestamp: tx.created_at
        };
      }) : [];
      
      const investmentsAsTransactions = investmentsData ? investmentsData
        .filter(investment => {
          const projectName = investment.projects?.name || '';
          return !investmentTransactionsMap.has(projectName);
        })
        .map(investment => {
          return {
            id: `inv-${investment.id}`,
            amount: investment.amount || 0,
            type: 'withdrawal' as const,
            description: `Investissement dans ${investment.projects?.name || 'un projet'}`,
            created_at: investment.date || new Date().toISOString(),
            status: 'completed',
            raw_timestamp: investment.date || new Date().toISOString()
          };
        }) : [];
      
      const allTransactions = [...typedTransactions, ...transfersAsTransactions, ...withdrawalsAsTransactions, ...investmentsAsTransactions]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 15);
      
      if (isMountedRef.current) {
        setTransactions(allTransactions);
        setError(null);
      }
    } catch (err) {
      console.error("Erreur lors de la récupération des transactions:", err);
      if (isMountedRef.current) {
        setError("Erreur lors du chargement de l'historique des transactions");
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  };

  const setupRealtimeSubscriptions = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      
      if (!userId) return;
      
      console.log("Setting up realtime subscriptions for wallet transactions, user:", userId);
      
      if (subscriptionsRef.current.length > 0) {
        subscriptionsRef.current.forEach(channel => {
          if (channel) supabase.removeChannel(channel);
        });
        subscriptionsRef.current = [];
      }
      
      const transactionsChannel = supabase
        .channel('wallet-transactions-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'wallet_transactions',
            filter: `user_id=eq.${userId}`
          },
          (payload: PostgresChangePayload) => {
            if (!isMountedRef.current) return;
            
            console.log("Wallet transaction changed in real-time:", payload);
            fetchTransactions(false);
            toast.success("Votre historique de transactions a été mis à jour");
          }
        )
        .subscribe((status) => {
          console.log("Realtime subscription status for wallet transactions:", status);
        });
      
      const transfersChannel = supabase
        .channel('bank-transfers-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bank_transfers',
            filter: `user_id=eq.${userId}`
          },
          (payload: PostgresChangePayload) => {
            if (!isMountedRef.current) return;
            
            console.log("Bank transfer changed in real-time:", payload);
            
            if (payload.new && 
                (payload.new.status === 'received' || payload.new.status === 'reçu') &&
                (!payload.old || 
                 (payload.old.status !== 'received' && payload.old.status !== 'reçu'))) {
              
              console.log("Bank transfer marked as received, refreshing transactions");
              fetchTransactions(false);
              
              notificationService.depositSuccess(payload.new.amount);
            }
          }
        )
        .subscribe((status) => {
          console.log("Realtime subscription status for bank transfers:", status);
        });

      const withdrawalsChannel = supabase
        .channel('withdrawal-requests-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'withdrawal_requests',
            filter: `user_id=eq.${userId}`
          },
          async (payload: PostgresChangePayload) => {
            if (!isMountedRef.current) return;
            
            console.log("Withdrawal request changed in real-time:", payload);
            
            if (payload.new && payload.new.processed_at && 
                (!payload.old || !payload.old.processed_at)) {
              console.log("Withdrawal request processed_at updated, refreshing transactions");
              
              if (payload.new.status === 'completed' || payload.new.status === 'approved') {
                console.log(`Withdrawal of ${payload.new.amount}€ approved, deducting from wallet balance`);
                
                try {
                  fetchTransactions(false);
                  
                  if (refreshBalance) {
                    await refreshBalance();
                  }
                } catch (err) {
                  console.error("Error processing withdrawal approval:", err);
                }
              } else if (payload.new.status === 'rejected') {
                toast.error("Votre demande de retrait a été rejetée");
                fetchTransactions(false);
              }
            }
          }
        )
        .subscribe((status) => {
          console.log("Realtime subscription status for withdrawal requests:", status);
        });
      
      subscriptionsRef.current = [transactionsChannel, transfersChannel, withdrawalsChannel];
    } catch (error) {
      console.error("Error setting up realtime subscriptions:", error);
    }
  };

  const handleRefresh = () => {
    toast.info("Actualisation de l'historique des transactions...");
    fetchTransactions(false);
  };

  const formatAmount = (amount: number, type: string) => {
    return type === 'deposit' ? `+${amount} €` : `-${amount} €`;
  };

  const getAmountClass = (type: string) => {
    return type === 'deposit' ? 'text-green-600' : 'text-red-600';
  };

  const getTransactionIcon = (type: string, description?: string | null) => {
    if (description && description.includes("Investissement dans")) {
      return <TrendingUp className="h-4 w-4 text-blue-600" />;
    }
    
    return type === 'deposit' 
      ? <ArrowDownLeft className="h-4 w-4 text-green-600" /> 
      : <ArrowUpRight className="h-4 w-4 text-red-600" />;
  };

  const formatRelativeTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'dd/MM/yyyy à HH:mm', { locale: fr });
    } catch (error) {
      console.error("Erreur de formatage de date:", error, "pour la date:", dateString);
      return "Date inconnue";
    }
  };

  const getTransactionLabel = (transaction: Transaction) => {
    if (transaction.description && transaction.description.includes("Investissement dans")) {
      return "Investissement effectué";
    }
    
    if (transaction.description && transaction.description.includes("Virement bancaire reçu")) {
      return "Virement bancaire reçu";
    }
    
    if (transaction.description && transaction.description.includes("Virement bancaire confirmé")) {
      return transaction.status === "pending" 
        ? "Virement bancaire en attente" 
        : "Virement bancaire reçu";
    }

    if (transaction.description && transaction.description.includes("Demande de retrait")) {
      return transaction.status === "pending"
        ? "Demande de retrait en attente"
        : transaction.status === "completed" || transaction.status === "approved"
          ? "Retrait effectué"
          : transaction.status === "rejected"
            ? "Retrait rejeté"
            : "Demande de retrait";
    }
    
    if (transaction.description && transaction.description.includes("Retrait confirmé")) {
      return "Retrait confirmé";
    }
    
    if (transaction.description && transaction.description.includes("Retrait rejeté")) {
      return "Retrait rejeté";
    }
    
    return transaction.type === 'deposit' ? 'Dépôt' : 'Retrait';
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-bgs-blue" />
          <h2 className="text-lg font-semibold text-bgs-blue">Historique des transactions</h2>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh} 
          disabled={isRefreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>
      
      <Separator className="my-4" />
      
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 text-bgs-blue animate-spin" />
        </div>
      ) : error ? (
        <p className="text-center py-6 text-red-500">{error}</p>
      ) : transactions.length === 0 ? (
        <p className="text-center py-6 text-bgs-gray-medium">
          Aucune transaction récente à afficher
        </p>
      ) : (
        <div className="space-y-4">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-gray-100">
                  {getTransactionIcon(transaction.type, transaction.description)}
                </div>
                <div>
                  <div className="flex items-center">
                    <p className="font-medium text-bgs-blue">
                      {getTransactionLabel(transaction)}
                    </p>
                    {transaction.status === "pending" && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        En attente
                      </span>
                    )}
                    {transaction.status === "rejected" && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Rejeté
                      </span>
                    )}
                    {transaction.status === "approved" && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Approuvé
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-bgs-gray-medium">
                    {formatRelativeTime(transaction.raw_timestamp || transaction.created_at)}
                  </p>
                  {transaction.description && (
                    <p className="text-sm text-bgs-gray-medium">{transaction.description}</p>
                  )}
                </div>
              </div>
              <p className={`font-semibold ${getAmountClass(transaction.type)}`}>
                {formatAmount(transaction.amount, transaction.type)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
