import {
  cloneDefaultDciState,
  type DciCaseAction,
  type DciCaseState,
  type DciDemoState,
  type DciReviewForm,
} from "../dci-demo-state";
import { demoPatientForBed } from "../demo-patients";
import { DomainError } from "./domain-error";

class DciDemoStore {
  private state = cloneDefaultDciState();

  snapshot(): DciDemoState {
    return { cases: this.state.cases.map(cloneCase) };
  }

  reset(): DciDemoState {
    this.state = cloneDefaultDciState();
    return this.snapshot();
  }

  update(bedValue: unknown, actionValue: unknown, reviewValue: unknown): DciCaseState {
    const bed = typeof bedValue === "string" ? bedValue.trim().toUpperCase() : "";
    const patient = demoPatientForBed(bed);
    if (!patient) throw new DomainError("演示患者不存在", 404, "DCI_CASE_NOT_FOUND");
    const action = parseAction(actionValue);
    const item = this.state.cases.find((candidate) => candidate.bed === bed);
    if (!item) throw new DomainError("演示流程状态不存在", 404, "DCI_STATE_NOT_FOUND");

    if (action === "nurse_review") {
      const review = parseReview(reviewValue);
      if (!review.signalChecked || !review.bedsideChecked || !review.vitalsChecked || !review.medicationChecked) {
        throw new DomainError("请完成四项护士复核后再保存", 422, "DCI_REVIEW_INCOMPLETE");
      }
      item.review = { ...item.review, ...review };
      item.workflowStatus = patient.dci.riskLevel === "green" ? "monitoring" : "doctor_pending";
      addEvent(item, "护士复核已完成", review.nurseNote || "信号质量、床旁状态、生命体征和用药均已复核。", "护士");
    } else if (action === "submit_doctor") {
      if (item.workflowStatus !== "doctor_pending") {
        throw new DomainError("请先完成护士复核", 409, "DCI_NURSE_REVIEW_REQUIRED");
      }
      addEvent(item, "已提交医生确认", "趋势证据、AI解释和护士复核意见已进入医生工作台。", "护士");
    } else if (action === "doctor_confirm") {
      if (item.workflowStatus !== "doctor_pending") {
        throw new DomainError("当前事件尚未进入医生确认", 409, "DCI_DOCTOR_REVIEW_NOT_READY");
      }
      const review = parseReview(reviewValue, false);
      if (!review.doctorNote.trim()) throw new DomainError("请填写医生确认意见", 422, "DCI_DOCTOR_NOTE_REQUIRED");
      item.review = { ...item.review, doctorNote: review.doctorNote, examPlan: review.examPlan };
      item.workflowStatus = "tracking";
      addEvent(item, "医生已确认进入追踪", `${review.doctorNote}${review.examPlan ? `；复核计划：${review.examPlan}` : ""}`, "医生");
    } else if (action === "apply_followup") {
      if (item.workflowStatus !== "tracking" || patient.dci.followupScore === undefined) {
        throw new DomainError("当前病例没有可播放的处置后追踪", 409, "DCI_FOLLOWUP_NOT_READY");
      }
      item.followupApplied = true;
      item.currentRiskScore = patient.dci.followupScore;
      item.currentRiskLabel = "二级 · 黄色追踪";
      item.workflowStatus = "resolved";
      addEvent(item, "风险已降级并继续追踪", patient.dci.followupSummary || "处置后趋势改善。", "系统");
    } else {
      item.reportGenerated = true;
      addEvent(item, "事件报告已生成", "触发、证据、护士复核、医生确认与后续趋势已写入报告。", "系统");
    }

    return cloneCase(item);
  }
}

function addEvent(item: DciCaseState, title: string, detail: string, actor: "系统" | "护士" | "医生") {
  item.events = [
    {
      id: `${item.bed}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      bed: item.bed,
      time: new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()),
      title,
      detail,
      actor,
    },
    ...item.events,
  ].slice(0, 12);
}

function parseAction(value: unknown): DciCaseAction {
  if (value === "nurse_review" || value === "submit_doctor" || value === "doctor_confirm" || value === "apply_followup" || value === "generate_report") return value;
  throw new DomainError("无效的DCI演示操作");
}

function parseReview(value: unknown, requireChecks = true): DciReviewForm {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (!requireChecks) return { ...DEFAULT_EMPTY_REVIEW };
    throw new DomainError("复核内容格式无效");
  }
  const input = value as Record<string, unknown>;
  return {
    signalChecked: Boolean(input.signalChecked),
    bedsideChecked: Boolean(input.bedsideChecked),
    vitalsChecked: Boolean(input.vitalsChecked),
    medicationChecked: Boolean(input.medicationChecked),
    nurseNote: safeText(input.nurseNote, 300),
    doctorNote: safeText(input.doctorNote, 300),
    examPlan: safeText(input.examPlan, 160),
  };
}

const DEFAULT_EMPTY_REVIEW: DciReviewForm = {
  signalChecked: false,
  bedsideChecked: false,
  vitalsChecked: false,
  medicationChecked: false,
  nurseNote: "",
  doctorNote: "",
  examPlan: "",
};

function safeText(value: unknown, maxLength: number) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > maxLength) throw new DomainError("复核文本格式无效");
  return value.trim();
}

function cloneCase(item: DciCaseState): DciCaseState {
  return { ...item, review: { ...item.review }, events: item.events.map((event) => ({ ...event })) };
}

const globalStore = globalThis as typeof globalThis & { __dciDemoStore?: DciDemoStore };
export const dciDemoStore = globalStore.__dciDemoStore ??= new DciDemoStore();
