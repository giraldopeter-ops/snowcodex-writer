"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

type Provider = "anthropic" | "openai";
type MemoryType = "角色" | "地点" | "设定" | "伏笔" | "线索";

type ScenePlan = {
  id: string;
  chapter: string;
  title: string;
  goal: string;
  conflict: string;
  hook: string;
};

type MemoryEntry = {
  id: string;
  type: MemoryType;
  name: string;
  notes: string;
  status: string;
};

type ChapterRecap = {
  id: string;
  chapter: string;
  title: string;
  summary: string;
  carry: string;
};

type StudioState = {
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

type PersistedWorkspace = {
  studio: StudioState;
  structurePreview: string;
  chapterOutput: string;
  rewriteSource: string;
  rewriteOutput: string;
};

type StructureResponse = {
  summary?: string;
  chapterArcs?: string;
  scenes?: Array<{
    chapter?: string;
    title?: string;
    goal?: string;
    conflict?: string;
    hook?: string;
  }>;
};

type RecapResponse = {
  title?: string;
  summary?: string;
  carry?: string;
};

const STORAGE_KEY = "snowcodex-writer-studio-v1";

const defaultState: StudioState = {
  projectName: "SnowCodex Writer 项目",
  genre: "都市升级 / 爽文",
  targetReaders: "偏爱节奏快、冲突密、章末有钩子的中文网文读者",
  sellingPoint: "强钩子开局、人物驱动冲突、每章都有推进和代价",
  styleNorthStar:
    "像成熟网文作者一样推进剧情：信息密度高、场景具体、情绪真实、章末留钩，不写空泛总结。",
  masterOutline: "",
  snowflakePremise: "",
  oneLine: "",
  oneParagraph: "",
  endingPromise: "",
  chapterArcs: "",
  scenes: [
    {
      id: "scene-1",
      chapter: "第1章",
      title: "开局钩子",
      goal: "在最差处境里逼主角做选择",
      conflict: "外部压力和主角的犹豫同时升高",
      hook: "章末抛出更大的麻烦或更诱人的机会",
    },
  ],
  memory: [
    {
      id: "memory-1",
      type: "角色",
      name: "主角",
      notes: "写明核心欲望、当前弱点、不能碰的痛点。",
      status: "未完善",
    },
  ],
  recaps: [],
  provider: "anthropic",
  model: "claude-sonnet-4-20250514",
  currentChapter: "第1章",
  currentChapterTitle: "",
  currentGoal: "",
  currentConflict: "",
  currentMustHit: "",
  currentNotes: "",
  wordTarget: 3000,
  rewriteGoal:
    "保留剧情事实和人物关系，减少模板化表达，让句子更具体、更有人物感和场景感。",
};

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function extractJson<T>(raw: string): T | null {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  const jsonText =
    start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate;

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    return null;
  }
}

function cleanString(value?: string) {
  return value?.trim() ?? "";
}

