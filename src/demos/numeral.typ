#text(..oldstyle)[Old-style, in prose — between 1908 and 1935 the foundry cut 47
sizes, of which 12 survive.]

#text(..lining)[Lining, for display — BETWEEN 1908 AND 1935, 47 SIZES]

#table(
  columns: (1fr, auto, auto),
  align: (left + horizon, right + horizon, right + horizon),
  [Cut], [Sizes], [Surviving],
  [Original], [47], [12],
  [Revival], [8], [8],
  [Digital], [1,204], [1,204],
)

// No dedicated fraction setting: the "frac" OpenType feature is requested
// directly on the run, the same feature a diagonal fraction needs in any
// engine.
Fractions: #text(features: ("frac",))[1/2], #text(features: ("frac",))[3/4],
#text(features: ("frac",))[7/8].
