import OpenAI from "openai";
import "dotenv/config";
import process from "node:process";

/**
 * Embedding model endpoint configuration
 */
const EMBEDDING_ENDPOINT = {
  baseURL: "https://twkgcktmy8nvnxvy.us-east-1.aws.endpoints.huggingface.cloud",
  apiKey: process.env.Xiaozao_HF_TOKEN, // 使用你的 HuggingFace token
};

/**
 * 根据模型名称获取 API 配置
 * @param {string} model - 模型名称
 * @returns {object} - { baseURL, apiKey }
 */
function getAPIConfig(model) {
  // Qwen 模型 (HuggingFace Inference Endpoint - 不使用 OpenAI 兼容格式)
  if (model.toLowerCase().includes("qwen")) {
    return {
      type: "huggingface-inference",
      baseURL:
        // "https://lgcrae6t7194vp8o.us-east-1.aws.endpoints.huggingface.cloud", // David
        "https://zixh4akrrbmx610k.us-east-1.aws.endpoints.huggingface.cloud", // Xiaozao
      apiKey: process.env.Xiaozao_HF_TOKEN,
    };
  }
  // Llama 模型 (HuggingFace)
  else if (model.toLowerCase().includes("llama")) {
    return {
      type: "openai-compatible",
      baseURL:
        "https://ly27rtwnmzd55etf.us-east-1.aws.endpoints.huggingface.cloud/v1/",
      apiKey: process.env.David_HF_TOKEN,
    };
  }
  // Gemma 模型 (HuggingFace)
  else if (model.toLowerCase().includes("gemma")) {
    return {
      type: "openai-compatible",
      baseURL:
        "https://k168dvr0uu6qznyp.us-east-1.aws.endpoints.huggingface.cloud", // Xiaozao
      apiKey: process.env.Xiaozao_HF_TOKEN,
    };
  } else {
    // OpenAI API
    return {
      type: "openai-compatible",
      baseURL: process.env.OPENAI_BASE_URL,
      apiKey: process.env.OPENAI_API_KEY,
    };
  }
}

/**
 * 调用 AI API 获取回复
 * @param {string} model - 模型名称 (例如: "gpt-4o", "meta-llama/Llama-3.2-1B-Instruct")
 * @param {string} userPrompt - 用户提示
 * @param {string} [systemPrompt] - 系统提示 (可选)
 * @param {object} [options] - 额外配置选项
 * @param {number} [options.temperature] - 温度参数 (0-2)
 * @param {number} [options.max_tokens] - 最大token数
 * @param {object} [options.response_format] - 响应格式 (例如: { type: "json_object" })
 * @returns {Promise<string>} - AI 的回复内容
 */
export async function callAI(
  model,
  userPrompt,
  systemPrompt = null,
  options = {},
) {
  const config = getAPIConfig(model);

  // 如果是 HuggingFace Inference Endpoint (Qwen)
  if (config.type === "huggingface-inference") {
    try {
      // Qwen 模型需要特殊的对话格式
      let inputText;
      if (model.toLowerCase().includes("qwen")) {
        // 使用 Qwen 的对话格式
        if (systemPrompt) {
          inputText = `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${userPrompt}<|im_end|>\n<|im_start|>assistant\n`;
        } else {
          inputText = `<|im_start|>user\n${userPrompt}<|im_end|>\n<|im_start|>assistant\n`;
        }
      } else {
        // 其他模型使用简单拼接
        inputText = userPrompt;
        if (systemPrompt) {
          inputText = `${systemPrompt}\n\n${userPrompt}`;
        }
      }

      const requestBody = {
        inputs: inputText,
        parameters: {
          max_new_tokens: options.max_tokens || 20000, // 增加默认 token 数
          temperature:
            options.temperature !== undefined ? options.temperature : 0.7,
          return_full_text: false,
          do_sample: true, // 启用采样以获得更多样化的输出
          top_p: 0.9,
          repetition_penalty: 1.1,
        },
      };

      console.log(`[HF Inference] Sending request with params:`, {
        max_new_tokens: requestBody.parameters.max_new_tokens,
        temperature: requestBody.parameters.temperature,
        input_length: inputText.length,
        input_preview: inputText.substring(0, 100) + "...",
      });

      const response = await fetch(config.baseURL, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();

      // HuggingFace Inference 返回格式: [{ generated_text: "..." }]
      if (Array.isArray(result) && result[0]) {
        const generatedText = result[0].generated_text;

        // 检查是否为空响应
        if (!generatedText || generatedText.trim() === "") {
          throw new Error(
            `HuggingFace Inference returned empty response. This might indicate:\n` +
              `1. The prompt needs better formatting for ${model}\n` +
              `2. The model endpoint is not ready or has issues\n` +
              `3. Try increasing max_tokens or adjusting temperature\n` +
              `Response: ${JSON.stringify(result)}`,
          );
        }

        return generatedText;
      }

      throw new Error(`Unexpected response format: ${JSON.stringify(result)}`);
    } catch (error) {
      throw new Error(`HuggingFace Inference API 调用失败: ${error.message}`);
    }
  }

  // OpenAI 兼容格式的 API
  const client = new OpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });

  const messages = [];

  // 如果有系统提示，添加到消息列表
  if (systemPrompt) {
    messages.push({
      role: "system",
      content: systemPrompt,
    });
  }

  // 添加用户提示
  messages.push({
    role: "user",
    content: userPrompt,
  });

  try {
    const requestOptions = {
      model: model,
      messages: messages,
      stream: false,
    };

    // 添加可选配置
    if (options.temperature !== undefined) {
      requestOptions.temperature = options.temperature;
    }
    if (options.max_tokens !== undefined) {
      requestOptions.max_tokens = options.max_tokens;
    }
    if (options.response_format !== undefined) {
      requestOptions.response_format = options.response_format;
    }

    const response = await client.chat.completions.create(requestOptions);

    return response.choices[0].message.content;
  } catch (error) {
    throw new Error(`AI API 调用失败: ${error.message}`);
  }
}

