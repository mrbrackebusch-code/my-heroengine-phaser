# Traps - AP CSP toolbox guidance

This document captures the minimal AP CSP-aligned block set we are basing
trap Blockly on. Use this as the canonical "allowed instructions" list for
trap puzzles, then curate each puzzle's toolbox to only the blocks needed by
the canonical solution (dropdowns still expose all valid options).

## Variables
- Set variable: `a <-- expression`
  - Evaluate `expression`, then assign a copy to `a`.
- Get variable: `a`
  - Use the current value of `a` in an expression.

## Input / Output
- `DISPLAY(expression)`
  - Display the value of `expression`, followed by a space.
- `INPUT()`
  - Accept a value from the user and return that value.

## Math
- Arithmetic: `+ - * /`
  - Standard order of operations applies.
- `MOD` (remainder)
- `RANDOM(a, b)` (inclusive integer range)

## Comparisons and Boolean logic
- Relational: `= != > < >= <=`
- `NOT condition`
- `condition1 AND condition2`
- `condition1 OR condition2`

## Conditionals
- `IF (condition) ...`
- `IF (condition) ... ELSE ...`

## Loops
- `REPEAT n TIMES`
- `REPEAT UNTIL (condition)`
- `FOR EACH item IN aList`

## Lists
- Create list with items: `aList <-- [value1, value2, ...]`
- Empty list: `aList <-- []`
- Copy list: `aList <-- bList`
- Item at index: `aList[i]`
- Set item: `aList[i] <-- x`
- Get item into variable: `x <-- aList[i]`
- Copy item: `aList[i] <-- aList[j]`
- Insert: `INSERT(aList, i, value)`
- Append: `APPEND(aList, value)`
- Remove: `REMOVE(aList, i)`
- Length: `LENGTH(aList)`

Important rule (AP CSP semantics):
- If an index is < 1 or > LENGTH(list), it is an error and the program
  terminates.

## Procedures
- Define procedure: `PROCEDURE procName(parameters...)`
- Call procedure: `procName(arg1, arg2, ...)`
- Return value: `RETURN(expression)`
- Assign from return: `result <-- procName(...)`

## Robot (optional, for grid puzzles)
- `MOVE_FORWARD()`
- `ROTATE_LEFT()`
- `ROTATE_RIGHT()`
- `CAN_MOVE(direction)` returns Boolean
- Failure rule: moving off-grid or into blocked square terminates the program.

## Trap-specific sensing extensions
These are not part of AP CSP, but are provided as game-facing "sensing"
helpers to keep puzzles readable:
- `enemies` list (list of enemy indices, 1-based)
- `enemy <field> list` (dropdown field -> list of that field for all enemies)
- `enemy <field> at index` (dropdown field + index -> value)

Field dropdown options should always include the full enemy field list even
when the toolbox is otherwise curated.

## Trap puzzle randomization axes (logic-focused)
Use these as the "knobs" we can turn on/off or vary per puzzle so the same
trap kind feels different while staying AP CSP-aligned.

- Output type: Number, Boolean, String, Character, List.
- Solve style: list-of-fields + list ops vs index/loop scan.
- Data access style: `enemy <field> list` vs `enemy <field> at index`.
- Loop type: repeat N, repeat until, for each.
- Comparison operator: =, !=, >, <, >=, <=.
- Boolean shape: single condition, AND, OR, NOT, nested condition.
- Arithmetic operator: +, -, *, /, MOD.
- Operand source: given inputs, constants, list length, random, computed value.
- List operation: create, get/set item, insert, append, remove, length.
- Accumulator pattern: running total, min/max tracking, count, last-seen.
- Targeting goal (for selection puzzles): nearest, farthest, weakest, strongest.
- Tie-break rule: first match, last match, lowest index, highest index.
- Conditional placement: no condition, pre-check guard, inside loop, post-check.
