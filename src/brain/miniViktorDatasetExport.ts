import { MINI_VIKTOR_REGRESSION_CASES } from "./miniViktorRegressionArena";
import { runMiniViktorSimulationCase } from "./miniViktorSimulationLab";
import { getMiniViktorReminderCorpus, exportMiniViktorCorpusAsJsonl } from "./miniViktorReminderCorpus";

export type MiniViktorTrainingExample = {
  id: string;
  category: string;
  input: string;
  conversation: string[];
  expected: {
    taskIncludes?: string;
    eventDatePhrase?: string;
    eventTimeText?: string;
    alertCount?: number;
    alerts?: Array<{ datePhrase?: string; timeText?: string }>;
    mustAskForInferenceConfirmation?: boolean;
    mustNotBeReadyToSave?: boolean;
  };
  guardrails: {
    hiddenInferenceAllowed: false;
    preserveEventTime: true;
    preserveAllReminderCandidates: true;
    blockSaveWhenIncomplete: true;
  };
  status: "clean" | "needs_review";
  source?: "regression" | "corpus";
};

export type MiniViktorDatasetExport = {
  generatedAt: string;
  total: number;
  clean: number;
  needsReview: number;
  examples: MiniViktorTrainingExample[];
};

export function buildMiniViktorTrainingDataset(): MiniViktorDatasetExport {
  const regressionExamples: MiniViktorTrainingExample[] = MINI_VIKTOR_REGRESSION_CASES.map((testCase) => {
    const result = runMiniViktorSimulationCase(testCase);

    return {
      id: testCase.id,
      category: testCase.category,
      input: testCase.turns.join(" | "),
      conversation: testCase.turns,
      expected: testCase.expected,
      guardrails: {
        hiddenInferenceAllowed: false,
        preserveEventTime: true,
        preserveAllReminderCandidates: true,
        blockSaveWhenIncomplete: true,
      },
      status: result.passed ? "clean" : "needs_review",
      source: "regression",
    };
  });

  const corpusExamples: MiniViktorTrainingExample[] = getMiniViktorReminderCorpus().items.map((item) => ({
    id: item.id,
    category: item.category,
    input: item.input,
    conversation: [item.input],
    expected: item.expected,
    guardrails: {
      hiddenInferenceAllowed: false,
      preserveEventTime: true,
      preserveAllReminderCandidates: true,
      blockSaveWhenIncomplete: true,
    },
    status: item.critical ? "clean" : "needs_review",
    source: "corpus",
  }));

  const examples = [...regressionExamples, ...corpusExamples];

  return {
    generatedAt: new Date().toISOString(),
    total: examples.length,
    clean: examples.filter((example) => example.status === "clean").length,
    needsReview: examples.filter((example) => example.status === "needs_review").length,
    examples,
  };
}

export function miniViktorCorpusDatasetToJsonl() {
  return exportMiniViktorCorpusAsJsonl(getMiniViktorReminderCorpus());
}

export function miniViktorDatasetToJson(exportData: MiniViktorDatasetExport) {
  return JSON.stringify(exportData, null, 2);
}

export function miniViktorDatasetToJsonl(exportData: MiniViktorDatasetExport) {
  return exportData.examples.map((example) => JSON.stringify(example)).join("\n");
}
