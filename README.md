# DebugSignal

### The debugging agent that knows when to interrupt you.

DebugSignal is a voice-powered debugging assistant that listens while developers think aloud, investigates the repository silently, and interrupts only when it finds strong evidence that can change the debugging direction.

Instead of acting like a generic AI coding assistant, DebugSignal focuses on one thing:

> **Knowing when to speak — and when to stay silent.**

---

## 🎯 The Problem

Developers often think aloud while debugging:

> "I'm debugging a checkout timeout. I think the database might be the problem."

Useful evidence may already exist in the repository's Git history, but manually searching commits and diffs breaks the developer's flow.

At the same time, an AI that constantly interrupts with guesses can make debugging even more distracting.

DebugSignal takes a different approach:

**Weak evidence → Stay silent**

**Strong evidence → Interrupt**

---

## 💡 How DebugSignal Works

```text
Developer thinks aloud
        ↓
AssemblyAI Voice Agent
        ↓
Understand debugging context
        ↓
Investigate repository
        ↓
Search Git commits
        ↓
Inspect commit diff
        ↓
Score evidence
        ↓
Apply interruption policy
        ↓
 ┌───────────────┬────────────────┐
 │ Weak evidence │ Strong evidence│
 │      ↓        │       ↓        │
 │    SILENCE    │   INTERRUPT    │
 └───────────────┴────────────────┘
