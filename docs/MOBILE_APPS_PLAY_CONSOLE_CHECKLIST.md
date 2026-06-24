# Google Play Console Upload Checklist

**Project:** 1HandIndia Multi-Vendor Marketplace
**Apps:** Mobile Customer App & Mobile Seller App
**Last Updated:** 2026-06-21

## Overview

This checklist tracks all requirements for uploading both mobile apps to Google Play Console and ensures compliance with Google Play policies, security standards, and data safety requirements.

---

## App Information

### Mobile Customer App
- **Package Name:** `com.onehandindia.customer`
- **App Name:** 1HandIndia
- **Current Version:** 0.1.1
- **Framework:** Expo/React Native
- **Build Type:** EAS Build
- **EAS Project ID:** `beab5054-3e1d-46a5-aeb0-11767e1bbdb0`

### Mobile Seller App
- **Package Name:** `com.onehandindia.seller`
- **App Name:** 1HandIndia Seller
- **Current Version:** 0.1.0
- **Framework:** Expo/React Native with Android Native Code
- **Build Type:** EAS Build
- **EAS Project ID:** `e017cb61-41d7-4e0f-9268-573106ddd729`

---

## PRE-UPLOAD REQUIREMENTS

### 1. Google Play Console Account Setup
- [ ] Create Google Play Console developer account ($25 one-time fee)
- [ ] Complete developer identity verification
- [ ] Add payment method for developer fees (if applicable)
- [ ] Create app listings for both apps in Play Console
- [ ] **Status:** ❌ NOT STARTED

### 2. App Signing & Security
- [ ] Generate/upload app signing key for customer app
- [ ] Generate/upload app signing key for seller app
- [ ] Configure Play App Signing for both apps
- [ ] Set up key rotation and backup procedures
- [ ] **Status:** ❌ NOT STARTED

### 3. Privacy Policy
- [ ] Create comprehensive privacy policy for customer app
- [ ] Create comprehensive privacy policy for seller app
- [ ] Host privacy policy on website (1handindia.com)
- [ ] Add privacy policy URL to both app store listings
- [ ] Include in Data Safety form
- [ ] **Status:** ❌ NOT STARTED

---

## GOOGLE PLAY POLICY COMPLIANCE

### 4. User Data Policy & Data Safety Section
- [ ] Complete Data Safety form for customer app
- [ ] Complete Data Safety form for seller app
- [ ] Declare all data collection (personal, financial, location, etc.)
- [ ] Declare all data sharing with third parties
- [ ] Declare all SDK/third-party library data collection
- [ ] Specify data purposes (authentication, analytics, functionality, etc.)
- [ ] Disclose security practices (encryption in transit/at rest)
- [ ] Disclose data retention and deletion policies
- [ ] Disclose account security measures
- [ ] Audit all third-party SDKs for data collection
- [ ] Review all app permissions and justify each
- [ ] **Status:** ❌ NOT STARTED

### 5. Security Requirements
- [ ] Implement Play Integrity API (fraud prevention, app authenticity)
- [ ] Enable HTTPS/TLS for all network communications
- [ ] Implement proper encryption for sensitive data storage
- [ ] Secure authentication mechanisms (Clerk integration)
- [ ] Implement secure token storage (expo-secure-store)
- [ ] Add certificate pinning for API calls
- [ ] Implement secure coding practices
- [ ] Conduct security audit/penetration testing
- [ ] **Status:** ⚠️ PARTIAL - Basic security implemented, Play Integrity API missing

### 6. Content Rating & Target Audience
- [ ] Complete content rating questionnaire for customer app
- [ ] Complete content rating questionnaire for seller app
- [ ] Declare target audience and age groups
- [ ] Ensure appropriate content for declared rating
- [ ] **Status:** ❌ NOT STARTED

### 7. App Permissions Justification
- [ ] **Customer App Permissions:**
  - [ ] ACCESS_COARSE_LOCATION - Justification needed
  - [ ] ACCESS_FINE_LOCATION - Justification needed
  - [ ] POST_NOTIFICATIONS - Justification needed
