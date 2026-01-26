import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test/html/0f6e2ea0-fa67-11f0-a703-83a271a6f008.html';

test.describe('Bubble Sort Application Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the Bubble Sort application page before each test
    await page.goto(BASE_URL);
  });

  test('should render the Bubble Sort title', async ({ page }) => {
    // Validate that the title "Bubble Sort" is rendered on the page
    const title = await page.locator('h1').innerText();
    expect(title).toBe('Bubble Sort');
  });

  test('should render the Bubble Sort description', async ({ page }) => {
    // Validate that the description paragraph is rendered correctly
    const description = await page.locator('p').innerText();
    expect(description).toContain('Bubble sort is an algorithm that works by repeatedly moving the largest element to the end of the list until no more elements need to be moved.');
  });

  test('should log the sorted array in the console', async ({ page }) => {
    // Observe console logs for the output of the bubble sort
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    // Execute the bubbleSort function by evaluating the script in the page context
    await page.evaluate(() => {
      function bubbleSort(arr) {
        let len = arr.length;
        for (let i = 0; i < len - 1; i++) {
          for (let j = 0; j < len - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
              let temp = arr[j];
              arr[j] = arr[j + 1];
              arr[j + 1] = temp;
            }
          }
        }
      }
      let arr = [5, 3, 8, 1, 9, 2];
      bubbleSort(arr);
      console.log(arr); // Output: [1, 1, 2, 3, 5, 8]
    });

    // Wait for a short duration to ensure the console log is captured
    await page.waitForTimeout(100);

    // Validate that the console output is as expected
    expect(consoleMessages).toContain('[1, 2, 3, 5, 8]');
  });

  test('should handle empty array case', async ({ page }) => {
    // Observe console logs for the output of the bubble sort with an empty array
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    // Execute the bubbleSort function with an empty array
    await page.evaluate(() => {
      function bubbleSort(arr) {
        let len = arr.length;
        for (let i = 0; i < len - 1; i++) {
          for (let j = 0; j < len - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
              let temp = arr[j];
              arr[j] = arr[j + 1];
              arr[j + 1] = temp;
            }
          }
        }
      }
      let arr = [];
      bubbleSort(arr);
      console.log(arr); // Output: []
    });

    // Wait for a short duration to ensure the console log is captured
    await page.waitForTimeout(100);

    // Validate that the console output is as expected
    expect(consoleMessages).toContain('[]');
  });

  test('should handle single element array case', async ({ page }) => {
    // Observe console logs for the output of the bubble sort with a single element
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    // Execute the bubbleSort function with a single element array
    await page.evaluate(() => {
      function bubbleSort(arr) {
        let len = arr.length;
        for (let i = 0; i < len - 1; i++) {
          for (let j = 0; j < len - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
              let temp = arr[j];
              arr[j] = arr[j + 1];
              arr[j + 1] = temp;
            }
          }
        }
      }
      let arr = [42];
      bubbleSort(arr);
      console.log(arr); // Output: [42]
    });

    // Wait for a short duration to ensure the console log is captured
    await page.waitForTimeout(100);

    // Validate that the console output is as expected
    expect(consoleMessages).toContain('[42]');
  });

  test('should handle already sorted array case', async ({ page }) => {
    // Observe console logs for the output of the bubble sort with an already sorted array
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    // Execute the bubbleSort function with an already sorted array
    await page.evaluate(() => {
      function bubbleSort(arr) {
        let len = arr.length;
        for (let i = 0; i < len - 1; i++) {
          for (let j = 0; j < len - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
              let temp = arr[j];
              arr[j] = arr[j + 1];
              arr[j + 1] = temp;
            }
          }
        }
      }
      let arr = [1, 2, 3, 4, 5];
      bubbleSort(arr);
      console.log(arr); // Output: [1, 2, 3, 4, 5]
    });

    // Wait for a short duration to ensure the console log is captured
    await page.waitForTimeout(100);

    // Validate that the console output is as expected
    expect(consoleMessages).toContain('[1, 2, 3, 4, 5]');
  });

  test('should handle reverse sorted array case', async ({ page }) => {
    // Observe console logs for the output of the bubble sort with a reverse sorted array
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    // Execute the bubbleSort function with a reverse sorted array
    await page.evaluate(() => {
      function bubbleSort(arr) {
        let len = arr.length;
        for (let i = 0; i < len - 1; i++) {
          for (let j = 0; j < len - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
              let temp = arr[j];
              arr[j] = arr[j + 1];
              arr[j + 1] = temp;
            }
          }
        }
      }
      let arr = [5, 4, 3, 2, 1];
      bubbleSort(arr);
      console.log(arr); // Output: [1, 2, 3, 4, 5]
    });

    // Wait for a short duration to ensure the console log is captured
    await page.waitForTimeout(100);

    // Validate that the console output is as expected
    expect(consoleMessages).toContain('[1, 2, 3, 4, 5]');
  });

  test.afterEach(async ({ page }) => {
    // Check for any console errors after each test
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait for a short duration to ensure all console messages are captured
    await page.waitForTimeout(100);

    // Assert that there are no console errors
    expect(consoleErrors).toHaveLength(0);
  });
});