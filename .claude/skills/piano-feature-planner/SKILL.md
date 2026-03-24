---
name: piano-feature-planner
description: >
  Plan a new Piano Dungeon game feature and create beads (tasks) for the work.
  Use this skill whenever the user wants to add, change, or design anything in the
  piano_trainer game — a new enemy, challenge type, settings option, UI screen,
  audio behaviour, presentation change, or any other feature. Trigger when the user
  says "plan X", "I want to add X", "create beads for X", "how do I implement X",
  or describes a game change and wants to scope or track the work. When in doubt,
  use this skill — it's better to over-trigger than to miss a planning opportunity.
---

# Piano Dungeon — Feature Planner

You help plan new features for the Piano Dungeon roguelike and break them into
trackable bead tasks. Follow these steps every time.

---

## Step 1: Understand the feature

If the description is clear enough to identify which system it touches, proceed.
Otherwise ask **one focused question** — not a list. Good questions narrow the
scope: "Does this show during battle, on the dungeon map, or somewhere else?" or
"Is this always active or triggered by a specific condition?"

Once you understand the intent, state back in one sentence what you're planning,
so the user can correct you before you explore.

---

## Step 2: Explore the codebase

Read the actual source files before writing the plan. The amount of exploration
should match the complexity of the feature.

Use this lookup table to decide where to start:

| Feature type | Files to read |
|---|---|
| New enemy | `src/data/enemies.ts`, `src/types.ts`, `src/rendering/BattleScreen.ts` |
| New challenge type | `src/game/ChallengeEngine.ts`, `src/types.ts`, `src/rendering/BattleScreen.ts` |
| New screen | `src/main.ts`, `src/scenes/GameScene.ts`, `src/game/StateMachine.ts`, `src/types.ts` |
| Settings change | `src/rendering/SettingsScreen.ts`, `src/scenes/SettingsScene.ts`, `src/game/GameState.ts` |
| Rendering / presentation | The relevant renderer in `src/rendering/`, plus `src/rendering/Renderer.ts` |
| Audio behaviour | `src/audio/AudioEngine.ts` or `src/audio/AudioSynth.ts`, `src/config.ts` |
| Config / tuning tweak | `src/config.ts` only |
| New song or music data | `src/data/songs.ts`, `src/data/music.ts` |
| Dungeon / floor change | `src/game/DungeonGenerator.ts`, `src/rendering/DungeonScreen.ts` |

For cross-cutting features, read files from multiple rows. When you're not sure
which row fits, read `src/types.ts` and `src/game/GameState.ts` first — they
give orientation quickly.

---

## Step 3: Write the plan

Structure the plan like this:

```
## Feature: <name>

**What it does:** One or two sentences describing the user-facing behaviour.

**Files to change:**
- `path/to/file.ts` — what changes and why

**Implementation steps:**
1. ...
2. ...

**Architecture notes:**
- Any constraints from the rules below that apply
```

Keep it concrete. Reference actual function names, type names, and array names
you found while exploring. A plan that says "add to ENEMY_ARCHETYPES in
`src/data/enemies.ts`" is more useful than "add the enemy somewhere".

---

## Step 4: Propose tasks and create beads

Break the plan into bead-sized tasks. A good bead is one focused, self-contained
change — something you could implement and test independently.

**Task granularity guide:**
- Infrastructure work (new type, new config constant) → its own bead
- Core logic (new enemy archetype, new challenge branch) → its own bead
- Rendering (drawing the new thing on screen) → its own bead
- Wiring (registering a new screen, hooking into StateMachine) → its own bead
- Don't bundle unrelated concerns into one bead

List the proposed beads for the user. Then ask:

> "Should I create these as beads now?"

If yes, run `bd create "<title>"` for each one in sequence. Check `bd list`
first to avoid creating duplicates for work already tracked.

---

## Architecture quick-reference

Check these constraints before finalising any plan:

- **StateMachine.ts** is the only file that calls `sm.go()` — screen transitions always go through it
- **ChallengeEngine.ts** is the only file that calls `evaluateNote()` — don't add evaluation logic elsewhere
- **Renderers are pure** — `(renderer: Renderer, state: GameState) => void` with no side effects and no state writes
- **Types centralised** — all shared interfaces and types go in `src/types.ts`; never duplicate them
- **New screen checklist** — Scene class in `src/scenes/`, renderer in `src/rendering/`, register in `main.ts`, add to `SCREEN_TO_SCENE` map in `GameScene.ts`
- **Config first** — add tunable values to `src/config.ts` before hardcoding them inline
- **File size** — functions under 50 lines; files under ~200 lines of logic; split only when needed
- **No new files by default** — extend existing files unless the file is genuinely growing past its scope
- **Determinism** — `DungeonGenerator.ts` must stay deterministic given the same seed; never add `Math.random()` there
