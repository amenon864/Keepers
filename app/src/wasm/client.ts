import { KeepersClient } from "./KeepersClient";

let clientPromise: Promise<KeepersClient> | undefined;

export function getKeepersClient(): Promise<KeepersClient> {
    clientPromise ??= KeepersClient.create().catch((error: unknown) => {
        clientPromise = undefined;
        throw error;
    });

    return clientPromise;
}
