import { prisma } from "@/lib/prisma";
import {
  deleteNoteSchema,
  listNotesSchema,
  upsertNoteSchema,
  type DeleteNoteInput,
  type ListNotesInput,
  type UpsertNoteInput,
} from "@/validators/notes";

export async function upsertNote(input: UpsertNoteInput) {
  const data = upsertNoteSchema.parse(input);

  return prisma.note.upsert({
    where: {
      itemId_language: {
        itemId: data.itemId,
        language: data.language,
      },
    },
    create: {
      itemId: data.itemId,
      language: data.language,
      title: data.title ?? null,
      content: data.content,
    },
    update: {
      title: data.title ?? null,
      content: data.content,
    },
  });
}

export async function listNotes(input: ListNotesInput) {
  const data = listNotesSchema.parse(input);
  const where = {
    itemId: data.itemId,
  };

  if (data.language !== undefined) {
    return prisma.note.findMany({
      where: {
        ...where,
        language: data.language,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  return prisma.note.findMany({
    where,
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function deleteNote(input: DeleteNoteInput) {
  const data = deleteNoteSchema.parse(input);

  return prisma.note.delete({
    where: {
      itemId_language: {
        itemId: data.itemId,
        language: data.language,
      },
    },
  });
}
