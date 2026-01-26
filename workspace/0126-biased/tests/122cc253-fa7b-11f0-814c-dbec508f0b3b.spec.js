import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122cc253-fa7b-11f0-814c-dbec508f0b3b.html';

class CpuSchedulingPage {
  /**
   * Page object model for the CPU Scheduling application
   * Encapsulates selectors and common interactions.
   */
  constructor(page) {
    this.page = page;
    this.allocateButton = page.locator('#cpu-scheduling-allocate-button');
    this.deallocateButton = page.locator('#cpu-scheduling-deallocate-button');
    this.switchButton = page.locator('#cpu-scheduling-switch-button');
    this.priorityInput = page.locator('#cpu-scheduling-priority-input');
    this.taskTypeSelect = page.locator('#cpu-scheduling-task-type-select');
    this.outputContainer = page.locator('#cpu-scheduling-output-container');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickAllocate() {
    await this.allocateButton.click();
  }

  async clickDeallocate() {
    await this.deallocateButton.click();
  }

  async clickSwitch() {
    await this.switchButton.click();
  }

  async setPriority(value) {
    // fill triggers input event handlers in the page
    await this.priorityInput.fill(String(value));
  }

  async clearPriority() {
    await this.priorityInput.fill('');
  }

  async changeTaskType(value) {
    // selectOption triggers change event handlers
    await this.taskTypeSelect.selectOption({ value });
  }

  async getOutputText() {
    return (await this.outputContainer.textContent())?.trim() ?? '';
  }

  async getSelectInnerHTML() {
    return await this.taskTypeSelect.evaluate((el) => el.innerHTML);
  }

  async getSelectValue() {
    // return the select's value property
    return await this.taskTypeSelect.evaluate((el) => el.value);
  }
}

test.describe('CPU Scheduling Interactive Application (FSM validation)', () => {
  let pageErrors;
  let consoleErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Prepare collectors for console and page errors for each test
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Collect any uncaught exceptions on the page
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // Collect console messages and mark errors separately
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Navigate to the application fresh for each test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Basic assertion that no unexpected uncaught exceptions occurred during the test.
    // The application has some buggy logic (intentional for tests), but there should be no
    // uncaught ReferenceError/SyntaxError/TypeError unless the implementation throws them.
    // We assert the absence of uncaught page errors here and report console error messages if any.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e => String(e)).join(', ')}`).toEqual([]);
    // Also fail if any console messages of type 'error' were emitted.
    expect(consoleErrors, `Unexpected console.error messages: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Initial state is Idle: UI elements exist and initial values are correct', async ({ page }) => {
    // Validate initial state (Idle) corresponding to S0_Idle
    const app = new CpuSchedulingPage(page);

    // Output should be empty initially
    expect(await app.getOutputText()).toBe('');

    // Priority input should be empty
    const priorityVal = await app.priorityInput.inputValue();
    expect(priorityVal).toBe('');

    // Task type select initial value should be "I/O" per implementation
    const selectValue = await app.getSelectValue();
    expect(selectValue).toBe('I/O');

    // The select should initially contain option elements (innerHTML contains option tags)
    const selectInner = await app.getSelectInnerHTML();
    expect(selectInner).toContain('option');

    // Buttons should be visible and enabled
    await expect(app.allocateButton).toBeVisible();
    await expect(app.deallocateButton).toBeVisible();
    await expect(app.switchButton).toBeVisible();
  });

  test('Allocate CPU transitions to CPU Allocated state and is idempotent', async ({ page }) => {
    // This validates transition: S0_Idle --AllocateCPU--> S1_CPU_Allocated
    // It checks the entry_action allocateCPU() produced the expected output text.
    const app = new CpuSchedulingPage(page);

    // Click allocate and expect output like "Allocated CPU Time: {number}ms"
    await app.clickAllocate();
    const firstOutput = await app.getOutputText();
    expect(firstOutput).toMatch(/^Allocated CPU Time: \d+ms$/);

    // Clicking allocate again should be idempotent due to allocated flag; output should remain unchanged
    await app.clickAllocate();
    const secondOutput = await app.getOutputText();
    expect(secondOutput).toBe(firstOutput);
  });

  test('Deallocate CPU behavior demonstrates buggy logic (no transition to Deallocated)', async ({ page }) => {
    // This test explores the deallocate transition. The implementation contains a logic bug:
    // deallocateCPU checks "if (!deallocated) return;" with deallocated initially false
    // so the deallocation code never runs. We assert this broken behavior.
    const app = new CpuSchedulingPage(page);

    // Case A: clicking deallocate from Idle should do nothing (no output)
    await app.clickDeallocate();
    expect(await app.getOutputText()).toBe('');

    // Case B: allocate first (to simulate being in S1_CPU_Allocated), then click deallocate.
    // Because of the bug, deallocate will still not produce "Deallocated CPU Time: ..." and output should remain allocated text.
    await app.clickAllocate();
    const allocatedOutput = await app.getOutputText();
    expect(allocatedOutput).toMatch(/^Allocated CPU Time: \d+ms$/);

    await app.clickDeallocate();
    // Output should still reflect the allocation (unchanged)
    expect(await app.getOutputText()).toBe(allocatedOutput);
  });

  test('Switch CPU toggles Task Type and mutates the select innerHTML (Task Switched state)', async ({ page }) => {
    // Validates the S0_Idle --SwitchCPU--> S3_Task_Switched transition and the self-transition on SwitchCPU
    const app = new CpuSchedulingPage(page);

    // Initial select should contain options
    const beforeInner = await app.getSelectInnerHTML();
    expect(beforeInner).toContain('option');

    // Click switch: starting taskType is "I/O", so first click should set it to "CPU"
    await app.clickSwitch();
    const afterFirstSwitch = await app.getSelectInnerHTML();
    // Implementation sets the select.innerHTML to a plain text "Task Type: CPU"
    expect(afterFirstSwitch).toBe('Task Type: CPU');

    // Click switch again: it should toggle back to "I/O"
    await app.clickSwitch();
    const afterSecondSwitch = await app.getSelectInnerHTML();
    expect(afterSecondSwitch).toBe('Task Type: I/O');

    // After these operations the select no longer contains option elements (demonstrates mutation)
    expect(afterSecondSwitch).not.toContain('option');
  });

  test('UpdatePriority updates output; edge-case: empty input leads to NaN', async ({ page }) => {
    // Tests UpdatePriority event which should keep the FSM in Idle (S0_Idle->S0_Idle)
    const app = new CpuSchedulingPage(page);

    // Set a valid priority and expect output "Priority: {n}"
    await app.setPriority(7);
    // Wait for the input event handler to run and update output
    await expect(app.outputContainer).toHaveText('Priority: 7');

    // Edge case: clear the input -> parseInt("") is NaN -> output shows "Priority: NaN"
    await app.clearPriority();
    // The page's input handler triggers on input and will set Priority: NaN
    await expect(app.outputContainer).toHaveText('Priority: NaN');
  });

  test('ChangeTaskType (select change) triggers updateTaskType and mutates the select', async ({ page }) => {
    // This validates the ChangeTaskType event and shows its side effect on the select element
    const app = new CpuSchedulingPage(page);

    // Select "CPU" using selectOption which triggers the change event
    await app.changeTaskType('CPU');

    // After change, the implementation sets select.innerHTML to "Task Type: CPU"
    const afterChangeInner = await app.getSelectInnerHTML();
    expect(afterChangeInner).toBe('Task Type: CPU');

    // Because updateTaskType replaces the innerHTML of the select, options are removed
    // Further change attempts via selectOption would fail to select an option (no options exist),
    // but we do not inject or patch the page; we simply assert the observed mutation.
    expect(afterChangeInner).not.toContain('<option');
  });

  test('Robustness: perform a sequence of interactions to validate FSM behaviors and side-effects', async ({ page }) => {
    // This scenario runs a sequence: allocate -> set priority -> switch -> try deallocate
    // and validates expected / observed behaviors across states.
    const app = new CpuSchedulingPage(page);

    // 1) Allocate CPU -> should show Allocated text
    await app.clickAllocate();
    const allocText = await app.getOutputText();
    expect(allocText).toMatch(/^Allocated CPU Time: \d+ms$/);

    // 2) Update priority -> moves (conceptually) inside Idle per FSM but page simply updates output
    await app.setPriority(10);
    await expect(app.outputContainer).toHaveText('Priority: 10');

    // 3) Switch task type -> select mutated to "Task Type: CPU"
    await app.clickSwitch();
    const selectAfterSwitch = await app.getSelectInnerHTML();
    expect(selectAfterSwitch).toBe('Task Type: CPU');

    // 4) Attempt Deallocate -> bug prevents deallocation, so output should remain "Priority: 10" (last update)
    await app.clickDeallocate();
    // The output should not have become "Deallocated CPU Time: ..." due to the bug; it remains the most recent output.
    expect(await app.getOutputText()).toBe('Priority: 10');
  });

  test('Console and page errors observed during interactions (no uncaught exceptions expected)', async ({ page }) => {
    // This test explicitly performs actions and then asserts that no uncaught exceptions or console.error were emitted.
    // It duplicates some interactions to ensure any hidden runtime error surfaces in listeners.
    const app = new CpuSchedulingPage(page);

    // Do a variety of interactions
    await app.clickAllocate();
    await app.setPriority(3);
    await app.clearPriority();
    await app.clickSwitch();
    await app.changeTaskType('I/O');
    await app.clickDeallocate();

    // Wait a tick to allow any asynchronous console messages to appear
    await page.waitForTimeout(100);

    // Verify that our listeners saw no uncaught page errors and no console.error entries.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Also assert that we captured some console messages (if any) or at least an array exists
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});