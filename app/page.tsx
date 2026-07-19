"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Field, FieldError } from "@/components/ui/field";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from "@/components/ui/input-group";
import ThemeToggle from "@/components/ThemeToggle";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkBadge01Icon } from "@hugeicons/core-free-icons";

export default function Home() {
    const [url, setUrl] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();
    const [isCopied, setIsCopied] = useState(false);

    const clientUrl = `${process.env.NEXT_PUBLIC_CLIENT_URL}/`;

    const handleCopyClientUrl = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(clientUrl);
            setIsCopied(true);
        } catch {
            console.error("unable to copy to clipboard!");
        } finally {
            setTimeout(() => setIsCopied(false), 2000);
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "b" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleCopyClientUrl();
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [handleCopyClientUrl]);

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
            setError("please enter a URL");
            return;
        }

        const normalized = normalize(url);

        try {
            const parsed = new URL(normalized);
            if (!["http:", "https:"].includes(parsed.protocol)) {
                setError("only http and https URLs are supported");
                return;
            }
        } catch {
            setError("please enter a valid URL (e.g. https://example.com)");
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
                    <p className="text-lg text-muted-foreground">
                        read any blog on the internet in your language.
                    </p>
                </div>

                <form onSubmit={handleSubmitUrl} className="w-full">
                    <Field>
                        <InputGroup>
                            <InputGroupInput
                                placeholder="enter the blog url you wanna read..."
                                value={url}
                                onChange={(e) => {
                                    setUrl(e.target.value);
                                    setError("");
                                }}
                            />
                            <InputGroupAddon align="inline-end">
                                <InputGroupButton type="submit" disabled={!url.trim()}>
                                    read
                                </InputGroupButton>
                            </InputGroupAddon>
                        </InputGroup>
                        <FieldError
                            errors={error ? [{ message: error }] : undefined}
                        />
                    </Field>

                    <p className="text-sm text-muted-foreground/80 my-4">
                        you can append
                        <Tooltip>
                            <TooltipTrigger closeOnClick={false}>
                                <span
                                    className="px-1 font-semibold text-primary inline-flex items-center gap-1"
                                    onClick={handleCopyClientUrl}
                                >
                                    {clientUrl}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent className="pr-1.5">
                                {isCopied ? (
                                    <span className="inline-flex items-center gap-1">
                                        <HugeiconsIcon icon={CheckmarkBadge01Icon} size={14} />
                                        copied!
                                    </span>
                                ) : (
                                    <span>
                                        click or press <Kbd className="text-xs font-normal">
                                            ⌘+B
                                        </Kbd> to copy
                                    </span>
                                )}
                            </TooltipContent>
                        </Tooltip>
                        in front of any blog to use shift
                    </p>
                </form>
            </main>
        </div>
    );
}
