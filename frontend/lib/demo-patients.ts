export type SwallowingRisk = "none_recorded" | "high" | "unknown";
export type PositionRestriction = "none_recorded" | "postoperative_assessment" | "unknown";
export type OralIntakeStatus = "routine_assessment" | "assessment_required" | "unknown";
export type MotorFunctionStatus = "independent" | "limb_disability" | "postoperative_limited" | "unknown";
export type DciRiskLevel = "green" | "yellow" | "red";
export type DciWorkflowStatus = "monitoring" | "nurse_pending" | "doctor_pending" | "tracking" | "resolved";

export type QeegPoint = {
  day: string;
  alpha: number;
  beta: number;
  delta: number;
  adr: number;
  dar: number;
  pav: number;
  rav: number;
  asymmetry: number;
  entropy: number;
  quality: number;
  score: number;
};

export type EvidenceCard = {
  id: "eeg" | "tcd" | "fnirs" | "vitals" | "imaging";
  title: string;
  subtitle: string;
  status: string;
  statusTone: "stable" | "watch" | "alert";
  headline: string;
  description: string;
  metrics: Array<{ label: string; value: string }>;
};

export type AgentAnalysis = {
  trigger: string;
  evidence: string[];
  nurseChecklist: string[];
  doctorSummary: string;
  safetyBoundary: string;
};

export type DciDemoProfile = {
  stageDay: number;
  stageLabel: string;
  riskScore: number;
  riskLevel: DciRiskLevel;
  riskLabel: string;
  alertLabel: string;
  baselineWindow: string;
  abnormalDuration: string;
  signalGate: "passed" | "blocked";
  signalQuality: number;
  affectedChannels: string[];
  qeeg: QeegPoint[];
  scoreBreakdown: Array<{ label: string; points: number; detail: string }>;
  evidenceScore: number;
  evidence: EvidenceCard[];
  agent: AgentAnalysis;
  initialWorkflow: DciWorkflowStatus;
  followupScore?: number;
  followupSummary?: string;
};

export type DemoPatientProfile = {
  bed: string;
  patientCode: string;
  age: string;
  sex: string;
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
  motorFunction: MotorFunctionStatus;
  motorFunctionLabel: string;
  careNotes: string[];
  dci: DciDemoProfile;
};

const SAFETY_BOUNDARY = "本结果仅用于SAH后DCI风险趋势提示和医护复核辅助，不构成诊断、医嘱或治疗决定；最终判断与处置由医护人员完成。";

