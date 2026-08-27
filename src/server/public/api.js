async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (data && data.error) || `${method} ${url} failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  getRun: () => request("GET", "/api/run"),
  getGate: (stage) => request("GET", `/api/gates/${stage}`),
  approveGate: (stage, reviewedBy) => request("POST", `/api/gates/${stage}/approve`, { reviewedBy }),
  rejectGate: (stage, reviewedBy, comment) => request("POST", `/api/gates/${stage}/reject`, { reviewedBy, comment }),

  getScanIndex: () => request("GET", "/api/scan/index"),
  getScanPage: (pageId) => request("GET", `/api/scan/pages/${encodeURIComponent(pageId)}`),
  getScanPresenter: (presenterId) => request("GET", `/api/scan/presenters/${encodeURIComponent(presenterId)}`),
  runScan: (sourceRoot) => request("POST", "/api/stages/scan", { sourceRoot }),

  getCrawlIndex: () => request("GET", "/api/crawl/index"),
  getCrawlPauseState: () => request("GET", "/api/crawl/pause-state"),
  getCrawlRun: (pageId, runId) => request("GET", `/api/crawl/pages/${encodeURIComponent(pageId)}/${encodeURIComponent(runId)}`),
  crawlFileUrl: (pageId, runId, filename) =>
    `/api/crawl/pages/${encodeURIComponent(pageId)}/${encodeURIComponent(runId)}/file/${filename}`,
  runCrawl: (baseUrl, resume) => request("POST", "/api/stages/crawl", { baseUrl, resume }),

  getAuthStatus: () => request("GET", "/api/crawl/auth"),
  startAuth: (baseUrl) => request("POST", "/api/crawl/auth/start", { baseUrl }),
  confirmAuth: () => request("POST", "/api/crawl/auth/confirm", {}),
  cancelAuth: () => request("POST", "/api/crawl/auth/cancel", {}),

  getRequirements: () => request("GET", "/api/requirements"),
  runRequirements: () => request("POST", "/api/stages/requirements", {}),

  getSlices: () => request("GET", "/api/slices"),
  runSlices: () => request("POST", "/api/stages/slices", {}),
  mergeSlices: (sliceIds, newId) => request("POST", "/api/slices/merge", { sliceIds, newId }),
  splitSlice: (sliceId, groups) => request("POST", "/api/slices/split", { sliceId, groups }),
  movePages: (pageIds, fromSliceId, toSliceId) => request("POST", "/api/slices/move", { pageIds, fromSliceId, toSliceId }),
  promoteComponent: (kind, id, sliceId) => request("POST", "/api/slices/promote", { kind, id, sliceId }),
  demoteComponent: (kind, id) => request("POST", "/api/slices/demote", { kind, id }),
  selectSlice: (sliceId) => request("POST", "/api/slices/select", { sliceId }),
};
