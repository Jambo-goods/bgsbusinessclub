
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import LoadingState from "./withdrawal-table/LoadingState";
import EmptyState from "./withdrawal-table/EmptyState";
import WithdrawalTableRow from "./withdrawal-table/WithdrawalTableRow";
import { toast } from "sonner";
import { notificationService } from "@/services/notifications";
import EditWithdrawalModal from "./withdrawal-table/EditWithdrawalModal";

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  requested_at: string;
  processed_at: string | null;
  bank_info: {
    accountName: string;
    bankName: string;
    accountNumber: string;
  } | Record<string, any>;
}

export default function WithdrawalRequestsTable() {
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    fetchWithdrawalRequests();

    // Set up real-time listener for withdrawal_requests table
    const withdrawalChannel = supabase
      .channel('withdrawal_requests_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'withdrawal_requests'
      }, (payload) => {
        console.log('Withdrawal request change detected:', payload);
        
        // If a withdrawal status is changed, send appropriate notification
        if (payload.eventType === 'UPDATE') {
          const amount = payload.new.amount;
          
          // Check if status changed
          if (payload.old.status !== payload.new.status) {
            switch (payload.new.status) {
              case 'scheduled':
              case 'sheduled':
                notificationService.withdrawalScheduled(amount)
                  .catch(error => {
                    console.error("Error sending scheduled withdrawal notification:", error);
                  });
                break;
              case 'approved':
                notificationService.withdrawalValidated(amount)
                  .catch(error => {
                    console.error("Error sending validated withdrawal notification:", error);
                  });
                break;
              case 'completed':
                notificationService.withdrawalCompleted(amount)
                  .catch(error => {
                    console.error("Error sending completed withdrawal notification:", error);
                  });
                break;
              case 'rejected':
                notificationService.withdrawalRejected(amount)
                  .catch(error => {
                    console.error("Error sending rejected withdrawal notification:", error);
                  });
                break;
              case 'received':
                notificationService.withdrawalReceived(amount)
                  .catch(error => {
                    console.error("Error sending received withdrawal notification:", error);
                  });
                break;
              case 'confirmed':
                notificationService.withdrawalConfirmed(amount)
                  .catch(error => {
                    console.error("Error sending confirmed withdrawal notification:", error);
                  });
                break;
              case 'paid':
                notificationService.withdrawalPaid(amount)
                  .catch(error => {
                    console.error("Error sending paid withdrawal notification:", error);
                  });
                break;
            }
          }
        }
        
        // Refresh the withdrawal requests list
        fetchWithdrawalRequests();
      })
      .subscribe();

    // Cleanup function
    return () => {
      supabase.removeChannel(withdrawalChannel);
    };
  }, []);

  const fetchWithdrawalRequests = async () => {
    try {
      setIsLoading(true);
      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session) {
        return;
      }

      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', session.session.user.id)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      
      // Transformation des données pour s'assurer que bank_info est correctement formaté
      const formattedData = data.map(item => ({
        ...item,
        bank_info: typeof item.bank_info === 'object' ? item.bank_info : {}
      }));
      
      setWithdrawalRequests(formattedData as WithdrawalRequest[]);
    } catch (error) {
      console.error("Erreur lors de la récupération des demandes de retrait:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditWithdrawal = (withdrawal: WithdrawalRequest) => {
    setSelectedWithdrawal(withdrawal);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedWithdrawal(null);
    fetchWithdrawalRequests();
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (withdrawalRequests.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="mt-6">
      <h3 className="font-medium text-lg mb-4">Historique des demandes de retrait</h3>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Banque</TableHead>
              <TableHead>Compte</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Date de traitement</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {withdrawalRequests.map((request) => (
              <WithdrawalTableRow 
                key={request.id} 
                request={request} 
                onEdit={() => handleEditWithdrawal(request)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <EditWithdrawalModal 
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        withdrawal={selectedWithdrawal}
        onUpdate={fetchWithdrawalRequests}
      />
    </div>
  );
}
