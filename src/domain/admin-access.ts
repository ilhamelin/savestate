export function isGuardianAdmin(
  user: { id: string; email?: string | null; emailConfirmed: boolean },
  settings: { userId?: string; email?: string },
): boolean {
  if (settings.userId) return user.id === settings.userId.trim();
  return (
    user.emailConfirmed &&
    Boolean(user.email) &&
    user.email!.toLowerCase() ===
      (settings.email ?? 'benjaigancioreyes56@gmail.com').trim().toLowerCase()
  );
}
