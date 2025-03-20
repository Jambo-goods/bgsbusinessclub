
import React from "react";
import HistoryItem, { HistoryItemType } from "./HistoryItem";
import EmptyState from "./EmptyState";

interface HistoryListProps {
  items: HistoryItemType[];
}

export default function HistoryList({ items }: HistoryListProps) {
  if (items.length === 0) {
    return <EmptyState />;
  }

  // Créer un mapping des références pour identifier les transactions et notifications liées
  const refMapping: Record<string, HistoryItemType[]> = {};
  const withdrawalMapping: Record<string, HistoryItemType[]> = {};
  
  // Première passe: grouper les éléments par référence (dépôts) et par montant (retraits)
  items.forEach(item => {
    // Gestion des dépôts
    let ref = null;
    
    if (item.itemType === 'transaction' && item.description) {
      const match = item.description.match(/DEP-\d+/);
      ref = match ? match[0] : null;
    } else if (item.itemType === 'notification' && item.type === 'deposit' && item.description) {
      const match = item.description.match(/DEP-\d+/);
      ref = match ? match[0] : null;
    }
    
    // Si on a trouvé une référence, l'ajouter au mapping
    if (ref) {
      if (!refMapping[ref]) {
        refMapping[ref] = [];
      }
      refMapping[ref].push(item);
    }
    
    // Gestion des retraits
    if (item.type === 'withdrawal') {
      let amount = 0;
      let withdrawalRef = '';
      
      // Extraire le montant selon le type d'élément
      if (item.itemType === 'transaction') {
        amount = item.amount;
        // Essayer d'extraire withdrawalId s'il existe dans la description
        const idMatch = item.description?.match(/#([a-f0-9-]+)/i);
        withdrawalRef = idMatch ? idMatch[1] : `withdrawal-${amount}-${new Date(item.created_at).getTime()}`;
      } else if (item.itemType === 'notification') {
        amount = item.metadata?.amount || 0;
        withdrawalRef = item.metadata?.withdrawalId || `withdrawal-${amount}-${new Date(item.created_at).getTime()}`;
      }
      
      const key = withdrawalRef;
      
      if (!withdrawalMapping[key]) {
        withdrawalMapping[key] = [];
      }
      withdrawalMapping[key].push(item);
    }
  });
  
  // Filtrer les éléments pour éviter les doublons
  const filteredItems = items.filter(item => {
    // Pour les retraits, on applique une logique spécifique
    if (item.type === 'withdrawal') {
      let amount = 0;
      let withdrawalRef = '';
      
      // Extraire le montant selon le type d'élément
      if (item.itemType === 'transaction') {
        amount = item.amount;
        // Essayer d'extraire withdrawalId s'il existe dans la description
        const idMatch = item.description?.match(/#([a-f0-9-]+)/i);
        withdrawalRef = idMatch ? idMatch[1] : `withdrawal-${amount}-${new Date(item.created_at).getTime()}`;
      } else if (item.itemType === 'notification') {
        amount = item.metadata?.amount || 0;
        withdrawalRef = item.metadata?.withdrawalId || `withdrawal-${amount}-${new Date(item.created_at).getTime()}`;
      }
      
      const key = withdrawalRef;
      const group = withdrawalMapping[key];
      
      // S'il n'y a qu'un seul élément ou pas de groupe, on garde
      if (!group || group.length <= 1) {
        return true;
      }
      
      // Pour les groupes de retraits: privilégier les transactions sur les notifications
      // sauf pour les statuts qui n'apparaissent que dans les notifications
      const hasTransaction = group.some(grpItem => 
        grpItem.itemType === 'transaction' && 
        grpItem.status !== 'scheduled' // "scheduled" est un statut intermédiaire qu'on veut conserver
      );
      
      // On garde toujours les notifications avec des statuts spécifiques (confirmé, validé, etc.)
      if (item.itemType === 'notification' && 
          item.title && 
          (item.title.includes('validé') || 
           item.title.includes('confirmé') || 
           item.title.includes('programmé'))) {
        return true;
      }
      
      if (hasTransaction) {
        // On garde la transaction et on supprime les notifications redondantes
        return item.itemType === 'transaction';
      } else {
        // Pas de transaction valide, on garde uniquement la notification la plus récente
        const sortedGroup = [...group].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        return item.id === sortedGroup[0].id;
      }
    }
    
    // Cas des dépôts
    let ref = null;
    
    if (item.itemType === 'transaction' && item.description) {
      const match = item.description.match(/DEP-\d+/);
      ref = match ? match[0] : null;
    } else if (item.itemType === 'notification' && item.type === 'deposit' && item.description) {
      const match = item.description.match(/DEP-\d+/);
      ref = match ? match[0] : null;
    }
    
    // Si pas de référence, on garde l'élément
    if (!ref) {
      return true;
    }
    
    // Si cet élément a une référence, on vérifie s'il fait partie d'un groupe
    const group = refMapping[ref];
    if (!group || group.length <= 1) {
      return true; // Pas de groupe ou un seul élément, on garde
    }
    
    // Pour les groupes: on garde seulement la transaction (pas la notification)
    // Si pas de transaction dans le groupe, on garde alors la notification la plus récente
    const hasTransaction = group.some(grpItem => grpItem.itemType === 'transaction');
    
    if (hasTransaction) {
      // Si c'est une transaction, on la garde
      if (item.itemType === 'transaction') {
        return true;
      }
      // Sinon c'est une notification et on l'ignore car on a déjà la transaction
      return false;
    } else {
      // Pas de transaction, on garde uniquement la notification la plus récente
      const sortedGroup = [...group].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      return item.id === sortedGroup[0].id;
    }
  });

  return (
    <div className="space-y-4">
      {filteredItems.map((item) => (
        <HistoryItem key={item.id} item={item} />
      ))}
    </div>
  );
}
