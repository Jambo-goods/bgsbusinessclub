
import React, { useEffect, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { History, ArrowUpRight, ArrowDownLeft, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Type pour les transactions
interface Transaction {
  id: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  description: string | null;
  created_at: string;
  status: string;
  raw_timestamp?: string; // Original timestamp from database
}

// Type pour les virements bancaires
interface BankTransfer {
  id: string;
  amount: number;
  status: string;
  reference: string;
  user_id: string;
  processed: boolean;
  processed_at: string | null;
  confirmed_at: string | null;
  notes: string | null;
}

// Type pour les payloads des événements PostgreSQL
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

  // Fetch transactions on component mount and when refreshBalance is called
  useEffect(() => {
    fetchTransactions();
    
    // Setup polling for transactions every 30 seconds
    const pollingInterval = setInterval(() => {
      fetchTransactions(false); // silent refresh (don't show loading state)
    }, 30000);
    
    // Set up realtime subscription for transaction updates
    const setupRealtimeSubscriptions = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      
      if (!userId) return;
      
      console.log("Setting up realtime subscriptions for wallet transactions, user:", userId);
      
      // Subscribe to wallet_transactions table changes
      const transactionsChannel = supabase
        .channel('wallet-transactions-changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'wallet_transactions',
            filter: `user_id=eq.${userId}`
          },
          (payload: PostgresChangePayload) => {
            console.log("Wallet transaction changed in real-time:", payload);
            fetchTransactions(false);
            toast.success("Votre historique de transactions a été mis à jour");
          }
        )
        .subscribe((status) => {
          console.log("Realtime subscription status for wallet transactions:", status);
        });
      
      // Also subscribe to bank_transfers table changes to detect received transfers
      const transfersChannel = supabase
        .channel('bank-transfers-changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'bank_transfers',
            filter: `user_id=eq.${userId}`
          },
          (payload: PostgresChangePayload) => {
            console.log("Bank transfer changed in real-time:", payload);
            
            // If status changed to 'received' or 'reçu', refresh transactions
            if (payload.new && 
                (payload.new.status === 'received' || payload.new.status === 'reçu') &&
                (!payload.old || 
                 (payload.old.status !== 'received' && payload.old.status !== 'reçu'))) {
              
              console.log("Bank transfer marked as received, refreshing transactions");
              fetchTransactions(false);
              
              toast.success("Virement bancaire reçu", {
                description: `Un virement de ${payload.new.amount}€ a été confirmé`
              });
            }
          }
        )
        .subscribe((status) => {
          console.log("Realtime subscription status for bank transfers:", status);
        });
      
      return [transactionsChannel, transfersChannel];
    };
    
    const subscriptionPromise = setupRealtimeSubscriptions();
    
    return () => {
      clearInterval(pollingInterval);
      subscriptionPromise.then(channels => {
        if (channels) {
          channels.forEach(channel => {
            if (channel) supabase.removeChannel(channel);
          });
        }
      });
    };
  }, [refreshBalance]);

  const fetchTransactions = async (showLoading = true) => {
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
      
      // Récupération des transactions de l'utilisateur connecté
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (transactionsError) {
        console.error("Error fetching transactions:", transactionsError);
        throw transactionsError;
      }
      
      // Récupération des virements bancaires reçus
      const { data: transfersData, error: transfersError } = await supabase
        .from('bank_transfers')
        .select('*')
        .eq('user_id', userId);
        
      if (transfersError) {
        console.error("Error fetching bank transfers:", transfersError);
        throw transfersError;
      }
      
      console.log("Fetched transactions:", transactionsData ? transactionsData.length : 0);
      console.log("Fetched bank transfers:", transfersData ? transfersData.length : 0);
      console.log("Bank transfers data:", transfersData);
      
      // Convertir les virements bancaires en format de transaction
      const transfersAsTransactions: Transaction[] = transfersData.map(transfer => {
        // Utiliser processed_at, confirmed_at ou now() comme timestamp, en vérifiant que l'on a une valeur
        let timestamp = transfer.processed_at || transfer.confirmed_at || new Date().toISOString();
        
        console.log(`Transfer ID: ${transfer.id}, reference: ${transfer.reference}, amount: ${transfer.amount}, processed_at: ${transfer.processed_at}, confirmed_at: ${transfer.confirmed_at}, timestamp used: ${timestamp}, processed: ${transfer.processed}, status: ${transfer.status}`);
        
        // Pour le debugging, loggons les valeurs nulles ou vides
        if (!transfer.processed_at && !transfer.confirmed_at) {
          console.warn(`Transfer ${transfer.id} has no timestamp values in processed_at or confirmed_at!`);
        }
        
        return {
          id: transfer.id,
          amount: transfer.amount || 0,
          type: 'deposit' as const,
          description: `Virement bancaire reçu (réf: ${transfer.reference})`,
          created_at: timestamp,
          status: transfer.status === 'received' || transfer.status === 'reçu' ? 'completed' : 'pending',
          raw_timestamp: timestamp // Store the exact timestamp as it is in the database
        };
      });
      
      // S'assurer que toutes les transactions sont bien typées
      const typedTransactions: Transaction[] = transactionsData ? transactionsData.map(tx => ({
        id: tx.id,
        amount: tx.amount,
        type: tx.type as 'deposit' | 'withdrawal',
        description: tx.description,
        created_at: tx.created_at,
        status: tx.status,
        raw_timestamp: tx.created_at // Store the exact timestamp
      })) : [];
      
      // Fusionner et trier les transactions par date
      const allTransactions = [...typedTransactions, ...transfersAsTransactions]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10); // Limiter à 10 transactions
      
      console.log("All transactions after merging:", allTransactions);
      
      setTransactions(allTransactions);
      setError(null);
    } catch (err) {
      console.error("Erreur lors de la récupération des transactions:", err);
      setError("Erreur lors du chargement de l'historique des transactions");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Manual refresh function
  const handleRefresh = () => {
    toast.info("Actualisation de l'historique des transactions...");
    fetchTransactions(false);
  };

  // Formatting functions
  const formatAmount = (amount: number, type: string) => {
    return type === 'deposit' ? `+${amount} €` : `-${amount} €`;
  };

  const getAmountClass = (type: string) => {
    return type === 'deposit' ? 'text-green-600' : 'text-red-600';
  };

  const getTransactionIcon = (type: string) => {
    return type === 'deposit' 
      ? <ArrowDownLeft className="h-4 w-4 text-green-600" /> 
      : <ArrowUpRight className="h-4 w-4 text-red-600" />;
  };

  const formatRelativeTime = (dateString: string) => {
    try {
      // Use the raw_timestamp if available for more accurate display
      const date = new Date(dateString);
      
      // Log the date string and parsed date for debugging
      console.log(`Formatting date: ${dateString}, parsed as: ${date.toISOString()}`);
      
      // Format as exact date and time - without any timezone transformation
      // This will display exactly what's stored in the database
      return format(date, 'dd/MM/yyyy à HH:mm', { locale: fr });
    } catch (error) {
      console.error("Erreur de formatage de date:", error, "pour la date:", dateString);
      return "Date inconnue";
    }
  };

  const getTransactionLabel = (transaction: Transaction) => {
    if (transaction.description && transaction.description.includes("Virement bancaire reçu")) {
      return "Virement bancaire reçu";
    }
    
    if (transaction.description && transaction.description.includes("Virement bancaire confirmé")) {
      return transaction.status === "pending" 
        ? "Virement bancaire en attente" 
        : "Virement bancaire reçu";
    }
    
    if (transaction.description && transaction.description.includes("Investissement dans")) {
      return "Investissement effectué";
    }
    
    return transaction.type === 'deposit' ? 'Dépôt' : 'Retrait';
  };

  const getStatusBadge = (transaction: Transaction) => {
    if (transaction.status === "pending") {
      return (
        <span className="text-xs font-medium bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full ml-2">
          En attente
        </span>
      );
    }
    return null;
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
                  {getTransactionIcon(transaction.type)}
                </div>
                <div>
                  <div className="flex items-center">
                    <p className="font-medium text-bgs-blue">
                      {getTransactionLabel(transaction)}
                    </p>
                    {getStatusBadge(transaction)}
                  </div>
                  <p className="text-sm text-bgs-gray-medium">
                    {/* Use raw_timestamp if available for more precise display */}
                    {formatRelativeTime(transaction.raw_timestamp || transaction.created_at)}
                  </p>
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
