import { readFileSync } from "node:fs";

import { describe, expect, it } from "vite-plus/test";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("pre-React theme initializer", () => {
  it.each([
    ["codex-one", "#262a32"],
    ["true-godot", "#1d2229"],
    ["github-dark", "#0d1117"],
    ["nord", "#2e3440"],
    ["dracula", "#282a36"],
    ["solarized-light", "#fdf6e3"],
  ])("maps %s to its boot background %s", (theme, background) => {
    expect(indexHtml).toMatch(
      new RegExp(`(?:["']${theme}["']|${theme}):\\s*["']${background}["']`),
    );
  });

  it("uses the resolved boot background for both the browser chrome and splash", () => {
    expect(indexHtml).toContain(
      'document.documentElement.style.setProperty("--boot-background", chromeColor)',
    );
    expect(indexHtml).toContain("background: var(--boot-background, #ffffff)");
    expect(indexHtml).toContain("background: var(--boot-background, #161616)");
  });
});
