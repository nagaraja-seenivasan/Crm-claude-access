# MediaPipe GenAI uses JNI + reflection; keep it intact.
-keep class com.google.mediapipe.** { *; }
-keep class com.google.protobuf.** { *; }
-dontwarn com.google.mediapipe.**
-dontwarn com.google.auto.value.**
