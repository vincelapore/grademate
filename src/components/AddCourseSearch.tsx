"use client";

import { useState } from "react";
import type { AssessmentItem, CourseAssessment } from "@/lib/uq-scraper";
import type { DeliveryModeOption } from "@/lib/delivery-modes";
import { parseDueDate } from "@/lib/calendar";
import type { DeliveryMode, SemesterType } from "@/lib/semester";
import { CourseLimitModal } from "@/components/CourseLimitModal";

type ScrapeResponse = CourseAssessment | { error: string };

type PendingCourse = {
  courseCode: string;
  courseName: string;
  creditPoints: number;
  targetGrade: number;
  profileUrl: string | null;
  university: string;
  assessments: Array<{
    assessmentName: string;
    weighting: number;
    dueDate: string | null;
  }>;
};

function parseCourseName(courseCode: string, title?: string | null): string {
  if (!title) return courseCode;
  const t = title.trim();
  const parenMatch = t.match(/\(([^)]+)\)\s*$/);
  if (parenMatch && parenMatch[1].toUpperCase().includes(courseCode)) {
    return t.replace(/\s*\([^)]+\)\s*$/, "").trim() || courseCode;
  }
  if (t.toUpperCase().startsWith(courseCode.toUpperCase())) {
    return t.slice(courseCode.length).trim().replace(/^[-–—:]\s*/, "") || courseCode;
  }
  return t;
}

