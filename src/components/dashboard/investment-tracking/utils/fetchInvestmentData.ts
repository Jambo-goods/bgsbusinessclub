
import { supabase } from "@/integrations/supabase/client";
import { Investment } from "../types/investment";

export async function fetchInvestmentData(investmentId: string): Promise<Investment | null> {
  try {
    // Fetch the investment with the joined project
    const { data: investment, error } = await supabase
      .from('investments')
      .select(`
        *,
        projects (
          name,
          description,
          image,
          status,
          duration,
          yield,
          category,
          funding_progress
        )
      `)
      .eq('id', investmentId)
      .single();

    if (error) {
      console.error("Error fetching investment data:", error);
      return null;
    }

    if (!investment) {
      console.error("No investment found with ID:", investmentId);
      return null;
    }

    // Calculate remaining duration in months
    const startDate = new Date(investment.date);
    const endDate = new Date(investment.end_date);
    const today = new Date();
    
    // Calculate total duration and remaining duration in months
    const totalMonths = investment.duration;
    
    // Calculate elapsed months (capped at total duration)
    const elapsedMonths = Math.min(
      Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
      totalMonths
    );
    
    const remainingDuration = Math.max(0, totalMonths - elapsedMonths);
    
    return {
      ...investment,
      remainingDuration,
    };
  } catch (error) {
    console.error("Unexpected error in fetchInvestmentData:", error);
    return null;
  }
}

// Add these functions to fix the build errors
export async function fetchInvestmentDetails(investmentId: string): Promise<Investment | null> {
  return fetchInvestmentData(investmentId);
}

export async function fetchTransactionHistory(userId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error("Error fetching transaction history:", error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error("Unexpected error in fetchTransactionHistory:", error);
    return [];
  }
}
