import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

interface IdentityData {
  fullName: string;
  registryNumber: string;
  dob: string;
  documentType: string;
}

const IdentityVerificationPage = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<IdentityData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = authService.getCurrentUser();

  const handleExtractIdentity = async () => {
    if (!file) {
      alert('Please upload a document first');
      return;
    }

    setIsExtracting(true);

    // Mock extraction process
    setTimeout(() => {
      const mockExtractedData: IdentityData = {
        fullName: 'Pending Citizen',
        registryNumber: '123456789',
        dob: '1999-01-01',
        documentType: 'Lebanese ID Card'
      };

      setExtractedData(mockExtractedData);
      setIsExtracting(false);
    }, 2000);
  };

  const handleSubmitVerification = async () => {
    if (!extractedData) {
      alert('Please extract identity details first');
      return;
    }

    setIsSubmitting(true);

    // Save identity data to localStorage
    authService.saveIdentityData(extractedData);
    
    // Update user status
    authService.updateAccountStatus('PENDING_IDENTITY_VERIFICATION');

    setTimeout(() => {
      setIsSubmitting(false);
      navigate('/citizen/dashboard');
    }, 1000);
  };

  const handleInputChange = (field: keyof IdentityData, value: string) => {
    if (extractedData) {
      setExtractedData({
        ...extractedData,
        [field]: value
      });
    }
  };

  if (!currentUser || currentUser.role !== 'citizen') {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Identity Verification</h1>
            <p className="text-gray-600">Confirm your identity before using passport services</p>
          </div>

          {/* Step 1: Upload Document */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Step 1: Upload Document</h2>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="identity-document"
              />
              <label
                htmlFor="identity-document"
                className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Choose Identity Document
              </label>
              {file && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {file.name}
                </p>
              )}
            </div>
            
            <p className="text-sm text-gray-500 mt-2">
              After you upload your document, we will extract your identity details for review.
            </p>
          </div>

          {/* Extract Button */}
          <div className="mb-8">
            <button
              onClick={handleExtractIdentity}
              disabled={!file || isExtracting}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isExtracting ? 'Extracting identity details...' : 'Extract identity details'}
            </button>
          </div>

          {/* Review Extracted Details */}
          {extractedData && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Review extracted identity details</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={extractedData.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    National Registry Number
                  </label>
                  <input
                    type="text"
                    value={extractedData.registryNumber}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
                  />
                  <p className="text-xs text-gray-500 mt-1">Registry number is read-only for security</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={extractedData.dob}
                    onChange={(e) => handleInputChange('dob', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Document Type
                  </label>
                  <select
                    value={extractedData.documentType}
                    onChange={(e) => handleInputChange('documentType', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Lebanese ID Card">Lebanese ID Card</option>
                    <option value="Passport">Passport</option>
                    <option value="Residence Permit">Residence Permit</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          {extractedData && (
            <button
              onClick={handleSubmitVerification}
              disabled={isSubmitting}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Submitting for verification...' : 'Submit for verification'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default IdentityVerificationPage;
