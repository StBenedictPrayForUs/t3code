import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";

type NotificationProject = Pick<EnvironmentProject, "environmentId" | "id" | "title">;
type NotificationThread = Pick<
  EnvironmentThreadShell,
  "environmentId" | "id" | "projectId" | "title" | "latestTurn" | "session"
>;

interface ObservedTurn {
  readonly turnId: string | null;
  readonly phase: "working" | "completed" | "other";
}

export interface TurnCompleteNotification {
  readonly key: string;
  readonly threadTitle: string;
  readonly projectTitle: string | null;
}

export interface TurnCompletionObservation {
  readonly observedTurns: ReadonlyMap<string, ObservedTurn>;
  readonly notifications: ReadonlyArray<TurnCompleteNotification>;
}

function scopedKey(environmentId: string, id: string): string {
  return `${environmentId}:${id}`;
}

function observeThreadTurn(
  thread: NotificationThread,
  previous: ObservedTurn | undefined,
): ObservedTurn | null {
  const latestTurn = thread.latestTurn;
  const session = thread.session;

  // The live session is authoritative while it is working, even if a stale
  // latestTurn happens to carry a completion timestamp.
  if (
    session?.status === "starting" ||
    session?.status === "running" ||
    latestTurn?.state === "running"
  ) {
    return {
      turnId: latestTurn?.turnId ?? session?.activeTurnId ?? previous?.turnId ?? null,
      phase: "working",
    };
  }

  // Session teardown can race turn.completed and leave the state marked as
  // interrupted. completedAt is the durable proof that the turn did finish.
  if (
    latestTurn?.completedAt !== null &&
    latestTurn?.completedAt !== undefined &&
    (latestTurn.state === "completed" || latestTurn.state === "interrupted")
  ) {
    return { turnId: latestTurn.turnId, phase: "completed" };
  }

  // Quick turns with no checkpoint can lose latestTurn when their session
  // settles. Carry forward the identity seen while the session was working.
  if ((session?.status === "ready" || session?.status === "idle") && latestTurn === null) {
    return { turnId: previous?.turnId ?? null, phase: "completed" };
  }

  if (latestTurn === null && session === null) return null;
  return { turnId: latestTurn?.turnId ?? previous?.turnId ?? null, phase: "other" };
}

/**
 * Finds newly completed turns while preserving observations for temporarily
 * absent environments. A thread's first observed state is always treated as a
 * baseline so initial snapshots never replay old completions.
 */
export function observeTurnCompletions(input: {
  readonly previous: ReadonlyMap<string, ObservedTurn>;
  readonly threads: ReadonlyArray<NotificationThread>;
  readonly projects: ReadonlyArray<NotificationProject>;
}): TurnCompletionObservation {
  const observedTurns = new Map(input.previous);
  const notifications: TurnCompleteNotification[] = [];
  const projectTitles = new Map(
    input.projects.map((project) => [scopedKey(project.environmentId, project.id), project.title]),
  );

  for (const thread of input.threads) {
    const threadKey = scopedKey(thread.environmentId, thread.id);
    const previousTurn = input.previous.get(threadKey);
    const currentTurn = observeThreadTurn(thread, previousTurn);
    if (currentTurn === null) continue;
    observedTurns.set(threadKey, currentTurn);

    const newlyCompleted =
      currentTurn.phase === "completed" &&
      previousTurn !== undefined &&
      (previousTurn.turnId !== currentTurn.turnId || previousTurn.phase !== "completed");

    if (!newlyCompleted) continue;

    notifications.push({
      key: `${threadKey}:${currentTurn.turnId ?? "session"}`,
      threadTitle: thread.title,
      projectTitle: projectTitles.get(scopedKey(thread.environmentId, thread.projectId)) ?? null,
    });
  }

  return { observedTurns, notifications };
}
