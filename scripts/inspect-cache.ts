/**
 * Inspect a single scrape/delivery cache entry + failed-scrapes marker.
 *
 * Usage:
 *   npx tsx scripts/inspect-cache.ts uq DRAM2030 2026 "Semester 1" Internal
 */
import * as fs from "fs";
import * as path from "path";
import {
    getCached,
    scrapeCacheKey,
    deliveryCacheKey,
    isFailedScrape
} from "../src/lib/cache-redis";

function loadEnvFile(envPath: string): void {
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, "utf8");
    content.split("\n").forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const eq = trimmed.indexOf("=");
        if (eq <= 0) return;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        // Don't overwrite existing process env
        if (process.env[key] == null) {
            process.env[key] = value;
        }
    });
}

function loadEnv(): void {
    const cwd = process.cwd();
    loadEnvFile(path.join(cwd, ".env"));
    loadEnvFile(path.join(cwd, ".env.local"));
}

async function main() {
    loadEnv();

    const [university, courseCodeRaw, yearRaw, semesterRaw, deliveryRaw] =
        process.argv.slice(2);

    if (!university || !courseCodeRaw || !yearRaw || !semesterRaw || !deliveryRaw) {
        console.error(
            'Usage: npx tsx scripts/inspect-cache.ts <university> <courseCode> <year> <semester> <delivery>\n' +
                'Example: npx tsx scripts/inspect-cache.ts uq DRAM2030 2026 "Semester 1" Internal'
        );
        process.exit(1);
    }

    const courseCode = courseCodeRaw.trim().toUpperCase();
    const year = parseInt(yearRaw, 10);
    const semester = semesterRaw;
    const delivery = deliveryRaw;

    const key = scrapeCacheKey(courseCode, year, semester, delivery, university);
    const legacyKey = `scrape:${courseCode}:${year}:${semester.replace(/\s+/g, "_")}:${delivery}`;
    const deliveryKey = deliveryCacheKey(courseCode, year, semester, university);
    const deliveryLegacyKey = `delivery:${courseCode}:${year}:${semester.replace(/\s+/g, "_")}`;

    const [cached, cachedLegacy, cachedDelivery, cachedDeliveryLegacy, failed] =
        await Promise.all([
            getCached<unknown>(key),
            getCached<unknown>(legacyKey),
            getCached<unknown>(deliveryKey),
            getCached<unknown>(deliveryLegacyKey),
            isFailedScrape(key)
        ]);

    const summarize = (v: unknown) => {
        if (v == null) return null;
        if (typeof v === "string") return { type: "string", length: v.length };
        if (Array.isArray(v)) return { type: "array", length: v.length };
        if (typeof v === "object") return { type: "object", keys: Object.keys(v as any).slice(0, 20) };
        return { type: typeof v };
    };

    console.log(
        JSON.stringify(
            {
                university,
                courseCode,
                year,
                semester,
                delivery,
                scrapeKey: key,
                scrapeKeyExists: cached != null,
                scrapeKeySummary: summarize(cached),
                legacyScrapeKey: legacyKey,
                legacyScrapeKeyExists: cachedLegacy != null,
                legacyScrapeKeySummary: summarize(cachedLegacy),
                deliveryKey,
                deliveryKeyExists: cachedDelivery != null,
                deliveryKeySummary: summarize(cachedDelivery),
                legacyDeliveryKey: deliveryLegacyKey,
                legacyDeliveryKeyExists: cachedDeliveryLegacy != null,
                legacyDeliveryKeySummary: summarize(cachedDeliveryLegacy),
                isFailedScrape: failed
            },
            null,
            2
        )
    );
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

