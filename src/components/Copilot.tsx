"use client";

import React, { useRef, useState } from "react";
import { createStyles } from "antd-style";
import {
  Attachments,
  Bubble,
  Prompts,
  Sender,
  Suggestion,
  Welcome,
  useXChat,
  useXAgent,
} from "@ant-design/x";
import type { Conversation } from "@ant-design/x/es/conversations";
import { Button, Space, Spin, type GetProp } from "antd";
import {
  CloseOutlined,
  CloudUploadOutlined,
  PaperClipOutlined,
  PlusOutlined,
  ShareAltOutlined,
  CommentOutlined,
} from "@ant-design/icons";
import { loadConfigFromLocal, deepReplaceMessageVar } from "@/lib/config";

const useCopilotStyle = createStyles(({ token, css }) => ({
  wrapper: css`
    position: fixed;
    top: 16px;
    right: 16px;
    bottom: 16px;
    width: 400px;
    z-index: 1000;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: ${token.boxShadow};
    background: ${token.colorBgContainer};
    color: ${token.colorText};
    display: flex;
    flex-direction: column;
  `,
  header: css`
    height: 48px;
    border-bottom: 1px solid ${token.colorBorderSecondary};
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    font-weight: 600;
  `,
  conversations: css`
    width: 320px;
    .ant-conversations-list {
      padding-inline-start: 0;
    }
  `,
  chatList: css`
    flex: 1;
    overflow: auto;
    padding: 12px;
  `,
  loadingMessage: css`
    background-image: linear-gradient(
      90deg,
      #ff6b23 0%,
      #af3cb8 31%,
      #53b6ff 89%
    );
    background-size: 100% 2px;
    background-repeat: no-repeat;
    background-position: bottom;
  `,
  senderBox: css`
    padding: 12px;
  `,
}));

export interface CopilotProps {
  open: boolean;
  onClose: () => void;
  onShare?: () => void;
}

const DEFAULT_SESSIONS: Conversation[] = [
  { key: "s0", label: "New session", group: "Today" },
];

const SUGGESTS = [
  { label: "Upgrades", value: "What has Ant Design X upgraded?" },
  { label: "Components", value: "What components are in Ant Design X?" },
  {
    label: "How to install",
    value: "How to quickly install and import components?",
  },
];

