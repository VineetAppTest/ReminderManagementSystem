import { MINI_VIKTOR_SEED_BRAIN } from "./miniViktorSeedBrain";

export type MiniViktorEvaluationCase = {
  id: string;
  name: string;
  conversation: string[];
  expectedSummary: string;
  mustPassBeforeCalendar: boolean;
};

export const MINI_VIKTOR_EVALUATION_BANK: MiniViktorEvaluationCase[] = [
  {
    id: "mv-001",
    name: "multi date reminders after event",
    conversation: ["Meeting at 8", "pm", "tomorro", "9 today and 5 tomorro"],
    expectedSummary: "event tomorrow 8 PM; reminders today 9 PM and tomorrow 5 PM",
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-002",
    name: "multiple reminders before event",
    conversation: ["Meeting at 7 pm", "today", "6pm n then 6.30"],
    expectedSummary: "event today 7 PM; reminders today 6 PM and today 6:30 PM",
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-003",
    name: "before event natural phrase",
    conversation: ["Team meeting at 5 pm, remind me half an hour before", "today"],
    expectedSummary: "event today 5 PM; reminder today 4:30 PM",
    mustPassBeforeCalendar: true,
  },
  {
    id: "mv-004",
    name: "event time versus reminder time",
    conversation: ["Lunch with X tomorrow, reminder at 12 and 1 as lunch is at 1.10"],
    expectedSummary: "event tomorrow 1:10 PM; reminders tomorrow 12 PM and tomorrow 1 PM",
    mustPassBeforeCalendar: true,
  },
];

export function getMiniViktorBrainSummary() {
  return {
    version: MINI_VIKTOR_SEED_BRAIN.version,
    guardrails: MINI_VIKTOR_SEED_BRAIN.guardrails.length,
    examples: MINI_VIKTOR_SEED_BRAIN.exampleBank.length,
    evaluationCases: MINI_VIKTOR_EVALUATION_BANK.length,
  };
}
