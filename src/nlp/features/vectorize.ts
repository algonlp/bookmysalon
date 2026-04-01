export const termFrequency = (tokens: string[]): Record<string, number> => {
  return tokens.reduce<Record<string, number>>((acc, token) => {
    acc[token] = (acc[token] ?? 0) + 1;
    return acc;
  }, {});
};
