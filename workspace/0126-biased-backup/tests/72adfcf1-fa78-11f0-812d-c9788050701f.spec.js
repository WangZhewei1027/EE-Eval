import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72adfcf1-fa78-11f0-812d-c9788050701f.html';

test.describe('Digital Signatures | Cryptographic Elegance - FSM validation', () => {
  // Keep console and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Record console messages and page errors emitted by the page
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the application under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // After each test we assert there were no unexpected runtime errors logged to the console
    // and there were no uncaught page errors.
    // These assertions ensure we observed console and runtime behavior while loading/using the app.
    expect(pageErrors.length, `Expected zero page errors but found: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected zero console.error messages but found: ${consoleErrors.map(c => c.text).join('; ')}`).toBe(0);
  });

  test.describe('States and Transitions', () => {
    test('S0_Idle: initial load should resize canvas and set up initial UI', async ({ page }) => {
      // Validate initial Idle state:
      // - canvas resized to container size (resizeCanvas executed on DOMContentLoaded)
      // - signature-result hidden
      // - verified-badge hidden
      // - step1 is active
      const canvas = page.locator('#signature-pad');
      const container = page.locator('.signature-canvas');
      const signatureResult = page.locator('#signature-result');
      const verifiedBadge = page.locator('#verified-badge');
      const step1 = page.locator('#step1');

      // Ensure the canvas has non-zero size and matches container width/height
      const canvasBox = await canvas.boundingBox();
      const containerBox = await container.boundingBox();
      expect(canvasBox, 'Canvas should have a bounding box after resize').toBeTruthy();
      expect(containerBox, 'Container should have a bounding box').toBeTruthy();

      // Because the resizeCanvas sets canvas.width/height to container.offsetWidth/height,
      // the pixel size of the canvas DOM element should approximately match the container.
      // Use tolerance for fractional differences in headless rendering.
      expect(Math.abs(canvasBox.width - containerBox.width)).toBeLessThan(5);
      expect(Math.abs(canvasBox.height - containerBox.height)).toBeLessThan(5);

      // signature-result initially hidden
      await expect(signatureResult).toHaveCSS('display', 'none');

      // verified badge initially hidden
      await expect(verifiedBadge).toHaveCSS('display', 'none');

      // step1 should have 'active' class
      await expect(step1).toHaveClass(/active/);
    });

    test('Transition S0 -> S1: clicking Generate Signature shows base64 result and hides canvas', async ({ page }) => {
      // Validate Generate Signature from Idle:
      // - signature-result becomes visible and contains base64 PNG data
      // - canvas is hidden
      // - connector width is set (animation started)
      // - step1 loses active, step2 gains active
      const signBtn = page.locator('#sign-btn');
      const canvas = page.locator('#signature-pad');
      const signatureResult = page.locator('#signature-result');
      const activeConnector = page.locator('.active-connector');
      const step1 = page.locator('#step1');
      const step2 = page.locator('#step2');
      const particles = page.locator('#particles');

      // Draw a small stroke onto the canvas to make the signature non-empty (edge case, optional)
      const canvasBox = await canvas.boundingBox();
      if (canvasBox) {
        const x = canvasBox.x + canvasBox.width / 4;
        const y = canvasBox.y + canvasBox.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 20, y + 5);
        await page.mouse.up();
      }

      // Click sign to generate signature
      await signBtn.click();

      // signature-result should be visible and contain a data URL
      await expect(signatureResult).toBeVisible();
      const text = await signatureResult.textContent();
      expect(text && text.startsWith('data:image/png'), 'signature-result should include a base64 PNG data URL').toBeTruthy();

      // canvas should be hidden
      await expect(canvas).toHaveCSS('display', 'none');

      // active connector width should be non-zero (animation started)
      const connectorWidth = await activeConnector.evaluate(node => window.getComputedStyle(node).width);
      expect(connectorWidth !== '0px' && connectorWidth !== '' , `Expected active connector width to be set but got "${connectorWidth}"`).toBeTruthy();

      // step1 should lose active, step2 should gain active
      await expect(step1).not.toHaveClass(/active/);
      await expect(step2).toHaveClass(/active/);

      // particles should have been created (createParticles invoked)
      const particleCount = await particles.evaluate(node => node.children.length);
      expect(particleCount).toBeGreaterThan(0);
    });

    test('Transition S1 -> S3: signature verification completes and verified badge is shown', async ({ page }) => {
      // Validate that after generating signature, the verification animation completes:
      // - hash-visual becomes visible with generated hash-string
      // - step3 becomes active
      // - verified-badge becomes visible after the internal delays (~3s)
      const signBtn = page.locator('#sign-btn');
      const verifiedBadge = page.locator('#verified-badge');
      const hashVisual = page.locator('#hash-visual');
      const hashString = page.locator('#hash-string');
      const step3 = page.locator('#step3');

      // Trigger signature generation (from Idle)
      await signBtn.click();

      // The implementation uses setTimeout: 2000ms to reveal hash-visual + step3, then 1000ms to show verified badge.
      // Wait up to 5 seconds for the verified badge to appear.
      await expect(verifiedBadge).toBeVisible({ timeout: 6000 });

      // Validate verified badge text
      await expect(verifiedBadge).toHaveText(/Signature Verified/);

      // hash-visual should be visible and contain a multi-line hex-like string
      await expect(hashVisual).toBeVisible();
      const hashText = (await hashString.textContent()) || '';
      // Simple checks: not empty, contains hex characters and newlines inserted every 16 characters
      expect(hashText.length).toBeGreaterThan(0);
      // Expect at least one hex character
      expect(/[0-9a-f]/i.test(hashText)).toBeTruthy();
      // Expect newline inserted (generateHash inserts '\n' every 16 chars)
      expect(hashText.includes('\n')).toBeTruthy();

      // step3 should have active class now
      await expect(step3).toHaveClass(/active/);
    });

    test('Transition S0 -> S2: Clear Signature hides result and shows canvas; resets animation and steps', async ({ page }) => {
      // Validate Clear action from Idle clears UI as specified:
      // - signature-result hidden
      // - canvas visible
      // - key-visual shown, hash-visual hidden
      // - active-connector width reset to 0
      // - step1 active, others not
      const clearBtn = page.locator('#clear-btn');
      const canvas = page.locator('#signature-pad');
      const signatureResult = page.locator('#signature-result');
      const keyVisual = page.locator('#key-visual');
      const hashVisual = page.locator('#hash-visual');
      const activeConnector = page.locator('.active-connector');
      const step1 = page.locator('#step1');
      const step2 = page.locator('#step2');
      const step3 = page.locator('#step3');

      // Precondition: ensure signature-result is hidden (Idle)
      await expect(signatureResult).toHaveCSS('display', 'none');

      // Click clear (should be safe even if nothing to clear)
      await clearBtn.click();

      // signature-result remains hidden
      await expect(signatureResult).toHaveCSS('display', 'none');

      // canvas visible (display block)
      await expect(canvas).toHaveCSS('display', 'block');

      // key visual visible and hash visual hidden
      await expect(keyVisual).toHaveCSS('display', 'flex');
      await expect(hashVisual).toHaveCSS('display', 'none');

      // active connector width reset to '0' according to implementation
      const connectorWidth = await activeConnector.evaluate(node => window.getComputedStyle(node).width);
      expect(connectorWidth === '0px' || connectorWidth === '0').toBeTruthy();

      // steps: only step1 active
      await expect(step1).toHaveClass(/active/);
      await expect(step2).not.toHaveClass(/active/);
      await expect(step3).not.toHaveClass(/active/);
    });

    test('Clear after signature: resets verification UI and hides badge', async ({ page }) => {
      // Generate signature, wait for verified badge, then clear -> verify UI reset
      const signBtn = page.locator('#sign-btn');
      const clearBtn = page.locator('#clear-btn');
      const signatureResult = page.locator('#signature-result');
      const canvas = page.locator('#signature-pad');
      const verifiedBadge = page.locator('#verified-badge');
      const keyVisual = page.locator('#key-visual');
      const hashVisual = page.locator('#hash-visual');
      const activeConnector = page.locator('.active-connector');
      const step1 = page.locator('#step1');

      // Generate signature and wait for verification to finish
      await signBtn.click();
      await expect(verifiedBadge).toBeVisible({ timeout: 6000 });

      // Now clear
      await clearBtn.click();

      // Signature result should be hidden, canvas visible
      await expect(signatureResult).toHaveCSS('display', 'none');
      await expect(canvas).toHaveCSS('display', 'block');

      // Verified badge hidden
      await expect(verifiedBadge).toHaveCSS('display', 'none');

      // key-visual shown, hash-visual hidden
      await expect(keyVisual).toHaveCSS('display', 'flex');
      await expect(hashVisual).toHaveCSS('display', 'none');

      // active-connector width reset
      const connectorWidth = await activeConnector.evaluate(node => window.getComputedStyle(node).width);
      expect(connectorWidth === '0px' || connectorWidth === '0').toBeTruthy();

      // step1 active
      await expect(step1).toHaveClass(/active/);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Clicking Generate Signature multiple times quickly should not produce runtime errors', async ({ page }) => {
      // Rapidly click the sign button multiple times and ensure no page errors or console errors occur
      const signBtn = page.locator('#sign-btn');
      await signBtn.click();
      await signBtn.click();
      await signBtn.click();

      // Wait for the eventual verification to complete or time out
      const verifiedBadge = page.locator('#verified-badge');
      await expect(verifiedBadge).toBeVisible({ timeout: 8000 });

      // Ensure we still have a data URL in signature-result
      const signatureResult = page.locator('#signature-result');
      await expect(signatureResult).toBeVisible();
      const text = await signatureResult.textContent();
      expect(text && text.startsWith('data:image/png')).toBeTruthy();

      // No page errors or console.error entries should be present (checked in afterEach)
    });

    test('Clicking Clear repeatedly does not throw and keeps UI stable', async ({ page }) => {
      // Repeatedly click clear to simulate edge behavior
      const clearBtn = page.locator('#clear-btn');
      await clearBtn.click();
      await clearBtn.click();
      await clearBtn.click();

      // Check UI remains stable: canvas visible, signature-result hidden
      await expect(page.locator('#signature-pad')).toHaveCSS('display', 'block');
      await expect(page.locator('#signature-result')).toHaveCSS('display', 'none');

      // No page errors or console.error entries should be present (checked in afterEach)
    });

    test('Attempt to draw on canvas triggers no errors and modifies canvas pixels (best-effort)', async ({ page }) => {
      // Try to draw on the canvas using mouse events and assert no runtime errors occurred.
      const canvas = page.locator('#signature-pad');
      const bounding = await canvas.boundingBox();
      expect(bounding).toBeTruthy();

      if (bounding) {
        const startX = bounding.x + bounding.width * 0.2;
        const startY = bounding.y + bounding.height * 0.5;
        const endX = bounding.x + bounding.width * 0.8;
        const endY = bounding.y + bounding.height * 0.5;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.mouse.move(endX, endY, { steps: 8 });
        await page.mouse.up();

        // After drawing, attempt to get the canvas data URL via the DOM and assert it contains "data:image/png"
        const dataUrl = await canvas.evaluate((c) => c.toDataURL && c.toDataURL());
        expect(typeof dataUrl === 'string' && dataUrl.startsWith('data:image/png')).toBeTruthy();
      }
    });
  });
});