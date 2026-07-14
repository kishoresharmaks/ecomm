import { headers } from "next/headers";

export async function JsonLd({ data }: { data: unknown }) {
  if (!data) {
    return null;
  }

  const items = Array.isArray(data) ? data : [data];
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      {items.map((item, index) => (
        <script
          key={index}
          nonce={nonce}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(item).replace(/</g, "\\u003c")
          }}
        />
      ))}
    </>
  );
}
