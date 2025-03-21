import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, createResponse } from "./corsUtils.ts";
import { updateUserWalletBalance } from "./walletHelpers.ts";
import { sendUserNotification } from "./notificationHelpers.ts";

// Create Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Required environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set");
}

serve(async (req: Request) => {
  console.log(`Bank Transfer Edge Function - Method: ${req.method}, URL: ${req.url}`);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Set up Supabase client with admin privileges
    const supabase = createClient(
      supabaseUrl!,
      supabaseServiceKey!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Parse request body
    const { 
      transferId, 
      status, 
      isProcessed, 
      notes, 
      userId, 
      sendNotification,
      creditWallet = true // Default to true for backward compatibility
    } = await req.json();
    
    // Validate required parameters
    if (!transferId || !status) {
      return createResponse({ 
        success: false, 
        error: "Missing required parameters: transferId and status are required" 
      }, 400);
    }

    // Normalize status - convert "reçu" to "received" if needed
    const normalizedStatus = status === 'reçu' ? 'received' : status;

    console.log(`Processing bank transfer update: ID=${transferId}, Status=${normalizedStatus}, Processed=${isProcessed}, CreditWallet=${creditWallet}`);

    // Determine if this status should trigger wallet crediting
    const shouldCreditWallet = creditWallet && (normalizedStatus === 'completed' || normalizedStatus === 'received');
    
    // First try to find the transfer in bank_transfers
    const { data: existingTransfer, error: checkError } = await supabase
      .from('bank_transfers')
      .select('id, user_id, amount, reference, status')
      .eq('id', transferId)
      .maybeSingle();
      
    // If not found in bank_transfers, check if it exists in wallet_transactions
    if (!existingTransfer && !checkError) {
      const { data: walletTransfer, error: walletError } = await supabase
        .from('wallet_transactions')
        .select('id, user_id, amount, description, status')
        .eq('id', transferId)
        .maybeSingle();
        
      if (walletTransfer) {
        console.log("Transfer found in wallet_transactions:", walletTransfer);
        
        // Vérifier si cette transaction a déjà été traitée pour éviter un double traitement
        if (walletTransfer.status === 'completed' && (status === 'completed' || status === 'received')) {
          console.log("Transaction already completed, skipping update");
          return createResponse({ 
            success: true, 
            message: "Transaction already completed", 
            data: walletTransfer 
          });
        }
        
        // Check if wallet already has a completed transaction for this reference
        if (shouldCreditWallet) {
          const { data: existingCompletedTx } = await supabase
            .from('wallet_transactions')
            .select('id')
            .eq('user_id', walletTransfer.user_id)
            .eq('description', walletTransfer.description)
            .eq('status', 'completed')
            .maybeSingle();
            
          if (existingCompletedTx) {
            // A completed transaction already exists, don't credit the wallet again
            console.log("A completed transaction already exists, not crediting wallet again");
            creditWallet = false;
          }
        }
        
        // Update the wallet transaction
        const { data, error } = await supabase
          .from('wallet_transactions')
          .update({
            status: status === 'completed' || status === 'received' ? 'completed' : status,
            receipt_confirmed: status === 'completed' || status === 'received',
          })
          .eq('id', transferId)
          .select();
          
        if (error) {
          console.error("Error updating wallet transaction:", error.message);
          return createResponse({ success: false, error: error.message }, 500);
        }
        
        // Update user wallet balance if needed and requested
        if (shouldCreditWallet && walletTransfer.user_id) {
          await updateUserWalletBalance(supabase, walletTransfer.user_id, walletTransfer.amount);
          
          // Send notification if requested
          if (sendNotification) {
            await sendUserNotification(supabase, walletTransfer.user_id, { 
              amount: walletTransfer.amount,
              reference: walletTransfer.description
            });
          }
        }
        
        return createResponse({ success: true, data });
      }
    }
      
    if (checkError) {
      console.error("Error checking transfer:", checkError?.message);
      return createResponse({ 
        success: false, 
        error: checkError?.message 
      }, 500);
    }
    
    if (!existingTransfer) {
      console.error("Transfer not found with ID:", transferId);
      return createResponse({ 
        success: false, 
        error: "Transfer not found" 
      }, 404);
    }
    
    // Check if this bank transfer has already been processed
    if (existingTransfer.status === 'completed' && (status === 'completed' || status === 'received')) {
      console.log("Transfer already completed, skipping update");
      return createResponse({ 
        success: true, 
        message: "Transfer already completed", 
        data: existingTransfer 
      });
    }
    
    // Before crediting wallet, check if a completed wallet transaction exists for this transfer reference
    if (shouldCreditWallet) {
      const { data: existingCompletedTx } = await supabase
        .from('wallet_transactions')
        .select('id')
        .eq('user_id', existingTransfer.user_id)
        .eq('description', `Virement bancaire (${existingTransfer.reference})`)
        .eq('status', 'completed')
        .maybeSingle();
        
      if (existingCompletedTx) {
        // A completed transaction already exists, don't credit the wallet again
        console.log("A completed transaction already exists, not crediting wallet again");
        creditWallet = false;
      }
    }

    // Try using the updated RPC function with correct parameter naming
    const { data: rpcResult, error: rpcError } = await supabase.rpc("admin_mark_bank_transfer", {
      transfer_id: transferId,
      new_status: normalizedStatus, // Use normalized status
      is_processed: isProcessed || false,
      notes: notes || `Mis à jour via edge function le ${new Date().toLocaleDateString('fr-FR')}`
    });

    // If RPC fails, fallback to direct update
    if (rpcError) {
      console.error("RPC update failed:", rpcError.message);
      
      // Direct update fallback
      const { data, error } = await supabase
        .from('bank_transfers')
        .update({
          status: status,
          processed: isProcessed || false,
          processed_at: isProcessed ? new Date().toISOString() : null,
          notes: notes || `Mis à jour via edge function le ${new Date().toLocaleDateString('fr-FR')}`
        })
        .eq('id', transferId)
        .select();
      
      if (error) {
        console.error("Direct update failed:", error.message);
        return createResponse({ success: false, error: error.message }, 500);
      }

      console.log("Update successful via direct update");
      
      // Update existing wallet transaction or create a new one
      const userIdToUpdate = userId || existingTransfer.user_id;
      const transferAmount = existingTransfer.amount || 0;
      
      // Vérifier s'il existe déjà une transaction de portefeuille correspondante
      const { data: existingTx, error: txError } = await supabase
        .from('wallet_transactions')
        .select('id, status')
        .eq('user_id', userIdToUpdate)
        .eq('description', `Virement bancaire (${existingTransfer.reference})`)
        .maybeSingle();
      
      // Mettre à jour la transaction existante ou en créer une nouvelle
      if (status === 'completed' || status === 'received') {
        if (existingTx) {
          // Mettre à jour la transaction existante
          await supabase
            .from('wallet_transactions')
            .update({
              status: 'completed',
              receipt_confirmed: true
            })
            .eq('id', existingTx.id);
          
          console.log(`Updated existing wallet transaction with ID ${existingTx.id}`);
        } else {
          // Créer une nouvelle transaction complétée
          await supabase
            .from('wallet_transactions')
            .insert({
              user_id: userIdToUpdate,
              amount: transferAmount,
              type: 'deposit',
              description: `Virement bancaire (${existingTransfer.reference})`,
              status: 'completed',
              receipt_confirmed: true
            });
            
          console.log(`Created new wallet transaction for user ${userIdToUpdate}`);
        }
      }
      
      // Update user wallet balance if needed and should credit wallet
      if (userIdToUpdate && shouldCreditWallet) {
        await updateUserWalletBalance(supabase, userIdToUpdate, transferAmount);
        
        // Send notification if requested and status is appropriate
        if (sendNotification) {
          await sendUserNotification(supabase, userIdToUpdate, existingTransfer);
        }
      }
      
      return createResponse({ success: true, data });
    }

    console.log("Update successful via RPC");
    
    // Check if we need to update the user's wallet balance
    const userIdToUpdate = userId || existingTransfer.user_id;
    const transferAmount = existingTransfer.amount || 0;
    
    // Vérifier s'il existe déjà une transaction de portefeuille correspondante
    const { data: existingTx, error: txError } = await supabase
      .from('wallet_transactions')
      .select('id, status')
      .eq('user_id', userIdToUpdate)
      .ilike('description', `%${existingTransfer.reference}%`)
      .maybeSingle();
    
    if (status === 'completed' || status === 'received') {
      if (existingTx) {
        // Mettre à jour la transaction existante
        await supabase
          .from('wallet_transactions')
          .update({
            status: 'completed',
            receipt_confirmed: true
          })
          .eq('id', existingTx.id);
          
        console.log(`Updated existing wallet transaction with ID ${existingTx.id}`);
      } else {
        // Créer une nouvelle transaction complétée
        await supabase
          .from('wallet_transactions')
          .insert({
            user_id: userIdToUpdate,
            amount: transferAmount,
            type: 'deposit',
            description: `Virement bancaire (${existingTransfer.reference})`,
            status: 'completed',
            receipt_confirmed: true
          });
          
        console.log(`Created new wallet transaction for user ${userIdToUpdate}`);
      }
    }
    
    if (userIdToUpdate && shouldCreditWallet) {
      await updateUserWalletBalance(supabase, userIdToUpdate, transferAmount);
      
      // Send notification if requested and status is appropriate
      if (sendNotification) {
        await sendUserNotification(supabase, userIdToUpdate, existingTransfer);
      }
    }
    
    // Make sure we return the updated transfer data
    const { data: updatedTransfer, error: getUpdatedError } = await supabase
      .from('bank_transfers')
      .select('*')
      .eq('id', transferId)
      .maybeSingle();
      
    if (getUpdatedError) {
      console.warn("Couldn't fetch updated transfer:", getUpdatedError.message);
    }
    
    // Send success response
    return createResponse({ 
      success: true, 
      data: updatedTransfer || rpcResult || { id: transferId, status, processed: isProcessed }
    });

  } catch (error: any) {
    console.error("Edge function error:", error.message);
    return createResponse({ success: false, error: error.message }, 500);
  }
});
