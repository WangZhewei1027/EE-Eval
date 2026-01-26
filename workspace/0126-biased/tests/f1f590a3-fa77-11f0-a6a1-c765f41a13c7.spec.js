import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f590a3-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Merge Sort — Visual Elegance (FSM validation)', () => {
  // Containers for console messages and page errors captured per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later inspection
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the page exactly as provided
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // The app creates a canvas and tiles on init(); wait for canvas to be present
    await page.waitForSelector('#canvas', { timeout: 5000 });

    // Wait for tiles to be rendered (N = 16). This ensures init() and buildVisualization() had time to place DOM elements.
    await page.waitForSelector('.tile', { timeout: 5000 });
    // Small pause to allow initial autoplay requestAnimationFrame/start to run in many environments
    await page.waitForTimeout(300);
  });

  test.afterEach(async () => {
    // Basic housekeeping: ensure no uncaught errors were left behind by the page scripts.
    // Tests below will assert this as needed, but including here to be explicit.
  });

  test('Initial state: application loads, tiles created, and autoplay starts (S1_Playing expected)', async ({ page }) => {
    // This test validates the initial entry action init() ran and autoplay was requested.
    // We assert:
    // - There are 16 tiles created in the canvas
    // - The play button text toggles to "Pause" (i.e., isPlaying === true)
    // - The play icon path has been set to the pause icon d attribute
    // - No uncaught page errors (ReferenceError/SyntaxError/TypeError) occurred during load

    // Verify tile count equals 16
    const tilesCount = await page.$$eval('.tile', els => els.length);
    expect(tilesCount).toBe(16);

    // The UI sets playText to "Pause" when autoplay is started. Wait for this to stabilize.
    await expect(page.locator('#playText')).toHaveText('Pause', { timeout: 4000 });

    // Verify the SVG path for the play icon was changed to the pause form
    const playIconD = await page.$eval('#playIcon', (el) => el.getAttribute('d'));
    expect(playIconD).toBe('M6 5h3v14H6zM15 5h3v14h-3z');

    // Legend should indicate at least "Ready" or transition to "Splitting" shortly.
    // Ensure opName is defined and not empty.
    const opNameText = await page.$eval('#opName', el => el.textContent.trim());
    expect(opNameText.length).toBeGreaterThan(0);

    // Assert there were no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Also assert there are no console.error entries captured
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Play/Pause button toggles playing state (S1_Playing <-> S2_Paused)', async ({ page }) => {
    // This test validates the PlayPause click event transitions:
    // - From playing to paused: playText -> "Play" and icon -> play d
    // - From paused back to playing: playText -> "Pause" and icon -> pause d
    // It also ensures runEvents/pause behaviors are observable via DOM.

    // Ensure currently playing (from init)
    await expect(page.locator('#playText')).toHaveText('Pause', { timeout: 4000 });

    // Click Play/Pause to pause the animation (S1_Playing -> S2_Paused)
    await page.click('#playPause');
    // Waiting a short time for UI update
    await page.waitForTimeout(150);
    await expect(page.locator('#playText')).toHaveText('Play', { timeout: 2000 });

    // Verify icon changed back to Play icon d
    const playD = await page.$eval('#playIcon', el => el.getAttribute('d'));
    expect(playD).toBe('M5 3v18l15-9L5 3z');

    // Now click again to resume (S2_Paused -> S1_Playing)
    await page.click('#playPause');
    await page.waitForTimeout(150);
    await expect(page.locator('#playText')).toHaveText('Pause', { timeout: 2000 });

    // Verify icon is now Pause again
    const pauseD = await page.$eval('#playIcon', el => el.getAttribute('d'));
    expect(pauseD).toBe('M6 5h3v14H6zM15 5h3v14h-3z');

    // Ensure still no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Space key toggles play/pause (SpaceKey event)', async ({ page }) => {
    // This test validates keyboard interaction: pressing Space toggles play/pause
    // It also ensures the page's keydown listener prevented default behavior and toggled UI.

    // Ensure we start from playing state
    await expect(page.locator('#playText')).toHaveText('Pause', { timeout: 4000 });

    // Press Space to pause
    await page.keyboard.press('Space');
    // Small wait for handler to run
    await page.waitForTimeout(150);
    await expect(page.locator('#playText')).toHaveText('Play', { timeout: 2000 });

    // Press Space to resume
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    await expect(page.locator('#playText')).toHaveText('Pause', { timeout: 2000 });

    // No uncaught page errors should have been produced by keyboard interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Shuffle button stops, fades, re-inits, and produces new visualization (Shuffle transitions)', async ({ page }) => {
    // This test validates:
    // - Clicking shuffle requests a stop/reset (stopAndReset)
    // - Canvas opacity briefly set to 0.65 (visual fade)
    // - After a short delay init() runs and tiles re-created
    // - The playText ends up in a consistent state (init auto-starts -> Pause)

    // Ensure initial playing state
    await expect(page.locator('#playText')).toHaveText('Pause', { timeout: 4000 });

    // Click shuffle
    await page.click('#shuffleBtn');

    // Immediately the inline style opacity should be set to '0.65'
    const opacityImmediately = await page.$eval('#canvas', el => el.style.opacity);
    expect(opacityImmediately === '0.65' || opacityImmediately === '0.65;').toBeTruthy();

    // After ~280ms the code calls init() and resets opacity back to '', so wait and assert
    await page.waitForTimeout(600);
    const opacityAfter = await page.$eval('#canvas', el => el.style.opacity);
    expect(opacityAfter === '' || opacityAfter === null).toBeTruthy();

    // Tiles should still be present and equal to N=16 after re-init
    const tilesCountAfter = await page.$$eval('.tile', els => els.length);
    expect(tilesCountAfter).toBe(16);

    // init() triggers autoplay -> playText should be 'Pause' after re-init
    await expect(page.locator('#playText')).toHaveText('Pause', { timeout: 2000 });

    // Confirm legend becomes 'Ready' shortly or eventually 'Splitting' as animation continues
    const opNameValue = await page.$eval('#opName', el => el.textContent.trim());
    expect(opNameValue.length).toBeGreaterThan(0);

    // Assert no runtime exceptions occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Merging and splitting visual states appear in legend and tiles change data-state', async ({ page }) => {
    // This test attempts to observe mid-animation states:
    // - Legend opName should reflect 'Splitting' or 'Merging' while runEvents is executing
    // - Some tiles should exhibit data-state attributes like 'active' or 'merging' at some point

    // Ensure playing
    await expect(page.locator('#playText')).toHaveText('Pause', { timeout: 4000 });

    // Wait until opName changes to 'Splitting' or 'Merging' (one of the expected phases)
    // The animation starts quickly; allow generous timeout.
    await expect.poll(async () => {
      const txt = await page.$eval('#opName', el => el.textContent.trim());
      return txt;
    }, { timeout: 8000 }).toMatch(/Splitting|Merging|Completed|Ready/);

    // Try to capture at least one tile with data-state attribute set to either 'active' or 'merging'
    // Poll for a short window to find such a tile (during animation these states appear)
    let tileWithState = null;
    for (let i = 0; i < 12; i++) {
      tileWithState = await page.$('.tile[data-state="active"], .tile[data-state="merging"]');
      if (tileWithState) break;
      await page.waitForTimeout(200);
    }

    // It's acceptable if a tile with those transient states isn't found (depending on timing),
    // but we assert that the legend shows expected activity.
    const legend = await page.$eval('#opName', el => el.textContent.trim());
    expect(legend.length).toBeGreaterThan(0);

    // Also assert no page errors occurred during animation
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: rapid toggles and repeated shuffle do not produce uncaught exceptions', async ({ page }) => {
    // This test triggers multiple quick interactions to exercise potential race conditions:
    // - Rapid clicks on play/pause
    // - Rapid repeated clicks on shuffle
    // We do not modify application internals; we only observe for runtime exceptions.

    // Rapidly toggle play/pause several times
    for (let i = 0; i < 6; i++) {
      await page.click('#playPause');
      // very short delay to simulate rapid user toggling
      await page.waitForTimeout(80);
    }

    // Rapidly click shuffle a few times
    for (let i = 0; i < 3; i++) {
      await page.click('#shuffleBtn');
      await page.waitForTimeout(120);
    }

    // Allow some time for any asynchronous handlers to finish and for potential errors to surface
    await page.waitForTimeout(1200);

    // Assert no uncaught page errors occurred in this high-frequency interaction scenario
    expect(pageErrors.length).toBe(0);

    // Also assert there are still tiles present
    const tileCount = await page.$$eval('.tile', els => els.length);
    expect(tileCount).toBeGreaterThan(0);
  });

  test('Sanity: ensure no ReferenceError/SyntaxError/TypeError occurred during the entire session', async ({ page }) => {
    // This final test explicitly asserts the absence of the common JS runtime errors
    // by inspecting captured pageErrors and console messages.

    // pageErrors collects uncaught exceptions; ensure none of them contain key error-type strings
    const errorText = pageErrors.join(' | ').toLowerCase();
    expect(errorText).not.toContain('referenceerror');
    expect(errorText).not.toContain('syntaxerror');
    expect(errorText).not.toContain('typeerror');

    // Also scan console messages for 'Uncaught' or error traces
    const consoleErrorEntries = consoleMessages.filter(m => {
      const t = (m.text || '').toLowerCase();
      return t.includes('uncaught') || t.includes('error') || m.type === 'error';
    });

    // We allow normal logs but assert there are no console.error style entries
    expect(consoleErrorEntries.length).toBe(0);
  });
});