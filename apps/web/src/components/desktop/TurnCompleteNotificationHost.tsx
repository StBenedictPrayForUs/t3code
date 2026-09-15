import { useEffect, useRef } from "react";

import { isElectron } from "../../env";
import type { AppRouter } from "../../router";
import { useProjects, useThreadShells } from "../../state/entities";
import {
  observeTurnCompletions,
  observeUserInputRequests,
  type TurnCompletionObservation,
} from "./TurnCompleteNotificationHost.logic";

const EMPTY_OBSERVATION: TurnCompletionObservation = {
  observedTurns: new Map(),
  notifications: [],
};

/** Shows native notifications for completed turns and pending input while T3 Code is unfocused. */
export function TurnCompleteNotificationHost({ router }: { readonly router: AppRouter }) {
  if (!isElectron) return null;
  return <ElectronTurnCompleteNotificationHost router={router} />;
}

function ElectronTurnCompleteNotificationHost({ router }: { readonly router: AppRouter }) {
  const threads = useThreadShells();
  const projects = useProjects();
  const observationRef = useRef<TurnCompletionObservation>(EMPTY_OBSERVATION);
  const requestsRef = useRef<ReadonlyMap<string, boolean>>(new Map());

  useEffect(() => {
    const observation = observeTurnCompletions({
      previous: observationRef.current.observedTurns,
      threads,
      projects,
    });
    observationRef.current = observation;
    const requests = observeUserInputRequests({ previous: requestsRef.current, threads, projects });
    requestsRef.current = requests.observedRequests;

    if (
      document.hasFocus() ||
      typeof window.Notification === "undefined" ||
      window.Notification.permission === "denied"
    ) {
      return;
    }

    const notifications = [
      ...observation.notifications.map((notification) => ({
        ...notification,
        title: "Turn complete",
      })),
      ...requests.notifications.map((notification) => ({
        ...notification,
        title: "Input requested",
      })),
    ];
    for (const completion of notifications) {
      const body = completion.projectTitle
        ? `${completion.threadTitle} — ${completion.projectTitle}`
        : completion.threadTitle;
      try {
        const notification = new window.Notification(completion.title, {
          body,
          tag: completion.key,
        });
        notification.addEventListener(
          "click",
          () => {
            notification.close();
            // Reveal independently so a stale thread or disconnected environment
            // cannot prevent the app from coming to the foreground.
            if (window.desktopBridge?.activateWindow) {
              void window.desktopBridge.activateWindow().catch((cause) => {
                console.error("Could not activate the app from a notification.", cause);
              });
            } else {
              window.focus();
            }
            void router
              .navigate({
                to: "/$environmentId/$threadId",
                params: { environmentId: completion.environmentId, threadId: completion.threadId },
              })
              .catch((cause) => {
                console.error("Could not open the notification thread.", cause);
              });
          },
          { once: true },
        );
        notification.addEventListener(
          "error",
          (event) => {
            console.error("Could not show thread notification.", event);
          },
          { once: true },
        );
      } catch (cause) {
        console.error("Could not show thread notification.", cause);
      }
    }
  }, [projects, router, threads]);

  return null;
}
