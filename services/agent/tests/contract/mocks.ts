// HTTP contracts exercise real routes with deterministic external boundaries.
jest.mock("../../src/graph/checkpointer", () => {
  const jobs = new Map<string, unknown>();
  return {
    saveJob: jest.fn(async (id: string, state: unknown) => { jobs.set(id, state); }),
    loadJob: jest.fn(async (id: string) => jobs.get(id) ?? null),
    isRedisHealthy: jest.fn(async () => true),
    closeRedis: jest.fn(async () => {}),
  };
});

// Route handlers schedule job timeouts and emitter cleanup. Clear them when the
// suite ends, without changing the application's timer behaviour during a test.
const timers = new Set<ReturnType<typeof setTimeout>>();
const schedule = global.setTimeout;
const timerSpy = jest.spyOn(global, "setTimeout").mockImplementation(((...args: Parameters<typeof setTimeout>) => {
  const timer = schedule(...args);
  timers.add(timer);
  return timer;
}) as typeof setTimeout);
afterAll(() => {
  timers.forEach(clearTimeout);
  timerSpy.mockRestore();
});
