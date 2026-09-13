# Add project specific ProGuard rules here.

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**
-dontwarn com.facebook.react.modules.network.**

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# React Native FlashList
-keep class com.shopify.flashlist.** { *; }
-dontwarn com.shopify.flashlist.**

# expo-modules
-keep class expo.modules.** { *; }
-keep class expo.modules.kotlin.** { *; }
-dontwarn expo.modules.**

# expo-notifications
-keep class expo.modules.notifications.** { *; }
-dontwarn expo.modules.notifications.**

# expo-location
-keep class expo.modules.location.** { *; }
-dontwarn expo.modules.location.**

# expo-secure-store
-keep class expo.modules.securestore.** { *; }
-dontwarn expo.modules.securestore.**

# expo-file-system
-keep class expo.modules.filesystem.** { *; }
-dontwarn expo.modules.filesystem.**

# expo-image-picker (if used)
-keep class expo.modules.imagepicker.** { *; }
-dontwarn expo.modules.imagepicker.**

# Google Play Services (Firebase Messaging)
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# Razorpay
-keep class com.razorpay.** { *; }
-dontwarn com.razorpay.**

# Sentry
-keep class io.sentry.** { *; }
-dontwarn io.sentry.**

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# WebSocket client
-dontwarn org.java-websocket.**

# General React Native keep rules
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod
-keepattributes *Annotation*
-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
}
-keepclassmembers class *  {
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
}
-keepclassmembers class * implements com.facebook.react.touch.BasedReactEvent {
    public *;
}
