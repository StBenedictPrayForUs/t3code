import { useEffect, useRef } from "react";

import { isElectron } from "../../env";
import { useProjects, useThreadShells } from "../../state/entities";
import {
  observeTurnCompletions,
  type TurnCompletionObservation,
} from "./TurnCompleteNotificationHost.logic";

const EMPTY_OBSERVATION: TurnCompletionObservation = {
  observedTurns: new Map(),
  notifications: [],
};

/** Shows a native Windows notification when a turn finishes while T3 Code is unfocused. */
export function TurnCompleteNotificationHost() {
  if (!isElectron) return null;
  return <ElectronTurnCompleteNotificationHost />;
}

function ElectronTurnCompleteNotificationHost() {
  const threads = useThreadShells();
  const projects = useProjects();
  const observationRef = useRef<TurnCompletionObservation>(EMPTY_OBSERVATION);

  useEffect(() => {
    const observation = observeTurnCompletions({
      previous: observationRef.current.observedTurns,
      threads,
      projects,
    });
    observationRef.current = observation;

    if (
      document.hasFocus() ||
      typeof window.Notification === "undefined" ||
      window.Notification.permission === "denied"
    ) {
      return;
    }

    for (const completion of observation.notifications) {
      const body = completion.projectTitle
        ? `${completion.threadTitle} — ${completion.projectTitle}`
        : completion.threadTitle;
      try {
        const notification = new window.Notification("Turn complete", {
          body,
          tag: completion.key,
        });
        notification.addEventListener(
          "error",
          (event) => {
            console.error("Could not show turn completion notification.", event);
          },
          { once: true },
        );
      } catch (cause) {
        console.error("Could not show turn completion notification.", cause);
      }
    }
  }, [projects, threads]);

  return null;
}
