import { describe, expect, it } from "vite-plus/test";

import {
  clampPreviewMiniPlayerPosition,
  clampPreviewMiniPlayerSize,
  PREVIEW_MINI_PLAYER_EDGE_GAP,
  resizePreviewMiniPlayerFromCorner,
} from "./previewMiniPlayerLayout";

describe("clampPreviewMiniPlayerPosition", () => {
  it("keeps a dragged player within the chat viewport", () => {
    expect(
      clampPreviewMiniPlayerPosition(
        { x: 900, y: -40 },
        { width: 1_000, height: 700 },
        { width: 360, height: 240 },
      ),
    ).toEqual({
      x: 628,
      y: PREVIEW_MINI_PLAYER_EDGE_GAP,
    });
  });

  it("keeps an edge gap when the player is larger than its container", () => {
    expect(
      clampPreviewMiniPlayerPosition(
        { x: 20, y: 30 },
        { width: 200, height: 160 },
        { width: 360, height: 240 },
      ),
    ).toEqual({
      x: PREVIEW_MINI_PLAYER_EDGE_GAP,
      y: PREVIEW_MINI_PLAYER_EDGE_GAP,
    });
  });

  it("keeps the player above a growing composer inset", () => {
    expect(
      clampPreviewMiniPlayerPosition(
        { x: 500, y: 448 },
        { width: 1_000, height: 700 },
        { width: 360, height: 240 },
        160,
      ),
    ).toEqual({
      x: 500,
      y: 288,
    });
  });
});

describe("clampPreviewMiniPlayerSize", () => {
  it("allows resizing within the available chat viewport", () => {
    expect(
      clampPreviewMiniPlayerSize({ width: 520, height: 360 }, { width: 1_000, height: 700 }, 120),
    ).toEqual({ width: 520, height: 360 });
  });

  it("bounds oversized players above the composer", () => {
    expect(
      clampPreviewMiniPlayerSize(
        { width: 2_000, height: 2_000 },
        { width: 1_000, height: 700 },
        120,
      ),
    ).toEqual({ width: 976, height: 556 });
  });

  it("lets a tiny container win over the preferred minimum", () => {
    expect(
      clampPreviewMiniPlayerSize({ width: 360, height: 239 }, { width: 250, height: 180 }, 20),
    ).toEqual({ width: 226, height: 136 });
  });
});

describe("resizePreviewMiniPlayerFromCorner", () => {
  it.each([
    ["northwest", { x: -40, y: -30 }, { x: 160, y: 170 }],
    ["northeast", { x: 40, y: -30 }, { x: 200, y: 170 }],
    ["southwest", { x: -40, y: 30 }, { x: 160, y: 200 }],
    ["southeast", { x: 40, y: 30 }, { x: 200, y: 200 }],
  ] as const)(
    "resizes from the %s corner while anchoring its opposite corner",
    (corner, delta, position) => {
      expect(
        resizePreviewMiniPlayerFromCorner(
          corner,
          { x: 200, y: 200 },
          { width: 320, height: 200 },
          delta,
          { width: 1_000, height: 700 },
        ),
      ).toEqual({
        position,
        size: { width: 360, height: 230 },
      });
    },
  );

  it.each([
    [
      "northwest",
      { x: -1_000, y: -1_000 },
      { x: PREVIEW_MINI_PLAYER_EDGE_GAP, y: PREVIEW_MINI_PLAYER_EDGE_GAP },
      { width: 908, height: 488 },
    ],
    ["northeast", { x: 400, y: -1_000 }, { x: 600, y: 12 }, { width: 388, height: 488 }],
    ["southwest", { x: -1_000, y: 300 }, { x: 12, y: 300 }, { width: 908, height: 228 }],
    ["southeast", { x: 400, y: 300 }, { x: 600, y: 300 }, { width: 388, height: 228 }],
  ] as const)(
    "keeps the opposite corner anchored when %s resizing reaches the viewport edge",
    (corner, delta, position, size) => {
      expect(
        resizePreviewMiniPlayerFromCorner(
          corner,
          { x: 600, y: 300 },
          { width: 320, height: 200 },
          delta,
          { width: 1_000, height: 700 },
          160,
        ),
      ).toEqual({ position, size });
    },
  );
});
