export type RoleRemovalImpact = {
  userId: string;
  roleCode: string;
  canRemove: boolean;
  noteRequired: boolean;
  affectedProfile: string | null;
  blockers: string[];
  warnings: string[];
  cleanupActions: string[];
  associatedCounts: Record<string, number>;
};

export function roleRemovalHasBlockers(impact: RoleRemovalImpact | null | undefined) {
  return Boolean(impact && (!impact.canRemove || impact.blockers.length > 0));
}

export function roleRemovalNoteError(impact: RoleRemovalImpact | null | undefined, note: string) {
  if (!impact?.noteRequired) {
    return "";
  }

  return note.trim()
    ? ""
    : "Add an admin note before removing a role with associated data or cleanup actions.";
}

export function visibleRoleRemovalCounts(impact: RoleRemovalImpact | null | undefined) {
  if (!impact) {
    return [];
  }

  return Object.entries(impact.associatedCounts)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      key,
      label: key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (match) => match.toUpperCase()),
      value,
    }));
}
