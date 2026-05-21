use chrono::Local;
use colored::Colorize;
use regex::Regex;
use std::io::Write;
use std::sync::LazyLock;
use tracing::log::Level;

/// Log level filter applied when RUST_LOG is not set.
const DEFAULT_FILTER: &str =
    "info,trailbase_refinery=warn,tracing::span=warn,swc_ecma_codegen=off";

/// Initialize the global logger with colored output and pattern highlighting.
pub fn init() {
    env_logger::Builder::from_env(env_logger::Env::new().default_filter_or(DEFAULT_FILTER))
        .format(|buf, record| {
            let time = Local::now().format("%H:%M:%S").to_string().dimmed();

            let level = match record.level() {
                Level::Error => "ERROR".red().bold(),
                Level::Warn => "WARN ".yellow().bold(),
                Level::Info => "INFO ".green(),
                Level::Debug => "DEBUG".blue(),
                Level::Trace => "TRACE".dimmed(),
            };

            let target = record.target().dimmed();
            let arrow = "›".dimmed();
            let message = highlight_patterns(&record.args().to_string());

            writeln!(buf, "{time} {level} {target} {arrow} {message}")
        })
        .init();
}

// — Pattern definitions ——————————————————————————————————————————————————————

struct Pattern {
    re: Regex,
    colorize: fn(&str) -> String,
}

static PATTERNS: LazyLock<Vec<Pattern>> = LazyLock::new(|| {
    vec![
        // URLs — bold cyan, e.g. http://0.0.0.0:4000/api/v1
        Pattern {
            re: Regex::new(r"https?://\S+").unwrap(),
            colorize: |s| s.cyan().bold().to_string(),
        },
        // host:port pairs — cyan, e.g. localhost:4000 or 0.0.0.0:4000
        Pattern {
            re: Regex::new(r"\b[\w.\-]+:\d{2,5}\b").unwrap(),
            colorize: |s| s.cyan().to_string(),
        },
        // Numbers with units — yellow, e.g. 1096ms, 27.76 kB, 3.5s
        Pattern {
            re: Regex::new(r"\b\d+(\.\d+)?\s*(ms|kB|KB|MB|GB|s)\b").unwrap(),
            colorize: |s| s.yellow().to_string(),
        },
        // Quoted strings — green, e.g. "admin@localhost"
        Pattern {
            re: Regex::new(r#""[^"]*""#).unwrap(),
            colorize: |s| s.green().to_string(),
        },
        // File system paths — dimmed, e.g. /home/user/traildepot
        Pattern {
            re: Regex::new(r"/[\w/.\-]+").unwrap(),
            colorize: |s| s.dimmed().to_string(),
        },
        // Hex hashes / short UUIDs — magenta, e.g. 894a800 or full uuid
        Pattern {
            re: Regex::new(
                r"\b[0-9a-f]{7,8}\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b",
            )
            .unwrap(),
            colorize: |s| s.magenta().to_string(),
        },
        // Standalone numbers — yellow, e.g. 75, 4000
        Pattern {
            re: Regex::new(r"\b\d+\b").unwrap(),
            colorize: |s| s.yellow().to_string(),
        },
    ]
});

// — Span-based colorizer ——————————————————————————————————————————————————————

/// Apply all patterns to `text`, coloring matched spans without overlaps.
/// Each character position is claimed by at most one pattern (first match wins).
fn highlight_patterns(text: &str) -> String {
    // Collect (start, end, colorize_fn) for every match across all patterns.
    let mut spans: Vec<(usize, usize, fn(&str) -> String)> = Vec::new();

    for pattern in PATTERNS.iter() {
        for m in pattern.re.find_iter(text) {
            // Skip if this range overlaps any already-claimed span.
            let overlaps = spans
                .iter()
                .any(|&(s, e, _)| m.start() < e && m.end() > s);

            if !overlaps {
                spans.push((m.start(), m.end(), pattern.colorize));
            }
        }
    }

    // Sort spans by start position so we can walk the string once.
    spans.sort_by_key(|&(start, _, _)| start);

    // Build the output string segment by segment.
    let mut output = String::with_capacity(text.len() * 2);
    let mut cursor = 0;

    for (start, end, colorize) in spans {
        if start > cursor {
            output.push_str(&text[cursor..start]);
        }
        output.push_str(&colorize(&text[start..end]));
        cursor = end;
    }

    if cursor < text.len() {
        output.push_str(&text[cursor..]);
    }

    output
}
