export type SwallowingRisk = "none_recorded" | "high" | "unknown";
export type PositionRestriction = "none_recorded" | "postoperative_assessment" | "unknown";
export type OralIntakeStatus = "routine_assessment" | "assessment_required" | "unknown";

export type DemoPatientProfile = {
  bed: string;
  patientCode: string;
  age: string;
  admissionSummary: string;
  diagnoses: string[];
  allergies: string;
  scenarioLabel: string;
  summary: string;
  communication: string;
  communicationSupport: string;
  oralIntake: OralIntakeStatus;
  oralIntakeLabel: string;
  swallowingRisk: SwallowingRisk;
  swallowingRiskLabel: string;
  positionRestriction: PositionRestriction;
  positionRestrictionLabel: string;
  careNotes: string[];
};

export const DEMO_PATIENTS: DemoPatientProfile[] = [
  {
    bed: "A01",
    patientCode: "演示患者 A",
    age: "62岁",
    admissionSummary: "神经系统疾病恢复期，存在稳定表达困难。",
    diagnoses: ["脑卒中恢复期（模拟）", "表达能力受限（模拟）"],
    allergies: "未记录特殊过敏（模拟）",
    scenarioLabel: "常规表达受限",
    summary: "无法稳定言语表达，当前无特殊饮水或体位限制记录。",
    communication: "无法稳定言语表达",
    communicationSupport: "可通过脑控候选项进行分层确认",
    oralIntake: "routine_assessment",
    oralIntakeLabel: "按常规护理流程评估",
    swallowingRisk: "none_recorded",
    swallowingRiskLabel: "未记录明显吞咽风险",
    positionRestriction: "none_recorded",
    positionRestrictionLabel: "未记录特殊体位限制",
    careNotes: ["需求发送后由护理人员床旁核实", "紧急不适直接生成高优先级护理任务"],
  },
  {
    bed: "B02",
    patientCode: "演示患者 B",
    age: "68岁",
    admissionSummary: "脑卒中后恢复观察，病历记录吞咽风险。",
    diagnoses: ["脑卒中恢复期（模拟）", "吞咽功能异常风险（模拟）"],
    allergies: "未记录特殊过敏（模拟）",
    scenarioLabel: "吞咽风险",
    summary: "病历场景记录吞咽风险，饮水需求必须由护理人员床旁评估。",
    communication: "无法稳定言语表达",
    communicationSupport: "可完成简单需求选择，饮水相关需求需风险拦截",
    oralIntake: "assessment_required",
    oralIntakeLabel: "饮水前需护理评估",
    swallowingRisk: "high",
    swallowingRiskLabel: "吞咽风险高",
    positionRestriction: "none_recorded",
    positionRestrictionLabel: "未记录特殊体位限制",
    careNotes: ["饮水、漱口等入口需求先由护理人员评估", "系统不得直接生成饮水执行动作"],
  },
  {
    bed: "C03",
    patientCode: "演示患者 C",
    age: "55岁",
    admissionSummary: "颅脑术后恢复观察，体位调整存在限制。",
    diagnoses: ["颅脑术后恢复期（模拟）", "体位调整限制（模拟）"],
    allergies: "未记录特殊过敏（模拟）",
    scenarioLabel: "术后体位限制",
    summary: "术后体位需要护理评估，不直接生成具体翻身或卧位动作。",
    communication: "无法稳定言语表达",
    communicationSupport: "可完成简单需求选择，具体体位动作需护理判断",
    oralIntake: "unknown",
    oralIntakeLabel: "饮水状态待护理确认",
    swallowingRisk: "unknown",
    swallowingRiskLabel: "吞咽状态待护理确认",
    positionRestriction: "postoperative_assessment",
    positionRestrictionLabel: "术后体位调整前需评估",
    careNotes: ["不直接生成左侧卧、右侧卧等具体动作", "体位需求统一转护理人员床旁评估"],
  },
];

export function demoPatientForBed(bed: string): DemoPatientProfile | undefined {
  const normalizedBed = typeof bed === "string" ? bed.trim().toUpperCase() : "";
  return DEMO_PATIENTS.find((patient) => patient.bed === normalizedBed);
}
