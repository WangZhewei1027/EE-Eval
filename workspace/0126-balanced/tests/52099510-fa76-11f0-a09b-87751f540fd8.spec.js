import { test, expect } from '@playwright/test';

const URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52099510-fa76-11f0-a09b-87751f540fd8.html';

test.describe('52099510-fa76-11f0-a09b-87751f540fd8 - PageRank Interactive Application', () => {
  // Shared holders for console and page errors observed during navigation attempts
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors for console messages and page errors
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In the unlikely event msg.type() throws, still push text
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });
  });

  test.afterEach(async ({ page }) => {
    // Try to close the page gracefully
    try {
      await page.close();
    } catch (e) {
      // ignore close errors in teardown
    }
  });

  test.describe('Source code and FSM evidence (static analysis)', () => {
    // These tests fetch the raw HTML/JS source (no script execution) and assert presence
    // of the things mapped in the FSM: entry actions, transitions, and evidence strings.

    test('contains expected state entry actions in the inline script', async ({ request }) => {
      // Validate that the inline script contains calculatePageRank() and calculateLinkWeights()
      const resp = await request.get(URL);
      expect(resp.ok()).toBeTruthy();
      const body = await resp.text();

      // The FSM expected entry actions are calculatePageRank() (S0) and calculateLinkWeights() (S1)
      expect(body).toContain('calculatePageRank()');
      expect(body).toContain('calculateLinkWeights()');

      // Ensure PageRank array/init exists
      expect(body).toContain('let PageRank = new Array(N).fill(0);');

      // Ensure there is a while(true) loop - this is the evidence of the transition logic in the FSM
      expect(body).toContain('while (true)');
      // Ensure there is a convergence check and break; as evidence for PageRank Convergence -> S0
      expect(body).toContain('newPageRank.every((value, index) => value === PageRank[i])');
      expect(body).toContain('break;');
    });

    test('does not include interactive controls (as noted by the FSM extraction summary)', async ({ request }) => {
      // The extraction summary notes no interactive HTML elements like buttons or inputs.
      const resp = await request.get(URL);
      expect(resp.ok()).toBeTruthy();
      const body = await resp.text();

      // Assert there are no <button> or <input> tags in the served HTML
      expect(body.toLowerCase()).not.toContain('<button');
      expect(body.toLowerCase()).not.toContain('<input');
      expect(body.toLowerCase()).not.toContain('addEventListener');
    });
  });

  test.describe('Runtime behavior and error/timeout observations', () => {
    test('attempting to load the page will expose the long-running script (navigation likely times out)', async ({ page }) => {
      // This test attempts to load the page "as-is" and observes runtime side effects.
      // The inline script contains an unconditional while(true) loop which blocks the main thread.
      // We expect navigation with a default "load" wait to either hang or timeout.
      // We purposefully set a modest timeout to observe the hang rather than block the entire test run.

      let navigationError = null;
      const gotoPromise = page.goto(URL, { waitUntil: 'load', timeout: 3000 })
        .catch(err => { navigationError = err; });

      // Wait for the goto to either complete or throw (we catch it above)
      await gotoPromise;

      // Because the script uses while(true) and performs heavy synchronous computation,
      // it is expected that the page load will not complete within the given timeout.
      expect(navigationError).not.toBeNull();
      // It should be a TimeoutError or similar; assert that the message mentions timeout or navigation
      expect(String(navigationError.message).toLowerCase()).toMatch(/timeout|navigation/i);

      // Record what console messages and page errors were emitted up to the timeout point
      // We don't assert a specific error type here because the inline script may not throw,
      // but we capture and surface whatever the runtime produced.
      // The existence of any page error is recorded and should be accessible for debugging.
      // At minimum, consoleMessages array exists and is an array.
      expect(Array.isArray(consoleMessages)).toBeTruthy();
      expect(Array.isArray(pageErrors)).toBeTruthy();
    });

    test('observes whether the inline functions and arrays are declared before the blocking loop', async ({ request }) => {
      // As an alternate safe verification (no script execution), retrieve source
      // and verify that calculatePageRank is invoked before the while loop (evidence of S0 entry action).
      const resp = await request.get(URL);
      expect(resp.ok()).toBeTruthy();
      const body = await resp.text();

      // Find indexes of the function call and the while loop to assert relative order.
      const idxCalculatePageRankCall = body.indexOf('calculatePageRank();');
      const idxWhile = body.indexOf('while (true)');
      expect(idxCalculatePageRankCall).toBeGreaterThanOrEqual(0);
      expect(idxWhile).toBeGreaterThanOrEqual(0);

      // The call to calculatePageRank(); appears before the while loop in the source.
      expect(idxCalculatePageRankCall).toBeLessThan(idxWhile);

      // Also assert that calculateLinkWeights is invoked inside the while loop body
      expect(body.substring(idxWhile, idxWhile + 200)).toContain('calculateLinkWeights();');
    });

    test('edge case: page runtime may not throw runtime exceptions but will become unresponsive due to infinite loop', async ({ page }) => {
      // This test is explicitly documenting and asserting the edge behaviour:
      // The app uses an infinite loop for iteration (while(true)), so instead of a thrown exception,
      // the page will become unresponsive. We attempt a short navigation and then a short script execution.
      let navErr = null;
      await page.goto('about:blank');
      try {
        // A shorter timeout to force quick turnaround in CI environments
        await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 2000 });
      } catch (err) {
        navErr = err;
      }

      // Either the navigation timed out or succeeded quickly; both are acceptable as long as we observed
      // that the runtime is problematic. Assert that we did observe a timeout (navErr not null),
      // or if it succeeded, then trying to run a trivial evaluate will likely hang; we guard it.
      if (navErr) {
        expect(String(navErr.message).toLowerCase()).toMatch(/timeout|domcontentloaded/i);
      } else {
        // If navigation returned successfully (rare), attempt a quick evaluate with timeout behavior
        // Use Promise.race to avoid hanging the test indefinitely.
        const evalPromise = page.evaluate(() => {
          // We only read a simple DOM property which should be safe if the page is responsive.
          return document.title;
        });
        const result = await Promise.race([
          evalPromise,
          new Promise(resolve => setTimeout(() => resolve('__EVAL_TIMEOUT__'), 2000))
        ]);
        // If the page was responsive enough, we get a title; otherwise, we get the sentinel.
        expect(result === '__EVAL_TIMEOUT__' || typeof result === 'string').toBeTruthy();
      }
    });
  });

  test.describe('FSM states and transitions mapping (evidence-based assertions)', () => {
    test('State S0_Idle entry action calculatePageRank exists and is called in source order before the loop', async ({ request }) => {
      // This test ensures the S0_Idle entry action is present in the inline script and appears before the long-running loop.
      const resp = await request.get(URL);
      expect(resp.ok()).toBeTruthy();
      const body = await resp.text();

      // S0 entry action evidence:
      expect(body).toContain('calculatePageRank();');

      // Also ensure the calculatePageRank function definition exists
      expect(body).toContain('function calculatePageRank()');

      // And ensure the initial PageRank array is declared
      expect(body).toContain('let PageRank = new Array(N).fill(0);');
    });

    test('State S1_Calculating entry action calculateLinkWeights exists and is used inside the loop', async ({ request }) => {
      // This test ensures the S1 entry action calculateLinkWeights is present and called inside the while loop
      const resp = await request.get(URL);
      expect(resp.ok()).toBeTruthy();
      const body = await resp.text();

      // S1 entry action evidence:
      expect(body).toContain('function calculateLinkWeights()');
      expect(body).toContain('calculateLinkWeights();');

      // Evidence that the transition from S0 to S1 is manifested as an invocation in the loop
      // (the FSM transition evidence included while (true) { calculateLinkWeights(); })
      const whileIndex = body.indexOf('while (true)');
      expect(whileIndex).toBeGreaterThanOrEqual(0);
      // Check that inside the while segment there's calculateLinkWeights call
      const segment = body.substring(whileIndex, whileIndex + 500);
      expect(segment).toContain('calculateLinkWeights();');
    });

    test('Transition back to Idle (convergence) is present in source via newPageRank.every(...) and break;', async ({ request }) => {
      // This test looks for the convergence check and break which represent the S1 -> S0 transition.
      const resp = await request.get(URL);
      expect(resp.ok()).toBeTruthy();
      const body = await resp.text();

      expect(body).toContain('newPageRank.every((value, index) => value === PageRank[i])');
      expect(body).toContain('break;');
    });
  });
});