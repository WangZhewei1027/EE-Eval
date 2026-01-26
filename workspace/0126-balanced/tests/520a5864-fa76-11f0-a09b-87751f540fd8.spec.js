import { test, expect } from '@playwright/test';

// Test suite for Application ID: 520a5864-fa76-11f0-a09b-87751f540fd8
// URL provided by the harness:
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520a5864-fa76-11f0-a09b-87751f540fd8.html';

// Page Object representing the database page
class DatabasePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.forms = page.locator('form');
    this.insertSubmit = page.locator("input[type='submit'][value='Insert Data']");
    this.updateSubmit = page.locator("input[type='submit'][value='Update Data']");
    this.deleteSubmit = page.locator("input[type='submit'][value='Delete Data']");
    // Inputs (note: duplicate IDs exist across forms in the page)
    this.studentIdLocators = page.locator('#studentId');
    this.nameLocators = page.locator('#name');
    this.ageLocators = page.locator('#age');
    this.gradeLocators = page.locator('#grade');
  }

  // Return nth form locator (0-based)
  formAt(index) {
    return this.forms.nth(index);
  }

  // Fill the inserting form (form 0) with provided values
  async fillInsertForm({ studentId, name, age, grade }) {
    const form = this.formAt(0);
    // Fill inputs within the first form (scoped to the form)
    const studentInput = form.locator("input[type='number']#studentId");
    const nameInput = form.locator("input[type='text']#name");
    const ageInput = form.locator("input[type='number']#age");
    const gradeSelect = form.locator("select#grade");

    if (studentId !== undefined) await studentInput.fill(String(studentId));
    if (name !== undefined) await nameInput.fill(name);
    if (age !== undefined) await ageInput.fill(String(age));
    if (grade !== undefined) await gradeSelect.selectOption(String(grade));
  }

  // Fill the updating form (form 1) with provided values
  async fillUpdateForm({ studentId, name, age, grade }) {
    const form = this.formAt(1);
    const studentInput = form.locator("input[type='number']#studentId");
    const nameInput = form.locator("input[type='text']#name");
    const ageInput = form.locator("input[type='number']#age");
    const gradeSelect = form.locator("select#grade");

    if (studentId !== undefined) await studentInput.fill(String(studentId));
    if (name !== undefined) await nameInput.fill(name);
    if (age !== undefined) await ageInput.fill(String(age));
    if (grade !== undefined) await gradeSelect.selectOption(String(grade));
  }

  // Fill the deleting form (form 2) with provided values
  async fillDeleteForm({ studentId }) {
    const form = this.formAt(2);
    const studentInput = form.locator("input[type='number']#studentId");
    if (studentId !== undefined) await studentInput.fill(String(studentId));
  }

  // Submit a form and wait for navigation (the forms submit to same page, so navigation expected)
  async submitFormAndWaitForReload(formIndex) {
    const form = this.formAt(formIndex);
    const submit = form.locator("input[type='submit']");
    // Many forms in this page do not have JS handlers, so a submit triggers a navigation (reload).
    await Promise.all([
      this.page.waitForNavigation(/*{ waitUntil: 'load' }*/),
      submit.click(),
    ]);
  }

  // Utility: count duplicates for an ID selector
  async countSelector(selector) {
    return await this.page.locator(selector).count();
  }

  // Utility: check if an element with text exists in any of the table rows
  async tableContainsText(text) {
    const locator = this.page.locator('table').locator(`xpath=.//tr//*[contains(text(), "${text}")]`);
    return await locator.count() > 0;
  }
}

// Global collectors for console messages and page errors
let consoleMessages = [];
let pageErrors = [];

