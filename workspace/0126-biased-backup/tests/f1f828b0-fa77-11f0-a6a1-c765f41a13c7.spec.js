import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f828b0-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object representing the key interactive parts of the app
class AppPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      stage: '#stage',
      toggleBtn: '#toggleBtn',
      resetBtn: '#resetBtn',
      packet: '#packet',
      appRoot: '.app',
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getStageHandle() {
    return this.page.locator(this.selectors.stage);
  }

  async getToggleHandle() {
    return this.page.locator(this.selectors.toggleBtn);
  }

  async getResetHandle() {
    return this.page.locator(this.selectors.resetBtn);
  }

  async getPacketHandle() {
    return this.page.locator(this.selectors.packet);
  }

  // Check if stage has .running class
  async isRunning() {
    return await this.page.locator(this.selectors.stage).evaluate((el) => el.classList.contains('running'));
  }

  // Click the toggle button
  async clickToggle() {
    await this.page.click(this.selectors.toggleBtn);
  }

  // Click the reset button
  async clickReset() {
    await this.page.click(this.selectors.resetBtn);
  }

  // Press Space on the page (deliberately not focusing a button)
  async pressSpace() {
    await this.page.keyboard.press('Space');
  }

  // Press Space while focusing a specific element
  async pressSpaceOn(selector) {
    await this.page.focus(selector);
    await this.page.keyboard.press('Space');
  }

  // Get text content of toggle button
  async toggleText() {
    return this.page.locator(this.selectors.toggleBtn).textContent();
  }

  // Get aria-pressed attr value of toggle button
  async toggleAriaPressed() {
    return this.page.locator(this.selectors.toggleBtn).getAttribute('aria-pressed');
  }

  // Get title attribute of toggle button
  async toggleTitle() {
    return this.page.locator(this.selectors.toggleBtn).getAttribute('title');
  }

  // Get computed animation-play-state of a selector (packet or header/payload)
  async animationPlayState(selector) {
    return this.page.locator(selector).evaluate((el) => {
      const cs = window.getComputedStyle(el);
      // animation-play-state can be a comma-separated list if multiple animations exist; return as-is
      return cs.animationPlayState;
    });
  }
}

