/* The three shipped Typst example documents — the one place that names
   them. tools/build-bundle.mjs (the zip's file list and its BUNDLE.txt
   manifest lines) and tools/check.mjs (the "compiles as shipped" gate)
   both read this array, and tools/build-previews.mjs derives its preview
   filenames from it, so a fourth example, or a rename, cannot appear in one
   of those and not the others.

   README.md cannot import this — it stays hand-written prose — so
   tools/check.mjs instead asserts that README.md names every `file` below.

   `description` is the exact wording tools/build-bundle.mjs has always
   printed in the bundle's BUNDLE.txt manifest, kept here so that copy
   doesn't need a second, drifting home. */
export const EXAMPLES = [
  {
    id: 'essay',
    file: 'implementations/example-essay.typ',
    description: 'single column, justified',
  },
  {
    id: 'letter',
    file: 'implementations/example-letter.typ',
    description: 'letter, ragged right, page-foot footnote',
  },
  {
    id: 'two-column',
    file: 'implementations/example-two-column.typ',
    description: 'two columns, equal',
  },
];