const Copilot: React.FC<CopilotProps> = ({ open, onClose, onShare }) => {
  const { styles } = useCopilotStyle();
  const attachmentsRef = useRef<any>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [messageHistory, setMessageHistory] = useState<Record<string, any[]>>(
    {}
  );
  const [sessions, setSessions] = useState<Conversation[]>(DEFAULT_SESSIONS);
  const [cur, setCur] = useState<string>(DEFAULT_SESSIONS[0].key);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [files, setFiles] = useState<GetProp<typeof Attachments, "items">>([]);
  const [input, setInput] = useState("");

  const [agent] = useXAgent<string>({
    request: async ({ message }, { onSuccess, onError }) => {
      try {
        const cfg = loadConfigFromLocal();
        if (!cfg?.baseUrl) {
          onError?.(new Error("未检测到 API 配置"));
          return;
        }
        const { baseUrl, apiKey, spec } = cfg;
        const clean = baseUrl.replace(/\/+$/, "");
        const endpoint = /\/chat\/completions$/.test(clean)
          ? clean
          : `${clean}/chat/completions`;

        let baseBody: any = {};
        if (spec && typeof spec === "object")
          baseBody = deepReplaceMessageVar(spec, message ?? "");
        if (!baseBody.messages)
          baseBody.messages = [{ role: "user", content: message }];
        if (!baseBody.model) baseBody.model = "glm-4.5";

        // 支持中断：保存 controller
        const controller = new AbortController();
        abortRef.current?.abort();
        abortRef.current = controller;

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(baseBody.stream ? { Accept: "text/event-stream" } : {}),
            ...(apiKey
              ? {
                  Authorization: apiKey.toLowerCase().startsWith("bearer ")
                    ? apiKey
                    : `Bearer ${apiKey}`,
                }
              : {}),
          },
          body: JSON.stringify(baseBody),
          signal: controller.signal,
        });
        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${text}`);
        }
        if (baseBody.stream && resp.body) {
          const reader = resp.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let t = "";
          let c = "";
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
                t += String(delta?.reasoning_content || "");
                c += String(delta?.content || "");
              } catch {}
            }
          }
          const final = [t ? `<think>${t}</think>` : "", c]
            .filter(Boolean)
            .join("\n\n");
          onSuccess(final || c || "");
        } else {
          const data = await resp.json();
          const choice = data?.choices?.[0];
          const content =
            choice?.message?.content || data?.data || data?.output || "";
          const reasoning =
            choice?.message?.reasoning_content || data?.reasoning_content || "";
          const final = [
            reasoning ? `<think>${reasoning}</think>` : "",
            content,
          ]
            .filter(Boolean)
            .join("\n\n");
          onSuccess(final || content);
        }
      } catch (e: any) {
        onError?.(new Error(e?.message || "请求失败"));
      }
    },
  });
  const loading = agent.isRequesting();

  const { messages, onRequest, setMessages } = useXChat({
    agent,
    requestFallback: (_, { error }) => {
      if ((error as any)?.name === "AbortError") return "Request is aborted";
      return "Request failed, please try again!";
    },
  });

  const handleSubmit = (val: string) => {
    if (!val) return;
    onRequest(val);
    if (sessions.find((i) => i.key === cur)?.label === "New session") {
      setSessions(
        sessions.map((i) =>
          i.key === cur ? { ...i, label: val.slice(0, 20) } : i
        )
      );
    }
  };

  const header = (
    <div className={styles.header}>
      <span>✨ AI Copilot</span>
      <Space size={0}>
        <Button
          type="text"
          icon={<PlusOutlined />}
          onClick={() => {
            if (agent?.isRequesting?.()) return;
            const key = String(Date.now());
            abortRef.current?.abort();
            setTimeout(() => {
              setSessions([
                { key, label: "New session", group: "Today" },
                ...sessions,
              ]);
              setCur(key);
              setMessages([]);
            }, 100);
          }}
        />
        <Button
          type="text"
          icon={<CommentOutlined />}
          onClick={() => {
            // quick switch popover could be added here; keep simple now
          }}
        />
        <Button type="text" icon={<ShareAltOutlined />} onClick={onShare} />
        <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
      </Space>
    </div>
  );

  const list = (
    <div className={styles.chatList}>
      {messages?.length ? (
        <Bubble.List
          style={{ height: "100%" }}
          items={messages.map((i: any) => ({
            ...i.message,
            classNames: {
              content: i.status === "loading" ? styles.loadingMessage : "",
            },
            typing: i.status === "loading" ? { step: 5, interval: 20 } : false,
          }))}
          roles={{
            assistant: {
              placement: "start",
              loadingRender: () => <Spin size="small" />,
            },
            user: { placement: "end" },
          }}
        />
      ) : (
        <>
          <Welcome
            variant="borderless"
            title="👋 Hello, I'm Ant Design X"
            description="Base on Ant Design, AGI product interface solution, create a better intelligent vision~"
          />
          <Prompts
            title="I can help:"
            items={SUGGESTS.map((i) => ({
              key: i.value,
              description: i.value,
            }))}
            onItemClick={(info) =>
              handleSubmit(String(info?.data?.description || ""))
            }
          />
        </>
      )}
    </div>
  );

  const sender = (
    <div className={styles.senderBox}>
      <Suggestion
        items={SUGGESTS.map((i) => ({ label: i.label, value: i.value }))}
        onSelect={(v) => setInput(`[${v}]:`)}
      >
        {({ onTrigger, onKeyDown }) => (
          <Sender
            value={input}
            loading={loading}
            onChange={(v) => {
              onTrigger(v === "/");
              setInput(v);
            }}
            onSubmit={() => {
              handleSubmit(input);
              setInput("");
            }}
            onCancel={() => abortRef.current?.abort()}
            header={
              <Sender.Header
                title="Upload File"
                open={attachmentsOpen}
                onOpenChange={setAttachmentsOpen}
                styles={{ content: { padding: 0 } }}
              >
                <Attachments
                  ref={attachmentsRef}
                  beforeUpload={() => false}
                  items={files}
                  onChange={({ fileList }) => setFiles(fileList as any)}
                  placeholder={(type) =>
                    type === "drop"
                      ? { title: "Drop file here" }
                      : {
                          icon: <CloudUploadOutlined />,
                          title: "Upload files",
                          description:
                            "Click or drag files to this area to upload",
                        }
                  }
                />
              </Sender.Header>
            }
            prefix={
              <Button
                type="text"
                icon={<PaperClipOutlined />}
                onClick={() => setAttachmentsOpen(!attachmentsOpen)}
              />
            }
            actions={(_, info) => {
              const { SendButton, LoadingButton } = info.components;
              return (
                <Space>
                  {loading ? (
                    <LoadingButton type="default" />
                  ) : (
                    <SendButton type="primary" />
                  )}
                </Space>
              );
            }}
            placeholder="Ask or input / use skills"
            onKeyDown={onKeyDown}
          />
        )}
      </Suggestion>
    </div>
  );

  if (!open) return null;
  return (
    <div className={styles.wrapper}>
      {header}
      {list}
      {sender}
    </div>
  );
};

export default Copilot;
