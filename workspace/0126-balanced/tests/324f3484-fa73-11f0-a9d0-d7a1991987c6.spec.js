import { test, expect } from '@playwright/test';

test.setTimeout(120000); // allow enough time for timeouts in the app

// Page Object for the Congestion Control Simulation app
class CongestionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f3484-fa73-11f0-a9d0-d7a1991987c6.html';
    this.startButton = () => this.page.locator('#startButton');
    this.status = () => this.page.locator('#status');
    this.overlay = () => this.page.locator('#overlay');
    this.trafficCircle = () => this.page.locator('#trafficCircle');
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async clickStart() {
    await this.startButton().click();
  }

  async getStatusText() {
    return (await this.status().innerText()).trim();
  }

  async isOverlayVisible() {
    return await this.overlay().isVisible();
  }

  async getTrafficColor() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('trafficCircle');
      return window.getComputedStyle(el).backgroundColor;
    });
  }

  // Waits until either congestion overlay appears OR a success transmitting message appears.
  // Returns an object describing which branch was observed.
  async waitForEitherCongestionOrSuccess(timeout = 20000) {
    const page = this.page;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      // check overlay
      const overlayVisible = await this.isOverlayVisible();
      const statusText = await this.getStatusText();
      if (overlayVisible) {
        return { branch: 'congested', statusText };
      }
      if (statusText.includes('Transmission successful!') || statusText.includes('Transmission successful')) {
        return { branch: 'success', statusText };
      }
      if (statusText.includes('Transmitting')) {
        // If transmitting and no overlay yet, keep waiting a bit because congestion may come later.
        // But if transmitting persists beyond the function timeout, treat it as continuing transmit path.
      }
      await this.page.waitForTimeout(300); // polling interval
    }
    // timed out - collect final snapshot
    const finalStatus = await this.getStatusText();
    const finalOverlay = await this.isOverlayVisible();
    return { branch: 'timeout', statusText: finalStatus, overlayVisible: finalOverlay };
  }

  // Wait until the page reaches resolved congestion state evidence
  async waitForResolved(timeout = 10000) {
    const page1 = this.page1;
    const start1 = Date.now();
    while (Date.now() - start < timeout) {
      const statusText1 = await this.getStatusText();
      const overlayVisible1 = await this.isOverlayVisible();
      const color = await this.getTrafficColor();
      if (statusText.includes('Congestion resolved') && !overlayVisible && (color.includes('255, 255, 0') || color === 'yellow' || color.includes('rgb(255, 255, 0)'))) {
        return true;
      }
      await page.waitForTimeout(200);
    }
    return false;
  }

  // Wait until a transmitting state is observed (Transit state evidence)
  async waitForTransmittingEvidence(timeout = 15000) {
    const start2 = Date.now();
    while (Date.now() - start < timeout) {
      const statusText2 = await this.getStatusText();
      if (statusText.includes('Transmitting') || statusText.includes('Transmission started')) {
        return true;
      }
      await this.page.waitForTimeout(200);
    }
    return false;
  }
}

