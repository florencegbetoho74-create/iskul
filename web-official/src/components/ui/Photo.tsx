/** Photo avec traitement duotone de marque + repli propre si l'image échoue. */
export default function Photo({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <span className={`photo${className ? ` ${className}` : ""}`}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.opacity = "0";
        }}
      />
    </span>
  );
}

/** ---------------------------
 *  Store Badges (Google Play / App Store)
 *  --------------------------*/
