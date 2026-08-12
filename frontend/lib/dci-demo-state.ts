import { DEMO_PATIENTS, type DciWorkflowStatus } from "./demo-patients";

export type DciReviewForm = {
  signalChecked: boolean;
  bedsideChecked: boolean;
  vitalsChecked: boolean;
  medicationChecked: boolean;
  nurseNote: string;
  doctorNote: string;
  examPlan: string;
};

export type DciEvent = {
  id: string;
  bed: string;
  time: string;
  title: string;
  detail: string;
  actor: "系统" | "护士" | "医生";
};

export type DciCaseState = {
  bed: string;
  workflowStatus: DciWorkflowStatus;
  currentRiskScore: number;
  currentRiskLabel: string;
  followupApplied: boolean;
  reportGenerated: boolean;
  review: DciReviewForm;
  events: DciEvent[];
};

export type DciDemoState = {
  cases: DciCaseState[];
};

export type DciCaseAction =
  | "nurse_review"
  | "submit_doctor"
  | "doctor_confirm"
  | "apply_followup"
  | "generate_report";

export type DciAgentResponse = {
  source: "deepseek" | "controlled_fallback";
  model: string;
  generatedAt: string;
  trigger: string;
  evidence: string[];
  nurseChecklist: string[];
  doctorSummary: string;
  safetyBoundary: string;
};

const DEFAULT_REVIEW: DciReviewForm = {
  signalChecked: false,
  bedsideChecked: false,
  vitalsChecked: false,
  medicationChecked: false,
  nurseNote: "",
  doctorNote: "",
  examPlan: "",
};

export function cloneDefaultDciState(): DciDemoState {
  return {
    cases: DEMO_PATIENTS.map((patient) => ({
      bed: patient.bed,
      workflowStatus: patient.dci.initialWorkflow,
      currentRiskScore: patient.dci.riskScore,
      currentRiskLabel: patient.dci.riskLabel,
      followupApplied: false,
      reportGenerated: false,
      review: { ...DEFAULT_REVIEW },
      events: [
        {
          id: `${patient.bed}-signal`,
          bed: patient.bed,
          time: patient.bed === "A01" ? "09:00" : patient.bed === "B02" ? "10:16" : "11:42",
          title: patient.dci.riskLevel === "green" ? "稳定窗口已记录" : `${patient.dci.riskLabel}已触发`,
          detail: patient.dci.agent.trigger,
          actor: "系统",
        },
      ],
    })),
  };
}
