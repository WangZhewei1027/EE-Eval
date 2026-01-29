import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c996231-fa78-11f0-857d-d58e82d5de73.html';

// Page object to encapsulate interactions with the Virtual Memory visualization page
class VMPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.infoText = page.locator('#info-text');
    this.dot = page.locator('#map-dot-1');
    this.line = page.locator('#map-line-1');
  }

  // Navigate to the app
  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the page finished initial script run
    await this.page.waitForLoadState('domcontentloaded');
  }

  // Trigger play button
  async clickPlay() {
    await this.playBtn.click();
  }

  // Trigger reset button
  async clickReset() {
    await this.resetBtn.click();
  }

  // Get play button text
  async playBtnText() {
    return (await this.playBtn.textContent())?.trim();
  }

  // Get aria-pressed attribute
  async playBtnAriaPressed() {
    return await this.playBtn.getAttribute('aria-pressed');
  }

  // Get info text content trimmed
  async infoTextContent() {
    const txt = await this.infoText.textContent();
    return txt ? txt.trim() : '';
  }

  // Get dot cx, cy as numbers
  async dotPosition() {
    const cx = await this.dot.getAttribute('cx');
    const cy = await this.dot.getAttribute('cy');
    return { cx: parseFloat(cx), cy: parseFloat(cy) };
  }

  // Get strokeDashoffset numeric value
  async lineDashOffset() {
    const v = await this.line.evaluate((el) => el.style.strokeDashoffset);
    return v ? parseFloat(v) : NaN;
  }

  // Wait until info text equals given string (exact match)
  async waitForInfoTextExact(expected, timeout = 8000) {
    await expect(this.infoText).toHaveText(expected, { timeout });
  }

  // Wait until info text contains substring
  async waitForInfoTextContains(substring, timeout = 3000) {
    await expect(this.infoText).toContainText(substring, { timeout });
  }
}

