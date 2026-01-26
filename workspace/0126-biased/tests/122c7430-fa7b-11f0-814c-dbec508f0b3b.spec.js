import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122c7430-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Two Pointers application
class TwoPointersPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#start-button');
    this.resetButton = page.locator('#reset-button');
    this.saveButton = page.locator('#save-button');
    this.loadButton = page.locator('#load-button');
    this.nextButton = page.locator('#next-button');
    this.previousButton = page.locator('#previous-button');
    this.point1 = page.locator('#point1');
    this.point2 = page.locator('#point2');
    this.addPointButton = page.locator('#add-point-button');
    this.pointsInput = page.locator('#points');
    this.resetPointsButton = page.locator('#reset-points-button');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickStart() {
    await this.startButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async clickSave() {
    await this.saveButton.click();
  }

  async clickLoad() {
    await this.loadButton.click();
  }

  async clickNext() {
    await this.nextButton.click();
  }

  async clickPrevious() {
    await this.previousButton.click();
  }

  async clickAddPoint() {
    await this.addPointButton.click();
  }

  async clickResetPoints() {
    await this.resetPointsButton.click();
  }

  async setPointsInput(value) {
    await this.pointsInput.fill(value);
  }

  async getPoint1Value() {
    return (await this.point1.inputValue()).toString();
  }

  async getPoint2Value() {
    return (await this.point2.inputValue()).toString();
  }

  async getPointsValue() {
    return (await this.pointsInput.inputValue()).toString();
  }

  async isNextDisabled() {
    return await this.nextButton.isDisabled();
  }

  async isPreviousDisabled() {
    return await this.previousButton.isDisabled();
  }

  async isAddPointDisabled() {
    return await this.addPointButton.isDisabled();
  }

  async isResetPointsDisabled() {
    return await this.resetPointsButton.isDisabled();
  }
}

