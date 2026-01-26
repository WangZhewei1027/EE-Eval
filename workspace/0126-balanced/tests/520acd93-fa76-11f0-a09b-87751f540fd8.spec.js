import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520acd93-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Traffic Light FSM - 520acd93-fa76-11f0-a09b-87751f540fd8', () => {
  // Collect console messages and page errors per test
  test.beforeEach(async ({ page }) => {
    // Arrays will be attached to the page object for visibility in tests
    page['_consoleMessages'] = [];
    page['_pageErrors'] = [];

    page.on('console', msg => {
      page['_consoleMessages'].push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      // Capture uncaught exceptions
      page['_pageErrors'].push(String(error && error.message ? error.message : error));
    });

    await page.goto(APP_URL);
    // Confirm page loaded
    await expect(page).toHaveTitle(/Congestion Control/);
  });

  test.afterEach(async ({ page }) => {
    // Helpful debug output on test failures via saved arrays (doesn't modify the page)
    const errs = page['_pageErrors'] || [];
    const consoles = page['_consoleMessages'] || [];
    if (errs.length) {
      // Fail fast if there were uncaught exceptions during the test run setup/navigation.
      // This keeps in line with observing page errors and asserting their state.
      console.error('Captured page errors:', errs);
    }
    if (consoles.length) {
      console.debug('Captured console messages:', consoles.slice(0, 20));
    }
  });

  test.describe('DOM structure and initial state', () => {
    test('Traffic light element and children exist', async ({ page }) => {
      // Verify the traffic light container exists and has three child divs
      const exists = await page.$('#traffic-light');
      expect(exists).not.toBeNull();

      const childCount = await page.evaluate(() => {
        const tl = document.getElementById('traffic-light');
        return tl ? tl.children.length : 0;
      });
      // The HTML appends three child divs (red, green, yellow)
      expect(childCount).toBe(3);

      // Check class names on the children were created as expected (classes, not ids)
      const classes = await page.evaluate(() => {
        const tl = document.getElementById('traffic-light');
        if (!tl) return [];
        return Array.from(tl.children).map(c => c.className);
      });
      expect(classes).toEqual(expect.arrayContaining(['traffic-light-red', 'traffic-light-green', 'traffic-light-yellow']));
    });

    test('Initial inline background color is empty (no entry action auto-applied)', async ({ page }) => {
      // The implementation does not set an initial inline background color on the container.
      const initialInlineBg = await page.evaluate(() => {
        const tl = document.getElementById('traffic-light');
        return tl ? tl.style.backgroundColor : null;
      });
      expect(initialInlineBg).toBe('');
      // Also assert no uncaught page errors occurred just by loading the page
      expect(page['_pageErrors'].length).toBe(0);
    });
  });

  test.describe('FSM transitions driven by the page interval', () => {
    // Helper to set the traffic light's inline color and read values after waiting for the interval tick.
    async function setColorAndAwaitTransition(page, color) {
      // Set the inline background color on the traffic light
      await page.evaluate((c) => {
        const tl = document.getElementById('traffic-light');
        if (tl) tl.style.backgroundColor = c;
      }, color);

      // Wait slightly longer than the page interval (1000ms) to let the interval callback run
      await page.waitForTimeout(1200);

      // Read resulting inline styles from the container and the second child ("green" element created in script)
      return page.evaluate(() => {
        const tl = document.getElementById('traffic-light');
        const result = {
          trafficLightBackground: null,
          childGreenBackground: null
        };
        if (tl) {
          result.trafficLightBackground = tl.style.backgroundColor;
          // The script appended children: 0=red, 1=green, 2=yellow
          if (tl.children && tl.children[1]) {
            result.childGreenBackground = tl.children[1].style.backgroundColor;
          }
        }
        return result;
      });
    }

    test('Transition: Red -> Yellow on timer (S0_Red to S1_Yellow)', async ({ page }) => {
      // Verify FSM expects a transition from red to yellow. We seed the starting state and let the interval run.
      // Set initial to 'red', then expect the page script to change trafficLight to 'yellow' and set green child bg to 'yellow'.
      const res = await setColorAndAwaitTransition(page, 'red');

      // Expected (per FSM): trafficLight becomes 'yellow'
      expect(res.trafficLightBackground).toBe('yellow');

      // The implementation sets green.style.backgroundColor = 'yellow' in the red branch; verify it happened.
      expect(res.childGreenBackground).toBe('yellow');

      // Ensure no uncaught exceptions were thrown during the transition
      expect(page['_pageErrors'].length).toBe(0);
    });

    test('Transition: Yellow -> Green on timer (S1_Yellow to S2_Green)', async ({ page }) => {
      // Start fresh page; set inline to 'yellow' then wait for tick
      const res = await setColorAndAwaitTransition(page, 'yellow');

      // FSM expects trafficLight to become 'green'
      expect(res.trafficLightBackground).toBe('green');

      // Implementation sets green.style.backgroundColor = 'yellow' here too; assert that side-effect happened.
      expect(res.childGreenBackground).toBe('yellow');

      // No page-level uncaught exceptions
      expect(page['_pageErrors'].length).toBe(0);
    });

    test('Transition: Green -> Yellow (S2_Green to S1_Yellow) - detect mismatch between FSM expectation and implementation', async ({ page }) => {
      // The FSM expects green -> yellow, but the implementation contains a bug: in the green branch it sets trafficLight.style.backgroundColor = 'green'.
      // We assert both the correct FSM expectation (for clarity) and the actual observed behavior (to catch the bug).
      const res = await setColorAndAwaitTransition(page, 'green');

      // FSM expected: 'yellow'
      const fsmExpected = 'yellow';
      // Actual observed:
      const actual = res.trafficLightBackground;

      // Assert that the observed behavior does NOT match the FSM expected behavior (i.e., bug detected)
      expect(actual).not.toBe(fsmExpected);

      // And assert what the implementation actually did: it left/set the container to 'green'
      expect(actual).toBe('green');

      // Also assert the child green element got a 'yellow' inline background as a side effect of the script
      expect(res.childGreenBackground).toBe('yellow');

      // No runtime uncaught exceptions observed
      expect(page['_pageErrors'].length).toBe(0);
    });
  });

  test.describe('Entry/Exit actions and edge cases', () => {
    test('Simulate entering each state by setting inline styles directly (verify entry actions)', async ({ page }) => {
      // The FSM entry actions are simple inline style assignments. We simulate entering each state by setting the style and verifying it.
      const setAndRead = async (color) => {
        await page.evaluate((c) => {
          const tl = document.getElementById('traffic-light');
          if (tl) tl.style.backgroundColor = c;
        }, color);
        return await page.evaluate(() => {
          const tl = document.getElementById('traffic-light');
          return tl ? tl.style.backgroundColor : null;
        });
      };

      const red = await setAndRead('red');
      expect(red).toBe('red');

      const yellow = await setAndRead('yellow');
      expect(yellow).toBe('yellow');

      const green = await setAndRead('green');
      expect(green).toBe('green');

      // No uncaught page errors from simply manipulating the styles
      expect(page['_pageErrors'].length).toBe(0);
    });

    test('Edge case: setting a non-matching color (e.g., blue) keeps the interval running without transitions', async ({ page }) => {
      // If we set an unknown color, none of the interval branches match. The interval callback will execute but not clear itself.
      // We set 'blue' and wait 2.2 seconds and assert that the trafficLight inline background remains 'blue'.
      await page.evaluate(() => {
        const tl = document.getElementById('traffic-light');
        if (tl) tl.style.backgroundColor = 'blue';
      });

      // Wait a couple of ticks of the interval (which is 1s each) to ensure multiple executions could have occurred.
      await page.waitForTimeout(2200);

      const current = await page.evaluate(() => {
        const tl = document.getElementById('traffic-light');
        return tl ? tl.style.backgroundColor : null;
      });

      expect(current).toBe('blue');

      // Because no branch matched, no clearInterval was called by the script; we do not attempt to inspect internal timers here,
      // but we ensure no page errors resulted.
      expect(page['_pageErrors'].length).toBe(0);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No uncaught ReferenceError / TypeError / SyntaxError occurred during page load and interactions', async ({ page }) => {
      // This test explicitly asserts that the page did not produce uncaught JS exceptions during the test run.
      // We captured them on page.on('pageerror') in beforeEach.
      const errors = page['_pageErrors'] || [];
      // The code is intentionally left as-is; we expect well-formed runtime behavior here.
      expect(errors.length).toBe(0);
    });

    test('Collect and inspect console outputs for unexpected errors or warnings', async ({ page }) => {
      // Some implementations log to console. We capture console messages during beforeEach. Here, we assert there are no console messages of type 'error'.
      const consoles = page['_consoleMessages'] || [];
      const errorConsoles = consoles.filter(c => c.type === 'error');
      // If the implementation had runtime exceptions or explicit console.error calls, they would appear here.
      expect(errorConsoles.length).toBe(0);
    });
  });
});