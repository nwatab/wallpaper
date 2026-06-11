// REGRESSION GUARD for the swatch-SVG over-invalidation fix (memoized SwatchImage).
// Tags DOM nodes at each level (aside → gallery grids → swatch buttons → svg-wrapper divs → svgs)
// before a pattern switch and counts node-identity survival after. The fix keeps every swatch
// <svg> alive across a switch; the pre-fix bug recreated all of them (0/N). This asserts the
// swatch svgs SURVIVE — so a future regression that reintroduces the per-switch innerHTML
// re-commit fails here. (Diagnostic context: pre-fix this read 0/N at the svg level, which is
// how the remount boundary was localized.)
import { test, expect, type Browser, type BrowserContext } from '@playwright/test';
import { BASELINE_TITLE, DESKTOP_VIEWPORT, PANEL_PROBE_PATTERN, PATTERNS } from './matrix';
import { clickPattern, selectPatternTimed, waitStable } from './measure';

const ROUTE = '/wallpaper';
const TARGET = PATTERNS.find((p) => p.id === PANEL_PROBE_PATTERN) ?? PATTERNS[0];

test('remount boundary (multi-level node identity, desktop)', async ({
  browser,
}: {
  browser: Browser;
}) => {
  const context: BrowserContext = await browser.newContext({
    viewport: DESKTOP_VIEWPORT,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(ROUTE, { waitUntil: 'networkidle' });
  await waitStable(page);
  await clickPattern(page, BASELINE_TITLE);
  await waitStable(page);

  // Tag nodes at each structural level. Selectors chosen against the gallery markup:
  //  aside (panel) → div.grid (per-group swatch grids) → button[title] (swatch buttons)
  //  → button[title] > div (svg-wrapper, dangerouslySetInnerHTML) → svg (the parsed pattern).
  const LEVELS: Record<string, string> = {
    aside: 'aside',
    'gallery grids': 'aside div.grid',
    'swatch buttons': 'aside button[title]',
    'svg-wrapper divs': 'aside button[title] > div',
    'swatch svgs': 'aside svg',
  };

  const before = await page.evaluate((levels) => {
    const out: Record<string, number> = {};
    for (const [name, sel] of Object.entries(levels)) {
      const nodes = Array.from(document.querySelectorAll(sel));
      nodes.forEach((n) => ((n as unknown as { __tag?: string }).__tag = name));
      out[name] = nodes.length;
    }
    return out;
  }, LEVELS);

  await selectPatternTimed(page, TARGET.title);
  await waitStable(page);

  const after = await page.evaluate((levels) => {
    const out: Record<string, { now: number; survived: number }> = {};
    for (const [name, sel] of Object.entries(levels)) {
      const nodes = Array.from(document.querySelectorAll(sel));
      out[name] = {
        now: nodes.length,
        survived: nodes.filter((n) => (n as unknown as { __tag?: string }).__tag === name).length,
      };
    }
    return out;
  }, LEVELS);

  console.log('\n══ REMOUNT BOUNDARY (node identity across one switch, desktop) ══');
  console.log('  level                before  after  survived');
  for (const name of Object.keys(LEVELS)) {
    console.log(
      `  ${name.padEnd(20)} ${String(before[name]).padStart(6)}  ${String(after[name].now).padStart(5)}  ${String(
        after[name].survived,
      ).padStart(8)}`,
    );
  }
  console.log('  → the highest level with survived < before is the remount boundary.');

  await context.close();

  // GUARD: every swatch <svg> must survive the switch (the fix). Pre-fix this was 0.
  expect(before['swatch svgs']).toBeGreaterThan(0);
  expect(after['swatch svgs'].survived).toBe(before['swatch svgs']);
});
