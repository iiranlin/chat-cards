"use client";

import {
  Attachments,
  Bubble,
  Conversations,
  Prompts,
  Sender,
  Welcome,
  useXAgent,
  useXChat,
  type BubbleProps,
} from "@ant-design/x";
import { createStyles } from "antd-style";
import React, { useEffect } from "react";

import {
  CloudUploadOutlined,
  CommentOutlined,
  EllipsisOutlined,
  FireOutlined,
  HeartOutlined,
  PaperClipOutlined,
  PlusOutlined,
  ReadOutlined,
  ShareAltOutlined,
  SmileOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Badge,
  Button,
  Drawer,
  FloatButton,
  Input,
  Space,
  Switch,
  Typography,
  message,
  type GetProp,
} from "antd";
import { useSearchParams } from "next/navigation";
import {
  buildShareUrl,
  decodeConfigFromURL,
  encodeConfigForURL,
  loadConfigFromLocal,
  saveConfigToLocal,
  deepReplaceMessageVar,
  type OpenApiConfig,
} from "@/lib/config";

const renderTitle = (icon: React.ReactElement, title: string) => (
  <Space align="start">
    {icon}
    <span>{title}</span>
  </Space>
);
// 轻量 Markdown 渲染（无第三方依赖）
function escapeHtmlLite(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function mdToHtmlLite(md: string): string {
  if (!md) return "";
  const fences: string[] = [];
  md = md.replace(/```([\s\S]*?)```/g, (_, p1) => {
    fences.push(`<pre><code>${escapeHtmlLite(p1)}</code></pre>`);
    return `@@FENCE_${fences.length - 1}@@`;
  });
  md = md.replace(
    /`([^`]+)`/g,
    (_, p1) => `<code>${escapeHtmlLite(p1)}</code>`
  );
  md = md.replace(
    /\[([^\]]+)\]\(([^\)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
  );
  md = md.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  md = md.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  md = md
    .replace(/^######\s+(.+)$/gm, "<h6>$1</h6>")
    .replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>")
    .replace(/^####\s+(.+)$/gm, "<h4>$1</h4>")
    .replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
    .replace(/^##\s+(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");
  md = md.replace(/^(?:-\s+.+\n?)+/gm, (block) => {
    const items = block
      .trim()
      .split(/\n/)
      .map((l) => l.replace(/^-\s+/, "").trim());
    return `<ul>${items.map((it) => `<li>${it}</li>`).join("")}</ul>`;
  });
  md = md
    .split(/\n{2,}/)
    .map((para) => {
      if (/^<\/?(h\d|ul|pre|blockquote)/.test(para)) return para;
      return `<p>${para.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");
  md = md.replace(/@@FENCE_(\d+)@@/g, (_, idx) => fences[Number(idx)] || "");
  return md;
}
const renderMarkdown: BubbleProps["messageRender"] = (content) => (
  <Typography>
    {/* biome-ignore lint/security/noDangerouslySetInnerHtml: used intentionally */}
    <div dangerouslySetInnerHTML={{ __html: mdToHtmlLite(content) }} />
  </Typography>
);

const defaultConversationsItems = [
  {
    key: "0",
    label: "What is Ant Design X?",
  },
];

const useStyle = createStyles(({ token, css }) => {
  return {
    layout: css`
      width: 100%;
      min-width: 1000px;
      height: 722px;
      border-radius: ${token.borderRadius}px;
      display: flex;
      background: ${token.colorBgContainer};
      font-family: AlibabaPuHuiTi, ${token.fontFamily}, sans-serif;

      .ant-prompts {
        color: ${token.colorText};
      }
    `,
    menu: css`
      background: ${token.colorBgLayout}80;
      width: 280px;
      height: 100%;
      display: flex;
      flex-direction: column;
    `,
    conversations: css`
      padding: 0 12px;
      flex: 1;
      overflow-y: auto;
    `,
    chat: css`
      height: 100%;
      width: 100%;
      max-width: 700px;
      margin: 0 auto;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      padding: ${token.paddingLG}px;
      gap: 16px;
    `,
    messages: css`
      flex: 1;
    `,
    placeholder: css`
      padding-top: 32px;
    `,
    sender: css`
      box-shadow: ${token.boxShadow};
    `,
    logo: css`
      display: flex;
      height: 72px;
      align-items: center;
      justify-content: start;
      padding: 0 24px;
      box-sizing: border-box;

      img {
        width: 24px;
        height: 24px;
        display: inline-block;
      }

      span {
        display: inline-block;
        margin: 0 8px;
        font-weight: bold;
        color: ${token.colorText};
        font-size: 16px;
      }
    `,
    addBtn: css`
      background: #1677ff0f;
      border: 1px solid #1677ff34;
      width: calc(100% - 24px);
      margin: 0 12px 24px 12px;
    `,
  };
});

const placeholderPromptsItems: GetProp<typeof Prompts, "items"> = [
  {
    key: "1",
    label: renderTitle(
      <FireOutlined style={{ color: "#FF4D4F" }} />,
      "Hot Topics"
    ),
    description: "What are you interested in?",
    children: [
      {
        key: "1-1",
        description: `What's new in X?`,
      },
      {
        key: "1-2",
        description: `What's AGI?`,
      },
      {
        key: "1-3",
        description: `Where is the doc?`,
      },
    ],
  },
  {
    key: "2",
    label: renderTitle(
      <ReadOutlined style={{ color: "#1890FF" }} />,
      "Design Guide"
    ),
    description: "How to design a good product?",
    children: [
      {
        key: "2-1",
        icon: <HeartOutlined />,
        description: `Know the well`,
      },
      {
        key: "2-2",
        icon: <SmileOutlined />,
        description: `Set the AI role`,
      },
      {
        key: "2-3",
        icon: <CommentOutlined />,
        description: `Express the feeling`,
      },
    ],
  },
];

const senderPromptsItems: GetProp<typeof Prompts, "items"> = [
  {
    key: "1",
    description: "Hot Topics",
    icon: <FireOutlined style={{ color: "#FF4D4F" }} />,
  },
  {
    key: "2",
    description: "Design Guide",
    icon: <ReadOutlined style={{ color: "#1890FF" }} />,
  },
];

const roles: GetProp<typeof Bubble.List, "roles"> = {
  ai: {
    placement: "start",
    typing: { step: 5, interval: 20 },
    styles: {
      content: {
        borderRadius: 16,
      },
    },
  },
  local: {
    placement: "end",
    variant: "shadow",
  },
};

const Independent: React.FC = () => {
  // ==================== Style ====================
  const { styles } = useStyle();

  // ==================== State ====================
  const [headerOpen, setHeaderOpen] = React.useState(false);

  const [content, setContent] = React.useState("");

  const [conversationsItems, setConversationsItems] = React.useState(
    defaultConversationsItems
  );

  const [activeKey, setActiveKey] = React.useState(
    defaultConversationsItems[0].key
  );

  const [attachedFiles, setAttachedFiles] = React.useState<
    GetProp<typeof Attachments, "items">
  >([]);

  // ==================== OpenAPI Config（UI only） ====================
  const searchParams = useSearchParams();
  const [openApiConfig, setOpenApiConfig] =
    React.useState<OpenApiConfig | null>(null);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [shareIncludeApiKey, setShareIncludeApiKey] = React.useState(false);
  const [shareOmitSpec, setShareOmitSpec] = React.useState(false);
  const [shareUrl, setShareUrl] = React.useState("");

  // 流式与思考过程可视化
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [thinkingText, setThinkingText] = React.useState("");
  const [answerText, setAnswerText] = React.useState("");
  const answerRef = React.useRef("");
  const thinkingRef = React.useRef("");
  useEffect(() => {
    answerRef.current = answerText;
  }, [answerText]);
  useEffect(() => {
    thinkingRef.current = thinkingText;
  }, [thinkingText]);

  // 初始化：优先加载本地配置
  useEffect(() => {
    const local = loadConfigFromLocal();
    if (local) setOpenApiConfig(local);
  }, []);

  // 解析 URL 中的 cfg 参数并合并到配置（默认不覆盖已有 apiKey）
  useEffect(() => {
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
    // 不清理 URL，以便用户可复制
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const rebuildShareUrl = React.useCallback(
    (cfg: OpenApiConfig, includeKey: boolean, omitSpec: boolean) => {
      const encoded = encodeConfigForURL(cfg, {
        includeApiKey: includeKey,
        omitSpec,
      });
      return buildShareUrl(encoded);
    },
    []
  );

  useEffect(() => {
    if (!openApiConfig) return;
    setShareUrl(
      rebuildShareUrl(openApiConfig, shareIncludeApiKey, shareOmitSpec)
    );
  }, [openApiConfig, shareIncludeApiKey, shareOmitSpec, rebuildShareUrl]);

  const openShare = () => {
    if (!openApiConfig) {
      message.warning("请先在配置页填写 OpenAPI 配置");
      return;
    }
    setShareOpen(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      message.success("分享链接已复制");
    } catch {
      message.error("复制失败，请手动复制");
    }
  };

  const handleWebShare = async () => {
    if (!openApiConfig) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Chat Config", url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        message.success("已复制分享链接");
      }
    } catch {}
  };

  // ==================== Runtime ====================
  const [agent] = useXAgent({
    request: async ({ message: userMsg }, { onSuccess, onError }) => {
      try {
        const cfg = openApiConfig ?? loadConfigFromLocal();
        if (!cfg?.baseUrl) {
          onError?.(new Error("未检测到 API 配置，请先到 /config 填写"));
          message.warning("未检测到 API 配置，请先到配置页填写");
          return;
        }
        const { baseUrl, apiKey, spec } = cfg;
        const clean = baseUrl.replace(/\/+$/, "");
        const endpoint = /\/chat\/completions$/.test(clean)
          ? clean
          : `${clean}/chat/completions`;

        const buildAuthHeader = (key?: string) => {
          if (!key) return {} as Record<string, string>;
          const k = key.trim();
          const val = k.toLowerCase().startsWith("bearer ") ? k : `Bearer ${k}`;
          return { Authorization: val } as Record<string, string>;
        };

        let baseBody: any = {};
        if (spec && typeof spec === "object")
          baseBody = deepReplaceMessageVar(spec, userMsg ?? "");

        // 若用户未在 JSON 中定义 messages，则回退到默认
        if (!baseBody.messages) {
          baseBody.messages = [{ role: "user", content: userMsg }];
        }
        if (!baseBody.model) baseBody.model = "glm-4.5";

        const useStream = baseBody.stream === true;
        // 流式：展示“思考中/增量回答”
        if (useStream) {
          setIsStreaming(true);
          setThinkingText("");
          setAnswerText("");
        }

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(useStream ? { Accept: "text/event-stream" } : {}),
            ...buildAuthHeader(apiKey),
          },
          body: JSON.stringify(baseBody),
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
                if (t) setThinkingText((prev) => prev + String(t));
                if (c) setAnswerText((prev) => prev + String(c));
              } catch {}
            }
          }
          setIsStreaming(false);
          onSuccess(answerRef.current || "");
        } else {
          const data = await resp.json();
          const content =
            data?.choices?.[0]?.message?.content ||
            data?.data ||
            data?.output ||
            "";
          if (!content) throw new Error("接口未返回可用的 content");
          onSuccess(content);
        }
      } catch (e: any) {
        const errMsg = e?.message || "请求失败";
        message.error(errMsg);
        onError?.(new Error(errMsg));
      }
    },
  });

  const { onRequest, messages, setMessages } = useXChat({
    agent,
  });

  useEffect(() => {
    if (activeKey !== undefined) {
      setMessages([]);
    }
  }, [activeKey]);

  // ==================== Event ====================
  const onSubmit = (nextContent: string) => {
    if (!nextContent) return;
    // 将用户输入替换到智谱请求体中：在 request 中已使用 messages: [{ role: 'user', content: userMsg }]
    // 这里直接把 nextContent 交给 onRequest 即可
    onRequest(nextContent);
    setContent("");
  };

  const onPromptsItemClick: GetProp<typeof Prompts, "onItemClick"> = (info) => {
    onRequest(info.data.description as string);
  };

  const onAddConversation = () => {
    setConversationsItems([
      ...conversationsItems,
      {
        key: `${conversationsItems.length}`,
        label: `New Conversation ${conversationsItems.length}`,
      },
    ]);
    setActiveKey(`${conversationsItems.length}`);
  };

  const onConversationClick: GetProp<typeof Conversations, "onActiveChange"> = (
    key
  ) => {
    setActiveKey(key);
  };

  const handleFileChange: GetProp<typeof Attachments, "onChange"> = (info) =>
    setAttachedFiles(info.fileList);

  // ==================== Nodes ====================
  const placeholderNode = (
    <Space direction="vertical" size={16} className={styles.placeholder}>
      <Welcome
        variant="borderless"
        icon="https://mdn.alipayobjects.com/huamei_iwk9zp/afts/img/A*s5sNRo5LjfQAAAAAAAAAAAAADgCCAQ/fmt.webp"
        title="Hello, I'm Ant Design X"
        description="Base on Ant Design, AGI product interface solution, create a better intelligent vision~"
        extra={
          <Space>
            <Button icon={<ShareAltOutlined />} />
            <Button icon={<EllipsisOutlined />} />
          </Space>
        }
      />
      <Prompts
        title="Do you want?"
        items={placeholderPromptsItems}
        styles={{
          list: {
            width: "100%",
          },
          item: {
            flex: 1,
          },
        }}
        onItemClick={onPromptsItemClick}
      />

      {/* 🌟 配置状态提示（仅前端）*/}
      {openApiConfig ? (
        <Alert
          type="success"
          showIcon
          message={
            <Typography.Text>
              {/* 思考过程展示 + 流式答案（简化版） */}
              {thinkingText && (
                <Alert
                  type="info"
                  showIcon
                  message="思考过程"
                  description={
                    <div style={{ whiteSpace: "pre-wrap" }}>{thinkingText}</div>
                  }
                />
              )}
              {isStreaming && answerText && (
                <Alert
                  type="success"
                  showIcon
                  message="AI 正在回答（预览）"
                  description={<MarkdownLite text={answerText} />}
                />
              )}
              已加载 OpenAPI 配置：
              <Typography.Text code>{openApiConfig.baseUrl}</Typography.Text>
            </Typography.Text>
          }
        />
      ) : (
        <Alert
          type="warning"
          showIcon
          message={
            <Space>
              未检测到 OpenAPI 配置，
              <Button type="link" href="/config" size="small">
                去配置
              </Button>
            </Space>
          }
        />
      )}

      {/* 🌟 右下角快捷入口 */}
      {/* 分享 */}
      <FloatButton
        type="primary"
        icon={<ShareAltOutlined />}
        onClick={openShare}
      />
      {/* 配置 */}
      <FloatButton
        shape="circle"
        icon={<SettingOutlined />}
        onClick={() => (window.location.href = "/config")}
        style={{ right: 88 }}
        tooltip="OpenAPI 配置"
      />
      <Drawer
        title="分享此聊天配置"
        placement="right"
        width={360}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <Typography.Paragraph type="secondary">
            默认不包含 API Key。若需包含，请谨慎勾选。
          </Typography.Paragraph>
          <Space>
            <Switch
              checked={shareIncludeApiKey}
              onChange={setShareIncludeApiKey}
            />
            <Typography.Text>在链接中包含 API Key（不安全）</Typography.Text>
          </Space>
          <Space>
            <Switch checked={shareOmitSpec} onChange={setShareOmitSpec} />
            <Typography.Text>
              省略 OpenAPI 规范（链接更短，但接收方需本地已有）
            </Typography.Text>
          </Space>
          <Input.TextArea rows={4} value={shareUrl} readOnly />
          <Space>
            <Button type="primary" onClick={handleCopy}>
              复制链接
            </Button>
            <Button onClick={handleWebShare}>系统分享</Button>
          </Space>
        </Space>
      </Drawer>
    </Space>
  );

  const items: GetProp<typeof Bubble.List, "items"> = messages.map(
    ({ id, message, status }) => ({
      key: id,
      loading: status === "loading",
      role: status === "local" ? "local" : "ai",
      content: message,
      // 使用 Bubble 的 messageRender，保留打字机效果
      messageRender: renderMarkdown,
    })
  );

  const attachmentsNode = (
    <Badge dot={attachedFiles.length > 0 && !headerOpen}>
      <Button
        type="text"
        icon={<PaperClipOutlined />}
        onClick={() => setHeaderOpen(!headerOpen)}
      />
    </Badge>
  );

  const senderHeader = (
    <Sender.Header
      title="Attachments"
      open={headerOpen}
      onOpenChange={setHeaderOpen}
      styles={{
        content: {
          padding: 0,
        },
      }}
    >
      <Attachments
        beforeUpload={() => false}
        items={attachedFiles}
        onChange={handleFileChange}
        placeholder={(type) =>
          type === "drop"
            ? { title: "Drop file here" }
            : {
                icon: <CloudUploadOutlined />,
                title: "Upload files",
                description: "Click or drag files to this area to upload",
              }
        }
      />
    </Sender.Header>
  );

  const logoNode = (
    <div className={styles.logo}>
      <img
        src="https://mdn.alipayobjects.com/huamei_iwk9zp/afts/img/A*eco6RrQhxbMAAAAAAAAAAAAADgCCAQ/original"
        draggable={false}
        alt="logo"
      />
      <span>Ant Design X</span>
    </div>
  );

  // ==================== Render =================
  return (
    <div className={styles.layout}>
      <div className={styles.menu}>
        {/* 🌟 Logo */}
        {logoNode}
        {/* 🌟 添加会话 */}
        <Button
          onClick={onAddConversation}
          type="link"
          className={styles.addBtn}
          icon={<PlusOutlined />}
        >
          New Conversation
        </Button>
        {/* 🌟 会话管理 */}
        <Conversations
          items={conversationsItems}
          className={styles.conversations}
          activeKey={activeKey}
          onActiveChange={onConversationClick}
        />
      </div>
      <div className={styles.chat}>
        {/* 🌟 消息列表 */}
        <Bubble.List
          items={
            items.length > 0
              ? items
              : [{ content: placeholderNode, variant: "borderless" }]
          }
          roles={roles}
          className={styles.messages}
        />
        {/* 🌟 提示词 */}
        <Prompts items={senderPromptsItems} onItemClick={onPromptsItemClick} />
        {/* 🌟 输入框 */}
        <Sender
          value={content}
          header={senderHeader}
          onSubmit={onSubmit}
          onChange={setContent}
          prefix={attachmentsNode}
          loading={agent.isRequesting()}
          className={styles.sender}
        />
      </div>
    </div>
  );
};

export default Independent;
