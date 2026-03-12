/**
 * Backfill all courses for a given university, year and semester by scraping on-device
 * and writing directly to Redis cache (no TTL).
 *
 * Usage (from project root):
 *   npm run backfill:semester -- --university=uq --year=2025 --semester="Semester 1" --limit=50
 *
 * Notes:
 * - Loads Redis config from .env or .env.local: KV_REST_API_URL + KV_REST_API_TOKEN
 *   (or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN).
 * - Unsets SCRAPER_API_KEY so fetchUqHtml hits UQ directly (run from your machine, not Vercel).
 * - Discovers all courses offered in the given semester via Programs & Courses search.
 * - For each course, fetches delivery modes and assessment data and backfills scrape/delivery cache.
 */

import * as fs from "fs";
import * as path from "path";
import * as cheerio from "cheerio";

import {
    deliveryCacheKey,
    getCached,
    scrapeCacheKey,
    setCached
} from "../src/lib/cache-redis";
import { fetchAvailableDeliveryModes } from "../src/lib/delivery-modes";
import type {
    DeliveryMode,
    SemesterSelection,
    SemesterType
} from "../src/lib/semester";
import { fetchCourseAssessment } from "../src/lib/uq-scraper";
import { fetchUqHtml } from "../src/lib/fetch-uq";
import { logger } from "../src/lib/logger";

type University = "uq" | "qut";

type CliOptions = {
    university: University;
    year: number;
    semester: SemesterType;
    force: boolean;
    limit?: number;
    dryRun: boolean;
    delayMs: number;
};

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
        process.env[key] = value;
    });
}

function loadEnv(): void {
    const cwd = process.cwd();
    loadEnvFile(path.join(cwd, ".env"));
    loadEnvFile(path.join(cwd, ".env.local"));
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const SEMESTER_TO_UQ_SEARCH_CODE: Record<SemesterType, string> = {
    "Semester 1": "1",
    "Semester 2": "2",
    Summer: "3"
};

function parseArgs(argv: string[]): CliOptions {
    const args: Record<string, string | boolean> = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith("--")) continue;
        const withoutPrefix = arg.slice(2);
        const eqIndex = withoutPrefix.indexOf("=");
        if (eqIndex !== -1) {
            const key = withoutPrefix.slice(0, eqIndex);
            const value = withoutPrefix.slice(eqIndex + 1);
            args[key] = value;
        } else {
            const key = withoutPrefix;
            const next = argv[i + 1];
            if (next && !next.startsWith("--")) {
                args[key] = next;
                i++;
            } else {
                args[key] = true;
            }
        }
    }

    const universityRaw = (args.university as string | undefined) ?? "uq";
    if (universityRaw !== "uq" && universityRaw !== "qut") {
        throw new Error(
            `Unsupported university: ${universityRaw}. Supported: uq, qut.`
        );
    }

    const yearRaw = args.year as string | undefined;
    if (!yearRaw) {
        throw new Error("Missing required --year argument.");
    }
    const year = parseInt(yearRaw, 10);
    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
        throw new Error(`Invalid year: ${yearRaw}`);
    }

    const semesterRaw = args.semester as string | undefined;
    if (!semesterRaw) {
        throw new Error(
            'Missing required --semester argument. Expected e.g. "Semester 1", "Semester 2", or "Summer".'
        );
    }
    const validSemesters: SemesterType[] = ["Semester 1", "Semester 2", "Summer"];
    if (!validSemesters.includes(semesterRaw as SemesterType)) {
        throw new Error(
            `Invalid semester: ${semesterRaw}. Expected one of: ${validSemesters.join(
                ", "
            )}`
        );
    }
    const semester = semesterRaw as SemesterType;

    const limitRaw = args.limit as string | undefined;
    const limit =
        limitRaw != null
            ? (() => {
                  const v = parseInt(limitRaw, 10);
                  return Number.isFinite(v) && v > 0 ? v : undefined;
              })()
            : undefined;

    const delayMsRaw = args.delayMs as string | undefined;
    const delayMs =
        delayMsRaw != null
            ? (() => {
                  const v = parseInt(delayMsRaw, 10);
                  return Number.isFinite(v) && v >= 0 ? v : 1500;
              })()
            : 1500;

    const force = Boolean(args.force);
    const dryRun = Boolean(args["dry-run"] ?? args.dryRun);

    return {
        university: universityRaw,
        year,
        semester,
        force,
        limit,
        dryRun,
        delayMs
    };
}

