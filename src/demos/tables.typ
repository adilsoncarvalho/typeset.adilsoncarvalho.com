#figure(
  caption: [Setting widths for a single-column A4 page, by point size.],
  kind: table,
  supplement: [Table],
  ts-table(
    columns: (1fr, auto, auto, auto),
    rows: 4,
    align: (left + horizon, right + horizon, right + horizon, right + horizon),
    table.header([Typeface], [Size (pt)], [Leading], [Measure (mm)]),
    [EB Garamond], [11.0], [1.45], [126],
    [Source Serif], [10.5], [1.42], [124],
    [Charis SIL], [10.0], [1.40], [119],
    [IBM Plex Serif], [10.5], [1.45], [131],
    [Median], [10.5], [1.43], [125],
  ),
)
