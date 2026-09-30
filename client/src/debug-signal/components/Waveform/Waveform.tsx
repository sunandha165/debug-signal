import { useMemo } from "react";
import type { VoiceState } from "../../types";
import "./Waveform.css";

export interface WaveformProps {
  voiceState: VoiceState;
  bars?: number;
  side: "left" | "right";
}

/**
 * A row of soft vertical bars used beside the orb. Height variance and
 * animation speed change with voice state; in "idle" the bars sit low
 * and still.
 */
export function Waveform({ voiceState, bars = 14, side }: WaveformProps) {
  // Deterministic-looking pseudo-random heights so the bars read as a
  // waveform rather than a straight staircase, without needing real audio data.
  const heights = useMemo(() => {
    const seed = side === "left" ? 1 : 2;
    return Array.from({ length: bars }, (_, i) => {
      const wave = Math.sin(i * 0.9 + seed) * 0.5 + 0.5;
      return 0.25 + wave * 0.75;
    });
  }, [bars, side]);

  return (
    <div className={`ds-waveform ds-waveform--${voiceState} ds-waveform--${side}`} aria-hidden="true">
      {heights.map((h, i) => (
        <span
          key={i}
          className="ds-waveform-bar"
          style={{
            // eslint-disable-next-line
            ["--ds-bar-scale" as any]: h,
            animationDelay: `${i * 60}ms`,
          }}
        />
      ))}
    </div>
  );
}
