import type { CareOption } from "../brain-care";

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
): CareOption => ({
  id,
  intentCode,
  label,
  taskText,
  riskLevel,
  actionMode: "request_only",
});

const APPROVED_GROUPS: Record<string, ApprovedOptionGroup> = {
  "category.basic_care": {
    question: "当前最需要哪类基本照护？",
    stepLabel: "照护类型",
    options: [
      option("care-pain", "care.pain", "疼痛不适", "患者报告疼痛不适", "attention"),
      option("care-hydration", "care.hydration", "饮水口腔", "患者需要饮水或口腔护理"),
      option("care-position", "care.position", "调整体位", "患者需要协助调整体位"),
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
      option("pain-abdominal", "care.pain.abdominal", "腹部持续重痛", "腹部重度持续疼痛", "urgent"),
      option("pain-chest", "care.pain.chest", "胸部持续疼痛", "胸部持续疼痛", "urgent"),
      option("pain-head-limb", "care.pain.other", "头部或四肢痛", "头部或四肢疼痛", "attention"),
    ],
  },
  "care.hydration": {
    question: "请确认需要的照护内容",
    stepLabel: "具体需求",
    options: [
      option("hydration-water", "care.hydration.water", "少量饮水", "需要少量饮水"),
      option("hydration-lips", "care.hydration.lips", "润唇", "需要协助润唇"),
      option("hydration-rinse", "care.hydration.rinse", "漱口", "需要协助漱口"),
    ],
  },
  "care.position": {
    question: "请确认希望调整的体位",
    stepLabel: "具体需求",
    options: [
      option("position-head", "care.position.raise_head", "抬高床头", "需要协助抬高床头", "attention"),
      option("position-left", "care.position.left", "左侧卧", "需要协助调整为左侧卧", "attention"),
      option("position-right", "care.position.right", "右侧卧", "需要协助调整为右侧卧", "attention"),
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

export function approvedOptionsFor(parentIntentCode: string): ApprovedOptionGroup | undefined {
  const group = APPROVED_GROUPS[parentIntentCode];
  if (!group) return undefined;
  return {
    question: group.question,
    stepLabel: group.stepLabel,
    options: group.options.map((item) => ({ ...item })),
  };
}
