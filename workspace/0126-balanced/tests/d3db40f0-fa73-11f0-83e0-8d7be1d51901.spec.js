import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3db40f0-fa73-11f0-83e0-8d7be1d51901.html';

/**
 * Page Object encapsulating selectors and common interactions for the demo page.
 */
class RuntimeDemoPage {
  constructor(page) {
    this.page = page;
    this.btnDetect = page.locator('#btn-detect');
    this.btnClear = page.locator('#btn-clear');
    this.detectOut = page.locator('#detectOut');

    this.btnRun = page.locator('#btn-run');
    this.btnStep = page.locator('#btn-step');
    this.btnReset = page.locator('#btn-reset');
    this.stack = page.locator('#stack');
    this.micro = page.locator('#micro');
    this.macro = page.locator('#macro');
    this.elog = page.locator('#elog');

    this.btnWorker = page.locator('#btn-worker');
    this.btnWorkerStop = page.locator('#btn-worker-stop');
    this.workerOut = page.locator('#workerOut');

    this.runnerCode = page.locator('#runnerCode');
    this.btnRunSandbox = page.locator('#btn-run-sandbox');
    this.btnRemoveSandbox = page.locator('#btn-remove-sandbox');
    this.sandboxOut = page.locator('#sandboxOut');
  }

  // Wait until the auto-detect (which runs on load) has populated detectOut with expected content.
  async waitForInitialDetect() {
    // The page auto-clicks the detect button during script; wait for the output to contain "globalThis type"
    await expect(this.detectOut).toContainText('globalThis type', { timeout: 3000 });
  }

  async clearDetect() {
    await this.btnClear.click();
  }

  async runDemo() {
    await this.btnRun.click();
  }

  async stepDemo() {
    await this.btnStep.click();
  }

  async resetDemo() {
    await this.btnReset.click();
  }

  async startWorker() {
    await this.btnWorker.click();
  }

  async stopWorker() {
    await this.btnWorkerStop.click();
  }

  async runSandbox() {
    await this.btnRunSandbox.click();
  }

  async removeSandbox() {
    await this.btnRemoveSandbox.click();
  }

  async setRunnerCode(code) {
    await this.runnerCode.fill(code);
  }
}