// Collects console and page errors for each test run
test.describe('Virtual Memory Visualization - FSM and interactions', () => {
  // Arrays to gather console messages and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console "error" messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });
  });

  // After each test, assert that no runtime ReferenceError/TypeError/SyntaxError occurred
  test.afterEach(async () => {
    // Ensure we didn't silently receive typical JS fatal error types.
    const combined = consoleErrors.join(' || ') + ' || ' + pageErrors.join(' || ');
    // This assertion verifies whether any console or page errors contain fatal JS error names.
    // If such errors were naturally thrown by the page, this assert will fail, surfacing the issue.
    expect(combined).not.toMatch(/ReferenceError|TypeError|SyntaxError/);
  });

  test('Initial state S0_Idle on load: resetAnimation invoked and UI shows idle evidence', async ({ page }) => {
    // Validate that on page load the resetAnimation entry action ran and initial idle UI is present.
    const vm = new VMPage(page);
    await vm.goto();

    // The Play button should show "Play Animation" and aria-pressed = "false"
    await expect(vm.playBtn).toHaveText('Play Animation');
    expect(await vm.playBtnAriaPressed()).toBe('false');

    // The info text should show the initial explanatory message
    const initialMsg = 'Observe the flow of address translation from Virtual Address Space through Page Table into Physical Memory frames.';
    // The page wraps that text in <em>, so textContent should equal the string
    await expect(vm.infoText).toHaveText(initialMsg);

    // Dot initial position should be at starting coordinates (100, 145) as set in resetAnimation()
    const pos = await vm.dotPosition();
    expect(pos.cx).toBeCloseTo(100, 1);
    expect(pos.cy).toBeCloseTo(145, 1);
  });

  test('Transition S0_Idle -> S1_Playing: clicking Play triggers animation and updates UI', async ({ page }) => {
    // Clicking Play should set 'Playing...' and aria-pressed true and set infoText to translating message
    const vm = new VMPage(page);
    await vm.goto();

    // Click play to start
    await vm.clickPlay();

    // Immediately the UI should indicate playing state
    await expect(vm.playBtn).toHaveText('Playing...');
    expect(await vm.playBtnAriaPressed()).toBe('true');

    // Info text should update to the "Translating..." message
    await vm.waitForInfoTextContains('Translating virtual address through the page table...');

    // After a short time the dot should have moved from its starting point
    await page.waitForTimeout(250); // allow a frame or two of animation to update
    const posDuring = await vm.dotPosition();
    // The dot should no longer be at the starting x coordinate
    expect(posDuring.cx).not.toBeCloseTo(100, 0);

    // Basic visual feedback on stroke dashoffset should have started moving (less than full length)
    const dash = await vm.lineDashOffset();
    expect(Number.isFinite(dash)).toBeTruthy();
    // dash offset should be less than initial length (initial length is set to the path length; after start it reduces)
    // We cannot know exact length here, but it should be a number >= 0; assert it's not NaN
    expect(isNaN(dash)).toBe(false);
  });

  test('Transition S1_Playing -> S2_Completed: animation completes and UI shows completed evidence', async ({ page }) => {
    // This test waits for the animation to finish (duration ~5200ms) and verifies the "Completed" state evidence.
    const vm = new VMPage(page);
    await vm.goto();

    // Start the animation
    await vm.clickPlay();

    // Wait for the exact completion message. Use an extended timeout to allow full animation to finish.
    const completedMsg = 'Animation completed! The virtual address is fully mapped to physical memory.';
    await vm.waitForInfoTextExact(completedMsg, 8000);

    // After completion the play button should have been reset to initial appearance
    await expect(vm.playBtn).toHaveText('Play Animation');
    expect(await vm.playBtnAriaPressed()).toBe('false');

    // Dot should be at the final point of the path (approximately x=790, y=145)
    const finalPos = await vm.dotPosition();
    expect(finalPos.cx).toBeCloseTo(790, 1); // allow slight floating differences
    expect(finalPos.cy).toBeCloseTo(145, 1);
  });

  test('Transition S1_Playing -> S0_Idle: clicking Reset while playing resets the animation', async ({ page }) => {
    // Start animation then reset mid-flight. Ensure UI and visuals return to idle state.
    const vm = new VMPage(page);
    await vm.goto();

    // Start playing
    await vm.clickPlay();
    await vm.waitForInfoTextContains('Translating virtual address through the page table...');

    // Wait a short while to allow the dot to move
    await page.waitForTimeout(200);
    const posDuring = await vm.dotPosition();
    expect(posDuring.cx).not.toBeCloseTo(100, 0);

    // Now click reset to return to idle
    await vm.clickReset();

    // Play button should be back to idle text and aria-pressed false
    await expect(vm.playBtn).toHaveText('Play Animation');
    expect(await vm.playBtnAriaPressed()).toBe('false');

    // Info text should return to the initial instructional message
    const initialMsg = 'Observe the flow of address translation from Virtual Address Space through Page Table into Physical Memory frames.';
    await expect(vm.infoText).toHaveText(initialMsg);

    // Dot should have been reset to starting coordinates
    const resetPos = await vm.dotPosition();
    expect(resetPos.cx).toBeCloseTo(100, 1);
    expect(resetPos.cy).toBeCloseTo(145, 1);
  });

  test('Transition S2_Completed -> S0_Idle: Reset after completion returns to idle', async ({ page }) => {
    // Let animation complete then press reset and confirm idle state restored.
    const vm = new VMPage(page);
    await vm.goto();

    // Play and wait for completion
    await vm.clickPlay();
    const completedMsg = 'Animation completed! The virtual address is fully mapped to physical memory.';
    await vm.waitForInfoTextExact(completedMsg, 8000);

    // Now click reset
    await vm.clickReset();

    // Verify idle UI again
    await expect(vm.playBtn).toHaveText('Play Animation');
    expect(await vm.playBtnAriaPressed()).toBe('false');
    const initialMsg = 'Observe the flow of address translation from Virtual Address Space through Page Table into Physical Memory frames.';
    await expect(vm.infoText).toHaveText(initialMsg);

    // Dot must be reset to origin
    const resetPos = await vm.dotPosition();
    expect(resetPos.cx).toBeCloseTo(100, 1);
    expect(resetPos.cy).toBeCloseTo(145, 1);
  });

  test('Edge case: clicking Play multiple times while running should not flip state or cause errors', async ({ page }) => {
    // Clicking Play repeatedly while animation is running should keep the UI in playing state and not throw errors.
    const vm = new VMPage(page);
    await vm.goto();

    // Start playing
    await vm.clickPlay();
    await vm.waitForInfoTextContains('Translating virtual address through the page table...');

    // Click play multiple times quickly
    await vm.clickPlay();
    await vm.clickPlay();
    await vm.clickPlay();

    // The UI should still indicate playing and remain stable
    await expect(vm.playBtn).toHaveText('Playing...');
    expect(await vm.playBtnAriaPressed()).toBe('true');

    // Info text still should be the translating message
    await vm.waitForInfoTextContains('Translating virtual address through the page table...');

    // Allow it to complete to avoid leaving animation running for subsequent tests
    const completedMsg = 'Animation completed! The virtual address is fully mapped to physical memory.';
    await vm.waitForInfoTextExact(completedMsg, 8000);
  });

  test('Edge case: clicking Reset while idle should keep the app in idle state (no-op)', async ({ page }) => {
    // If reset is clicked while idle, it is a no-op but should not produce errors.
    const vm = new VMPage(page);
    await vm.goto();

    // Ensure idle initially
    await expect(vm.playBtn).toHaveText('Play Animation');
    expect(await vm.playBtnAriaPressed()).toBe('false');

    // Click reset in idle
    await vm.clickReset();

    // Confirm still idle
    await expect(vm.playBtn).toHaveText('Play Animation');
    expect(await vm.playBtnAriaPressed()).toBe('false');

    const initialMsg = 'Observe the flow of address translation from Virtual Address Space through Page Table into Physical Memory frames.';
    await expect(vm.infoText).toHaveText(initialMsg);
  });
});