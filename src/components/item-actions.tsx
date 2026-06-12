"use client";

import {
  Archive,
  Check,
  Clipboard,
  ExternalLink,
  Loader2,
  Star,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type ItemActionsProps = {
  archived: boolean;
  copyText: string;
  important: boolean;
  itemId: string;
  openHref: string | null;
  openLabel: string;
};

type Feedback = "copied" | "updated" | "error" | null;
type BusyAction = "important" | "archive" | "copy" | null;

export function ItemActions({
  archived,
  copyText,
  important,
  itemId,
  openHref,
  openLabel,
}: ItemActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentImportant, setCurrentImportant] = useState(important);
  const [currentArchived, setCurrentArchived] = useState(archived);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const busy = busyAction !== null || isPending;

  async function toggleImportant() {
    const nextImportant = !currentImportant;
    setFeedback(null);
    setBusyAction("important");
    const updated = await updateStatus(itemId, { important: nextImportant });
    setBusyAction(null);

    if (!updated) {
      setFeedback("error");
      return;
    }

    setCurrentImportant(nextImportant);
    setFeedback("updated");
    startTransition(() => router.refresh());
  }

  async function archiveItem() {
    setFeedback(null);
    setBusyAction("archive");
    const updated = await updateStatus(itemId, { archived: true });
    setBusyAction(null);

    if (!updated) {
      setFeedback("error");
      return;
    }

    setCurrentArchived(true);
    setFeedback("updated");
    startTransition(() => router.refresh());
  }

  async function copySummary() {
    try {
      setBusyAction("copy");
      await copyToClipboard(copyText);
      setFeedback("copied");
    } catch (error) {
      console.error("copy summary failed", error);
      setFeedback("error");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="grid gap-2 min-[420px]:grid-cols-2 sm:flex sm:flex-wrap">
        <ActionButton
          active={currentImportant}
          disabled={busy || currentArchived}
          icon={Star}
          label={currentImportant ? "Important" : "Mark important"}
          loading={busyAction === "important"}
          onClick={toggleImportant}
        />
        <ActionButton
          disabled={busy || currentArchived}
          icon={Archive}
          label={currentArchived ? "Archived" : "Archive"}
          loading={busyAction === "archive"}
          onClick={archiveItem}
        />
        <ActionButton
          disabled={busy || copyText.trim() === ""}
          icon={Clipboard}
          label="Copy summary"
          loading={busyAction === "copy"}
          onClick={copySummary}
        />
        {openHref !== null ? (
          <a
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 border border-[var(--color-border)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--color-accent)] sm:w-auto"
            href={openHref}
            rel="noreferrer"
            target="_blank"
            title={openLabel}
          >
            <ExternalLink aria-hidden="true" size={15} />
            {openLabel}
          </a>
        ) : null}
      </div>
      {feedback !== null || isPending ? (
        <p
          className={`text-xs font-medium ${
            feedback === "error" ? "text-red-700 dark:text-red-300" : "text-[var(--color-muted)]"
          }`}
          role={feedback === "error" ? "alert" : "status"}
        >
          {isPending ? (
            <>
              <Loader2 aria-hidden="true" className="mr-1 inline animate-spin" size={13} />
              Updating
            </>
          ) : feedback === "copied" ? (
            <>
              <Check aria-hidden="true" className="mr-1 inline" size={13} />
              Summary copied
            </>
          ) : feedback === "updated" ? (
            "Saved"
          ) : (
            "Action failed"
          )}
        </p>
      ) : null}
    </div>
  );
}

function ActionButton({
  active = false,
  disabled = false,
  icon: Icon,
  label,
  loading = false,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex min-h-10 w-full items-center justify-center gap-2 border px-3 py-2 text-sm font-semibold transition hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${
        active
          ? "border-[var(--color-accent)] bg-[var(--color-surface)]"
          : "border-[var(--color-border)]"
      }`}
      disabled={disabled}
      onClick={onClick}
      title={label}
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

async function updateStatus(
  itemId: string,
  status: {
    important?: boolean;
    archived?: boolean;
  },
): Promise<boolean> {
  try {
    const response = await fetch(`/api/items/${itemId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(status),
    });

    if (!response.ok) {
      console.error("item status update failed", await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("item status update request failed", error);
    return false;
  }
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    copyWithTextArea(text);
  }
}

function copyWithTextArea(text: string): void {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.append(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand("copy");
  } finally {
    textArea.remove();
  }
}