- [ ] **Seller App Permissions:**
  - [ ] INTERNET - Justify (API communication)
  - [ ] READ_EXTERNAL_STORAGE - Justify (image picker for products)
  - [ ] WRITE_EXTERNAL_STORAGE - Justify (image picker for products)
  - [ ] RECORD_AUDIO - Justify needed
  - [ ] SYSTEM_ALERT_WINDOW - Justify needed
  - [ ] VIBRATE - Justify needed
- [ ] Document permission use in privacy policy
- [ ] **Status:** ❌ NOT STARTED

---

## STORE LISTING REQUIREMENTS

### 8. App Store Listing - Customer App
- [ ] App title (32 char max): "1HandIndia"
- [ ] Short description (80 char max)
- [ ] Full description (4000 char max)
- [ ] Screenshots (at least 2, up to 8)
  - [ ] Phone screenshots (required)
  - [ ] Tablet screenshots (recommended)
- [ ] App icon (512x512 PNG, no transparency)
- [ ] Feature graphic (1024x500 PNG)
- [ ] App category selection (Shopping/E-commerce)
- [ ] Privacy policy URL
- [ ] Contact email
- [ ] Website URL (1handindia.com)
- [ ] YouTube promotional video (optional)
- [ ] **Status:** ⚠️ PARTIAL - Basic assets exist, store listing not created

### 9. App Store Listing - Seller App
- [ ] App title (32 char max): "1HandIndia Seller"
- [ ] Short description (80 char max)
- [ ] Full description (4000 char max)
- [ ] Screenshots (at least 2, up to 8)
  - [ ] Phone screenshots (required)
  - [ ] Tablet screenshots (recommended)
- [ ] App icon (512x512 PNG, no transparency)
- [ ] Feature graphic (1024x500 PNG)
- [ ] App category selection (Business/Productivity)
- [ ] Privacy policy URL
- [ ] Contact email
- [ ] Website URL (1handindia.com)
- [ ] YouTube promotional video (optional)
- [ ] **Status:** ⚠️ PARTIAL - Basic assets exist, store listing not created

---

## APP TESTING & QUALITY

### 10. Pre-Launch Report & Testing
- [ ] Run internal testing track for customer app
- [ ] Run internal testing track for seller app
- [ ] Fix critical issues found in pre-launch report
- [ ] Test on multiple Android versions (API 21+)
- [ ] Test on multiple screen sizes/densities
- [ ] Test on different devices (phone, tablet)
- [ ] Test all core functionality end-to-end
- [ ] Test payment flows (Razorpay integration)
- [ ] Test notification delivery
- [ ] Test location services
- [ ] Test offline behavior
- [ ] Test deep linking and intent filters
- [ ] **Status:** ❌ NOT STARTED

### 11. Performance & Stability
- [ ] Optimize app startup time
- [ ] Optimize APK/AAB size
- [ ] Fix memory leaks and performance issues
- [ ] Ensure smooth frame rates (60fps)
- [ ] Handle network errors gracefully
- [ ] Implement proper error handling
- [ ] Add crash reporting (Sentry integration present)
- [ ] Monitor ANR (Application Not Responding) rates
- [ ] **Status:** ⚠️ PARTIAL - Sentry integrated, performance optimization needed

---

## TECHNICAL REQUIREMENTS

### 12. App Bundle & Build Configuration
- [ ] Configure production build in EAS for customer app
- [ ] Configure production build in EAS for seller app
- [ ] Set correct version codes and version names
- [ ] Configure ProGuard/R8 for code obfuscation
- [ ] Optimize resources and assets
- [ ] Remove debug code and logging
- [ ] Configure build variants correctly
- [ ] Test release build thoroughly
- [ ] **Status:** ⚠️ PARTIAL - EAS configured, production build optimization needed

### 13. SDK & Dependencies
- [ ] Audit all third-party SDKs for policy compliance
- [ ] Update all dependencies to latest stable versions
- [ ] Remove unused dependencies
- [ ] Review SDK data collection and include in Data Safety form
- [ ] Check Google Play SDK Index for SDK guidance
- [ ] Ensure no deprecated or banned SDKs
- [ ] **Status:** ⚠️ PARTIAL - Dependencies managed via workspace, audit needed

