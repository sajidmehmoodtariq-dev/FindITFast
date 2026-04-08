import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthService, type OwnerRegistrationData, type AuthError } from '../../services/authService';
import { AdminService } from '../../services/adminService';

interface OwnerAuthProps {
  onAuthSuccess?: () => void;
  onAuthError?: (error: AuthError) => void;
  initialMode?: 'login' | 'register';
}

interface FormData extends OwnerRegistrationData {
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export const OwnerAuth: React.FC<OwnerAuthProps> = ({ onAuthSuccess, onAuthError, initialMode = 'register' }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }

    if (name === 'email' && resetMessage) {
      setResetMessage(null);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!isLogin) {
      // Registration validation
      if (!formData.name.trim()) {
        newErrors.name = 'Name is required';
      }

      if (!formData.phone.trim()) {
        newErrors.phone = 'Phone number is required';
      } else if (!AuthService.isValidPhone(formData.phone)) {
        newErrors.phone = 'Please enter a valid phone number';
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    // Common validation for both login and registration
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!AuthService.isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (!AuthService.isValidPassword(formData.password)) {
      newErrors.password = 'Password must be at least 6 characters long';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});
    setResetMessage(null);

    try {
      if (isLogin) {
        const credential = await AuthService.signInOwner(formData.email, formData.password);
        const isAdmin = await AdminService.isAdminUid(credential.user.uid, credential.user.email || formData.email.trim().toLowerCase());

        if (isAdmin) {
          await AuthService.signOutOwner();
          setErrors({ general: 'This account is an app administrator. Please use Admin Login.' });
          setIsLoading(false);
          return;
        }
      } else {
        const registrationData: OwnerRegistrationData = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
        };
        await AuthService.registerOwner(registrationData, formData.password);
      }
      
      onAuthSuccess?.();
    } catch (error: any) {
      const authError = error as AuthError;
      setErrors({ general: authError.message });
      onAuthError?.(authError);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setErrors({});
    setFormData({
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    });
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = formData.email.trim().toLowerCase();
    setResetMessage(null);
    setErrors(prev => ({ ...prev, general: undefined, email: undefined }));

    if (!AuthService.isValidEmail(normalizedEmail)) {
      setErrors(prev => ({ ...prev, email: 'Enter a valid email to reset your password.' }));
      return;
    }

    try {
      await AuthService.sendResetPasswordEmail(normalizedEmail);
      setResetMessage('Password reset email sent. Please check your inbox.');
    } catch (resetError: any) {
      setErrors(prev => ({ ...prev, general: resetError.message || 'Failed to send reset email.' }));
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm p-6">
      {/* Go to Home Button */}
      <div className="flex justify-between items-center mb-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Go to Home
        </button>
      </div>
      
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">
          {isLogin ? 'Store Owner Login' : 'Store Owner Registration'}
        </h2>
        <p className="text-gray-600 mt-2">
          {isLogin 
            ? 'Sign in to manage your store' 
            : 'Create an account to add your store'
          }
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Registration-only fields */}
        {!isLogin && (
          <>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Your Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent ${
                  errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50'
                }`}
                placeholder="Enter your full name"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number *
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent ${
                  errors.phone ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50'
                }`}
                placeholder="Enter your phone number"
              />
              {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
            </div>
          </>
        )}

        {/* Common fields */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email Address *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent ${
              errors.email ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50'
            }`}
            placeholder="Enter your email address"
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
          {isLogin && (
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-gray-600 hover:text-gray-800 underline"
              >
                Forgot Password?
              </button>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            Password *
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent ${
              errors.password ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50'
            }`}
            placeholder="Enter your password"
          />
          {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
        </div>

        {/* Registration-only password confirmation */}
        {!isLogin && (
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password *
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent ${
                errors.confirmPassword ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-gray-50'
              }`}
              placeholder="Confirm your password"
            />
            {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
          </div>
        )}

        {/* General error message */}
        {errors.general && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-600 text-sm">{errors.general}</p>
            </div>
          </div>
        )}

        {resetMessage && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <p className="text-green-700 text-sm">{resetMessage}</p>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-gray-800 focus:ring-offset-2 transition-colors ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed text-white'
              : 'bg-gray-800 hover:bg-gray-900 text-white'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
              {isLogin ? 'Signing In...' : 'Creating Account...'}
            </span>
          ) : (
            isLogin ? 'Sign In' : 'Create Account'
          )}
        </button>

        {/* Admin login link */}
        <div className="text-center pt-2 pb-2">
          <button
            type="button"
            onClick={() => navigate('/admin/auth')}
            className="text-blue-600 hover:text-blue-800 text-xs underline transition-colors"
          >
            Admin Login
          </button>
        </div>

        {/* Toggle between login and registration */}
        <div className="text-center pt-4">
          <button
            type="button"
            onClick={toggleMode}
            className="text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
          >
            {isLogin 
              ? "Don't have an account? Register here" 
              : "Already have an account? Sign in here"
            }
          </button>
        </div>
      </form>
    </div>
  );
};