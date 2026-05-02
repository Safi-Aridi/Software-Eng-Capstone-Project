import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';

const IdentityVerificationRejectedPanel = () => {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  const handleResubmit = () => {
    navigate('/identity-verification');
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
            <h2 className="text-2xl font-bold text-gray-800">Identity Verification Resubmission Required</h2>
            <p className="text-gray-600">Your identity verification needs to be updated</p>
          </div>
        </div>
      </div>

      {currentUser?.kycIssueDescription && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-red-800 mb-2">Issue Description</h3>
          <p className="text-red-700">{currentUser.kycIssueDescription}</p>
        </div>
      )}

      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-orange-800 mb-2">Next Steps</h3>
        <p className="text-orange-700 text-sm">
          Please upload a new identity document addressing the issues mentioned above. 
          Your document will be reviewed again after submission.
        </p>
      </div>

      <div className="text-center">
        <button
          onClick={handleResubmit}
          className="bg-orange-600 text-white px-6 py-2 rounded-md hover:bg-orange-700 transition-colors"
        >
          Resubmit Identity Verification
        </button>
      </div>

      <div className="mt-6 text-center text-sm text-gray-500">
        <p>If you need assistance, please contact support.</p>
      </div>
    </div>
  );
};

export default IdentityVerificationRejectedPanel;
