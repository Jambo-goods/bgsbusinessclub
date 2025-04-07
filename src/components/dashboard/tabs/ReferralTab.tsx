
import React, { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, CheckCircle, Users, Gift, TrendingUp, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/auth";
import { Badge } from "@/components/ui/badge";

export default function ReferralTab() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState([]);
  const [referralStats, setReferralStats] = useState({
    pendingCount: 0,
    completedCount: 0,
    totalEarned: 0
  });
  
  // Charger le code de parrainage de l'utilisateur
  useEffect(() => {
    if (user) {
      fetchReferralCode();
      fetchReferrals();
    }
  }, [user]);
  
  // Récupérer le code de parrainage depuis Supabase
  const fetchReferralCode = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error("Erreur lors de la récupération du code de parrainage:", error);
        return;
      }
      
      if (data) {
        setReferralCode(data.code);
      } else {
        // Générer un code de parrainage s'il n'existe pas déjà
        await createReferralCode();
      }
    } catch (error) {
      console.error("Erreur lors de la récupération du code de parrainage:", error);
    } finally {
      setLoading(false);
    }
  };
  
  // Créer un nouveau code de parrainage si nécessaire
  const createReferralCode = async () => {
    try {
      // On préfère laisser la fonction SQL generate_unique_referral_code s'exécuter côté serveur
      // Fix: We need to provide a code value even though it will be overridden by the server
      const { data, error } = await supabase
        .from('referral_codes')
        .insert({ 
          user_id: user.id,
          code: 'TEMP' + Math.random().toString(36).substring(2, 10).toUpperCase() // Temporary code that will be replaced
        })
        .select()
        .single();
        
      if (error) {
        console.error("Erreur lors de la création du code de parrainage:", error);
        return;
      }
      
      if (data) {
        setReferralCode(data.code);
      }
    } catch (error) {
      console.error("Erreur lors de la création du code de parrainage:", error);
    }
  };
  
  // Récupérer les parrainages de l'utilisateur
  const fetchReferrals = async () => {
    try {
      setLoading(true);
      
      // Récupérer les parrainages où l'utilisateur est le parrain
      const { data: referrerData, error: referrerError } = await supabase
        .from('referrals')
        .select(`
          id, 
          status, 
          referrer_rewarded, 
          referred_rewarded, 
          created_at,
          referred_id,
          profiles:referred_id (first_name, last_name, email)
        `)
        .eq('referrer_id', user.id);
      
      if (referrerError) {
        console.error("Erreur lors de la récupération des parrainages:", referrerError);
        return;
      }
      
      if (referrerData) {
        setReferrals(referrerData);
        
        // Calculer les statistiques
        const completed = referrerData.filter(r => r.status === 'completed').length;
        const pending = referrerData.filter(r => r.status === 'pending').length;
        // Chaque parrainage complété rapporte 25€
        const totalEarned = completed * 25;
        
        setReferralStats({
          completedCount: completed,
          pendingCount: pending,
          totalEarned: totalEarned
        });
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des parrainages:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour copier le lien de parrainage
  const copyReferralLink = () => {
    const referralLink = `${window.location.origin}/register?ref=${referralCode}`;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Lien de parrainage copié !");
    
    setTimeout(() => {
      setCopied(false);
    }, 3000);
  };

  // Fonction pour rafraîchir les données
  const refreshData = async () => {
    setLoading(true);
    await fetchReferrals();
    toast.success("Données actualisées");
  };

  // Afficher un état de chargement
  if (loading && !referralCode) {
    return (
      <div className="space-y-6">
        <Skeleton className="w-full h-12" />
        <Skeleton className="w-full h-24" />
        <Skeleton className="w-full h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-bgs-blue mb-4">Programme de parrainage</h2>
        <p className="text-gray-600 mb-6">
          Parrainez vos amis et recevez 25€ lorsqu'ils commencent à investir avec BGS Invest.
          Votre filleul reçoit également 25€ dès son inscription avec votre code.
        </p>
      </div>
      
      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-white border border-gray-100 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2 rounded-full">
              <Users size={20} className="text-bgs-blue" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Filleuls en attente</p>
              <p className="text-2xl font-semibold">{referralStats.pendingCount}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-5 bg-white border border-gray-100 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-green-50 p-2 rounded-full">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Parrainages complétés</p>
              <p className="text-2xl font-semibold">{referralStats.completedCount}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-5 bg-white border border-gray-100 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-amber-50 p-2 rounded-full">
              <TrendingUp size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Gains totaux</p>
              <p className="text-2xl font-semibold">{referralStats.totalEarned} €</p>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Section Code de Parrainage */}
      <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-medium text-gray-800">Votre lien de parrainage</h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshData}
            className="flex items-center gap-2"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            <span>Actualiser</span>
          </Button>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input 
              value={`${window.location.origin}/register?ref=${referralCode}`}
              readOnly
              className="bg-gray-50"
            />
          </div>
          <Button 
            onClick={copyReferralLink} 
            className="flex items-center gap-2"
            variant={copied ? "outline" : "default"}
          >
            {copied ? (
              <>
                <CheckCircle size={16} />
                <span>Copié</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copier</span>
              </>
            )}
          </Button>
        </div>
        <div className="mt-4 text-sm text-gray-500">
          <p>Votre code: <span className="font-medium text-bgs-blue">{referralCode}</span></p>
        </div>
      </div>
      
      {/* Section Comment ça marche */}
      <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
        <h3 className="text-xl font-medium text-gray-800 mb-4">Comment ça marche ?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col items-center text-center">
            <div className="bg-blue-50 p-3 rounded-full mb-3">
              <Users size={24} className="text-bgs-blue" />
            </div>
            <h4 className="font-medium mb-2">1. Invitez vos amis</h4>
            <p className="text-sm text-gray-600">
              Partagez votre lien ou code de parrainage avec vos amis, famille et collègues.
            </p>
          </div>
          
          <div className="flex flex-col items-center text-center">
            <div className="bg-green-50 p-3 rounded-full mb-3">
              <CheckCircle size={24} className="text-green-600" />
            </div>
            <h4 className="font-medium mb-2">2. Ils s'inscrivent</h4>
            <p className="text-sm text-gray-600">
              Votre filleul s'inscrit avec votre lien ou code et reçoit 25€ immédiatement sur son compte.
            </p>
          </div>
          
          <div className="flex flex-col items-center text-center">
            <div className="bg-orange-50 p-3 rounded-full mb-3">
              <Gift size={24} className="text-bgs-orange" />
            </div>
            <h4 className="font-medium mb-2">3. Vous recevez 25€</h4>
            <p className="text-sm text-gray-600">
              Dès que votre filleul fait son premier investissement, vous recevez 25€ sur votre solde.
            </p>
          </div>
        </div>
      </div>
      
      {/* Section Liste des Parrainages */}
      <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm">
        <h3 className="text-xl font-medium text-gray-800 mb-4">
          Vos parrainages
        </h3>
        
        {referrals.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filleul</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Récompense</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell>
                      {referral.profiles ? 
                        `${referral.profiles.first_name || ''} ${referral.profiles.last_name || ''}`.trim() || 'Utilisateur' 
                        : 'Utilisateur'}
                    </TableCell>
                    <TableCell>
                      {new Date(referral.created_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      {/* Fix: Changed success to outline with custom classes */}
                      <Badge 
                        variant={referral.status === 'completed' ? 'outline' : 'default'}
                        className={referral.status === 'completed' ? 'bg-green-100 text-green-800 hover:bg-green-200' : ''}
                      >
                        {referral.status === 'completed' ? 'Complété' : 'En attente'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {/* Fix: Changed success to outline with custom classes */}
                      <Badge 
                        variant={referral.referrer_rewarded ? 'outline' : 'outline'} 
                        className={referral.referrer_rewarded ? 'bg-green-100 text-green-800 hover:bg-green-200' : ''}
                      >
                        {referral.referrer_rewarded ? '25€ reçus' : 'En attente'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h4 className="text-lg font-medium text-gray-700">Aucun parrainage pour l'instant</h4>
            <p className="mt-2 text-gray-500">
              Commencez à partager votre lien pour voir vos parrainages ici.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
