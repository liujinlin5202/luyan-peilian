// 诊断 Agent —— 技术方案 §3.2：解析 BP → 对照赛事评分标准逐维度评分 → 结构化诊断报告（附录 C Schema）

import { NextResponse } from "next/server";
import { chatJSON, hasApiKey } from "@/lib/ai";
import { CASE_FEATURES, COMPETITIONS } from "@/lib/knowledge";
import type { DiagnosisReport } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { bp_text, competition } = (await req.json()) as {
    bp_text: string;
    competition: keyof typeof COMPETITIONS;
  };

  if (!bp_text || bp_text.trim().length < 50) {
    return NextResponse.json({ error: "BP 内容过短（至少 50 字）" }, { status: 400 });
  }
  const config = COMPETITIONS[competition] ?? COMPETITIONS.opc;

  if (!hasApiKey()) return NextResponse.json(mockDiagnose(bp_text, config));

  const rubric = config.dimensions
    .map((d) => `- ${d.name}（满分 ${d.max}）：${d.rubric}`)
    .join("\n");

  const system = `你是「赛前模拟舱」的诊断官，任务：解析一份大学生双创大赛 BP，对照指定赛事评分标准逐维度评分，输出结构化诊断报告。

## 赛事：${config.name}
## 评分维度与细则
${rubric}
## 评审导向
${config.focus}

## 案例特征参考
获奖项目共性：${CASE_FEATURES.winning_patterns.join("；")}
常见减分项：${CASE_FEATURES.common_deductions.join("；")}

## 硬性规则
1. 只依据 BP 文本评分，不编造 BP 中不存在的细节；BP 未提及的维度按缺失处理并扣分说明。
2. weaknesses 中的 expect_question 必须是"评委最可能就此提出的问题"，要具体、有追问价值。
3. 每条 strength/weakness/comment 控制在 60 字内，直接点破，不说客套话。
4. 严格输出 JSON，不要输出任何其他内容。

## 输出 JSON Schema
{
  "overall_score": 0-100 整数,
  "dimensions": [{ "name": "维度名（用上面给定的）", "score": 按该维度满分折算, "max": 满分, "comment": "≤50字" }],
  "strengths": ["≤60字", "≤60字", "≤60字"],
  "weaknesses": [{ "point": "≤60字", "severity": "high|mid|low", "expect_question": "评委最可能提出的问题" }]
}
weaknesses 给 3-5 条，按严重程度排序。`;

  const user = `请诊断以下 BP：\n\n${bp_text.slice(0, 8000)}`;

  try {
    const report = (await chatJSON(system, user, { maxTokens: 2500 })) as DiagnosisReport;
    return NextResponse.json(sanitize(report, config));
  } catch (e) {
    console.error("[diagnose] fallback to mock:", e);
    const mock = mockDiagnose(bp_text, config);
    return NextResponse.json({ ...mock, degraded: true });
  }
}

function sanitize(report: DiagnosisReport, config: (typeof COMPETITIONS)[keyof typeof COMPETITIONS]): DiagnosisReport {
  const dims = config.dimensions;
  const byName = new Map((report.dimensions ?? []).map((d) => [d.name, d]));
  const dimensions = dims.map((d) => {
    const got = byName.get(d.name);
    const score = Math.max(0, Math.min(d.max, Math.round(Number(got?.score ?? d.max * 0.6))));
    return { name: d.name, score, max: d.max, comment: String(got?.comment ?? "").slice(0, 60) };
  });
  const overall = Math.min(
    100,
    Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / Math.max(1, dims.map((x) => x.max).reduce((a, b) => a + b, 0) / 100))
  );
  return {
    overall_score: Number(report.overall_score) > 0 ? Math.min(100, Math.round(Number(report.overall_score))) : overall,
    dimensions,
    strengths: (report.strengths ?? []).slice(0, 3).map((s) => String(s).slice(0, 60)),
    weaknesses: (report.weaknesses ?? []).slice(0, 5).map((w) => ({
      point: String(w.point).slice(0, 60),
      severity: ["high", "mid", "low"].includes(w.severity) ? w.severity : "mid",
      expect_question: String(w.expect_question).slice(0, 80),
    })),
  };
}

// ---- 演示模式：无 API key 时提供可用的模拟诊断（明确标记 mock）----
function mockDiagnose(bp_text: string, config: (typeof COMPETITIONS)[keyof typeof COMPETITIONS]): DiagnosisReport {
  let h = 0;
  for (const c of bp_text) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const dimBase = [0.62, 0.55, 0.7, 0.6, 0.5];
  const dimensions = config.dimensions.map((d, i) => {
    const ratio = Math.min(0.95, dimBase[i % dimBase.length] + ((h >> (i * 3)) % 15) / 100);
    return {
      name: d.name,
      score: Math.round(d.max * ratio),
      max: d.max,
      comment: DEMO_COMMENTS[(h + i) % DEMO_COMMENTS.length],
    };
  });
  const overall = Math.round(dimensions.reduce((s, d) => s + d.score / d.max, 0) / dimensions.length * 100);
  return {
    overall_score: overall,
    dimensions,
    strengths: ["问题定位来自真实场景，痛点叙述具体", "方案与痛点对应关系清楚，结构完整", "团队构成与项目方向基本匹配"],
    weaknesses: [
      { point: "市场规模只给了大数，缺少可触达用户的推算过程", severity: "high", expect_question: "你写的市场盘子是怎么算出来的？从下往上推一遍。" },
      { point: "商业模式只有收入方式，未见成本与获客测算", severity: "high", expect_question: "第一批 100 个用户从哪来？获客成本估过吗？" },
      { point: "团队分工偏头衔化，看不出每个人的真实贡献", severity: "mid", expect_question: "团队里谁负责最难的那部分？他凭什么做得下来？" },
      { point: "风险章节只列了风险，没有对应的具体应对动作", severity: "mid", expect_question: "最核心的假设如果被证伪，你们的 Plan B 是什么？" },
      { point: "进展部分缺少可验证的里程碑与数据", severity: "low", expect_question: "现在能拿出什么证据证明这件事在往前走？" },
    ],
    mock: true,
  };
}

const DEMO_COMMENTS = [
  "叙述完整，但关键数据支撑不足",
  "这一块 BP 有覆盖，深度一般",
  "结构清晰，属于同类项目的常规写法",
  "有亮点，但说服力还差一层证据",
  "基本及格，离获奖项目的写法有距离",
];
