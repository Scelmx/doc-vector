/**
 * Embedding 模型配置
 * 可通过环境变量覆盖，启动时校验并 fail fast
 *
 * @see https://huggingface.co/onnx-community/Qwen3-Embedding-0.6B-ONNX
 */

/**
 * Qwen3-Embedding-0.6B ONNX（Transformers.js 官方转换，支持 q8 量化）
 * @see https://huggingface.co/onnx-community/Qwen3-Embedding-0.6B-ONNX
 */
const DEFAULT_MODEL = 'onnx-community/Qwen3-Embedding-0.6B-ONNX'

/** q8 量化版约 600MB，内存占用低 */
const DEFAULT_DTYPE = 'q8'

/** Qwen3 检索任务指令（官方推荐英文） */
const DEFAULT_QUERY_TASK =
  'Given a web search query, retrieve relevant passages that answer the query'

/** 允许的量化精度 */
const ALLOWED_DTYPES = ['fp32', 'fp16', 'q8', 'q4', 'int8', 'uint8'] as const

/** 量化精度类型 */
export type EmbeddingDtype = (typeof ALLOWED_DTYPES)[number]

/** 读取环境变量 */
function readEnvString(key: string, fallback: string): string {
  const value = process.env[key]?.trim()
  return value || fallback
}

/** 读取量化精度 */
function readEmbeddingDtype(): EmbeddingDtype {
  const value = process.env.DOCVEC_EMBEDDING_DTYPE?.trim()
  if (!value) return DEFAULT_DTYPE

  if ((ALLOWED_DTYPES as readonly string[]).includes(value)) {
    return value as EmbeddingDtype
  }

  throw new Error(
    `[Config] 无效的 DOCVEC_EMBEDDING_DTYPE="${value}"，可选值: ${ALLOWED_DTYPES.join(', ')}`
  )
}

/** Embedding 配置 */
export const EMBEDDING_CONFIG = {
  /** Hugging Face 模型 ID（Transformers.js ONNX） */
  MODEL: readEnvString('DOCVEC_EMBEDDING_MODEL', DEFAULT_MODEL),
  /** 量化精度，q8 约 600MB，内存占用低 */
  DTYPE: readEmbeddingDtype(),
  /** Qwen3 query 侧检索指令（官方推荐英文） */
  QUERY_TASK: readEnvString('DOCVEC_EMBEDDING_QUERY_TASK', DEFAULT_QUERY_TASK),
} as const
