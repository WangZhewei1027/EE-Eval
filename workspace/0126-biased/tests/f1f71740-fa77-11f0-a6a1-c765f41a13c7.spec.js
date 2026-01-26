import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f71740-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object encapsulating common interactions and queries for the application
class BigThetaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nextBtn = page.locator('#nextBtn');
    this.playBtn = page.locator('#playBtn');
    this.badge = page.locator('#exampleBadge');
    this.title = page.locator('#graphTitle');
    this.sub = page.locator('#graphSub');
    this.formula = page.locator('#formula');
    this.explain = page.locator('#explain');
    this.regionPath = page.locator('#regionPath');
    this.fDot = page.locator('#fDot');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for basic UI to settle (initial render animations start quickly)
    await this.page.waitForSelector('#exampleBadge');
  }

  async clickNext() {
    await this.nextBtn.click();
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async pressKey(key) {
    // using keyboard to dispatch global keydown listeners
    await this.page.keyboard.press(key);
  }

  async getBadgeText() {
    return (await this.badge.textContent())?.trim();
  }

  async getTitleText() {
    return (await this.title.textContent())?.trim();
  }

  async getPlayButtonText() {
    return (await this.playBtn.textContent())?.trim();
  }

  async playHasPulseClass() {
    return await this.playBtn.evaluate(el => el.classList.contains('pulse'));
  }

  async getFormulaText() {
    // textContent is fine to assert content includes bounds/c1/c2
    return (await this.formula.textContent())?.trim();
  }

  async getExplainText() {
    return (await this.explain.textContent())?.trim();
  }

  async getRegionOpacity() {
    const val = await this.regionPath.getAttribute('opacity');
    return val;
  }

  async getFDotPosition() {
    // return numeric cx, cy parsed
    const cx = await this.fDot.getAttribute('cx');
    const cy = await this.fDot.getAttribute('cy');
    return { cx: Number(cx), cy: Number(cy) };
  }
}