export const DEMO_PATIENTS: DemoPatientProfile[] = [
  {
    bed: "A01",
    patientCode: "模拟患者 A",
    age: "57岁",
    sex: "女",
    admissionSummary: "左侧大脑中动脉瘤栓塞术后第4天，处于DCI高风险窗口内连续监测。",
    diagnoses: ["动脉瘤性蛛网膜下腔出血（模拟）", "左侧大脑中动脉瘤栓塞术后（模拟）"],
    allergies: "未记录特殊过敏（模拟）",
    scenarioLabel: "稳定监测",
    summary: "个人基线稳定，alpha、beta与ADR轻微生理波动，左右半球差异未扩大；质量门控通过且不触发报警。",
    communication: "清醒，可简单配合；录制时也可演示脑控表达入口",
    communicationSupport: "可通过脑控候选项完成需求分层确认",
    oralIntake: "routine_assessment",
    oralIntakeLabel: "按常规护理流程评估",
    swallowingRisk: "none_recorded",
    swallowingRiskLabel: "未记录明显吞咽风险",
    positionRestriction: "none_recorded",
    positionRestrictionLabel: "未记录特殊体位限制",
    motorFunction: "independent",
    motorFunctionLabel: "四肢活动按常规神经查体评估",
    careNotes: ["继续记录qEEG趋势，不因单次轻微波动升级", "每班核对电极接触、意识状态和生命体征"],
    dci: {
      stageDay: 4,
      stageLabel: "稳定型 · 低误报验证",
      riskScore: 1,
      riskLevel: "green",
      riskLabel: "一级 · 绿色低风险",
      alertLabel: "继续监测，不报警",
      baselineWindow: "术后第1-2天个人基线",
      abnormalDuration: "未形成持续异常",
      signalGate: "passed",
      signalQuality: 96,
      affectedChannels: [],
      qeeg: [
        { day: "D1", alpha: 100, beta: 100, delta: 100, adr: 5.0, dar: 0.20, pav: 8.2, rav: 7.9, asymmetry: 3, entropy: 0.82, quality: 96, score: 0 },
        { day: "D2", alpha: 99, beta: 101, delta: 101, adr: 4.9, dar: 0.21, pav: 8.1, rav: 7.8, asymmetry: 3, entropy: 0.81, quality: 95, score: 1 },
        { day: "D3", alpha: 101, beta: 99, delta: 100, adr: 5.1, dar: 0.20, pav: 8.3, rav: 8.0, asymmetry: 4, entropy: 0.82, quality: 97, score: 1 },
        { day: "D4", alpha: 100, beta: 100, delta: 102, adr: 5.0, dar: 0.20, pav: 8.2, rav: 7.9, asymmetry: 4, entropy: 0.81, quality: 96, score: 1 },
      ],
      scoreBreakdown: [
        { label: "ADR变化", points: 0, detail: "相对基线0%，保持稳定" },
        { label: "慢波变化", points: 0, detail: "delta仅生理波动" },
        { label: "半球差异", points: 0, detail: "4%，未扩大" },
        { label: "持续性", points: 0, detail: "未形成持续异常" },
        { label: "基础观察", points: 1, detail: "处于第3-14天风险窗口" },
      ],
      evidenceScore: 1,
      evidence: [
        { id: "eeg", title: "EEG/qEEG", subtitle: "BCI核心输入", status: "基线稳定", statusTone: "stable", headline: "alpha 100%，ADR 5.0", description: "与个人基线比较趋势稳定，作为本系统核心BCI输入。", metrics: [{ label: "alpha", value: "100%" }, { label: "ADR", value: "5.0" }] },
        { id: "tcd", title: "TCD", subtitle: "脑血流趋势", status: "血流稳定", statusTone: "stable", headline: "MCA 92 cm/s，LI 2.1", description: "模拟TCD未提示明显血管痉挛，作为低风险佐证。", metrics: [{ label: "MCA", value: "92 cm/s" }, { label: "LI", value: "2.1" }] },
        { id: "fnirs", title: "fNIRS", subtitle: "脑氧趋势", status: "脑氧稳定", statusTone: "stable", headline: "左68% / 右69%", description: "模拟脑氧未见下降或明显左右不对称。", metrics: [{ label: "左rSO2", value: "68%" }, { label: "右rSO2", value: "69%" }] },
        { id: "vitals", title: "生命体征/用药", subtitle: "排除假阳性", status: "无干扰", statusTone: "stable", headline: "MAP 86，SpO2 98%", description: "生命体征平稳，镇静方案未变化，未见低氧、低血压或镇静变化解释脑电异常。", metrics: [{ label: "MAP", value: "86" }, { label: "SpO2", value: "98%" }] },
        { id: "imaging", title: "影像报告", subtitle: "医学复核终点", status: "暂不触发", statusTone: "stable", headline: "未触发CTA/CTP复核", description: "低风险阶段仅保留影像复核入口，不作为诊断输出。", metrics: [{ label: "CTA", value: "未触发" }, { label: "CTP", value: "未触发" }] },
      ],
      agent: {
        trigger: "质量门控通过；alpha、ADR与慢波趋势相对个人基线稳定，循证规则积分1分，未达到预警阈值。",
        evidence: ["ADR 5.0，未见持续下降", "delta相对基线102%，无显著慢化", "半球不对称4%，未扩大", "TCD、fNIRS与生命体征稳定"],
        nurseChecklist: ["继续核对电极接触和通道质量", "按班次记录意识状态与生命体征", "出现新发神经功能变化时人工升级复核"],
        doctorSummary: "A01术后第4天，qEEG相对个人基线稳定，风险积分1分，当前绿色低风险，不触发额外检查任务，继续常规监测。",
        safetyBoundary: SAFETY_BOUNDARY,
      },
      initialWorkflow: "monitoring",
    },
  },
  {
    bed: "B02",
    patientCode: "模拟患者 B",
    age: "63岁",
    sex: "男",
    admissionSummary: "右侧后交通动脉瘤夹闭术后第3天，qEEG早期趋势开始偏离个人基线。",
    diagnoses: ["动脉瘤性蛛网膜下腔出血（模拟）", "右侧后交通动脉瘤夹闭术后（模拟）"],
    allergies: "青霉素过敏史（模拟）",
    scenarioLabel: "早期趋势提示",
    summary: "第3天检测到alpha、ADR和PAV同向下降，信号质量合格，风险积分进入3-5分黄色区间，生成护士复核任务。",
    communication: "嗜睡，可唤醒并简单配合",
    communicationSupport: "床旁复核时采用短指令和脑控候选辅助表达",
    oralIntake: "assessment_required",
    oralIntakeLabel: "进食前需护理评估",
    swallowingRisk: "unknown",
    swallowingRiskLabel: "吞咽状态待床旁复核",
    positionRestriction: "none_recorded",
    positionRestrictionLabel: "未记录特殊体位限制",
    motorFunction: "limb_disability",
    motorFunctionLabel: "右侧肢体失能，需协助摆位和取物",
    careNotes: ["优先排查电极接触、体动、肌电和护理操作", "核对意识、瞳孔、肢体、MAP、SpO2、体温、用药及TCD安排"],
    dci: {
      stageDay: 3,
      stageLabel: "轻度风险型 · 早期趋势",
      riskScore: 4,
      riskLevel: "yellow",
      riskLabel: "二级 · 黄色预警",
      alertLabel: "已生成护士复核任务",
      baselineWindow: "术后第1天个人基线",
      abnormalDuration: "连续2个窗口 · 约65分钟",
      signalGate: "passed",
      signalQuality: 91,
      affectedChannels: ["C3", "O1"],
      qeeg: [
        { day: "D1", alpha: 100, beta: 100, delta: 100, adr: 4.8, dar: 0.21, pav: 8.4, rav: 8.1, asymmetry: 5, entropy: 0.80, quality: 94, score: 1 },
        { day: "D2", alpha: 91, beta: 98, delta: 108, adr: 4.2, dar: 0.26, pav: 7.8, rav: 7.9, asymmetry: 8, entropy: 0.77, quality: 93, score: 2 },
        { day: "D3", alpha: 78, beta: 96, delta: 121, adr: 3.7, dar: 0.33, pav: 6.9, rav: 7.4, asymmetry: 12, entropy: 0.73, quality: 91, score: 4 },
      ],
      scoreBreakdown: [
        { label: "ADR变化", points: 1, detail: "较基线下降23%，达到人工复核区间" },
        { label: "alpha变化", points: 1, detail: "较基线下降22%" },
        { label: "PAV变化", points: 1, detail: "8.4降至6.9" },
        { label: "持续性", points: 1, detail: "连续2个质量合格窗口" },
        { label: "半球差异", points: 0, detail: "12%，尚未达到高风险规则" },
      ],
      evidenceScore: 3,
      evidence: [
        { id: "eeg", title: "EEG/qEEG", subtitle: "BCI核心输入", status: "趋势异常", statusTone: "watch", headline: "alpha -22%，ADR -23%", description: "连续两个质量合格窗口同向下降，首先触发风险复核。", metrics: [{ label: "ADR", value: "3.7" }, { label: "PAV", value: "6.9" }] },
        { id: "tcd", title: "TCD", subtitle: "脑血流趋势", status: "待复核", statusTone: "watch", headline: "MCA 128 cm/s，LI 2.7", description: "流速较基线上升但未作为单独诊断依据，建议结合复查趋势。", metrics: [{ label: "MCA", value: "128 cm/s" }, { label: "LI", value: "2.7" }] },
        { id: "fnirs", title: "fNIRS", subtitle: "脑氧趋势", status: "轻度下降", statusTone: "watch", headline: "左62% / 右66%", description: "左侧rSO2轻度下降，方向与qEEG变化基本一致。", metrics: [{ label: "左rSO2", value: "62%" }, { label: "右rSO2", value: "66%" }] },
        { id: "vitals", title: "生命体征/用药", subtitle: "排除假阳性", status: "需核查", statusTone: "watch", headline: "MAP 82，SpO2 97%", description: "未见明显低氧或低血压；需护士确认发热、镇静调整和护理操作。", metrics: [{ label: "MAP", value: "82" }, { label: "SpO2", value: "97%" }] },
        { id: "imaging", title: "影像报告", subtitle: "医学复核终点", status: "保留入口", statusTone: "watch", headline: "CTA/CTP尚未复查", description: "系统仅提示医生结合病程决定是否安排辅助检查。", metrics: [{ label: "CTA", value: "待医生判断" }, { label: "CTP", value: "待医生判断" }] },
      ],
      agent: {
        trigger: "第3天出现alpha、ADR和PAV持续同向下降；质量分91，排除低质量窗口后循证规则积分4分，触发黄色复核提示。",
        evidence: ["alpha较个人基线下降22%", "ADR由4.8降至3.7，下降23%", "PAV由8.4降至6.9", "异常持续约65分钟，TCD流速较基线上升"],
        nurseChecklist: ["复核C3/O1电极接触及阻抗，排除体动、眼动、肌电和护理操作", "记录意识、瞳孔、肢体活动及新发主诉", "核对MAP、SpO2、体温、镇静与血管活性药物变化", "确认TCD或影像复查计划并提交复核意见"],
        doctorSummary: "B02术后第3天，质量合格窗口内alpha/ADR/PAV连续下降约65分钟，风险积分4分（黄色）。生命体征无明显低氧或低血压，TCD MCA 128 cm/s、LI 2.7。建议结合床旁神经查体与后续TCD趋势复核。",
        safetyBoundary: SAFETY_BOUNDARY,
      },
      initialWorkflow: "nurse_pending",
    },
  },
  {
    bed: "C03",
    patientCode: "模拟患者 C",
    age: "61岁",
    sex: "女",
    admissionSummary: "左侧大脑中动脉瘤栓塞术后第5天，多项qEEG指标持续恶化并呈左右不对称。",
    diagnoses: ["动脉瘤性蛛网膜下腔出血（模拟）", "左侧大脑中动脉瘤栓塞术后（模拟）"],
    allergies: "未记录特殊过敏（模拟）",
    scenarioLabel: "完整预警流程",
    summary: "第5天ADR大幅下降、delta慢波上升和半球不对称扩大，质量门控通过，积分达到红色预警并进入完整医护闭环。",
    communication: "镇静减量后意识波动，神经查体配合受限",
    communicationSupport: "以客观脑功能趋势和床旁复核共同补充间断查体",
    oralIntake: "unknown",
    oralIntakeLabel: "经口进食状态待床旁临床评估（模拟状态）",
    swallowingRisk: "unknown",
    swallowingRiskLabel: "吞咽状态待床旁人工评估",
    positionRestriction: "postoperative_assessment",
    positionRestrictionLabel: "术后体位调整前需评估",
    motorFunction: "postoperative_limited",
    motorFunctionLabel: "右侧肢体反应减弱，需医生复核",
    careNotes: ["先确认质量门控和混杂因素，再升级医生复核", "保留触发时间、指标变化、复核意见、处置记录和后续降级轨迹"],
    dci: {
      stageDay: 5,
      stageLabel: "持续恶化型 · 完整闭环",
      riskScore: 8,
      riskLevel: "red",
      riskLabel: "三级 · 红色预警",
      alertLabel: "高优先级 · 需医生确认",
      baselineWindow: "术后第1-2天个人基线",
      abnormalDuration: "连续5个窗口 · 约2小时35分钟",
      signalGate: "passed",
      signalQuality: 88,
      affectedChannels: ["F3", "C3", "O1"],
      qeeg: [
        { day: "D1", alpha: 100, beta: 100, delta: 100, adr: 4.9, dar: 0.20, pav: 8.5, rav: 8.2, asymmetry: 6, entropy: 0.81, quality: 94, score: 1 },
        { day: "D2", alpha: 94, beta: 98, delta: 108, adr: 4.3, dar: 0.25, pav: 7.9, rav: 7.8, asymmetry: 9, entropy: 0.78, quality: 92, score: 2 },
        { day: "D3", alpha: 82, beta: 94, delta: 124, adr: 3.5, dar: 0.35, pav: 7.0, rav: 7.2, asymmetry: 16, entropy: 0.72, quality: 91, score: 4 },
        { day: "D4", alpha: 69, beta: 90, delta: 146, adr: 2.7, dar: 0.54, pav: 6.1, rav: 6.7, asymmetry: 27, entropy: 0.65, quality: 90, score: 6 },
        { day: "D5", alpha: 58, beta: 86, delta: 171, adr: 2.1, dar: 0.81, pav: 5.2, rav: 6.1, asymmetry: 39, entropy: 0.58, quality: 88, score: 8 },
      ],
      scoreBreakdown: [
        { label: "ADR变化", points: 2, detail: "由4.9降至2.1，下降57%" },
        { label: "慢波变化", points: 2, detail: "delta较基线上升71%" },
        { label: "半球差异", points: 2, detail: "由6%扩大至39%" },
        { label: "持续性", points: 1, detail: "连续5个质量合格窗口" },
        { label: "多指标一致性", points: 1, detail: "qEEG、TCD与fNIRS方向一致" },
      ],
      evidenceScore: 5,
      evidence: [
        { id: "eeg", title: "EEG/qEEG", subtitle: "BCI核心输入", status: "持续恶化", statusTone: "alert", headline: "ADR -57%，delta +71%", description: "5个质量合格窗口持续异常，且左侧通道变化更明显。", metrics: [{ label: "ADR", value: "2.1" }, { label: "不对称", value: "39%" }] },
        { id: "tcd", title: "TCD", subtitle: "脑血流趋势", status: "高度关注", statusTone: "alert", headline: "MCA 186 cm/s，LI 3.6", description: "模拟TCD血流速度及LI升高，支持优先临床复核。", metrics: [{ label: "MCA", value: "186 cm/s" }, { label: "LI", value: "3.6" }] },
        { id: "fnirs", title: "fNIRS", subtitle: "脑氧趋势", status: "左侧下降", statusTone: "alert", headline: "左54% / 右65%", description: "左侧脑氧下降且不对称，与左半球qEEG变化方向一致。", metrics: [{ label: "左rSO2", value: "54%" }, { label: "右rSO2", value: "65%" }] },
        { id: "vitals", title: "生命体征/用药", subtitle: "排除假阳性", status: "已初筛", statusTone: "watch", headline: "MAP 84，SpO2 98%", description: "未见明显低氧或低血压；镇静已减量但不能完全解释持续单侧趋势。", metrics: [{ label: "MAP", value: "84" }, { label: "SpO2", value: "98%" }] },
        { id: "imaging", title: "影像报告", subtitle: "医学复核终点", status: "待医生确认", statusTone: "alert", headline: "CTA/CTP复核入口已开启", description: "系统生成交接摘要，由医生决定是否安排影像或其他检查。", metrics: [{ label: "CTA", value: "待确认" }, { label: "CTP", value: "待确认" }] },
      ],
      agent: {
        trigger: "第5天ADR下降57%、delta升高71%、半球不对称扩大至39%，异常持续约2小时35分钟；信号质量88分，循证规则积分8分，触发红色预警。",
        evidence: ["ADR由4.9降至2.1", "delta较个人基线上升71%", "左/右半球不对称由6%扩大至39%", "TCD MCA 186 cm/s、LI 3.6", "左侧rSO2 54%，生命体征未见明显低氧或低血压"],
        nurseChecklist: ["立即复核F3/C3/O1电极接触与原始波形，排除单侧电极问题", "记录意识、瞳孔、语言、肢体反应和新发症状", "核对MAP、SpO2、体温、血糖、镇静及护理操作", "完成护士复核意见并升级医生确认"],
        doctorSummary: "C03术后第5天，质量合格窗口内ADR下降57%、delta升高71%、半球不对称扩大至39%，持续约2小时35分钟，规则积分8分（红色）。TCD MCA 186 cm/s、LI 3.6，左侧rSO2 54%，当前未见明显低氧或低血压。请结合床旁神经评估及院内流程判断是否进一步安排TCD、CTA或CTP复核。",
        safetyBoundary: SAFETY_BOUNDARY,
      },
      initialWorkflow: "nurse_pending",
      followupScore: 3,
      followupSummary: "处置后模拟回放：alpha恢复至76%，ADR回升至3.5，delta下降，不对称缩小至18%；风险降至3分黄色追踪，原红色事件完整保留。",
    },
  },
];

export function demoPatientForBed(bed: string): DemoPatientProfile | undefined {
  const normalizedBed = typeof bed === "string" ? bed.trim().toUpperCase() : "";
  return DEMO_PATIENTS.find((patient) => patient.bed === normalizedBed);
}
