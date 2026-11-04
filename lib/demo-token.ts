// 前端侧：AI 接口鉴权头。与服务端 DEMO_TOKEN 配对的公开值（NEXT_PUBLIC_ 前缀才会进客户端 bundle）。
// 未配置时不带头，本地开发零配置可用。

export const demoTokenHeaders: Record<string, string> = process.env.NEXT_PUBLIC_DEMO_TOKEN
  ? { "x-demo-token": process.env.NEXT_PUBLIC_DEMO_TOKEN }
  : {};
