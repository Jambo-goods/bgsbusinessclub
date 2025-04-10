
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useUserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [hasError, setHasError] = useState(false);
  const [realTimeStatus, setRealTimeStatus] = useState('connecting');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchUsers();
    
    // Set up real-time subscription for profiles with better error handling
    const profilesChannel = supabase
      .channel('admin_profiles_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles'
      }, (payload) => {
        console.log('Profiles data changed, refreshing users...', payload);
        
        // Au lieu de déclencher un nouveau fetchUsers complet qui remplace tous les utilisateurs,
        // on va mettre à jour la liste en fonction de l'événement
        if (payload.eventType === 'INSERT') {
          // Pour une insertion, on ajoute simplement le nouvel utilisateur à la liste existante
          console.log('New user detected:', payload.new);
          setUsers(prevUsers => {
            // Vérifier si l'utilisateur existe déjà pour éviter les doublons
            const exists = prevUsers.some(user => user.id === payload.new.id);
            if (exists) return prevUsers;
            
            // Ajouter le nouvel utilisateur et trier selon le critère actuel
            const updatedUsers = [...prevUsers, payload.new];
            return sortUsers(updatedUsers, sortField, sortDirection);
          });
          
          toast.info("Nouvel utilisateur détecté", {
            description: "Un nouvel utilisateur a été ajouté à la liste."
          });
        } else {
          // Pour les autres types de changements (UPDATE, DELETE),
          // on fait un fetchUsers complet pour être sûr d'avoir des données cohérentes
          fetchUsers();
          toast.info("Mise à jour détectée", {
            description: "Les données utilisateurs ont été mises à jour."
          });
        }
      })
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to profiles table');
          setRealTimeStatus('connected');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to profiles table');
          setRealTimeStatus('error');
          toast.error("Erreur de connexion en temps réel", {
            description: "La mise à jour automatique des utilisateurs peut ne pas fonctionner."
          });
        }
      });
      
    // Clean up subscription on component unmount
    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(profilesChannel);
    };
  }, []);
  
  // Fonction utilitaire pour trier les utilisateurs
  const sortUsers = (usersToSort: any[], field: string, direction: 'asc' | 'desc') => {
    return [...usersToSort].sort((a, b) => {
      const aValue = a[field];
      const bValue = b[field];
      
      // Gestion des valeurs nulles ou undefined
      if (aValue === null || aValue === undefined) return direction === 'asc' ? -1 : 1;
      if (bValue === null || bValue === undefined) return direction === 'asc' ? 1 : -1;
      
      // Tri en fonction du type de données
      if (typeof aValue === 'string') {
        return direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      // Pour les nombres, dates, etc.
      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
  };
  
  // Separate effect for sorting changes to avoid duplicate fetching
  useEffect(() => {
    if (!isLoading) {
      console.log('Sort criteria changed, refreshing data');
      fetchUsers();
    }
  }, [sortField, sortDirection]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setHasError(false);
      setIsRefreshing(true);
      
      console.log("Fetching ALL users with sort field:", sortField, "direction:", sortDirection);
      
      // Récupérer TOUS les utilisateurs de la table profiles sans AUCUN filtre
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order(sortField, { ascending: sortDirection === 'asc' });
        
      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }
      
      console.log("Fetched users:", data);
      console.log("Number of users fetched:", data ? data.length : 0);
      
      if (data) {
        // Afficher clairement tous les utilisateurs récupérés
        setUsers(data);
        
        if (data.length === 0) {
          console.log("No users found in the profiles table");
          toast.info("Base de données vide", {
            description: "Aucun utilisateur trouvé dans la base de données. Vous pouvez créer un utilisateur test."
          });
        } else {
          console.log(`Nombre d'utilisateurs trouvés: ${data.length}`);
          // Afficher chaque utilisateur pour le débogage
          data.forEach((user, index) => {
            console.log(`User ${index + 1}:`, user.id, user.first_name, user.last_name, user.email);
          });
        }
      } else {
        setUsers([]);
        console.log("No data returned from the query");
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      setHasError(true);
      toast.error("Erreur lors du chargement des utilisateurs");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleSort = (field: string) => {
    if (field === sortField) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to desc
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredUsers = users.filter(user => {
    if (!searchTerm.trim()) return true; // Si la recherche est vide, retourne tous les utilisateurs
    
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase();
    const email = (user.email || '').toLowerCase();
    
    return fullName.includes(searchLower) || email.includes(searchLower);
  });

  return {
    users,
    filteredUsers,
    isLoading,
    hasError,
    searchTerm,
    setSearchTerm,
    sortField,
    sortDirection,
    handleSort,
    fetchUsers,
    realTimeStatus,
    isRefreshing
  };
}