/**
 * 调用 AI API 获取流式回复
 * @param {string} model - 模型名称
 * @param {string} userPrompt - 用户提示
 * @param {string} [systemPrompt] - 系统提示 (可选)
 * @param {object} [options] - 额外配置选项
 * @param {number} [options.temperature] - 温度参数 (0-2)
 * @param {number} [options.max_tokens] - 最大token数
 * @param {object} [options.response_format] - 响应格式 (例如: { type: "json_object" })
 * @returns {Promise<AsyncGenerator<string>>} - 流式回复的生成器
 */
export async function callAIStream(
  model,
  userPrompt,
  systemPrompt = null,
  options = {},
) {
  const config = getAPIConfig(model);

  console.log(`Using API base URL: ${config.baseURL}`);

  // HuggingFace Inference Endpoint 不支持流式，使用非流式然后模拟流
  if (config.type === "huggingface-inference") {
    const fullResponse = await callAI(model, userPrompt, systemPrompt, options);

    // 模拟 OpenAI 流式响应格式
    async function* streamGenerator() {
      // 将完整响应分成小块来模拟流式输出
      const chunkSize = 5; // 每次输出5个字符
      for (let i = 0; i < fullResponse.length; i += chunkSize) {
        const chunk = fullResponse.slice(i, i + chunkSize);
        yield {
          choices: [
            {
              delta: {
                content: chunk,
              },
            },
          ],
        };
        // 添加小延迟以模拟网络传输
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    return streamGenerator();
  }

  // OpenAI 兼容格式的流式 API
  const client = new OpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });

  const messages = [];

  if (systemPrompt) {
    messages.push({
      role: "system",
      content: systemPrompt,
    });
  }

  messages.push({
    role: "user",
    content: userPrompt,
  });

  const requestOptions = {
    model: model,
    messages: messages,
    stream: true,
  };

  // 添加可选配置
  if (options.temperature !== undefined) {
    requestOptions.temperature = options.temperature;
  }
  if (options.max_tokens !== undefined) {
    requestOptions.max_tokens = options.max_tokens;
  }
  if (options.response_format !== undefined) {
    requestOptions.response_format = options.response_format;
  }

  const stream = await client.chat.completions.create(requestOptions);

  return stream;
}

/**
 * 获取文本的 embedding 向量
 * @param {string|string[]} texts - 单个文本或文本数组
 * @param {object} [options] - 可选配置
 * @param {boolean} [options.normalize] - 是否归一化向量
 * @returns {Promise<number[]|number[][]>} - embedding 向量或向量数组
 */
export async function getEmbedding(texts, options = {}) {
  const isArray = Array.isArray(texts);

  try {
    const inputTexts = isArray ? texts : [texts];

    // 过滤空文本
    const validTexts = inputTexts.filter((t) => t && t.trim());
    if (validTexts.length === 0) {
      console.warn("All texts are empty, returning null");
      return isArray ? [] : null;
    }

    const requestBody = {
      inputs: validTexts,
      parameters: {
        normalize: options.normalize !== false, // 默认归一化
      },
    };

    const response = await fetch(EMBEDDING_ENDPOINT.baseURL, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${EMBEDDING_ENDPOINT.apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();

    // HuggingFace embedding endpoint 返回格式: [[embedding1], [embedding2], ...]
    if (!Array.isArray(result)) {
      throw new Error(`Unexpected response format: ${JSON.stringify(result)}`);
    }

    // 如果输入是单个文本，返回单个向量；否则返回向量数组
    return isArray ? result : result[0];
  } catch (error) {
    console.error(`Embedding API 调用失败: ${error.message}`);
    return isArray ? [] : null;
  }
}

/**
 * 计算两个向量之间的余弦相似度
 * @param {number[]} vec1 - 第一个向量
 * @param {number[]} vec2 - 第二个向量
 * @returns {number} - 余弦相似度 (0-1)
 */
export function cosineSimilarity(vec1, vec2) {
  if (
    !vec1 ||
    !vec2 ||
    !Array.isArray(vec1) ||
    !Array.isArray(vec2) ||
    vec1.length !== vec2.length
  ) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * 计算一组文本的平均 embedding
 * @param {string[]} texts - 文本数组
 * @returns {Promise<number[]|null>} - 平均 embedding 向量
 */
export async function getAverageEmbedding(texts) {
  if (!texts || texts.length === 0) return null;

  const validTexts = texts.filter((t) => t && t.trim());
  if (validTexts.length === 0) return null;

  // HuggingFace Endpoint 限制：每次最多 32 个文本
  const BATCH_SIZE = 32;
  const allEmbeddings = [];

  // 分批处理
  for (let i = 0; i < validTexts.length; i += BATCH_SIZE) {
    const batch = validTexts.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = await getEmbedding(batch);

    if (batchEmbeddings && batchEmbeddings.length > 0) {
      allEmbeddings.push(...batchEmbeddings);
    }
  }

  if (allEmbeddings.length === 0) return null;

  // Average pooling
  const dim = allEmbeddings[0].length;
  const avgEmbedding = new Array(dim).fill(0);

  allEmbeddings.forEach((emb) => {
    for (let i = 0; i < dim; i++) {
      avgEmbedding[i] += emb[i] / allEmbeddings.length;
    }
  });

  return avgEmbedding;
}
