// app/src/testcontainer/log_file.rs
//
// Per-run file capture for the dev testcontainers, replacing
// console mirroring: every log frame from the cert-generate,
// kanidm server, mail-sender and mailpit containers is appended
// to its own run file under logs/testcontainers/<container>/,
// while the console keeps only app-level key events.
//
// Why app-side files: the containers are auto-removed at shutdown
// (handle Drop + watchdog), destroying docker's own log store
// with them — a file owned by the app process is the only
// durable copy. The vendored testcontainers follower uses
// follow=true with tail=all on stdout+stderr, so nothing is lost
// even though the consumer task starts slightly after the
// container; the consumer stream is fully separate from the
// wait-strategy stream, so readiness detection is unaffected.
//
// Error handling: dir/file creation failure falls back to console
// mirroring (loss-avoidation beats silence); a mid-run append
// failure warns once and keeps capture running; pruning failures
// are non-fatal.

use std::fs::{File, OpenOptions};
use std::io::{LineWriter, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use testcontainers::core::logs::LogFrame;
use time::OffsetDateTime;
use tracing::{info, warn};

/// Base dir for all dev-container run logs, relative to the
/// current directory: the repo root under `cargo run` (the
/// documented workflow — cargo commands always run from the
/// project root), or a mounted volume for dockerized dev runs.
const BASE_DIR: &str = "logs/testcontainers";

/// Run file name parts: `run-{pid}-{nanos}.log`, mirroring the
/// unique-suffix pattern of the temp CA file (mod.rs). The nanos
/// stamp doubles as the creation-order key for pruning.
const RUN_PREFIX: &str = "run-";
const RUN_SUFFIX: &str = ".log";

/// How many run files to keep per subfolder after startup pruning
/// (the fresh run file counts toward the limit).
const KEEP_RUN_FILES: usize = 5;

/// The dev containers, each with its own run-file subfolder.
#[derive(Debug, Clone, Copy)]
pub(crate) enum LogSubfolder {
    /// One-shot kanidm cert-generate container.
    CertGenerate,
    /// Long-running kanidm server container.
    Server,
    /// Long-running kanidm-mail-sender container.
    MailSender,
    /// Long-running mailpit container.
    Mailpit,
}

impl LogSubfolder {
    const fn dir_name(self) -> &'static str {
        match self {
            LogSubfolder::CertGenerate => "kanidm-cert",
            LogSubfolder::Server => "kanidm-server",
            LogSubfolder::MailSender => "kanidm-mail-sender",
            LogSubfolder::Mailpit => "mailpit",
        }
    }

    const fn label(self) -> &'static str {
        match self {
            LogSubfolder::CertGenerate => "cert-generate",
            LogSubfolder::Server => "server",
            LogSubfolder::MailSender => "mail-sender",
            LogSubfolder::Mailpit => "mailpit",
        }
    }
}

/// Stream tag written before each captured line.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum StreamTag {
    Out,
    Err,
}

impl StreamTag {
    const fn as_str(self) -> &'static str {
        match self {
            StreamTag::Out => "out",
            StreamTag::Err => "err",
        }
    }
}

/// Production consumer: capture under `logs/testcontainers/`
/// relative to the current directory. Attach with
/// `.with_log_consumer(...)` on the container request — any
/// `Fn(&LogFrame)` closure qualifies as a testcontainers
/// LogConsumer.
pub(crate) fn file_consumer(
    subfolder: LogSubfolder,
) -> impl Fn(&LogFrame) + Send + Sync + 'static {
    consumer_in(Path::new(BASE_DIR), subfolder)
}

/// Testable core of `file_consumer`: capture under an explicit
/// base dir. Startup sequence per subfolder: create the dir, open
/// a fresh per-run file, prune old run files (keeping the newest
/// KEEP_RUN_FILES, the fresh one included), and log the file
/// path once at info. Any dir/file failure warns and falls back
/// to console mirroring — startup continues either way.
fn consumer_in(
    base_dir: &Path,
    subfolder: LogSubfolder,
) -> impl Fn(&LogFrame) + Send + Sync + 'static {
    let dir = base_dir.join(subfolder.dir_name());
    let state = Mutex::new(init_state(&dir, subfolder));
    move |frame: &LogFrame| consume_frame(&state, frame)
}