test.describe('Relational Database FSM - states and transitions', () => {
  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      // capture text and type
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Silence unused variable warnings and ensure page is closed if tests end
    // (Playwright takes care of cleaning up contexts)
    // This hook available for any teardown if needed in future.
  });

  test('Idle state: page renders with main heading', async ({ page }) => {
    // Validate Idle state evidence: presence of <h1>Relational Database</h1>
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Relational Database');

    // Also make sure at least one table is present (page shows multiple tables)
    const tables = page.locator('table');
    await expect(tables).toHaveCountGreaterThan(0);
  });

  test('State presence: Inserting, Updating, Deleting forms and respective submit inputs', async ({ page }) => {
    const db = new DatabasePage(page);

    // There should be exactly three form sections (Inserting, Updating, Deleting)
    await expect(page.locator('form')).toHaveCount(3);

    // Each submit button evidence for states
    await expect(db.insertSubmit).toHaveCount(1);
    await expect(db.updateSubmit).toHaveCount(1);
    await expect(db.deleteSubmit).toHaveCount(1);

    // Check inserting form contains all input fields + select
    const insertForm = db.formAt(0);
    await expect(insertForm.locator("input[type='number']#studentId")).toHaveCount(1);
    await expect(insertForm.locator("input[type='text']#name")).toHaveCount(1);
    await expect(insertForm.locator("input[type='number']#age")).toHaveCount(1);
    await expect(insertForm.locator("select#grade")).toHaveCount(1);

    // Check updating form contains similar fields
    const updateForm = db.formAt(1);
    await expect(updateForm.locator("input[type='number']#studentId")).toHaveCount(1);
    await expect(updateForm.locator("input[type='text']#name")).toHaveCount(1);
    await expect(updateForm.locator("input[type='number']#age")).toHaveCount(1);
    await expect(updateForm.locator("select#grade")).toHaveCount(1);

    // Deleting form should only have studentId input and submit
    const deleteForm = db.formAt(2);
    await expect(deleteForm.locator("input[type='number']#studentId")).toHaveCount(1);
    await expect(deleteForm.locator("input[type='submit'][value='Delete Data']")).toHaveCount(1);
  });

  test('FSM Transition: InsertData (submit Insert form) reloads the page and preserves visible forms', async ({ page }) => {
    const db = new DatabasePage(page);

    // Fill inserting form and submit. Because the app does not implement server-side DB changes
    // we only assert navigation (reload) happens and page still renders the forms afterward.
    await db.fillInsertForm({ studentId: 9999, name: 'Alice Test', age: 30, grade: 'B' });

    // Submit and wait for navigation/reload
    await db.submitFormAndWaitForReload(0);

    // After reload, the forms and submit buttons should still be available (transition back to Idle)
    await expect(page.locator('h1')).toHaveText('Relational Database');
    await expect(db.insertSubmit).toHaveCount(1);
    await expect(db.updateSubmit).toHaveCount(1);
    await expect(db.deleteSubmit).toHaveCount(1);

    // Since the page is static, it will not show the newly "inserted" student.
    // Confirm that the static sample rows still exist (evidence)
    await expect(db.tableContainsText('John Smith')).resolves.toBeTruthy();
    await expect(db.tableContainsText('Jane Doe')).resolves.toBeTruthy();
  });

  test('FSM Transition: UpdateData (submit Update form) reloads the page and keeps structure intact', async ({ page }) => {
    const db = new DatabasePage(page);

    // Fill updating form (form 1) and submit
    await db.fillUpdateForm({ studentId: 1, name: 'John Updated', age: 22, grade: 'C' });
    await db.submitFormAndWaitForReload(1);

    // After reload, ensure the three forms are present again
    await expect(page.locator('form')).toHaveCount(3);
    await expect(db.updateSubmit).toHaveCount(1);
    // The page is static; check static evidence remains
    await expect(db.tableContainsText('John Smith')).resolves.toBeTruthy();
  });

  test('FSM Transition: DeleteData (submit Delete form) reloads the page; edge case: missing studentId', async ({ page }) => {
    const db = new DatabasePage(page);

    // Edge case 1: submit delete form without providing studentId (empty)
    // Ensure the input is empty first (it may be empty by default)
    const deleteForm = db.formAt(2);
    const studentInput = deleteForm.locator("input[type='number']#studentId");
    await expect(studentInput).toHaveValue('');

    // Submit and wait for navigation/reload
    await db.submitFormAndWaitForReload(2);

    // After reload, delete form still present
    await expect(db.deleteSubmit).toHaveCount(1);

    // Edge case 2: submit delete form with a non-existing studentId (e.g., 9999)
    await db.fillDeleteForm({ studentId: 9999 });
    // Because page reloads on submit, wait for navigation
    await db.submitFormAndWaitForReload(2);

    // Page still shows static entries
    await expect(db.tableContainsText('Jane Doe')).resolves.toBeTruthy();
  });

  test('DOM Anomalies: duplicate IDs detected (edge-case the page contains duplicate id attributes)', async ({ page }) => {
    const db = new DatabasePage(page);

    // The HTML intentionally duplicates ids across forms.
    // Verify the counts to surface this anomaly.
    const studentIdCount = await db.countSelector('#studentId');
    const nameCount = await db.countSelector('#name');
    const ageCount = await db.countSelector('#age');
    const gradeCount = await db.countSelector('#grade');

    // Expect duplicate IDs: studentId appears in 3 forms, name & age in 2, grade in 2
    // The HTML shows:
    // - studentId present in all three forms -> count 3
    // - name appears only in inserting and updating forms -> count 2
    // - age appears only in inserting and updating forms -> count 2
    // - grade appears only in inserting and updating forms -> count 2
    await expect(studentIdCount).toBeGreaterThanOrEqual(1);
    await expect(nameCount).toBeGreaterThanOrEqual(0);
    await expect(ageCount).toBeGreaterThanOrEqual(0);
    await expect(gradeCount).toBeGreaterThanOrEqual(0);

    // Make assertions on expected duplication based on the provided HTML structure
    // (these are based on the supplied HTML; tolerate variability but surface anomalies)
    expect(studentIdCount).toBe(3);
    expect(nameCount).toBe(2);
    expect(ageCount).toBe(2);
    expect(gradeCount).toBe(2);
  });

  test('Observe console logs and page errors: capture and assert no uncaught exceptions', async ({ page }) => {
    // This test verifies whether any uncaught page errors occurred during page load and interactions.
    // We recorded pageErrors and consoleMessages during beforeEach and subsequent navigations.
    // Assert that pageErrors list is an array (and in typical correct page should be empty).
    expect(Array.isArray(pageErrors)).toBeTruthy();

    // If any page errors occurred, fail the test and print them to help debugging.
    if (pageErrors.length > 0) {
      // Build a helpful message with serialized errors
      const messages = pageErrors.map((e, i) => `Error[${i}]: ${e.toString()}`).join('\n');
      // Fail explicitly with details
      throw new Error(`Uncaught page errors were detected:\n${messages}`);
    }

    // Also assert that there are no console messages of severe types (e.g., 'error')
    // Collect console error messages
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    // If there are error-level console messages, surface them
    if (errorConsoleMessages.length > 0) {
      const msgs = errorConsoleMessages.map((m) => `${m.type}: ${m.text}`).join('\n');
      throw new Error(`Console reported errors/warnings:\n${msgs}`);
    }

    // If we reach here, there were no uncaught page errors nor console error/warning messages.
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Robustness: sequentially exercise all transitions to ensure consistent behavior across reloads', async ({ page }) => {
    const db = new DatabasePage(page);

    // 1) Insert, 2) Update, 3) Delete - sequentially submit each form and wait for reload each time
    await db.fillInsertForm({ studentId: 1234, name: 'Seq Test', age: 18, grade: 'A' });
    await db.submitFormAndWaitForReload(0);

    await db.fillUpdateForm({ studentId: 2, name: 'Seq Updated', age: 99, grade: 'C' });
    await db.submitFormAndWaitForReload(1);

    await db.fillDeleteForm({ studentId: 2 });
    await db.submitFormAndWaitForReload(2);

    // After sequential operations, page should be stable and render the expected static content
    await expect(page.locator('h1')).toHaveText('Relational Database');
    await expect(db.insertSubmit).toHaveCount(1);
    await expect(db.updateSubmit).toHaveCount(1);
    await expect(db.deleteSubmit).toHaveCount(1);
  });
});