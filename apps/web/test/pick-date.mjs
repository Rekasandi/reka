// Select a calendar day in the shared shadcn DatePicker (react-day-picker popover).
export async function pickDate(page, trigger, iso) {
  const [year, month, day] = iso.split('-').map(Number);
  await trigger.click();
  const calendar = page.locator('[data-radix-popper-content-wrapper]').last();
  const target = await page.evaluate(([y, m, d]) => new Date(y, m - 1, d).toLocaleDateString(), [year, month, day]);
  const cell = calendar.locator(`[data-day="${target}"]`).first();
  await calendar.locator('[data-day]').first().waitFor();
  for (let attempt = 0; attempt < 120 && !(await cell.count()); attempt += 1) {
    const shown = await calendar.locator('[data-day]').first().getAttribute('data-day');
    const diff = await page.evaluate(([value, y, m]) => {
      const date = new Date(value);
      return (y * 12 + m - 1) - (date.getFullYear() * 12 + date.getMonth());
    }, [shown, year, month]);
    await calendar.getByRole('button', { name: diff > 0 ? /next month/i : /previous month/i }).click();
  }
  await cell.click();
  await calendar.waitFor({ state: 'detached' });
}
