"use client";

import React from "react";
import {
  Button,
  Divider,
  Form,
  Input,
  Space,
  Typography,
  Flex,
  Alert,
  message,
} from "antd";
import { SaveOutlined, PlayCircleOutlined } from "@ant-design/icons";
import {
  saveConfigToLocal,
  type OpenApiConfig,
  encodeConfigForURL,
  buildShareUrl,
} from "@/lib/config";

/**
 * OpenAPI 配置页面（仅前端 UI）
 * - 用户可填写 Base URL / API Key / OpenAPI 规范(JSON)
 * - 校验基本字段与 JSON 格式
 * - 保存至 localStorage
 * - 支持快捷跳转到聊天页
 */

const { Title, Text, Paragraph } = Typography;

const DEFAULT_SPEC_PLACEHOLDER = `{
  "openapi": "3.0.0",
  "info": { "title": "Demo API", "version": "1.0.0" },
  "paths": {}
}`;

export default function ConfigPage() {
  const [form] = Form.useForm();
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  const onSave = async (goChat?: boolean) => {
    try {
      const values = await form.validateFields();
      const { baseUrl, apiKey, specText } = values as {
        baseUrl: string;
        apiKey?: string;
        specText: string;
      };

      // JSON 配置改为可选：留空则使用空对象；填写时需为合法 JSON
      let spec: any = {};
      if (specText && specText.trim()) {
        try {
          spec = JSON.parse(specText);
          setJsonError(null);
        } catch (e) {
          setJsonError("JSON 解析失败，请检查格式，或清空此项。");
          return;
        }
      }

      const cfg: OpenApiConfig = {
        baseUrl: baseUrl.trim(),
        apiKey: (apiKey || "").trim() || undefined,
        spec,
        updatedAt: Date.now(),
      };

      saveConfigToLocal(cfg);
      message.success("配置已保存到本地。");

      if (goChat) {
        // 跳转到首页聊天
        window.location.href = "/";
      }
    } catch (err) {
      // 校验错误
    }
  };

  const onShare = async () => {
    try {
      const values = await form.validateFields();
      const { baseUrl, apiKey, specText } = values as any;
      let spec: any;
      try {
        spec = JSON.parse(specText);
      } catch {
        setJsonError("OpenAPI JSON 解析失败，请检查格式。");
        return;
      }
      const cfg: OpenApiConfig = {
        baseUrl: baseUrl.trim(),
        apiKey: (apiKey || "").trim() || undefined,
        spec,
        updatedAt: Date.now(),
      };
      // 出于安全考虑，默认分享链接不包含 apiKey，可在确认后再包含
      const encoded = encodeConfigForURL(cfg, {
        includeApiKey: false,
        omitSpec: false,
      });
      const url = buildShareUrl(encoded);

      if (navigator.share) {
        try {
          await navigator.share({ title: "Chat Config", url });
          return;
        } catch {}
      }

      await navigator.clipboard.writeText(url);
      message.success("分享链接已复制到剪贴板");
    } catch {}
  };

  return (
    <Flex
      vertical
      gap={16}
      style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}
    >
      <Title level={3}>OpenAPI 配置</Title>
      <Text type="secondary">
        仅前端存储（localStorage），请勿在公共环境泄露 API Key。
      </Text>

      <Divider />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          baseUrl: "https://api.example.com",
          apiKey: "",
          specText: DEFAULT_SPEC_PLACEHOLDER,
        }}
      >
        <Form.Item
          label="Base URL"
          name="baseUrl"
          rules={[{ required: true, message: "请输入 Base URL" }]}
          tooltip="接口服务地址，例如 https://api.example.com"
        >
          <Input placeholder="https://api.example.com" allowClear />
        </Form.Item>

        <Form.Item
          label="API Key（可选）"
          name="apiKey"
          tooltip="私密信息，默认不会出现在分享链接中"
        >
          <Input.Password placeholder="在本地保存，不会上传服务器" allowClear />
        </Form.Item>

        <Form.Item label="OpenAPI JSON（可选）" name="specText">
          <Input.TextArea rows={12} placeholder={DEFAULT_SPEC_PLACEHOLDER} />
        </Form.Item>

        {jsonError && (
          <Alert
            type="error"
            message={jsonError}
            showIcon
            closable
            onClose={() => setJsonError(null)}
          />
        )}

        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => onSave(false)}
          >
            保存配置
          </Button>
          <Button icon={<PlayCircleOutlined />} onClick={() => onSave(true)}>
            保存并进入聊天
          </Button>
          <Button onClick={onShare}>复制分享链接</Button>
        </Space>
      </Form>

      <Divider />

      <Paragraph>
        提示：分享链接默认包含 Base URL 与 OpenAPI 规范，不包含 API
        Key。接收方打开后会直接进入聊天页，页面会自动读取链接中的配置或本地配置。
      </Paragraph>
    </Flex>
  );
}
