import { sha1 } from "js-sha1";

export async function computeSHA1(blob: Blob): Promise<string> {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
        try {
            const buffer = await blob.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
        } catch (err) {
            console.warn("WebCrypto SHA-1 failed, falling back to js-sha1:", err);
        }
    }

    // Fallback to js-sha1
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    return sha1(bytes);
}