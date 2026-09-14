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

# expo-image-picker
-keep class expo.modules.imagepicker.** { *; }
-dontwarn expo.modules.imagepicker.**

# expo-web-browser
-keep class expo.modules.webbrowser.** { *; }
-dontwarn expo.modules.webbrowser.**

# expo-sharing
-keep class expo.modules.sharing.** { *; }
-dontwarn expo.modules.sharing.**

# expo-print
-keep class expo.modules.print.** { *; }
-dontwarn expo.modules.print.**

# expo-dom-webview
-keep class expo.modules.domwebview.** { *; }
-dontwarn expo.modules.domwebview.**

# expo-dev-client / expo-dev-launcher (release builds)
-keep class expo.modules.devclient.** { *; }
-keep class expo.modules.devlauncher.** { *; }
-dontwarn expo.modules.devclient.**
-dontwarn expo.modules.devlauncher.**

# expo-dev-menu
-keep class expo.modules.devmenu.** { *; }
-dontwarn expo.modules.devmenu.**

# expo-log-box
-keep class expo.modules.logbox.** { *; }
-dontwarn expo.modules.logbox.**

# expo-updates-interface
-keep class expo.modules.updatesinterface.** { *; }
-dontwarn expo.modules.updatesinterface.**

# Solana Mobile Wallet Adapter
-keep class com.solanamobile.** { *; }
-dontwarn com.solanamobile.**

# react-native-masked-view
-keep class com.th3rdwave.** { *; }
-dontwarn com.th3rdwave.**

# react-native-gesture-handler
-keep class com.swmansion.gesturehandler.** { *; }
-dontwarn com.swmansion.gesturehandler.**

# react-native-svg
-keep class com.horcrux.svg.** { *; }
-keep class com.facebook.react.views.image.** { *; }
-dontwarn com.horcrux.svg.**

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

# Additional R8 protection
-keepattributes *Annotation*
-dontwarn com.google.protobuf.**

# Solana - don't strip native libs
-keep class com.solanamobile.** { *; }
-dontwarn com.solanamobile.**

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
