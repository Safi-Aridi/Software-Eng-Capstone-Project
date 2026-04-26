import { useState } from 'react';
import { authService } from '../../services/authService';

const KycRejectedPanel = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const currentUser = authService.getCurrentUser();
  const kycIssueDescription = currentUser?.kycIssueDescription;

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert('Please select a KYC document to upload');
      return;
    }

    setIsSubmitting(true);
    
    // Mock resubmission - update account status back to pending
    setTimeout(() => {
      authService.updateAccountStatus('PENDING_KYC');
      
      // Update extracted identity data
      authService.updateKycData({
        fullName: 'Pending Extraction',
        registryNumber: 'Pending Extraction',
        dob: 'Pending Extraction'
      });
      
      alert('KYC document resubmitted successfully! Your document will be reviewed again.');
      setIsSubmitting(false);
    }, 1500);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">KYC Resubmission Required</h2>
            <p className="text-gray-600">Your KYC document needs to be updated</p>
          </div>
        </div>
      </div>

      {kycIssueDescription && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-red-800 mb-2">Issue Description</h3>
          <p className="text-red-700">{kycIssueDescription}</p>
        </div>
      )}

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-orange-800 mb-2">Next Steps</h3>
        <p className="text-orange-700 text-sm">
          Please upload a new KYC document addressing the issues mentioned above. 
          Your document will be reviewed again after submission.
        </p>
      </div>

      <form onSubmit={handleResubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload New KYC Document
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
              id="kyc-resubmit-file"
            />
            <label
              htmlFor="kyc-resubmit-file"
              className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Choose File
            </label>
            {file && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {file.name}
              </p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={!file || isSubmitting}
          className="w-full bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Resubmitting...' : 'Resubmit KYC Document'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-500">
        <p>If you need assistance, please contact support.</p>
      </div>
    </div>
  );
};

export default KycRejectedPanel;
