const { test, expect } = require('@playwright/test');

test('test confirmation modal', async ({ page }) => {
  await page.goto('http://localhost:3000/candidates');
  
  // Switch to Red Flags tab
  await page.click('text="Red Flags"');
  
  // Click the first select button in the red flags table
  // Use a more robust selector targeting the button inside the table cell
  await page.locator('.candidates_table__rF5f0 .candidates_selectBtn__gJ4xT').first().click();
  
  // Verify side panel opens
  await expect(page.locator('.candidates_sidePanelNameTitle__W212Y').first()).toBeVisible();

  // Click the accept button
  await page.locator('.candidates_acceptBtn__81Q2f').first().click();

  // Verify modal is visible
  await expect(page.locator('.candidates_confirmModal__B30tU')).toBeVisible();
  
  // the text should contain 'accept'
  await expect(page.locator('.candidates_confirmTitle__4I23v')).toContainText('accept');

  // Click cancel
  await page.locator('.candidates_confirmCancelBtn__m9aK7').click();

  // Verify modal is hidden
  await expect(page.locator('.candidates_confirmModal__B30tU')).not.toBeVisible();

  // Click reject
  await page.locator('.candidates_rejectBtn__oXgXG').first().click();

  // Verify modal is visible
  await expect(page.locator('.candidates_confirmModal__B30tU')).toBeVisible();

  // the text should contain 'reject'
  await expect(page.locator('.candidates_confirmTitle__4I23v')).toContainText('reject');

  // Click Yes
  await page.locator('.candidates_confirmRejectBtn__oXg0P').click();

  // Verify modal is hidden
  await expect(page.locator('.candidates_confirmModal__B30tU')).not.toBeVisible();
  
});
