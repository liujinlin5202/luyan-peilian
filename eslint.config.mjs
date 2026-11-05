// ESLint flat config（Next 16 官方推荐结构），演示前跑 `npm run lint` 做发布门槛
import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  {
    // components/bits 为第三方移植组件（原样 vendored），不套用本项目 lint 规则
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "components/bits/**"],
  },
  ...coreWebVitals,
  ...nextTs,
  {
    rules: {
      // react-hooks v6 新规则：对 jelly-radio（React Bits 物理动画组件，渲染期读 ref 是其实现方式）
      // 和事件处理器里的 ref 写入是误报，整体关闭
      "react-hooks/refs": "off",
    },
  },
];

export default config;
