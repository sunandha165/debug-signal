import {
  useEffect,
  useRef,
  useState,
} from "react";

import type {
  VoiceState,
  SessionInfo as SessionInfoType,
  EvidenceSummary,
} from "./types";

import { Header } from "./components/Header/Header";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { StatusPanel } from "./components/StatusPanel/StatusPanel";
import { Controls } from "./components/Controls/Controls";
import { Conversation } from "./components/Conversation/Conversation";
import { EvidencePanel } from "./components/Evidence/EvidencePanel";
import { SessionInfo } from "./components/SessionInfo/SessionInfo";

import {
  mockConversation,
  mockNavItems,
} from "./mockData";

import {
  getRepositoryInfo,
  getVoiceToken,
  investigate,
} from "./api";

import "./styles/global.css";
import "./DebugSignalApp.css";

const SAMPLE_RATE = 24000;

const stateCopy: Record<
  VoiceState,
  { headline: string; subtext: string }
> = {
  idle: {
    headline: "Voice session ended",
    subtext:
      "Press refresh to start a new voice debugging session.",
  },

  listening: {
    headline: "I'm listening…",
    subtext:
      "Microphone is active. Tell me what's happening.",
  },

  thinking: {
    headline: "Investigating quietly…",
    subtext:
      "I'm checking the repository for concrete evidence.",
  },

  speaking: {
    headline: "I found something",
    subtext:
      "Strong evidence was found. I'm speaking up.",
  },
};

type MicrophoneStatus =
  | "inactive"
  | "requesting"
  | "active"
  | "muted"
  | "denied"
  | "error";

type PendingTool = {
  callId: string;
  result: unknown;
};

type AssemblyAIEvent = {
  type?: string;

  text?: string;

  data?: string;

  name?: string;

  call_id?: string;

  arguments?: Record<
    string,
    unknown
  >;

  status?: string;

  interrupted?: boolean;

  code?: string;

  message?: string;
};

function arrayBufferToBase64(
  buffer: ArrayBuffer
): string {
  const bytes =
    new Uint8Array(buffer);

  let binary = "";

  const chunkSize = 0x8000;

  for (
    let offset = 0;
    offset < bytes.length;
    offset += chunkSize
  ) {
    const chunk =
      bytes.subarray(
        offset,
        Math.min(
          offset + chunkSize,
          bytes.length
        )
      );

    binary += String.fromCharCode(
      ...chunk
    );
  }

  return btoa(binary);
}

function createPCMWorkletURL(): string {
  const processorCode = `
    class DebugSignalPCMProcessor extends AudioWorkletProcessor {
     process(inputs, outputs) {
  const channel = inputs[0]?.[0];
  const output = outputs[0]?.[0];

  if (!channel) {
    return true;
  }

  let sum = 0;

  const pcm = new Int16Array(channel.length);

  for (let i = 0; i < channel.length; i++) {
    const sample = Math.max(
      -1,
      Math.min(1, channel[i])
    );

    sum += sample * sample;

    pcm[i] =
      sample < 0
        ? sample * 0x8000
        : sample * 0x7fff;
  }

  const rms = Math.sqrt(
    sum / channel.length
  );

  this.port.postMessage(
    {
      pcm: pcm.buffer,
      rms
    },
    [pcm.buffer]
  );

  // Output SILENCE.
  // This keeps the audio graph running without
  // creating microphone feedback through speakers.
  if (output) {
    output.fill(0);
  }

  return true;
}
    }

    registerProcessor(
      "debug-signal-pcm-processor",
      DebugSignalPCMProcessor
    );
  `;

  const blob = new Blob(
    [processorCode],
    {
      type: "application/javascript",
    }
  );

  return URL.createObjectURL(
    blob
  );
}

function decodeBase64PCM(
  base64: string
): Int16Array {
  const binary =
    atob(base64);

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {
    bytes[i] =
      binary.charCodeAt(i);
  }

  return new Int16Array(
    bytes.buffer,
    bytes.byteOffset,
    Math.floor(
      bytes.byteLength / 2
    )
  );
}

