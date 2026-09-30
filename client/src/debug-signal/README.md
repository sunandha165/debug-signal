# DebugSignal — reference UI

Presentational-only React + TypeScript components for the DebugSignal main
screen. No networking, auth, GitHub integration, AssemblyAI, or investigation
logic — everything here is driven by props and the mock data in
`mockData.ts`, so it's safe to drop into any project and wire up later.

## What's inside

```
debug-signal/
  DebugSignalApp.tsx        Full reference layout (composes everything below)
  DebugSignalApp.css
  types.ts                  Shared prop/data types
  mockData.ts                Realistic placeholder data
  styles/
    tokens.css                Color, spacing, radius, shadow, font variables
    global.css                Base resets shared by all components
  components/
    Header/                  Top bar: logo, repo/branch pills, connection status
    Sidebar/                 Left nav rail
    VoiceOrb/                The animated liquid orb (idle/listening/thinking/speaking)
    Waveform/                Bars flanking the orb
    StatusPanel/             Orb + waveform + headline/subtext
    Controls/                Mute / End / Settings buttons
    InvestigationSteps/      "Investigating quietly…" checklist
    Conversation/            Developer/assistant transcript + composer
    Evidence/                Confidence card, diff preview, related commits
    SessionInfo/             Read-only session metadata card
```

## Using it

Import the full reference screen:

```tsx
import { DebugSignalApp } from "./debug-signal";

export default function App() {
  return <DebugSignalApp />;
}
```

Or use individual pieces in your own layout:

```tsx
import { VoiceOrb, StatusPanel, Controls } from "./debug-signal";
import type { VoiceState } from "./debug-signal";

function MyScreen() {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  return (
    <>
      <StatusPanel voiceState={voiceState} headline="I'm listening…" subtext="Tell me what's happening." />
      <Controls onEnd={() => setVoiceState("idle")} />
    </>
  );
}
```

## Wiring up real behavior later

Every component takes plain props and optional callbacks — none of them
fetch data or hold business logic:

- `VoiceOrb` / `StatusPanel` — pass a live `voiceState` ("idle" | "listening"
  | "thinking" | "speaking") from your AssemblyAI/session logic.
- `Conversation` — pass real `messages`, and implement `onSend`/`onClear`.
- `EvidencePanel` — pass a real `EvidenceSummary` once your investigation
  pipeline produces one; `onViewInGitHub`/`onViewFullDiff` are left to you.
- `Header` — pass live `connectionStatus` and repo/branch values.
- `Sidebar` — pass `onSelect` to hook into your router.

## Notes

- Only dependency is React (18+) — no UI kit, no CSS framework.
- Each component ships its own scoped `.css` file; `styles/tokens.css` holds
  the shared design tokens as CSS custom properties, so re-theming is a
  matter of overriding `--ds-*` variables.
- The small "preview voice state" button row inside `DebugSignalApp.tsx` is
  reference-only scaffolding for trying out the four orb states — delete it
  once real state drives `voiceState`.
