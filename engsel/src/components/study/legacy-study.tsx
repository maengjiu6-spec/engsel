export function LegacyStudy({ hash, title }: { hash: string; title: string }) {
  return (
    <iframe
      key={hash}
      title={title}
      src={`/studio/index.html?embed=1#${hash}`}
      className="block h-[calc(100dvh-6.75rem)] w-full border-0 bg-stone-50"
    />
  );
}