async function discoverUQCoursesForTerm(
    year: number,
    semester: SemesterType
): Promise<Set<string>> {
    const semesterCode = SEMESTER_TO_UQ_SEARCH_CODE[semester];
    if (!semesterCode) {
        throw new Error(`No UQ search code mapping for semester: ${semester}`);
    }

    const allCourses = new Set<string>();
    let page = 1;
    const maxPages = 50;

    // Helper to build the search URL with correct query encoding.
    const buildUrl = (pageNumber: number): string => {
        const base = "https://my.uq.edu.au/programs-courses/search.html";
        const params = new URLSearchParams();
        params.set("CourseParameters[semester]", `${year}:${semesterCode}`);
        params.set("searchType", "course");
        params.set("keywords", "");
        params.set("archived", "true");
        if (pageNumber > 1) {
            params.set("page", String(pageNumber));
        }
        return `${base}?${params.toString()}`;
    };

    // Extract course codes from a single HTML page.
    const extractCourseCodes = (html: string): string[] => {
        const $ = cheerio.load(html);
        const codes = new Set<string>();

        $("a[href*=\"course.html?course_code=\"]").each((_, el) => {
            const href = $(el).attr("href");
            if (!href) return;
            try {
                const url =
                    href.startsWith("http") || href.startsWith("https")
                        ? new URL(href)
                        : new URL(href, "https://my.uq.edu.au");
                const code = url.searchParams.get("course_code");
                if (code) {
                    codes.add(code.toUpperCase());
                }
            } catch {
                // Ignore malformed URLs
            }
        });

        return Array.from(codes);
    };

    // Optional: parse the "Showing N matches" count for logging/sanity.
    const parseTotalMatches = (html: string): number | null => {
        const $ = cheerio.load(html);
        const bodyText = $("body").text();
        const match = bodyText.match(/Showing\\s+(\\d+)\\s+matches/i);
        if (match) {
            const n = parseInt(match[1], 10);
            return Number.isFinite(n) ? n : null;
        }
        return null;
    };

    let totalMatches: number | null = null;

    while (page <= maxPages) {
        const url = buildUrl(page);
        logger.info("backfill_semester", "discover_page_start", {
            page,
            url
        });
        const html = await fetchUqHtml(url);

        if (page === 1) {
            totalMatches = parseTotalMatches(html);
            if (totalMatches != null) {
                console.log(`[Discover] Page reports ${totalMatches} total matches.`);
            }
        }

        const beforeCount = allCourses.size;
        const pageCodes = extractCourseCodes(html);

        if (pageCodes.length === 0) {
            logger.info("backfill_semester", "discover_page_empty", { page });
            break;
        }

        for (const code of pageCodes) {
            allCourses.add(code);
        }

        const afterCount = allCourses.size;
        logger.info("backfill_semester", "discover_page_summary", {
            page,
            pageCodes: pageCodes.length,
            totalUnique: afterCount
        });

        // If no new codes were added, we can stop to avoid infinite loops.
        if (afterCount === beforeCount) {
            console.log(
                `[Discover] No new course codes added on page ${page}. Stopping pagination.`
            );
            break;
        }

        // If we know total matches and we've already collected at least that many, stop.
        if (totalMatches != null && afterCount >= totalMatches) {
            console.log(
                `[Discover] Collected ${afterCount} codes, which meets or exceeds reported total ${totalMatches}.`
            );
            break;
        }

        page++;
        await delay(500); // Small pause between list pages.
    }

    console.log(
        `[Discover] Finished discovery for UQ ${semester} ${year}. Total unique course codes: ${allCourses.size}.`
    );

    return allCourses;
}

