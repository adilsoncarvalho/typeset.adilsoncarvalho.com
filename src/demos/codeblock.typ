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
