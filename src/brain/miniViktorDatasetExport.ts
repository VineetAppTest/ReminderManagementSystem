import { MINI_VIKTOR_REGRESSION_CASES } from "./miniViktorRegressionArena";
import { runMiniViktorSimulationCase } from "./miniViktorSimulationLab";

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
};

export type MiniViktorDatasetExport = {
  generatedAt: string;
  total: number;
  clean: number;
  needsReview: number;
  examples: MiniViktorTrainingExample[];
};

export function buildMiniViktorTrainingDataset(): MiniViktorDatasetExport {
  const examples: MiniViktorTrainingExample[] = MINI_VIKTOR_REGRESSION_CASES.map((testCase) => {
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
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    total: examples.length,
    clean: examples.filter((example) => example.status === "clean").length,
    needsReview: examples.filter((example) => example.status === "needs_review").length,
    examples,
  };
}

export function miniViktorDatasetToJson(exportData: MiniViktorDatasetExport) {
  return JSON.stringify(exportData, null, 2);
}

export function miniViktorDatasetToJsonl(exportData: MiniViktorDatasetExport) {
  return exportData.examples.map((example) => JSON.stringify(example)).join("\n");
}
