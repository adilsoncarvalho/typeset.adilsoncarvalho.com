// Typst colours a raw block by its language. typeset.css sets code in a single
// ink, so the CSS implementation renders this same sample monochrome.

The declaration is a single line — set `font-variant-numeric` on the table and
every cell inherits it:

```css
.typeset table {
  font-variant-numeric: lining-nums tabular-nums;
}

/* Repeat the header on every page the table spans. */
.typeset thead { display: table-header-group; }
```

Which is all it takes.
