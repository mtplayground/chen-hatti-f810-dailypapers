export const languages = ["en", "zh"] as const;

export type Language = (typeof languages)[number];

export const messages = {
  en: {
    shell: {
      label: "Research intake",
      nav: {
        today: "Today",
        library: "Library",
        exports: "Exports",
      },
      controls: {
        switchToDark: "Switch to dark theme",
        switchToLight: "Switch to light theme",
        language: "Language",
      },
    },
    home: {
      eyebrow: "Today",
      title: "Research queue",
      summary: "0 items queued for review.",
      stats: {
        papers: "Papers",
        repositories: "Repositories",
        notes: "Notes",
      },
      sections: {
        intake: "Intake",
        summaries: "Summaries",
        export: "Export",
      },
    },
  },
  zh: {
    shell: {
      label: "研究收集",
      nav: {
        today: "今日",
        library: "资料库",
        exports: "导出",
      },
      controls: {
        switchToDark: "切换到深色主题",
        switchToLight: "切换到浅色主题",
        language: "语言",
      },
    },
    home: {
      eyebrow: "今日",
      title: "研究队列",
      summary: "当前待阅读 0 项。",
      stats: {
        papers: "论文",
        repositories: "仓库",
        notes: "笔记",
      },
      sections: {
        intake: "收集",
        summaries: "摘要",
        export: "导出",
      },
    },
  },
} as const;

export type Messages = (typeof messages)[Language];