async function backfillSemesterUQ(options: CliOptions): Promise<void> {
    const { year, semester, force, limit, dryRun, delayMs } = options;

    logger.info("backfill_semester", "start", {
        university: "uq",
        year,
        semester,
        force,
        limit: limit ?? null,
        dryRun,
        delayMs
    });

    const courses = await discoverUQCoursesForTerm(year, semester);
    const codes = Array.from(courses).sort();

    if (codes.length === 0) {
        logger.warn("backfill_semester", "no_courses_discovered", {
            year,
            semester
        });
        return;
    }

    if (dryRun) {
        const preview =
            limit != null && codes.length > limit ? codes.slice(0, limit) : codes;
        logger.info("backfill_semester", "dry_run_summary", {
            totalDiscovered: codes.length,
            willProcess: preview.length,
            sample: preview.slice(0, 20)
        });
        return;
    }

    let processed = 0;
    let skippedExisting = 0;
    let failed = 0;

    const totalCourses =
        limit != null && limit < codes.length ? limit : codes.length;

    for (let i = 0; i < totalCourses; i++) {
        const courseCode = codes[i];
        logger.info("backfill_semester", "course_start", {
            index: i + 1,
            total: totalCourses,
            courseCode
        });

        try {
            // First determine delivery modes that actually exist for this course/term.
            const modes = await fetchAvailableDeliveryModes(
                courseCode,
                year,
                semester
            );
            if (modes.length === 0) {
                logger.warn("backfill_semester", "no_delivery_modes", {
                    courseCode,
                    year,
                    semester
                });
                continue;
            }

            // Backfill delivery cache entry for this (course, year, semester).
            const deliveryKey = deliveryCacheKey(
                courseCode,
                year,
                semester,
                "uq"
            );
            if (force) {
                await setCached(deliveryKey, { modes });
            } else {
                const existingDelivery = await getCached<{ modes: unknown }>(
                    deliveryKey
                );
                if (!existingDelivery) {
                    await setCached(deliveryKey, { modes });
                }
            }

            // For each distinct delivery mode, backfill scrape cache.
            // Deduplicate by delivery type, in case multiple offerings share the same mode.
            const distinctDeliveries = Array.from(
                new Set<DeliveryMode>(modes.map((m) => m.delivery))
            );

            for (const delivery of distinctDeliveries) {
                const semesterSelection: SemesterSelection = {
                    year,
                    semester,
                    delivery
                };
                const scrapeKey = scrapeCacheKey(
                    courseCode,
                    year,
                    semester,
                    delivery,
                    "uq"
                );

                if (!force) {
                    const existing = await getCached<unknown>(scrapeKey);
                    if (existing) {
                        skippedExisting++;
                        logger.debug(
                            "backfill_semester",
                            "scrape_entry_exists_skip",
                            {
                                courseCode,
                                year,
                                semester,
                                delivery
                            }
                        );
                        continue;
                    }
                }

                logger.info("backfill_semester", "scrape_course", {
                    courseCode,
                    year,
                    semester,
                    delivery
                });
                const assessment = await fetchCourseAssessment(
                    courseCode,
                    semesterSelection
                );
                await setCached(scrapeKey, assessment);
                processed++;
            }
        } catch (err) {
            failed++;
            logger.error("backfill_semester", "course_failed", {
                courseCode,
                year,
                semester,
                error:
                    err instanceof Error
                        ? err.message
                        : typeof err === "string"
                        ? err
                        : "unknown"
            });
        }

        if (i + 1 < totalCourses && delayMs > 0) {
            await delay(delayMs);
        }
    }

    logger.info("backfill_semester", "complete", {
        university: "uq",
        year,
        semester,
        processed,
        skippedExisting,
        failed
    });
}

async function main(): Promise<void> {
    loadEnv();

    // Use local scraping only (no ScraperAPI).
    delete process.env.SCRAPER_API_KEY;

    // Validate Redis configuration up front.
    const url =
        process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
    const token =
        process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
        console.error(
            "Missing Redis config. Set KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN) in .env or .env.local."
        );
        process.exit(1);
    }

    let options: CliOptions;
    try {
        options = parseArgs(process.argv.slice(2));
    } catch (err) {
        logger.error("backfill_semester", "arg_parse_error", {
            error:
                err instanceof Error
                    ? err.message
                    : typeof err === "string"
                    ? err
                    : "unknown"
        });
        // Keep a human-friendly usage line for local runs.
        console.error(
            'Usage: tsx scripts/backfill-semester.ts --university=uq --year=2025 --semester="Semester 1" [--limit=100] [--force] [--dry-run] [--delayMs=1500]'
        );
        process.exit(1);
        return;
    }

    if (options.university === "uq") {
        await backfillSemesterUQ(options);
    } else if (options.university === "qut") {
        logger.error("backfill_semester", "unsupported_university", {
            university: options.university
        });
        process.exit(1);
    } else {
        logger.error("backfill_semester", "invalid_university_branch", {
            university: options.university
        });
        process.exit(1);
    }
}

main().catch((err) => {
    logger.error("backfill_semester", "unhandled_error", {
        error:
            err instanceof Error
                ? err.message
                : typeof err === "string"
                ? err
                : "unknown"
    });
    process.exit(1);
});

