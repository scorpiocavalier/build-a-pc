import "server-only";

// Shared HTML + plain-text layout for customer emails.

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export type Block =
  | { kind: "p"; text: string }
  | { kind: "table"; rows: [string, string][] }
  | { kind: "link"; text: string; href: string };

export function renderEmail(subject: string, blocks: Block[]): { html: string; text: string } {
  const html = blocks
    .map((b) => {
      if (b.kind === "p") return `<p style="margin:0 0 16px">${escape(b.text)}</p>`;
      if (b.kind === "link") {
        return `<p style="margin:24px 0"><a href="${escape(b.href)}" style="background:#7dd3fc;color:#0b1220;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escape(b.text)}</a></p>`;
      }
      const rows = b.rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:4px 16px 4px 0">${escape(label)}</td><td style="padding:4px 0;text-align:right;white-space:nowrap">${escape(value)}</td></tr>`,
        )
        .join("");
      return `<table style="border-collapse:collapse;margin:0 0 16px;width:100%;max-width:480px">${rows}</table>`;
    })
    .join("\n");
  const text = blocks
    .map((b) =>
      b.kind === "p"
        ? b.text
        : b.kind === "link"
          ? `${b.text}: ${b.href}`
          : b.rows.map(([label, value]) => `${label}  ${value}`).join("\n"),
    )
    .join("\n\n");
  return {
    html: `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111827;max-width:560px;margin:0 auto;padding:24px"><h1 style="font-size:20px;margin:0 0 20px">${escape(subject)}</h1>${html}</body></html>`,
    text: `${subject}\n\n${text}`,
  };
}
