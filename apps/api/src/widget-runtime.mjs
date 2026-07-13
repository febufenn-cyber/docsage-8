import { answerQuestion } from '../../../packages/answering/src/engine.mjs';
import { createWidgetApp, MemoryRateLimiter } from '../../../packages/widget-api/src/index.mjs';

export function createSingleProjectWidgetRuntime(options) {
  const {
    tokenSecret,
    project,
    chunks,
    provider,
    rateLimiter = new MemoryRateLimiter(),
    feedbackRateLimiter,
    feedbackStore,
    limits
  } = options ?? {};
  if (!project?.id) throw new TypeError('A single public project is required');
  if (!Array.isArray(chunks)) throw new TypeError('Project chunks are required');

  return createWidgetApp({
    tokenSecret,
    rateLimiter,
    feedbackRateLimiter,
    feedbackStore,
    limits,
    projectResolver: async (projectId) => projectId === project.id ? project : null,
    answerService: async ({ question, projectId }) => answerQuestion({
      question,
      projectId,
      chunks,
      provider
    })
  });
}
