
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduledPayment } from './types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, Filter, RefreshCw, FileCheck, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useScheduledPayments } from '@/hooks/useScheduledPayments';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/utils/currencyUtils';

const ScheduledPaymentsSection = () => {
  const [showPastPayments, setShowPastPayments] = useState(false);
  const { scheduledPayments, isLoading, refetch } = useScheduledPayments();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  // Filter payments based on user preference (show past payments or only future)
  const filteredPayments = showPastPayments 
    ? scheduledPayments 
    : scheduledPayments.filter(payment => {
        const paymentDate = new Date(payment.payment_date);
        return paymentDate >= new Date();
      });

  // Sort payments by date (earliest first)
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    return new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime();
  });

  // Calculate summary stats
  const paidPayments = scheduledPayments.filter(payment => payment.status === 'paid');
  const pendingPayments = scheduledPayments.filter(payment => payment.status === 'pending' || payment.status === 'scheduled');
  
  const totalPaid = paidPayments.reduce((sum, payment) => sum + (payment.total_scheduled_amount || 0), 0);
  const totalPending = pendingPayments.reduce((sum, payment) => sum + (payment.total_scheduled_amount || 0), 0);

  // Get status badge color and text
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Payé</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">En attente</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Programmé</Badge>;
    }
  };

  // Format date in French format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'dd/MM/yyyy');
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xl font-semibold text-bgs-blue">Calendrier des paiements programmés</CardTitle>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowPastPayments(!showPastPayments)}
            className="text-xs"
          >
            <Filter className="h-3.5 w-3.5 mr-1" />
            {showPastPayments ? "Masquer les paiements passés" : "Afficher tous les paiements"}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Résumé des versements */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50 rounded-lg border border-green-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileCheck className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-700">Versements payés</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</span>
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                {paidPayments.length} versement{paidPayments.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
          
          <div className="bg-amber-50 rounded-lg border border-amber-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">Versements à venir</span>
            </div>
            <div className="flex justify-between items-end">
              <span className="text-2xl font-bold text-amber-600">{formatCurrency(totalPending)}</span>
              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                {pendingPayments.length} versement{pendingPayments.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : sortedPayments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CalendarIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm font-medium">Aucun paiement programmé trouvé</p>
            <p className="text-xs mt-1">Les paiements apparaîtront ici une fois programmés par l'équipe</p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-md">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Projet</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Pourcentage</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPayments.map((payment) => (
                  <TableRow key={payment.id} className="bg-white">
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        {payment.projects?.image && (
                          <img 
                            src={payment.projects.image} 
                            alt={payment.projects?.name} 
                            className="w-8 h-8 rounded-md object-cover mr-3" 
                          />
                        )}
                        {payment.projects?.name || "Projet inconnu"}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(payment.payment_date)}</TableCell>
                    <TableCell>{payment.percentage.toFixed(2)}%</TableCell>
                    <TableCell className="font-medium">
                      {payment.total_scheduled_amount
                        ? `${payment.total_scheduled_amount.toFixed(2)} €`
                        : "—"
                      }
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(payment.status)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScheduledPaymentsSection;