/// Build the initial consumer state for `dir`: run file on
/// success, console fallback (with a warning) on failure.
fn init_state(dir: &Path, subfolder: LogSubfolder) -> ConsumerState {
    match open_run_file(dir) {
        Ok((path, file)) => {
            info!(
                path = %path.display(),
                "capturing {} container logs", subfolder.label()
            );
            ConsumerState {
                out_splitter: LineSplitter::default(),
                err_splitter: LineSplitter::default(),
                sink: Sink::File {
                    writer: LineWriter::new(file),
                    path,
                },
                append_warned: false,
            }
        }
        Err(error) => {
            warn!(
                "failed to open a run log file under {} — mirroring the {} \
                 container logs into the console instead: {error}",
                dir.display(),
                subfolder.label()
            );
            ConsumerState {
                out_splitter: LineSplitter::default(),
                err_splitter: LineSplitter::default(),
                sink: Sink::Console,
                append_warned: false,
            }
        }
    }
}

/// Handle one log frame: split it into lines and append them to
/// the sink. The consumer is driven by testcontainers' single
/// follower task, so there is no contention on the state mutex.
fn consume_frame(state: &Mutex<ConsumerState>, frame: &LogFrame) {
    let text = String::from_utf8_lossy(frame.bytes());
    // A panic while handling an earlier frame must not stop
    // capture: recover the poisoned state instead of propagating.
    let mut state = match state.lock() {
        Ok(state) => state,
        Err(poisoned) => poisoned.into_inner(),
    };
    // Per-stream splitters: a pending partial stdout line must
    // not swallow a complete stderr line that arrives in between.
    let (tag, lines) = match frame {
        LogFrame::StdOut(_) => (StreamTag::Out, state.out_splitter.push(&text)),
        LogFrame::StdErr(_) => (StreamTag::Err, state.err_splitter.push(&text)),
    };
    state.append(tag, lines);
}

/// Mutable consumer state, owned by the closure.
struct ConsumerState {
    /// Line splitter for stdout frames.
    out_splitter: LineSplitter,
    /// Line splitter for stderr frames.
    err_splitter: LineSplitter,
    /// Where captured lines go.
    sink: Sink,
    /// Whether the one-time mid-run append warning was emitted.
    append_warned: bool,
}

/// Where captured lines go: the run file, or the console
/// fallback.
enum Sink {
    File {
        writer: LineWriter<File>,
        path: PathBuf,
    },
    Console,
}

impl ConsumerState {
    /// Append the prefixed lines to the sink.
    ///
    /// File appends go through a LineWriter, so every complete
    /// line (each write ends in '\n') is flushed as it is
    /// captured. A mid-run append failure warns once and keeps
    /// the consumer running and retrying on later frames — the
    /// file may have gaps, the warning makes that visible. The
    /// console fallback mirrors the frames under the
    /// `testcontainer` tracing target.
    fn append(&mut self, tag: StreamTag, lines: Vec<String>) {
        if lines.is_empty() {
            return;
        }
        let failure = match &mut self.sink {
            Sink::File { writer, path } => {
                let timestamp = timestamp();
                let mut failure = None;
                for line in lines {
                    let entry = format!("{timestamp} {} {line}\n", tag.as_str());
                    if let Err(error) = writer.write_all(entry.as_bytes()) {
                        failure = Some(format!("{}: {error}", path.display()));
                        break;
                    }
                }
                failure
            }
            Sink::Console => {
                for line in lines {
                    match tag {
                        StreamTag::Out => info!(target: "testcontainer", "{line}"),
                        StreamTag::Err => warn!(target: "testcontainer", "{line}"),
                    }
                }
                None
            }
        };
        if let Some(context) = failure {
            if !self.append_warned {
                self.append_warned = true;
                warn!(
                    "appending to the dev container run log failed, the file may \
                     have gaps (capture continues): {context}"
                );
            }
        }
    }
}

