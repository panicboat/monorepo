// Merge lookups made in the same tick because one request per list item exhausts the backend concurrency.
export function createRequestBatcher<R>(fetchMany: (ids: string[]) => Promise<R>): (id: string) => Promise<R> {
  let pending: { ids: Set<string>; result: Promise<R> } | null = null;

  return (id) => {
    if (!pending) {
      const ids = new Set<string>();
      const result = Promise.resolve().then(() => {
        pending = null;
        return fetchMany([...ids]);
      });
      pending = { ids, result };
    }
    pending.ids.add(id);
    return pending.result;
  };
}
