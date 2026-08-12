"use client";

import { useEffect, useMemo, useState } from "react";
import type { DciAgentResponse, DciCaseAction, DciCaseState, DciDemoState, DciReviewForm } from "../lib/dci-demo-state";
import { DEMO_PATIENTS, type DemoPatientProfile, type QeegPoint } from "../lib/demo-patients";

type DciDemoProps = {
  onOpenPatientView: () => void;
  onOpenNurseView: () => void;
};

type SectionId = "overview" | "signal" | "analysis" | "workflow" | "report" | "roadmap";

const SECTION_LABELS: Array<{ id: SectionId; label: string }> = [
  { id: "overview", label: "患者总览" },
  { id: "signal", label: "EEG / qEEG" },
  { id: "analysis", label: "AI解释" },
  { id: "workflow", label: "医护闭环" },
  { id: "report", label: "事件报告" },
  { id: "roadmap", label: "验证计划" },
];

const DEFAULT_REVIEW: DciReviewForm = {
  signalChecked: false,
  bedsideChecked: false,
  vitalsChecked: false,
  medicationChecked: false,
  nurseNote: "",
  doctorNote: "",
  examPlan: "",
};

export default function DciDemo({ onOpenPatientView, onOpenNurseView }: DciDemoProps) {
  const [activeBed, setActiveBed] = useState("A01");
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [cases, setCases] = useState<DciCaseState[]>([]);
  const [review, setReview] = useState<DciReviewForm>(DEFAULT_REVIEW);
  const [agent, setAgent] = useState<DciAgentResponse | null>(null);
  const [agentState, setAgentState] = useState<"idle" | "loading" | "ready">("idle");
  const [notice, setNotice] = useState("演示数据已就绪");
  const [busy, setBusy] = useState(false);
  const [rawWaveform, setRawWaveform] = useState(true);
  const patient = DEMO_PATIENTS.find((item) => item.bed === activeBed) ?? DEMO_PATIENTS[0];
  const caseState = cases.find((item) => item.bed === activeBed);

  useEffect(() => {
    void fetch("/api/dci", { cache: "no-store" })
      .then(async (response) => response.json() as Promise<DciDemoState>)
      .then((state) => setCases(state.cases))
      .catch(() => setNotice("演示状态接口暂不可用，请刷新页面"));
  }, []);

  function choosePatient(bed: string) {
    setActiveBed(bed);
    setActiveSection("overview");
    const nextCase = cases.find((item) => item.bed === bed);
    setReview(nextCase?.review ?? DEFAULT_REVIEW);
    setAgent(null);
    setAgentState("idle");
    setNotice(`${bed} 演示病例已载入`);
  }

  async function runAction(action: DciCaseAction, message: string) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/dci", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bed: patient.bed, action, review }),
      });
      const body = await response.json() as DciDemoState & { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message || "操作失败");
      setCases(body.cases);
      setNotice(message);
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runAgent() {
    if (agentState === "loading") return;
    setAgentState("loading");
    setActiveSection("analysis");
    setNotice("医学知识增强Agent正在组织结构化证据");
    try {
      const response = await fetch("/api/dci/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bed: patient.bed }),
      });
      const body = await response.json() as DciAgentResponse & { error?: { message?: string } };
      if (!response.ok) throw new Error(body.error?.message || "AI分析失败");
      setAgent(body);
      setAgentState("ready");
      setNotice(body.source === "deepseek" ? "DeepSeek受控解释已完成" : "受控本地解释已完成");
    } catch (error) {
      setAgent({ source: "controlled_fallback", model: "evidence-template-v1", generatedAt: new Date().toISOString(), ...patient.dci.agent });
      setAgentState("ready");
      setNotice(`AI服务不可用，已安全降级：${(error as Error).message}`);
    }
  }

  async function resetAll() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/dci", { method: "POST" });
      const body = await response.json() as DciDemoState;
      setCases(body.cases);
      setActiveBed("A01");
      setActiveSection("overview");
      setReview(DEFAULT_REVIEW);
      setAgent(null);
      setNotice("三位患者的演示状态已恢复");
    } finally {
      setBusy(false);
    }
  }

  const output = agent ?? { source: "controlled_fallback" as const, model: "evidence-template-v1", generatedAt: "", ...patient.dci.agent };
  const latestPoint = patient.dci.qeeg.at(-1) ?? patient.dci.qeeg[0];
  return (
    <main className="dci-demo-shell">
      <section className="dci-hero" aria-labelledby="dci-title">
        <div>
          <span className="dci-kicker">赛道7 · 非侵入式EEG / qEEG</span>
          <h1 id="dci-title">SAH-DCI智能预警系统</h1>
          <p>脑脉护通 · 循证规则风险积分 + 医学知识增强Agent + 医护复核闭环</p>
        </div>
        <div className="dci-boundary">
          <strong>演示边界</strong>
          <span>真实正常EEG验证工程能力</span>
          <span>三位模拟患者回放风险流程</span>
          <small>仅作趋势提示，不替代医生诊断</small>
        </div>
      </section>

      <nav className="dci-section-nav" aria-label="SAH-DCI演示页面导航">
        {SECTION_LABELS.map((item) => (
          <button key={item.id} type="button" className={activeSection === item.id ? "is-active" : ""} onClick={() => setActiveSection(item.id)}>
            {item.label}
          </button>
        ))}
        <span className="dci-live-notice"><i />{notice}</span>
      </nav>

      <section className="dci-patient-strip" aria-label="三位模拟患者">
        {DEMO_PATIENTS.map((item) => {
          const state = cases.find((candidate) => candidate.bed === item.bed);
          const score = state?.currentRiskScore ?? item.dci.riskScore;
          return (
            <button key={item.bed} type="button" className={`dci-patient-card ${item.dci.riskLevel} ${activeBed === item.bed ? "selected" : ""}`} onClick={() => choosePatient(item.bed)}>
              <span className="dci-patient-bed">{item.bed}</span>
              <span><strong>{item.patientCode}</strong><small>{item.sex} · {item.age} · 术后第{item.dci.stageDay}天</small></span>
              <span><b>{score}分</b><small>{state?.followupApplied ? "处置后追踪" : item.scenarioLabel}</small></span>
            </button>
          );
        })}
        <button type="button" className="dci-reset" disabled={busy} onClick={() => void resetAll()}>重置全部演示</button>
      </section>

      {activeSection === "overview" && (
        <Overview patient={patient} caseState={caseState} onSection={setActiveSection} onRunAgent={runAgent} />
      )}
      {activeSection === "signal" && (
        <SignalPanel patient={patient} latest={latestPoint} rawWaveform={rawWaveform} setRawWaveform={setRawWaveform} />
      )}
      {activeSection === "analysis" && (
        <AgentPanel patient={patient} output={output} state={agentState} onRun={runAgent} />
      )}
      {activeSection === "workflow" && (
        <WorkflowPanel patient={patient} caseState={caseState} review={review} setReview={setReview} busy={busy} runAction={runAction} />
      )}
      {activeSection === "report" && (
        <ReportPanel patient={patient} caseState={caseState} output={output} busy={busy} runAction={runAction} />
      )}
      {activeSection === "roadmap" && <RoadmapPanel />}

      <section className="dci-evidence-section" aria-labelledby="evidence-title">
        <header>
          <div><span className="eyebrow">可解释医学复核</span><h2 id="evidence-title">多模态证据链</h2></div>
          <div className={`evidence-score ${patient.dci.riskLevel}`}><strong>{patient.dci.evidenceScore}</strong><span>多模态证据分</span></div>
        </header>
        <p>EEG/qEEG作为核心BCI输入；TCD、fNIRS、生命体征/用药和影像报告仅作为模拟复核证据。</p>
        <div className="evidence-card-grid">
          {patient.dci.evidence.map((item) => (
            <article className={`evidence-card ${item.statusTone}`} key={item.id}>
              <header><div><strong>{item.title}</strong><span>{item.subtitle}</span></div><b>{item.status}</b></header>
              <h3>{item.headline}</h3>
              <p>{item.description}</p>
              <div>{item.metrics.map((metric) => <span key={metric.label}><small>{metric.label}</small><strong>{metric.value}</strong></span>)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="dci-related-entry" aria-label="既有脑控护理功能入口">
        <div><strong>既有功能保留</strong><span>患者脑控表达和跨电脑护理同步仍可独立演示。</span></div>
        <button type="button" onClick={onOpenPatientView}>打开患者脑控端</button>
        <button type="button" onClick={onOpenNurseView}>打开护理任务端</button>
      </section>
    </main>
  );
}

function Overview({ patient, caseState, onSection, onRunAgent }: { patient: DemoPatientProfile; caseState?: DciCaseState; onSection: (id: SectionId) => void; onRunAgent: () => void }) {
  const score = caseState?.currentRiskScore ?? patient.dci.riskScore;
  return (
    <section className="dci-dashboard-grid">
      <article className={`dci-risk-hero ${patient.dci.riskLevel}`}>
        <div className="risk-dial"><strong>{score}</strong><span>/ 10</span></div>
        <div><span className="eyebrow">当前循证规则积分</span><h2>{caseState?.currentRiskLabel ?? patient.dci.riskLabel}</h2><p>{patient.dci.alertLabel}</p></div>
        <button type="button" onClick={() => void onRunAgent()}>查看AI解释</button>
      </article>
      <article className="dci-patient-summary">
        <header><div><span className="eyebrow">{patient.dci.stageLabel}</span><h2>{patient.patientCode} · 床位 {patient.bed}</h2></div><span>术后第 {patient.dci.stageDay} 天</span></header>
        <p>{patient.admissionSummary}</p>
        <dl><div><dt>诊断场景</dt><dd>{patient.diagnoses.join("；")}</dd></div><div><dt>个人基线</dt><dd>{patient.dci.baselineWindow}</dd></div><div><dt>异常持续</dt><dd>{patient.dci.abnormalDuration}</dd></div><div><dt>信号质量</dt><dd>{patient.dci.signalQuality}分 · 质量门控通过</dd></div></dl>
      </article>
      <RiskStair patients={DEMO_PATIENTS} />
      <article className="score-breakdown">
        <header><div><span className="eyebrow">可追溯规则</span><h2>风险积分构成</h2></div><button type="button" onClick={() => onSection("signal")}>查看趋势数据</button></header>
        {patient.dci.scoreBreakdown.map((item) => <div key={item.label}><span><strong>{item.label}</strong><small>{item.detail}</small></span><b className={item.points > 0 ? "has-points" : ""}>+{item.points}</b></div>)}
      </article>
    </section>
  );
}

function RiskStair({ patients }: { patients: DemoPatientProfile[] }) {
  return (
    <article className="risk-stair">
      <header><span className="eyebrow">三位模拟患者</span><h2>风险积分阶梯</h2><p>同一套规则覆盖稳定、早期提示与完整预警。</p></header>
      <div className="stair-track">
        <div className="stair green"><strong>0–2分</strong><span>一级 · 绿色低风险</span><b>A · {patients[0].dci.riskScore}分</b></div>
        <div className="stair yellow"><strong>3–5分</strong><span>二级 · 黄色预警</span><b>B · {patients[1].dci.riskScore}分</b></div>
        <div className="stair red"><strong>≥6分</strong><span>三级 · 红色预警</span><b>C · {patients[2].dci.riskScore}分</b></div>
      </div>
    </article>
  );
}

function SignalPanel({ patient, latest, rawWaveform, setRawWaveform }: { patient: DemoPatientProfile; latest: QeegPoint; rawWaveform: boolean; setRawWaveform: (value: boolean) => void }) {
  const channels = ["Fp1", "Fp2", "F3", "F4", "C3", "C4", "O1", "O2"];
  return (
    <section className="dci-signal-layout">
      <article className="signal-quality-card">
        <header><div><span className="eyebrow">OpenBCI Cyton / LSL</span><h2>设备接入与信号质控</h2></div><span className="quality-pass"><i />质量门控通过</span></header>
        <div className="device-flow"><span>设备连接<strong>已就绪</strong></span><b>→</b><span>EEG数据流<strong>125 Hz</strong></span><b>→</b><span>有效通道<strong>8 / 8</strong></span><b>→</b><span>质量评分<strong>{patient.dci.signalQuality}</strong></span></div>
        <div className="channel-grid">{channels.map((channel) => <span key={channel} className={patient.dci.affectedChannels.includes(channel) ? "watch" : ""}><i />{channel}<small>{patient.dci.affectedChannels.includes(channel) ? "趋势关注" : "接触正常"}</small></span>)}</div>
        <p>高幅值、平线、快速跳变、眼动/肌电与工频干扰先进入质量门控；低质量窗口不参与风险升级。</p>
      </article>
      <article className="waveform-card">
        <header><div><span className="eyebrow">30秒回放窗口</span><h2>{rawWaveform ? "原始EEG波形" : "滤波后EEG波形"}</h2></div><div className="wave-toggle"><button className={rawWaveform ? "is-active" : ""} onClick={() => setRawWaveform(true)}>原始</button><button className={!rawWaveform ? "is-active" : ""} onClick={() => setRawWaveform(false)}>滤波后</button></div></header>
        <div className={`eeg-wave-stack ${rawWaveform ? "raw" : "filtered"}`}>{[0,1,2,3,4,5].map((index) => <div key={index}><span>{channels[index]}</span><i /></div>)}</div>
        <footer><span>0.5–30 Hz带通</span><span>50 Hz工频抑制</span><span>重参考与分窗</span><span>伪迹识别</span></footer>
      </article>
      <TrendChart patient={patient} />
      <article className="qeeg-metrics">
        <header><span className="eyebrow">最新质量合格窗口</span><h2>qEEG特征面板</h2></header>
        <div><span><small>alpha</small><strong>{latest.alpha}%</strong></span><span><small>beta</small><strong>{latest.beta}%</strong></span><span><small>delta</small><strong>{latest.delta}%</strong></span><span><small>ADR</small><strong>{latest.adr}</strong></span><span><small>DAR</small><strong>{latest.dar}</strong></span><span><small>PAV</small><strong>{latest.pav}</strong></span><span><small>RAV</small><strong>{latest.rav}</strong></span><span><small>不对称</small><strong>{latest.asymmetry}%</strong></span><span><small>熵</small><strong>{latest.entropy}</strong></span><span><small>质量</small><strong>{latest.quality}</strong></span></div>
        <p>上述指标共同进入个人基线、持续时间与多指标一致性约束，不以单一数值作出诊断。</p>
      </article>
    </section>
  );
}

function TrendChart({ patient }: { patient: DemoPatientProfile }) {
  const series = useMemo(() => [
    { key: "alpha" as const, label: "alpha相对基线", color: "#1b7a68", max: 180 },
    { key: "delta" as const, label: "delta相对基线", color: "#c6463d", max: 180 },
    { key: "adr" as const, label: "ADR（×20）", color: "#d79b24", max: 180, scale: 20 },
  ], []);
  return (
    <article className="trend-card">
      <header><div><span className="eyebrow">个人基线比较</span><h2>病程qEEG趋势</h2></div><div className="trend-legend">{series.map((item) => <span key={item.key}><i style={{ background: item.color }} />{item.label}</span>)}</div></header>
      <div className="trend-plot">
        {patient.dci.qeeg.map((point) => <div className="trend-day" key={point.day}><div className="trend-bars">{series.map((item) => { const value = Number(point[item.key]) * (item.scale ?? 1); return <i key={item.key} style={{ height: `${Math.max(8, Math.min(100, value / item.max * 100))}%`, background: item.color }} title={`${item.label}: ${point[item.key]}`} />; })}</div><strong>{point.day}</strong><small>{point.score}分</small></div>)}
      </div>
    </article>
  );
}

function AgentPanel({ patient, output, state, onRun }: { patient: DemoPatientProfile; output: DciAgentResponse; state: "idle" | "loading" | "ready"; onRun: () => void }) {
  return (
    <section className="agent-panel">
      <header><div><span className="eyebrow">医学知识增强Agent</span><h2>固定五段式风险解释</h2><p>规则引擎先定级，Agent只负责证据组织和流程文本生成。</p></div><button type="button" disabled={state === "loading"} onClick={() => void onRun()}>{state === "loading" ? "正在分析…" : state === "ready" ? "重新生成解释" : "运行AI分析"}</button></header>
      <div className="agent-source-row"><span className={`agent-source ${output.source}`}>{output.source === "deepseek" ? "DeepSeek实时受控分析" : "受控本地安全解释"}</span><span>{output.model}</span><span>风险等级锁定：{patient.dci.riskLabel}</span></div>
      <div className="agent-five-grid">
        <article className="wide"><span>01 · 风险解释</span><p>{output.trigger}</p></article>
        <article><span>02 · 证据列表</span><ul>{output.evidence.map((item) => <li key={item}>{item}</li>)}</ul></article>
        <article><span>03 · 护士复核清单</span><ol>{output.nurseChecklist.map((item) => <li key={item}>{item}</li>)}</ol></article>
        <article className="wide"><span>04 · 医生交接摘要</span><p>{output.doctorSummary}</p><button type="button" onClick={() => void navigator.clipboard?.writeText(output.doctorSummary)}>复制交接摘要</button></article>
        <article className="boundary wide"><span>05 · 安全边界声明</span><p>{output.safetyBoundary}</p></article>
      </div>
    </section>
  );
}

function WorkflowPanel({ patient, caseState, review, setReview, busy, runAction }: { patient: DemoPatientProfile; caseState?: DciCaseState; review: DciReviewForm; setReview: (value: DciReviewForm) => void; busy: boolean; runAction: (action: DciCaseAction, message: string) => Promise<void> }) {
  const status = caseState?.workflowStatus ?? patient.dci.initialWorkflow;
  const isGreen = patient.dci.riskLevel === "green";
  return (
    <section className="workflow-panel">
      <header><div><span className="eyebrow">发现—复核—确认—追踪—复盘</span><h2>医护复核与处置闭环</h2></div><span className={`workflow-status ${status}`}>{workflowLabel(status)}</span></header>
      <div className="workflow-steps"><span className="done"><b>1</b>规则预警</span><i /><span className={status !== "nurse_pending" ? "done" : "active"}><b>2</b>护士复核</span><i /><span className={status === "doctor_pending" ? "active" : status === "tracking" || status === "resolved" ? "done" : ""}><b>3</b>医生确认</span><i /><span className={status === "tracking" ? "active" : status === "resolved" ? "done" : ""}><b>4</b>处置后追踪</span><i /><span className={status === "resolved" ? "done" : ""}><b>5</b>事件复盘</span></div>
      <div className="workflow-grid">
        <article>
          <header><span>护士工作台</span><strong>四项安全复核</strong></header>
          {[{ key: "signalChecked" as const, text: "信号质量：电极、体动、肌电、护理操作" }, { key: "bedsideChecked" as const, text: "床旁状态：意识、瞳孔、语言、肢体反应" }, { key: "vitalsChecked" as const, text: "生命体征：MAP、SpO2、体温、血糖" }, { key: "medicationChecked" as const, text: "用药变化：镇静、血管活性药物及调整时间" }].map((item) => <label key={item.key}><input type="checkbox" checked={review[item.key]} onChange={(event) => setReview({ ...review, [item.key]: event.target.checked })} /><span>{item.text}</span></label>)}
          <textarea aria-label="护士复核意见" placeholder="填写护士复核意见（演示可填写：未发现明显电极脱落、低氧或低血压，建议升级医生复核）" value={review.nurseNote} onChange={(event) => setReview({ ...review, nurseNote: event.target.value })} />
          <button type="button" disabled={busy || status !== "nurse_pending"} onClick={() => void runAction("nurse_review", isGreen ? "稳定病例复核已记录" : "护士复核已完成，事件进入医生确认")}>{status === "nurse_pending" ? "保存护士复核并升级" : "护士复核已完成"}</button>
        </article>
        <article>
          <header><span>医生工作台</span><strong>临床确认与复核计划</strong></header>
          <p>{patient.dci.agent.doctorSummary}</p>
          <textarea aria-label="医生确认意见" placeholder="填写医生确认意见（演示可填写：结合床旁状态继续医学复核，系统提示不作为诊断结论）" value={review.doctorNote} onChange={(event) => setReview({ ...review, doctorNote: event.target.value })} />
          <select aria-label="辅助检查复核计划" value={review.examPlan} onChange={(event) => setReview({ ...review, examPlan: event.target.value })}>
            <option value="">选择复核方向</option><option>TCD趋势复查</option><option>CTA/CTP由医生结合院内流程判断</option><option>继续床旁神经功能观察</option><option>当前不追加检查，继续趋势监测</option>
          </select>
          <button type="button" disabled={busy || status !== "doctor_pending"} onClick={() => void runAction("doctor_confirm", "医生确认已留痕，进入处置后追踪")}>{status === "doctor_pending" ? "确认并进入追踪" : status === "tracking" || status === "resolved" ? "医生确认已完成" : "等待护士复核"}</button>
        </article>
      </div>
      {patient.dci.followupScore !== undefined && <div className="followup-banner"><div><span>处置后模拟回放</span><strong>{patient.dci.followupSummary}</strong></div><button type="button" disabled={busy || status !== "tracking"} onClick={() => void runAction("apply_followup", "处置后趋势已播放，风险降级且原事件保留")}>{status === "resolved" ? "已完成风险降级" : "播放处置后趋势"}</button></div>}
      <EventTimeline events={caseState?.events ?? []} />
    </section>
  );
}

function ReportPanel({ patient, caseState, output, busy, runAction }: { patient: DemoPatientProfile; caseState?: DciCaseState; output: DciAgentResponse; busy: boolean; runAction: (action: DciCaseAction, message: string) => Promise<void> }) {
  return (
    <section className="report-panel">
      <header><div><span className="eyebrow">可追踪 · 可交接 · 可复盘</span><h2>SAH-DCI风险事件报告</h2><p>报告保留规则触发与人工复核轨迹，不自动补造临床结论。</p></div><button type="button" disabled={busy} onClick={() => void runAction("generate_report", "事件报告已生成并保留审计轨迹")}>{caseState?.reportGenerated ? "重新生成报告" : "生成事件报告"}</button></header>
      <article className="report-sheet">
        <div className="report-title"><span>模拟事件 · {patient.bed}</span><h3>{caseState?.currentRiskLabel ?? patient.dci.riskLabel}</h3><strong>当前积分 {caseState?.currentRiskScore ?? patient.dci.riskScore} 分</strong></div>
        <dl><div><dt>患者与阶段</dt><dd>{patient.patientCode}，术后第{patient.dci.stageDay}天</dd></div><div><dt>触发时间窗</dt><dd>{patient.dci.abnormalDuration}</dd></div><div><dt>质量门控</dt><dd>通过，信号质量{patient.dci.signalQuality}分</dd></div><div><dt>报告状态</dt><dd>{caseState?.reportGenerated ? "已生成 · 可复盘" : "草稿预览"}</dd></div></dl>
        <section><h4>触发依据</h4><p>{output.trigger}</p></section><section><h4>医生交接摘要</h4><p>{output.doctorSummary}</p></section><section><h4>护士复核意见</h4><p>{caseState?.review.nurseNote || "尚未填写；报告保留缺项提示，不自动补造。"}</p></section><section><h4>医生确认与检查计划</h4><p>{caseState?.review.doctorNote || "尚未确认"}{caseState?.review.examPlan ? `；${caseState.review.examPlan}` : ""}</p></section><section><h4>处置后趋势</h4><p>{caseState?.followupApplied ? patient.dci.followupSummary : "尚未播放处置后追踪，原始预警事件将持续保留。"}</p></section><footer>{output.safetyBoundary}</footer>
      </article>
      <EventTimeline events={caseState?.events ?? []} />
    </section>
  );
}

function EventTimeline({ events }: { events: DciCaseState["events"] }) {
  return <section className="dci-timeline"><header><span>闭环留痕</span><strong>事件时间线</strong></header>{events.length ? events.map((event) => <div key={event.id}><time>{event.time}</time><span><b>{event.actor}</b><strong>{event.title}</strong><small>{event.detail}</small></span></div>) : <p>暂无事件</p>}</section>;
}

function RoadmapPanel() {
  const phases = [
    ["01", "工程联调", "0–3个月", "接入真实非侵入式EEG，验证采集、滤波、伪迹控制、qEEG计算和低误报。"],
    ["02", "回顾性验证", "4–9个月", "在伦理审批与脱敏前提下，联合EEG、TCD、CTA/CTP和DCI结局标签校准规则。"],
    ["03", "前瞻性观察", "10–18个月", "系统仅提示复核，不改变既有诊疗；记录误报、漏报、复核耗时和事件转归。"],
    ["04", "多中心升级", "后续阶段", "积累足量标签后评估时序模型、敏感性、特异性、AUC、校准与提前预警时间。"],
  ];
  return <section className="roadmap-panel"><header><span className="eyebrow">临床验证边界</span><h2>验证计划与未来升级</h2><p>当前完成的是评审演示和工程闭环，不宣称已完成临床诊断模型验证。</p></header><div>{phases.map((phase) => <article key={phase[0]}><b>{phase[0]}</b><span><strong>{phase[1]}</strong><small>{phase[2]}</small><p>{phase[3]}</p></span></article>)}</div><footer><strong>目标验证口径</strong><span>提前24小时以上形成复核线索；文献约46–55小时提前量作为待验证假设。</span><span>真实敏感性、特异性、AUC与提前量须由真实队列验证。</span></footer></section>;
}

function workflowLabel(status: DciCaseState["workflowStatus"]) {
  const labels = { monitoring: "稳定监测", nurse_pending: "待护士复核", doctor_pending: "待医生确认", tracking: "处置后追踪", resolved: "已降级 · 可复盘" };
  return labels[status];
}
