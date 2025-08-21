"use client";

import React from "react";
import Copilot from "@/components/Copilot";
import { useXAgent } from "@ant-design/x";
import { useSearchParams } from "next/navigation";
import {
  loadConfigFromLocal,
  saveConfigToLocal,
  decodeConfigFromURL,
  encodeConfigForURL,
  buildShareUrl,
  deepReplaceMessageVar,
  type OpenApiConfig,
} from "@/lib/config";
import { Button } from "antd";
import { CommentOutlined } from "@ant-design/icons";

// 独立助手式页面：可被其他站点通过 <iframe src="/copilot?cfg=..." /> 嵌入
// 与首页聊天页采用同一套配置读取与请求逻辑，保证“功能一模一样”

type BubbleDataType = { role: string; content: string };

const CopilotPage: React.FC = () => {
  const searchParams = useSearchParams();

  // 读取/合并配置：优先 URL cfg，其次 localStorage
  const [openApiConfig, setOpenApiConfig] =
    React.useState<OpenApiConfig | null>(null);
  React.useEffect(() => {
    const local = loadConfigFromLocal();
    if (local) setOpenApiConfig(local);
  }, []);
  React.useEffect(() => {
    const encoded = searchParams?.get("cfg");
    if (!encoded) return;
    const partial = decodeConfigFromURL(encoded);
    if (!partial) return;
    setOpenApiConfig((prev) => {
      const next: OpenApiConfig = {
        baseUrl: (partial.baseUrl ?? prev?.baseUrl ?? "").trim(),
        apiKey: partial.apiKey ?? prev?.apiKey,
        spec: (partial.spec ?? prev?.spec ?? {}) as any,
        updatedAt: Date.now(),
      };
      saveConfigToLocal(next);
      return next;
    });
  }, [searchParams]);

  // —— 流式合并（与首页一致）：将 reasoning + content 合并
  const answerRef = React.useRef("");
  const thinkingRef = React.useRef("");

  const [agent] = useXAgent<BubbleDataType>({
    request: async ({ message: userMsg }, { onSuccess, onError }) => {
      try {
        const cfg = openApiConfig ?? loadConfigFromLocal();
        if (!cfg?.baseUrl) {
          onError?.(new Error("未检测到 API 配置，请先到 /config 填写"));
          return;
        }
        const { baseUrl, apiKey, spec } = cfg;
        const clean = baseUrl.replace(/\/+$/, "");
        const endpoint = /\/chat\/completions$/.test(clean)
          ? clean
          : `${clean}/chat/completions`;

        let baseBody: any = {};
        if (spec && typeof spec === "object")
          baseBody = deepReplaceMessageVar(spec, userMsg ?? "");
        if (!baseBody.messages)
          baseBody.messages = [{ role: "user", content: userMsg }];
        if (!baseBody.model) baseBody.model = "glm-4.5";

        const useStream = baseBody.stream === true;
        if (useStream) {
          thinkingRef.current = "";
          answerRef.current = "";
        }

        const controller = new AbortController();
        // 允许 Copilot 内部 onCancel 获取 controller：由 Copilot 通过 resolveAbortController 保存
        // 这里通过返回一个特性给 useXChat 框架层（Copilot 内部已处理），不必在此暴露

        const buildAuthHeader = (key?: string) => {
          if (!key) return {} as Record<string, string>;
          const k = key.trim();
          const val = k.toLowerCase().startsWith("bearer ") ? k : `Bearer ${k}`;
          return { Authorization: val } as Record<string, string>;
        };

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(useStream ? { Accept: "text/event-stream" } : {}),
            ...buildAuthHeader(apiKey),
          },
          body: JSON.stringify(baseBody),
          signal: controller.signal,
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${text}`);
        }

        if (useStream && resp.body) {
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const ln of lines) {
              const line = ln.trim();
              if (!line || !line.startsWith("data:")) continue;
              const dataStr = line.slice(5).trim();
              if (!dataStr || dataStr === "[DONE]") continue;
              try {
                const json = JSON.parse(dataStr);
                const choice = json?.choices?.[0];
                const delta = choice?.delta || choice?.message;
                const t = delta?.reasoning_content || choice?.reasoning_content;
                const c = delta?.content || choice?.content;
                if (t) thinkingRef.current += String(t);
                if (c)
                  answerRef.current = answerRef.current
                    ? answerRef.current + String(c)
                    : String(c);
              } catch {}
            }
          }
          const finalCombined = [
            thinkingRef.current ? `<think>${thinkingRef.current}</think>` : "",
            answerRef.current,
          ]
            .filter(Boolean)
            .join("\n\n");
          onSuccess(finalCombined || answerRef.current || "");
        } else {
          const data = await resp.json();
          const choice = data?.choices?.[0];
          const content =
            choice?.message?.content || data?.data || data?.output || "";
          const reasoning =
            choice?.message?.reasoning_content ||
            choice?.reasoning_content ||
            data?.reasoning_content ||
            "";
          const finalCombined = [
            reasoning ? `<think>${reasoning}</think>` : "",
            content,
          ]
            .filter(Boolean)
            .join("\n\n");
          onSuccess(finalCombined || content);
        }
      } catch (e: any) {
        if (e?.name === "AbortError") {
          const finalCombined = [
            thinkingRef.current ? `<think>${thinkingRef.current}</think>` : "",
            answerRef.current,
          ]
            .filter(Boolean)
            .join("\n\n");
          if (thinkingRef.current || answerRef.current)
            onSuccess(finalCombined || answerRef.current || "");
        } else {
          onError?.(new Error(e?.message || "请求失败"));
        }
      }
    },
  });

  // 浮动图标开关：点击展开助手式，关闭后回到图标
  const [open, setOpen] = React.useState(false);

  const onShare = async () => {
    try {
      const cfg = openApiConfig ?? loadConfigFromLocal();
      if (!cfg) return;
      const encoded = encodeConfigForURL(cfg, {
        includeApiKey: !!cfg.apiKey,
        omitSpec: false,
      });
      const url = ((): string => {
        if (typeof window === "undefined") return `/copilot?cfg=${encoded}`;
        const u = new URL(window.location.href);
        u.pathname = "/copilot";
        u.search = `?cfg=${encoded}`;
        return u.toString();
      })();
      if (navigator.share)
        await navigator.share({ title: "Ant Design X Copilot", url });
      else await navigator.clipboard.writeText(url);
    } catch {}
  };

  return (
    <div style={{ width: "100%", height: "100vh", background: "transparent" }}>
      {open && (
        <Copilot
          open
          onClose={() => setOpen(false)}
          onShare={onShare}
          agent={agent}
        />
      )}
      {!open && (
        <Button
          type="primary"
          shape="circle"
          icon={<CommentOutlined />}
          style={{ position: "fixed", right: 16, bottom: 16, zIndex: 1000 }}
          onClick={() => setOpen(true)}
        />
      )}
    </div>
  );
};

export default CopilotPage;