/// Splits chunk-based log frames into complete lines. Docker log
/// frames are NOT line-aligned: a frame may end in the middle of
/// a line and the next frame continues it, so the partial tail
/// is buffered until its newline arrives. One splitter per
/// stream — see `consume_frame`.
#[derive(Debug, Default)]
struct LineSplitter {
    /// Buffered start of a line that has not seen its '\n' yet.
    tail: String,
}

impl LineSplitter {
    /// Feed one chunk and take the complete lines it produced. A
    /// trailing '\r' is trimmed so docker's CRLF frames log
    /// clean.
    fn push(&mut self, chunk: &str) -> Vec<String> {
        let mut lines = Vec::new();
        let mut rest = chunk;
        while let Some(newline) = rest.find('\n') {
            let (line, remainder) = rest.split_at(newline);
            let line = line.strip_suffix('\r').unwrap_or(line);
            self.tail.push_str(line);
            lines.push(std::mem::take(&mut self.tail));
            rest = &remainder[1..];
        }
        self.tail.push_str(rest);
        lines
    }
}

/// Create `dir` (with parents), open a fresh append-mode run
/// file, then prune old run files. Pruning runs after the fresh
/// file is created so the kept KEEP_RUN_FILES files are the
/// newest ones, including this run's. Pruning failure is
/// non-fatal (warns internally) and never fails the open.
fn open_run_file(dir: &Path) -> std::io::Result<(PathBuf, File)> {
    std::fs::create_dir_all(dir)?;
    let path = dir.join(run_file_name());
    let file = OpenOptions::new().append(true).create(true).open(&path)?;
    prune_run_files(dir);
    Ok((path, file))
}

/// Unique run file name: `run-{pid}-{nanos}.log`. Uniqueness
/// avoids collisions between concurrent dev runs; the nanos
/// stamp is the creation-order key for pruning.
fn run_file_name() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    format!("{RUN_PREFIX}{}-{nanos}{RUN_SUFFIX}", std::process::id())
}

/// Delete all but the newest KEEP_RUN_FILES run files in `dir`.
/// Files are ranked by the nanos stamp in their name; files that
/// do not follow the naming scheme are left untouched.
/// Best-effort: failures warn and never propagate.
fn prune_run_files(dir: &Path) {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(error) => {
            warn!("failed to list {} for pruning: {error}", dir.display());
            return;
        }
    };

    let mut runs: Vec<(u128, PathBuf)> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter_map(|path| run_nanos(&path).map(|nanos| (nanos, path)))
        .collect();

    // Newest first; a nanos tie (different pids, same stamp) falls
    // back to the name for a stable order.
    runs.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| b.1.cmp(&a.1)));

    for (_, path) in runs.into_iter().skip(KEEP_RUN_FILES) {
        if let Err(error) = std::fs::remove_file(&path) {
            warn!(
                "failed to prune the old dev container run log {}: {error}",
                path.display()
            );
        }
    }
}

/// Creation-order key of a run file: the nanos stamp in its name.
/// Returns None for names that do not follow `run-{pid}-{nanos}.log`
/// (such files are never pruned).
fn run_nanos(path: &Path) -> Option<u128> {
    let name = path.file_name()?.to_str()?;
    let middle = name.strip_prefix(RUN_PREFIX)?.strip_suffix(RUN_SUFFIX)?;
    // `{pid}-{nanos}`: the stamp is the segment after the last '-'.
    let nanos = middle.rsplit_once('-')?.1;
    nanos.parse().ok()
}

