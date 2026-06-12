"use client";

import { Check, Languages, Loader2, Plus, Save, Tag, Trash2, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import type { DashboardNote, DashboardTag } from "@/services/dashboard";

type ItemLanguage = "EN" | "ZH";

type ItemNotesTagsEditorProps = {
  assignedTags: DashboardTag[];
  availableTags: DashboardTag[];
  itemId: string;
  itemLanguage: ItemLanguage;
  notes: DashboardNote[];
};

type Feedback = {
  kind: "success" | "error";
  message: string;
} | null;
type BusyAction = "save-note" | "delete-note" | "save-tags" | "create-tag" | null;

export function ItemNotesTagsEditor({
  assignedTags,
  availableTags,
  itemId,
  itemLanguage,
  notes,
}: ItemNotesTagsEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [language, setLanguage] = useState<ItemLanguage>(itemLanguage);
  const selectedNote = useMemo(
    () => notes.find((note) => note.language === language) ?? null,
    [language, notes],
  );
  const [title, setTitle] = useState(selectedNote?.title ?? "");
  const [content, setContent] = useState(selectedNote?.content ?? "");
  const [savedLanguages, setSavedLanguages] = useState(
    () => new Set(notes.map((note) => note.language)),
  );
  const [selectedTagIds, setSelectedTagIds] = useState(
    () => new Set(assignedTags.map((tag) => tag.id)),
  );
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#2563eb");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);

  const canSaveNote = content.trim().length > 0;
  const canCreateTag = newTagName.trim().length > 0;
  const busy = busyAction !== null || isPending;

  function selectLanguage(nextLanguage: ItemLanguage) {
    const nextNote = notes.find((note) => note.language === nextLanguage) ?? null;
    setLanguage(nextLanguage);
    setTitle(nextNote?.title ?? "");
    setContent(nextNote?.content ?? "");
    setFeedback(null);
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((current) => {
      const next = new Set(current);

      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }

      return next;
    });
  }

  async function saveNote() {
    if (!canSaveNote) {
      setFeedback({ kind: "error", message: "Note content is required." });
      return;
    }

    setFeedback(null);
    setBusyAction("save-note");
    const response = await requestOrFeedback(
      `/api/items/${itemId}/notes`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language,
          title: title.trim() === "" ? undefined : title,
          content,
        }),
      },
      "Unable to save note.",
    );
    setBusyAction(null);

    if (response === null) {
      setFeedback({ kind: "error", message: "Unable to save note." });
      return;
    }

    if (!response.ok) {
      setFeedback({ kind: "error", message: await errorMessage(response, "Unable to save note.") });
      return;
    }

    setFeedback({ kind: "success", message: "Note saved." });
    setSavedLanguages((current) => new Set([...current, language]));
    startTransition(() => router.refresh());
  }

  async function deleteCurrentNote() {
    if (!savedLanguages.has(language)) {
      setTitle("");
      setContent("");
      return;
    }

    setFeedback(null);
    setBusyAction("delete-note");
    const response = await requestOrFeedback(
      `/api/items/${itemId}/notes`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ language }),
      },
      "Unable to delete note.",
    );
    setBusyAction(null);

    if (response === null) {
      setFeedback({ kind: "error", message: "Unable to delete note." });
      return;
    }

    if (!response.ok) {
      setFeedback({
        kind: "error",
        message: await errorMessage(response, "Unable to delete note."),
      });
      return;
    }

    setTitle("");
    setContent("");
    setSavedLanguages((current) => {
      const next = new Set(current);
      next.delete(language);
      return next;
    });
    setFeedback({ kind: "success", message: "Note deleted." });
    startTransition(() => router.refresh());
  }

  async function saveTags() {
    setFeedback(null);
    setBusyAction("save-tags");
    const response = await requestOrFeedback(
      `/api/items/${itemId}/tags`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tagIds: [...selectedTagIds] }),
      },
      "Unable to save tags.",
    );
    setBusyAction(null);

    if (response === null) {
      setFeedback({ kind: "error", message: "Unable to save tags." });
      return;
    }

    if (!response.ok) {
      setFeedback({ kind: "error", message: await errorMessage(response, "Unable to save tags.") });
      return;
    }

    setFeedback({ kind: "success", message: "Tags saved." });
    startTransition(() => router.refresh());
  }

  async function createAndAssignTag() {
    if (!canCreateTag) {
      setFeedback({ kind: "error", message: "Tag name is required." });
      return;
    }

    const name = newTagName.trim();
    setFeedback(null);
    setBusyAction("create-tag");
    const response = await requestOrFeedback(
      "/api/tags",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug: slugFromName(name),
          nameEn: name,
          color: newTagColor,
        }),
      },
      "Unable to create tag.",
    );

    if (response === null) {
      setBusyAction(null);
      setFeedback({ kind: "error", message: "Unable to create tag." });
      return;
    }

    if (!response.ok) {
      setBusyAction(null);
      setFeedback({
        kind: "error",
        message: await errorMessage(response, "Unable to create tag."),
      });
      return;
    }

    let payload: { tag: DashboardTag };
    try {
      payload = (await response.json()) as { tag: DashboardTag };
    } catch (error) {
      console.error("tag creation response parse failed", error);
      setBusyAction(null);
      setFeedback({ kind: "error", message: "Unable to create tag." });
      return;
    }

    const nextTagIds = new Set([...selectedTagIds, payload.tag.id]);
    const assignmentResponse = await requestOrFeedback(
      `/api/items/${itemId}/tags`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tagIds: [...nextTagIds] }),
      },
      "Tag created but assignment failed.",
    );
    setBusyAction(null);

    if (assignmentResponse === null) {
      setFeedback({ kind: "error", message: "Tag created but assignment failed." });
      return;
    }

    if (!assignmentResponse.ok) {
      setFeedback({
        kind: "error",
        message: await errorMessage(assignmentResponse, "Tag created but assignment failed."),
      });
      return;
    }

    setSelectedTagIds(nextTagIds);
    setNewTagName("");
    setFeedback({ kind: "success", message: "Tag created and assigned." });
    startTransition(() => router.refresh());
  }

  return (
    <section className="grid gap-4 border-t border-[var(--color-border)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-semibold">
          <Languages aria-hidden="true" size={16} />
          Personal notes
        </div>
        <div className="inline-flex border border-[var(--color-border)]">
          {(["EN", "ZH"] as const).map((option) => (
            <button
              className={`min-h-9 px-3 text-xs font-semibold ${
                option === language
                  ? "bg-[var(--color-ink)] text-[var(--color-panel)]"
                  : "text-[var(--color-muted)]"
              }`}
              disabled={busy}
              key={option}
              onClick={() => selectLanguage(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <input
          className="min-h-10 border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Note title"
          value={title}
        />
        <textarea
          className="min-h-28 resize-y border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--color-accent)]"
          disabled={busy}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write a personal note for this item"
          value={content}
        />
        <div className="flex flex-wrap gap-2">
          <ActionButton
            disabled={busy || !canSaveNote}
            icon={Save}
            label="Save note"
            loading={busyAction === "save-note"}
            onClick={saveNote}
          />
          <ActionButton
            disabled={busy}
            icon={Trash2}
            label="Delete note"
            loading={busyAction === "delete-note"}
            onClick={deleteCurrentNote}
          />
        </div>
      </div>

      <div className="grid gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-semibold">
          <Tag aria-hidden="true" size={16} />
          Tags
        </div>
        {availableTags.length === 0 ? (
          <p className="border border-dashed border-[var(--color-border)] p-3 text-sm text-[var(--color-muted)]">
            No tags created yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const selected = selectedTagIds.has(tag.id);

              return (
                <button
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    selected
                      ? "border-[var(--color-accent)] bg-[var(--color-surface)]"
                      : "border-[var(--color-border)] text-[var(--color-muted)]"
                  }`}
                  key={tag.id}
                  disabled={busy}
                  onClick={() => toggleTag(tag.id)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full"
                    style={{ backgroundColor: tag.color ?? "var(--color-accent)" }}
                  />
                  {tag.nameEn}
                  {selected ? <Check aria-hidden="true" size={13} /> : null}
                </button>
              );
            })}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input
            className="min-h-10 border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            disabled={busy}
            onChange={(event) => setNewTagName(event.target.value)}
            placeholder="New tag"
            value={newTagName}
          />
          <input
            aria-label="New tag color"
            className="min-h-10 w-full border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1 sm:w-16"
            disabled={busy}
            onChange={(event) => setNewTagColor(event.target.value)}
            type="color"
            value={newTagColor}
          />
          <ActionButton
            disabled={busy || !canCreateTag}
            icon={Plus}
            label="Create tag"
            loading={busyAction === "create-tag"}
            onClick={createAndAssignTag}
          />
        </div>

        <ActionButton
          disabled={busy}
          icon={Save}
          label="Save tags"
          loading={busyAction === "save-tags"}
          onClick={saveTags}
        />
      </div>

      {feedback !== null ? (
        <p
          className={`text-sm font-medium ${
            feedback.kind === "error" ? "text-red-600" : "text-[var(--color-muted)]"
          }`}
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.message}
          {isPending ? (
            <Loader2 aria-hidden="true" className="ml-2 inline animate-spin" size={14} />
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

function ActionButton({
  disabled = false,
  icon: Icon,
  label,
  loading = false,
  onClick,
}: {
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex min-h-10 w-full items-center justify-center gap-2 border border-[var(--color-border)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-fit"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {loading ? (
        <Loader2 aria-hidden="true" className="animate-spin" size={15} />
      ) : (
        <Icon aria-hidden="true" size={15} />
      )}
      {label}
    </button>
  );
}

async function requestOrFeedback(
  input: RequestInfo | URL,
  init: RequestInit,
  fallback: string,
): Promise<Response | null> {
  try {
    return await fetch(input, init);
  } catch (error) {
    console.error(fallback, error);
    return null;
  }
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

function slugFromName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug === "" ? `tag-${Date.now()}` : slug;
}
