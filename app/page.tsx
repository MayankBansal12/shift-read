"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Field, FieldError } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import ThemeToggle from "@/components/ThemeToggle";

export default function Home() {
    const [url, setUrl] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const normalize = (raw: string) => {
        const trimmed = raw.trim();
        if (!/^https?:\/\//i.test(trimmed)) {
            return `https://${trimmed}`;
        }
        return trimmed;
    };

    const handleSubmitUrl = (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim()) {
            setError("Please enter a URL");
            return;
        }

        const normalized = normalize(url);

        try {
            const parsed = new URL(normalized);
            if (!["http:", "https:"].includes(parsed.protocol)) {
                setError("Only http and https URLs are supported");
                return;
            }
        } catch {
            setError("Please enter a valid URL (e.g. https://example.com)");
            return;
        }

        setError("");
        router.push(`/${encodeURIComponent(normalized)}`);
    };

    return (
        <div className="relative min-h-screen flex flex-col justify-center items-center">
            <header className="max-w-lg absolute top-0 right-0 p-4 z-10">
                <ThemeToggle />
            </header>

            <main className="max-w-lg flex flex-col gap-6 items-center justify-center p-4">
                <div className="w-full space-y-4 text-center">
                    <div className="h-24 flex items-center justify-center">
                        <Image
                            src="/shift-logo.png"
                            alt="Shift"
                            width={200}
                            height={48}
                            priority
                        />
                    </div>
                    <p className="text-muted-foreground">
                        read any blog on the internet in your own language
                    </p>
                </div>

                <form onSubmit={handleSubmitUrl} className="w-full">
                  <Field>
                    <InputGroup>
                      <InputGroupInput
                        placeholder="Enter the blog url you wanna read..."
                        value={url}
                        onChange={(e) => {
                          setUrl(e.target.value);
                          setError("");
                        }}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton type="submit">Read</InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldError errors={error ? [{ message: error }] : undefined} />
                    </Field>

                    <p className="text-sm text-muted-foreground my-4">
                        you can append
                        <span className="px-1 font-semibold text-primary">
                            {process.env.NEXT_PUBLIC_CLIENT_URL}/
                        </span>
                        in front of any url to use shift
                    </p>
                </form>
            </main>
        </div>
    );
}
