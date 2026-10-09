'use client';

/** Reloads the page, so a failed server check runs again. */
export default function ReloadButton({ label }: { label: string }) {
    return (
        <button
            type="button"
            onClick={() => window.location.reload()}
            className="underline"
        >
            {label}
        </button>
    );
}
