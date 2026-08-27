/**
 * Resolves a page's captured Presenter reference (an interface name, e.g.
 * "IOrderPresenter") to a known presenter id (filename-derived, e.g.
 * "OrderPresenter"). Tolerates only the interface-to-implementation naming
 * convention already assumed elsewhere in this scanner (see
 * parseCodeBehind.ts's findPresenterRef) - no namespace awareness, no
 * guarantee against two unrelated presenters colliding under the same
 * stripped name. An unresolved reference returns null rather than guessing.
 */
export function resolvePresenterId(presenterRef: string, presenterIds: readonly string[]): string | null {
  if (presenterIds.includes(presenterRef)) return presenterRef;
  if (/^I[A-Z]/.test(presenterRef)) {
    const stripped = presenterRef.slice(1);
    if (presenterIds.includes(stripped)) return stripped;
  }
  return null;
}
