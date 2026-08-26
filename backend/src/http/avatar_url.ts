/**
 * Where a stored picture is served from. The server names its own URLs, so no client builds this
 * path: moving the route breaks compilation here rather than every avatar in the interface.
 */
export function avatarUrl(fileId: string): string {
  return `/api/avatars/${fileId}`;
}

/** What a row carrying `AVATAR_FILE_ID` turns into for a client. */
export function avatarUrlOf(
  row: { avatarFileId: string | null },
): string | null {
  return row.avatarFileId === null ? null : avatarUrl(row.avatarFileId);
}

/** Turns the joined column into what a client is given. Rows are produced in several services. */
export function withAvatarUrl<T extends { avatarFileId: string | null }>(
  row: T,
): Omit<T, "avatarFileId"> & { avatarUrl: string | null } {
  const { avatarFileId, ...rest } = row;
  return { ...rest, avatarUrl: avatarUrlOf({ avatarFileId }) };
}
