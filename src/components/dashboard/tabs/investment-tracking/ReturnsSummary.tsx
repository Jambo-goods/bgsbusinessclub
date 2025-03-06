
import React from "react";
import { TrendingUp, CheckCircle, Clock } from "lucide-react";

interface ReturnsSummaryProps {
  totalPaid: number;
  totalPending: number;
  averageMonthlyReturn: number;
}

export default function ReturnsSummary({ 
  totalPaid, 
  totalPending, 
  averageMonthlyReturn 
}: ReturnsSummaryProps) {
  return (
    <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
      <div className="bg-green-50 p-4 rounded-md transition-all duration-300 hover:shadow-sm">
        <div className="flex items-center mb-2">
          <div className="bg-green-100 p-1.5 rounded-lg mr-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
          </div>
          <p className="text-xs text-bgs-gray-medium">Total des rendements perçus</p>
        </div>
        <p className="text-lg font-medium text-green-600">{totalPaid} €</p>
      </div>
      
      <div className="bg-orange-50 p-4 rounded-md transition-all duration-300 hover:shadow-sm">
        <div className="flex items-center mb-2">
          <div className="bg-orange-100 p-1.5 rounded-lg mr-2">
            <Clock className="h-4 w-4 text-bgs-orange" />
          </div>
          <p className="text-xs text-bgs-gray-medium">Rendements en attente</p>
        </div>
        <p className="text-lg font-medium text-bgs-orange">{totalPending} €</p>
      </div>
      
      <div className="bg-blue-50 p-4 rounded-md transition-all duration-300 hover:shadow-sm">
        <div className="flex items-center mb-2">
          <div className="bg-blue-100 p-1.5 rounded-lg mr-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-xs text-bgs-gray-medium">Rendement mensuel moyen</p>
        </div>
        <p className="text-lg font-medium text-blue-600">
          {averageMonthlyReturn} €
        </p>
      </div>
    </div>
  );
}
