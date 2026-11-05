/* BP 原文渲染：自动识别 Markdown 文档并按排版渲染，纯文本仍走原样式 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* 文档类型自动识别：标题/引用/表格/分隔线/列表/强调等信号组合出现即判定为 Markdown。
   兼容从 .md 上传与直接粘贴的两种来源（两者都只保存纯文本）。 */
export function looksLikeMarkdown(text: string): boolean {
  const sample = text.slice(0, 6000);
  let score = 0;
  if (/^#{1,6}\s+\S/m.test(sample)) score += 2; // ATX 标题
  if (/^>\s+\S/m.test(sample)) score += 1; // 引用
  if (/^\|.*\|\s*$/m.test(sample)) score += 1; // GFM 表格
  if (/^\s*([-*+]|\d+[.)])\s+\S/m.test(sample)) score += 1; // 列表
  if (/^---+$/m.test(sample)) score += 1; // 分隔线
  if (/\*\*[^*\n]+\*\*/m.test(sample)) score += 1; // 加粗
  if (/`[^`\n]+`/m.test(sample)) score += 1; // 行内代码
  return score >= 2;
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="bp-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
