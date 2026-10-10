/** Reload only when the server identifies the files actually being served. */
export async function checkBuildUpdate(currentId, serverId, fetchInfo) {
  if (!serverId || serverId === currentId) return 'current';
  const response = await fetchInfo();
  if (!response.ok) return 'unavailable';
  const published = await response.json();
  return published.id === serverId ? 'reload' : 'conflict';
}