export default function DebugSignalApp() {
  /*
   * --------------------------------------------------
   * UI STATE
   * --------------------------------------------------
   */

  const [voiceState, setVoiceState] =
    useState<VoiceState>("idle");

  const [muted, setMuted] =
    useState(false);

  const [microphoneStatus, setMicrophoneStatus] =
    useState<MicrophoneStatus>(
      "inactive"
    );

  const [micLevel, setMicLevel] =
    useState(0);

  const [liveTranscript, setLiveTranscript] =
    useState("");

  const [repository, setRepository] =
    useState("Loading…");

  const [branch, setBranch] =
    useState("Loading…");

  const [connectionStatus, setConnectionStatus] =
    useState<
      "connected" |
      "connecting" |
      "disconnected"
    >("connecting");

  const [sessionStartedAt] =
    useState(() =>
      new Date().toLocaleString()
    );

  const [evidence, setEvidence] =
    useState<EvidenceSummary | null>(
      null
    );

  const [investigationLoading, setInvestigationLoading] =
    useState(false);

  const [conversationMessages, setConversationMessages] =
    useState(mockConversation);

  /*
   * --------------------------------------------------
   * REFS
   * --------------------------------------------------
   */

  const socketRef =
    useRef<WebSocket | null>(
      null
    );

  const mediaStreamRef =
    useRef<MediaStream | null>(
      null
    );

  const audioContextRef =
    useRef<AudioContext | null>(
      null
    );

  const workletNodeRef =
    useRef<AudioWorkletNode | null>(
      null
    );

  const sourceNodeRef =
    useRef<MediaStreamAudioSourceNode | null>(
      null
    );

  const workletURLRef =
    useRef<string | null>(
      null
    );

  const playbackTimeRef =
    useRef(0);

  const scheduledSourcesRef =
    useRef<AudioBufferSourceNode[]>(
      []
    );

  const pendingToolsRef =
  useRef<PendingTool[]>(
    []
  );
  const lastTranscriptRef =
  useRef("");

const processedToolCallsRef =
  useRef<Set<string>>(new Set());

/*
 * True only while the most recently received
 * server event is a non-interrupted reply.done,
 * which means the agent is idle and will accept a
 * tool.result.
 *
 * The Voice Agent API expects tool.result to be
 * sent at exactly that point: not earlier (the
 * agent is still speaking) and not later (a new
 * turn has already started).
 */
const replyDoneReceivedRef =
  useRef(false);

  const sessionReadyRef =
    useRef(false);

  const endingSessionRef =
    useRef(false);

  const mutedRef =
    useRef(false);

  const investigationRunningRef =
    useRef(false);

  /*
   * Keep the mutable mute value available
   * inside AudioWorklet callbacks.
   */

  useEffect(() => {
    mutedRef.current =
      muted;

    if (
      muted
    ) {
      setMicrophoneStatus(
        "muted"
      );
    } else if (
      sessionReadyRef.current
    ) {
      setMicrophoneStatus(
        "active"
      );
    }
  }, [muted]);

  /*
   * --------------------------------------------------
   * CONVERSATION
   * --------------------------------------------------
   */

  function addDeveloperMessage(
    text: string
  ) {
    const cleaned =
      text.trim();

    if (!cleaned) {
      return;
    }

    const timestamp =
      new Date().toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      );

    setConversationMessages(
      (messages) => [
        ...messages,

        {
          id: `developer-${Date.now()}`,

          speaker:
            "developer",

          authorName:
            "You",

          timestamp,

          text: cleaned,
        },
      ]
    );
  }

  function addAssistantMessage(
    text: string
  ) {
    const cleaned =
      text.trim();

    if (!cleaned) {
      return;
    }

    const timestamp =
      new Date().toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      );

    setConversationMessages(
      (messages) => [
        ...messages,

        {
          id: `assistant-${Date.now()}`,

          speaker:
            "assistant",

          authorName:
            "DebugSignal",

          timestamp,

          text: cleaned,
        },
      ]
    );
  }

  /*
   * --------------------------------------------------
   * AUDIO PLAYBACK
   * --------------------------------------------------
   */

  function flushPlayback() {
    const audioContext =
      audioContextRef.current;

    for (
      const source of
        scheduledSourcesRef.current
    ) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }

    scheduledSourcesRef.current =
      [];

    playbackTimeRef.current =
      audioContext
        ? audioContext.currentTime
        : 0;
  }

  function playReplyAudio(
    base64Audio: string
  ) {
    const audioContext =
      audioContextRef.current;

    if (!audioContext) {
      return;
    }

    const int16 =
      decodeBase64PCM(
        base64Audio
      );

    if (
      int16.length === 0
    ) {
      return;
    }

    const float32 =
      new Float32Array(
        int16.length
      );

    for (
      let i = 0;
      i < int16.length;
      i++
    ) {
      float32[i] =
        int16[i] / 0x8000;
    }

    const audioBuffer =
      audioContext.createBuffer(
        1,
        float32.length,
        SAMPLE_RATE
      );

    audioBuffer
      .getChannelData(0)
      .set(float32);

    const source =
      audioContext.createBufferSource();

    source.buffer =
      audioBuffer;

    source.connect(
      audioContext.destination
    );

    const now =
      audioContext.currentTime;

    if (
      playbackTimeRef.current <
      now
    ) {
      playbackTimeRef.current =
        now;
    }

    source.start(
      playbackTimeRef.current
    );

    playbackTimeRef.current +=
      audioBuffer.duration;

    scheduledSourcesRef.current.push(
      source
    );

    source.onended = () => {
      scheduledSourcesRef.current =
        scheduledSourcesRef.current.filter(
          (item) =>
            item !== source
        );
    };
  }

  /*
   * --------------------------------------------------
   * EVIDENCE
   * --------------------------------------------------
   */

  function buildEvidenceSummary(
    result: any
  ): EvidenceSummary | null {
    if (
      !result?.decision
        ?.shouldInterrupt ||
      !result?.bestEvidence
    ) {
      return null;
    }

    const bestEvidence =
      result.bestEvidence;

    const diffLines =
      String(
        bestEvidence.diff ??
          ""
      )
        .split("\n")
        .filter(
          (line: string) =>
            line.length > 0
        )
        .slice(0, 12)
        .map(
          (
            line: string,
            index: number
          ) => {
            let kind:
              | "add"
              | "remove"
              | "context" =
              "context";

            if (
              line.startsWith("+")
            ) {
              kind =
                "add";
            } else if (
              line.startsWith("-")
            ) {
              kind =
                "remove";
            }

            return {
              lineNumber:
                index + 1,

              kind,

              code:
                line.replace(
                  /^[+-]/,
                  ""
                ),
            };
          }
        );

    return {
      found: true,

      confidencePercent:
        bestEvidence.score,

      headline:
        bestEvidence.reasons.join(
          " • "
        ),

      commit: {
        sha:
          bestEvidence.commit
            .hash,

        message:
          bestEvidence.commit
            .message,

        author:
          bestEvidence.commit
            .author,

        date:
          bestEvidence.commit
            .date,

        tags: [
          "Git commit",
          "Investigation lead",
        ],

        filePath:
          "Commit diff",

        diff:
          diffLines,
      },

      relatedCommits:
        (result.matches ?? [])
          .filter(
            (
              commit: {
                hash: string;
              }
            ) =>
              commit.hash !==
              bestEvidence
                .commit.hash
          )
          .slice(0, 4)
          .map(
            (
              commit: {
                hash: string;
                message: string;
                date: string;
              }
            ) => ({
              sha:
                commit.hash,

              message:
                commit.message,

              date:
                commit.date,
            })
          ),
    };
  }

  /*
   * --------------------------------------------------
   * NORMAL / TYPED INVESTIGATION
   * --------------------------------------------------
   */

  async function runInvestigation(
    query: string,
    addAssistantResponse = true
  ) {
    const cleaned =
      query.trim();

    if (!cleaned) {
      return null;
    }

    try {
      setInvestigationLoading(
        true
      );

      setVoiceState(
        "thinking"
      );

      const result =
        await investigate(
          cleaned
        );

      console.log(
        "Investigation result:",
        result
      );

      const evidenceSummary =
        buildEvidenceSummary(
          result
        );

      if (
        evidenceSummary
      ) {
        setEvidence(
          evidenceSummary
        );

        setVoiceState(
          "speaking"
        );

        if (
          addAssistantResponse
        ) {
          const bestEvidence =
            result.bestEvidence;

          addAssistantMessage(
            `I found something relevant. Commit ${bestEvidence.commit.hash.slice(
              0,
              8
            )} changed "${bestEvidence.commit.message}". The evidence confidence is ${bestEvidence.score}%.`
          );
        }
      } else {
        setEvidence(
          null
        );

        if (
          addAssistantResponse
        ) {
          addAssistantMessage(
            "I couldn't find strong enough evidence in the repository yet. I'll stay quiet until I find something that can actually change the debugging direction."
          );
        }

        setVoiceState(
          "listening"
        );
      }

      return result;
    } catch (error) {
      console.error(
        "Investigation failed:",
        error
      );

      setEvidence(
        null
      );

      if (
        addAssistantResponse
      ) {
        addAssistantMessage(
          "I couldn't complete the investigation. Please try again."
        );
      }

      setVoiceState(
        "listening"
      );

      return null;
    } finally {
      setInvestigationLoading(
        false
      );
    }
  }

  /*
   * --------------------------------------------------
   * VOICE TOOL
   * --------------------------------------------------
   */

  async function executeVoiceTool(
  event: AssemblyAIEvent
) {
  if (
    event.name !==
      "investigate_debugging_context" ||
    !event.call_id
  ) {
    return;
  }

  const voiceQuery = String(
    event.arguments?.query ?? ""
  ).trim();

let query = voiceQuery.trim();

query = query
  .replace(/\bvarsel\b/gi, "vercel")
  .replace(/\bversal\b/gi, "vercel")
  .replace(/\bversel\b/gi, "vercel");



console.log(
  "🔥 NORMALIZED VOICE QUERY:",
  query
);
  console.log(
    "FINAL INVESTIGATION QUERY:",
    query
  );

  if (!query) {
    pendingToolsRef.current.push({
      callId: event.call_id,

      result: {
        shouldInterrupt: false,
        confidence: 0,
        reason:
          "No usable debugging context was provided.",
      },
    });

    sendPendingToolResults();

    return;
  }

  try {
  investigationRunningRef.current =
    true;

  setInvestigationLoading(true);

  setVoiceState("thinking");

  console.log(
    "🚨 ABOUT TO INVESTIGATE:",
    query
  );

  const result =
    await investigate(query);
    console.log(
      "Voice investigation result:",
      result
    );

    const evidenceSummary =
      buildEvidenceSummary(result);

    if (evidenceSummary) {
      setEvidence(evidenceSummary);
    } else {
      setEvidence(null);
    }

    pendingToolsRef.current.push({
      callId: event.call_id,

      result: {
        shouldInterrupt: Boolean(
          result?.decision?.shouldInterrupt
        ),

        confidence:
          result?.bestEvidence?.score ?? 0,

        reason:
          result?.decision?.reason ??
          "No strong evidence found.",

        query,

        evidence:
          result?.decision?.shouldInterrupt &&
          result?.bestEvidence
            ? {
                commit:
                  result.bestEvidence
                    .commit.hash,

                message:
                  result.bestEvidence
                    .commit.message,

                score:
                  result.bestEvidence.score,

                reasons:
                  result.bestEvidence
                    .reasons,

                diff:
                  result.bestEvidence.diff,
              }
            : null,
      },
    });

    /*
     * Hand the investigation result to AssemblyAI.
     * sendPendingToolResults() sends it immediately
     * when reply.done is the latest event, otherwise
     * it holds the result until reply.done arrives.
     */
    sendPendingToolResults();
  } catch (error) {
    console.error(
      "Voice investigation failed:",
      error
    );

    setEvidence(null);

    pendingToolsRef.current.push({
      callId: event.call_id,

      result: {
        shouldInterrupt: false,

        confidence: 0,

        reason:
          "Investigation failed. Do not interrupt the developer.",
      },
    });

    /*
     * Hand the failure result to AssemblyAI as well,
     * so the agent is not left waiting on the tool
     * call.  It is held until reply.done when the
     * agent is still mid-reply.
     */
    sendPendingToolResults();
  } finally {
    investigationRunningRef.current =
      false;

    setInvestigationLoading(false);

  }
  }

   
  /*
   * --------------------------------------------------
   * TOOL RESULT
   * --------------------------------------------------
   */

  function sendPendingToolResults() {
    const socket =
      socketRef.current;

    if (
      !socket ||
      socket.readyState !==
        WebSocket.OPEN
    ) {
      return;
    }

    if (
      pendingToolsRef.current
        .length === 0
    ) {
      return;
    }

    /*
     * Only send when reply.done is the latest event
     * received from AssemblyAI.  A tool.result that
     * arrives while the agent is still mid-reply can
     * be ignored, so it is held here until the
     * reply.done handler flushes it.
     */
    if (
      !replyDoneReceivedRef.current
    ) {
      console.log(
        "⏸ Holding tool result until reply.done."
      );

      return;
    }

    const pending =
      pendingToolsRef.current;

    pendingToolsRef.current =
      [];

    for (
      const tool of pending
    ) {
      socket.send(
        JSON.stringify({
          type:
            "tool.result",

          call_id:
            tool.callId,

          result:
            JSON.stringify(
              tool.result
            ),
        })
      );
    }

    /*
     * The agent starts a new turn for this result,
     * so the reply.done gap has now been used.
     */
    replyDoneReceivedRef.current =
      false;
  }

  /*
   * --------------------------------------------------
   * MICROPHONE
   * --------------------------------------------------
   */

  async function setupMicrophone() {
    try {
      setMicrophoneStatus(
        "requesting"
      );

      /*
       * Ask the browser for the actual microphone.
       */
      const stream =
  await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: {
        ideal: 1,
      },
    },
  });

      mediaStreamRef.current =
        stream;

      /*
       * Make sure the browser is actually
       * giving us an audio track.
       */
      const tracks =
        stream.getAudioTracks();

      if (
        tracks.length === 0
      ) {
        throw new Error(
          "No microphone audio track was created."
        );
      }

      console.log(
        "Microphone:",
        tracks[0].label
      );

      const audioContext =
        new AudioContext({
          sampleRate:
            SAMPLE_RATE,
        });
        console.log(
  "AUDIO DEBUG:",
  "state =", audioContext.state,
  "sampleRate =", audioContext.sampleRate
);

      audioContextRef.current =
        audioContext;

      await audioContext.resume();

      const workletURL =
        createPCMWorkletURL();

      workletURLRef.current =
        workletURL;

      await audioContext.audioWorklet.addModule(
        workletURL
      );

      const source =
        audioContext.createMediaStreamSource(
          stream
        );

      sourceNodeRef.current =
        source;

      const worklet =
        new AudioWorkletNode(
          audioContext,

          "debug-signal-pcm-processor"
        );

      workletNodeRef.current =
        worklet;

      worklet.port.onmessage =
        (event) => {

          console.log("MIC FRAME RECEIVED", event.data?.rms);
          const socket =
            socketRef.current;

          const rms =
            Number(
              event.data?.rms ??
                0
            );

          /*
           * Convert RMS to a useful 0-100
           * visual microphone level.
           */
          const level =
            Math.min(
              100,

              Math.round(
                rms * 500
              )
            );

          setMicLevel(
            level
          );

          /*
           * Do not send microphone data
           * when muted.
           */
          if (
            mutedRef.current
          ) {
            return;
          }

          /*
           * Do not send audio until AssemblyAI
           * confirms session.ready.
           */
          if (
            !sessionReadyRef.current
          ) {
            return;
          }

          if (
            !socket ||
            socket.readyState !==
              WebSocket.OPEN
          ) {
            return;
          }

          const pcm =
            event.data
              ?.pcm;

          if (
            !pcm
          ) {
            return;
          }

          const base64Audio =
            arrayBufferToBase64(
              pcm
            );

          socket.send(
            JSON.stringify({
              type:
                "input.audio",

              audio:
                base64Audio,
            })
          );
        };

      /*
       * IMPORTANT:
       *
       * We connect microphone → worklet,
       * but NOT microphone → speakers.
       *
       * This prevents feedback.
       */
            source.connect(worklet);

