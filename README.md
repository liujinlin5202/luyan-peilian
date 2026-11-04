# 赛前模拟舱 · AI 评委团路演陪练训练系统

> **把你第一次被问倒，提前到赛前。**
> 大学生 OPC 创新创业 AI Agent 赛道参赛作品

`Next.js 16` · `React 19` · `TypeScript` · `Tailwind CSS 4` · `DeepSeek（OpenAI 兼容）` · `Supabase（可选）`

## 这是什么

面向高校双创竞赛与课程答辩场景的 AI 陪练系统。粘贴你的商业计划书（BP），AI 评委团按目标赛事的**官方评分标准**给你做赛前训练：

```text
诊断 ──▶ 陪练 ──▶ 复盘 ──▶ 归档 ──▶（带着漏洞清单）再练一场
```

1. **诊断**：AI 诊断官按赛事评分维度逐项打分，输出总分、五维雷达、漏洞清单（每条附「评委最可能问的问题」）。
2. **陪练**：AI 评委席（技术 / 商业 / 投资人三种人设 × 普通 / 地狱两档强度）逐题提问、追问、打分；上一场没补上的漏洞会作为最高优先弹药被定向追问。
3. **复盘**：评分卡、逐题点评、AI 参考回答（明确标注仅供参考）；漏洞由你人工确认后才写入档案。
4. **归档**：双口径得分曲线（BP 诊断分 + 答辩表现分）、漏洞闭环率、导出/导入备份。

**支持 6 套赛事标准**：OPC AI Agent 赛道、中国国际大学生创新大赛、挑战杯、三创赛、蓝桥杯、课程答辩通用。

## 核心特性

- **跨场漏洞闭环**：本场确认的漏洞进入训练档案，下一场陪练被优先追问，复盘判定「复发 / 已改善 / 未涉及」——训练有记忆，而不是每次从零开始。
- **定向出题可证明**：约 60% 的提问锚定诊断弱点，每题气泡上标注「🎯 打向：漏洞#N / 高频题库·维度」，创新点不是台词而是界面行为。
- **87 题结构化题库**：通用 61 + OPC 定向 20 + 蓝桥杯定向 6，全部带追问链；按维度轮询出题，不偏科。
- **全链路演示级容错**：LLM 45 秒超时封顶、接口失败自动降级演示模式（横幅注明原因）、陪练中断刷新可续场、回答失败可重发不重复计题、复盘失败可重试。
- **断网也能演**：无 API Key 或调用失败时自动切换内置模拟数据（结构完全一致）；训练数据支持档案页一键导出/导入 JSON 备份。
- **本地优先隐私**：BP 与训练记录只存你的浏览器（配额防护），诊断/陪练时仅临时调用 AI 生成结果；可选登录后同步 Supabase（RLS 行级隔离），同一套代码双数据层。
- **提示词注入隔离**：BP 与问答实录作为资料文本注入，其中的「给满分」类指令不执行。
- **人在回路**：所有 AI 结论旁标注「AI 生成，仅供参考」；漏洞必须人工确认才入档案。

## 快速开始

```bash
# 要求 Node.js 18+
npm install

# 配置 DeepSeek Key（不配置也能跑：全部功能走演示模式模拟数据）
cp .env.example .env.local
# 编辑 .env.local 填入 DEEPSEEK_API_KEY（https://platform.deepseek.com 获取）

npm run dev
# 打开 http://localhost:3000
```

### 环境变量（全部可选）

| 变量 | 说明 |
| --- | --- |
| `DEEPSEEK_API_KEY` | DeepSeek Key；缺失即演示模式 |
| `DEEPSEEK_BASE_URL` | OpenAI 兼容端点（默认 `https://api.deepseek.com`） |
| `DEEPSEEK_MODEL` | 模型名（默认 `deepseek-chat`） |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 可选：启用登录 + 云端档案 |
| `DEMO_TOKEN` / `NEXT_PUBLIC_DEMO_TOKEN` | 可选：公网部署时启用接口 Token 校验 + 限流（两值一致即生效） |

## 生产部署

```bash
bash deploy.sh
```

自动完成：依赖安装（`npm ci` 优先）→ 构建 → `pm2`/`nohup` 启动 → **20 秒健康检查**（起不来直接打印日志退出，不假报成功）。公网部署建议：配置 `DEMO_TOKEN` 启用接口防护，安全组收窄来源 IP。

## 开发脚本

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 开发服务器 |
| `npm run build` / `npm start` | 生产构建 / 启动 |
| `npm run typecheck` | TypeScript 全仓类型检查 |
| `npm run lint` | ESLint（发布门槛：0 错误 0 警告） |

## 文档

| 文档 | 内容 |
| --- | --- |
| [docs/技术实现文档.md](docs/技术实现文档.md) | 架构、数据模型、三个 AI Agent 的提示词设计与 Sanitize、API 契约、部署运维（v1.1） |
| [docs/supabase-数据系统方案.md](docs/supabase-数据系统方案.md) | 云端数据系统：建表 SQL、RLS 策略、本地→云端迁移 |
| [部署指南.md](部署指南.md) | 服务器手动部署步骤与安全组配置 |

## 项目结构（速览）

```text
app/          页面（/ /new /report /practice /review /archive /auth）+ api/（diagnose·judge·review）
components/   FoldText 纸折字 · JellyRadio 果冻导航 · RadarChart 雷达 · TrendChart 双曲线 · UI 合规组件
lib/          ai.ts(DeepSeek 客户端) · knowledge.ts(6 赛事+87 题知识库) · store.ts(本地四表)
              data-layer.ts(本地/云端双模式) · api-guard.ts(接口防护) · use-dialog.ts(弹层焦点)
supabase/     建表迁移 + RLS
deploy.sh     一键部署
```

## 合规说明

- AI 评分与点评均为训练参考，最终判断请结合指导教师意见；漏洞经人工确认后才计入档案。
- BP 文本会随诊断/陪练请求临时发送至模型服务用于生成结果，应用本身不做服务器存储、不复用内容。
- 评委提问风格模拟真实答辩质疑，仅针对方案本身，不针对人格。

---

*参赛作品 · 司南团队 · 2026*
