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

  async function toggleImportant() {
    const nextImportant = !currentImportant;
    setFeedback(null);
    const updated = await updateStatus(itemId, { important: nextImportant });

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
    const updated = await updateStatus(itemId, { archived: true });

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
      await copyToClipboard(copyText);
      setFeedback("copied");
    } catch (error) {
      console.error("copy summary failed", error);
      setFeedback("error");
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <ActionButton
          active={currentImportant}
          disabled={isPending || currentArchived}
          icon={Star}
          label={currentImportant ? "Important" : "Mark important"}
          onClick={toggleImportant}
        />
        <ActionButton
          disabled={isPending || currentArchived}
          icon={Archive}
          label={currentArchived ? "Archived" : "Archive"}
          onClick={archiveItem}
        />
        <ActionButton
          disabled={copyText.trim() === ""}
          icon={Clipboard}
          label="Copy summary"
          onClick={copySummary}
        />
        {openHref !== null ? (
          <a
            className="inline-flex min-h-10 items-center justify-center gap-2 border border-[var(--color-border)] px-3 py-2 text-sm font-semibold transition hover:border-[var(--color-accent)]"
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
        <p className="text-xs font-medium text-[var(--color-muted)]" role="status">
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
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 border px-3 py-2 text-sm font-semibold transition hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? "border-[var(--color-accent)] bg-[var(--color-surface)]"
          : "border-[var(--color-border)]"
      }`}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" size={15} />
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
