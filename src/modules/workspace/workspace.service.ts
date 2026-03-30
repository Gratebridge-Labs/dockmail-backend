import { BillingStatus, Role } from "@prisma/client";
import { prisma } from "../../config/database";
import { slugify } from "../../utils/slugify";

export async function createWorkspace(userId: string, input: { name: string; logoUrl?: string }) {
  return prisma.$transaction(async (tx) => {
    const slugBase = slugify(input.name);
    let slug = slugBase || `workspace-${Date.now()}`;
    let suffix = 1;
    while (await tx.workspace.findUnique({ where: { slug } })) {
      slug = `${slugBase}-${suffix++}`;
    }
    const workspace = await tx.workspace.create({
      data: {
        name: input.name,
        logoUrl: input.logoUrl,
        slug,
      },
    });
    await tx.workspaceMember.create({
      data: { workspaceId: workspace.id, userId, role: Role.OWNER },
    });
    await tx.billing.create({
      data: {
        workspaceId: workspace.id,
        status: BillingStatus.TRIALING,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    return workspace;
  });
}

export async function listWorkspaces(userId: string) {
  return prisma.workspaceMember.findMany({
    where: { userId },
    select: { role: true, workspace: true },
  });
}

export async function getWorkspace(workspaceId: string) {
  return prisma.workspace.findUnique({ where: { id: workspaceId } });
}

export async function updateWorkspace(workspaceId: string, data: { name?: string; logoUrl?: string; signature?: string }) {
  return prisma.workspace.update({ where: { id: workspaceId }, data });
}
