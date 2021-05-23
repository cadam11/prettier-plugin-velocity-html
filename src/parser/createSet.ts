export default <T extends { toString(): string }>(array: T[]): Set<T> => {
  const set = new Set<T>();
  for (const element of array) {
    if (set.has(element)) {
      throw new Error(element.toString() + " appeared second time");
    }
    set.add(element);
  }
  return set;
};