/// RFC 3339 UTC timestamp for a captured line. Formatting cannot
/// fail for RFC 3339 with a current date; on the impossible
/// error path an empty prefix keeps capture going.
fn timestamp() -> String {
    OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Unique temp base dir per test, mirroring the temp CA
    /// pattern (mod.rs): pid + nanos avoids collisions between
    /// test runs.
    fn temp_base() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default();
        std::env::temp_dir().join(format!(
            "kanidm-admin-log-file-test-{}-{nanos}",
            std::process::id()
        ))
    }

    #[test]
    fn subfolder_dir_names_cover_every_container() {
        assert_eq!(LogSubfolder::CertGenerate.dir_name(), "kanidm-cert");
        assert_eq!(LogSubfolder::Server.dir_name(), "kanidm-server");
        assert_eq!(LogSubfolder::MailSender.dir_name(), "kanidm-mail-sender");
        assert_eq!(LogSubfolder::Mailpit.dir_name(), "mailpit");
    }

    #[test]
    fn splitter_joins_chunks_split_mid_line() {
        let mut splitter = LineSplitter::default();

        // A partial chunk yields nothing yet...
        assert_eq!(
            splitter.push("hel"),
            Vec::<String>::new(),
            "a chunk without a newline completes no line"
        );
        // ...and completes with the next chunk.
        assert_eq!(
            splitter.push("lo\nworld\n"),
            vec!["hello".to_string(), "world".to_string()]
        );
        // Empty frames yield nothing.
        assert_eq!(splitter.push(""), Vec::<String>::new());
    }

    #[test]
    fn splitter_handles_multi_line_frames_and_crlf() {
        let mut splitter = LineSplitter::default();

        // One frame carrying several lines plus a partial tail;
        // the trailing '\r' of a CRLF pair is trimmed.
        assert_eq!(
            splitter.push("a\nb\r\nc"),
            vec!["a".to_string(), "b".to_string()]
        );
        // The partial tail completes with the next frame.
        assert_eq!(splitter.push("d\n"), vec!["cd".to_string()]);
    }

    #[test]
    fn splitter_yields_nothing_for_empty_frames() {
        let mut splitter = LineSplitter::default();
        assert_eq!(splitter.push(""), Vec::<String>::new());
        // A bare newline is one real (empty) output line.
        assert_eq!(splitter.push("\n"), vec![String::new()]);
    }

    #[test]
    fn pruning_keeps_newest_five_and_ignores_foreign_names() {
        let base = temp_base();
        let dir = base.join("server");
        std::fs::create_dir_all(&dir).expect("create dir");

        // Seven run files with increasing nanos stamps.
        for nanos in 1..=7u128 {
            std::fs::write(
                dir.join(format!("{RUN_PREFIX}1-{nanos}{RUN_SUFFIX}")),
                b"old",
            )
            .expect("write run file");
        }
        // A foreign file must not be touched by pruning.
        std::fs::write(dir.join("notes.txt"), b"keep me").expect("write foreign file");

        prune_run_files(&dir);

        let mut remaining: Vec<String> = std::fs::read_dir(&dir)
            .expect("read dir")
            .flatten()
            .filter_map(|entry| entry.file_name().into_string().ok())
            .collect();
        remaining.sort();
        assert_eq!(
            remaining,
            vec![
                "notes.txt".to_string(),
                "run-1-3.log".to_string(),
                "run-1-4.log".to_string(),
                "run-1-5.log".to_string(),
                "run-1-6.log".to_string(),
                "run-1-7.log".to_string(),
            ],
            "newest five run files stay (3..=7), the oldest two are pruned, \
             foreign files are untouched"
        );

        std::fs::remove_dir_all(&base).expect("cleanup");
    }

    #[test]
    fn pruning_is_noop_with_few_files_and_safe_without_dir() {
        let base = temp_base();
        let dir = base.join("kanidm-cert");
        std::fs::create_dir_all(&dir).expect("create dir");
        let lone = dir.join(format!("{RUN_PREFIX}1-9{RUN_SUFFIX}"));
        std::fs::write(&lone, b"x").expect("write run file");

        prune_run_files(&dir); // fewer than KEEP_RUN_FILES — nothing deleted
        assert!(lone.exists(), "a lone run file is never pruned");

        prune_run_files(&base.join("does-not-exist")); // must not panic

        std::fs::remove_dir_all(&base).expect("cleanup");
    }

    #[test]
    fn consumer_appends_tagged_lines_in_order() {
        let base = temp_base();
        let consumer = consumer_in(&base, LogSubfolder::Server);

        consumer(&LogFrame::StdOut("line1\nline2\n".into()));
        consumer(&LogFrame::StdErr("boom\n".into()));
        // Chunks split mid-line, and the streams interleave: the
        // pending stdout tail must not swallow the stderr line.
        consumer(&LogFrame::StdOut("hel".into()));
        consumer(&LogFrame::StdErr("err\n".into()));
        consumer(&LogFrame::StdOut("lo\n".into()));

        // Exactly one run file exists in the server subfolder.
        let dir = base.join("kanidm-server");
        let run_files: Vec<PathBuf> = std::fs::read_dir(&dir)
            .expect("read dir")
            .flatten()
            .map(|entry| entry.path())
            .filter(|path| path.extension().and_then(|ext| ext.to_str()) == Some("log"))
            .collect();
        assert_eq!(run_files.len(), 1, "one run file per consumer");

        let content = std::fs::read_to_string(&run_files[0]).expect("read run file");
        let lines: Vec<&str> = content.lines().collect();
        assert_eq!(lines.len(), 5, "five complete lines captured");

        assert_tagged_line(lines[0], "out", "line1");
        assert_tagged_line(lines[1], "out", "line2");
        assert_tagged_line(lines[2], "err", "boom");
        assert_tagged_line(lines[3], "err", "err");
        assert_tagged_line(lines[4], "out", "hello");

        std::fs::remove_dir_all(&base).expect("cleanup");
    }

    /// Assert a captured line is `{timestamp} {tag} {content}`.
    fn assert_tagged_line(line: &str, tag: &str, content: &str) {
        let suffix = format!(" {tag} {content}");
        let timestamp = line
            .strip_suffix(&suffix)
            .unwrap_or_else(|| panic!("line {line:?} must end with {suffix:?}"));
        assert!(
            !timestamp.is_empty(),
            "line {line:?} must carry a timestamp prefix"
        );
    }

    #[test]
    fn consumer_creation_prunes_old_runs_and_keeps_five() {
        let base = temp_base();
        let dir = base.join("kanidm-cert");
        std::fs::create_dir_all(&dir).expect("create dir");

        // Six pre-existing run files, oldest first.
        for nanos in 1..=6u128 {
            std::fs::write(
                dir.join(format!("{RUN_PREFIX}1-{nanos}{RUN_SUFFIX}")),
                b"old",
            )
            .expect("write run file");
        }

        let _consumer = consumer_in(&base, LogSubfolder::CertGenerate);

        // The fresh run file (largest nanos) plus the four newest
        // old ones remain: exactly KEEP_RUN_FILES files.
        let remaining = std::fs::read_dir(&dir)
            .expect("read dir")
            .flatten()
            .count();
        assert_eq!(
            remaining, KEEP_RUN_FILES,
            "pruning keeps exactly the newest five, fresh run file included"
        );

        std::fs::remove_dir_all(&base).expect("cleanup");
    }

    #[test]
    fn consumer_falls_back_to_console_when_base_dir_is_a_file() {
        // A base dir that is actually a file makes create_dir_all
        // fail, exercising the console fallback path.
        let base = temp_base();
        std::fs::write(&base, b"i am a file, not a dir").expect("write blocker file");

        let consumer = consumer_in(&base, LogSubfolder::CertGenerate);
        // Frames must be handled (mirrored to the console) without
        // panicking, and no directory may appear.
        consumer(&LogFrame::StdOut("still captured\n".into()));
        consumer(&LogFrame::StdErr("to console\n".into()));
        assert!(!base.join("kanidm-cert").exists(), "no dir created under a file");

        std::fs::remove_file(&base).expect("cleanup");
    }
}
