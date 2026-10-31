"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { uploadProductImage } from "./actions";

const MAX_EDGE = 2000;

// Phone photos are often 5–15 MB. Shrink them in the browser before upload so
// they fit within the server's request limit; the server re-encodes anyway.
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))),
      "image/webp",
      0.9,
    ),
  );
}

export function ImageUpload({ productId }: { productId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function upload(files: FileList) {
    startTransition(async () => {
      const list = [...files];
      for (const [i, file] of list.entries()) {
        setStatus(`Uploading ${i + 1} of ${list.length}…`);
        let blob: Blob = file;
        try {
          blob = await shrink(file);
        } catch {
          // Fall back to the original; the server will validate it.
        }
        const data = new FormData();
        data.set("image", blob, file.name.replace(/\.\w+$/, ".webp"));
        const result = await uploadProductImage(productId, {}, data);
        if (result.error) {
          setStatus(`${file.name}: ${result.error}`);
          router.refresh();
          return;
        }
      }
      setStatus(null);
      if (input.current) input.current.value = "";
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-surface-raised has-[:disabled]:opacity-50">
        <Upload aria-hidden="true" className="size-4" />
        {pending ? "Uploading…" : "Add photos"}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          disabled={pending}
          className="sr-only"
          onChange={(e) => e.target.files?.length && upload(e.target.files)}
        />
      </label>
      <p role="status" className="text-sm text-muted">
        {status}
      </p>
    </div>
  );
}
