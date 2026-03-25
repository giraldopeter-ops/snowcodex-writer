import { NextResponse } from "next/server";

type Provider = "anthropic" | "openai";

type ScenePlan = {
  chapter: string;
  title: string;
  goal: string;
  conflict: string;
  hook: string;
};

type MemoryEntry = {
  type: string;
  name: string;
  notes: string;
  status: string;
};

type ChapterRecap = {
  chapter: string;
  title: string;
  summary: string;
  carry: string;
};

type StudioPayload = {
  projectName: string;
  genre: string;
  targetReaders: string;
  sellingPoint: string;
  styleNorthStar: string;
  masterOutline: string;
  snowflakePremise: string;
  oneLine: string;
  oneParagraph: string;
  endingPromise: string;
  chapterArcs: string;
  scenes: ScenePlan[];
  memory: MemoryEntry[];
  recaps: ChapterRecap[];
  provider: Provider;
  model: string;
  currentChapter: string;
  currentChapterTitle: string;
  currentGoal: string;
  currentConflict: string;
  currentMustHit: string;
  currentNotes: string;
  wordTarget: number;
  rewriteGoal: string;
};

type RequestBody = {
  action: "snowflake" | "chapter" | "rewrite" | "recap";
  payload: StudioPayload;
  chapterOutput?: string;
  rewriteSource?: string;
};

type PromptPair = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
};

const WRITING_RULES = [
  "只用简体中文输出。",
  "目标是写出自然、具体、有场景感、有情绪惯性的中文网文正文。",
  "不要写空泛总结、鸡汤式句子、说明书口气、套路化过渡句。",
  "不要把大纲原句机械搬进正文，也不要解释自己在遵循大纲。",
  "优先用动作、细节、对话和人物选择推进剧情。",
  "保持人物动机、设定事实、时间顺序和因果关系一致。",
  "章节结尾优先给出悬念、代价、反转、新压力或新机会，不要写成总结报告。",
  "不要模仿任何具体作品、具体作者或可识别的版权表达，只吸收高节奏网文的一般叙事规律。",
].join("\n");

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const { action, payload, chapterOutput = "", rewriteSource = "" } = body;

    const prompt = buildPrompts(action, payload, chapterOutput, rewriteSource);
    const text = await callModel(payload.provider, payload.model, prompt);

    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "服务器错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildPrompts(
  action: RequestBody["action"],
  payload: StudioPayload,
  chapterOutput: string,
  rewriteSource: string,
): PromptPair {
  if (action === "snowflake") {
    return buildSnowflakePrompts(payload);
  }

  if (action === "chapter") {
    return buildChapterPrompts(payload);
  }

  if (action === "rewrite") {
    return buildRewritePrompts(payload, rewriteSource || chapterOutput);
  }

  return buildRecapPrompts(payload, chapterOutput);
}

function buildSnowflakePrompts(payload: StudioPayload): PromptPair {
  const systemPrompt = [
    "你是中文长篇网络小说策划助手。",
    WRITING_RULES,
    "任务是把用户已有的总大纲与雪花法素材收拢成更可写的结构，不要空谈概念。",
    "你必须输出 JSON，不要输出 JSON 之外的任何说明。",
  ].join("\n\n");

  const userPrompt = `
请根据下面资料，生成一个“更可写、更自然推进”的结构方案。

输出 JSON，格式如下：
{
  "summary": "一句话说明结构策略",
  "chapterArcs": "用 Markdown 列出卷级和章节级推进",
  "scenes": [
    {
      "chapter": "第1章",
      "title": "场景标题",
      "goal": "这一场要推进什么",
      "conflict": "冲突来自哪里",
      "hook": "这一章结尾留什么钩子"
    }
  ]
}

要求：
1. 章节与场景要服务总大纲，但不要把总大纲拆成生硬提纲。
2. 先把开篇 12 个高价值场景排出来，适合直接开写。
3. 每个场景都要有明确推进、冲突和章末钩子。
4. 允许做合理补全，但不能违背用户已有设定。

项目名：${payload.projectName}
题材：${payload.genre}
目标读者：${payload.targetReaders}
卖点：${payload.sellingPoint}
风格北极星：${payload.styleNorthStar}

总大纲：
${payload.masterOutline || "暂无"}

雪花前提：
${payload.snowflakePremise || "暂无"}

一句话版本：
${payload.oneLine || "暂无"}

一段话版本：
${payload.oneParagraph || "暂无"}

终局承诺：
${payload.endingPromise || "暂无"}
`.trim();

  return {
    systemPrompt,
    userPrompt,
    maxTokens: 3200,
  };
}

