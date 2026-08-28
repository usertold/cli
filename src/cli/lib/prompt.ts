import { createInterface } from 'node:readline';

/**
 * Prompt for a single line of input. Writes the question to stderr
 * to keep stdout clean for structured output.
 */
export async function prompt(question: string, defaultValue?: string): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  return new Promise<string>((resolve) => {
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      resolve(trimmed || defaultValue || '');
    });
  });
}

/**
 * Prompt for a yes/no answer.
 */
export async function promptYesNo(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await prompt(`${question} ${hint}`);
  if (answer === '') return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

/**
 * Prompt the user to choose from a list of options.
 * Returns the 0-based index of the selected option.
 */
export async function promptChoice(question: string, options: string[]): Promise<number> {
  process.stderr.write(`${question}\n`);
  for (let i = 0; i < options.length; i++) {
    process.stderr.write(`  ${i + 1}) ${options[i]}\n`);
  }

  const answer = await prompt('Choice', '1');
  const idx = parseInt(answer, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= options.length) {
    return 0;
  }
  return idx;
}
