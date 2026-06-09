import { expect, test, type Page, type Response } from "@playwright/test";

interface GeneratedPng {
    name: string;
    mimeType: "image/png";
    buffer: Buffer;
}

test("runs the local photo culling workflow", async ({ page }) => {
    const browserErrors: string[] = [];
    const resourceResponses = new Map<string, Response>();
    let workerScriptPath: string | undefined;

    page.on("pageerror", (error) => {
        browserErrors.push(`pageerror: ${error.message}`);
    });
    page.on("console", (message) => {
        if (message.type() === "error") {
            browserErrors.push(`console.error: ${message.text()}`);
        }
    });
    page.context().on("response", (response) => {
        const pathname = new URL(response.url()).pathname;

        if (pathname.endsWith("keepers.mjs")) {
            resourceResponses.set("keepers.mjs", response);
        } else if (pathname.endsWith("keepers.wasm")) {
            resourceResponses.set("keepers.wasm", response);
        } else if (/analysisWorker.*\.js$/.test(pathname)) {
            resourceResponses.set("analysis-worker", response);
        }
    });
    page.on("worker", (worker) => {
        const pathname = new URL(worker.url()).pathname;

        if (/analysisWorker.*\.js$/.test(pathname)) {
            workerScriptPath = pathname;
        }
    });

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Keepers" })).toBeVisible();
    await expect(
        page.getByText(
            "Photos stay on this device and are processed locally in your browser."
        )
    ).toBeVisible();

    const files = await generateFixturePngs(page);
    await page.locator('input[type="file"]').setInputFiles(files);

    await expect(page.getByText("3 selected photos")).toBeVisible();
    await expect(page.getByText("similar-a.png")).toBeVisible();
    await expect(page.getByText("similar-b.png")).toBeVisible();
    await expect(page.getByText("distinct.png")).toBeVisible();

    await page.getByRole("button", { name: "Analyze photos" }).click();

    await expect(
        page.getByRole("button", { name: "Recommendations ready" })
    ).toBeVisible({ timeout: 30_000 });

    const groups = page.getByRole("region", { name: /^Group \d+$/ });
    await expect.poll(async () => groups.count()).toBeGreaterThan(0);

    for (let index = 0; index < await groups.count(); ++index) {
        const group = groups.nth(index);
        await expect(group.getByText("Recommended", { exact: true })).toHaveCount(1);
        await expect(group.getByText(/Overall \d+%/)).not.toHaveCount(0);
    }

    await expect(page.getByText(/Overall \d+%/)).toHaveCount(3);
    await expect(page.getByText("Review recommendations")).toBeVisible();
    await expect(page.getByText("Complete")).not.toHaveCount(0);

    await expect(page.getByText("similar-a.png")).toBeVisible();
    await expect(page.getByText("similar-b.png")).toBeVisible();
    await expect(page.getByText("distinct.png")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);

    await verifyGeneratedAssetFetch(
        page,
        resourceResponses,
        "/assets/generated/keepers.mjs",
        "keepers.mjs"
    );
    await verifyGeneratedAssetFetch(
        page,
        resourceResponses,
        "/assets/generated/keepers.wasm",
        "keepers.wasm"
    );
    expect(
        workerScriptPath,
        "analysis worker script did not load during the browser workflow"
    ).toBeDefined();
    if (
        workerScriptPath !== undefined &&
        !resourceResponses.has("analysis-worker")
    ) {
        await verifyGeneratedAssetFetch(
            page,
            resourceResponses,
            workerScriptPath,
            "analysis-worker"
        );
    }
    assertSuccessfulResource(resourceResponses, "keepers.mjs");
    assertSuccessfulResource(resourceResponses, "keepers.wasm");
    assertSuccessfulResource(resourceResponses, "analysis-worker");

    await page.getByRole("button", { name: "Clear all" }).click();
    await expect(
        page.getByText("Select a few local images to decode them in your browser.")
    ).toBeVisible();
    await expect(page.getByRole("img")).toHaveCount(0);
    await expect(page.getByRole("region", { name: /^Group \d+$/ })).toHaveCount(0);
    await expect(page.getByText("Recommended", { exact: true })).toHaveCount(0);

    expect(browserErrors).toEqual([]);
});

async function generateFixturePngs(page: Page): Promise<GeneratedPng[]> {
    const fixtures = await page.evaluate(async () => {
        type FixtureKind = "similar-a" | "similar-b" | "distinct";

        async function drawFixture(kind: FixtureKind): Promise<number[]> {
            const canvas = document.createElement("canvas");
            canvas.width = 64;
            canvas.height = 64;
            const context = canvas.getContext("2d");

            if (context === null) {
                throw new Error("Unable to create canvas context.");
            }

            if (kind === "distinct") {
                for (let y = 0; y < canvas.height; ++y) {
                    const value = Math.round((y / (canvas.height - 1)) * 255);
                    context.fillStyle = `rgb(${value}, ${140 - Math.floor(value / 4)}, ${255 - value})`;
                    context.fillRect(0, y, canvas.width, 1);
                }

                context.fillStyle = "rgba(255, 255, 255, 0.75)";
                context.fillRect(8, 44, 48, 6);
            } else {
                for (let x = 0; x < canvas.width; x += 8) {
                    const isLight = Math.floor(x / 8) % 2 === 0;
                    const lightValue = kind === "similar-b" ? 235 : 255;
                    context.fillStyle = isLight
                        ? `rgb(${lightValue}, ${lightValue}, ${lightValue})`
                        : "rgb(18, 18, 18)";
                    context.fillRect(x, 0, 8, canvas.height);
                }

                context.fillStyle =
                    kind === "similar-b"
                        ? "rgba(190, 30, 30, 0.9)"
                        : "rgba(220, 20, 20, 0.9)";
                context.fillRect(kind === "similar-b" ? 25 : 24, 24, 16, 16);
            }

            const blob = await new Promise<Blob>((resolve, reject) => {
                canvas.toBlob((value) => {
                    if (value === null) {
                        reject(new Error("Canvas PNG export failed."));
                    } else {
                        resolve(value);
                    }
                }, "image/png");
            });

            return Array.from(new Uint8Array(await blob.arrayBuffer()));
        }

        return [
            { name: "similar-a.png", bytes: await drawFixture("similar-a") },
            { name: "similar-b.png", bytes: await drawFixture("similar-b") },
            { name: "distinct.png", bytes: await drawFixture("distinct") }
        ];
    });

    return fixtures.map((fixture) => ({
        name: fixture.name,
        mimeType: "image/png",
        buffer: Buffer.from(fixture.bytes)
    }));
}

async function verifyGeneratedAssetFetch(
    page: Page,
    responses: Map<string, Response>,
    assetPath: string,
    resourceName: string
): Promise<void> {
    const responsePromise = page.waitForResponse(
        (response) => new URL(response.url()).pathname === assetPath
    );

    await page.evaluate((path) => {
        void fetch(path, { cache: "reload" });
    }, assetPath);

    responses.set(resourceName, await responsePromise);
}

function assertSuccessfulResource(
    responses: ReadonlyMap<string, Response>,
    resourceName: string
): void {
    const response = responses.get(resourceName);

    expect(
        response,
        `${resourceName} did not load during the browser workflow`
    ).toBeDefined();
    expect(
        response?.status(),
        `${resourceName} returned HTTP ${response?.status()}`
    ).toBeGreaterThanOrEqual(200);
    expect(
        response?.status(),
        `${resourceName} returned HTTP ${response?.status()}`
    ).toBeLessThan(300);
}
