import prisma from '../../config/database';

/**
 * Returns an array of user IDs that the provided user can access within the given company.
 * Includes the user themself and all (recursive) subordinates that belong to the same company.
 */
export async function getAccessibleUserIds(userId: string, companyId: string): Promise<string[]> {
  const accessible = new Set<string>();
  accessible.add(userId);

  const queue: string[] = [userId];

  while (queue.length > 0) {
    const current = queue.shift() as string;

    const subs = await prisma.user.findMany({
      where: {
        managerId: current,
        userCompanies: { some: { companyId } }
      },
      select: { id: true }
    });

    for (const s of subs) {
      if (!accessible.has(s.id)) {
        accessible.add(s.id);
        queue.push(s.id);
      }
    }
  }

  return Array.from(accessible);
}
