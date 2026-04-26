import { useState } from 'react';
import { authService } from '../../services/authService';

const KycSubmissionPanel = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert('Please select a KYC document to upload');
      return;
    }

    setIsSubmitting(true);
    
    // Mock submission - update account status to pending
    setTimeout(() => {
      authService.updateAccountStatus('PENDING_KYC');
      
      // Store placeholder extracted identity data
      authService.updateKycData({
        fullName: 'Pending Extraction',
        registryNumber: 'Pending Extraction',
        dob: 'Pending Extraction'
      });
      
      alert('KYC document submitted successfully! Identity information will be extracted automatically.');
      setIsSubmitting(false);
      // Page will re-render with new status
    }, 1500);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">KYC Verification Required</h2>
        <p className="text-gray-600">
          You must complete Know Your Customer (KYC) verification before accessing passport application services.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-800 mb-2">Important Information</h3>
        <p className="text-blue-700 text-sm">
          Identity information will be extracted automatically from your submitted KYC document. 
          Your account will remain limited until verification is accepted.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload KYC Document
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
              id="kyc-file"
            />
            <label
              htmlFor="kyc-file"
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
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Submitting...' : 'Submit KYC Document'}
        </button>
      </form>
    </div>
  );
};

export default KycSubmissionPanel;
