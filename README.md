# Voice home control — web app (Stage 1)

Standalone web app: speech recognition, speech synthesis, assistant name,
command history, settings, and simulated devices. No ESP32 required to test
this stage.

## Folder structure

```
web-app/
  index.html
  style.css
  app.js
```

## Running it

Speech recognition (`SpeechRecognition` / `webkitSpeechRecognition`) only
works in a **secure context** — `https://` or `http://localhost`. Opening
`index.html` directly as a `file://` path will usually block the microphone.

Easiest options in VS Code:
- Install the **Live Server** extension, right-click `index.html` → "Open with Live Server".
- Or run a quick local server from a terminal in this folder:
  ```
  python -m http.server 8080
  ```
  then open `http://localhost:8080` in **Chrome** (best Web Speech API support).

## Using it

- Tap the mic button and speak a command such as "turn on the fan" or
  "what is the temperature". Recognized speech is matched against the
  phrase list in `app.js` (`commandPatterns`) and converted to a command ID.
- You can also trigger any command with the on-screen buttons — useful for
  testing without relying on the microphone.
- Open **Settings** (gear icon) to:
  - Rename the assistant
  - Switch recognition language between English and Telugu
  - Switch between **Simulated** mode (fake device states, for early testing)
    and **ESP32 mode** (real network calls once your firmware is running —
    enter the ESP32's IP address shown in its Serial Monitor)
  - Toggle spoken responses on/off

## Adding more command phrases

Edit the `commandPatterns` array near the top of `app.js`. Matching is
substring-based (case-insensitive), so add as many natural variations as you
expect to say, in either language:

```js
{
  id: "FAN_ON",
  patterns: ["turn on the fan", "fan on", "ఫ్యాన్ ఆన్", "ఫ్యాన్ వేయి"]
}
```

## Known limitations to be aware of

- The Web Speech API's recognition in Chrome uses Google's cloud speech
  service — it needs an internet connection even though it's a "local"
  web app.
- True mixed-language recognition in a single utterance isn't supported by
  the browser API; you pick one recognition language at a time in settings.
  Command matching still checks both English and Telugu phrase lists
  regardless of which language is selected, so exact-language mismatches
  are less likely to cause a failed match.
- Telugu text-to-speech voice availability depends on the operating system
  and browser — if speech doesn't come out in Telugu, check
  `speechSynthesis.getVoices()` in the browser console to see what's
  installed.
- When you switch to ESP32 mode, the browser calls `http://<esp32-ip>/...`
  directly. If the page itself is served over `https://`, browsers will
  block that as mixed content — serve this app over plain `http://` (e.g.
  via `python -m http.server`) when testing against the real ESP32.

## Next stage

Once this is fully tested (voice → command → simulated device → history →
settings all working), the same `index.html` / `style.css` / `app.js` can be
wrapped into an Android APK (e.g. with Capacitor) with no rewrite needed —
only the "ESP32 mode" networking path changes from a demo to a real device.
