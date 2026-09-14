# 1HandIndia Customer App — Google Play Store Upload Guide

**App:** 1HandIndia (Customer)
**Package:** com.onehandindia.customer
**Version:** 1.0.0 (versionCode 2)
**AAB File:** C:\Users\krish\Downloads\application-a09adda6-f107-424f-bacb-6400875243ff.aab
**File Size:** 75 MB
**Build Date:** September 14, 2026

---

## Table of Contents

1. [Create App in Play Console](#1-create-app-in-play-console)
2. [Complete Initial Setup](#2-complete-initial-setup)
3. [Complete Store Listing](#3-complete-store-listing)
4. [Set Up Testing Tracks](#4-set-up-testing-tracks)
5. [Submit for Production Review](#5-submit-for-production-review)
6. [Fix google-services.json for Future Builds](#6-fix-google-servicesjson-for-future-builds)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Create App in Play Console

### 1.1 Open Play Console

- Go to https://play.google.com/console
- Sign in with your Google account (owner: onehandindiasteam / Account ID: 8019286608768808647)
- You should see the Nexusnation studio account with 1 app (Nexus Hub)

### 1.2 Create a New App

1. Click **Create app** (top right)
2. Fill in the initial form:

| Field | Value |
|-------|-------|
| App name | 1HandIndia |
| Default language | English |
| App or game | App |
| Free or paid | Free |
| Declarations | Check all boxes (agree to policies, export compliance, etc.) |

3. Click **Create app**

### 1.3 Accept Developer Program Policies

- Read and accept the **Google Play Developer Program Policies**
- Accept the **US export laws** declaration
- Click **Confirm**

---

## 2. Complete Initial Setup

After creating the app, Play Console will show you a dashboard with several setup tasks. Complete them in order.

### 2.1 App Access

1. Click **App access**
2. Select **All functionality is available without special access**
3. Click **Save**

### 2.2 Ads

1. Click **Ads**
2. Select **Yes, my app contains ads** or **No, my app does not contain ads** (choose based on whether you show ads in the app)
3. Click **Save**

### 2.3 Content Rating

1. Click **How should your app be rated?**
2. Fill in the questionnaire:

| Question | Answer |
|----------|--------|
| Email address | *(your support email)* |
| Category | Shopping |
| Is your app directed at children? | No |
| Does your app contain violence? | No |
| Does your app contain sexual content? | No |
| Does your app contain profanity? | No |
| Does your app contain user-generated content? | No |
| Does your app require login? | No |
| Does your app have chat/messaging features? | No |
| Does your app collect or share user location? | Yes |
| Does your app share location with third parties? | No |
| Does your app collect or share personal information? | Yes |
| Does your app share personal information with third parties? | No |

3. Click **Next** then **Submit**
4. Click **Save** when done

### 2.4 Target Audience and Content

1. Click **Target audience and content**
2. Select age range:
   - **Primary:** 18 and over (or 13-17 if your app allows younger users)
   - **Secondary:** Leave empty if only targeting adults
3. Under "Content", make sure "Violence", "Sexual content", "Profanity", "User-generated content" are all set to **No**
4. Under "Data safety", you'll fill this in later
5. Click **Save**

### 2.5 Privacy Policy

1. Click **Privacy policy**
2. Enter your privacy policy URL:
   ```
   https://1handindia.com/privacy-policy
   ```
3. Click **Save**

### 2.6 App Content (Data Safety)

1. Click **App content** in the left sidebar
2. Fill in each section:

#### Privacy policy
- URL: `https://1handindia.com/privacy-policy`

#### Data safety
- Does your app collect or share user data? **Yes**
- Fill in the data collection form (you can update this later):
  - **Location:** Collected (approximate and precise) — for delivery addresses
  - **Personal info:** Name, phone number, email address — for user accounts
  - **Financial info:** Payment info (via Razorpay)
  - **Photos/media:** If you use image picker for profile photos
  - All other categories: Not collected
- Data is not shared with third parties (except payment processor)

#### Ads
- Already completed in section 2.2

#### App access
- Already completed in section 2.1

#### Content rating
- Already completed in section 2.3

#### Target audience
- Already completed in section 2.4

#### News apps
- Select **No**

---

## 3. Complete Store Listing

1. Go to **Grow** > **Store presence** > **Main store listing**

### App Details

| Field | Value |
|-------|-------|
| App name | 1HandIndia |
| Short description | Order groceries, vegetables, and daily essentials from local stores near you. Fast delivery, great deals. |
| Full description | See template below |
| App icon | Upload 512x512 px PNG (from `apps/mobile-customer/assets/icon.png`) |
| Feature graphic | Upload 1024x500 px PNG |
| Phone screenshots | Upload 2-8 screenshots (min 320x569 px, max 3840x3840 px) |
| 7-inch tablet screenshots | Optional |
| 10-inch tablet screenshots | Optional |
| Category | Shopping |
| Tags | grocery delivery, online shopping, local stores |

### Full Description Template

```
1HandIndia - Your Neighborhood Store, Delivered.

SHOP FROM LOCAL STORES
Browse a wide range of products from stores near you — groceries, vegetables, fruits, dairy, snacks, household essentials, and more. Support local businesses while getting everything you need at your doorstep.

FAST DELIVERY
Get your orders delivered in minutes. We partner with local delivery partners to ensure quick and reliable delivery to your location.

EASY PAYMENTS
Pay securely using UPI, cards, or cash on delivery. Multiple payment options for your convenience.

TRACK YOUR ORDER
Real-time order tracking so you know exactly where your order is and when it will arrive.

GREAT DEALS
Enjoy exclusive deals, discounts, and offers from your favorite local stores.

WHY 1HANDINDIA?
- Support local businesses
- Fresh groceries and daily essentials
- Fast and reliable delivery
- Secure payments
- Easy returns and refunds

Download 1HandIndia today and experience the future of local shopping.

Privacy Policy: https://1handindia.com/privacy-policy
Terms of Service: https://1handindia.com/terms
Contact: support@1handindia.com
```

---

## 4. Set Up Testing Tracks

### 4.1 Internal Testing (First)

Before going live, test the app with a small group.

1. Go to **Testing** > **Internal testing**
2. Click **Create new release**

### 4.2 Upload the AAB

1. Under "App bundles and APKs", click **Upload**
2. Select your AAB file:
   ```
   C:\Users\krish\Downloads\application-a09adda6-f107-424f-bacb-6400875243ff.aab
   ```
3. Wait for Google to process the file (1-2 minutes)
4. You should see the version listed with a green checkmark

### 4.3 Add Release Details

1. Enter release name: `v1.0.0 (1)`
2. Enter release notes:
   ```
   Initial test release. Testing the 1HandIndia customer app on Android devices.
   ```
3. Click **Save**

### 4.4 Add Testers

1. Click **Testers** tab
2. Add tester email addresses (your own email and team members)
3. Testers will receive an email invitation

### 4.5 Roll Out to Internal Testing

1. Click **Review release** (bottom right)
2. Click **Start rollout to Internal testing**
3. Confirm by clicking **Rollout**

### 4.6 Test on Your Device

Testers will:
1. Receive an email from Google Play
2. Click the link to join the test
3. Open the Play Store on their Android device
4. Tap **Become a tester**
5. Install the app and test all features

### 4.7 Testing Checklist

- [ ] App installs successfully
- [ ] Splash screen displays correctly
- [ ] Login/sign-up works
- [ ] Store browsing works
- [ ] Product listing works
- [ ] Cart functionality works
- [ ] Razorpay payment integration works
- [ ] Order placement works
- [ ] Order tracking works
- [ ] Notifications are received
- [ ] Profile page works
- [ ] App doesn't crash on any screens

---

## 5. Submit for Production Review

### 5.1 Prerequisites

- [x] App created in Play Console
- [x] Store listing completed
- [x] Content rating completed
- [x] Privacy policy live
- [x] Data safety filled in
- [x] Internal testing validated

### 5.2 Create Production Release

1. Go to **Production** in the left sidebar
2. Click **Create new release**
3. Upload the same AAB or a new one if you've made changes:
   ```
   C:\Users\krish\Downloads\application-a09adda6-f107-424f-bacb-6400875243ff.aab
   ```
4. Fill in:
   - **Release name:** v1.0.0
   - **Release notes:**
     ```
     Initial production release of 1HandIndia customer app.
     - Browse stores near you
     - Order groceries and daily essentials
     - Fast delivery to your doorstep
     - Secure payments with Razorpay
     ```
5. Click **Save**

### 5.3 Complete Production Checklist

Before rolling out, make sure everything is complete:

| Section | Status |
|---------|--------|
| App access | Done (Section 2.1) |
| Ads | Done (Section 2.2) |
| Content rating | Done (Section 2.3) |
| Target audience | Done (Section 2.4) |
| Privacy policy | Done (Section 2.5) |
| Data safety | Done (Section 2.6) |
| Store listing | Done (Section 3) |
| App signing | Auto-configured by EAS |

### 5.4 Roll Out to Production

1. Click **Review release** (bottom right)
2. Review the summary — it should show all sections as green/complete
3. Click **Start rollout to production**
4. Confirm the rollout

### 5.5 Review Timeline

- **Review time:** 1-3 business days (usually faster for new apps)
- Google checks for: policy compliance, malware, functionality, store listing quality
- You'll receive an email when the review is complete
- If approved, the app will be live on Google Play Store
- If rejected, you'll get a detailed reason — fix it and resubmit

### 5.6 After Approval

Once live:
- Users can find the app by searching "1HandIndia" on Play Store
- Share the Play Store link with your users
- Monitor reviews and ratings
- Push updates via EAS builds

---

## 6. Fix google-services.json for Future Builds

### 6.1 The Problem

Your `google-services.json` is currently **force-added to git** to make EAS builds work. This exposes your Firebase API keys publicly. You need to move it to EAS credentials.

### 6.2 Upload to EAS Credentials

1. Go to https://expo.dev/accounts/onehandindiasteam/projects/onehandindia-customer/build/credentials
2. Scroll to the **Android** section
3. Look for **Google Services JSON** under "Credentials"
4. Click **Upload**
5. Select the file:
   ```
   E:\PROJECT WORKS\Clients\ecomm\apps\mobile-customer\android\app\google-services.json
   ```
6. Confirm the upload

### 6.3 Remove from Git

Once the file is uploaded to EAS:

```bash
cd "E:\PROJECT WORKS\Clients\ecomm"

# Remove from git tracking (keeps local file)
git rm --cached apps/mobile-customer/android/app/google-services.json

# Add to .gitignore
echo "apps/mobile-customer/android/app/google-services.json" >> .gitignore

# Commit and push
git add .gitignore
git commit -m "chore: remove google-services.json from git, use EAS credentials"
git push
```

### 6.4 Verify Next Build

Trigger a new build to confirm it picks up the file from EAS:

```bash
cd "E:\PROJECT WORKS\Clients\ecomm\apps\mobile-customer"
eas build --platform android --profile production
```

---

## 7. Troubleshooting

### Build fails with "google-services.json is missing"

**Cause:** The file isn't available to EAS during build.

**Fix:** Upload via EAS credentials page (see Section 6.2)

### Build fails with "Package name mismatch"

**Cause:** Mismatch between `applicationId` in `build.gradle`, `package_name` in `google-services.json`, and `expo.android.package` in `app.config.js`.

**Fix:** Ensure all three are `com.onehandindia.customer`

### App rejected from Play Store

**Cause:** Policy violation or missing information.

**Fix:** Read the rejection email, address each issue, and resubmit.

### Pre-launch report shows crashes

**Cause:** App crashing on certain devices.

**Fix:** Test locally on multiple devices, fix the crash, rebuild and resubmit.

---

## Quick Reference

| Item | Value |
|------|-------|
| Package name | com.onehandindia.customer |
| Firebase project | onehandindia-apps |
| Play Console | https://play.google.com/console |
| EAS credentials | https://expo.dev/accounts/onehandindiasteam/projects/onehandindia-customer/build/credentials |
| Current AAB | C:\Users\krish\Downloads\application-a09adda6-f107-424f-bacb-6400875243ff.aab |
| Privacy policy | https://1handindia.com/privacy-policy |
| Signing | Managed by EAS Build Credentials (ID: 1eaZBxc_EE) |
| Developer account | Nexusnation studio (Account ID: 8019286608768808647) |

---

*Generated on September 14, 2026*
