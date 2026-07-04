# CodeAgent — On-device AI coding agent (Android)

A fully-offline Android app that runs a local 4B-parameter LLM on-device, chats
in a coding-focused loop, and writes generated code to files/projects in
app-scoped storage. Built for the **ASUS ROG Phone 8 Pro** (Snapdragon 8 Gen 3,
Adreno 750, 16 GB RAM, Android 16) but runs on any arm64 Android 11+ device with
enough RAM.

- **UI:** Kotlin + Jetpack Compose (chat + project/file browser)
- **Inference:** MediaPipe LLM Inference (LiteRT) — GPU delegate with CPU fallback
- **Storage:** app-scoped external storage, no runtime permissions needed
- **Network:** none. The app does not hold `INTERNET` permission, so the OS
  guarantees it can never phone home.

---

## 1. Requirements

- Android Studio Ladybug (2024.2) or newer
- JDK 17 (bundled with recent Android Studio)
- Android SDK Platform 35, Build-Tools 35.x
- A physical arm64 device (the model won't fit/run on a typical emulator).
  **Emulators are not supported** — MediaPipe GenAI ships `arm64-v8a` only.

## 2. Project layout

```
android-ai-agent/
├─ settings.gradle.kts
├─ build.gradle.kts
├─ gradle.properties
├─ app/
│  ├─ build.gradle.kts
│  └─ src/main/
│     ├─ AndroidManifest.xml
│     ├─ java/dev/codeagent/
│     │  ├─ App.kt                     # service locator
│     │  ├─ MainActivity.kt            # Compose host + bottom-nav
│     │  ├─ llm/                       # InferenceEngine, MediaPipeEngine, ModelManager
│     │  ├─ agent/                     # system prompt, prompt builder, project parser
│     │  ├─ data/ProjectRepository.kt  # file tools + Downloads export
│     │  ├─ util/ThermalMonitor.kt     # thermal auto-stop
│     │  └─ ui/                        # ChatViewModel, ChatScreen, FilesScreen, FileViewerScreen
│     └─ res/
```

## 3. Build & run (debug)

```bash
# From android-ai-agent/
# First time only: generate the Gradle wrapper jar if it's missing
gradle wrapper --gradle-version 8.9   # or just open the folder in Android Studio

./gradlew :app:installDebug            # build + install onto a connected device
```

Or open `android-ai-agent/` in Android Studio, let it sync, pick your device,
and press Run.

## 4. Get a model (first-launch step)

The app **does not bundle a model** — you supply a `.task` / `.litertlm` bundle.
Recommended, in order of "just works" on MediaPipe:

| Model | Size (Q4) | Where |
|-------|-----------|-------|
| **Gemma 3 4B (IT), int4** | ~3 GB | [Hugging Face: `litert-community/Gemma3-4B-IT`](https://huggingface.co/litert-community) → `.task`/`.litertlm` |
| **Gemma 3 1B (IT), int4** | ~1 GB | same org — smaller/faster, weaker code |
| **Qwen2.5-Coder 3B, int4** | ~2 GB | convert to `.task` with the [AI Edge Torch generative converter](https://github.com/google-ai-edge/ai-edge-torch) |

The turnkey path is a **`.task` bundle from the LiteRT Community** on Hugging
Face (accept the license, download on a computer). Raw GGUF files are **not**
directly loadable by MediaPipe — they need conversion first; Qwen-Coder is the
better *coder* but takes the conversion step, Gemma 3 is the better *works-today*.

### Load it onto the device — two ways

**A. adb push (fast, recommended):**
```bash
adb push gemma3-4b-it-int4.task \
  /sdcard/Android/data/dev.codeagent/files/models/
```
Launch the app — it auto-detects and loads the model in the models folder.

**B. In-app import:** tap the **chip/memory icon** (top-right of Chat) and pick
the file with the system picker. The app streams it into its models folder
(multi-GB copy — do this once, then it's remembered).

## 5. Using it

- **Chat mode:** ask for a snippet ("write a Kotlin debounce extension"). Reply
  streams with a **tokens/sec** readout and a **Stop** button.
- **Project mode:** flip the *Project mode* chip, describe what to build, name the
  project. The agent is instructed to emit `` ```file: path `` blocks, which are
  parsed and written to
  `/sdcard/Android/data/dev.codeagent/files/projects/<name>/`.
- **Projects tab:** browse projects/files, open a file to **copy / edit / share**,
  or **export** a file or whole project to `Downloads/CodeAgent/<name>/`.

### Settings (gear icon)
- **Prefer GPU (Adreno)** toggle — off = force CPU.
- **Context window** 2K–16K. Larger = more RAM + slower prefill. Default 8K.
  When history overflows, the oldest turns are dropped and a banner warns you.
- **Temperature.** Changing settings reloads the model.

## 6. Signing a release APK

1. Create a keystore (once):
   ```bash
   keytool -genkey -v -keystore codeagent-release.jks \
     -keyalg RSA -keysize 2048 -validity 10000 -alias codeagent
   ```
2. Create `android-ai-agent/keystore.properties` (git-ignored):
   ```properties
   storeFile=/absolute/path/codeagent-release.jks
   storePassword=********
   keyAlias=codeagent
   keyPassword=********
   ```
3. In `app/build.gradle.kts`, uncomment the `signingConfig` line in
   `buildTypes.release` and add this block inside `android { }`:
   ```kotlin
   signingConfigs {
       create("release") {
           val props = java.util.Properties().apply {
               load(rootProject.file("keystore.properties").inputStream())
           }
           storeFile = file(props.getProperty("storeFile"))
           storePassword = props.getProperty("storePassword")
           keyAlias = props.getProperty("keyAlias")
           keyPassword = props.getProperty("keyPassword")
       }
   }
   ```
4. Build:
   ```bash
   ./gradlew :app:assembleRelease
   # → app/build/outputs/apk/release/app-release.apk  (signed, installable)
   ```
   Install with `adb install -r app/build/outputs/apk/release/app-release.apk`.

## 7. Thermals & battery

Sustained 4B generation heats any SoC. The app subscribes to the OS thermal
status and **auto-stops generation at `SEVERE`** (already-throttling territory),
with a warning banner from `MODERATE` up. For long sessions keep the ROG's
AeroActive cooler on / X Mode enabled.

---

## 8. Two honest limitations (read before you judge it)

1. **A 4B model is fine for snippets and single files, weak at real multi-file
   "projects."** It will confidently emit a folder tree, but the more files you
   ask for, the more likely something is truncated (output-token budget) or
   inconsistent across files. Treat *Project mode* as "scaffold a small thing,"
   not "build my app." For genuinely hard tasks, the honest answer is a
   cloud-API toggle — deliberately **not** included here because you asked for
   offline-first, and adding `INTERNET` would break that guarantee. It's a
   one-switch change (add the permission + a remote engine implementing
   `InferenceEngine`) if you later decide the tradeoff is worth it.

2. **It'll probably run on the GPU (Adreno), not the Hexagon NPU.** MediaPipe /
   LiteRT's LLM stack exposes a **GPU** and **CPU** backend; there is no stable
   public NPU (Hexagon/QNN) delegate for LLM inference on Snapdragon today. So
   "prefer NPU" realistically lands on the Adreno 750 GPU — still fast, just not
   the NPU specifically. The code is structured so that if/when a QNN delegate
   ships, it slots in behind the same `InferenceEngine` interface without touching
   the UI.
