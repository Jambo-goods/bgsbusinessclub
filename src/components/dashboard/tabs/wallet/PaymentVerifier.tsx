
import React, { useEffect, useState } from 'react';
import { checkForUnprocessedPayments } from './utils/paymentProcessing';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';

interface PaymentVerifierProps {
  refreshBalance: (() => Promise<void>) | undefined;
  onVerificationComplete: () => void;
}

export default function PaymentVerifier({ refreshBalance, onVerificationComplete }: PaymentVerifierProps) {
  const [isVerifying, setIsVerifying] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const verifyPayments = async () => {
      try {
        console.log("PaymentVerifier: Starting payment verification");
        
        // Check if the function exists before calling it
        if (typeof checkForUnprocessedPayments !== 'function') {
          console.error("checkForUnprocessedPayments is not a function", checkForUnprocessedPayments);
          throw new Error("Payment processing function is not available");
        }
        
        await checkForUnprocessedPayments(refreshBalance);
        console.log("PaymentVerifier: Payment verification completed successfully");
        setIsVerifying(false);
        onVerificationComplete();
      } catch (err) {
        console.error("Error verifying payments:", err);
        setHasError(true);
        setIsVerifying(false);
        onVerificationComplete();
        
        toast.error("Erreur lors de la vérification des paiements", {
          description: "Certains paiements n'ont pas pu être traités. Veuillez réessayer ultérieurement."
        });
      }
    };
    
    // Wrap in try/catch to prevent uncaught promise rejections that could break the app
    try {
      verifyPayments();
    } catch (err) {
      console.error("Uncaught error in verifyPayments:", err);
      setHasError(true);
      setIsVerifying(false);
      onVerificationComplete();
    }
  }, [refreshBalance, onVerificationComplete]);

  if (!isVerifying && !hasError) {
    return null;
  }

  return (
    <div className={`rounded-lg p-4 mb-4 ${hasError ? "bg-red-50 border border-red-200" : "bg-blue-50 border border-blue-200"}`}>
      {isVerifying ? (
        <p className="text-blue-700">Vérification des paiements en attente...</p>
      ) : (
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-red-700">Erreur lors du traitement de certains paiements. Veuillez réessayer ultérieurement.</p>
        </div>
      )}
    </div>
  );
}
