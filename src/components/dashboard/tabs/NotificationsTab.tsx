
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell, BellRing, Settings, Info, AlertTriangle, Clock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notificationService } from "@/services/notifications";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const NotificationsTab = () => {
  const [showDemo, setShowDemo] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  
  // Fonction pour démontrer les différents types de notifications
  const demonstrateNotifications = () => {
    setShowDemo(true);
    
    // Délai de 1 seconde entre chaque notification pour meilleure expérience
    setTimeout(() => {
      notificationService.depositSuccess(1000);
    }, 1000);
    
    setTimeout(() => {
      notificationService.investmentConfirmed(5000, "Projet Exemple", "123");
    }, 3000);
    
    setTimeout(() => {
      notificationService.yieldReceived(250, "Projet Exemple");
    }, 5000);
    
    setTimeout(() => {
      notificationService.withdrawalStatus(500, "pending");
    }, 7000);
    
    setTimeout(() => {
      notificationService.newInvestmentOpportunity("Nouveau Projet", "456");
    }, 9000);
    
    // Réinitialise après la démo
    setTimeout(() => {
      setShowDemo(false);
    }, 12000);
  };

  // Données de démonstration pour les notifications
  const demoNotifications = {
    investments: [
      { id: 1, title: "Investissement confirmé", description: "Votre investissement de 5000€ dans Projet Alpha a été confirmé.", date: "Aujourd'hui", status: "success" },
      { id: 2, title: "Investissement en attente", description: "Votre investissement de 3200€ dans Projet Beta est en attente de confirmation.", date: "Hier", status: "pending" }
    ],
    deposits: [
      { id: 3, title: "Dépôt réussi", description: "Votre dépôt de 1000€ a été crédité sur votre compte.", date: "Aujourd'hui", status: "success" },
      { id: 4, title: "Retrait en cours", description: "Votre demande de retrait de 500€ est en cours de traitement.", date: "Il y a 2 jours", status: "processing" }
    ],
    yields: [
      { id: 5, title: "Rendement reçu", description: "Vous avez reçu 250€ de rendement pour votre investissement dans Projet Alpha.", date: "Aujourd'hui", status: "success" },
      { id: 6, title: "Rendement prévu", description: "Un rendement de 180€ est prévu pour le 15 du mois prochain.", date: "Il y a 1 semaine", status: "info" }
    ],
    opportunities: [
      { id: 7, title: "Nouvelle opportunité", description: "Projet Gamma est maintenant disponible pour investissement.", date: "Aujourd'hui", status: "info" },
      { id: 8, title: "Offre limitée", description: "Projet Delta offre un rendement exceptionnel de 8% pour une durée limitée.", date: "Il y a 3 jours", status: "info" }
    ]
  };

  const getAllNotifications = () => {
    return [
      ...demoNotifications.investments,
      ...demoNotifications.deposits,
      ...demoNotifications.yields,
      ...demoNotifications.opportunities
    ].sort((a, b) => (a.date === "Aujourd'hui" ? -1 : 1));
  };

  const getNotificationIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'pending': return <Clock className="h-5 w-5 text-amber-500" />;
      case 'processing': return <Clock className="h-5 w-5 text-blue-500" />;
      case 'info': return <Info className="h-5 w-5 text-blue-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-500" />;
      default: return <Bell className="h-5 w-5 text-bgs-blue" />;
    }
  };

  const getStatusBadge = (status) => {
    const statusLabels = {
      success: "Succès",
      pending: "En attente",
      processing: "En cours",
      info: "Information",
      warning: "Avertissement",
      error: "Erreur"
    };

    const statusColors = {
      success: "bg-green-100 text-green-800",
      pending: "bg-amber-100 text-amber-800",
      processing: "bg-blue-100 text-blue-800",
      info: "bg-blue-100 text-blue-800",
      warning: "bg-amber-100 text-amber-800",
      error: "bg-red-100 text-red-800"
    };

    return (
      <Badge variant="outline" className={`${statusColors[status]} border-0`}>
        {statusLabels[status]}
      </Badge>
    );
  };
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-bgs-blue">Notifications</h2>
      
      <Tabs defaultValue="all" value={activeCategory} onValueChange={setActiveCategory} className="w-full">
        <TabsList className="grid grid-cols-5 mb-6">
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="investments">Investissements</TabsTrigger>
          <TabsTrigger value="deposits">Dépôts & Retraits</TabsTrigger>
          <TabsTrigger value="yields">Rendements</TabsTrigger>
          <TabsTrigger value="opportunities">Opportunités</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-xl">Toutes les notifications</CardTitle>
                <CardDescription>Consultez l'ensemble de vos notifications</CardDescription>
              </div>
              <Button 
                onClick={demonstrateNotifications} 
                disabled={showDemo}
                variant="outline"
                size="sm"
              >
                {showDemo ? "Démo en cours..." : "Voir exemples en direct"}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {getAllNotifications().length > 0 ? (
                  getAllNotifications().map(notification => (
                    <div key={notification.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="mt-1">{getNotificationIcon(notification.status)}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium">{notification.title}</h3>
                          {getStatusBadge(notification.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{notification.description}</p>
                        <p className="text-xs text-gray-500">{notification.date}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <BellRing className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">Aucune notification pour le moment</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="investments" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Confirmations d'investissements</CardTitle>
              <CardDescription>Notifications relatives à vos investissements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {demoNotifications.investments.length > 0 ? (
                  demoNotifications.investments.map(notification => (
                    <div key={notification.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="mt-1">{getNotificationIcon(notification.status)}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium">{notification.title}</h3>
                          {getStatusBadge(notification.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{notification.description}</p>
                        <p className="text-xs text-gray-500">{notification.date}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Aucune notification d'investissement</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="deposits" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Dépôts et retraits</CardTitle>
              <CardDescription>Notifications relatives à vos opérations financières</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {demoNotifications.deposits.length > 0 ? (
                  demoNotifications.deposits.map(notification => (
                    <div key={notification.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="mt-1">{getNotificationIcon(notification.status)}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium">{notification.title}</h3>
                          {getStatusBadge(notification.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{notification.description}</p>
                        <p className="text-xs text-gray-500">{notification.date}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Aucune notification de dépôt ou retrait</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="yields" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Rendements reçus</CardTitle>
              <CardDescription>Notifications relatives aux rendements de vos investissements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {demoNotifications.yields.length > 0 ? (
                  demoNotifications.yields.map(notification => (
                    <div key={notification.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="mt-1">{getNotificationIcon(notification.status)}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium">{notification.title}</h3>
                          {getStatusBadge(notification.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{notification.description}</p>
                        <p className="text-xs text-gray-500">{notification.date}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Aucune notification de rendement</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="opportunities" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Opportunités d'investissement</CardTitle>
              <CardDescription>Nouvelles opportunités d'investissement disponibles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {demoNotifications.opportunities.length > 0 ? (
                  demoNotifications.opportunities.map(notification => (
                    <div key={notification.id} className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="mt-1">{getNotificationIcon(notification.status)}</div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-medium">{notification.title}</h3>
                          {getStatusBadge(notification.status)}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{notification.description}</p>
                        <p className="text-xs text-gray-500">{notification.date}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Aucune nouvelle opportunité pour le moment</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="text-bgs-blue h-5 w-5" />
            Préférences de notification
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            Personnalisez les notifications que vous souhaitez recevoir:
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-bgs-blue" />
                <span>Confirmations d'investissements</span>
              </div>
              <Button variant="outline" size="sm">Activé</Button>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-bgs-blue" />
                <span>Dépôts et retraits</span>
              </div>
              <Button variant="outline" size="sm">Activé</Button>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-bgs-blue" />
                <span>Rendements reçus</span>
              </div>
              <Button variant="outline" size="sm">Activé</Button>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-bgs-blue" />
                <span>Nouvelles opportunités d'investissement</span>
              </div>
              <Button variant="outline" size="sm">Activé</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationsTab;
