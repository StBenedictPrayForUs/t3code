import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/shell";

type NotificationProject = Pick<EnvironmentProject, "environmentId" | "id" | "title">;
type NotificationThread = Pick<
  EnvironmentThreadShell,
  "environmentId" | "id" | "projectId" | "title" | "latestTurn"
>;

interface ObservedTurn {
  readonly turnId: string;
  readonly state: NonNullable<NotificationThread["latestTurn"]>["state"];
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
    const latestTurn = thread.latestTurn;
    if (latestTurn === null) continue;

    const threadKey = scopedKey(thread.environmentId, thread.id);
    const previousTurn = input.previous.get(threadKey);
    observedTurns.set(threadKey, {
      turnId: latestTurn.turnId,
      state: latestTurn.state,
    });

    const newlyCompleted =
      latestTurn.state === "completed" &&
      latestTurn.completedAt !== null &&
      previousTurn !== undefined &&
      (previousTurn.turnId !== latestTurn.turnId || previousTurn.state !== "completed");

    if (!newlyCompleted) continue;

    notifications.push({
      key: `${threadKey}:${latestTurn.turnId}`,
      threadTitle: thread.title,
      projectTitle: projectTitles.get(scopedKey(thread.environmentId, thread.projectId)) ?? null,
    });
  }

  return { observedTurns, notifications };
}
