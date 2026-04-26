import { useEffect, useState } from 'react';
import { authService } from '../../services/authService';

interface KycData {
  fullName: string;
  registryNumber: string;
  dob: string;
}

const KycPendingPanel = () => {
  const [kycData, setKycData] = useState<KycData | null>(null);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser && 'kycData' in currentUser) {
      setKycData((currentUser as any).kycData);
    }
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mr-4">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">KYC Verification Pending</h2>
            <p className="text-gray-600">Your account is being reviewed</p>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-yellow-800">
          Your account has been created but cannot be used for passport applications until KYC verification is accepted.
          This process typically takes 2-3 business days.
        </p>
      </div>

      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Automatic Identity Extraction
        </h3>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600">Full Name:</span>
            <span className="font-medium text-gray-800">
              {kycData?.fullName || 'Pending Extraction'}
            </span>
          </div>
          
          <div className="flex justify-between items-center py-2 border-b border-gray-200">
            <span className="text-gray-600">Registry Number:</span>
            <span className="font-medium text-gray-800">
              {kycData?.registryNumber || 'Pending Extraction'}
            </span>
          </div>
          
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-600">Date of Birth:</span>
            <span className="font-medium text-gray-800">
              {kycData?.dob || 'Pending Extraction'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 text-center text-sm text-gray-500">
        <p>You will receive notification once your KYC verification is complete.</p>
      </div>
    </div>
  );
};

export default KycPendingPanel;