export function WriterStudio() {
  const [studio, setStudio] = useState<StudioState>(defaultState);
  const [structurePreview, setStructurePreview] = useState("");
  const [chapterOutput, setChapterOutput] = useState("");
  const [rewriteSource, setRewriteSource] = useState("");
  const [rewriteOutput, setRewriteOutput] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const [status, setStatus] = useState("本地自动保存已开启。");
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (raw) {
        const parsed = JSON.parse(raw) as PersistedWorkspace;
        setStudio({ ...defaultState, ...parsed.studio });
        setStructurePreview(parsed.structurePreview ?? "");
        setChapterOutput(parsed.chapterOutput ?? "");
        setRewriteSource(parsed.rewriteSource ?? "");
        setRewriteOutput(parsed.rewriteOutput ?? "");
      }
    } catch {
      setError("本地草稿读取失败，已继续使用空白工作台。");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    const payload: PersistedWorkspace = {
      studio,
      structurePreview,
      chapterOutput,
      rewriteSource,
      rewriteOutput,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [hydrated, studio, structurePreview, chapterOutput, rewriteSource, rewriteOutput]);

  function updateField<K extends keyof StudioState>(field: K, value: StudioState[K]) {
    setStudio((current) => ({ ...current, [field]: value }));
  }

  function updateScene(id: string, field: keyof ScenePlan, value: string) {
    setStudio((current) => ({
      ...current,
      scenes: current.scenes.map((scene) =>
        scene.id === id ? { ...scene, [field]: value } : scene,
      ),
    }));
  }

  function updateMemory(id: string, field: keyof MemoryEntry, value: string) {
    setStudio((current) => ({
      ...current,
      memory: current.memory.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry,
      ),
    }));
  }

  function updateRecap(id: string, field: keyof ChapterRecap, value: string) {
    setStudio((current) => ({
      ...current,
      recaps: current.recaps.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry,
      ),
    }));
  }

  function addScene() {
    setStudio((current) => ({
      ...current,
      scenes: [
        ...current.scenes,
        {
          id: uid("scene"),
          chapter: current.currentChapter || `第${current.scenes.length + 1}章`,
          title: "",
          goal: "",
          conflict: "",
          hook: "",
        },
      ],
    }));
  }

  function addMemory() {
    setStudio((current) => ({
      ...current,
      memory: [
        ...current.memory,
        {
          id: uid("memory"),
          type: "设定",
          name: "",
          notes: "",
          status: "",
        },
      ],
    }));
  }

  function addRecap() {
    setStudio((current) => ({
      ...current,
      recaps: [
        {
          id: uid("recap"),
          chapter: current.currentChapter,
          title: current.currentChapterTitle || current.currentChapter,
          summary: "",
          carry: "",
        },
        ...current.recaps,
      ],
    }));
  }

  async function callGenerate(action: "snowflake" | "chapter" | "rewrite" | "recap") {
    if (!cleanString(studio.model)) {
      setError("先填写模型名。");
      return null;
    }

    setBusyAction(action);
    setError("");
    setStatus("模型处理中...");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          payload: studio,
          chapterOutput,
          rewriteSource,
        }),
      });

      const data = (await response.json()) as { text?: string; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "请求失败");
      }

      setStatus("完成。");
      return data.text ?? "";
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : "请求失败";
      setError(message);
      setStatus("失败。");
      return null;
    } finally {
      setBusyAction("");
    }
  }

  async function handleBuildStructure() {
    const text = await callGenerate("snowflake");

    if (!text) {
      return;
    }

    const parsed = extractJson<StructureResponse>(text);

    if (!parsed) {
      setStructurePreview(text);
      return;
    }

    setStructurePreview(parsed.summary ?? text);
    setStudio((current) => ({
      ...current,
      chapterArcs: cleanString(parsed.chapterArcs) || current.chapterArcs,
      scenes:
        parsed.scenes && parsed.scenes.length > 0
          ? parsed.scenes.map((scene, index) => ({
              id: uid(`scene-${index + 1}`),
              chapter: cleanString(scene.chapter) || `第${index + 1}章`,
              title: cleanString(scene.title),
              goal: cleanString(scene.goal),
              conflict: cleanString(scene.conflict),
              hook: cleanString(scene.hook),
            }))
          : current.scenes,
    }));
  }

  async function handleGenerateChapter() {
    const text = await callGenerate("chapter");

    if (!text) {
      return;
    }

    setChapterOutput(text);
    setRewriteSource(text);
  }

  async function handleRewrite() {
    const text = await callGenerate("rewrite");

    if (!text) {
      return;
    }

    setRewriteOutput(text);
  }

  async function handleRecap() {
    const text = await callGenerate("recap");

    if (!text) {
      return;
    }

    const parsed = extractJson<RecapResponse>(text);

    if (!parsed) {
      setError("章节概括返回格式不对，请再点一次。");
      return;
    }

    setStudio((current) => ({
      ...current,
      recaps: [
        {
          id: uid("recap"),
          chapter: current.currentChapter,
          title:
            cleanString(parsed.title) ||
            cleanString(current.currentChapterTitle) ||
            current.currentChapter,
          summary: cleanString(parsed.summary),
          carry: cleanString(parsed.carry),
        },
        ...current.recaps,
      ],
    }));
  }

  function exportWorkspace() {
    const payload: PersistedWorkspace = {
      studio,
      structurePreview,
      chapterOutput,
      rewriteSource,
      rewriteOutput,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${studio.projectName || "snowcodex-writer"}-workspace.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importWorkspace(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as PersistedWorkspace;
      setStudio({ ...defaultState, ...parsed.studio });
      setStructurePreview(parsed.structurePreview ?? "");
      setChapterOutput(parsed.chapterOutput ?? "");
      setRewriteSource(parsed.rewriteSource ?? "");
      setRewriteOutput(parsed.rewriteOutput ?? "");
      setStatus("工作台已导入。");
      setError("");
    } catch {
      setError("导入失败，文件不是有效的 JSON。");
    } finally {
      event.target.value = "";
    }
  }

  const relevantScenes = studio.scenes.filter(
    (scene) =>
      scene.chapter.includes(studio.currentChapter) ||
      studio.currentChapter.includes(scene.chapter),
  );

  const recentRecaps = studio.recaps.slice(0, 4);

  return (
    <main className="paper-grid min-h-screen px-4 py-6 text-[color:var(--foreground)] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <section className="soft-panel overflow-hidden rounded-[28px]">
          <div className="flex flex-col gap-6 px-6 py-7 lg:flex-row lg:items-end lg:justify-between lg:px-8">
            <div className="max-w-3xl">
              <p className="mb-3 inline-flex rounded-full border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase text-[color:var(--accent-strong)]">
                SnowCodex Writer
              </p>
              <h1 className="title-serif text-balance text-4xl font-semibold tracking-tight text-[color:var(--accent-strong)] sm:text-5xl">
                长篇小说工作台
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--muted)] sm:text-base">
                一个页面里完成总大纲、雪花结构、长期记忆、章节生成、章节概括和深度改写。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={exportWorkspace}
                className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--foreground)] transition hover:-translate-y-0.5"
              >
                导出工作台
              </button>
              <label className="cursor-pointer rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-center text-sm font-semibold text-[color:var(--foreground)] transition hover:-translate-y-0.5">
                导入工作台
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={importWorkspace}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col gap-5">
            <SectionCard
              title="项目总控"
              description="总大纲是边界，不是硬模板。章节生成只抓当前相关内容，自然推进。"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="书名 / 项目名"
                  value={studio.projectName}
                  onChange={(value) => updateField("projectName", value)}
                />
                <InputField
                  label="题材"
                  value={studio.genre}
                  onChange={(value) => updateField("genre", value)}
                />
                <TextAreaField
                  label="目标读者"
                  value={studio.targetReaders}
                  onChange={(value) => updateField("targetReaders", value)}
                  rows={3}
                />
                <TextAreaField
                  label="卖点"
                  value={studio.sellingPoint}
                  onChange={(value) => updateField("sellingPoint", value)}
                  rows={3}
                />
              </div>
              <TextAreaField
                label="风格北极星"
                value={studio.styleNorthStar}
                onChange={(value) => updateField("styleNorthStar", value)}
                rows={4}
              />
              <TextAreaField
                label="小说总大纲"
                value={studio.masterOutline}
                onChange={(value) => updateField("masterOutline", value)}
                rows={10}
              />
            </SectionCard>

            <SectionCard
              title="雪花结构"
              description="先收拢故事核，再展开到章节和场景。"
              action={
                <button
                  type="button"
                  onClick={handleBuildStructure}
                  disabled={busyAction === "snowflake"}
                  className="rounded-2xl bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === "snowflake" ? "生成中..." : "生成章节与场景"}
                </button>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextAreaField
                  label="故事前提"
                  value={studio.snowflakePremise}
                  onChange={(value) => updateField("snowflakePremise", value)}
                  rows={4}
                />
                <TextAreaField
                  label="一句话版本"
                  value={studio.oneLine}
                  onChange={(value) => updateField("oneLine", value)}
                  rows={4}
                />
                <TextAreaField
                  label="一段话版本"
                  value={studio.oneParagraph}
                  onChange={(value) => updateField("oneParagraph", value)}
                  rows={6}
                />
                <TextAreaField
                  label="终局承诺"
                  value={studio.endingPromise}
                  onChange={(value) => updateField("endingPromise", value)}
                  rows={6}
                />
              </div>
              <TextAreaField
                label="章节总结构"
                value={studio.chapterArcs}
                onChange={(value) => updateField("chapterArcs", value)}
                rows={10}
              />
              <TextAreaField
                label="结构预览"
                value={structurePreview}
                onChange={setStructurePreview}
                rows={4}
              />
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[color:var(--accent-strong)]">
                    场景清单
                  </h3>
                  <p className="text-xs text-[color:var(--muted)]">
                    每个场景只保留推进剧情所需的信息。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addScene}
                  className="rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-sm font-semibold"
                >
                  新增场景
                </button>
              </div>
              <div className="grid gap-4">
                {studio.scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className="grid gap-3 rounded-2xl border border-[color:var(--border)] bg-white/90 p-4 md:grid-cols-2"
                  >
                    <InputField
                      label="所属章节"
                      value={scene.chapter}
                      onChange={(value) => updateScene(scene.id, "chapter", value)}
                    />
                    <InputField
                      label="场景标题"
                      value={scene.title}
                      onChange={(value) => updateScene(scene.id, "title", value)}
                    />
                    <TextAreaField
                      label="场景目标"
                      value={scene.goal}
                      onChange={(value) => updateScene(scene.id, "goal", value)}
                      rows={3}
                    />
                    <TextAreaField
                      label="场景冲突"
                      value={scene.conflict}
                      onChange={(value) => updateScene(scene.id, "conflict", value)}
                      rows={3}
                    />
                    <TextAreaField
                      label="章末钩子"
                      value={scene.hook}
                      onChange={(value) => updateScene(scene.id, "hook", value)}
                      rows={3}
                    />
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="章节写作"
              description="章节只吃当前相关信息，不会把总大纲硬贴到正文里。"
              action={
                <button
                  type="button"
                  onClick={handleGenerateChapter}
                  disabled={busyAction === "chapter"}
                  className="rounded-2xl bg-[color:var(--highlight)] px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === "chapter" ? "生成中..." : "生成章节"}
                </button>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <InputField
                  label="当前章节"
                  value={studio.currentChapter}
                  onChange={(value) => updateField("currentChapter", value)}
                />
                <InputField
                  label="章节标题"
                  value={studio.currentChapterTitle}
                  onChange={(value) => updateField("currentChapterTitle", value)}
                />
                <TextAreaField
                  label="章节目标"
                  value={studio.currentGoal}
                  onChange={(value) => updateField("currentGoal", value)}
                  rows={3}
                />
                <TextAreaField
                  label="核心冲突"
                  value={studio.currentConflict}
                  onChange={(value) => updateField("currentConflict", value)}
                  rows={3}
                />
                <TextAreaField
                  label="必须发生"
                  value={studio.currentMustHit}
                  onChange={(value) => updateField("currentMustHit", value)}
                  rows={4}
                />
                <TextAreaField
                  label="补充说明"
                  value={studio.currentNotes}
                  onChange={(value) => updateField("currentNotes", value)}
                  rows={4}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
                <InputField
                  label="目标字数"
                  value={String(studio.wordTarget)}
                  onChange={(value) =>
                    updateField("wordTarget", Number(value.replace(/\D/g, "")) || 0)
                  }
                />
                <InfoPanel
                  title="自动带入"
                  body={`相关场景 ${relevantScenes.length} 条，最近概括 ${recentRecaps.length} 条，记忆库 ${studio.memory.length} 条。`}
                />
              </div>
              <TextAreaField
                label="生成结果"
                value={chapterOutput}
                onChange={setChapterOutput}
                rows={22}
              />
            </SectionCard>

            <SectionCard
              title="深度改写"
              description="用于削掉套话、重复句式和说明书口气，保留剧情事实。"
              action={
                <button
                  type="button"
                  onClick={handleRewrite}
                  disabled={busyAction === "rewrite"}
                  className="rounded-2xl bg-[color:var(--accent-strong)] px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === "rewrite" ? "改写中..." : "深度改写"}
                </button>
              }
            >
              <TextAreaField
                label="改写目标"
                value={studio.rewriteGoal}
                onChange={(value) => updateField("rewriteGoal", value)}
                rows={4}
              />
              <TextAreaField
                label="待改写正文"
                value={rewriteSource}
                onChange={setRewriteSource}
                rows={16}
              />
              <TextAreaField
                label="改写结果"
                value={rewriteOutput}
                onChange={setRewriteOutput}
                rows={16}
              />
            </SectionCard>
          </div>

          <div className="flex flex-col gap-5">
            <SectionCard
              title="模型设置"
              description="Claude 可直接用。OpenAI 也预留好了。"
            >
              <div className="grid gap-4">
                <SelectField
                  label="服务商"
                  value={studio.provider}
                  onChange={(value) => updateField("provider", value as Provider)}
                  options={[
                    { label: "Anthropic / Claude", value: "anthropic" },
                    { label: "OpenAI", value: "openai" },
                  ]}
                />
                <InputField
                  label="模型名"
                  value={studio.model}
                  onChange={(value) => updateField("model", value)}
                />
                <InfoPanel title="状态" body={status} />
                {error ? <ErrorPanel message={error} /> : null}
              </div>
            </SectionCard>

            <SectionCard
              title="记忆库"
              description="记录角色、地点、设定、伏笔和必须保持一致的事实。"
              action={
                <button
                  type="button"
                  onClick={addMemory}
                  className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm font-semibold"
                >
                  新增记忆
                </button>
              }
            >
              <div className="grid gap-4">
                {studio.memory.map((entry) => (
                  <div
                    key={entry.id}
                    className="grid gap-3 rounded-2xl border border-[color:var(--border)] bg-white/90 p-4"
                  >
                    <div className="grid gap-3 md:grid-cols-[0.8fr_1.2fr]">
                      <SelectField
                        label="类型"
                        value={entry.type}
                        onChange={(value) =>
                          updateMemory(entry.id, "type", value as MemoryType)
                        }
                        options={[
                          { label: "角色", value: "角色" },
                          { label: "地点", value: "地点" },
                          { label: "设定", value: "设定" },
                          { label: "伏笔", value: "伏笔" },
                          { label: "线索", value: "线索" },
                        ]}
                      />
                      <InputField
                        label="名字"
                        value={entry.name}
                        onChange={(value) => updateMemory(entry.id, "name", value)}
                      />
                    </div>
                    <TextAreaField
                      label="说明"
                      value={entry.notes}
                      onChange={(value) => updateMemory(entry.id, "notes", value)}
                      rows={4}
                    />
                    <InputField
                      label="状态"
                      value={entry.status}
                      onChange={(value) => updateMemory(entry.id, "status", value)}
                    />
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="章节概括"
              description="每生成一章就补一条概括，下一章只拿最近几条，续写更稳。"
              action={
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRecap}
                    disabled={busyAction === "recap" || !cleanString(chapterOutput)}
                    className="rounded-2xl bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "recap" ? "生成中..." : "从正文生成概括"}
                  </button>
                  <button
                    type="button"
                    onClick={addRecap}
                    className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm font-semibold"
                  >
                    手动新增
                  </button>
                </div>
              }
            >
              <div className="grid gap-4">
                {studio.recaps.length === 0 ? (
                  <InfoPanel
                    title="还没有概括"
                    body="先生成一章，再点上面的按钮自动补概括。"
                  />
                ) : null}
                {studio.recaps.map((entry) => (
                  <div
                    key={entry.id}
                    className="grid gap-3 rounded-2xl border border-[color:var(--border)] bg-white/90 p-4"
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <InputField
                        label="章节"
                        value={entry.chapter}
                        onChange={(value) => updateRecap(entry.id, "chapter", value)}
                      />
                      <InputField
                        label="标题"
                        value={entry.title}
                        onChange={(value) => updateRecap(entry.id, "title", value)}
                      />
                    </div>
                    <TextAreaField
                      label="章节概括"
                      value={entry.summary}
                      onChange={(value) => updateRecap(entry.id, "summary", value)}
                      rows={5}
                    />
                    <TextAreaField
                      label="下章必须记住"
                      value={entry.carry}
                      onChange={(value) => updateRecap(entry.id, "carry", value)}
                      rows={4}
                    />
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </main>
  );
}

function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="soft-panel rounded-[28px] p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="title-serif text-2xl font-semibold text-[color:var(--accent-strong)]">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[color:var(--muted)]">
            {description}
          </p>
        </div>
        {action}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-[color:var(--accent-strong)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-[color:var(--accent-strong)]">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="resize-y rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm leading-7 outline-none transition focus:border-[color:var(--accent)]"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-[color:var(--accent-strong)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-3">
      <p className="text-sm font-semibold text-[color:var(--accent-strong)]">{title}</p>
      <p className="mt-1 text-sm leading-7 text-[color:var(--muted)]">{body}</p>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}
