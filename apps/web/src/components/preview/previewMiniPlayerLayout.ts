import type { PreviewMiniPlayerPosition, PreviewMiniPlayerSize } from "~/previewMiniPlayerStore";

export const PREVIEW_MINI_PLAYER_EDGE_GAP = 12;
export const PREVIEW_MINI_PLAYER_DEFAULT_SIZE = { width: 320, height: 200 } as const;
export const PREVIEW_MINI_PLAYER_MIN_SIZE = { width: 240, height: 150 } as const;

export type PreviewMiniPlayerResizeCorner = "northeast" | "northwest" | "southeast" | "southwest";

export function clampPreviewMiniPlayerSize(
  size: PreviewMiniPlayerSize,
  container: PreviewMiniPlayerSize,
  bottomInset = 0,
): PreviewMiniPlayerSize {
  const availableWidth = Math.max(1, container.width - PREVIEW_MINI_PLAYER_EDGE_GAP * 2);
  const availableHeight = Math.max(
    1,
    container.height - Math.max(0, bottomInset) - PREVIEW_MINI_PLAYER_EDGE_GAP * 2,
  );
  return {
    width: Math.round(
      Math.min(Math.max(PREVIEW_MINI_PLAYER_MIN_SIZE.width, size.width), availableWidth),
    ),
    height: Math.round(
      Math.min(Math.max(PREVIEW_MINI_PLAYER_MIN_SIZE.height, size.height), availableHeight),
    ),
  };
}

export function clampPreviewMiniPlayerPosition(
  position: PreviewMiniPlayerPosition,
  container: PreviewMiniPlayerSize,
  player: PreviewMiniPlayerSize,
  bottomInset = 0,
): PreviewMiniPlayerPosition {
  const reservedBottomSpace = Math.max(0, bottomInset);
  const maxX = Math.max(
    PREVIEW_MINI_PLAYER_EDGE_GAP,
    container.width - player.width - PREVIEW_MINI_PLAYER_EDGE_GAP,
  );
  const maxY = Math.max(
    PREVIEW_MINI_PLAYER_EDGE_GAP,
    container.height - reservedBottomSpace - player.height - PREVIEW_MINI_PLAYER_EDGE_GAP,
  );
  return {
    x: Math.min(Math.max(position.x, PREVIEW_MINI_PLAYER_EDGE_GAP), maxX),
    y: Math.min(Math.max(position.y, PREVIEW_MINI_PLAYER_EDGE_GAP), maxY),
  };
}

export function resizePreviewMiniPlayerFromCorner(
  corner: PreviewMiniPlayerResizeCorner,
  startPosition: PreviewMiniPlayerPosition,
  startSize: PreviewMiniPlayerSize,
  pointerDelta: PreviewMiniPlayerPosition,
  container: PreviewMiniPlayerSize,
  bottomInset = 0,
): { position: PreviewMiniPlayerPosition; size: PreviewMiniPlayerSize } {
  const fromWest = corner.endsWith("west");
  const fromNorth = corner.startsWith("north");
  const size = clampPreviewMiniPlayerSize(
    {
      width: startSize.width + pointerDelta.x * (fromWest ? -1 : 1),
      height: startSize.height + pointerDelta.y * (fromNorth ? -1 : 1),
    },
    container,
    bottomInset,
  );
  const position = clampPreviewMiniPlayerPosition(
    {
      x: fromWest ? startPosition.x + startSize.width - size.width : startPosition.x,
      y: fromNorth ? startPosition.y + startSize.height - size.height : startPosition.y,
    },
    container,
    size,
    bottomInset,
  );
  return { position, size };
}
