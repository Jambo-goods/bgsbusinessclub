import { Project } from "@/types/project";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notificationService } from "@/services/notifications";

export const isUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

export const createProjectInDatabase = async (project: Project, toast: any) => {
  try {
    console.log("Création du projet dans la base de données:", project.name);
    
    // Vérifier si le projet existe déjà par son nom
    const { data: existingProject, error: checkError } = await supabase
      .from('projects')
      .select('id')
      .eq('name', project.name)
      .maybeSingle();
    
    if (checkError) {
      console.error("Erreur lors de la vérification du projet existant:", checkError);
    }
    
    // Si le projet existe déjà, retourner son ID
    if (existingProject) {
      console.log("Le projet existe déjà, utilisation de l'ID existant:", existingProject.id);
      return existingProject.id;
    }
    
    // Sinon, créer un nouveau projet
    const { data: newProject, error: insertError } = await supabase
      .from('projects')
      .insert({
        name: project.name,
        company_name: project.companyName,
        description: project.description,
        duration: project.duration,
        location: project.location,
        min_investment: project.minInvestment,
        category: project.category,
        price: project.price,
        yield: project.yield,
        funding_progress: project.fundingProgress,
        featured: project.featured || false,
        possible_durations: project.possibleDurations,
        status: project.status || 'active',
        profitability: project.profitability,
        image: project.image,
        first_payment_delay_months: project.firstPaymentDelayMonths || 1
      })
      .select('id')
      .single();
    
    if (insertError) {
      console.error("Erreur lors de la création du projet:", insertError);
      throw new Error("Impossible de créer le projet dans la base de données");
    }
    
    console.log("Projet créé avec succès:", newProject);
    toast({
      title: "Projet créé",
      description: `Le projet ${project.name} a été créé avec succès dans la base de données.`
    });
    
    // Log new project creation
    console.log(`Nouveau projet créé: ${project.name} (${newProject.id})`);
    
    return newProject.id;
  } catch (error) {
    console.error("Erreur dans createProjectInDatabase:", error);
    throw error;
  }
};

// Fonction pour récupérer tous les projets de la base de données
export const fetchProjectsFromDatabase = async () => {
  try {
    console.log("Début de la récupération des projets depuis la base de données");
    
    const { data, error } = await supabase
      .from('projects')
      .select('*');
      
    if (error) {
      console.error("Erreur lors de la récupération des projets:", error);
      toast.error("Erreur de chargement", {
        description: "Impossible de charger les projets depuis la base de données."
      });
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log("Aucun projet trouvé dans la base de données");
      return [];
    }
    
    console.log(`${data.length} projets récupérés depuis la base de données`);
    
    const projects = data.map(project => {
      // Vérifier que le statut est l'une des valeurs autorisées
      let validStatus: "active" | "upcoming" | "completed" = "active";
      
      if (project.status === "active" || project.status === "upcoming" || project.status === "completed") {
        validStatus = project.status as "active" | "upcoming" | "completed";
      } else {
        // Log pour débugger si un statut inattendu est trouvé
        console.warn(`Statut de projet non reconnu: ${project.status}, utilisation de la valeur par défaut 'active'`);
      }
      
      return {
        id: project.id,
        name: project.name,
        companyName: project.company_name,
        description: project.description,
        profitability: project.profitability,
        duration: project.duration,
        location: project.location,
        status: validStatus,
        minInvestment: project.min_investment,
        category: project.category,
        price: project.price,
        yield: project.yield,
        fundingProgress: project.funding_progress,
        featured: project.featured,
        possibleDurations: project.possible_durations,
        image: project.image,
        firstPaymentDelayMonths: project.first_payment_delay_months || 1,
        maxInvestment: project.price || 10000 // Correction ici: utilisation de project.price au lieu de project.max_investment
      };
    });
    
    return projects;
  } catch (error) {
    console.error("Erreur dans fetchProjectsFromDatabase:", error);
    throw error;
  }
};

/**
 * Fonction pour annoncer une nouvelle opportunité d'investissement
 */
export const announceProjectOpportunity = async (projectId: string) => {
  try {
    const result = await notificationService.announceNewOpportunity(projectId);
    return { success: true, project: result };
  } catch (error) {
    console.error("Erreur lors de l'annonce du projet:", error);
    toast.error("Erreur d'annonce", {
      description: "Impossible d'annoncer cette opportunité d'investissement."
    });
    return { success: false, error };
  }
};
