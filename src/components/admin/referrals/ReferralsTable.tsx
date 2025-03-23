
import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { formatDate } from '@/utils/formatUtils';
import { formatCurrency } from '@/utils/currencyUtils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import ReferralStatusSelect from './ReferralStatusSelect';

interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  status: string;
  commission_rate: number;
  total_commission: number;
  created_at: string;
  referrer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  referred?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
}

interface ReferralsTableProps {
  referrals: Referral[];
  isLoading: boolean;
}

const ReferralsTable: React.FC<ReferralsTableProps> = ({ referrals: initialReferrals, isLoading }) => {
  const [referrals, setReferrals] = useState<Referral[]>(initialReferrals);
  
  React.useEffect(() => {
    setReferrals(initialReferrals);
  }, [initialReferrals]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Actif</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500">En attente</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500">Complété</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-500">Annulé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatName = (user: { first_name?: string, last_name?: string, email?: string } | undefined) => {
    if (!user) return 'Inconnu';
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.email || 'Inconnu';
  };
  
  const handleStatusChange = (id: string, newStatus: string) => {
    setReferrals(current => 
      current.map(referral => 
        referral.id === id ? { ...referral, status: newStatus } : referral
      )
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Parrain</TableHead>
              <TableHead>Filleul</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Total perçu</TableHead>
              <TableHead>Date de création</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array(5).fill(0).map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (referrals.length === 0) {
    return (
      <div className="text-center py-10 border rounded-md">
        <p className="text-muted-foreground">Aucun parrainage trouvé dans la base de données</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Parrain</TableHead>
            <TableHead>Filleul</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Commission</TableHead>
            <TableHead>Total perçu</TableHead>
            <TableHead>Date de création</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {referrals.map((referral) => (
            <TableRow key={referral.id}>
              <TableCell>{formatName(referral.referrer)}</TableCell>
              <TableCell>{formatName(referral.referred)}</TableCell>
              <TableCell>{getStatusBadge(referral.status)}</TableCell>
              <TableCell>{referral.commission_rate}%</TableCell>
              <TableCell>{formatCurrency(referral.total_commission)}</TableCell>
              <TableCell>{formatDate(referral.created_at)}</TableCell>
              <TableCell>
                <ReferralStatusSelect 
                  referralId={referral.id}
                  currentStatus={referral.status}
                  onStatusChange={(newStatus) => handleStatusChange(referral.id, newStatus)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ReferralsTable;