### 14. Android Manifest Configuration
- [ ] **Customer App:**
  - [x] Package name: com.onehandindia.customer
  - [x] Deep links configured for web URLs
  - [x] Permissions declared
  - [ ] Min SDK version specified and justified
  - [ ] Target SDK version (should be latest)
  - [ ] Screen orientations (portrait enforced)
  - [ ] Backup rules configured
- [ ] **Seller App:**
  - [x] Package name: com.onehandindia.seller
  - [x] Deep links configured
  - [x] Permissions declared
  - [ ] Min SDK version specified and justified
  - [ ] Target SDK version (should be latest)
  - [ ] Screen orientations (portrait enforced)
  - [ ] Backup rules configured
- [ ] **Status:** ⚠️ PARTIAL - Basic config present, refinement needed

---

## INTEGRATION & SERVICES

### 15. Push Notifications
- [ ] Configure Firebase Cloud Messaging (FCM)
- [ ] Add google-services.json to customer app
- [ ] Add google-services.json to seller app
- [ ] Test notification delivery across Android versions
- [ ] Handle notification permissions properly
- [ ] Implement notification channels
- [ ] **Status:** ⚠️ PARTIAL - Expo notifications configured, FCM setup incomplete

### 16. Analytics & Crash Reporting
- [ ] Configure Firebase Analytics (optional)
- [ ] Configure Google Analytics for Firebase
- [ ] Configure crash reporting (Sentry present)
- [ ] Set up performance monitoring
- [ ] Ensure analytics comply with privacy policy
- [ ] Include analytics in Data Safety form
- [ ] **Status:** ⚠️ PARTIAL - Sentry configured, Firebase analytics optional

### 17. Payment Integration
- [ ] Verify Razorpay integration compliance
- [ ] Ensure PCI-DSS compliance for payment handling
- [ ] Test payment flows thoroughly
- [ ] Handle payment errors gracefully
- [ ] Include payment data in Data Safety form
- [ ] **Status:** ✅ COMPLETE - Razorpay integrated and tested

---

## LOCATION & TARGETING

### 18. Geographic Availability
- [ ] Select countries for distribution
- [ ] Configure pricing for different countries (if paid app)
- [ ] Ensure compliance with local regulations
- [ ] Set up localization for different languages (if needed)
- [ ] **Status:** ❌ NOT STARTED

### 19. Age Rating & Content
- [ ] Complete age rating questionnaire
- [ ] Set appropriate age rating
- [ ] Ensure content matches rating
- [ ] Add age gates if needed
- [ ] **Status:** ❌ NOT STARTED

---

## POLICY COMPLIANCE CHECKS

### 20. Personal & Sensitive Information
- [ ] Review handling of personal information
- [ ] Ensure secure storage of sensitive data
- [ ] Implement proper data encryption
- [ ] Provide data deletion options
- [ ] Comply with GDPR, CCPA, etc.
- [ ] **Status:** ⚠️ PARTIAL - Basic security present, compliance audit needed

### 21. Spam & Minimum Functionality
- [ ] Ensure app provides core functionality
- [ ] No spam content or behavior
- [ ] No deceptive or misleading content
- [ ] No fake reviews or ratings
- [ ] **Status:** ✅ COMPLETE - Full functional marketplace app

### 22. Intellectual Property
- [ ] Ensure no trademark infringement
- [ ] Verify all assets (images, icons) have proper licenses
- [ ] Respect copyright for all content
- [ ] No counterfeit goods or services
- [ ] **Status:** ✅ COMPLETE - Custom brand assets

---

## RELEASE MANAGEMENT

### 23. Release Tracks
- [ ] Set up internal testing track
- [ ] Set up closed testing track
- [ ] Set up open testing track
- [ ] Configure production release
- [ ] Set up staged rollouts
- [ ] **Status:** ❌ NOT STARTED

### 24. Rollout Strategy
- [ ] Plan initial rollout percentage (suggested: 5-10%)
- [ ] Monitor crash-free users metrics
- [ ] Monitor ANR rates
- [ ] Monitor user feedback and ratings
- [ ] Prepare rollback plan
- [ ] **Status:** ❌ NOT STARTED

