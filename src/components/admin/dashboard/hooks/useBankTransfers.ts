
import { useState } from "react";
import { toast } from "sonner";
import { bankTransferService } from "../services/bankTransferService";
import { BankTransferItem } from "../types/bankTransfer";
import { supabase } from "@/integrations/supabase/client";

export function useBankTransfers() {
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Function to directly update bank transfer status
  const updateTransferStatus = async (transfer: BankTransferItem, newStatus: string, processedDate: string | null = null) => {
    try {
      if (!transfer || !transfer.id) {
        console.error("Transfert invalide", transfer);
        toast.error("Transfert invalide ou incomplet");
        return false;
      }
      
      setProcessingId(transfer.id);
      
      // Store admin token if available
      const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
      if (adminUser?.token) {
        localStorage.setItem('admin_token', adminUser.token);
      }
      
      // Add debug logs
      console.log("Updating transfer status:", {
        id: transfer.id,
        currentStatus: transfer.status,
        newStatus,
        processedDate
      });
      
      // Check if wallet balance should be updated (if status is received/reçu)
      const shouldUpdateWallet = newStatus === 'received' || newStatus === 'reçu';
      
      if (shouldUpdateWallet && transfer.user_id && transfer.amount) {
        console.log(`Will update wallet balance for user ${transfer.user_id} with amount ${transfer.amount}`);
        
        // Use increment_wallet_balance RPC to update wallet balance directly
        const { error: walletError } = await supabase.rpc('increment_wallet_balance', {
          user_id: transfer.user_id,
          increment_amount: transfer.amount
        });
        
        if (walletError) {
          console.error("Failed to update wallet balance:", walletError);
        } else {
          console.log("Wallet balance updated successfully");
          
          // Create a wallet transaction for this deposit if it doesn't exist
          const { error: txError } = await supabase
            .from('wallet_transactions')
            .insert({
              user_id: transfer.user_id,
              amount: transfer.amount,
              type: 'deposit',
              description: `Virement bancaire${transfer.reference ? ` (${transfer.reference})` : ''}`,
              receipt_confirmed: true,
              status: 'completed'
            });
            
          if (txError) {
            console.error("Failed to create wallet transaction:", txError);
          }
        }
      }
      
      // Call the service to update the transfer
      const result = await bankTransferService.updateBankTransfer(
        transfer.id,
        newStatus,
        processedDate
      );
      
      console.log("Update result:", result);
      
      if (result.success) {
        const message = shouldUpdateWallet 
          ? `Virement mis à jour: ${newStatus} et solde utilisateur crédité`
          : `Virement mis à jour: ${newStatus}`;
        toast.success(message);
        return true;
      } else {
        console.error("Échec de mise à jour:", result);
        
        // Show more specific error messages based on the error
        if (result.message && result.message.includes("Transfer not found")) {
          toast.error("Virement introuvable. Veuillez rafraîchir la page.");
        } else if (result.message && result.message.includes("Edge Function")) {
          toast.error("Erreur de connexion au serveur. Veuillez réessayer.");
        } else {
          toast.error(result.message || "Échec de la mise à jour");
        }
        return false;
      }
    } catch (error: any) {
      console.error("Erreur lors de la mise à jour du statut:", error);
      toast.error(`Erreur: ${error.message || "Erreur inconnue"}`);
      return false;
    } finally {
      // Add small delay before clearing processing state for UI feedback
      setTimeout(() => setProcessingId(null), 500);
    }
  };

  // Function to restore a transfer back to pending status
  const restoreTransfer = async (transfer: BankTransferItem) => {
    try {
      if (!transfer || !transfer.id) {
        console.error("Transfert invalide", transfer);
        toast.error("Transfert invalide ou incomplet");
        return false;
      }
      
      setProcessingId(transfer.id);
      toast.info("Restauration du virement en cours...");
      
      console.log("Restoring transfer:", {
        id: transfer.id,
        currentStatus: transfer.status
      });
      
      // Call the service to restore the transfer (set to pending)
      const result = await bankTransferService.updateBankTransfer(
        transfer.id,
        'pending',
        null // Clear processed date
      );
      
      console.log("Restore result:", result);
      
      if (result.success) {
        toast.success("Virement restauré avec succès");
        return true;
      } else {
        console.error("Échec de restauration:", result);
        
        // Show more specific error messages based on the error
        if (result.message && result.message.includes("Transfer not found")) {
          toast.error("Virement introuvable. Veuillez rafraîchir la page.");
        } else if (result.message && result.message.includes("Edge Function")) {
          toast.error("Erreur de connexion au serveur. Veuillez réessayer.");
        } else {
          toast.error(result.message || "Échec de la restauration");
        }
        return false;
      }
    } catch (error: any) {
      console.error("Erreur lors de la restauration:", error);
      toast.error(`Erreur: ${error.message || "Erreur inconnue"}`);
      return false;
    } finally {
      setTimeout(() => setProcessingId(null), 500);
    }
  };

  return {
    processingId,
    updateTransferStatus,
    restoreTransfer
  };
}
