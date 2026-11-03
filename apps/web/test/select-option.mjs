// Choose an option in a shadcn/Radix Select from Playwright. `trigger` is the combobox locator;
// `name` is the option's visible text (string = exact match, RegExp = pattern).
export async function selectOption(page, trigger, name) {
  await trigger.click();
  await page.getByRole('option', typeof name === 'string' ? { name, exact: true } : { name }).click();
}
