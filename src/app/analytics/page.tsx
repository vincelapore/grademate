"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { GmShell } from "@/components/gm/GmShell";

type Counts = Record<string, number> & {
    coursesCached?: number;
    coursesCachedCapped?: boolean;
    coursesCachedByYearSemester?: Record<string, Record<string, number>>;
    coursesCachedByYearSemesterTotal?: number;
    coursesCachedByYearSemesterCapped?: boolean;
    recentScrapeErrors?: string[];
    recentDeliveryErrors?: string[];
};

const SCRAPE_LABELS: Record<string, string> = {
    "scrape:hits": "Cache hits",
    "scrape:misses": "Cache misses (ScraperAPI used)",
    "scrape:errors": "Errors",
    "scrape:failed_skip": "Limit reached – no retry"
};

const DELIVERY_LABELS: Record<string, string> = {
    "delivery:hits": "Cache hits",
    "delivery:misses": "Cache misses",
    "delivery:errors": "Errors"
};

const CLIENT_LABELS: Record<string, string> = {
    calendar_export: "Calendar exported",
    hurdle_clicked: "Hurdle info opened",
    copy_link: "Copy link",
    reset_confirmed: "Reset confirmed",
    remove_course: "Course removed",
    how_to_opened: "How to use opened",
    mark_help_opened: "Mark help opened",
    calendar_popup_opened: "Calendar popup opened"
};

const SCRAPE_KEYS = [
    "scrape:hits",
    "scrape:misses",
    "scrape:errors",
    "scrape:failed_skip"
];
const DELIVERY_KEYS = ["delivery:hits", "delivery:misses", "delivery:errors"];
const CLIENT_KEYS = [
    "calendar_export",
    "hurdle_clicked",
    "copy_link",
    "reset_confirmed",
    "remove_course",
    "how_to_opened",
    "mark_help_opened",
    "calendar_popup_opened"
];

function semesterSortKey(semester: string): number {
    const s = semester.toLowerCase();
    if (s.includes("semester 1") || s === "sem 1") return 10;
    if (s.includes("semester 2") || s === "sem 2") return 20;
    if (s.includes("summer")) return 30;
    return 99;
}

