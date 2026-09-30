import type { VoiceState } from "../../types";
import { VoiceOrb } from "../VoiceOrb/VoiceOrb";
import { Waveform } from "../Waveform/Waveform";
import "./StatusPanel.css";

export interface StatusPanelProps {
  voiceState: VoiceState;
  headline: string;
  subtext: string;
}

const stateLabel: Record<VoiceState, string> = {
  idle: "IDLE",
  listening: "LISTENING",
  thinking: "THINKING",
  speaking: "SPEAKING",
};

/**
 * The hero region of the main screen: a small state label, the orb flanked
 * by waveform bars, and a headline/subtext pair describing what's happening.
 */
export function StatusPanel({ voiceState, headline, subtext }: StatusPanelProps) {
  return (
    <div className="ds-status-panel">
      <span className="ds-status-panel-label">{stateLabel[voiceState]}</span>

      <div className="ds-status-panel-orb-row">
        <Waveform voiceState={voiceState} side="left" />
        <VoiceOrb voiceState={voiceState} />
        <Waveform voiceState={voiceState} side="right" />
      </div>

      <h2 className="ds-status-panel-headline">{headline}</h2>
      <p className="ds-status-panel-subtext">{subtext}</p>
    </div>
  );
}
