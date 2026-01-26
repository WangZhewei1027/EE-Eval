import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f98841-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object for the Neural Networks Visual Concept app
class NeuralNetPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Core selectors used throughout tests
    this.selectors = {
      cardRoot: '#cardRoot',
      playBtn: '#playBtn',
      infoBtn: '#infoBtn',
      btnExplore: '#btnExplore',
      modal: '#modal',
      modalCard: '.modal-card',
      modalClose: '#modalClose',
      edgesLayer: '#edgesLayer',
      nodesLayer: '#nodesLayer',
      networkSVG: '#networkSVG'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async playButton() {
    return this.page.locator(this.selectors.playBtn);
  }

  async infoButton() {
    return this.page.locator(this.selectors.infoBtn);
  }

  async exploreButton() {
    return this.page.locator(this.selectors.btnExplore);
  }

  async modal() {
    return this.page.locator(this.selectors.modal);
  }

  async modalCard() {
    return this.page.locator(this.selectors.modalCard);
  }

  async modalClose() {
    return this.page.locator(this.selectors.modalClose);
  }

  async cardRoot() {
    return this.page.locator(this.selectors.cardRoot);
  }

  async edgesLayer() {
    return this.page.locator(this.selectors.edgesLayer);
  }

  async nodesLayer() {
    return this.page.locator(this.selectors.nodesLayer);
  }

  async networkSVG() {
    return this.page.locator(this.selectors.networkSVG);
  }

  // Helper: is animation playing (playBtn has class 'play' and cardRoot does not have 'paused')
  async isPlaying() {
    const playBtn = await this.playButton();
    const card = await this.cardRoot();
    const hasPlayClass = await playBtn.evaluate((el) => el.classList.contains('play'));
    const cardPaused = await card.evaluate((el) => el.classList.contains('paused'));
    return hasPlayClass && !cardPaused;
  }

  // Helper: is animation paused (playBtn does not have class 'play' and cardRoot has 'paused')
  async isPaused() {
    const playBtn = await this.playButton();
    const card = await this.cardRoot();
    const hasPlayClass = await playBtn.evaluate((el) => el.classList.contains('play'));
    const cardPaused = await card.evaluate((el) => el.classList.contains('paused'));
    return !hasPlayClass && cardPaused;
  }

  // Click controls
  async clickPlay() {
    await (await this.playButton()).click();
  }

  async clickInfo() {
    await (await this.infoButton()).click();
  }

  async clickExplore() {
    await (await this.exploreButton()).click();
  }

  async clickModalClose() {
    await (await this.modalClose()).click();
  }

  // Click modal background (outside modal-card). We click center of modal which is background overlay; ensure we target overlay by coordinates.
  async clickModalBackground() {
    // Click the modal overlay at 10,10 offset relative to modal to ensure target is overlay
    const modal = await this.modal();
    await modal.click({ position: { x: 20, y: 20 } });
  }

  // Press a key on the window
  async pressKey(key) {
    await this.page.keyboard.press(key);
  }
}