test.describe.serial('Two Pointers - FSM and UI integration tests', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Capture console.error messages and page uncaught errors for assertions later.
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
  });

  test.afterEach(async () => {
    // Assert that the app did not throw unexpected runtime errors during test.
    // If there are any errors, include them in the assertion message to aid debugging.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.join(' | ')}`).toBe(0);
  });

  test('Initial state (S0_Idle): UI renders and inputs have initial values', async ({ page }) => {
    // Validate initial DOM and inputs match the actual implementation (Idle state)
    const app = new TwoPointersPage(page);
    await app.goto();

    // Ensure essential controls are present and visible
    await expect(app.startButton).toBeVisible();
    await expect(app.resetButton).toBeVisible();
    await expect(app.addPointButton).toBeVisible();

    // Validate input initial values as per HTML (value="0")
    expect(await app.getPoint1Value()).toBe('0');
    expect(await app.getPoint2Value()).toBe('0');
    expect(await app.getPointsValue()).toBe('0');

    // Implementation does not disable next/previous/add by default, assert actual behavior
    expect(await app.isNextDisabled()).toBe(false);
    expect(await app.isPreviousDisabled()).toBe(false);
    expect(await app.isAddPointDisabled()).toBe(false);
  });

  test('StartClick -> Started (S1_Started): clicking Start clears point inputs and enables controls', async ({ page }) => {
    // Validate the Start transition: reads point1, then clears point1/point2 and ensures navigation/add are enabled
    const app = new TwoPointersPage(page);
    await app.goto();

    // Precondition: set point1 to a non-zero value to ensure parseInt flow
    await app.point1.fill('5');
    await app.point2.fill('7');

    // Click Start - according to implementation it will parse point1 then clear inputs and enable controls
    await app.clickStart();

    // After start, point inputs should be cleared (set to empty string)
    expect(await app.getPoint1Value()).toBe(''); // code sets ''
    expect(await app.getPoint2Value()).toBe(''); // code sets ''

    // Buttons should be enabled (code sets disabled = false)
    expect(await app.isNextDisabled()).toBe(false);
    expect(await app.isPreviousDisabled()).toBe(false);
    expect(await app.isAddPointDisabled()).toBe(false);
  });

  test('AddPointClick -> Added Point (S2_AddedPoint): add increments points and updates inputs', async ({ page }) => {
    // Validate add-point increments the internal points and updates point1/point2 displayed values
    const app = new TwoPointersPage(page);
    await app.goto();

    // Ensure a deterministic start: click start to set 'points' to current point1 value (0) then clear inputs
    await app.clickStart();

    // Add a point: points was 0 -> should become 1 and reflect in both inputs
    await app.clickAddPoint();
    expect(await app.getPoint1Value()).toBe('1');
    expect(await app.getPoint2Value()).toBe('1');

    // Add another point: points -> 2
    await app.clickAddPoint();
    expect(await app.getPoint1Value()).toBe('2');
    expect(await app.getPoint2Value()).toBe('2');
  });

  test('SaveClick persists pointsArray and disables reset-points-button', async ({ page }) => {
    // Validate Save pushes current points to pointsArray and populates #points input and disables reset-points-button
    const app = new TwoPointersPage(page);
    await app.goto();

    // Start and add two points to have some values to save
    await app.clickStart();
    await app.clickAddPoint(); // points = 1
    await app.clickSave();     // pointsArray = [1]
    expect(await app.getPointsValue()).toBe('1');
    expect(await app.isResetPointsDisabled()).toBe(true);

    // Add another point and save again
    await app.clickAddPoint(); // points = 2
    await app.clickSave();     // pointsArray = [1,2]
    // The 'points' input should now show comma-separated values
    expect(await app.getPointsValue()).toBe('1,2');
    expect(await app.isResetPointsDisabled()).toBe(true);
  });

  test('LoadClick loads saved points and sets navigation/add enabled', async ({ page }) => {
    // Validate Load reads #points, populates pointsArray and sets inputs to the loaded values
    const app = new TwoPointersPage(page);
    await app.goto();

    // Simulate having saved data by directly setting the #points input to "3,4"
    await app.setPointsInput('3,4');
    // Click Load to parse and populate point1/point2
    await app.clickLoad();

    // point1 should be 3 and point2 should be 4 (as strings)
    // Note: the implementation sets document.getElementById('point1').value = pointsArray[0];
    expect(await app.getPoint1Value()).toBe('3');
    expect(await app.getPoint2Value()).toBe('4');

    // Buttons should be enabled after load
    expect(await app.isNextDisabled()).toBe(false);
    expect(await app.isPreviousDisabled()).toBe(false);
    expect(await app.isAddPointDisabled()).toBe(false);
  });

  test('NextClick and PreviousClick navigation behavior and edge cases', async ({ page }) => {
    // Validate navigation across saved points and the disabling behavior when bounds are reached
    const app = new TwoPointersPage(page);
    await app.goto();

    // Create pointsArray via the UI: start -> add(1) -> save -> add(2) -> save => points input "1,2"
    await app.clickStart();
    await app.clickAddPoint(); // points = 1
    await app.clickSave();     // pointsArray = [1]
    await app.clickAddPoint(); // points = 2
    await app.clickSave();     // pointsArray = [1,2]

    // Load the saved points to reset currentPoint = 0
    await app.clickLoad();

    // At load, currentPoint = 0. Click Next twice to reach end and observe that next becomes disabled after passing last index.
    await app.clickNext(); // should move to index 1 (no disable yet)
    // After first click, next should still be enabled unless we then click it again to disable.
    expect(await app.isNextDisabled()).toBe(false);

    // Click next again; since now at last index, the handler will disable the next button
    await app.clickNext();
    expect(await app.isNextDisabled()).toBe(true);

    // Previous: clicking previous when at last index should move back to earlier index and not disable immediately
    expect(await app.isPreviousDisabled()).toBe(false);
    await app.clickPrevious(); // moves back one
    // If at index 0 and clicking previous again, it should disable the previous button
    await app.clickPrevious();
    expect(await app.isPreviousDisabled()).toBe(true);
  });

  test('ResetClick -> Reset (S3_Reset): reset sets points to 0, updates inputs, disables nav/add', async ({ page }) => {
    // Validate clicking Reset resets the UI state and disables relevant controls
    const app = new TwoPointersPage(page);
    await app.goto();

    // Put the app into a non-default state first
    await app.clickStart();
    await app.clickAddPoint(); // points = 1
    await app.clickSave();

    // Now click Reset
    await app.clickReset();

    // Inputs should show '0' as per the implementation
    expect(await app.getPoint1Value()).toBe('0');
    expect(await app.getPoint2Value()).toBe('0');

    // After reset the implementation disables navigation and add
    expect(await app.isNextDisabled()).toBe(true);
    expect(await app.isPreviousDisabled()).toBe(true);
    expect(await app.isAddPointDisabled()).toBe(true);
  });

  test('ResetPointsClick transitions to Idle-like state and acts like resetting points (S3_Reset -> S0_Idle)', async ({ page }) => {
    // Validate Reset Points button resets points, inputs and disables controls (similar to Reset)
    const app = new TwoPointersPage(page);
    await app.goto();

    // Modify points input and set some state
    await app.clickStart();
    await app.clickAddPoint(); // points = 1
    await app.setPointsInput('9');
    // Click Reset Points
    await app.clickResetPoints();

    // After clicking reset points, UI should reflect cleared numeric fields and disabled nav/add
    expect(await app.getPoint1Value()).toBe('0');
    expect(await app.getPoint2Value()).toBe('0');
    expect(await app.isNextDisabled()).toBe(true);
    expect(await app.isPreviousDisabled()).toBe(true);
    expect(await app.isAddPointDisabled()).toBe(true);
  });

  test('Edge case: Load with invalid values results in NaN values in inputs (graceful parsing behavior)', async ({ page }) => {
    // Validate behavior when #points contains non-numeric values (e.g., "a,b")
    const app = new TwoPointersPage(page);
    await app.goto();

    // Intentionally set invalid comma-separated values
    await app.setPointsInput('a,b');
    await app.clickLoad();

    // The implementation maps Number over the values -> [NaN, NaN], then assigns to inputs.
    // Input values become the string "NaN" when NaN is assigned to an input element.
    expect(await app.getPoint1Value()).toBe('NaN');
    expect(await app.getPoint2Value()).toBe('NaN');

    // Despite invalid values, the implementation enables navigation and add buttons
    expect(await app.isNextDisabled()).toBe(false);
    expect(await app.isPreviousDisabled()).toBe(false);
    expect(await app.isAddPointDisabled()).toBe(false);
  });

  test('Edge case: Save when no points added results in saved 0 value', async ({ page }) => {
    // Validate saving immediately after load/start without adding pushes the current points (likely 0)
    const app = new TwoPointersPage(page);
    await app.goto();

    // Ensure point1 is '0' initially and then click Save
    expect(await app.getPoint1Value()).toBe('0');
    await app.clickSave();

    // The saved representation should include the zero value
    const pointsValue = await app.getPointsValue();
    // The implementation pushes points (initially 0) -> pointsArray becomes ["0"] and points input becomes "0"
    expect(pointsValue).toContain('0');
    expect(await app.isResetPointsDisabled()).toBe(true);
  });
});