// import { resolve } from "node:path";

const NATIVE_TARGET = "X86_64_UNKNOWN_LINUX_GNU";

export const InjectEnvPlugin = async ({ directory }) => {
  // const vendorRoot = resolve(directory, "vendor");
  // const rtkCalls = new Set();

  return {
    // "tool.execute.before": async (input, output) => {
    //   const serialized = JSON.stringify({
    //     tool: input.tool,
    //     args: output.args,
    //   });
    //   if (serialized.includes("rtk") && input.callID) {
    //     rtkCalls.add(input.callID);
    //   }
    // },

    // Sets env. Only acts when the matching callID was an rtk command.
    "shell.env": async (input, output) => {
      output.env[`CARGO_TARGET_DIR`] = "target/opencode";
      output.env[`CARGO_BUILD_JOBS`] = "4";
      output.env[`RUSTC_WRAPPER`] = "sccache";

      // if (!input.callID || !rtkCalls.has(input.callID)) return;

      // const cwd = resolve(input.cwd);
      // if (cwd === vendorRoot || cwd.startsWith(vendorRoot + "/")) return;

      // output.env[`CARGO_TARGET_X86_64_UNKNOWN_LINUX_GNU_LINKER`] = "clang";
      // output.env[`CARGO_TARGET_${NATIVE_TARGET}_RUSTFLAGS`] =
      //   "-C link-arg=-fuse-ld=mold -C link-arg=-Wl,--icf=all";

      output.env[`SCCACHE_DIR`] = "/home/archuser/.cache/sccache";
      output.env[`SCCACHE_CACHE_SIZE`] = "30G";
    },

    // "tool.execute.after": async (input) => {
    //   if (input.callID) rtkCalls.delete(input.callID);
    // },
  };
};
