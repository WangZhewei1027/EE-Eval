import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520b1bb1-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Agile Methodology FSM - End-to-End', () => {
  // Helper to attach listeners and navigate; returns collected console messages and page errors
  async function openPageWithListeners(page) {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      // capture console messages (log, error, warn, etc.)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // capture uncaught exceptions from the page
      pageErrors.push(err);
    });

    // Navigate to the app; listeners are attached before navigation to capture initial scripts
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Allow microtasks/console logs from initial synchronous script to settle
    await page.waitForTimeout(100);

    return { consoleMessages, pageErrors };
  }

  test('Idle state: page renders container and static content (S0_Idle evidence)', async ({ page }) => {
    // This test validates the Idle state evidence: DOM contains <body> and <div class="container">
    // and that the static header/overview content is present.
    const { consoleMessages, pageErrors } = await openPageWithListeners(page);

    // DOM assertions for Idle state evidence
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('.container')).toBeVisible();
    await expect(page.locator('h1', { hasText: 'Agile Methodology' })).toHaveCount(1);
    await expect(page.locator('h2', { hasText: 'Overview' })).toHaveCount(1);
    await expect(page.locator('.section')).toHaveCount(2); // two main sections present

    // There should be no uncaught page errors from rendering the static HTML
    expect(pageErrors.length).toBe(0);

    // The implementation runs meeting(team) and sprint(team) on load.
    // Verify that their high-level console logs are present among captured messages.
    const texts = consoleMessages.map(m => m.text);
    expect(texts.some(t => t.includes('Meeting started!'))).toBeTruthy();
    expect(texts.some(t => t.includes('Meeting ended!'))).toBeTruthy();
    expect(texts.some(t => t.includes('Sprint started!'))).toBeTruthy();
    expect(texts.some(t => t.includes('Sprint ended!'))).toBeTruthy();
  });

  test('Meeting state (S1_Meeting): functions exist and logs show meeting topics and suggestions', async ({ page }) => {
    // This test verifies meeting() exists, can be invoked, and produces expected console output
    const { consoleMessages, pageErrors } = await openPageWithListeners(page);

    // Ensure meeting function exists on the page
    const hasMeeting = await page.evaluate(() => typeof meeting === 'function');
    expect(hasMeeting).toBe(true);

    // Clear previously captured messages for isolation, then attach a temporary array for new messages
    const newMessages = [];
    page.on('console', msg => newMessages.push({ type: msg.type(), text: msg.text() }));

    // Invoke meeting with the in-page team object; this should produce deterministic "Topic:" logs
    await page.evaluate(() => {
      // call existing meeting function with existing team object
      // any thrown error would surface as a page error and be captured by 'pageerror'
      try {
        meeting(team);
      } catch (e) {
        // swallow in-page exception so test can inspect captured pageerror events
      }
    });

    // Give time for console logs to be emitted
    await page.waitForTimeout(100);

    const texts = newMessages.map(m => m.text);

    // Verify expected meeting lifecycle logs and topic logs
    expect(texts.some(t => t.includes('Meeting started!'))).toBeTruthy();
    expect(texts.some(t => t.includes('Topic: Prioritize features'))).toBeTruthy();
    expect(texts.some(t => t.includes('Topic: Define scope'))).toBeTruthy();
    expect(texts.some(t => t.includes('Suggestion from'))).toBeTruthy();
    expect(texts.some(t => t.includes('Meeting ended!'))).toBeTruthy();

    // Ensure no unexpected uncaught page errors occurred as part of this invocation
    expect(pageErrors.length).toBe(0);
  });

  test('Sprint state (S2_Sprint): functions exist and logs show sprint topics and member work', async ({ page }) => {
    // This test verifies sprint() exists and produces expected logs when invoked
    const { consoleMessages, pageErrors } = await openPageWithListeners(page);

    // Ensure sprint function exists on the page
    const hasSprint = await page.evaluate(() => typeof sprint === 'function');
    expect(hasSprint).toBe(true);

    // Capture fresh console messages for this invocation
    const sprintMessages = [];
    page.on('console', msg => sprintMessages.push({ type: msg.type(), text: msg.text() }));

    // Invoke sprint with the in-page team object
    await page.evaluate(() => {
      try {
        sprint(team);
      } catch (e) {
        // swallow; pageerror will capture uncaught exceptions
      }
    });

    await page.waitForTimeout(100);

    const texts = sprintMessages.map(m => m.text);

    // Validate sprint lifecycle logs and the member work logs and topics
    expect(texts.some(t => t.includes('Sprint started!'))).toBeTruthy();
    expect(texts.some(t => t.includes('Member'))).toBeTruthy();
    expect(texts.some(t => t.includes('is working on feature X'))).toBeTruthy();
    expect(texts.some(t => t.includes('Topic: Feature X'))).toBeTruthy();
    expect(texts.some(t => t.includes('Topic: Feature Y'))).toBeTruthy();
    expect(texts.some(t => t.includes('Sprint ended!'))).toBeTruthy();

    // Confirm no uncaught page errors occurred during normal sprint invocation
    expect(pageErrors.length).toBe(0);
  });

  test('FSM transitions via function calls: explicitly invoking meeting(team) and sprint(team) triggers observable logs', async ({ page }) => {
    // This validates the transitions in the FSM by explicitly calling the event functions and asserting expected observables
    const { consoleMessages, pageErrors } = await openPageWithListeners(page);

    // Collect new console outputs separately to assert only those produced by our explicit calls
    const transitionMessages = [];
    page.on('console', msg => transitionMessages.push({ type: msg.type(), text: msg.text() }));

    // Explicitly trigger MeetingStart transition
    await page.evaluate(() => {
      try {
        meeting(team);
      } catch (e) {
        // swallow: pageerror will record any exception
      }
    });

    // Explicitly trigger SprintStart transition
    await page.evaluate(() => {
      try {
        sprint(team);
      } catch (e) {
        // swallow
      }
    });

    await page.waitForTimeout(150);

    const texts = transitionMessages.map(m => m.text);

    // Expected observables from FSM transitions
    expect(texts.some(t => t.includes('Meeting started!'))).toBeTruthy();
    expect(texts.some(t => t.includes('Meeting ended!'))).toBeTruthy();
    expect(texts.some(t => t.includes('Sprint started!'))).toBeTruthy();
    expect(texts.some(t => t.includes('Sprint ended!'))).toBeTruthy();

    // Ensure no uncaught errors occurred during these explicit transitions
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: invoking meeting(undefined) should produce a runtime TypeError and be captured as a page error', async ({ page }) => {
    // This test intentionally calls meeting with an invalid argument to validate error handling and that errors surface naturally
    const { consoleMessages, pageErrors } = await openPageWithListeners(page);

    // Attempt to call meeting(undefined) — this is expected to throw inside the page and produce a pageerror
    let evaluateError = null;
    try {
      await page.evaluate(() => {
        // This call is expected to throw (team is undefined), causing a runtime TypeError inside the page
        meeting(undefined);
      });
    } catch (e) {
      // page.evaluate will reject if the in-page function throws; capture it but do not modify page behavior
      evaluateError = e;
    }

    // Allow any pageerror events to be propagated to listeners
    await page.waitForTimeout(100);

    // At least one mechanism should indicate an error:
    // - pageErrors array should have entries (uncaught exception)
    // - or the evaluation itself rejected (evaluateError is not null)
    expect(evaluateError !== null || pageErrors.length > 0).toBeTruthy();

    // If a pageError was recorded, check that it resembles a TypeError about reading members
    if (pageErrors.length > 0) {
      const errMsg = pageErrors[0].message || String(pageErrors[0]);
      // We assert the error message references 'members' or indicates a TypeError to be robust across engines
      expect(
        /members|Cannot read properties|TypeError/i.test(errMsg)
      ).toBeTruthy();
    } else {
      // If no pageErrors but the evaluate rejected, ensure the evaluateError message indicates a TypeError-like issue
      const msg = evaluateError ? String(evaluateError.message || evaluateError) : '';
      expect(/members|Cannot read properties|TypeError/i.test(msg)).toBeTruthy();
    }
  });

  test('Edge case: invoking sprint(null) should produce a runtime error (TypeError) and be observable', async ({ page }) => {
    // This test invokes sprint with a null argument to produce an error and asserts it appears in page errors/console
    const { consoleMessages, pageErrors } = await openPageWithListeners(page);

    let evaluateError = null;
    try {
      await page.evaluate(() => {
        // This call is expected to throw because sprint expects an object with .members
        sprint(null);
      });
    } catch (e) {
      evaluateError = e;
    }

    // Allow events to settle
    await page.waitForTimeout(100);

    expect(evaluateError !== null || pageErrors.length > 0).toBeTruthy();

    if (pageErrors.length > 0) {
      const errMsg = pageErrors[0].message || String(pageErrors[0]);
      expect(/members|Cannot read properties|TypeError/i.test(errMsg)).toBeTruthy();
    } else {
      const msg = evaluateError ? String(evaluateError.message || evaluateError) : '';
      expect(/members|Cannot read properties|TypeError/i.test(msg)).toBeTruthy();
    }
  });

  test('Robustness: multiple repeated calls to meeting and sprint produce multiple lifecycle logs (no internal state blocking re-entry)', async ({ page }) => {
    // This test ensures repeated invocations generate logs each time (idempotent logging behavior)
    const { consoleMessages, pageErrors } = await openPageWithListeners(page);

    const repeatedMessages = [];
    page.on('console', msg => repeatedMessages.push({ type: msg.type(), text: msg.text() }));

    // Call meeting and sprint multiple times in sequence
    await page.evaluate(() => {
      try { meeting(team); } catch (e) {}
      try { meeting(team); } catch (e) {}
      try { sprint(team); } catch (e) {}
      try { sprint(team); } catch (e) {}
    });

    await page.waitForTimeout(200);

    const texts = repeatedMessages.map(m => m.text);

    // Expect at least two occurrences of meeting lifecycle markers and sprint lifecycle markers
    const meetingStartCount = texts.filter(t => t.includes('Meeting started!')).length;
    const meetingEndCount = texts.filter(t => t.includes('Meeting ended!')).length;
    const sprintStartCount = texts.filter(t => t.includes('Sprint started!')).length;
    const sprintEndCount = texts.filter(t => t.includes('Sprint ended!')).length;

    expect(meetingStartCount).toBeGreaterThanOrEqual(2);
    expect(meetingEndCount).toBeGreaterThanOrEqual(2);
    expect(sprintStartCount).toBeGreaterThanOrEqual(2);
    expect(sprintEndCount).toBeGreaterThanOrEqual(2);

    // No uncaught errors expected from repeated valid invocations
    expect(pageErrors.length).toBe(0);
  });
});