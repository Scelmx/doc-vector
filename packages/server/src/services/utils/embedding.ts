import { HNSWLib } from '@langchain/community/vectorstores/hnswlib'
import { Document } from '@langchain/core/documents'
import { Pipeline, pipeline } from '@xenova/transformers'

/** 中文检索 Embedding 模型（ONNX） */
const MODEL_NAME = 'Xenova/bge-base-zh-v1.5'

/** BGE 检索时 query 前缀指令 */
const BGE_QUERY_PREFIX = '为这个句子生成表示以用于检索相关文章：'

/**
 * 本地 Embedding 封装（单例 pipeline）
 */
class LocalEmbeddings {
  private pipe: Pipeline | null = null
  private readonly modelName = MODEL_NAME

  /**
   * 懒加载 transformers pipeline
   */
  async initialize() {
    if (!this.pipe) {
      console.log(`[Embedding] 加载本地 embedding 模型: ${this.modelName}...`)
      this.pipe = await pipeline('feature-extraction', this.modelName)
      console.log('[Embedding] 模型加载完成')
    }
    return this.pipe
  }

  /** 将模型输出张量转为 number[] */
  private tensorToVector(output: { data: Float32Array | number[] }): number[] {
    return Array.from(output.data)
  }

  /**
   * 单条文本编码（mean pooling + normalize）
   */
  private async encode(text: string): Promise<number[]> {
    const pipe = await this.initialize()
    const output = await pipe(text, { pooling: 'mean', normalize: true })
    return this.tensorToVector(output)
  }

  /**
   * 批量文档向量化（训练 / Bi-Encoder 重排用）
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = []
    for (const text of texts) {
      embeddings.push(await this.encode(text))
    }
    return embeddings
  }

  /**
   * 用户 query 向量化（带 BGE 检索指令前缀）
   */
  async embedQuery(text: string): Promise<number[]> {
    const queryText = text.startsWith(BGE_QUERY_PREFIX)
      ? text
      : `${BGE_QUERY_PREFIX}${text}`
    return this.encode(queryText)
  }
}

let embeddingsInstance: LocalEmbeddings | null = null

/**
 * 获取 Embedding 单例（全局复用，避免重复加载模型）
 */
export function createEmbeddings(): LocalEmbeddings {
  if (!embeddingsInstance) {
    embeddingsInstance = new LocalEmbeddings()
  }
  return embeddingsInstance
}

/** 适配 LangChain HNSWLib 所需的 embeddings 接口 */
function createEmbeddingsAdapter(embeddings: LocalEmbeddings) {
  return {
    embedDocuments: (texts: string[]) => embeddings.embedDocuments(texts),
    embedQuery: (text: string) => embeddings.embedQuery(text),
  }
}

/**
 * 创建 HNSW 向量库并写入向量
 */
export async function createVectorStore(
  texts: string[],
  metadatas: Array<{ documentId: string; filename: string; chunkIndex?: number; section?: string }>,
  embeddings: LocalEmbeddings,
  _directory: string
): Promise<HNSWLib> {
  const docs = texts.map(
    (text, i) =>
      new Document({
        pageContent: text,
        metadata: metadatas[i],
      })
  )

  // 预计算全部向量后一次性写入索引
  const vectors = await embeddings.embedDocuments(texts)
  if (vectors.length === 0) {
    throw new Error('没有可向量化的文本块')
  }

  const adapter = createEmbeddingsAdapter(embeddings)
  const instance = new HNSWLib(adapter as never, {
    space: 'cosine',
    numDimensions: vectors[0].length,
  })
  await instance.addVectors(vectors, docs)
  return instance
}

/**
 * 从磁盘加载已保存的 HNSW 向量库
 */
export async function loadVectorStore(
  directory: string,
  embeddings: LocalEmbeddings
): Promise<HNSWLib> {
  return await HNSWLib.load(directory, createEmbeddingsAdapter(embeddings) as never)
}
