export function JsonLd({ data }: { data: unknown }) {
  if (!data) {
    return null;
  }

  const items = Array.isArray(data) ? data : [data];

  return (
    <>
      {items.map((item, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(item).replace(/</g, "\\u003c")
          }}
        />
      ))}
    </>
  );
}

