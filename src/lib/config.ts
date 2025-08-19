/**
 * OpenAPI 配置工具集合（仅前端 UI 使用）
 * - 本模块负责：
 *   1) 定义配置类型
 *   2) localStorage 存取
 *   3) URL base64url 编解码（用于分享链接）
 *
 * 注意：切勿默认在分享链接中包含 API Key。应让用户手动勾选并提示风险。
 */

export type OpenApiConfig = {
  /** OpenAPI 服务基础地址，例如 https://api.example.com */
  baseUrl: string;
  /** 可选：私密信息，链接分享默认不包含 */
  apiKey?: string;
  /** 可选：用户填写的请求 JSON（将作为基础，支持占位符替换） */
  spec?: Record<string, any>;
  /** 更新时间（毫秒） */
  updatedAt: number;
};

const STORAGE_KEY = "chat-cards.openapi.config";

/** 简单判断对象是否看起来像 OpenAPI 规范 */
export function looksLikeOpenApiSpec(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  // OpenAPI 3.x 一般有 openapi 字段；Swagger 2.0 一般有 swagger 字段
  return typeof obj.openapi === "string" || typeof obj.swagger === "string";
}

/** 读取本地配置（localStorage） */
export function loadConfigFromLocal(): OpenApiConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw) as OpenApiConfig;
    if (!cfg || !cfg.baseUrl) return null;
    return cfg;
  } catch {
    return null;
  }
}

/** 保存配置到本地（localStorage） */
export function saveConfigToLocal(cfg: OpenApiConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    // 忽略存储异常（例如容量不足）
  }
}

/** Base64 URL-Safe 编码（Buffer/浏览器多环境兼容） */
export function toBase64Url(input: string): string {
  try {
    if (typeof Buffer !== "undefined") {
      const b = Buffer.from(input, "utf-8").toString("base64");
      return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }
  } catch {}
  // 浏览器 fallback（使用 btoa + UTF-8 转义）
  const b64 = (globalThis as any).btoa
    ? (globalThis as any).btoa(unescape(encodeURIComponent(input)))
    : "";
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Base64 URL-Safe 解码（Buffer/浏览器多环境兼容） */
export function fromBase64Url(input: string): string {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  try {
    if (typeof Buffer !== "undefined") {
      // @ts-ignore
      return Buffer.from(b64, "base64").toString("utf-8");
    }
  } catch {}
  const raw = (globalThis as any).atob ? (globalThis as any).atob(b64) : "";
  try {
    // 将 raw 的 UTF-8 字符串还原
    return decodeURIComponent(
      raw
        .split("")
        .map((c: string) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
  } catch {
    return raw;
  }
}

/**
 * 将配置（可选择包含 apiKey）编码为 URL 片段
 * 说明：OpenAPI 规范可能很大，链接长度可能过长。建议仅在本地使用或适度裁剪。
 */
export function encodeConfigForURL(
  cfg: OpenApiConfig,
  opts?: { includeApiKey?: boolean; omitSpec?: boolean }
): string {
  const { includeApiKey = false, omitSpec = false } = opts || {};
  const payload: Partial<OpenApiConfig> = {
    baseUrl: cfg.baseUrl,
    updatedAt: cfg.updatedAt,
  };
  if (!omitSpec) payload.spec = cfg.spec; // 谨慎：可能导致链接过长
  if (includeApiKey && cfg.apiKey) payload.apiKey = cfg.apiKey;
  return toBase64Url(JSON.stringify(payload));
}

/** 从 URL 片段解码配置 */
export function decodeConfigFromURL(
  encoded: string
): Partial<OpenApiConfig> | null {
  try {
    const json = fromBase64Url(encoded);
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== "object") return null;
    return obj as Partial<OpenApiConfig>;
  } catch {
    return null;
  }
}

/** 构造当前站点下的分享链接 */
export function buildShareUrl(encodedCfg: string): string {
  if (typeof window === "undefined") return `/?cfg=${encodedCfg}`;
  const url = new URL(window.location.href);
  url.pathname = "/";
  url.search = `?cfg=${encodedCfg}`;
  return url.toString();
}

/**
 * 深度替换工具：将对象内所有 string 中的 {{ message }} 替换为指定内容
 * - 仅处理字符串值；不会替换键名
 * - 保持原对象不可变，返回新对象
 */
export function deepReplaceMessageVar<T = any>(
  input: T,
  userMessage: string
): T {
  const RE = /\{\{\s*message\s*\}\}/g;
  const seen = new WeakMap();
  const walk = (val: any): any => {
    if (val == null) return val;
    const t = typeof val;
    if (t === "string") return val.replace(RE, userMessage);
    if (t !== "object") return val;
    if (seen.has(val)) return seen.get(val);
    if (Array.isArray(val)) {
      const arr = val.map((v) => walk(v));
      return arr;
    }
    const obj: Record<string, any> = {};
    seen.set(val, obj);
    for (const k of Object.keys(val)) obj[k] = walk(val[k]);
    return obj;
  };
  return walk(input);
}