// Keep the AudioWorklet in the active audio graph.
// The processor outputs silence, so this does NOT
// play your microphone through the speakers.
worklet.connect(audioContext.destination);

setMicrophoneStatus("active");

      setVoiceState(
        "listening"
      );

      console.log(
        "DebugSignal microphone is ACTIVE."
      );
    } catch (error) {
      console.error(
        "Microphone setup failed:",
        error
      );

      setMicrophoneStatus(
        "denied"
      );

      setVoiceState(
        "idle"
      );

      throw error;
    }
  }

  /*
   * --------------------------------------------------
   * VOICE SESSION
   * --------------------------------------------------
   */

  async function startVoiceSession() {
    if (
      socketRef.current &&
      socketRef.current.readyState ===
        WebSocket.OPEN
    ) {
      return;
    }

    try {
      endingSessionRef.current =
        false;

      sessionReadyRef.current =
        false;

      setConnectionStatus(
        "connecting"
      );

      setMicrophoneStatus(
        "requesting"
      );

      setVoiceState(
        "thinking"
      );
      await setupMicrophone();

      const token =
        await getVoiceToken();

      const socket =
        new WebSocket(
          `wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(
            token
          )}`
        );

      socketRef.current =
        socket;

      socket.onopen =
        () => {
          console.log(
            "Connected to AssemblyAI."
          );
const systemPrompt = `
You are DebugSignal, a voice debugging observer for software developers.

Your job is:

LISTEN → EXTRACT DEBUGGING SIGNAL → INVESTIGATE → SCORE EVIDENCE → DECIDE WHETHER TO INTERRUPT.

When the developer gives meaningful debugging context, call investigate_debugging_context.

Build the investigation query from the SUSPECTED CAUSE and the FEATURE, not from every symptom word in the sentence.

Lead with the suspected cause — the component, service, module or configuration the developer says might be responsible ("I think X…", "it might be…", "could be…").

Then add the feature or area that owns the symptom (for example "checkout", "payment", "login", "routing").

Include a SYMPTOM word (timeout, failure, crash, error…) only when the developer reports that symptom as NEW information in the current statement, for example "payment started timing out recently".

Do NOT include a symptom word that is only background context while the developer is proposing a cause.  When the developer is testing a hypothesis, the query is cause + feature and the symptom is left out: the investigation exists to confirm or rule out the cause they named, not to restate the symptom.

Keep the query to two or three words.

Do NOT copy the entire spoken sentence.

Do NOT reduce the query to one generic keyword.

Good examples:

Developer:
"I'm debugging a checkout timeout. I think the database might be the problem."

Query:
"checkout database"

The developer is testing the database hypothesis, so the earlier "timeout" is background context and is NOT searched for.  NOT "checkout timeout database".

Developer:
"Actually, payment started timing out recently."

Query:
"payment timeout"

The developer now reports a new symptom together with the area it belongs to, so both words belong in the query.

Developer:
"The Vercel routing is broken."

Query:
"Vercel routing"

Developer:
"Database connection failure."

Query:
"database connection"

Developer:
"The payment retry configuration changed and checkout keeps failing."

Query:
"payment retry configuration"

Do not investigate isolated fragments such as:
"API"
"URLs"
"checkout"
"payment"

Wait until there is enough technical context.

Do not ask clarification questions before investigating when useful technical context already exists.

The investigation tool searches Git commit history and commit diffs.

Never claim that files, directories, logs, or the filesystem were searched.

If the investigation result contains:
shouldInterrupt = true

then briefly interrupt the developer and mention:
1. the actual commit hash
2. the actual commit message
3. why the evidence is relevant

Example:
"I found something relevant. Commit 7457843 changed the Vercel routing configuration, which matches the routing problem you're describing."

Only use facts returned by the investigation tool.

If shouldInterrupt = false:
do not invent evidence.

If a response is necessary, say:
"I didn't find strong evidence in the Git history yet."

Silence is correct when evidence is weak.

Never fabricate:
- commits
- commit hashes
- files
- logs
- diffs
- causes
- numbers
- timestamps

Keep spoken responses to one or two short sentences.

You are an evidence-triggered debugging observer.

Your value is listening while the developer thinks, investigating Git history, and interrupting only when concrete evidence can change the debugging direction.
`.trim();
          socket.send(
            JSON.stringify({
              type:
                "session.update",

              session: {
                system_prompt:
                  systemPrompt,

                output: {
                  voice:
                    "anna",
                },

                input: {
  keyterms: [
    "repository",
    "GitHub",
    "commit",
    "checkout",
    "API",
    "database",
    "deployment",
    "timeout",
    "payment",
    "retry",
    "branch",
    "pull request",
    "merge",
    "diff",
    "Docker",
    "Kubernetes",
    "WebSocket",
    "endpoint",
    "backend",
    "frontend",
  ],

  turn_detection: {
    vad_threshold: 0.5,
    min_silence: 600,
    max_silence: 1500,
    interrupt_response: true,
  },
},

                tools: [
                  {
                    type:
                      "function",

                    name:
                      "investigate_debugging_context",

                 
                description:
  "Create a concise Git investigation query from the developer's latest debugging context. Lead with the suspected cause the developer named, then the feature or area it affects. Include a symptom word only when the developer reports that symptom as new information in this statement. Never combine every symptom word into the query. Do not copy the entire spoken sentence. Do not ask for clarification before creating the query. A short two- or three-word phrase is valid and should be investigated directly.",

parameters:
  {
                        type:
                          "object",

                        properties:
                          {
                            query:
                              {
                                type:
                                  "string",

                                description:
                                 "Concise query: the suspected cause first, then the feature or area it affects. Add a symptom word only when the developer reports that symptom as new information in this statement.",
                              },
                          },

                        required:
                          [
                            "query",
                          ],
                      },
                  },
                ],
              },
            })
          );
        };

      socket.onmessage =
        async (
          message
        ) => {
          try {
            const event =
              JSON.parse(
                message.data
              ) as AssemblyAIEvent;

            console.log(
              "AssemblyAI:",
              event
            );

            switch (
              event.type
            ) {
              /*
               * --------------------------------
               * SESSION READY
               * --------------------------------
               */
case "session.ready": {
  console.log(
    "AssemblyAI session is READY."
  );

  sessionReadyRef.current = true;

  setConnectionStatus(
    "connected"
  );

  break;
}

              /*
               * --------------------------------
               * USER STARTED SPEAKING
               * --------------------------------
               */

              case "input.speech.started": {
                console.log(
                  "Microphone detected speech."
                );

                flushPlayback();

                /*
                 * A new turn is in flight, so any
                 * pending tool result is held until the
                 * next reply.done.
                 */
                replyDoneReceivedRef.current =
                  false;

                setVoiceState(
                  "listening"
                );

                break;
              }

              /*
               * --------------------------------
               * USER STOPPED SPEAKING
               * --------------------------------
               */

              case "input.speech.stopped": {
  console.log(
    "Microphone detected end of speech."
  );

  setVoiceState(
    "thinking"
  );

  break;
}
              /*
               * --------------------------------
               * LIVE USER TRANSCRIPT
               * --------------------------------
               */

              case "transcript.user.delta": {
                if (
                  event.text
                ) {
                  setLiveTranscript(
                    event.text
                  );
                }

                break;
              }

              /*
               * --------------------------------
               * FINAL USER TRANSCRIPT
               * --------------------------------
               */

             case "transcript.user": {
  const text =
    event.text?.trim();

 if (text) {
  console.log(
    "FINAL USER TRANSCRIPT:",
    text
  );

  if (
    text === lastTranscriptRef.current
  ) {
    console.log(
      "⏭️ Duplicate transcript ignored:",
      text
    );

    break;
  }

  lastTranscriptRef.current =
    text;

  console.log(
    "🟢 ADDING DEVELOPER MESSAGE:",
    text
  );

  setLiveTranscript("");

  addDeveloperMessage(text);
}

  break;
}

              /*
               * --------------------------------
               * AGENT STARTED REPLY
               * --------------------------------
               */

              case "reply.started": {
                /*
                 * The agent is speaking again, so the
                 * last reply.done is no longer the most
                 * recent event.
                 */
                replyDoneReceivedRef.current =
                  false;

                setVoiceState(
                  "thinking"
                );

                break;
              }

              /*
               * --------------------------------
               * AGENT AUDIO
               * --------------------------------
               */

              case "reply.audio": {
                if (
                  event.data
                ) {
                  playReplyAudio(
                    event.data
                  );

                  setVoiceState(
                    "speaking"
                  );
                }

                break;
              }

              /*
               * --------------------------------
               * AGENT TEXT
               * --------------------------------
               */

              case "transcript.agent": {
                const text =
                  event.text?.trim();

                if (
                  text
                ) {
                  addAssistantMessage(
                    text
                  );
                }

                break;
              }

              /*
               * --------------------------------
               * TOOL CALL
               * --------------------------------
               */

          case "tool.call": {
  console.log(
    "🔥 VOICE TOOL QUERY:",
    event.arguments?.query
  );

  if (
    !event.call_id ||
    processedToolCallsRef.current.has(
      event.call_id
    )
  ) {
    console.log(
      "⏭️ Duplicate tool call ignored:",
      event.call_id
    );

    break;
  }

  processedToolCallsRef.current.add(
    event.call_id
  );

  void executeVoiceTool(
    event
  );

  break;
}
              /*
               * --------------------------------
               * REPLY DONE
               * --------------------------------
               */

              case "reply.done": {
                console.log(
                  "AssemblyAI reply done:",
                  event.status
                );

                /*
                 * Developer interrupted agent.
                 */
                if (
                  event.status ===
                  "interrupted"
                ) {
                  flushPlayback();

                  pendingToolsRef.current =
                    [];

                  replyDoneReceivedRef.current =
                    false;

                  setVoiceState(
                    "listening"
                  );

                  break;
                }

                /*
                 * reply.done is the latest event now, so
                 * the agent is idle and will accept a
                 * tool.result.
                 *
                 * Flush any result the investigation has
                 * already produced.  If the investigation
                 * is still running, the flag stays true
                 * and executeVoiceTool() sends the result
                 * as soon as it is ready.
                 */
                replyDoneReceivedRef.current =
                  true;

                sendPendingToolResults();

                /*
                 * Only return to listening if
                 * we're not currently investigating.
                 */
                if (
                  !investigationRunningRef.current
                ) {
                  setVoiceState(
                    "listening"
                  );
                }

                break;
              }

              /*
               * --------------------------------
               * SESSION ERROR
               * --------------------------------
               */

              case "session.error": {
                console.error(
                  "AssemblyAI session error:",
                  event.code,
                  event.message
                );

                setConnectionStatus(
                  "disconnected"
                );

                setMicrophoneStatus(
                  "error"
                );

                setVoiceState(
                  "idle"
                );

                break;
              }

              /*
               * --------------------------------
               * SESSION ENDED
               * --------------------------------
               */

              case "session.ended": {
                console.log(
                  "AssemblyAI session ended."
                );

                sessionReadyRef.current =
                  false;

                setConnectionStatus(
                  "disconnected"
                );

                setMicrophoneStatus(
                  "inactive"
                );

                if (
                  !endingSessionRef.current
                ) {
                  setVoiceState(
                    "idle"
                  );
                }

                break;
              }

              default:
                break;
            }
          } catch (error) {
            console.error(
              "Failed to process AssemblyAI event:",
              error
            );
          }
        };

      socket.onerror =
        (error) => {
          console.error(
            "AssemblyAI WebSocket error:",
            error
          );

          setConnectionStatus(
            "disconnected"
          );

          setMicrophoneStatus(
            "error"
          );
        };

      socket.onclose =
        (
          event
        ) => {
          console.log(
            "AssemblyAI WebSocket closed:",
            event.code,
            event.reason
          );

          sessionReadyRef.current =
            false;

          if (
            !endingSessionRef.current
          ) {
            setConnectionStatus(
              "disconnected"
            );

            setMicrophoneStatus(
              "inactive"
            );

            setVoiceState(
              "idle"
            );
          }
        };
    } catch (error) {
      console.error(
        "Failed to start voice session:",
        error
      );

      /*
       * Startup can fail after the microphone,
       * AudioContext, AudioWorklet or WebSocket have
       * already been created (for example when the
       * token request or the socket connection
       * fails).  Release all of them so the mic does
       * not stay open and a retry starts clean.
       */
      stopVoiceSession();

      setConnectionStatus(
        "disconnected"
      );

      setMicrophoneStatus(
        "error"
      );

      setVoiceState(
        "idle"
      );
    }
  }

  /*
   * --------------------------------------------------
   * STOP EVERYTHING
   * --------------------------------------------------
   */

  function stopVoiceSession() {
    console.log(
      "Stopping DebugSignal voice session."
    );

    endingSessionRef.current =
      true;

    sessionReadyRef.current =
      false;

    replyDoneReceivedRef.current =
      false;

    pendingToolsRef.current =
      [];

    flushPlayback();

    /*
     * Stop AudioWorklet.
     */
    if (
      workletNodeRef.current
    ) {
      workletNodeRef.current.port.onmessage =
        null;

      try {
        workletNodeRef.current.disconnect();
      } catch {
        // Already disconnected.
      }

      workletNodeRef.current =
        null;
    }

    /*
     * Disconnect microphone source.
     */
    if (
      sourceNodeRef.current
    ) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        // Already disconnected.
      }

      sourceNodeRef.current =
        null;
    }

    /*
     * Actually turn off microphone.
     */
    if (
      mediaStreamRef.current
    ) {
      for (
        const track of
          mediaStreamRef.current.getTracks()
      ) {
        track.stop();
      }

      mediaStreamRef.current =
        null;
    }

    /*
     * Close AudioContext.
     */
    if (
      audioContextRef.current
    ) {
      audioContextRef.current
        .close()
        .catch(() => {});

      audioContextRef.current =
        null;
    }

    /*
     * Remove temporary AudioWorklet.
     */
    if (
      workletURLRef.current
    ) {
      URL.revokeObjectURL(
        workletURLRef.current
      );

      workletURLRef.current =
        null;
    }

    /*
     * End the session cleanly, then close the
     * socket.
     *
     * The Voice Agent API expects an explicit
     * session.end: a bare socket close leaves the
     * session in its resume grace window.
     */
    if (
      socketRef.current
    ) {
      try {
        if (
          socketRef.current
            .readyState ===
          WebSocket.OPEN
        ) {
          socketRef.current.send(
            JSON.stringify({
              type:
                "session.end",
            })
          );
        }

        socketRef.current.close();
      } catch {
        // Already closed.
      }

      socketRef.current =
        null;
    }

    setMicLevel(
      0
    );

    setLiveTranscript(
      ""
    );

    setMicrophoneStatus(
      "inactive"
    );

    setConnectionStatus(
      "disconnected"
    );

    setVoiceState(
      "idle"
    );
  }

  /*
   * --------------------------------------------------
   * MOUNT
   * --------------------------------------------------
   */

  useEffect(() => {
  let mounted = true;

  async function initialize() {
    try {
      const info = await getRepositoryInfo();

      if (!mounted) {
        return;
      }

      setRepository(info.repository);
      setBranch(info.branch);
    } catch (error) {
      console.error(
        "Failed to load repository info:",
        error
      );

      if (!mounted) {
        return;
      }

      setRepository("Unavailable");
      setBranch("Unavailable");
    }
  }

  initialize();

  return () => {
    mounted = false;
    stopVoiceSession();
  };
}, []);

  /*
   * --------------------------------------------------
   * TYPED MESSAGE
   * --------------------------------------------------
   */

  async function handleSendMessage(
    text: string
  ) {
    const cleaned =
      text.trim();

    if (!cleaned) {
      return;
    }

    addDeveloperMessage(
      cleaned
    );

    await runInvestigation(
      cleaned
    );
  }

  /*
   * --------------------------------------------------
   * DISPLAY TEXT
   * --------------------------------------------------
   */

  const copy =
    stateCopy[
      voiceState
    ];

  let headline =
    copy.headline;

  let subtext =
    copy.subtext;

  if (
    microphoneStatus ===
    "requesting"
  ) {
    headline =
      "Starting microphone…";

    subtext =
      "Please allow microphone access when your browser asks.";
  }

  if (
    microphoneStatus ===
    "denied"
  ) {
    headline =
      "Microphone access needed";

    subtext =
      "Allow microphone access in your browser, then refresh the page.";
  }

  if (
    microphoneStatus ===
    "error"
  ) {
    headline =
      "Microphone error";

    subtext =
      "The microphone could not be started. Check your browser microphone settings.";
  }

  if (
    microphoneStatus ===
    "muted"
  ) {
    headline =
      "Microphone muted";

    subtext =
      "Click the microphone button to start listening again.";
  }

  if (
    investigationLoading
  ) {
    headline =
      "Investigating quietly…";

    subtext =
      "I'm searching the repository for concrete evidence.";
  }

  if (
    liveTranscript
  ) {
    headline =
      "I hear you…";

    subtext =
      `"${liveTranscript}"`;
  }

  /*
   * --------------------------------------------------
   * SESSION INFO
   * --------------------------------------------------
   */

  const session:
    SessionInfoType = {
    repository,

    branch,

    startedAt:
      sessionStartedAt,

    status:
      voiceState ===
      "idle"
        ? "paused"
        : investigationLoading
        ? "investigating"
        : "investigating",

    interruptionMode:
      "Smart (high confidence)",

    voiceAgent:
      "AssemblyAI",
  };

  /*
   * --------------------------------------------------
   * RENDER
   * --------------------------------------------------
   */

  return (
    <div className="ds-root ds-app">

      <Header
        repository={
          repository
        }

        branch={
          branch
        }

        connectionStatus={
          connectionStatus
        }
      />

      <div className="ds-app-body">

        <Sidebar
          items={
            mockNavItems
          }

          quote={{
            text:
              "Find problems before they find you.",

            attribution:
              "DebugSignal",
          }}
        />

        <main className="ds-app-main">

          <div className="ds-main-column">

            <section className="ds-card ds-hero-card">

              <div className="ds-hero-card-top">

                <StatusPanel
                  voiceState={
                    voiceState
                  }

                  headline={
                    headline
                  }

                  subtext={
                    subtext
                  }
                />

                {/*
                 * Small real microphone
                 * debugging indicator.
                 */}

                <div
                  style={{
                    margin:
                      "10px auto 16px",
                    textAlign:
                      "center",
                    fontSize:
                      "13px",
                    color:
                      microphoneStatus ===
                      "active"
                        ? "#4f46e5"
                        : "#777",
                  }}
                >
                  <div>
                    {microphoneStatus ===
                    "active"
                      ? "🎙 Microphone active"
                      : microphoneStatus ===
                        "muted"
                      ? "🔇 Microphone muted"
                      : microphoneStatus ===
                        "requesting"
                      ? "🎙 Requesting microphone…"
                      : microphoneStatus ===
                        "denied"
                      ? "⚠ Microphone permission required"
                      : "Microphone inactive"}
                  </div>

                  {microphoneStatus ===
                    "active" && (
                    <div
                      style={{
                        width:
                          "160px",
                        height:
                          "4px",
                        margin:
                          "8px auto 0",
                        background:
                          "#eee",
                        borderRadius:
                          "999px",
                        overflow:
                          "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.max(
                            4,
                            micLevel
                          )}%`,
                          height:
                            "100%",
                          background:
                            "#6366f1",
                          borderRadius:
                            "999px",
                          transition:
                            "width 80ms linear",
                        }}
                      />
                    </div>
                  )}
                </div>

                {liveTranscript && (
                  <div
                    style={{
                      margin:
                        "0 auto 16px",
                      maxWidth:
                        "560px",
                      padding:
                        "10px 14px",
                      borderRadius:
                        "14px",
                      background:
                        "rgba(99,102,241,0.08)",
                      color:
                        "#4f46e5",
                      fontSize:
                        "14px",
                      textAlign:
                        "center",
                    }}
                  >
                    Hearing:
                    <br />
                    <strong>
                      {liveTranscript}
                    </strong>
                  </div>
                )}

                {/*
                 * Investigation steps are now
                 * intentionally removed from the
                 * hero until we wire them to real
                 * investigation progress.
                 *
                 * The old blue ticks were mock data
                 * and were misleading you.
                 */}

              </div>
{connectionStatus !== "connected" && (
  <button
    onClick={() => {
      startVoiceSession();
    }}
    style={{
      marginBottom: "16px",
      padding: "12px 24px",
      borderRadius: "12px",
      border: "none",
      cursor: "pointer",
      fontSize: "14px",
      fontWeight: 600,
    }}
  >
    Start Voice Session
  </button>
)}
              <Controls
                muted={
                  muted
                }

                onToggleMute={() => {
                  const nextMuted =
                    !muted;

                  mutedRef.current =
                    nextMuted;

                  setMuted(
                    nextMuted
                  );

                  if (
                    nextMuted
                  ) {
                    setMicrophoneStatus(
                      "muted"
                    );
                  } else if (
                    sessionReadyRef.current
                  ) {
                    setMicrophoneStatus(
                      "active"
                    );

                    setVoiceState(
                      "listening"
                    );
                  }
                }}

                onEnd={() =>
                  stopVoiceSession()
                }
              />

            </section>

            <Conversation
              messages={
                conversationMessages
              }

              onSend={
                handleSendMessage
              }

              onClear={() =>
                setConversationMessages(
                  []
                )
              }
            />

          </div>

          <aside className="ds-side-column">

            {evidence && (
              <EvidencePanel
                evidence={
                  evidence
                }
              />
            )}

            <SessionInfo
              session={
                session
              }
            />

          </aside>

        </main>

      </div>

    </div>
  );
}