/* The templates this repository ships — one entry today, the iA Writer
   letter — the one place that names a template's bundle filename.

   tools/build-iawriter.mjs (what it assembles and zips), tools/build-site.mjs
   (the download link on the templates page and on /, and the router's
   downloads list) and tools/legacy-urls.mjs (the built path a template's zip
   resolves to, so a pull request can tell whether it still would) all read
   this array, so a template renamed, or a fourth one added, cannot move in one
   of those and not the others. Before this file existed the bundle filename
   was typed out by hand in all three, plus src/viewers.json's iA Writer prose
   — the same shape src/examples.mjs already closed for the three Typst
   examples, and the same shape README.md's font-family table closed for
   fonts/manifest.json.

   `bundle` is the base name tools/build-iawriter.mjs stages the template
   under and zips: the shipped file is `${bundle}.zip` in downloads/.

   `summary` and `notes` are the prose tools/build-iawriter.mjs writes into
   the bundle's own README.txt — kept here rather than typed twice because a
   reader who unzips the template should find the same words that describe it
   on the templates page. */
export const TEMPLATES = [
  {
    dir: 'letter',
    bundle: 'typeset-letter.iatemplate',
    summary: 'A letter on A4 at 20mm on all four sides. EB Garamond at 11pt, ragged right,\n'
      + 'filling the page the margins leave.',
    notes: `The display quote
  A \`>\` quote is set centred in Cormorant Garamond Light Italic at 1.3x the
  body size, with no rule and no indent. Markdown has only one quoting
  construct, so in a letter it does the job a pull quote does. It is the
  template's own choice, not something spec.json declares.

The letterhead
  Indent a block by a tab or four spaces and it becomes your address, set in
  Cormorant Garamond Light at 11pt — the same family as the quote, upright
  rather than italic. Markdown calls that construct a code block;
  the letter template strips every mark of code off it — the wash, the rule and
  the monospaced face — because it is the only construct Markdown has that keeps
  your line breaks without a paragraph's indent and justification rules.

      # Adilson Carvalho

          10 Wentworth Avenue
          Surry Hills NSW 2010

  It follows that an indented block anywhere else in the letter is set as an
  address too — there is no second indented construct to tell them apart.
`,
  },
];

/* The zip name a template's bundle ships under, in downloads/ — the one
   expression every consumer above builds the same way, so a filename read
   through this function instead of `${t.bundle}.zip` typed out again cannot
   disagree with what tools/build-iawriter.mjs actually writes. */
export const bundleZip = (t) => `${t.bundle}.zip`;
