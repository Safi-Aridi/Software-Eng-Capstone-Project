import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

const CitizenSignupPage = () => {
  const [formData, setFormData] = useState({
    mobileNumber: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [kycFile, setKycFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Validation
      if (!formData.mobileNumber || !formData.email || !formData.password || !formData.confirmPassword) {
        throw new Error('All fields are required');
      }

      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (!kycFile) {
        throw new Error('KYC document is required');
      }

      // Mock signup with KYC submission
      const mockUser = authService.loginCitizen(formData.mobileNumber, formData.password);
      
      // Update account status to pending KYC
      authService.updateAccountStatus('PENDING_KYC');
      
      // Store placeholder extracted identity data
      authService.updateKycData({
        fullName: 'Pending Extraction',
        registryNumber: 'Pending Extraction',
        dob: 'Pending Extraction'
      });

      alert('Account created successfully! KYC document submitted for verification. Identity information will be extracted automatically.');
      navigate('/citizen/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Create Citizen Account</h1>
            <p className="text-gray-600">Register for passport application services</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-800 mb-2">Important Information</h3>
            <p className="text-blue-700 text-sm">
              Identity information will be extracted automatically from your submitted KYC document. 
              Your account will remain limited until verification is accepted.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  name="mobileNumber"
                  value={formData.mobileNumber}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter mobile number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter email address"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Create password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password *
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirm password"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                KYC Document *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setKycFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="kyc-document"
                />
                <label
                  htmlFor="kyc-document"
                  className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Choose KYC Document
                </label>
                {kycFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    Selected: {kycFile.name}
                  </p>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Accepted formats: PDF, JPG, JPEG, PNG. Maximum file size: 5MB
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Creating Account...' : 'Create Account & Submit KYC'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-gray-600">Already have an account? </span>
            <a href="/" className="text-blue-600 hover:underline font-medium">
              Sign in
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CitizenSignupPage;
