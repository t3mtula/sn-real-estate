/** Minimal ambient types for paged.js (no official @types package). */
declare module 'pagedjs' {
  export class Previewer {
    constructor(options?: unknown)
    preview(
      content: string | Node,
      stylesheets: Array<string | Record<string, string>>,
      renderTo: HTMLElement
    ): Promise<{ total: number }>
  }
}