test.describe('TCP/IP — Visualized (FSM: Idle <-> Running)', () => {
  let app;
  let consoleErrors = [];
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    consoleMessages = [];

    // Capture console messages and page errors for each test
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error')
        consoleErrors.push(msg.text());
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    app = new AppPage(page);
    await app.goto();
    // wait a tick for any potential initialization handlers to run
    await page.waitForTimeout(20);
  });

  test.afterEach(async () => {
    // Assert that there were no uncaught page errors or console.error messages.
    // This validates the application loaded without runtime exceptions.
    expect(pageErrors.length, `Unexpected window 'pageerror' events: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.join('; ')}`).toBe(0);
  });

  test.describe('Initial / S0_Idle state validations', () => {
    test('Initial state should be Idle: stage not running and toggle button shows Play', async () => {
      // Validate stage is not running (S0_Idle)
      expect(await app.isRunning()).toBeFalsy();

      // Toggle button should show "Play" and be aria-pressed="false"
      const text = (await app.toggleText())?.trim();
      expect(text).toBe('Play');
      const aria = await app.toggleAriaPressed();
      expect(aria).toBe('false');

      // Title attribute should indicate Play animation
      const title = await app.toggleTitle();
      expect(title).toContain('Play');

      // Animation computed style when not running should be paused
      const packetState = await app.animationPlayState('#packet');
      // When CSS uses multiple animations, animation-play-state may be 'paused' or 'paused, paused...'
      expect(packetState.includes('paused')).toBeTruthy();
    });
  });

  test.describe('Play/Pause Toggle (TogglePlayPause event)', () => {
    test('Clicking Play toggles to Running (S1_Running): stage gains class, button shows Pause and aria-pressed true', async () => {
      // Click the toggle button to start animation
      await app.clickToggle();

      // Stage should have .running class (onEnter action effect)
      expect(await app.isRunning()).toBeTruthy();

      // Toggle button should have updated text and aria attribute
      const text = (await app.toggleText())?.trim();
      expect(text).toBe('Pause');
      const aria = await app.toggleAriaPressed();
      expect(aria).toBe('true');

      // Computed animation-play-state should indicate running for packet (evidence of animations being started)
      const packetState = await app.animationPlayState('#packet');
      expect(packetState.includes('running')).toBeTruthy();
    });

    test('Clicking Pause toggles back to Idle (S0_Idle): stage loses class, button returns to Play', async () => {
      // Start running first
      await app.clickToggle();
      expect(await app.isRunning()).toBeTruthy();

      // Click again to pause
      await app.clickToggle();

      // Stage should not have .running
      expect(await app.isRunning()).toBeFalsy();

      const text = (await app.toggleText())?.trim();
      expect(text).toBe('Play');
      const aria = await app.toggleAriaPressed();
      expect(aria).toBe('false');

      // Packet animation should be paused again
      const packetState = await app.animationPlayState('#packet');
      expect(packetState.includes('paused')).toBeTruthy();
    });
  });

  test.describe('ResetAnimation event and DOM replacement behavior', () => {
    test('Reset while Running stops animation and replaces packet element in the DOM', async ({ page }) => {
      // Start the animation
      await app.clickToggle();
      expect(await app.isRunning()).toBeTruthy();

      // Grab a handle/reference to the existing packet element
      const packetBefore = await app.getPacketHandle().elementHandle();
      expect(packetBefore).not.toBeNull();

      // Click reset
      await app.clickReset();

      // Wait slightly longer than the reset setTimeout to allow replacement to occur
      await page.waitForTimeout(60);

      // Stage should not be running (reset sets running false)
      expect(await app.isRunning()).toBeFalsy();

      // Toggle button should be back to Play
      const text = (await app.toggleText())?.trim();
      expect(text).toBe('Play');
      expect((await app.toggleAriaPressed())).toBe('false');

      // The packet element should be a different DOM node (replacement)
      const packetAfter = await app.getPacketHandle().elementHandle();
      expect(packetAfter).not.toBeNull();

      // Ensure the node identity changed (object identity is different)
      const beforeJSHandle = packetBefore;
      const afterJSHandle = packetAfter;
      // Compare by evaluating a unique property (like isSameNode)
      const sameNode = await page.evaluate(
        ([a, b]) => a.isSameNode(b),
        [beforeJSHandle, afterJSHandle]
      ).catch(() => false);
      // isSameNode should be false because reset replaced the node
      expect(sameNode).toBeFalsy();
    });

    test('Reset when already Idle still replaces packet node and preserves Idle state', async ({ page }) => {
      // Ensure idle
      expect(await app.isRunning()).toBeFalsy();

      const packetBefore = await app.getPacketHandle().elementHandle();
      expect(packetBefore).not.toBeNull();

      await app.clickReset();
      await page.waitForTimeout(60);

      // Still idle
      expect(await app.isRunning()).toBeFalsy();
      expect((await app.toggleAriaPressed())).toBe('false');
      const packetAfter = await app.getPacketHandle().elementHandle();
      expect(packetAfter).not.toBeNull();

      const sameNode = await page.evaluate(
        ([a, b]) => a.isSameNode(b),
        [packetBefore, packetAfter]
      ).catch(() => false);
      // Should be false (node replaced)
      expect(sameNode).toBeFalsy();
    });
  });

  test.describe('Keyboard interactions (SpaceToggle event)', () => {
    test('Pressing Space while focus is not on a button toggles Play/Pause', async ({ page }) => {
      // Ensure focus is on body / app root (not a button)
      await page.focus('body');

      // Initial state idle
      expect(await app.isRunning()).toBeFalsy();

      // Press Space to start
      await app.pressSpace();

      // Wait a tick for handler to run
      await page.waitForTimeout(20);
      expect(await app.isRunning()).toBeTruthy();

      // Press Space again to pause
      await app.pressSpace();
      await page.waitForTimeout(20);
      expect(await app.isRunning()).toBeFalsy();
    });

    test('Pressing Space while focus is on the toggle button should still toggle via native button activation', async ({ page }) => {
      // Focus the toggle button and press Space. The script explicitly ignores keydown if activeElement is a button,
      // but browsers will normally trigger the button's activation on Space, so this should toggle as well.
      await page.focus('#toggleBtn');
      expect(await app.isRunning()).toBeFalsy();

      // Simulate pressing Space on the focused button (native behavior triggers click)
      await app.pressSpaceOn('#toggleBtn');
      await page.waitForTimeout(20);

      // Should have toggled to running
      expect(await app.isRunning()).toBeTruthy();

      // Press Space again to toggle back to idle
      await app.pressSpaceOn('#toggleBtn');
      await page.waitForTimeout(20);
      expect(await app.isRunning()).toBeFalsy();
    });
  });

  test.describe('Edge cases & accessibility related checks', () => {
    test('Toggle button attributes update consistently with state transitions', async () => {
      // Initial
      expect((await app.toggleAriaPressed())).toBe('false');
      expect((await app.toggleText())?.trim()).toBe('Play');

      // Start
      await app.clickToggle();
      expect((await app.toggleAriaPressed())).toBe('true');
      expect((await app.toggleText())?.trim()).toBe('Pause');

      // Reset should restore aria and text
      await app.clickReset();
      // wait for reset replacement
      await new Promise((r) => setTimeout(r, 60));
      expect((await app.toggleAriaPressed())).toBe('false');
      expect((await app.toggleText())?.trim()).toBe('Play');
    });

    test('Animation-play-state of headers/payload follow the stage.running class (visual feedback)', async () => {
      // Initially paused
      const hdrTcpBefore = await app.animationPlayState('.hdr.tcp');
      expect(hdrTcpBefore.includes('paused')).toBeTruthy();

      // Start running
      await app.clickToggle();
      const hdrTcpRunning = await app.animationPlayState('.hdr.tcp');
      expect(hdrTcpRunning.includes('running')).toBeTruthy();

      // Pause again
      await app.clickToggle();
      const hdrTcpAfter = await app.animationPlayState('.hdr.tcp');
      expect(hdrTcpAfter.includes('paused')).toBeTruthy();
    });
  });

  test.describe('Monitoring console and runtime errors (observability)', () => {
    test('No unexpected console.error or page errors occurred during interaction scenarios', async ({ page }) => {
      // Perform a sequence of typical interactions to exercise code paths
      await app.clickToggle(); // start
      await page.waitForTimeout(20);
      await app.clickReset(); // reset while running
      await page.waitForTimeout(60);
      await app.pressSpace(); // start via keyboard
      await page.waitForTimeout(20);
      await app.pressSpace(); // pause via keyboard
      await page.waitForTimeout(20);

      // At the end of interactions we assert again that there were no page errors or console.error messages.
      // These arrays were captured in beforeEach and are asserted in afterEach as well, but assert here explicitly too.
      expect(pageErrors.length, `Expected no page errors but found: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `Expected no console.error messages but found: ${consoleErrors.join('; ')}`).toBe(0);

      // Additionally capture that some console messages (if any) are present (informational), but none are error-level.
      // We check that consoleMessages at least is an array (it is) and ensure no message.type === 'error'
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });
  });
});