test.describe('Neural Networks — Visual Concept (f1f98841...)', () => {
  // Collect console and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages and page errors; capture for later assertions
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      // pageerror event captures unhandled errors
      pageErrors.push(err);
    });

    // Navigate to the application exactly as-is
    const app = new NeuralNetPage(page);
    await app.goto();
  });

  test.afterEach(async ({ page }) => {
    // Give a tiny moment for any pending logs/errors to surface
    await page.waitForTimeout(40);
  });

  test.describe('Initial rendering and Idle state (S0_Idle)', () => {
    test('renders core UI elements and initial Idle evidence', async ({ page }) => {
      // Validate initial render: nodes/edges layers exist and key controls are present
      const app = new NeuralNetPage(page);

      // Verify structural elements exist
      await expect(app.cardRoot()).toBeVisible();
      await expect(app.playButton()).toBeVisible();
      await expect(app.infoButton()).toBeVisible();
      await expect(app.exploreButton()).toBeVisible();

      // Evidence: renderPage() was the entry action for Idle.
      // While we can't call renderPage(), we assert that dynamic content was injected:
      // - nodes layer contains multiple children (node elements)
      // - edges layer contains multiple children (paths)
      const nodesCount = await app.nodesLayer().locator(':scope > *').count();
      const edgesCount = await app.edgesLayer().locator(':scope > *').count();

      expect(nodesCount).toBeGreaterThan(0);
      expect(edgesCount).toBeGreaterThan(0);

      // The play state should be playing on initialization per entry action setPlaying(true)
      const isPlaying = await app.isPlaying();
      expect(isPlaying).toBeTruthy();

      // Assert no unexpected page errors were thrown during initial render
      expect(pageErrors.length).toBe(0);
      // Also assert there are no console messages of type 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Play/Pause controls and transitions (S1 <-> S2)', () => {
    test('clicking the play/pause button toggles pause and play states', async ({ page }) => {
      const app = new NeuralNetPage(page);

      // Start: should be playing
      expect(await app.isPlaying()).toBe(true);

      // Click to pause: transition S1_AnimationPlaying -> S2_AnimationPaused
      await app.clickPlay();
      await page.waitForTimeout(100); // brief wait for DOM class toggles

      expect(await app.isPaused()).toBe(true);

      // Check visual indicator: playBtn should NOT have 'play' class and cardRoot should have 'paused'
      const playBtnHasPlay = await (await app.playButton()).evaluate(el => el.classList.contains('play'));
      const cardHasPaused = await (await app.cardRoot()).evaluate(el => el.classList.contains('paused'));
      expect(playBtnHasPlay).toBe(false);
      expect(cardHasPaused).toBe(true);

      // Click to resume: transition S2_AnimationPaused -> S1_AnimationPlaying
      await app.clickPlay();
      await page.waitForTimeout(100);

      expect(await app.isPlaying()).toBe(true);

      // Check that innerHTML changed accordingly when paused (triangle) vs playing (bars).
      // We assert that after resuming there is an SVG path corresponding to the pause bars; this is visible by the innerHTML having 'path' elements.
      const playBtnHtml = await (await app.playButton()).innerHTML();
      expect(playBtnHtml).toContain('<svg'); // basic sanity
    });

    test('space key toggles play/pause as per keyboard handling', async ({ page }) => {
      const app = new NeuralNetPage(page);

      // Ensure playing -> pressing Space pauses
      expect(await app.isPlaying()).toBe(true);
      await app.pressKey('Space');
      await page.waitForTimeout(80);
      expect(await app.isPaused()).toBe(true);

      // Press Space again to resume
      await app.pressKey('Space');
      await page.waitForTimeout(80);
      expect(await app.isPlaying()).toBe(true);
    });

    test('rapid toggling of play button remains consistent (edge case)', async ({ page }) => {
      const app = new NeuralNetPage(page);

      // Rapidly click the play button multiple times
      for (let i = 0; i < 6; i++) {
        await app.clickPlay();
      }
      // Let the UI settle
      await page.waitForTimeout(150);

      // State should be deterministic: either playing or paused depending on odd/even clicks
      // We computed 6 clicks: even, state should be the same as initial (playing)
      expect(await app.isPlaying()).toBe(true);
    });
  });

  test.describe('Modal behavior and transitions (S3_ModalOpen <-> S4_ModalClosed)', () => {
    test('clicking Learn the idea opens the modal (S0 -> S3)', async ({ page }) => {
      const app = new NeuralNetPage(page);

      // Start with modal closed
      await expect(app.modal()).toBeHidden();

      // Click Learn the idea
      await app.clickExplore();
      await page.waitForTimeout(120);

      // Modal should be visible with class 'open'
      await expect(app.modal()).toHaveClass(/open/);
      expect(await app.modal().isVisible()).toBe(true);
    });

    test('clicking info button opens modal (S0 -> S3) and modal close button closes it (S3 -> S4)', async ({ page }) => {
      const app = new NeuralNetPage(page);

      // Click info button
      await app.clickInfo();
      await page.waitForTimeout(80);

      // Modal should be open
      await expect(app.modal()).toHaveClass(/open/);
      expect(await app.modal().isVisible()).toBe(true);

      // Clicking close should close the modal
      await app.clickModalClose();
      await page.waitForTimeout(80);

      // Modal should no longer have 'open' class
      const modalHasOpen = await (await app.modal()).evaluate(el => el.classList.contains('open'));
      expect(modalHasOpen).toBe(false);
      await expect(app.modal()).toBeHidden();
    });

    test('clicking modal background closes the modal (edge case: outside click)', async ({ page }) => {
      const app = new NeuralNetPage(page);

      // Open modal first
      await app.clickInfo();
      await page.waitForTimeout(80);
      await expect(app.modal()).toHaveClass(/open/);

      // Click the overlay background (not the card)
      await app.clickModalBackground();
      await page.waitForTimeout(80);

      // Modal should be closed
      const modalHasOpen = await (await app.modal()).evaluate(el => el.classList.contains('open'));
      expect(modalHasOpen).toBe(false);
      await expect(app.modal()).toBeHidden();
    });

    test('clicking inside modal-card does NOT close the modal (robustness)', async ({ page }) => {
      const app = new NeuralNetPage(page);

      // Open modal
      await app.clickExplore();
      await page.waitForTimeout(80);
      await expect(app.modal()).toHaveClass(/open/);

      // Click inside modal-card center - should not close
      const modalCard = await app.modalCard();
      await modalCard.click();
      await page.waitForTimeout(60);

      // Modal should remain open
      expect(await app.modal().isVisible()).toBe(true);

      // Cleanup: close it via button
      await app.clickModalClose();
    });

    test('pressing "i" key opens the modal (S0 -> S3) per keyboard handler', async ({ page }) => {
      const app = new NeuralNetPage(page);

      // Ensure modal closed first
      const modalClassList = await (await app.modal()).evaluate(el => Array.from(el.classList));
      if (modalClassList.includes('open')) {
        await app.clickModalClose();
      }

      // Press 'i' lower-case
      await app.pressKey('i');
      await page.waitForTimeout(80);
      expect(await app.modal().isVisible()).toBe(true);

      // Close it
      await app.clickModalClose();
    });
  });

  test.describe('Combined/interleaved interactions & accessibility checks', () => {
    test('pressing Space while modal is open still toggles play/pause (interaction interplay)', async ({ page }) => {
      const app = new NeuralNetPage(page);

      // Ensure playing initially
      expect(await app.isPlaying()).toBe(true);

      // Open modal
      await app.clickInfo();
      await page.waitForTimeout(80);
      await expect(app.modal()).toBeVisible();

      // Press Space key - keyboard handler is global (window) — should toggle play/pause
      await app.pressKey('Space');
      await page.waitForTimeout(80);
      // Now expect paused
      expect(await app.isPaused()).toBe(true);

      // Close modal
      await app.clickModalClose();
      await page.waitForTimeout(60);
      await expect(app.modal()).toBeHidden();
    });

    test('svg network layers maintain transforms and did render animations (evidence of animateSway & dash animation setup)', async ({ page }) => {
      const app = new NeuralNetPage(page);

      // nodesLayer and edgesLayer should exist and have style transforms being applied by animation loop
      const nodesLayerStyle = await app.nodesLayer().evaluate(el => el.style.transform || '');
      const edgesLayerStyle = await app.edgesLayer().evaluate(el => el.style.transform || '');
      // We expect transform strings like 'translateY(...px)' (may be empty string if executed quickly),
      // so assert that they are strings and do not throw when accessed.
      expect(typeof nodesLayerStyle).toBe('string');
      expect(typeof edgesLayerStyle).toBe('string');

      // Check that at least one edge-light path has a computed animation style set (dash)
      const edgeLights = await app.edgesLayer().locator('path.edge-light').count();
      expect(edgeLights).toBeGreaterThan(0);

      // sample one path's style - ensure animation property is present or strokeDasharray is set
      const sample = app.edgesLayer().locator('path.edge-light').first();
      const strokeDasharray = await sample.evaluate(el => el.style.strokeDasharray);
      const animation = await sample.evaluate(el => el.style.animation || el.style.webkitAnimation || '');
      // At least one of these should be set by JS
      expect(strokeDasharray.length > 0 || animation.length > 0).toBeTruthy();
    });
  });

  test.describe('Console & page error observation (robustness & error scenarios)', () => {
    test('no unexpected runtime errors (no pageerror and no console.error)', async ({ page }) => {
      // We already collected consoleMessages and pageErrors during beforeEach navigation.
      // Allow a short delay for any async errors to surface
      await page.waitForTimeout(120);

      // Fail the test if there were any unhandled page errors
      expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

      // Assert there are no console messages of severity 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `Console errors: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);

      // For completeness, also ensure that console warnings are present at most moderately
      const consoleWarnings = consoleMessages.filter(m => m.type === 'warning');
      // It's acceptable to have warnings; we just assert there are not an excessive amount indicating broken behavior
      expect(consoleWarnings.length).toBeLessThan(20);
    });

    test('observe and log any console output (helpful for debugging if errors occur)', async ({ page }) => {
      // Printout of captured console messages to the test trace (not modifying the page)
      // This assertion ensures consoleMessages is an array and can be introspected
      expect(Array.isArray(consoleMessages)).toBe(true);

      // If there are console messages, ensure they all have both type and text keys
      for (const msg of consoleMessages) {
        expect(msg).toHaveProperty('type');
        expect(msg).toHaveProperty('text');
        expect(typeof msg.text).toBe('string');
      }
    });
  });
});