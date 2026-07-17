"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parsePdf } from "@/app/actions/parsePdf";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import { savePdfToSession } from "@/lib/storage";

type Tab = "url" | "pdf";

const MAX_PDF_SIZE = 25 * 1024 * 1024;

export default function Home() {
  const [tab, setTab] = useState<Tab>("url");
  const [url, setUrl] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [parsing, setParsing] = useState(false);
  const router = useRouter();

  const handleSubmitUrl = (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    if (!url.startsWith("https://")) {
      setError("Please enter a valid HTTPS URL");
      return;
    }

    setError("");
    const encoded = encodeURIComponent(url);
    router.push(`/read/${encoded}`);
  };

  const handleSubmitPdf = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!pdfFile) {
      setError("Please choose a PDF");
      return;
    }

    if (pdfFile.size > MAX_PDF_SIZE) {
      setError("PDF exceeds the 25 MB size limit");
      return;
    }

    if (pdfFile.type !== "application/pdf") {
      setError("Please choose a PDF file");
      return;
    }

    setError("");
    setParsing(true);

    try {
      const buf = new Uint8Array(await pdfFile.arrayBuffer());
      const result = await parsePdf(buf);

      if (!result.success || !result.data) {
        setError(result.error || "Failed to parse PDF");
        return;
      }

      const id = crypto.randomUUID();
      savePdfToSession(id, {
        article: {
          content: result.data.markdown,
          title: result.data.metadata.title,
          author: result.data.metadata.author,
          date: result.data.metadata.publishedTime,
          images: result.data.images,
        },
        timestamp: Date.now(),
      });

      router.push(`/read/${encodeURIComponent(`pdf-${id}`)}`);
    } catch {
      setError("Something went wrong while parsing the PDF");
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center">
      <header className="max-w-lg absolute top-0 right-0 p-4 z-10">
        <ThemeToggle />
      </header>

      <main className="max-w-lg flex flex-col gap-8 items-center justify-center p-4">
        <div className="w-full space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Shift and Read</h1>
          <p className="text-xl text-muted-foreground">
            Read any blog or PDF in your language
          </p>
          <p className="text-md text-muted-foreground">
            Paste a URL or upload a PDF below to read and translate.
          </p>
        </div>

        <div className="inline-flex w-full rounded-lg border border-input p-1 bg-muted/40">
          {(["url", "pdf"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setError("");
              }}
              className={`flex-1 h-9 rounded-md text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "url" ? "URL" : "Upload PDF"}
            </button>
          ))}
        </div>

        {tab === "url" ? (
          <form onSubmit={handleSubmitUrl} className="space-y-4 w-full">
            <div className="space-y-2">
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError("");
                }}
                placeholder="https://example.com/article"
                className="w-full h-14 px-4 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
              {error && (
                <p className="text-sm text-destructive text-left">{error}</p>
              )}
            </div>

            <Button type="submit" size="sm" className="w-full h-10 text-base">
              Extract & Read
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmitPdf} className="space-y-4 w-full">
            <label
              htmlFor="pdf-file"
              className="flex flex-col items-center justify-center w-full h-32 rounded-lg border border-dashed border-input bg-background hover:bg-muted/40 cursor-pointer transition-colors"
            >
              {pdfFile ? (
                <span className="text-sm font-medium truncate px-4 w-full text-center">
                  {pdfFile.name}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Choose a PDF (max 25 MB)
                </span>
              )}
              <input
                id="pdf-file"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  setPdfFile(e.target.files?.[0] ?? null);
                  setError("");
                }}
              />
            </label>

            {error && (
              <p className="text-sm text-destructive text-left">{error}</p>
            )}

            <Button
              type="submit"
              size="sm"
              className="w-full h-10 text-base"
              disabled={parsing}
            >
              {parsing ? "Parsing..." : "Extract & Read"}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}