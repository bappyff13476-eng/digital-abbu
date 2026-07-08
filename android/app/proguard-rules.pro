# React Native ProGuard Rules

# Keep React Native classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep our native modules
-keep class com.disciplinev8.** { *; }

# Keep annotations
-keepattributes *Annotation*

# Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# Don't warn about missing classes
-dontwarn com.facebook.**
-dontwarn com.google.**
