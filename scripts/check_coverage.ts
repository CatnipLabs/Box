export {};

const [
  coverageDir = "coverage",
  minLine = "90",
  minBranch = "85",
  minFunction = "85",
] = Deno.args;

const command = new Deno.Command(Deno.execPath(), {
  args: ["coverage", "--exclude=tests/", coverageDir],
  stdout: "piped",
  stderr: "piped",
});
const output = await command.output();
const stdout = new TextDecoder().decode(output.stdout);
const stderr = new TextDecoder().decode(output.stderr);

if (!output.success) {
  console.error(stdout);
  console.error(stderr);
  Deno.exit(output.code);
}

console.log(stdout.trimEnd());

const thresholds = {
  line: Number(minLine),
  branch: Number(minBranch),
  function: Number(minFunction),
};
const metrics = parseCoverage(stdout);
const failures: string[] = [];

if (metrics.line < thresholds.line) {
  failures.push(`line coverage ${metrics.line}% < ${thresholds.line}%`);
}
if (metrics.branch < thresholds.branch) {
  failures.push(`branch coverage ${metrics.branch}% < ${thresholds.branch}%`);
}
if (metrics.function < thresholds.function) {
  failures.push(
    `function coverage ${metrics.function}% < ${thresholds.function}%`,
  );
}

if (failures.length > 0) {
  console.error(`Coverage gate failed: ${failures.join(", ")}`);
  Deno.exit(1);
}

console.log(
  `Coverage gate passed: line ${metrics.line}%, branch ${metrics.branch}%, function ${metrics.function}%`,
);

function parseCoverage(output: string): {
  line: number;
  branch: number;
  function: number;
} {
  const ansiEscapePattern = new RegExp(
    `${String.fromCodePoint(27)}\\[[0-9;]*m`,
    "g",
  );
  const summaryLine = output.split("\n").map((line) =>
    line.replaceAll(ansiEscapePattern, "").trimStart()
  ).find((line) => /^\|\s*All files\s*\|/.test(line));
  if (!summaryLine) {
    throw new Error("Could not find 'All files' coverage summary line");
  }

  const numbers = [...summaryLine.matchAll(/\d+(?:\.\d+)?/g)].map((match) =>
    Number(match[0])
  );
  if (numbers.length < 3) {
    throw new Error(`Could not parse coverage metrics from: ${summaryLine}`);
  }

  return {
    branch: numbers[0],
    function: numbers[1],
    line: numbers[2],
  };
}