---

## POST-UPLOAD REQUIREMENTS

### 25. Ongoing Compliance
- [ ] Monitor Google Play Console alerts
- [ ] Respond to policy violations promptly
- [ ] Update Data Safety form when data practices change
- [ ] Keep privacy policy updated
- [ ] Monitor app reviews and feedback
- [ ] **Status:** ❌ NOT STARTED

### 26. Maintenance & Updates
- [ ] Plan regular update schedule
- [ ] Monitor bug reports and crashes
- [ ] Keep dependencies updated
- [ ] Test updates thoroughly before release
- [ ] Maintain version compatibility
- [ ] **Status:** ❌ NOT STARTED

---

## CRITICAL PATH SUMMARY

### Must Complete Before First Upload
1. **Google Play Console account setup** - Account creation and verification
2. **Privacy Policy** - Create and host privacy policy for both apps
3. **Data Safety Form** - Complete for both apps with all data declarations
4. **Store Listing** - Create complete listings with assets for both apps
5. **Play Integrity API** - Implement for security compliance
6. **App Signing** - Configure app signing keys
7. **Security Audit** - Ensure all security requirements met
8. **Testing** - Thorough testing on multiple devices
9. **Production Build** - Build optimized release versions

### Can Complete After Upload
- Additional language localizations
- Advanced analytics integration
- Performance optimization iterations
- Staged rollout adjustments

---

## CURRENT STATUS SUMMARY

### Mobile Customer App
- **Framework:** ✅ Expo/React Native configured
- **Basic Config:** ✅ App name, package, version set
- **Assets:** ✅ Icons, splash screens present
- **Auth:** ✅ Clerk integration
- **Payments:** ✅ Razorpay integrated
- **Security:** ⚠️ Basic security, Play Integrity API missing
- **Privacy:** ❌ Privacy policy not created
- **Data Safety:** ❌ Form not completed
- **Store Listing:** ❌ Not created in Play Console
- **Testing:** ❌ Pre-launch testing not done
- **Build:** ⚠️ EAS configured, production build optimization needed

### Mobile Seller App
- **Framework:** ✅ Expo/React Native with Android native code
- **Basic Config:** ✅ App name, package, version set
- **Assets:** ✅ Icons, splash screens present
- **Auth:** ✅ Clerk integration
- **File Handling:** ✅ Image picker configured
- **Security:** ⚠️ Basic security, Play Integrity API missing
- **Privacy:** ❌ Privacy policy not created
- **Data Safety:** ❌ Form not completed
- **Store Listing:** ❌ Not created in Play Console
- **Testing:** ❌ Pre-launch testing not done
- **Build:** ⚠️ EAS configured, production build optimization needed

---

## IMMEDIATE ACTION ITEMS (Priority Order)

1. **Create Privacy Policy** (Both Apps) - Week 1
2. **Complete Data Safety Forms** (Both Apps) - Week 1-2
3. **Implement Play Integrity API** (Both Apps) - Week 2
4. **Create Store Listings** (Both Apps) - Week 2
5. **Configure App Signing** (Both Apps) - Week 2
6. **Security Audit** (Both Apps) - Week 2-3
7. **Pre-Launch Testing** (Both Apps) - Week 3
8. **Build Production Release** (Both Apps) - Week 3-4
9. **Upload to Play Console** (Both Apps) - Week 4

---

## REFERENCES & RESOURCES

- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Data Safety Requirements](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Play Integrity API](https://developer.android.com/play/integrity)
- [Google Play Policy Center](https://play.google.com/about/developer-content-policy)
- [Google Play SDK Index](https://play.google.com/sdks)
- [Expo EAS Build Documentation](https://docs.expo.dev/build/introduction/)

---

## NOTES

- Both apps use the same backend API, so data handling policies should be consistent
- Seller app has additional permissions for file handling (image picker)
- Customer app uses location services for delivery addresses
- Both apps use expo-secure-store for sensitive data storage
- Sentry is configured for crash reporting in both apps
- Razorpay integration is complete and tested
- Deep linking is configured for web app integration