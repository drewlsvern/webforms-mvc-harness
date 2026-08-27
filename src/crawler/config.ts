export interface CrawlConfig {
  /** Base URL of the running WebForms application, e.g. "https://localhost:44300". */
  baseUrl: string;
  /** Cap on how many seeded pages to crawl in one run; omit for no cap. */
  maxPages?: number;
}
