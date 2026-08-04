import type { CareOption } from "../brain-care";
import type { DemoPatientProfile } from "../demo-patients";

type ApprovedOptionGroup = {
  question: string;
  stepLabel: string;
  options: CareOption[];
};

const option = (
  id: string,
  intentCode: string,
  label: string,
  taskText: string,
  riskLevel: CareOption["riskLevel"] = "normal",
  terminal = false,
): CareOption => ({
  id,
  intentCode,
  label,
  taskText,
  riskLevel,
  actionMode: "request_only",
  terminal,
  nextAction: terminal ? "confirm_task" : "clarify",
  nextActionReason: terminal
    ? "当前意图已经明确，可进入护理任务确认。"
    : "当前意图仍需细化，继续生成一层受控引导选项。",
});

const APPROVED_GROUPS: Record<string, ApprovedOptionGroup> = {
  "category.basic_care": {
    question: "当前最需要哪类基本照护？",
    stepLabel: "照护类型",
    options: [
      option("care-pain", "care.pain", "疼痛不适", "患者报告疼痛不适", "attention"),
      option("care-hydration", "care.hydration", "饮水/进食", "患者需要饮水或进食", "normal", true),
      option("care-position", "care.position", "调整体位", "患者需要协助调整体位", "normal", true),
    ],
  },
  "category.environment": {
    question: "需要护理人员协助调整什么？",
    stepLabel: "设备类型",
    options: [
      option("environment-light", "environment.light", "灯光", "患者提出灯光调整请求"),
      option("environment-curtain", "environment.curtain", "窗帘", "患者提出窗帘调整请求"),
      option("environment-climate", "environment.climate", "空调温度", "患者提出空调温度调整请求"),
    ],
  },
  "category.communication": {
    question: "需要哪一种交流协助？",
    stepLabel: "交流类型",
    options: [
      option("communication-care", "communication.call_care", "呼叫护理人员", "患者请求护理人员前来"),
      option("communication-family", "communication.contact_family", "联系家属", "患者希望联系家属"),
      option("communication-support", "communication.support", "协助表达", "患者需要进一步交流协助"),
    ],
  },
  "care.pain": {
    question: "请进一步确认疼痛情况",
    stepLabel: "具体需求",
    options: [
      option("pain-abdominal", "care.pain.abdominal", "腹部持续重痛", "腹部重度持续疼痛", "urgent", true),
      option("pain-chest", "care.pain.chest", "胸部持续疼痛", "胸部持续疼痛", "urgent", true),
      option("pain-head-limb", "care.pain.other", "头部或四肢痛", "头部或四肢疼痛", "attention", true),
    ],
  },
  "care.hydration": {
    question: "请确认需要的照护内容",
    stepLabel: "具体需求",
    options: [
      option("hydration-water", "care.hydration.water", "少量饮水", "需要少量饮水", "normal", true),
      option("hydration-lips", "care.hydration.lips", "润唇", "需要协助润唇", "normal", true),
      option("hydration-rinse", "care.hydration.rinse", "漱口", "需要协助漱口", "normal", true),
    ],
  },
  "care.position": {
    question: "请确认希望调整的体位",
    stepLabel: "具体需求",
    options: [
      option("position-head", "care.position.raise_head", "抬高床头", "需要协助抬高床头", "attention", true),
      option("position-left", "care.position.left", "左侧卧", "需要协助调整为左侧卧", "attention", true),
      option("position-right", "care.position.right", "右侧卧", "需要协助调整为右侧卧", "attention", true),
    ],
  },
  "environment.light": {
    question: "请确认灯光调整请求",
    stepLabel: "具体请求",
    options: [
      option("light-on", "environment.light.on", "打开主灯", "请求护理人员打开主灯"),
      option("light-off", "environment.light.off", "关闭主灯", "请求护理人员关闭主灯"),
      option("light-dim", "environment.light.dim", "调暗灯光", "请求护理人员调暗灯光"),
    ],
  },
  "environment.curtain": {
    question: "请确认窗帘调整请求",
    stepLabel: "具体请求",
    options: [
      option("curtain-open", "environment.curtain.open", "打开窗帘", "请求护理人员打开窗帘"),
      option("curtain-close", "environment.curtain.close", "关闭窗帘", "请求护理人员关闭窗帘"),
      option("curtain-half", "environment.curtain.half", "调整到一半", "请求护理人员将窗帘调整到一半"),
    ],
  },
  "environment.climate": {
    question: "请确认温度调整请求",
    stepLabel: "具体请求",
    options: [
      option("climate-warmer", "environment.climate.warmer", "调高温度", "请求护理人员调高空调温度"),
      option("climate-cooler", "environment.climate.cooler", "调低温度", "请求护理人员调低空调温度"),
      option("climate-off", "environment.climate.off", "关闭空调", "请求护理人员关闭空调"),
    ],
  },
  "communication.call_care": {
    question: "请确认希望护理人员何时前来",
    stepLabel: "具体需求",
    options: [
      option("call-care-now", "communication.call_care.now", "请立即前来", "请求护理人员立即前来", "attention"),
      option("call-care-soon", "communication.call_care.soon", "请尽快前来", "请求护理人员尽快前来", "attention"),
      option("call-care-later", "communication.call_care.later", "方便时前来", "请求护理人员方便时前来"),
    ],
  },
  "communication.contact_family": {
    question: "请确认希望如何联系家属",
    stepLabel: "具体需求",
    options: [
      option("family-phone", "communication.family.phone", "电话联系", "希望通过电话联系家属"),
      option("family-video", "communication.family.video", "视频联系", "希望通过视频联系家属"),
      option("family-message", "communication.family.message", "转达消息", "希望护理人员向家属转达消息"),
    ],
  },
  "communication.support": {
    question: "请确认需要的表达协助",
    stepLabel: "具体需求",
    options: [
      option("support-board", "communication.support.board", "使用沟通板", "需要使用沟通板继续表达"),
      option("support-question", "communication.support.question", "逐项提问", "希望护理人员通过逐项提问协助表达"),
      option("support-in-person", "communication.support.in_person", "当面沟通", "希望护理人员前来当面沟通"),
    ],
  },
};

