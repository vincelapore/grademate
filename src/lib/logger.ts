type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40
};

function getMinLevel(): LogLevel {
    const raw = (process.env.LOG_LEVEL || "info").toLowerCase();
    if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
        return raw;
    }
    return "info";
}

const MIN_LEVEL = getMinLevel();

type LogMeta = Record<string, unknown> | undefined;

function shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[MIN_LEVEL];
}

function baseLog(
    level: LogLevel,
    module: string,
    message: string,
    meta?: LogMeta
): void {
    if (!shouldLog(level)) return;

    const payload: Record<string, unknown> = {
        ts: new Date().toISOString(),
        level,
        module,
        msg: message
    };

    if (meta) {
        for (const [key, value] of Object.entries(meta)) {
            if (value === undefined) continue;
            payload[key] = value;
        }
    }

    const line = JSON.stringify(payload);
    if (level === "error") {
        console.error(line);
    } else if (level === "warn") {
        console.warn(line);
    } else {
        console.log(line);
    }
}

export const logger = {
    debug(module: string, message: string, meta?: LogMeta): void {
        baseLog("debug", module, message, meta);
    },
    info(module: string, message: string, meta?: LogMeta): void {
        baseLog("info", module, message, meta);
    },
    warn(module: string, message: string, meta?: LogMeta): void {
        baseLog("warn", module, message, meta);
    },
    error(module: string, message: string, meta?: LogMeta): void {
        baseLog("error", module, message, meta);
    }
};