test.describe('Runtime Environment — Interactive Demo (FSM validation)', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture console messages and page errors for tests that assert them.
    page.on('console', (message) => {
      consoleMessages.push({ type: message.type(), text: message.text() });
    });
    page.on('pageerror', (err) => {
      // Push a stringified representation so assertions can check for substring matches.
      pageErrors.push(String(err));
    });

    // Navigate to the app. The page auto-invokes detect on load (S0_Idle entry action).
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('Initial detection runs on load (S0_Idle -> S1_RuntimeDetected) - auto detect executed', async ({ page }) => {
    const app = new RuntimeDemoPage(page);

    // The HTML auto-clicks the Detect button on load. Confirm detectOut is populated (evidence)
    await app.waitForInitialDetect();
    const text = await app.detectOut.textContent();
    expect(text).toBeTruthy();
    expect(text).toContain('globalThis type');
    // We expect browser-like values for these keys in the default Playwright browser environment
    expect(text).toContain('window exists: true');
    expect(text).toContain('document exists: true');
  });

  test('Clear detection results (S1_RuntimeDetected -> S0_Idle) - Clear button resets output', async ({ page }) => {
    const app = new RuntimeDemoPage(page);

    // Ensure initial detection completed
    await app.waitForInitialDetect();

    // Click clear and verify detectOut returns to placeholder text
    await app.clearDetect();
    await expect(app.detectOut).toHaveText('(results appear here)');
  });

  test('Run demo starts visualization and sets state.running (S1_RuntimeDetected -> S2_DemoRunning)', async ({ page }) => {
    const app = new RuntimeDemoPage(page);

    // Ensure initial detection completed
    await app.waitForInitialDetect();

    // Start the demo; this sets state.running = true and animates steps
    await app.runDemo();

    // The page manages its own state object; verify state.running becomes true quickly
    await expect.poll(async () => {
      return await page.evaluate(() => (typeof state !== 'undefined' ? state.running : false));
    }, { timeout: 3000 }).toBeTruthy();

    // The demo logs to the on-page log (elog). Wait for demo completion marker.
    // The non-step mode plays automatically; final marker is "-- demo complete --"
    await expect(app.elog).toContainText('-- demo complete --', { timeout: 5000 });

    // During the run the elog should contain scheduled microtask and macrotask messages
    const elogText = await app.elog.textContent();
    expect(elogText).toContain('scheduled microtask');
    expect(elogText).toContain('scheduled macrotask');
  });

  test('Step through demo (S2_DemoRunning step behaviour) and Reset (S2 -> S0)', async ({ page }) => {
    const app = new RuntimeDemoPage(page);

    // Start from a cleared visualization
    await app.resetDemo();

    // Click step to initialize in step mode and create the steps array
    await app.stepDemo();

    // Now the app should be in step mode and state.steps should exist
    const initialSteps = await page.evaluate(() => state && state.steps ? state.steps.length : 0);
    expect(initialSteps).toBeGreaterThan(0);

    // Step through each step manually until empty; each click shifts one step and runs its fn()
    let stepsLeft = initialSteps;
    while (stepsLeft > 0) {
      await app.stepDemo();
      // small wait for visual updates caused by step function
      await page.waitForTimeout(200);
      stepsLeft = await page.evaluate(() => (state && state.steps ? state.steps.length : 0));
    }

    // After draining steps, clicking step should append '(no more steps)' to elog
    await app.stepDemo();
    await expect(app.elog).toContainText('(no more steps)');

    // Reset should clear visuals and set running false
    await app.resetDemo();
    const runningAfterReset = await page.evaluate(() => (state ? state.running : false));
    expect(runningAfterReset).toBeFalsy();

    await expect(app.stack).toHaveText('', { timeout: 1000 });
    await expect(app.micro).toHaveText('', { timeout: 1000 });
    await expect(app.macro).toHaveText('', { timeout: 1000 });
  });

  test('Web Worker lifecycle (S0_Idle -> S4_WorkerRunning -> S0_Idle)', async ({ page }) => {
    const app = new RuntimeDemoPage(page);

    // Verify initial workerOut status
    await expect(app.workerOut).toContainText('Worker not started.');

    // Start worker and wait for workerOut to change from the initial state
    await app.startWorker();

    // The worker posts a 'ready' message then responds to 'ping' and 'who'.
    // Wait for the workerOut to report something other than the initial string
    await expect.poll(async () => {
      return await app.workerOut.textContent();
    }, { timeout: 3000 }).not.toBe('Worker not started.');

    const workerText = await app.workerOut.textContent();
    // It should indicate readiness or show a pong/info response
    expect(workerText).toMatch(/Worker ready\.|pong from worker|worker_global_keys:/);

    // Stop the worker and verify it reports stopped state
    await app.stopWorker();
    await expect(app.workerOut).toHaveText('Worker stopped.', { timeout: 2000 });

    // Edge case: click stop again to ensure it gracefully handles "no worker" case
    await app.stopWorker();
    // It should report "Worker not running." when attempting to stop again
    await expect(app.workerOut).toMatchText(/Worker not running\.|Worker stopped\./);
  });

  test('Sandboxed iframe runner (S0_Idle -> S3_SandboxRunning -> S0_Idle) and code forwarding', async ({ page }) => {
    const app = new RuntimeDemoPage(page);

    // Provide code that posts a message and uses console.log inside the iframe
    const code = `
      postMessage({type:'log', text: 'Hello from sandbox'});
      console.log('console inside iframe');
      // return a value from the async function to test result message
      'result-value';
    `;
    await app.setRunnerCode(code);

    // Run sandbox and wait for sandboxOut to get ready & messages
    await app.runSandbox();

    // The sandbox code posts back a 'ready' then console/result messages. Wait for "Sandbox ready" as an indicator.
    await expect.poll(async () => {
      return await app.sandboxOut.textContent();
    }, { timeout: 4000 }).toContain('Sandbox ready');

    // The sandbox posts console and result messages that are appended to sandboxOut.
    await expect(app.sandboxOut).toContainText('[console] console inside iframe', { timeout: 4000 });
    await expect(app.sandboxOut).toContainText('[result] result-value', { timeout: 4000 });

    // Now remove sandbox and confirm the sandboxOut and DOM state reflect removal
    await app.removeSandbox();
    await expect(app.sandboxOut).toHaveText('Sandbox removed.', { timeout: 2000 });
  });

  test('Sandbox handles thrown errors and reports them back (assert error evidence)', async ({ page }) => {
    const app = new RuntimeDemoPage(page);

    // Provide code that throws a ReferenceError inside the sandbox
    const codeThrowRef = `throw new ReferenceError('test-ref');`;
    await app.setRunnerCode(codeThrowRef);

    await app.runSandbox();

    // Wait for sandboxOut to contain an error report with ReferenceError
    await expect.poll(async () => {
      return await app.sandboxOut.textContent();
    }, { timeout: 4000 }).toContain('[error]');

    const sandboxText = await app.sandboxOut.textContent();
    expect(sandboxText).toContain('ReferenceError');

    // Clean up
    await app.removeSandbox();
    await expect(app.sandboxOut).toHaveText('Sandbox removed.', { timeout: 2000 });
  });

  test('Natural page errors are observed: ReferenceError, TypeError, SyntaxError (pageerror events emitted)', async ({ page }) => {
    // This test intentionally triggers runtime errors inside the page environment
    // and asserts that pageerror events are emitted for each error type.

    // Trigger a ReferenceError asynchronously so it is reported as a page error event
    const refPromise = page.waitForEvent('pageerror');
    await page.evaluate(() => {
      setTimeout(() => {
        // attempts to access property of an undefined variable -> ReferenceError
        // nonExistingVar is not defined; referencing it should cause a ReferenceError
        // (Accessing an undeclared identifier triggers ReferenceError)
        try {
          // purposely cause reference by evaluating an undeclared identifier in a function
          // Use indirect eval style to ensure it's executed in page context and thrown asynchronously.
          nonDeclaredIdentifier;
        } catch (e) {
          // rethrow to ensure the error surfaces as a pageerror
          throw e;
        }
      }, 0);
    });
    const refErr = await refPromise;
    expect(String(refErr)).toContain('ReferenceError');

    // Trigger a TypeError asynchronously by accessing property on null
    const typePromise = page.waitForEvent('pageerror');
    await page.evaluate(() => {
      setTimeout(() => {
        try {
          null.f(); // TypeError: cannot read property 'f' of null
        } catch (e) {
          throw e;
        }
      }, 0);
    });
    const typeErr = await typePromise;
    expect(String(typeErr)).toContain('TypeError');

    // Trigger a SyntaxError asynchronously by performing an invalid eval inside setTimeout
    const syntaxPromise = page.waitForEvent('pageerror');
    await page.evaluate(() => {
      setTimeout(() => {
        try {
          // Invalid code to parse -> SyntaxError
          eval('function () {'); // malformed function syntax
        } catch (e) {
          throw e;
        }
      }, 0);
    });
    const syntaxErr = await syntaxPromise;
    expect(String(syntaxErr)).toContain('SyntaxError');
  });

  test.afterEach(async ({ page }) => {
    // As a final sanity check, ensure that pageErrors array exists and contains
    // any errors we intentionally caused. Tests above await and validate the specific events,
    // so here we just log for debugging in case Playwright collects additional reporting.
    // We do not assert absence of console messages/errors globally because some tests intentionally trigger them.
    // But ensure the page object is still alive and reachable.
    await expect(page).toHaveURL(/d3db40f0-fa73-11f0-83e0-8d7be1d51901\.html/);
  });
});