function buildChapterPrompts(payload: StudioPayload): PromptPair {
  const relevantScenes = payload.scenes.filter(
    (scene) =>
      scene.chapter.includes(payload.currentChapter) ||
      payload.currentChapter.includes(scene.chapter),
  );

  const memoryBlock = payload.memory
    .map(
      (entry) =>
        `- [${entry.type}] ${entry.name}\n  说明：${entry.notes}\n  状态：${entry.status}`,
    )
    .join("\n");

  const recapBlock = payload.recaps
    .slice(0, 4)
    .map(
      (entry) =>
        `- ${entry.chapter} ${entry.title}\n  概括：${entry.summary}\n  下章必须记住：${entry.carry}`,
    )
    .join("\n");

  const sceneBlock = relevantScenes
    .map(
      (scene) =>
        `- ${scene.chapter} / ${scene.title}\n  目标：${scene.goal}\n  冲突：${scene.conflict}\n  钩子：${scene.hook}`,
    )
    .join("\n");

  const systemPrompt = [
    "你是中文长篇网络小说写作助手。",
    WRITING_RULES,
    "总大纲是边界，不是逐句模板。你要自然推进，不要生硬照搬。",
    "正文必须让人物的选择、代价、误判和局势变化自己把剧情推出来。",
    "不要使用小标题、项目符号、创作说明、作者口吻或解释性附注。",
    "只输出可直接阅读的章节正文。",
  ].join("\n\n");

  const userPrompt = `
请写 ${payload.currentChapter} 的正文。

硬性要求：
1. 正文长度尽量靠近 ${payload.wordTarget} 字。
2. 章节必须有起势、升级、转折或发现、章末钩子。
3. 只使用和当前章节强相关的大纲信息，不要把整本书的大纲往正文里硬塞。
4. 语言要具体，避免套话、空话、对称排比、重复开头、万能金句。
5. 如果同一信息角色已经知道，就不要重复解释。
6. 如果素材不够，用合理场景补全，但不能和既有事实冲突。

项目资料：
- 项目名：${payload.projectName}
- 题材：${payload.genre}
- 目标读者：${payload.targetReaders}
- 卖点：${payload.sellingPoint}
- 风格北极星：${payload.styleNorthStar}

总大纲：
${payload.masterOutline || "暂无"}

当前章节：
- 章节：${payload.currentChapter}
- 标题：${payload.currentChapterTitle || "未命名"}
- 章节目标：${payload.currentGoal || "未填写"}
- 核心冲突：${payload.currentConflict || "未填写"}
- 必须发生：${payload.currentMustHit || "未填写"}
- 补充说明：${payload.currentNotes || "未填写"}

章节总结构：
${payload.chapterArcs || "暂无"}

相关场景：
${sceneBlock || "暂无"}

记忆库：
${memoryBlock || "暂无"}

最近章节概括：
${recapBlock || "暂无"}
`.trim();

  return {
    systemPrompt,
    userPrompt,
    maxTokens: 5200,
  };
}

function buildRewritePrompts(
  payload: StudioPayload,
  rewriteSource: string,
): PromptPair {
  const systemPrompt = [
    "你是中文小说润稿编辑。",
    WRITING_RULES,
    "你的工作不是重写剧情，而是让文字更像成熟作者写出来的成品。",
    "优先修掉模板腔、解释腔、摘要腔、重复句式和生硬过渡。",
    "保留剧情事实、人物关系、时间线和信息顺序。",
    "只输出润色后的正文。",
  ].join("\n\n");

  const userPrompt = `
请对下面正文做深度改写。

改写目标：
${payload.rewriteGoal}

要求：
1. 不删主线信息，不改角色关系，不偷换因果。
2. 把空泛句换成更具体的动作、反应、环境、对话或心理细节。
3. 去掉模板化句子、重复修辞、说明书口气和硬拗的鸡汤感。
4. 保持章节节奏，不要越改越拖沓。

正文：
${rewriteSource || "暂无正文"}
`.trim();

  return {
    systemPrompt,
    userPrompt,
    maxTokens: 5200,
  };
}

function buildRecapPrompts(payload: StudioPayload, chapterOutput: string): PromptPair {
  const systemPrompt = [
    "你是长篇网络小说续写记忆整理助手。",
    "你的任务是把刚写完的一章压缩成适合下一章继续调用的记忆。",
    "必须输出 JSON，不要输出 JSON 之外的任何内容。",
  ].join("\n\n");

  const userPrompt = `
请把这章正文总结成续写记忆。

输出 JSON，格式如下：
{
  "title": "这一章最合适的短标题",
  "summary": "150 到 260 字的自然语言概括",
  "carry": "3 到 6 条必须带到下一章的事实、情绪、伏笔、局势变化，合并成一段文字"
}

要求：
1. 只保留对后续写作有价值的信息。
2. 不要空泛评价，不要写创作建议。
3. 如果这一章制造了悬念或新压力，必须写进 carry。

章节：${payload.currentChapter}
标题：${payload.currentChapterTitle || "未命名"}

正文：
${chapterOutput || "暂无正文"}
`.trim();

  return {
    systemPrompt,
    userPrompt,
    maxTokens: 1400,
  };
}

async function callModel(provider: Provider, model: string, prompt: PromptPair) {
  if (provider === "anthropic") {
    return callAnthropic(model, prompt);
  }

  return callOpenAICompatible(model, prompt);
}

async function callAnthropic(model: string, prompt: PromptPair) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("缺少 ANTHROPIC_API_KEY。");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: prompt.systemPrompt,
      max_tokens: prompt.maxTokens,
      temperature: 0.9,
      messages: [
        {
          role: "user",
          content: prompt.userPrompt,
        },
      ],
    }),
  });

  const data = (await response.json()) as {
    error?: { message?: string };
    content?: Array<{ type?: string; text?: string }>;
  };

  if (!response.ok) {
    throw new Error(data.error?.message || "Claude 请求失败。");
  }

  return (
    data.content
      ?.filter((item) => item.type === "text")
      .map((item) => item.text ?? "")
      .join("\n")
      .trim() || ""
  );
}

async function callOpenAICompatible(model: string, prompt: PromptPair) {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  if (!apiKey) {
    throw new Error("缺少 OPENAI_API_KEY。");
  }

  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      max_tokens: prompt.maxTokens,
      messages: [
        {
          role: "system",
          content: prompt.systemPrompt,
        },
        {
          role: "user",
          content: prompt.userPrompt,
        },
      ],
    }),
  });

  const data = (await response.json()) as {
    error?: { message?: string };
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  if (!response.ok) {
    throw new Error(data.error?.message || "OpenAI 兼容接口请求失败。");
  }

  const content = data.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item.text ?? "")
      .join("\n")
      .trim();
  }

  return "";
}
