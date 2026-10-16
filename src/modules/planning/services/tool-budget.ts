const MAX_TOOLS_FOR_PLANNER = 24;
const MIN_TOOLS_PER_COMPONENT = 3;

export const budgetTools = <
  T extends { callName: string; entry: { server: { id: string } } },
>(
  ranked: T[],
): T[] => {
  const byComponent = new Map<string, T[]>();

  for (const tool of ranked) {
    const id = tool.entry.server.id;
    byComponent.set(id, [...(byComponent.get(id) || []), tool]);
  }

  const selected = new Set<string>();

  for (let round = 0; round < MIN_TOOLS_PER_COMPONENT; round++) {
    for (const tools of byComponent.values()) {
      if (selected.size >= MAX_TOOLS_FOR_PLANNER) break;

      const tool = tools[round];
      if (tool) selected.add(tool.callName);
    }

    if (selected.size >= MAX_TOOLS_FOR_PLANNER) break;
  }

  for (const tool of ranked) {
    if (selected.size >= MAX_TOOLS_FOR_PLANNER) break;
    selected.add(tool.callName);
  }

  return ranked.filter((tool) => selected.has(tool.callName));
};
