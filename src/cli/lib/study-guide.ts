import type { CliEnvironment } from './types';
import { requestText } from './http';

const STUDY_DESIGN_GUIDE_PATH = '/guides/study-design.md';

export async function loadStudyDesignGuideMarkdown(env: CliEnvironment): Promise<string | null> {
  return requestText({
    env,
    method: 'GET',
    path: STUDY_DESIGN_GUIDE_PATH,
    authMode: 'none',
  });
}

export function listMarkdownH2Headings(markdown: string): string[] {
  return markdown
    .split(/^(?=## )/m)
    .map((section) => section.match(/^## (.+)/)?.[1])
    .filter((heading): heading is string => Boolean(heading));
}

export function extractMarkdownH2Section(markdown: string, sectionName: string): { content: string; headings: string[] } | null {
  const sections = markdown.split(/^(?=## )/m);
  const match = sections.find((section) => section.toLowerCase().startsWith(`## ${sectionName.toLowerCase()}`));
  const headings = listMarkdownH2Headings(markdown);

  if (!match) {
    return null;
  }

  return {
    content: match.trim(),
    headings,
  };
}
