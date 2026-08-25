/**
 * FOQUS wordmark (BRIEF §11).
 *
 * Bricolage Grotesque, all caps, tight tracking. The Q's tail is extended into a short vertical
 * line — a direct quotation of the day ribbon. That is the whole mark: no icon, no gradient.
 *
 * The tail is positioned relative to the Q's own span rather than to the word, so it stays put
 * whatever the font size or whether the display face has loaded yet.
 */

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-display font-bold uppercase leading-none tracking-[-0.045em] ${className}`}
      aria-label="FOQUS"
      role="img"
    >
      <span aria-hidden="true">FO</span>
      <span aria-hidden="true" className="relative inline-block">
        Q
        <span
          className="absolute bg-current"
          style={{
            // Sized in em so the tail scales with the type, never with the viewport.
            width: '0.095em',
            height: '0.40em',
            right: '0.085em',
            top: '0.62em',
          }}
        />
      </span>
      <span aria-hidden="true">US</span>
    </span>
  );
}