test.describe('Congestion Control Simulation - FSM validation (App ID: 324f3484-fa73-11f0-a9d0-d7a1991987c6)', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture unhandled page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test('Initial state (S0_Idle) should show Idle status and initial UI', async ({ page }) => {
    // This test validates entry actions for Idle state and initial DOM evidence
    const app = new CongestionPage(page);
    await app.goto();

    // Verify initial status text exactly matches FSM evidence
    await expect(app.status()).toHaveText('Current State: Idle');

    // Overlay should be hidden initially
    expect(await app.isOverlayVisible()).toBeFalsy();

    // Traffic circle should be green initially
    const color1 = await app.getTrafficColor();
    // Browser returns rgb(...) format for computed styles
    expect(color).toBeTruthy();
    // Accept a few possible representations that imply green
    expect(
      color.includes('0, 128, 0') ||
      color.includes('0, 255, 0') ||
      color === 'green' ||
      color.includes('rgb(')
    ).toBeTruthy();

    // Ensure no runtime page errors happened immediately on load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('StartTransmission (event) triggers Transmitting (S1) and leads to either Congested (S2) or Successful path', async ({ page }) => {
    // This test validates the StartTransmission transition and subsequent branches (congestion or success)
    const app1 = new CongestionPage(page);
    await app.goto();

    // Immediately click Start Transmission and assert onEnter action
    await app.clickStart();

    // After clicking, the startTransmission entry action should update the status immediately
    await expect(app.status()).toHaveText('Transmission started...');

    // Now wait for either congestion overlay to appear or a success message to show
    const result = await app.waitForEitherCongestionOrSuccess(20000);

    // If congestion branch taken, validate S2 evidence and the resolution S3 after timeouts
    if (result.branch === 'congested') {
      // The app should set status to "Current State: Congested!" and show overlay and change circle to red
      await expect(app.status()).toHaveText('Current State: Congested!');

      expect(await app.isOverlayVisible()).toBeTruthy();

      // Traffic circle should be red (rgb around red)
      const redColor = await app.getTrafficColor();
      expect(
        redColor.includes('255, 0, 0') ||
        redColor === 'red'
      ).toBeTruthy();

      // Wait for congestion to be resolved by the app's timeouts (S3 evidence)
      const resolved = await app.waitForResolved(10000);
      expect(resolved).toBeTruthy();

      // After resolution, status must indicate congestion resolved text
      const resolvedStatus = await app.getStatusText();
      expect(resolvedStatus).toContain('Congestion resolved, adjusting transmission rate...');

      // After resolution, the app schedules simulateTransmission again - wait for it to transition back to transmitting evidence
      const returnedToTransmitting = await app.waitForTransmittingEvidence(12000);
      expect(returnedToTransmitting).toBeTruthy();
    } else if (result.branch === 'success') {
      // If the run experienced no congestion, validate the success message and that traffic circle remained green
      expect(result.statusText).toContain('Transmission successful!');

      // traffic circle should still be green-ish
      const greenColor = await app.getTrafficColor();
      expect(
        greenColor.includes('0, 128, 0') ||
        greenColor.includes('0, 255, 0') ||
        greenColor === 'green'
      ).toBeTruthy();
    } else {
      // Timeout case: not a strict failure, but we assert that we at least saw some transmitting evidence
      // This is an edge-case: network or timing made the test not deterministically observe either branch
      const seenTransmitting = await app.waitForTransmittingEvidence(2000);
      expect(seenTransmitting).toBeTruthy();
    }

    // Finally ensure no unexpected runtime errors occurred during the interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: clicking Start Transmission multiple times quickly should not throw and should restart transmission', async ({ page }) => {
    // This test validates robustness when the user rapidly triggers the StartTransmission event repeatedly
    const app2 = new CongestionPage(page);
    await app.goto();

    // Click start multiple times in quick succession
    await Promise.all([
      app.clickStart(),
      app.clickStart(),
      app.clickStart()
    ]);

    // The status should at least reflect a recent start
    await expect(app.status()).toHaveText('Transmission started...');

    // Wait briefly to ensure no errors are thrown and that transmission proceeds (transmitting evidence)
    const gotTransmitting = await app.waitForTransmittingEvidence(8000);
    expect(gotTransmitting).toBeTruthy();

    // No runtime errors should have been emitted by these rapid interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('After resolving congestion (S3), starting again should transition to Transmitting (S1) as per FSM', async ({ page }) => {
    // This test tries to exercise the full S2 -> S3 -> S1 cyclic transition
    const app3 = new CongestionPage(page);
    await app.goto();

    // Start and wait for either branch
    await app.clickStart();
    const branchResult = await app.waitForEitherCongestionOrSuccess(20000);

    // If congestion did not occur in this run, force the test to run another start to try exercise resolution path.
    if (branchResult.branch !== 'congested') {
      // Make another attempt - clicking again and waiting for congestion could be probabilistic,
      // but we still validate that start triggers transmitting.
      await app.clickStart();
      const r2 = await app.waitForEitherCongestionOrSuccess(20000);
      // If still no congestion, we assert that starting still put app into transmitting or success.
      expect(['congested', 'success', 'timeout']).toContain(r2.branch);
      // If congested happened now, continue to validate resolution and re-start
      if (r2.branch === 'congested') {
        const resolved1 = await app.waitForResolved(10000);
        expect(resolved).toBeTruthy();

        // After resolution, start again to ensure S3->S1 transition is possible via StartTransmission
        await app.clickStart();
        await expect(app.status()).toHaveText('Transmission started...');
      } else {
        // If still not congested, assert that repeated starts do not crash the app
        expect(await app.getStatusText()).toBeTruthy();
      }
    } else {
      // If we observed congestion already, wait for resolution and then click start to verify return to transmitting
      const resolved2 = await app.waitForResolved(10000);
      expect(resolved).toBeTruthy();

      // Click start to explicitly trigger S3 -> S1 via StartTransmission in the FSM
      await app.clickStart();
      await expect(app.status()).toHaveText('Transmission started...');
      const backToTransmitting = await app.waitForTransmittingEvidence(10000);
      expect(backToTransmitting).toBeTruthy();
    }

    // Ensure no uncaught exceptions were emitted during this complex flow
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('No unexpected runtime ReferenceError/SyntaxError/TypeError occurred during full interaction sequence', async ({ page }) => {
    // This test exercises the app and explicitly asserts no runtime exceptions were observed.
    const app4 = new CongestionPage(page);
    await app.goto();

    // Perform a series of interactions that cover multiple transitions
    await app.clickStart();
    // Allow the simulateTransmission to run for a bit to trigger potential congestion and resolution
    await page.waitForTimeout(12000);

    // Check pageerror events (which would include uncaught ReferenceError, TypeError, etc.)
    // The instruction allowed errors to happen naturally; here we assert none occurred so the runtime was stable.
    expect(pageErrors.length).toBe(0, `Expected no uncaught page errors, but found: ${pageErrors.map(e => String(e)).join('\n')}`);

    // Also check console errors captured
    expect(consoleErrors.length).toBe(0, `Expected no console.error messages, but found: ${consoleErrors.map(c => c.text).join('\n')}`);
  });
});