import { MINI_VIKTOR_REMINDER_CORPUS_DATA } from "./miniViktorReminderCorpusData";

export type MiniViktorCorpusCase = {
  id: string;
  category: string;
  input: string;
  expected: Record<string, unknown>;
  assistantShouldAsk?: string;
  critical: boolean;
  tags: string[];
  notes?: string;
};

export type MiniViktorReminderCorpus = {
  name: string;
  version: string;
  createdFor: string;
  description: string;
  count: number;
  schema?: Record<string, string>;
  categories: string[];
  items: MiniViktorCorpusCase[];
};

export type CorpusSummary = {
  total: number;
  critical: number;
  byCategory: Record<string, number>;
};

export function getMiniViktorReminderCorpus(): MiniViktorReminderCorpus {
  return MINI_VIKTOR_REMINDER_CORPUS_DATA;
}

export async function loadMiniViktorReminderCorpus(): Promise<MiniViktorReminderCorpus> {
  try {
    const response = await fetch("/brain/mini-viktor-reminder-corpus.json", { cache: "no-store" });
    if (response.ok) return (await response.json()) as MiniViktorReminderCorpus;
  } catch {
    // Native Android builds and offline runs may not fetch public JSON consistently.
    // Fall back to the bundled TypeScript corpus.
  }

  return MINI_VIKTOR_REMINDER_CORPUS_DATA;
}

export function summarizeMiniViktorCorpus(corpus: MiniViktorReminderCorpus = MINI_VIKTOR_REMINDER_CORPUS_DATA): CorpusSummary {
  const byCategory: Record<string, number> = {};
  let critical = 0;

  for (const item of corpus.items) {
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    if (item.critical) critical += 1;
  }

  return {
    total: corpus.items.length,
    critical,
    byCategory,
  };
}

export function exportMiniViktorCorpusAsJsonl(corpus: MiniViktorReminderCorpus = MINI_VIKTOR_REMINDER_CORPUS_DATA): string {
  return corpus.items
    .map((item) =>
      JSON.stringify({
        id: item.id,
        input: item.input,
        expected: item.expected,
        assistantShouldAsk: item.assistantShouldAsk || "",
        category: item.category,
        tags: item.tags,
      })
    )
    .join("\n");
}

export function filterMiniViktorCorpus(
  corpus: MiniViktorReminderCorpus,
  categoryOrTag: string
): MiniViktorCorpusCase[] {
  const query = categoryOrTag.trim().toLowerCase();
  if (!query) return corpus.items;

  return corpus.items.filter((item) => {
    return (
      item.category.toLowerCase().includes(query) ||
      item.tags.some((tag) => tag.toLowerCase().includes(query)) ||
      item.input.toLowerCase().includes(query)
    );
  });
}
