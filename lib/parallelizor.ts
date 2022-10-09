export default class Parallelizor<T> {
  private queue: Array<Promise<T>> = [];

  constructor(private readonly concurrency: number) {}

  public async run(
    fn: () => Promise<T>,
    flush = false,
  ): Promise<Array<T | undefined>> {
    this.queue.push(fn());

    if (this.queue.length >= this.concurrency || flush) {
      const result = await Promise.all(this.queue);
      this.queue = [];
      return result;
    }

    return [];
  }
}