test.describe('Big-Theta Notation — Visual Demonstration (FSM + UI)', () => {
  // capture console errors and page errors for each test to inspect later
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test('Initial state S0_Example1 renders with correct DOM and descriptive content', async ({ page }) => {
    // Validate initial render corresponds to FSM state S0_Example1
    const app = new BigThetaPage(page);
    await app.goto();

    // Badge shows Example 1/3
    await expect(app.badge).toHaveText('Example 1/3');

    // Title and subtitle match the first example
    await expect(app.title).toHaveText('Linear vs Linear');
    const subText = await app.sub.textContent();
    expect(subText).toContain('f(n) and g(n) shown with Θ bounds');

    // Formula contains c1 and c2 values for example 1 (0.5 and 2)
    const formulaText = await app.getFormulaText();
    expect(formulaText).toContain('0.5');
    // c2 may render as "2" (from 2.0). Ensure a '2' is present in formula text.
    expect(formulaText).toMatch(/2(\.0)?/);

    // Explanation matches the provided getExplanation for example 1
    const explain = await app.getExplainText();
    expect(explain).toMatch(/Here g\(n\) = n/);

    // SVG region should have an opacity attribute set (dynamic visual)
    const regionOpacity = await app.getRegionOpacity();
    // The code sets shadeOpacity to 0.3; assert attribute exists and is a numeric-ish string
    expect(regionOpacity).toBeTruthy();
    // numeric check
    expect(Number(regionOpacity)).toBeGreaterThanOrEqual(0);
  });

  test('NextExampleClick cycles through examples in order and wraps back to start', async ({ page }) => {
    // Validate transitions: S0 -> S1 -> S2 -> S0 via nextBtn click
    const app = new BigThetaPage(page);
    await app.goto();

    // Click once -> Example 2
    await app.clickNext();
    await expect(app.badge).toHaveText('Example 2/3');
    await expect(app.title).toHaveText('Quadratic vs Quadratic');
    const formula2 = await app.getFormulaText();
    expect(formula2).toContain('0.7');
    expect(formula2).toContain('1.6');

    // Click again -> Example 3
    await app.clickNext();
    await expect(app.badge).toHaveText('Example 3/3');
    await expect(app.title).toHaveText('Exponential vs Polynomial');
    const formula3 = await app.getFormulaText();
    // third example has large c2 (1000), check its presence
    expect(formula3).toContain('0.001');
    expect(formula3).toMatch(/1000/);

    // Click again -> wraps back to Example 1
    await app.clickNext();
    await expect(app.badge).toHaveText('Example 1/3');
    await expect(app.title).toHaveText('Linear vs Linear');

    // Edge case: rapid clicks (10 times) should still cycle modulo 3 without throwing
    for (let i = 0; i < 10; i++) {
      await app.clickNext();
    }
    // After 10 clicks from Example 1: idx = (0 + 10) % 3 = 1 => Example 2
    await expect(app.badge).toHaveText('Example 2/3');
    await expect(app.title).toHaveText('Quadratic vs Quadratic');
  });

  test('Keyboard Next (ArrowRight) triggers same transition as NextExampleClick', async ({ page }) => {
    const app = new BigThetaPage(page);
    await app.goto();

    // Press ArrowRight should advance to Example 2
    await app.pressKey('ArrowRight');
    await expect(app.badge).toHaveText('Example 2/3');
    await expect(app.title).toHaveText('Quadratic vs Quadratic');

    // Press ArrowRight again -> Example 3
    await app.pressKey('ArrowRight');
    await expect(app.badge).toHaveText('Example 3/3');
    await expect(app.title).toHaveText('Exponential vs Polynomial');
  });

  test('ToggleAnimationClick updates button text and pulse class; toggles play/pause', async ({ page }) => {
    const app = new BigThetaPage(page);
    await app.goto();

    // Initial state: playing = true => button text 'Pause' and has 'pulse' class
    await expect(app.playBtn).toHaveText('Pause');
    expect(await app.playHasPulseClass()).toBe(true);

    // Click to toggle -> should become 'Play' and pulse class removed
    await app.clickPlay();
    await expect(app.playBtn).toHaveText('Play');
    expect(await app.playHasPulseClass()).toBe(false);

    // Click again -> back to 'Pause' and pulse class present
    await app.clickPlay();
    await expect(app.playBtn).toHaveText('Pause');
    expect(await app.playHasPulseClass()).toBe(true);
  });

  test('ToggleAnimationKey (Space) toggles same as clicking play button and prevents default', async ({ page }) => {
    const app = new BigThetaPage(page);
    await app.goto();

    // Ensure starting 'Pause'
    await expect(app.playBtn).toHaveText('Pause');

    // Press Space to toggle -> should become 'Play'
    // Use 'Space' as Playwright key name
    await app.pressKey('Space');
    await expect(app.playBtn).toHaveText('Play');
    expect(await app.playHasPulseClass()).toBe(false);

    // Press Space again -> back to 'Pause'
    await app.pressKey('Space');
    await expect(app.playBtn).toHaveText('Pause');
    expect(await app.playHasPulseClass()).toBe(true);
  });

  test('Animation dot moves while playing and stops moving when paused', async ({ page }) => {
    const app = new BigThetaPage(page);
    await app.goto();

    // Ensure playing initially (Pause displayed)
    await expect(app.playBtn).toHaveText('Pause');

    // Capture position while playing
    const pos1 = await app.getFDotPosition();

    // Wait some time to allow animation frames to update (should move)
    await page.waitForTimeout(400);
    const pos2 = await app.getFDotPosition();

    // When playing, expect the dot has moved (cx or cy changed)
    const movedWhilePlaying = (pos1.cx !== pos2.cx) || (pos1.cy !== pos2.cy);
    expect(movedWhilePlaying).toBe(true);

    // Now pause the animation
    await app.clickPlay();
    await expect(app.playBtn).toHaveText('Play');

    // Capture position immediately after pausing
    const posPaused1 = await app.getFDotPosition();
    // Wait a bit longer to make sure no movement occurs while paused
    await page.waitForTimeout(400);
    const posPaused2 = await app.getFDotPosition();

    // Expect no appreciable movement while paused (exact equality is reasonable given code stops requestAnimationFrame)
    expect(posPaused1.cx).toBeCloseTo(posPaused2.cx, 2);
    expect(posPaused1.cy).toBeCloseTo(posPaused2.cy, 2);

    // Resume playing to restore original behavior
    await app.clickPlay();
    await expect(app.playBtn).toHaveText('Pause');
    await page.waitForTimeout(300);
    const posAfterResume = await app.getFDotPosition();
    const movedAfterResume = (posPaused2.cx !== posAfterResume.cx) || (posPaused2.cy !== posAfterResume.cy);
    expect(movedAfterResume).toBe(true);
  });

  test('No unexpected console errors or uncaught page errors on load and interactions', async ({ page }) => {
    // This test observes console and page errors and asserts none were produced during normal usage.
    // It also exercises a few interactions to ensure no errors appear from transitions.
    const app = new BigThetaPage(page);
    await app.goto();

    // Perform interactions that exercise code paths
    await app.clickNext(); // example 2
    await app.clickNext(); // example 3
    await app.clickPlay(); // pause
    await app.clickPlay(); // resume
    await app.pressKey('ArrowRight'); // cycle
    await app.pressKey('Space'); // toggle

    // Wait briefly to allow any asynchronous errors to surface
    await page.waitForTimeout(300);

    // Assert that no console.error messages were emitted
    expect(consoleErrors.length, 'No console.error messages should be emitted').toBe(0);

    // Assert that no uncaught page errors occurred
    expect(pageErrors.length, 'No uncaught page errors should occur').toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // Close the page explicitly as part of teardown to ensure animations/frames stop
    try {
      await page.close();
    } catch (e) {
      // swallow any close errors during cleanup
    }
  });
});