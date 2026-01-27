# Rocks Sheet Reference (tiles.rocks)

All coordinates are given as [column][row] from Aseprite (top-left origin).
White family uses the references below as-is. Color families use row offsets:
- light gray: add +8 to all rows
- dark gray: add +16 to all rows
- brown: add +24 to all rows

All rocks use aura-based collisions. The arch is pass-through between pillars.

2x2 rocks:
- [0][0] to [1][1]
- [2][0] to [3][1]
- [0][2] to [1][3]
- [2][2] to [3][3]
- [4][2] to [5][3]
- [6][2] to [6][3]
- [24][4] to [25][5]
- [26][4] to [27][5]
- [24][6] to [25][7]
- [26][6] to [27][7]

1 column, 2 rows:
- [4][0] to [4][1]
- [5][0] to [5][1]
- [0][6] to [0][7]
- [1][6] to [1][7]
- [2][6] to [2][7]
- [3][6] to [3][7]
- [5][6] to [5][7]
- [6][6] to [6][7]
- [8][6] to [8][7]
- [12][4] to [13][5]
- [14][4] to [15][5]

Spikes (thin spires, still 1x2):
- [16][3] to [16][4]
- [17][3] to [17][4]
- [18][3] to [18][4]

1 row, 2 columns:
- [16][5] to [17][5]
- [18][7] to [19][7]
- [6][1] to [7][1]

Single collision-blocking rocks (every tile in each span is a singleton):
- [6][0] to [8][0]
- [8][1] to [8][2]
- [4][6] to [4][7]
- [7][6]
- [10][3] to [11][5]
- [12][3] to [15][3]
- [14][6] to [17][7]
- [18][2] to [19][2]
- [19][3] to [19][4]

3x3:
- [9][0] to [11][2]

4 columns, 3 rows, ARCH (walk beneath; aura has open gap):
- [12][0] to [15][2]

2 columns, 3 rows:
- [16][0] to [17][2]

4 columns, 3 rows:
- [20][5] to [23][7]

4 columns, 5 rows:
- [20][0] to [23][4]  (note: original note had a typo; this is the intended span)

5 columns, 4 rows:
- [24][0] to [28][3]
