
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useWalletBalance() {
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWalletBalance = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoadingBalance(true);
      }
      setError(null);
      
      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session) {
        console.log("No active session found, setting balance to 0");
        setWalletBalance(0);
        setIsLoadingBalance(false);
        return;
      }
      
      const userId = session.session.user.id;
      console.log("Fetching wallet balance for user:", userId);
      
      // First, check if there are any confirmed transfers that should be counted
      const { data: transfersData, error: transfersError } = await supabase
        .from('bank_transfers')
        .select('amount')
        .eq('user_id', userId)
        .in('status', ['received', 'reçu']);
        
      if (transfersError) {
        console.error("Error checking bank transfers:", transfersError);
      } else {
        console.log(`Found ${transfersData.length} confirmed transfers for user ${userId}`);
        
        // Calculate expected balance
        const expectedBalance = transfersData.reduce((sum, transfer) => sum + (transfer.amount || 0), 0);
        console.log(`Expected balance based on transfers: ${expectedBalance}€`);
      }
      
      // Get the current balance from profile
      const { data, error } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', userId)
        .maybeSingle();
        
      if (error) {
        console.error("Error fetching wallet balance:", error);
        setError("Erreur lors de la récupération du solde");
        setWalletBalance(0);
      } else {
        console.log("Wallet balance fetched from profile:", data?.wallet_balance);
        // Convert null or undefined to 0
        const balance = data?.wallet_balance ?? 0;
        setWalletBalance(balance);
      }
    } catch (err) {
      console.error("Error:", err);
      setError("Une erreur est survenue");
      setWalletBalance(0);
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  const recalculateBalance = useCallback(async () => {
    try {
      setIsLoadingBalance(true);
      setError(null);
      
      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session) {
        console.log("No active session found, cannot recalculate");
        setIsLoadingBalance(false);
        return;
      }
      
      // Call the database function to recalculate the balance
      const userId = session.session.user.id;
      console.log("Recalculating wallet balance for user:", userId);
      
      // First, log all transfers that should be counted
      const { data: transfersData, error: transfersError } = await supabase
        .from('bank_transfers')
        .select('id, amount, status, created_at')
        .eq('user_id', userId)
        .in('status', ['received', 'reçu']);
        
      if (transfersError) {
        console.error("Error checking bank transfers:", transfersError);
      } else {
        console.log("Transfers that should be counted in balance:", transfersData);
      }
      
      // Also check wallet transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from('wallet_transactions')
        .select('id, amount, type, status, created_at')
        .eq('user_id', userId)
        .eq('status', 'completed');
        
      if (transactionsError) {
        console.error("Error checking wallet transactions:", transactionsError);
      } else {
        console.log("Completed transactions found:", transactionsData);
        
        // Calculate expected balance from transactions
        const deposits = transactionsData
          .filter(t => t.type === 'deposit')
          .reduce((sum, t) => sum + (t.amount || 0), 0);
          
        const withdrawals = transactionsData
          .filter(t => t.type === 'withdrawal')
          .reduce((sum, t) => sum + (t.amount || 0), 0);
          
        console.log(`Expected balance from transactions: deposits ${deposits}€, withdrawals ${withdrawals}€, net ${deposits - withdrawals}€`);
      }
      
      // Call the database function to recalculate
      const { error: rpcError } = await supabase.rpc('recalculate_wallet_balance', {
        user_uuid: userId
      });
      
      if (rpcError) {
        console.error("Error recalculating balance:", rpcError);
        toast.error("Erreur lors du recalcul du solde");
        return;
      }
      
      toast.success("Solde recalculé avec succès");
      
      // Fetch the updated balance
      await fetchWalletBalance(false);
    } catch (err) {
      console.error("Error during recalculation:", err);
      toast.error("Erreur lors du recalcul du solde");
    } finally {
      setIsLoadingBalance(false);
    }
  }, [fetchWalletBalance]);

  useEffect(() => {
    console.log("Setting up wallet balance subscriptions");
    fetchWalletBalance();
    
    // Set up polling to check balance every minute
    const pollingInterval = setInterval(() => {
      fetchWalletBalance(false); // Don't show loading state for automatic updates
    }, 60000);
    
    // Subscribe to both profiles table and wallet_transactions table changes for real-time updates
    const setupRealtimeSubscriptions = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      
      if (!userId) return;
      
      console.log("Setting up realtime subscriptions for wallet balance, user:", userId);
      
      const channel = supabase
        .channel('wallet-balance-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${userId}`
          },
          (payload) => {
            console.log("Profile updated in real-time:", payload);
            if (payload.new && typeof payload.new === 'object') {
              const newProfile = payload.new as { wallet_balance?: number };
              if (typeof newProfile.wallet_balance === 'number') {
                console.log("Setting new wallet balance from realtime update:", newProfile.wallet_balance);
                setWalletBalance(newProfile.wallet_balance);
                
                if (newProfile.wallet_balance > 0) {
                  toast.success("Votre solde a été mis à jour", {
                    description: `Nouveau solde: ${newProfile.wallet_balance}€`
                  });
                }
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'wallet_transactions',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log("Wallet transaction changed in real-time:", payload);
            
            // Refresh balance to make sure it's up-to-date
            fetchWalletBalance(false);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'bank_transfers',
            filter: `user_id=eq.${userId}`
          },
          (payload) => {
            console.log("Bank transfer changed in real-time:", payload);
            
            if (payload.new && typeof payload.new === 'object') {
              // Check for status changes, especially to 'reçu' or 'received'
              const newPayload = payload.new as Record<string, any>;
              const oldPayload = payload.old as Record<string, any>;
              const status = newPayload.status;
              
              console.log("Bank transfer status change:", {
                old: oldPayload?.status,
                new: status,
              });
              
              if (status === 'reçu' || status === 'received') {
                console.log("Transfer status changed to 'received', refreshing balance...");
                fetchWalletBalance(false);
                
                const amount = newPayload.amount || 0;
                toast.custom((t) => (
                  <div className="bg-blue-50 text-blue-700 p-4 rounded-lg shadow-lg border border-blue-200 flex items-start">
                    <div className="bg-blue-100 p-2 rounded-full mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-blue-600">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Dépôt réussi</h3>
                      <p>Votre virement de {amount}€ a été reçu et crédité sur votre compte.</p>
                    </div>
                  </div>
                ), {
                  duration: 8000,
                  id: `deposit-success-${newPayload.id}`
                });
                
                // Create a notification in the notifications table
                supabase.from('notifications').insert({
                  user_id: userId,
                  title: 'Dépôt réussi',
                  description: `Votre virement de ${amount}€ a été reçu et crédité sur votre compte.`,
                  type: 'deposit',
                  category: 'success',
                  metadata: {
                    amount: amount,
                    transaction_id: newPayload.id
                  }
                });
              }
            }
          }
        )
        .subscribe((status) => {
          console.log("Realtime subscription status for wallet balance:", status);
        });
      
      return channel;
    };
    
    const subscriptionPromise = setupRealtimeSubscriptions();
    
    // Clean up on unmount
    return () => {
      clearInterval(pollingInterval);
      subscriptionPromise.then(channel => {
        if (channel) supabase.removeChannel(channel);
      });
    };
  }, [fetchWalletBalance]);

  // Function to manually refresh the balance
  const refreshBalance = async () => {
    await fetchWalletBalance(true);
  };

  return { 
    walletBalance, 
    isLoadingBalance, 
    error,
    refreshBalance,
    recalculateBalance 
  };
}