export function approvedOptionsFor(
  parentIntentCode: string,
  patient?: DemoPatientProfile,
): ApprovedOptionGroup | undefined {
  const group = APPROVED_GROUPS[parentIntentCode];
  if (!group) return undefined;
  const options = group.options.map((item) => ({
    ...item,
    evidence: item.evidence ? [...item.evidence] : undefined,
  }));

  if (parentIntentCode === "category.basic_care" && patient?.swallowingRisk === "high") {
    const hydrationIndex = options.findIndex((item) => item.id === "care-hydration");
    if (hydrationIndex >= 0) {
      options[hydrationIndex] = {
        ...options[hydrationIndex],
        id: "care-hydration-assessment",
        intentCode: "care.hydration.assessment",
        label: "口腔湿润评估",
        taskText: "患者提出口干或饮水相关需求，存在吞咽风险，需护理人员评估口腔湿润方案",
        riskLevel: "attention",
        riskNotice: "记录存在吞咽风险，不直接生成饮水动作。",
        evidence: [patient.swallowingRiskLabel, patient.oralIntakeLabel],
        safetyRule: "HYDRATION_REQUIRES_NURSE_ASSESSMENT",
        nextAction: "confirm_task",
        nextActionReason: "模拟病历已记录吞咽风险，不再追问饮水动作，直接生成护理评估任务。",
      };
    }
    const positionIndex = options.findIndex((item) => item.id === "care-position");
    if (positionIndex >= 0) {
      options[positionIndex] = {
        ...options[positionIndex],
        id: "care-swallowing-assessment",
        intentCode: "care.swallowing.assessment",
        label: "吞咽安全评估",
        taskText: "患者表达吞咽或口腔相关不适，因病历记录吞咽风险高，需护理人员先做吞咽安全评估",
        riskLevel: "attention",
        riskNotice: "病历记录吞咽风险高，相关入口统一转为护理评估。",
        evidence: [patient.swallowingRiskLabel, patient.oralIntakeLabel],
        safetyRule: "SWALLOWING_REQUIRES_NURSE_ASSESSMENT",
        terminal: true,
        nextAction: "confirm_task",
        nextActionReason: "模拟病历提示吞咽风险，本轮提供吞咽安全评估选项，不生成直接饮水或进食动作。",
      };
    }
  }

  if (parentIntentCode === "category.basic_care" && patient?.motorFunction === "limb_disability") {
    const hydrationIndex = options.findIndex((item) => item.id === "care-hydration");
    if (hydrationIndex >= 0) {
      options[hydrationIndex] = {
        ...options[hydrationIndex],
        id: "care-feeding-assist",
        intentCode: "care.feeding.assist",
        label: "饮水/进食协助",
        taskText: "患者因肢体失能提出饮水或进食协助需求，需护理人员床旁协助并确认安全",
        riskLevel: "attention",
        riskNotice: "病历记录肢体失能，患者可能无法自行取杯、持勺或完成进食动作。",
        evidence: [patient.motorFunctionLabel, patient.oralIntakeLabel],
        safetyRule: "LIMB_DISABILITY_REQUIRES_ASSISTED_FEEDING",
        terminal: true,
        nextAction: "confirm_task",
        nextActionReason: "模拟病历提示肢体失能，饮水/进食不再作为普通自理需求，直接生成护理协助任务。",
      };
    }
    const positionIndex = options.findIndex((item) => item.id === "care-position");
    if (positionIndex >= 0) {
      options[positionIndex] = {
        ...options[positionIndex],
        id: "care-limb-positioning",
        intentCode: "care.position.limb_support",
        label: "肢体摆位协助",
        taskText: "患者因肢体失能提出体位或肢体摆放协助需求，需护理人员床旁确认",
        riskLevel: "attention",
        riskNotice: "病历记录右侧肢体失能，体位和患侧肢体摆放需人工协助确认。",
        evidence: [patient.motorFunctionLabel, patient.communicationSupport],
        safetyRule: "LIMB_POSITION_REQUIRES_NURSE_ASSISTANCE",
        terminal: true,
        nextAction: "confirm_task",
        nextActionReason: "模拟病历提示肢体失能，体位需求直接转为肢体摆位协助任务。",
      };
    }
  }

  if (parentIntentCode === "category.basic_care" && patient?.oralIntake === "unknown") {
    const hydrationIndex = options.findIndex((item) => item.id === "care-hydration");
    if (hydrationIndex >= 0) {
      options[hydrationIndex] = {
        ...options[hydrationIndex],
        id: "care-oral-intake-check",
        intentCode: "care.oral_intake.assessment",
        label: "口腔状态确认",
        taskText: "患者提出口腔或饮水相关需求，当前饮水状态待确认，需护理人员评估",
        riskLevel: "attention",
        riskNotice: "饮水状态未确认，不直接生成饮水动作。",
        evidence: [patient.oralIntakeLabel, patient.swallowingRiskLabel],
        safetyRule: "ORAL_INTAKE_REQUIRES_NURSE_CONFIRMATION",
        terminal: true,
        nextAction: "confirm_task",
        nextActionReason: "模拟病历未确认饮水状态，口腔相关需求转为护理确认任务。",
      };
    }
  }

  if (
    parentIntentCode === "category.basic_care"
    && patient?.positionRestriction === "postoperative_assessment"
  ) {
    const positionIndex = options.findIndex((item) => item.id === "care-position");
    if (positionIndex >= 0) {
      options[positionIndex] = {
        ...options[positionIndex],
        id: "care-position-assessment",
        intentCode: "care.position.assessment",
        label: "体位调整需评估",
        taskText: "患者提出体位调整需求，存在术后体位限制，需护理人员评估",
        riskLevel: "attention",
        riskNotice: "记录存在术后体位限制，不直接生成具体卧位动作。",
        evidence: [patient.positionRestrictionLabel, patient.communication],
        safetyRule: "POSITION_REQUIRES_NURSE_ASSESSMENT",
        nextAction: "confirm_task",
        nextActionReason: "模拟病历已记录术后体位限制，不再追问具体卧位，直接生成护理评估任务。",
      };
    }
  }

  if (parentIntentCode === "care.pain" && patient?.swallowingRisk === "high") {
    options[0] = {
      ...options[0],
      id: "pain-throat-mouth",
      intentCode: "care.pain.throat_mouth",
      label: "咽喉口腔不适",
      taskText: "患者表达咽喉或口腔不适，存在吞咽风险，需护理人员评估",
      riskLevel: "attention",
      riskNotice: "吞咽风险场景下，咽喉口腔不适需先由护理人员评估。",
      evidence: [patient.swallowingRiskLabel, patient.oralIntakeLabel],
      safetyRule: "SWALLOWING_REQUIRES_NURSE_ASSESSMENT",
      nextAction: "confirm_task",
      nextActionReason: "模拟病历提示吞咽风险，咽喉口腔不适直接形成护理评估任务。",
      terminal: true,
    };
    options[2] = {
      ...options[2],
      id: "pain-limb-abdominal",
      intentCode: "care.pain.limb_abdominal",
      label: "腹部或四肢痛",
      taskText: "患者表达腹部或四肢疼痛，需护理人员床旁评估",
      riskLevel: "attention",
      nextAction: "confirm_task",
      nextActionReason: "疼痛位置已明确，进入护理任务确认。",
      terminal: true,
    };
  }

  if (parentIntentCode === "care.pain" && patient?.motorFunction === "limb_disability") {
    options[0] = {
      ...options[0],
      id: "pain-affected-limb",
      intentCode: "care.pain.affected_limb",
      label: "患侧肢体不适",
      taskText: "患者表达患侧肢体疼痛、麻木或压迫不适，需护理人员床旁评估",
      riskLevel: "attention",
      riskNotice: "病历记录右侧肢体失能，患侧疼痛、麻木或压迫不适需结合摆位情况复核。",
      evidence: [patient.motorFunctionLabel, patient.diagnoses[1]],
      safetyRule: "LIMB_DISABILITY_PAIN_REQUIRES_NURSE_REVIEW",
      terminal: true,
      nextAction: "confirm_task",
      nextActionReason: "模拟病历提示肢体失能，患侧肢体不适直接形成护理评估任务。",
    };
    options[2] = {
      ...options[2],
      id: "pain-shoulder-hand",
      intentCode: "care.pain.shoulder_hand",
      label: "肩手牵拉不适",
      taskText: "患者表达肩部、手部牵拉或摆放不适，需护理人员检查患侧肢体支撑",
      riskLevel: "attention",
      riskNotice: "肢体失能患者的肩手牵拉不适可能与摆位、支撑或护理操作相关，需人工确认。",
      evidence: [patient.motorFunctionLabel, patient.communication],
      safetyRule: "LIMB_SUPPORT_REQUIRES_BEDSIDE_CHECK",
      terminal: true,
      nextAction: "confirm_task",
      nextActionReason: "疼痛位置已与肢体失能病历关联，进入护理任务确认。",
    };
  }

  if (parentIntentCode === "care.pain" && patient?.positionRestriction === "postoperative_assessment") {
    options[0] = {
      ...options[0],
      id: "pain-head-wound",
      intentCode: "care.pain.head_wound",
      label: "头部术区疼痛",
      taskText: "患者表达头部或术区疼痛，需护理人员结合术后情况评估",
      riskLevel: "urgent",
      riskNotice: "术后场景下头部或术区疼痛需提高复核优先级。",
      evidence: [patient.positionRestrictionLabel, patient.diagnoses[0]],
      safetyRule: "POSTOP_PAIN_REQUIRES_NURSE_ASSESSMENT",
      nextAction: "confirm_task",
      nextActionReason: "模拟病历提示术后观察场景，头部或术区疼痛直接形成护理复核任务。",
      terminal: true,
    };
    options[2] = {
      ...options[2],
      id: "pain-pressure",
      intentCode: "care.pain.pressure",
      label: "受压部位疼痛",
      taskText: "患者表达受压部位疼痛或卧位不适，需护理人员评估体位与皮肤受压情况",
      riskLevel: "attention",
      riskNotice: "术后体位受限场景下，受压疼痛需结合体位限制评估。",
      evidence: [patient.positionRestrictionLabel, patient.communication],
      safetyRule: "POSITION_REQUIRES_NURSE_ASSESSMENT",
      nextAction: "confirm_task",
      nextActionReason: "模拟病历提示体位限制，受压疼痛直接形成护理评估任务。",
      terminal: true,
    };
  }

  return {
    question: group.question,
    stepLabel: group.stepLabel,
    options,
  };
}
