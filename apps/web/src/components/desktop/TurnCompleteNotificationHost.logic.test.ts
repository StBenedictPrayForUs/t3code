import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";
import { describe, expect, it } from "vite-plus/test";

import { observeTurnCompletions } from "./TurnCompleteNotificationHost.logic";

function thread(input: {
  readonly turnId: string;
  readonly state: "running" | "completed" | "error" | "interrupted";
  readonly completedAt?: string | null;
  readonly sessionStatus?: "starting" | "running" | "ready" | "idle" | "error";
  readonly withoutLatestTurn?: boolean;
}): EnvironmentThreadShell {
  return {
    environmentId: "local",
    id: "thread-1",
    projectId: "project-1",
    title: "Fix notifications",
    latestTurn: input.withoutLatestTurn
      ? null
      : {
          turnId: input.turnId,
          state: input.state,
          requestedAt: "2026-07-17T12:00:00.000Z",
          startedAt: "2026-07-17T12:00:01.000Z",
          completedAt: input.completedAt ?? null,
          assistantMessageId: null,
        },
    session: input.sessionStatus
      ? {
          threadId: "thread-1",
          status: input.sessionStatus,
          providerName: "Codex",
          runtimeMode: "full-access",
          activeTurnId:
            input.sessionStatus === "starting" || input.sessionStatus === "running"
              ? input.turnId
              : null,
          lastError: null,
          updatedAt: "2026-07-17T12:01:00.000Z",
        }
      : null,
  } as EnvironmentThreadShell;
}

const projects = [
  {
    environmentId: "local",
    id: "project-1",
    title: "T3 Code",
  } as EnvironmentProject,
];

describe("observeTurnCompletions", () => {
  it("uses the first snapshot as a baseline without replaying completed turns", () => {
    const result = observeTurnCompletions({
      previous: new Map(),
      threads: [
        thread({
          turnId: "turn-old",
          state: "completed",
          completedAt: "2026-07-17T12:01:00.000Z",
        }),
      ],
      projects,
    });

    expect(result.notifications).toEqual([]);
  });

  it("notifies once when an observed running turn completes", () => {
    const running = observeTurnCompletions({
      previous: new Map(),
      threads: [thread({ turnId: "turn-1", state: "running" })],
      projects,
    });
    const completed = observeTurnCompletions({
      previous: running.observedTurns,
      threads: [
        thread({
          turnId: "turn-1",
          state: "completed",
          completedAt: "2026-07-17T12:01:00.000Z",
        }),
      ],
      projects,
    });
    const repeated = observeTurnCompletions({
      previous: completed.observedTurns,
      threads: [
        thread({
          turnId: "turn-1",
          state: "completed",
          completedAt: "2026-07-17T12:01:00.000Z",
        }),
      ],
      projects,
    });

    expect(completed.notifications).toEqual([
      {
        key: "local:thread-1:turn-1",
        threadTitle: "Fix notifications",
        projectTitle: "T3 Code",
      },
    ]);
    expect(repeated.notifications).toEqual([]);
  });

  it("retains observations across a temporarily empty reconnect snapshot", () => {
    const running = observeTurnCompletions({
      previous: new Map(),
      threads: [thread({ turnId: "turn-1", state: "running" })],
      projects,
    });
    const disconnected = observeTurnCompletions({
      previous: running.observedTurns,
      threads: [],
      projects: [],
    });
    const reconnected = observeTurnCompletions({
      previous: disconnected.observedTurns,
      threads: [
        thread({
          turnId: "turn-1",
          state: "completed",
          completedAt: "2026-07-17T12:01:00.000Z",
        }),
      ],
      projects,
    });

    expect(reconnected.notifications).toHaveLength(1);
  });

  it("does not notify when the latest turn moves backward after a revert", () => {
    const current = observeTurnCompletions({
      previous: new Map(),
      threads: [
        thread({
          turnId: "turn-2",
          state: "completed",
          completedAt: "2026-07-17T12:02:00.000Z",
        }),
      ],
      projects,
    });
    const reverted = observeTurnCompletions({
      previous: current.observedTurns,
      threads: [
        thread({
          turnId: "turn-1",
          state: "completed",
          completedAt: "2026-07-17T12:01:00.000Z",
        }),
      ],
      projects,
    });

    expect(reverted.notifications).toEqual([]);
  });

  it("does not notify when an interrupted turn carries its terminal timestamp", () => {
    const running = observeTurnCompletions({
      previous: new Map(),
      threads: [thread({ turnId: "turn-1", state: "running" })],
      projects,
    });
    const interrupted = observeTurnCompletions({
      previous: running.observedTurns,
      threads: [
        thread({
          turnId: "turn-1",
          state: "interrupted",
          completedAt: "2026-07-17T12:01:00.000Z",
        }),
      ],
      projects,
    });

    expect(interrupted.notifications).toEqual([]);
  });

  it("notifies when a no-checkpoint turn settles through the session", () => {
    const running = observeTurnCompletions({
      previous: new Map(),
      threads: [
        thread({
          turnId: "turn-1",
          state: "running",
          sessionStatus: "running",
          withoutLatestTurn: true,
        }),
      ],
      projects,
    });
    const completed = observeTurnCompletions({
      previous: running.observedTurns,
      threads: [
        thread({
          turnId: "turn-1",
          state: "completed",
          sessionStatus: "ready",
          withoutLatestTurn: true,
        }),
      ],
      projects,
    });

    expect(completed.notifications).toEqual([
      {
        key: "local:thread-1:turn-1",
        threadTitle: "Fix notifications",
        projectTitle: "T3 Code",
      },
    ]);
  });

  it("does not report interrupted or failed turns as complete", () => {
    const running = observeTurnCompletions({
      previous: new Map(),
      threads: [thread({ turnId: "turn-1", state: "running" })],
      projects,
    });

    for (const state of ["interrupted", "error"] as const) {
      const result = observeTurnCompletions({
        previous: running.observedTurns,
        threads: [
          thread({
            turnId: "turn-1",
            state,
            completedAt: "2026-07-17T12:01:00.000Z",
          }),
        ],
        projects,
      });
      expect(result.notifications).toEqual([]);
    }
  });
});
