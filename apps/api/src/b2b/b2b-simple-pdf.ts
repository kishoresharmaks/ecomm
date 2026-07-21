export function createSimpleB2BPdf(lines: string[]) {
  const pageContent = [
    "BT",
    "/F1 12 Tf",
    "50 790 Td",
    "16 TL",
    ...lines
      .flatMap((line, index) => [
        index === 0
          ? "/F1 18 Tf"
          : index === 1
            ? "/F1 10 Tf"
            : index === 2
              ? "/F1 12 Tf"
              : "",
        `(${pdfText(line)}) Tj`,
        "T*",
      ])
      .filter(Boolean),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(pageContent, "utf8")} >>\nstream\n${pageContent}\nendstream`,
  ];
  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(chunks.join(""), "utf8"));
    chunks.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });

  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");
  offsets.slice(1).forEach((offset) => {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  });
  chunks.push(
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  return Buffer.from(chunks.join(""), "utf8");
}

function pdfText(value: string) {
  return value
    .replace(/[\\()]/g, (character) => `\\${character}`)
    .replace(/[^\x20-\x7E]/g, "?");
}
