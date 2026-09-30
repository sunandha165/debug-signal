import type { VoiceState } from "../../types";
import "./VoiceOrb.css";

export interface VoiceOrbProps {
  voiceState: VoiceState;
  size?: number;
}

/**
 * The liquid, gradient orb that is the visual anchor of the main screen.
 * Purely CSS-animated (no canvas/WebGL) so it can be dropped into any
 * React project without extra dependencies. Behavior per state:
 *  - idle: slow, gentle drift, muted saturation
 *  - listening: brighter, tighter pulse in time with the waveform
 *  - thinking: gentle rotation with an orbiting highlight
 *  - speaking: outward glow rings + warmer color shift
 */
export function VoiceOrb({ voiceState, size = 260 }: VoiceOrbProps) {
  return (
    <div
      className={`ds-orb-wrap ds-orb-wrap--${voiceState}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Voice assistant is ${voiceState}`}
    >
      <span className="ds-orb-ring ds-orb-ring--1" aria-hidden="true" />
      <span className="ds-orb-ring ds-orb-ring--2" aria-hidden="true" />
      <div className="ds-orb" aria-hidden="true">
        <span className="ds-orb-blob ds-orb-blob--a" />
        <span className="ds-orb-blob ds-orb-blob--b" />
        <span className="ds-orb-blob ds-orb-blob--c" />
        <span className="ds-orb-sheen" />
      </div>
    </div>
  );
}
