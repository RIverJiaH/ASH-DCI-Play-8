export type SwallowingRisk = "none_recorded" | "high" | "unknown";
export type PositionRestriction = "none_recorded" | "postoperative_assessment" | "unknown";
export type OralIntakeStatus = "routine_assessment" | "assessment_required" | "unknown";

export type DemoPatientProfile = {
  bed: string;
  scenarioLabel: string;
  summary: string;
  communication: string;
  oralIntake: OralIntakeStatus;
  oralIntakeLabel: string;
  swallowingRisk: SwallowingRisk;
  swallowingRiskLabel: string;
  positionRestriction: PositionRestriction;
  positionRestrictionLabel: string;
};

export const DEMO_PATIENTS: DemoPatientProfile[] = [
  {
    bed: "A01",
    scenarioLabel: "常规表达受限",
    summary: "无法稳定言语表达，当前无特殊饮水或体位限制记录。",
    communication: "无法稳定言语表达",
    oralIntake: "routine_assessment",
    oralIntakeLabel: "按常规护理流程评估",
    swallowingRisk: "none_recorded",
    swallowingRiskLabel: "未记录明显吞咽风险",
    positionRestriction: "none_recorded",
    positionRestrictionLabel: "未记录特殊体位限制",
  },
  {
    bed: "B02",
    scenarioLabel: "吞咽风险",
    summary: "病历场景记录吞咽风险，饮水需求必须由护理人员床旁评估。",
    communication: "无法稳定言语表达",
    oralIntake: "assessment_required",
    oralIntakeLabel: "饮水前需护理评估",
    swallowingRisk: "high",
    swallowingRiskLabel: "吞咽风险高",
    positionRestriction: "none_recorded",
    positionRestrictionLabel: "未记录特殊体位限制",
  },
  {
    bed: "C03",
    scenarioLabel: "术后体位限制",
    summary: "术后体位需要护理评估，不直接生成具体翻身或卧位动作。",
    communication: "无法稳定言语表达",
    oralIntake: "unknown",
    oralIntakeLabel: "饮水状态待护理确认",
    swallowingRisk: "unknown",
    swallowingRiskLabel: "吞咽状态待护理确认",
    positionRestriction: "postoperative_assessment",
    positionRestrictionLabel: "术后体位调整前需评估",
  },
];

export function demoPatientForBed(bed: string): DemoPatientProfile | undefined {
  const normalizedBed = typeof bed === "string" ? bed.trim().toUpperCase() : "";
  return DEMO_PATIENTS.find((patient) => patient.bed === normalizedBed);
}