function dueDateToIso(dueDate: string | null): string | null {
  if (!dueDate) return null;
  const events = parseDueDate(dueDate);
  if (!events.length) return null;
  const d = events[0]!.startDate;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toNumericWeight(weight: AssessmentItem["weight"]): number | null {
  if (typeof weight !== "number") return null;
  if (!Number.isFinite(weight) || weight <= 0) return null;
  return weight;
}

export function AddCourseSearch({
  university,
  semesterId,
  year,
  semesterLabel,
  delivery: _delivery,
  onDone,
  maxCourses = 4,
  initialCourseCount = 0,
}: {
  university: "uq" | "qut";
  semesterId: string;
  year: number;
  semesterLabel: SemesterType;
  /** @deprecated Delivery is chosen per course after “Find”. */
  delivery?: DeliveryMode;
  onDone: () => void;
  maxCourses?: number;
  initialCourseCount?: number;
}) {
  void _delivery;
  const [courseInput, setCourseInput] = useState("");
  const [loadingModes, setLoadingModes] = useState(false);
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [loadingForDelivery, setLoadingForDelivery] =
    useState<DeliveryMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    courseCode: string;
    modes: DeliveryModeOption[];
  } | null>(null);
  const [courses, setCourses] = useState<PendingCourse[]>([]);
  const [showLimit, setShowLimit] = useState(false);
  const [saving, setSaving] = useState(false);

  const uiLocked = loadingModes || loadingCourse || saving;

  async function findModes() {
    const code = courseInput.trim().toUpperCase();
    if (code.length < 4) {
      setError("Enter a course code (at least 4 characters).");
      return;
    }
    setError(null);
    setPending(null);
    if (saving || loadingCourse) return;
    setLoadingModes(true);
    try {
      const url = new URL("/api/delivery-modes", window.location.origin);
      url.searchParams.set("courseCode", code);
      url.searchParams.set("year", String(year));
      url.searchParams.set("semester", semesterLabel);
      url.searchParams.set("university", university);
      const res = await fetch(url);
      const json = (await res.json().catch(() => ({}))) as {
        modes?: DeliveryModeOption[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string" && json.error
            ? json.error
            : "No offerings found for that code and semester.",
        );
      }
      const modes = json.modes ?? [];
      if (modes.length === 0) {
        throw new Error("No delivery modes available.");
      }
      setPending({ courseCode: code, modes });
    } catch (e) {
      setPending(null);
      setError(
        e instanceof Error ? e.message : "Could not look up course offerings.",
      );
    } finally {
      setLoadingModes(false);
    }
  }

  async function addWithDelivery(mode: DeliveryModeOption) {
    if (!pending) return;
    if (initialCourseCount + courses.length >= maxCourses) {
      setShowLimit(true);
      return;
    }
    const courseCode = pending.courseCode;
    if (courses.some((c) => c.courseCode === courseCode)) {
      setError(`${courseCode} is already in your list.`);
      return;
    }

    setError(null);
    if (saving) return;
    setLoadingCourse(true);
    setLoadingForDelivery(mode.delivery);
    try {
      const url = new URL("/api/scrape", window.location.origin);
      url.searchParams.set("university", university);
      url.searchParams.set("courseCode", courseCode);
      url.searchParams.set("year", String(year));
      url.searchParams.set("semester", semesterLabel);
      url.searchParams.set("delivery", mode.delivery);

      const res = await fetch(url);
      const jsonUnknown: unknown = await res.json();
      const json = jsonUnknown as ScrapeResponse;
      if (
        !res.ok ||
        (typeof json === "object" &&
          json != null &&
          "error" in json)
      ) {
        throw new Error(
          typeof json === "object" && json != null && "error" in json
            ? String((json as { error: unknown }).error)
            : "Could not load assessments.",
        );
      }
      const suggestion = json as CourseAssessment;
      const courseName = parseCourseName(courseCode, suggestion.title);
      const profileFromScrape =
        typeof suggestion.courseProfileUrl === "string" &&
        suggestion.courseProfileUrl.trim()
          ? suggestion.courseProfileUrl.trim()
          : null;
      const profileUrl = profileFromScrape || mode.courseProfileUrl || null;

      const assessments = suggestion.items
        .map((item) => {
          const w = toNumericWeight(item.weight);
          if (w == null) return null;
          return {
            assessmentName: item.name,
            weighting: w,
            dueDate: dueDateToIso(item.dueDate ?? null),
          };
        })
        .filter(Boolean) as PendingCourse["assessments"];

      setCourses((prev) => [
        ...prev,
        {
          courseCode,
          courseName,
          creditPoints: 2,
          targetGrade: 7,
          profileUrl,
          university,
          assessments,
        },
      ]);
      setPending(null);
      setCourseInput("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not add course.",
      );
    } finally {
      setLoadingCourse(false);
      setLoadingForDelivery(null);
    }
  }

  async function saveAll() {
    setError(null);
    setLoadingCourse(true);
    try {
      const res = await fetch("/api/onboarding/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semesterId, courses }),
      });
      const jsonUnknown: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          typeof jsonUnknown === "object" &&
          jsonUnknown != null &&
          "error" in jsonUnknown
            ? String((jsonUnknown as { error: unknown }).error)
            : "Could not save courses.";
        throw new Error(msg);
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save courses.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="gm-dash-add-course">
      {!pending ? (
        <div className="gm-dash-add-course-find-row">
          <input
            value={courseInput}
            onChange={(e) => setCourseInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") void findModes();
            }}
            placeholder="Course code (e.g. CSSE3100)"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            className="gm-dash-input gm-dash-add-course-input"
            disabled={uiLocked}
          />
          <button
            type="button"
            className="gm-dash-modal-btn gm-dash-modal-btn--primary gm-dash-add-course-find-btn"
            disabled={uiLocked}
            onClick={() => void findModes()}
          >
            {loadingModes ? (
              <span className="gm-dash-add-course-btn-inner">
                <span
                  className="gm-dash-spinner gm-dash-spinner--on-primary"
                  aria-hidden
                />
                Finding…
              </span>
            ) : (
              "Find"
            )}
          </button>
        </div>
      ) : (
        <div className="gm-dash-add-course-delivery-panel">
          <div className="gm-dash-add-course-pending-meta">
            <span className="gm-dash-add-course-pending-code">
              {pending.courseCode}
            </span>
            <span className="gm-dash-add-course-pending-sub">
              {semesterLabel} {year} · Choose delivery
            </span>
          </div>
          <div className="gm-dash-delivery-stack">
            {pending.modes.map((mode, idx) => {
              const busy =
                loadingCourse && loadingForDelivery === mode.delivery;
              return (
                <button
                  key={`${mode.delivery}-${mode.courseProfileUrl}-${idx}`}
                  type="button"
                  className="gm-dash-delivery-option"
            disabled={loadingCourse || saving}
            onClick={() => void addWithDelivery(mode)}
                >
                  <span className="gm-dash-delivery-option-main">
                    {busy ? (
                      <span
                        className="gm-dash-spinner"
                        aria-hidden
                      />
                    ) : null}
                    <span className="gm-dash-delivery-option-label">
                      {mode.delivery}
                    </span>
                  </span>
                  {mode.location ? (
                    <span className="gm-dash-delivery-option-loc">
                      {mode.location}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="gm-dash-add-course-btn-back"
            disabled={loadingCourse || saving}
            onClick={() => {
              setPending(null);
              setError(null);
            }}
          >
            ← Different code
          </button>
        </div>
      )}

      {error ? (
        <p className="gm-dash-add-course-error" role="alert">
          {error}
        </p>
      ) : null}

      {courses.length > 0 ? (
        <ul className="gm-dash-add-course-queue">
          {courses.map((c) => (
            <li key={c.courseCode} className="gm-dash-add-course-queue-item">
              <div className="gm-dash-add-course-queue-copy">
                <span className="gm-dash-add-course-queue-code">
                  {c.courseCode}
                </span>
                <span className="gm-dash-add-course-queue-sub">
                  {c.courseName} · {c.assessments.length} items
                </span>
              </div>
              <button
                type="button"
                className="gm-dash-add-course-queue-remove"
                disabled={uiLocked}
                onClick={() =>
                  setCourses((prev) =>
                    prev.filter((x) => x.courseCode !== c.courseCode),
                  )
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="gm-dash-add-course-footer">
        <button
          type="button"
          className="gm-dash-modal-btn gm-dash-modal-btn--primary"
          disabled={
            saving || loadingCourse || courses.length === 0
          }
          onClick={() => void saveAll()}
        >
          {saving ? "Saving…" : "Save courses"}
        </button>
      </div>

      {showLimit ? (
        <CourseLimitModal onClose={() => setShowLimit(false)} />
      ) : null}
    </div>
  );
}
