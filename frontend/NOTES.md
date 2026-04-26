# NPIS Frontend Development Notes

## Backend Integration Reminders

### Authentication System
- **Current**: Mock localStorage-based authentication
- **To Replace**: Real backend authentication endpoints
- **Files to Update**:
  - `src/services/authService.ts`
    - Replace `loginCitizen()` with POST `/api/auth/login`
    - Replace `loginAuthorized()` with POST `/api/auth/login` 
    - Update `getCurrentUser()` to validate token with backend
    - Add token refresh logic if needed
  - `src/pages/CitizenLoginPage.tsx`
    - Update form submission to handle real API responses
    - Add proper error handling for backend errors
  - `src/pages/AuthorizedLoginPage.tsx`
    - Same updates as citizen login
  - `src/pages/CitizenSignupPage.tsx`
    - Replace mock signup with POST `/api/auth/register`
    - Handle real KYC document upload endpoint

### KYC Processing
- **Current**: Mock status updates and placeholder data
- **To Replace**: Real KYC processing endpoints
- **Files to Update**:
  - `src/components/kyc/KycSubmissionPanel.tsx`
    - Replace mock submission with POST `/api/kyc/submit`
    - Handle real file upload with proper headers
  - `src/services/authService.ts`
    - Add `submitKycDocument()` function
    - Update `updateAccountStatus()` to sync with backend

### Application Management
- **Current**: Basic GET endpoints implemented
- **To Enhance**: Full CRUD operations
- **Files to Update**:
  - `src/components/kyc/CitizenDashboardContent.tsx`
    - Add POST `/api/applications` for new applications
    - Add PUT `/api/applications/:id` for updates
  - `src/pages/MukhtarDashboard.tsx`
    - Add POST `/api/applications/:id/sign` for e-signature
    - Add GET `/api/applications/:id/details` for detailed view

## UI/UX Improvements

### Form Validation
- **Current**: Basic client-side validation
- **To Add**: 
  - Real-time validation feedback
  - Phone number format validation
  - Email format validation
  - Password strength requirements
- **Files to Update**:
  - `src/pages/CitizenLoginPage.tsx`
  - `src/pages/CitizenSignupPage.tsx`
  - `src/pages/AuthorizedLoginPage.tsx`

### Error Handling
- **Current**: Basic alert() messages
- **To Add**: 
  - Toast notifications system
  - Proper error boundaries
  - Network error handling
  - Form-specific error messages
- **Files to Update**: All form components

### Loading States
- **Current**: Basic loading spinners
- **To Add**: 
  - Skeleton loaders for data tables
  - Progress indicators for file uploads
  - Button loading states
- **Files to Update**: All components with async operations

## Security Enhancements

### Token Management
- **Current**: Simple localStorage storage
- **To Add**:
  - HttpOnly cookies for tokens
  - CSRF protection
  - Token expiration handling
  - Secure token storage
- **Files to Update**:
  - `src/services/authService.ts`
  - All API calling components

### Input Sanitization
- **Current**: Basic form inputs
- **To Add**:
  - XSS protection
  - Input sanitization
  - File type validation
  - File size limits
- **Files to Update**: All form components

## Performance Optimizations

### Code Splitting
- **Current**: Single bundle
- **To Add**:
  - Route-based code splitting
  - Component lazy loading
  - Bundle optimization
- **Files to Update**:
  - `src/App.tsx` - Add lazy loading for routes

### API Caching
- **Current**: No caching
- **To Add**:
  - React Query or SWR for data fetching
  - Local storage caching for static data
  - Request deduplication
- **Files to Update**: All components with API calls

## Testing Requirements

### Unit Tests
- **Current**: No tests
- **To Add**: 
  - Component tests with Jest + React Testing Library
  - Service function tests
  - Hook tests
- **Files to Create**:
  - `src/__tests__/components/`
  - `src/__tests__/services/`
  - `src/__tests__/pages/`

### Integration Tests
- **Current**: No integration tests
- **To Add**:
  - End-to-end tests with Playwright
  - API integration tests
  - User flow tests

## Accessibility Improvements

### ARIA Labels
- **Current**: Basic semantic HTML
- **To Add**:
  - Proper ARIA labels for screen readers
  - Keyboard navigation support
  - Focus management
  - Color contrast compliance
- **Files to Update**: All interactive components

### Responsive Design
- **Current**: Basic responsive layout
- **To Enhance**:
  - Mobile-first approach
  - Touch-friendly interfaces
  - Proper viewport handling
  - Print-friendly styles

## Future Features

### Multi-language Support
- **To Add**: i18n implementation
- **Files to Update**: All text content components

### Theme System
- **To Add**: Dark/light mode toggle
- **Files to Update**: All styling components

### Offline Support
- **To Add**: Service worker implementation
- **Files to Update**: App shell and critical components

## Deployment Considerations

### Environment Variables
- **Current**: Hardcoded URLs
- **To Add**: 
  - `.env` files for different environments
  - API URL configuration
  - Feature flags
- **Files to Update**: 
  - `.env.development`
  - `.env.production`
  - API service files

### Build Optimization
- **Current**: Default Vite build
- **To Add**:
  - Asset optimization
  - Bundle analysis
  - Performance budgets
  - CDN configuration

## Database Schema Alignment

### Type Definitions
- **Current**: Basic interfaces
- **To Update**: Align with actual database schema
- **Files to Update**:
  - `src/services/authService.ts` - Update MockUser interface
  - `src/types.ts` - Add comprehensive type definitions
  - All API response handling

### Data Validation
- **Current**: No schema validation
- **To Add**: 
  - Zod or similar for runtime validation
  - API response type guards
  - Form data validation schemas

---

## Priority Order

1. **High Priority**: Authentication backend integration
2. **High Priority**: KYC processing endpoints
3. **Medium Priority**: Error handling improvements
4. **Medium Priority**: Form validation enhancements
5. **Low Priority**: Performance optimizations
6. **Low Priority**: Accessibility improvements

---

## Testing Checklist

- [ ] All forms validate correctly
- [ ] Authentication flows work end-to-end
- [ ] KYC submission process complete
- [ ] Dashboard data loads properly
- [ ] Mobile responsive design
- [ ] Error states display correctly
- [ ] Loading states work properly
- [ ] Logout functionality works
- [ ] Route protection functions correctly
