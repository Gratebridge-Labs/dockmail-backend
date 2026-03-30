import { prisma } from "../../config/database";

export async function listFolders(mailboxId: string) {
  const folders = await prisma.folder.findMany({
    where: { mailboxId },
    orderBy: { order: "asc" },
  });
  const counts = await Promise.all(
    folders.map(async (folder) => ({
      folderId: folder.id,
      count: await prisma.emailFolder_Assignment.count({ where: { folderId: folder.id } }),
    })),
  );
  const countMap = new Map(counts.map((v) => [v.folderId, v.count]));
  return folders.map((f) => ({ ...f, emailCount: countMap.get(f.id) || 0 }));
}

export function createFolder(mailboxId: string, input: { name: string; color?: string }) {
  return prisma.folder.create({ data: { mailboxId, name: input.name, color: input.color } });
}

export function updateFolder(folderId: string, input: { name?: string; color?: string; order?: number }) {
  return prisma.folder.update({ where: { id: folderId }, data: input });
}

export async function deleteFolder(mailboxId: string, folderId: string) {
  const assignments = await prisma.emailFolder_Assignment.findMany({ where: { folderId } });
  for (const assignment of assignments) {
    await prisma.email.update({
      where: { id: assignment.emailId },
      data: { folder: "INBOX" },
    });
  }
  await prisma.emailFolder_Assignment.deleteMany({ where: { folderId } });
  return prisma.folder.deleteMany({ where: { id: folderId, mailboxId } });
}