function CoursesCachedBreakdown({
    breakdown,
    capped
}: {
    breakdown: Record<string, Record<string, number>>;
    capped?: boolean;
}) {
    const years = Object.keys(breakdown)
        .filter((y) => /^\d{4}$/.test(y))
        .sort((a, b) => Number(b) - Number(a));

    if (years.length === 0) return null;

    return (
        <div className='mt-4 rounded-xl border border-slate-700/50 bg-slate-950/40 p-4'>
            <div className='flex items-center justify-between gap-3'>
                <p className='text-xs font-medium uppercase tracking-wider text-slate-400'>
                    Cached courses by semester
                </p>
                {capped && (
                    <span className='text-xs font-medium text-slate-500'>
                        (approx)
                    </span>
                )}
            </div>
            <div className='mt-3 overflow-x-auto'>
                <table className='w-full text-sm'>
                    <thead>
                        <tr className='text-left text-xs font-semibold text-slate-400'>
                            <th className='py-2 pr-4'>Year</th>
                            <th className='py-2 pr-4'>Semester</th>
                            <th className='py-2 text-right'>Courses</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-800/60'>
                        {years.flatMap((year) => {
                            const semesters = Object.keys(breakdown[year] ?? {}).sort(
                                (a, b) =>
                                    semesterSortKey(a) - semesterSortKey(b) ||
                                    a.localeCompare(b)
                            );
                            return semesters.map((semester, idx) => (
                                <tr key={`${year}-${semester}`}>
                                    <td className='py-2 pr-4 font-mono text-slate-300'>
                                        {idx === 0 ? year : ""}
                                    </td>
                                    <td className='py-2 pr-4 text-slate-300'>
                                        {semester}
                                    </td>
                                    <td className='py-2 text-right font-mono tabular-nums text-slate-100'>
                                        {(breakdown[year]?.[semester] ?? 0).toLocaleString()}
                                    </td>
                                </tr>
                            ));
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function StatCard({
    label,
    value,
    capped,
    detail,
    isExpanded,
    onToggle
}: {
    label: string;
    value: number;
    capped?: boolean;
    detail?: { recent?: string[] };
    isExpanded?: boolean;
    onToggle?: () => void;
}) {
    const hasDetail =
        (detail?.recent?.length ?? 0) > 0 && value > 0;
    const canExpand = hasDetail && onToggle;

    return (
        <div
            className={`rounded-xl border bg-slate-900/50 px-4 py-3 backdrop-blur-sm transition-all duration-150 hover:bg-slate-800/70 hover:border-slate-600 ${
                canExpand
                    ? "cursor-pointer border-rose-500/40 hover:border-rose-400 hover:bg-slate-800/80 hover:shadow-md hover:shadow-rose-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    : "border-slate-700/50"
            }`}
            onClick={canExpand ? onToggle : undefined}
            role={canExpand ? "button" : undefined}
            tabIndex={canExpand ? 0 : undefined}
            onKeyDown={
                canExpand
                    ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onToggle?.();
                          }
                      }
                    : undefined
            }
        >
            <div className='flex items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-medium text-slate-400'>
                        {label}
                    </p>
                    <p className='mt-1 text-2xl font-semibold tabular-nums text-slate-50'>
                        {capped ? "≈ " : ""}
                        {value.toLocaleString()}
                    </p>
                </div>
                {canExpand && (
                    <span
                        className={`mt-1 shrink-0 text-slate-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        aria-hidden
                    >
                        <svg
                            className='h-4 w-4'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                        >
                            <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M19 9l-7 7-7-7'
                            />
                        </svg>
                    </span>
                )}
            </div>
            {hasDetail && isExpanded && detail?.recent && (
                <div className='mt-4 transition-all duration-200'>
                    <div className='rounded-lg border border-rose-500/20 bg-rose-950/30 px-3 py-2.5'>
                        <p className='mb-2 text-xs font-medium uppercase tracking-wider text-rose-300/90'>
                            Recent courses ({detail.recent.length} shown)
                        </p>
                        <ul className='space-y-1.5 max-h-48 overflow-y-auto'>
                            {[...detail.recent].reverse().map((course, i) => (
                                <li
                                    key={`${course}-${i}`}
                                    className='rounded-md bg-slate-900/60 px-2.5 py-1.5 font-mono text-sm text-slate-200'
                                >
                                    {course}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

function Section({
    title,
    keys,
    labels,
    counts,
    keyDetails,
    expandedKey,
    onToggleExpand
}: {
    title: string;
    keys: string[];
    labels: Record<string, string>;
    counts: Counts;
    keyDetails?: Record<string, { recent?: string[] }>;
    expandedKey?: string | null;
    onToggleExpand?: (key: string) => void;
}) {
    return (
        <section className='rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 via-slate-950/50 to-slate-900/30 p-6 backdrop-blur-sm shadow-xl shadow-black/20 sm:p-8'>
            <h2 className='mb-4 text-lg font-semibold text-slate-100'>
                {title}
            </h2>
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                {keys.map((key) => (
                    <StatCard
                        key={key}
                        label={labels[key] ?? key}
                        value={counts[key] ?? 0}
                        detail={keyDetails?.[key]}
                        isExpanded={expandedKey === key}
                        onToggle={
                            onToggleExpand
                                ? () => onToggleExpand(expandedKey === key ? "" : key)
                                : undefined
                        }
                    />
                ))}
            </div>
        </section>
    );
}

function AnalyticsContent() {
    const searchParams = useSearchParams();
    const [counts, setCounts] = useState<Counts | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);

    const secret =
        searchParams.get("secret") ??
        (typeof process.env.NEXT_PUBLIC_ANALYTICS_SECRET === "string"
            ? process.env.NEXT_PUBLIC_ANALYTICS_SECRET
            : "");

    const fetchCounts = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const url = `/api/analytics${secret ? `?secret=${encodeURIComponent(secret)}` : ""}`;
            const res = await fetch(url);
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error ?? `HTTP ${res.status}`);
            }
            const data = (await res.json()) as Counts;
            setCounts(data);
        } catch (e) {
            setError(
                e instanceof Error ? e.message : "Failed to load analytics"
            );
        } finally {
            setLoading(false);
        }
    }, [secret]);

    useEffect(() => {
        fetchCounts();
    }, [fetchCounts]);

    if (loading) {
        return (
            <GmShell variant='app' showFooter={false}>
                <main className='gm-container'>
                    <p style={{ color: "var(--color-text-secondary)" }}>
                        Loading analytics…
                    </p>
                </main>
            </GmShell>
        );
    }

    if (error) {
        return (
            <GmShell variant='app' showFooter={false}>
                <main className='gm-container'>
                    <div className='gm-card'>
                        <p style={{ color: "#ef4444" }}>{error}</p>
                        <button
                            type='button'
                            onClick={fetchCounts}
                            className='gm-btn-ghost'
                            style={{ marginTop: 12 }}
                        >
                            Retry
                        </button>
                    </div>
                </main>
            </GmShell>
        );
    }

    return (
        <GmShell variant='app'>
            <main className='gm-container'>
                <header style={{ marginBottom: 18 }}>
                    <p style={{ margin: 0 }}>
                        <Link href='/' className='gm-nav-link'>
                            ← Back
                        </Link>
                    </p>
                    <h1
                        style={{
                            marginTop: 10,
                            marginBottom: 0,
                            fontFamily: "var(--font-gm-serif)",
                            fontWeight: 400,
                            letterSpacing: "-0.5px",
                        }}
                    >
                        Analytics
                    </h1>
                </header>

                <div className='flex flex-col gap-8'>
                    <section className='rounded-2xl border border-slate-800/50 bg-gradient-to-br from-slate-900/50 via-slate-950/50 to-slate-900/30 p-6 backdrop-blur-sm shadow-xl shadow-black/20 sm:p-8'>
                        <h2 className='mb-4 text-lg font-semibold text-slate-100'>
                            Scrape (course lookups)
                        </h2>
                        <div className='mb-4'>
                            <StatCard
                                label='Courses cached'
                                value={counts?.coursesCached ?? 0}
                                capped={counts?.coursesCachedCapped}
                            />
                            {counts?.coursesCachedByYearSemester && (
                                <CoursesCachedBreakdown
                                    breakdown={counts.coursesCachedByYearSemester}
                                    capped={counts?.coursesCachedByYearSemesterCapped}
                                />
                            )}
                        </div>
                        <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                            {SCRAPE_KEYS.map((key) => (
                                <StatCard
                                    key={key}
                                    label={SCRAPE_LABELS[key] ?? key}
                                    value={counts?.[key] ?? 0}
                                    detail={
                                        key === "scrape:errors"
                                            ? {
                                                  recent:
                                                      counts?.recentScrapeErrors
                                              }
                                            : undefined
                                    }
                                    isExpanded={expandedKey === key}
                                    onToggle={() =>
                                        setExpandedKey(
                                            expandedKey === key ? null : key
                                        )
                                    }
                                />
                            ))}
                        </div>
                    </section>
                    <Section
                        title='Delivery modes'
                        keys={DELIVERY_KEYS}
                        labels={DELIVERY_LABELS}
                        counts={counts ?? {}}
                        keyDetails={{
                            "delivery:errors": {
                                recent: counts?.recentDeliveryErrors
                            }
                        }}
                        expandedKey={expandedKey}
                        onToggleExpand={(key) =>
                            setExpandedKey(key || null)
                        }
                    />
                    <Section
                        title='Client events'
                        keys={CLIENT_KEYS}
                        labels={CLIENT_LABELS}
                        counts={counts ?? {}}
                    />
                </div>
            </main>
        </GmShell>
    );
}

function AnalyticsLoading() {
    return (
        <GmShell variant='app' showFooter={false}>
            <main className='gm-container'>
                <p style={{ color: "var(--color-text-secondary)" }}>
                    Loading analytics…
                </p>
            </main>
        </GmShell>
    );
}

export default function AnalyticsPage() {
    return (
        <Suspense fallback={<AnalyticsLoading />}>
            <AnalyticsContent />
        </Suspense>
    );
}
