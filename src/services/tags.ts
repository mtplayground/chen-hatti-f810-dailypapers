import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  createTagSchema,
  deleteTagSchema,
  setItemTagsSchema,
  updateTagSchema,
  type CreateTagInput,
  type SetItemTagsInput,
  type UpdateTagInput,
} from "@/validators/tags";

export async function createTag(input: CreateTagInput) {
  const data = createTagSchema.parse(input);

  return prisma.tag.create({
    data: {
      slug: data.slug,
      nameEn: data.nameEn,
      nameZh: data.nameZh ?? null,
      color: data.color ?? null,
    },
  });
}

export async function listTags() {
  return prisma.tag.findMany({
    orderBy: {
      nameEn: "asc",
    },
  });
}

export async function updateTag(input: UpdateTagInput) {
  const data = updateTagSchema.parse(input);
  const updateData: Prisma.TagUpdateInput = {};

  if (data.slug !== undefined) {
    updateData.slug = data.slug;
  }

  if (data.nameEn !== undefined) {
    updateData.nameEn = data.nameEn;
  }

  if (data.nameZh !== undefined) {
    updateData.nameZh = data.nameZh;
  }

  if (data.color !== undefined) {
    updateData.color = data.color;
  }

  return prisma.tag.update({
    where: {
      id: data.id,
    },
    data: updateData,
  });
}

export async function deleteTag(id: string) {
  const data = deleteTagSchema.parse({ id });

  return prisma.tag.delete({
    where: {
      id: data.id,
    },
  });
}

export async function setItemTags(input: SetItemTagsInput) {
  const data = setItemTagsSchema.parse(input);

  await prisma.$transaction(async (tx) => {
    await tx.itemTag.deleteMany({
      where: {
        itemId: data.itemId,
      },
    });

    if (data.tagIds.length > 0) {
      await tx.itemTag.createMany({
        data: data.tagIds.map((tagId) => ({
          itemId: data.itemId,
          tagId,
        })),
        skipDuplicates: true,
      });
    }
  });

  return prisma.item.findUniqueOrThrow({
    where: {
      id: data.itemId,
    },
    include: {
      tags: {
        include: {
          tag: true,
        },
      },
    },
  });
}
