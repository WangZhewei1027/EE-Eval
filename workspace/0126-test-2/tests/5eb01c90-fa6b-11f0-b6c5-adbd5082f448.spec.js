import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-test-2/html/5eb01c90-fa6b-11f0-b6c5-adbd5082f448.html';

test.describe('Bubble Sort Application', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the Bubble Sort application page
        await page.goto(BASE_URL);
    });

    test('should display the sorted data on page load', async ({ page }) => {
        // Validate that the #data element contains sorted data after page load
        const dataElement = await page.locator('#data');
        await expect(dataElement).toContainText(/Sorted Data: /);
    });

    test('should log original and sorted data in the console', async ({ page }) => {
        // Listen for console messages
        const consoleMessages = [];
        page.on('console', msg => consoleMessages.push(msg.text()));

        // Wait for the page to load and execute the sorting
        await page.waitForLoadState('domcontentloaded');

        // Validate console logs for original and sorted data
        await expect(consoleMessages).toContainEqual(expect.stringContaining('Original Data:'));
        await expect(consoleMessages).toContainEqual(expect.stringContaining('Sorted Data:'));
    });

    test('should handle edge case of empty data', async ({ page }) => {
        // Modify the script to handle an empty array scenario
        await page.evaluate(() => {
            const bubbleSort = (data) => {
                if (data.length === 0) return data;
                let n = data.length;
                for (let i = 0; i < n; i++) {
                    for (let j = 0; j < n - i - 1; j++) {
                        if (data[j] > data[j + 1]) {
                            let temp = data[j];
                            data[j] = data[j + 1];
                            data[j + 1] = temp;
                        }
                    }
                }
                return data;
            };

            let data = [];
            let sortedData = bubbleSort(data);
            document.getElementById("data").innerHTML = "Sorted Data: " + sortedData.join("<br>");
        });

        // Validate that the #data element shows "Sorted Data: "
        const dataElement = await page.locator('#data');
        await expect(dataElement).toContainText('Sorted Data: ');
    });

    test('should handle edge case of single element data', async ({ page }) => {
        // Modify the script to handle a single element array scenario
        await page.evaluate(() => {
            const bubbleSort = (data) => {
                let n = data.length;
                for (let i = 0; i < n; i++) {
                    for (let j = 0; j < n - i - 1; j++) {
                        if (data[j] > data[j + 1]) {
                            let temp = data[j];
                            data[j] = data[j + 1];
                            data[j + 1] = temp;
                        }
                    }
                }
                return data;
            };

            let data = [42];
            let sortedData = bubbleSort(data);
            document.getElementById("data").innerHTML = "Sorted Data: " + sortedData.join("<br>");
        });

        // Validate that the #data element shows the single element
        const dataElement = await page.locator('#data');
        await expect(dataElement).toContainText('Sorted Data: 42');
    });

    test('should handle non-numeric data gracefully', async ({ page }) => {
        // Modify the script to handle non-numeric data scenario
        await page.evaluate(() => {
            const bubbleSort = (data) => {
                let n = data.length;
                for (let i = 0; i < n; i++) {
                    for (let j = 0; j < n - i - 1; j++) {
                        if (data[j] > data[j + 1]) {
                            let temp = data[j];
                            data[j] = data[j + 1];
                            data[j + 1] = temp;
                        }
                    }
                }
                return data;
            };

            let data = ['apple', 'banana', 'cherry'];
            let sortedData = bubbleSort(data);
            document.getElementById("data").innerHTML = "Sorted Data: " + sortedData.join("<br>");
        });

        // Validate that the #data element shows the sorted non-numeric data
        const dataElement = await page.locator('#data');
        await expect(dataElement).toContainText('Sorted Data: apple<br>banana<br>cherry');
    });
});