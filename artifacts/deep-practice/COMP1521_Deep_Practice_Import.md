# COMP1521 — Complete Task Practice Workbook

One integrated collection: foundations, arrays, records, functions, Worms, bit manipulation, BCD, advanced challenges and a mixed assessment. Questions come first; all worked answers follow. Additional linked-list practice is explicitly labelled because no linked-list task was supplied.

This covers the available task specifications; missing starter-dependent details remain limitations, not claims of complete reconstruction. Practical solutions include code or implementation algorithms. MIPS has been manually reviewed, not simulator-executed.

## Deep Practice import and study guide

This edition preserves the 98 questions and worked solutions from the supplied workbook, with IDs CP-001 through CP-098. The coverage table uses the same IDs. Paste this entire file into Deep Practice > Import a workbook, preview it, choose COMP1521 as the subject, and save. Questions and solutions are matched by ID. Keep these IDs if you later replace this workbook so your existing attempts can be matched.

Attempt each question before revealing its solution. Multiple-choice items have explicit answer letters; written answers and code need self-assessment. For implementation questions, write and test the code before comparing with the worked method. An algorithm-only worked method is a guide, not evidence that your implementation runs correctly.

The source audit below is retained from the original workbook. The referenced PDFs, notes and starter programs were not attached to this conversion request and have not been independently rechecked here. Source-specific exercises, especially the Worms exercises CP-067 through CP-078 and the missing-starter challenges CP-087 through CP-091, require the referenced material for full original-task verification. If it is unavailable, use these as conceptual review and defer claims of original-task completion. Assembly examples remain manually reviewed according to the original workbook; this conversion does not claim simulator execution or a full technical audit of every answer.

## Coverage checklist

| Task / topic | Questions |
|---|---|
| Registers and memory | CP-001, CP-002, CP-003, CP-004, CP-005, CP-006, CP-007, CP-008, CP-009, CP-010, CP-011 |
| I/O and arithmetic | CP-012, CP-013, CP-014, CP-015, CP-016, CP-017, CP-039 |
| Branches and state | CP-018, CP-019, CP-020, CP-021, CP-022, CP-023, CP-024, CP-025, CP-026, CP-037, CP-038, CP-040 |
| Loops | CP-027, CP-028, CP-029, CP-030, CP-031, CP-032, CP-033, CP-034, CP-035, CP-036 |
| Testing and source reading | CP-041, CP-042, CP-043, CP-044 |
| Cumulative practice | CP-045, CP-046 |
| Part 1 mastery assessment | CP-047, CP-048 |
| print_bigger | CP-049, CP-050 |
| unordered | CP-051 |
| swap_numbers | CP-052 |
| reverse_negative | CP-053 |
| different10 | CP-054 |
| lookup | CP-055 |
| sieve | CP-056 |
| Array integration | CP-057 |
| Calls and stack | CP-058, CP-059 |
| Recursion | CP-060 |
| mathematics | CP-061, CP-062, CP-063 |
| CMS | CP-064, CP-065, CP-066 |
| Worms main / play | CP-067 |
| Worms in_bounds / get_input | CP-068 |
| Worms background / worms | CP-069 |
| Worms game_over / aim | CP-070 |
| Worms overlaps_with_terrain | CP-071 |
| Worms move | CP-072 |
| Worms render_projectile | CP-073 |
| Worms fire | CP-074 |
| Worms render_end_screen | CP-075 |
| Worms print_rgb | CP-076 |
| Worms helpers / physics | CP-077 |
| Worms helper integration | CP-078 |
| set_bits / get_nth_bit | CP-079 |
| sixteen_in | CP-080 |
| sixteen_out | CP-081 |
| bcd / packed_bcd | CP-082 |
| BCD addition | CP-083 |
| BCD subtraction | CP-084 |
| BCD multiplication | CP-085 |
| BCD division | CP-086 |
| BCD testing / constraints | CP-087 |
| dynamic_load | CP-088 |
| unmips | CP-089 |
| Monster MIPS | CP-090 |
| Polymipsism | CP-091 |
| NUXI | CP-092 |
| Linked lists — additional explanation | CP-093, CP-094 |
| Mixed assessment — records | CP-095 |
| Mixed assessment — board | CP-096 |
| Mixed assessment — binary and BCD | CP-097 |
| Mixed assessment — calls | CP-098 |
## Source audit and limitations

Reviewed files:

1. `Pasted text(3).txt`: 80-section notes, including diagrams, code examples and the partial unmips discussion.
2. `COMP1521 26T3 — Week 03 Laboratory Exercises(3).pdf`: 9 pages.
3. `COMP1521 26T3 — Week 03 Weekly Test Questions(1).pdf`: 4 pages.
4. `COMP1521 26T3 — Week 04 Laboratory Exercises(1).pdf`: 15 pages.
5. `COMP1521 26T3 — Week 04 Weekly Test Questions(1).pdf`: 5 pages.
6. `COMP1521 26T3 — Week 05 Laboratory Exercises(1).pdf`: 10 pages.
7. `COMP1521 26T3 — Assignment 1_ Worms in MIPS(1).pdf`: 7 pages.
8. `worms(1).c`: reference program, including helper implementations.
9. `worms(2).s`: constants, data, 14 empty assignment-function stubs and provided helper implementations.

All uploaded files were readable. Referenced external lecture slides, the assignment video, downloadable starter bundles and interactive “click to toggle” content were not supplied and are not claimed as reviewed. In particular, the actual unmips.s, dynamic_load.s, Monster MIPS code, Polymipsism support files and arbitrary-length BCD struct/header are missing. The assignment’s worms.simple.c, example input.txt and make fragment were not uploaded. Ordinary lab/test starters were not supplied separately; the task descriptions and visible code excerpts were reviewed. The notes’ partial unmips guess is not a reliable substitute for the missing program.

The supplied Worms assembly is a starter, not a completed student solution. No assignment source was edited. Practice uses fresh examples, with source-specific reading exercises where the supplied details matter.

### Corrections and assumptions to keep visible

- **Negative remainder:** “odd means remainder 1” needs a nonnegative-input assumption. Signed negative odd inputs may have remainder −1; use != 0. This is labelled additional explanation.
- **Byte extension and storage prerequisites:** signed/unsigned byte extension, alignment, newline capacity and short-circuit safety receive explicitly labelled additional explanation beyond the notes’ simplified treatment.
- **Provided-code discrepancy:** the uploaded MIPS render_impacts row step branches to the row-loop end instead of its condition. With a fully in-bounds impact, it writes one row while the C visits three. CP-044 diagnoses this without editing provided code. The C is the intended-behaviour reference for that question.
- **Other ambiguities:** different10’s transcript includes a colon absent from its displayed C output. The Week 5 bit diagram labels a position “32” where descending 32-bit indices should show 30 after 31; its examples establish zero-based bit indices 4 and 7. Exact-output questions specify the source they follow.
- **Execution limits:** the reference arithmetic and expected outputs were checked with executable calculations. MIPS solutions were manually traced and checked, but a mipsy executable was not available here; these are not claimed as simulator-tested.


## Questions

Assume 32-bit course MIPS, 4-byte ints/pointers, 1-byte chars and no overflow unless unsigned wrapping is explicitly part of the algorithm. Code snippets are independent. For algorithm answers, implement the complete function before checking the key.

### Registers and memory

#### CP-001 | Foundation | Recall

Question: Match `$zero`, `$t0`, `$s0`, `$a0`, `$v0`, `$sp`, `$fp`, `$ra` to their roles. Explain a register versus a memory location.

#### CP-002 | Foundation | Understanding

Question: Given `value: .word 37`, which instruction puts the ADDRESS of value in `$t0`?

Answer choices:

A. `li $t0, 37`

B. `la $t0, value`

C. `lw $t0, value`

D. `move $t0, $t1`

#### CP-003 | Foundation | Application

Question: Initially `score: .word 12`. Give final `$t1`, `$t2` and the word at score.
```mips
la   $t0, score
lw   $t1, 0($t0)
add  $t1, $t1, 5
lw   $t2, 0($t0)
sw   $t1, 0($t0)
```

#### CP-004 | Foundation | Recall

Question: Give directives for (a) instructions, (b) data, (c) integers 2, 4, 6, (d) 28 reserved bytes, (e) one character Q, (f) a 16-bit value 9. How much storage does (c) use?

#### CP-005 | Foundation | Understanding

Question: How many bytes does `.asciiz "cat\n"` occupy?

Answer choices:

A. 3

B. 4

C. 5

D. 6

#### CP-006 | Developing | Application

Question: Additional explanation: the next free address is 0x1001. What does `.align 2` do in this assembler, and where does a following word begin?

#### CP-007 | Foundation | Recall

Question: Choose instructions and transfer directions for reading a signed byte, writing a byte, reading a 32-bit integer and writing a 32-bit integer.

#### CP-008 | Developing | Transfer

Question: Additional explanation: memory at `$t0` contains byte 0xFE. What signed decimal register values result from `lb $t1, 0($t0)` and `lbu $t2, 0($t0)`?

Answer choices:

A. 254 and 254

B. −2 and 254

C. 254 and −2

D. −2 and −2

#### CP-009 | Developing | Application

Question: Trace the case and answer all parts. An int array starts at 0x2000 and a separate char array starts at 0x3000. Find the addresses of element 5 in each and the appropriate loads (signed characters).

#### CP-010 | Developing | Debugging

Question: `$t0` is a valid index into int numbers[]; `$t3` is the new value. Repair both errors.
```mips
la  $t2, numbers
add $t2, $t2, $t0
lw  $t3, 0($t2)
```

#### CP-011 | Developing | Understanding

Question: Trace `int x=6; int *p=&x; int y=*p; *p=19;`. What are x and y afterward? If `$t0=p`, what does `lw $t1, 0($t0)` do?

### I/O and arithmetic

#### CP-012 | Foundation | Recall

Question: State syscall numbers and argument/result registers for print integer, print string, read integer, print character, read character and read string in mipsy.

#### CP-013 | Developing | Debugging

Question: Input is 23. What is printed, and how do you fix it?
```mips
li   $v0, 5
syscall
li   $v0, 1
move $a0, $v0
syscall
```

#### CP-014 | Foundation | Understanding

Question: Which sequence prints exactly one newline?

Answer choices:

A. `li $v0, 1; li $a0, 10; syscall`

B. `li $v0, 4; li $a0, 10; syscall`

C. `li $v0, 11; li $a0, '1'; syscall`

D. `li $v0, 11; li $a0, 10; syscall`

#### CP-015 | Developing | Transfer

Question: Additional explanation: how many bytes hold 12 content characters plus a zero terminator? How many if a retained newline must also fit? Why is char buf[12] insufficient?

#### CP-016 | Developing | Application

Question: Assume no overflow. What is `$t2` at the end?
```mips
li  $t0, 8
li  $t1, 13
add $t2, $t0, $t1
div $t2, $t2, 2
```

Answer choices:

A. 10.5

B. 10

C. 11

D. 21

#### CP-017 | Developing | Transfer

Question: Trace the case and answer all parts. Additional explanation: signed division truncates toward zero. Find −7 / 2, −7 % 2 and −8 % 2. Give even and odd tests valid for negative inputs too.

### Branches and state

#### CP-018 | Developing | Application

Question: Translate `if (x <= 9) { y = y + 3; }` into labelled simplified C and MIPS with `$t0=x`, `$t1=y`. Branch to skip the body. Assume no overflow.

#### CP-019 | Foundation | Recall

Question: Write the opposite relation and corresponding branch for ==, !=, <, <=, > and >=. Keep operand order unchanged.

#### CP-020 | Foundation | Understanding

Question: Translate the literal statement `if (x > limit) goto too_large;`, with x in `$t0` and limit in `$t1`.

Answer choices:

A. `bgt $t0, $t1, too_large`

B. `bge $t0, $t1, too_large`

C. `ble $t0, $t1, too_large`

D. `bgt $t1, $t0, too_large`

#### CP-021 | Developing | Application

Question: To execute a body only for `3 <= x && x < 8`, which pair skips to done for invalid x? x is `$t0`.

Answer choices:

A. `ble $t0, 3, done` then `bge $t0, 8, done`

B. `blt $t0, 3, done` then `bgt $t0, 8, done`

C. `blt $t0, 3, done` then `bge $t0, 8, done`

D. `ble $t0, 3, done` then `bgt $t0, 8, done`

#### CP-022 | Developing | Application

Question: Write branches to outside exactly when `x < -2 || x > 4`; otherwise go to inside. x is `$t0`.

#### CP-023 | Developing | Debugging

Question: Additional explanation: why is evaluating `12 / x` before testing `x != 0 && 12 / x > 2` unsafe? Give a correct evaluation order and results for x = 0, 3, 6.

#### CP-024 | Developing | Understanding

Question: A helper returns −1 for no match and indices 0, 1, 2 for matches. Which test recognises a match?

Answer choices:

A. `result != 0`

B. `result > 0`

C. `result == 1`

D. `result != -1`

#### CP-025 | Developing | Application

Question: Trace the case and answer all parts. A fresh power setting is clamped to [0,6] after each change. Starting at 2, apply −5, +10, −1 in order. Give results and pseudocode.

#### CP-026 | Developing | Transfer

Question: A dial has positions 0 through 5. Clockwise adds one; anticlockwise subtracts one; going beyond either endpoint wraps to the other. From 0, perform anticlockwise, clockwise, clockwise. Why is `(position - 1) % 6` insufficient at zero in signed C?

### Loops

#### CP-027 | Developing | Application

Question: For `for (int i=4; i<15; i+=3)`, list body values and the counter value at the final failed test. Ignore its out-of-loop scope for this tracing question.

#### CP-028 | Developing | Understanding

Question: With i initially 7, how many bodies execute in `while (i<3) { i++; }` and, independently resetting i to 7, `do { i++; } while (i<3);`?

Answer choices:

A. 0 and 1

B. 0 and 0

C. 1 and 1

D. 1 and 0

#### CP-029 | Developing | Application

Question: Fill the blanks for summing i = 1 through 4 inclusive. Give final total and i.
```mips
li  $t0, ___
li  $t1, 0
cond:
___ $t0, 4, end
add $t1, $t1, $t0
add $t0, $t0, ___
b   ___
end:
```

#### CP-030 | Developing | Debugging

Question: This should sum 1 through 4 except 2. Repair it.
```mips
li $t0, 1
li $t1, 0
cond:
bgt $t0, 4, end
beq $t0, 2, cond
add $t1, $t1, $t0
step:
add $t0, $t0, 1
b cond
end:
```

#### CP-031 | Developing | Understanding

Question: What are total and i afterward?
```c
int total=0, i=1;
while (i<=5) {
    if (i==4) break;
    total += i;
    i++;
}
```

Answer choices:

A. total = 10, i = 4

B. total = 6, i = 4

C. total = 6, i = 5

D. total = 15, i = 6

#### CP-032 | Developing | Application

Question: List visited (row,col) pairs for `for (row=0; row<3; row++)` containing `for (col=0; col<=row; col++)`. Give the count.

#### CP-033 | Developing | Debugging

Question: Why are only three cells printed, rather than six? Repair the initialisation.
```c
int col=0;
for (int row=0; row<2; row++) {
    while (col<3) {
        /* print one cell */
        col++;
    }
}
```

#### CP-034 | Developing | Application

Question: Give the exact output, including newlines. What changes if the newline moves into the inner body?
```c
for (int row=0; row<2; row++) {
    for (int col=0; col<3; col++) putchar('+');
    putchar('\n');
}
```

#### CP-035 | Developing | Transfer

Question: Trace the case and answer all parts. A fresh input loop stops at any negative integer and sums earlier values. Input: 4, 0, 7, −2, 9. Give the sum, number of reads and pseudocode excluding the sentinel.

#### CP-036 | Challenging | Implementation

Question: Write complete mipsy main code that reads until an integer belongs to [2,6], then prints it and one newline. No prompts or other output. Assume valid integer input eventually supplies an accepted value; use no helper calls.

### Branches and state

#### CP-037 | Challenging | Implementation

Question: Write a leaf function inside_box for a fresh 7-column, 3-row board: x in `$a0`, y in `$a1`; return exactly 1 for `0<=x<7 && 0<=y<3`, otherwise 0. Do not change saved registers.

#### CP-038 | Developing | Implementation

Question: Write leaf function larger returning the larger signed integer from `$a0`,`$a1` in `$v0`. Include equal-input and two-negative-input tests.

### I/O and arithmetic

#### CP-039 | Developing | Debugging

Question: You still need x after testing parity, but x is in `$t0` and you wrote `rem $t0, $t0, 2`. Repair it and branch to odd for every signed odd x.

### Branches and state

#### CP-040 | Challenging | Transfer

Question: Dispatch a character in `$t0`: + to increase, - to decrease, q to quit, all others to invalid. Explain why integer 1 differs from character 1.

### Testing and source reading

#### CP-041 | Developing | Understanding

Question: A displayed C program prints `Result 9\n`, but a transcript shows `Result: 9\n`. How should an exact-output quiz handle this?

Answer choices:

A. Silently assume the transcript is always authoritative

B. Flag the discrepancy and specify the source being traced

C. Treat both outputs as byte-for-byte identical

D. Change the arithmetic to remove the discrepancy

#### CP-042 | Foundation | Recall

Question: Give course commands to fetch Week 3 files, run practice.s with cases.txt as input, run print_bigger autotests, and compare c.out with mips.out. Which separate action submits work? Do not submit anything.

#### CP-043 | Challenging | Debugging

Question: A translation loops forever only after a rejected input. Describe a smallest useful test, a trace table and at least three candidate mistakes. Distinguish a bad comparison from missing progress.

#### CP-044 | Challenging | Debugging

Question: The uploaded provided MIPS contains:
```mips
render_impacts__y_off_step:
    add $s1, $s1, 1
    b   render_impacts__y_off_end
```
The C reference loops y_off from 0 while y_off < IMPACT_HEIGHT (3). For one fully in-bounds impact, what rows does this branch permit? Which target would match C? Read only; do not edit the supplied file.

### Cumulative practice

#### CP-045 | Challenging | Integration

Question: Write complete mipsy main: read signed a,b, print `(a+2*b)/3` then newline, no prompts. Assume intermediates fit signed 32 bits. No helper calls. Explain a = −8, b = 2.

#### CP-046 | Challenging | Integration

Question: Write complete mipsy main: read rows and columns, each guaranteed in [0,4]. Print columns @ characters plus newline for each row, no prompts. Explain (0,3),(2,0),(2,3).

### Part 1 mastery assessment

#### CP-047 | Challenging | Transfer + integration

Question: Closed notes: read lo,hi with −20<=lo<=hi<=20. Print every integer strictly between them except multiples of three, increasing, one per line, no prompts. Write simplified C, complete mipsy main, a register map and an invariant. Test equal bounds, adjacent bounds and a range crossing zero.

#### CP-048 | Challenging | Transfer + integration

Question: Closed notes: read at most four integers. Accept the first in [1,5], print it plus newline, and stop reading. If all four are rejected, print none plus newline. No prompts. Write complete mipsy main, state an invariant and test fourth-attempt success and an unread fifth value.

### print_bigger

#### CP-049 | Task-level | Application

Question: For [7,2,9,4,7], filter values >= the final input. Write a two-pass algorithm and explain why printing during input is unsafe.

#### CP-050 | Task-level | Implementation

Question: Write MIPS core code for filtering n ints: $a0=base,$a1=n,$a2=threshold. No helper calls; print each qualifying integer followed by newline.

### unordered

#### CP-051 | Task-level | Implementation

Question: Trace the inversion flag for [1,4,4,3,8]. Write C that detects whether an array is not non-decreasing.

### swap_numbers

#### CP-052 | Task-level | Application

Question: Trace the case and answer all parts. Perform one forward adjacent compare/swap pass on [5,1,4,2]. Give every intermediate array. Is the result sorted?

### reverse_negative

#### CP-053 | Task-level | Application

Question: Trace the case and answer all parts. Read 8,0,3,-9. Give stored data and output. Write the reverse loop and handle an immediate sentinel.

### different10

#### CP-054 | Task-level | Implementation

Question: For a fresh target of four distinct values, trace 3,3,1,2,1,5,9. Write the search/insert logic.

### lookup

#### CP-055 | Task-level | Application

Question: Trace the case and answer all parts. For int a[6][9] at base 0x1000, find &a[4][7]. Derive the formula, then adapt it to char screen[20][60] at (x=8,y=3).

### sieve

#### CP-056 | Task-level | Application

Question: Run the supplied sieve pattern for limit 12. List printed values and marks made at i=2 and i=3. Why use sb rather than sw?

### Array integration

#### CP-057 | Task-level | Implementation

Question: Write C to reverse an int array in place and translate its core into MIPS with $a0=base,$a1=n.

### Calls and stack

#### CP-058 | Task-level | Implementation

Question: A function receives x, calls g(x), then returns x+g(x). Write a correct MIPS body using $s0 and explain its frame.

#### CP-059 | Task-level | Debugging

Question: Debug a function that pushes ra,s0,s1 then pops ra,s0,s1. State the right order and stack effect.

### Recursion

#### CP-060 | Task-level | Implementation

Question: Write a recursive C sum from 1 to n for n>=0 and describe exactly what each MIPS frame must preserve. Trace n=3.

### mathematics

#### CP-061 | Task-level | Understanding

Question: Why must add_rand preserve its value argument across rand(0xFFFF)? Sketch the implementation and discuss the upper endpoint.

#### CP-062 | Task-level | Application

Question: In seq_rand, rand(100) returns 3 and successive add_rand calls add 2,4,1 to initial value 5. Trace the result and identify live variables.

#### CP-063 | Task-level | Understanding

Question: Explain sub_rand(value), the rand modulus precondition and seed arithmetic.

### CMS

#### CP-064 | Task-level | Application

Question: Students have id at offset0, mark at4, stride8. Base=0x2000. Find address of student 3 mark. Repair base+index followed by multiplication.

#### CP-065 | Task-level | Implementation

Question: Write a leaf find function: $a0=id, global students and CLASS_SIZE; return record pointer or NULL.

#### CP-066 | Task-level | Understanding

Question: Explain your reasoning. Design update and report logic for a missing student, an unknown mark -1 and a genuine mark 0.

### Worms main / play

#### CP-067 | Task-level | Understanding

Question: Explain your reasoning. Give the exact control-flow contract for main and play. If setup fails, which later calls occur?

### Worms in_bounds / get_input

#### CP-068 | Task-level | Understanding

Question: Give all boundary tests for the supplied screen and explain get_input’s argument/result lifetimes.

### Worms background / worms

#### CP-069 | Task-level | Recall

Question: Write the address formula used to clear screen and render worms. Which alive values count as true?

### Worms game_over / aim

#### CP-070 | Task-level | Application

Question: For alive flags [1,0,2,0], is the game over? What about [0,0] and [1,0]? Trace clockwise at aim23 and anticlockwise at0.

### Worms overlaps_with_terrain

#### CP-071 | Task-level | Understanding

Question: A rectangle starts (4,6), width2,height3. List tested points and explain early return and call preservation.

### Worms move

#### CP-072 | Task-level | Understanding

Question: Explain each decision for moving horizontally into blocked terrain. What happens if y=0? Why retain the original C call order?

### Worms render_projectile

#### CP-073 | Task-level | Understanding

Question: Compare a projectile and aim_guide above the screen. Explain trail clipping and pointer identity.

### Worms fire

#### CP-074 | Task-level | Understanding

Question: Describe fire as an ordered event list. Why do-while, what is copied into impacts and why compare turn before next_turn?

### Worms render_end_screen

#### CP-075 | Task-level | Understanding

Question: Explain winner search and the two fixed-length text copies. How do no survivors differ from one?

### Worms print_rgb

#### CP-076 | Task-level | Application

Question: Trace the case and answer all parts. For character A and RGB (7,42,255), specify the exact formatting and a padding method.

### Worms helpers / physics

#### CP-077 | Task-level | Application

Question: Given pos_unit_y=-4500, dy=-123, PHYSICS_SCALING10 and GRAVITY67, compute next unit y and dy before conversion. Explain backward trail shift.

### Worms helper integration

#### CP-078 | Task-level | Understanding

Question: Explain impact-before-terrain collision checks, rendering layers, random retries and a local y snapshot during falling.

### set_bits / get_nth_bit

#### CP-079 | Task-level | Implementation

Question: Write unsigned C to clear bit4, set bit7, then independently obtain bit n as0/1. Assume0<=n<32. Test255 and58.

### sixteen_in

#### CP-080 | Task-level | Implementation

Question: Parse 1111111111111101. Give an algorithm avoiding signed left-shift overflow and state the range.

### sixteen_out

#### CP-081 | Task-level | Implementation

Question: Write a malloc-based function that returns all16 bits of an int16_t, with terminator. Explain ownership and -2.

### bcd / packed_bcd

#### CP-082 | Task-level | Application

Question: Decode unpacked0x0307 and packed0x3057. Give formulas and explain why hexadecimal numeric value is not the decimal result.

### BCD addition

#### CP-083 | Task-level | Implementation

Question: Additional practice layout: digits are least-significant first, each0..9. Add [9,9,9] and [1]. Give algorithm and capacity.

### BCD subtraction

#### CP-084 | Task-level | Implementation

Question: Using the same explicit practice layout, subtract1 from1000. Show borrows and normalisation.

### BCD multiplication

#### CP-085 | Task-level | Implementation

Question: Design grade-school multiplication for digits low-first. What result length suffices and how do you handle accumulated products?

### BCD division

#### CP-086 | Task-level | Implementation

Question: Describe long division for nonnegative arbitrary-length integers, divisor nonzero. Trace1234/12. Why not repeated subtraction of the entire quotient?

### BCD testing / constraints

#### CP-087 | Task-level | Recall

Question: Give independent properties for add, subtract, multiply and divide. What starter details remain unavailable?

### dynamic_load

#### CP-088 | Task-level | Implementation

Question: Design the loader lifecycle for signed instruction integers ending at-1, up to1024 instructions. How much space and how is control returned?

### unmips

#### CP-089 | Task-level | Understanding

Question: Explain your reasoning. Given a missing original unmips.s, what can you prove from the PDF alone? Give a disciplined reconstruction procedure and a fresh pattern to recognise.

### Monster MIPS

#### CP-090 | Task-level | Understanding

Question: Explain a stack call f(a,b,c) under the sheet’s special convention: rightmost argument highest address, caller cleans. Which restrictions must a solution obey?

### Polymipsism

#### CP-091 | Task-level | Implementation

Question: Explain named-method dispatch and write the core indirect call when $t0 holds a method address and $a0 the object pointer. What must survive lookup?

### NUXI

#### CP-092 | Task-level | Application

Question: Trace the case and answer all parts. Additional explicit example: original bytes [A,B,C,D] appear as[C,A,D,B]. The same permutation transforms payload to[30,10,40,20]. Recover original payload and distinguish byte order from printed hex.

### Linked lists — additional explanation

#### CP-093 | Task-level | Implementation

Question: No linked-list source was supplied. For practice only define Node as int value offset0,next pointer offset4,size8. Write traversal/search MIPS for head in a0,target in a1; return matching node orNULL.

#### CP-094 | Task-level | Implementation

Question: For the same fresh layout, explain prepend, deletion of the first matching node and freeing safely. Handle deleting the head.

### Mixed assessment — records

#### CP-095 | Task-level | Integration

Question: Fresh records {int id;int score}, size8, score=-1 unknown. Write C and MIPS to count known scores >= a threshold, preserve record order and return count. Helpers may clobber temporaries if used.

### Mixed assessment — board

#### CP-096 | Task-level | Integration

Question: Fresh char board[5][8]. Implement paint(x,y,w,h) that writes # only to in-bounds cells in the requested rectangle. x,y may be negative; w,h are nonnegative and small enough to avoid overflow. Give count for(-1,3,4,4).

### Mixed assessment — binary and BCD

#### CP-097 | Task-level | Integration

Question: Parse sixteen ASCII bits to an unsigned number, then encode its decimal digits into packed BCD. State input/range assumptions and test binary0000000000101010.

### Mixed assessment — calls

#### CP-098 | Task-level | Integration

Question: A wrapper must call read_value(), transform(value) and log_result(value,result), then return result. All helpers may overwrite caller-saved registers. Design its frame and explain a test double that exposes preservation bugs.

## Answers and explanations

### CP-001

Answer:

Zero constant; temporary; callee-saved register; first ordinary argument; return value / syscall selector or result; stack pointer; frame pointer; return address, respectively.

Explanation: Registers are CPU storage named in instructions. Memory consists of addressed bytes. A register can contain an integer or an address; holding an address does not automatically read its contents.

Key rule: Track both the location of a value and what its bits represent.

Common mistakes: Saved registers are not automatically saved by hardware. A function changing one must restore it. `$v0` is not permanent storage for a result.

Checking criteria: Name all eight roles and explain why a pointer in `$t0` differs from the word at that address.

### CP-002

Answer:

B

Explanation: `la` gives the location of the labelled object, not its stored integer.

Key rule: `li` = immediate; `la` = address; `lw` = word read from memory.

Incorrect options: A loads 37. C reads the stored 37. D copies an unspecified register.

Checking criteria: Explain why the chosen option works and why each distractor fails.

### CP-003

Answer:

17, 12 and 17, respectively.

Explanation: The addition changes only `$t1`. The second load still reads 12 because the store has not happened yet. Only the final instruction changes memory.

Key rule: A load copies a value; register arithmetic does not implicitly store it.

Common mistakes: Making `$t2` equal 17 assumes a store that has not happened.

Checking criteria: Record memory after each instruction: 12, 12, 12, 12, 17.

### CP-004

Answer:

`.text`; `.data`; `.word 2, 4, 6`; `.space 28`; `.byte 'Q'`; `.half 9`. The three words use 12 bytes.

Explanation: A word occupies four bytes; three words therefore occupy 3 × 4 bytes. Directives describe assembly layout rather than runtime actions.

Key rule: `.space` counts bytes, not array elements.

Common mistakes: `.space 7` is insufficient for seven four-byte integers.

Checking criteria: Explain how to reserve seven words without assuming initial values.

### CP-005

Answer:

C

Explanation: Three letters + one newline + one terminating zero = five bytes.

Key rule: An escaped newline is one byte here; `.asciiz` adds one zero byte.

Incorrect options: A counts only letters. B omits the terminator. D counts backslash and n as separate stored characters.

Checking criteria: Explain why the chosen option works and why each distractor fails.

### CP-006

Answer:

It aligns to a multiple of 2² = 4 bytes; the word starts at 0x1004.

Explanation: 0x1001, 0x1002 and 0x1003 are not multiples of four. Padding brings the next object to the required boundary.

Key rule: The alignment operand is an exponent in this course assembler.

Common mistakes: Two-byte alignment confuses the exponent with the boundary. Do not assume a preceding character array ends on a word boundary.

Checking criteria: Verify the resulting address modulo four is zero.

### CP-007

Answer:

`lb`: memory → register; `sb`: register → memory; `lw`: memory → register; `sw`: register → memory.

Explanation: Select load/store by direction, then byte/word by object size. A byte load still produces a full register value.

Key rule: L = load, S = store, B = one byte, W = four bytes.

Common mistakes: Using `sw` for one character may overwrite three neighbouring bytes.

Checking criteria: Explain why `sb` writes the source register’s low eight bits.

### CP-008

Answer:

B

Explanation: `lb` sign-extends to 0xFFFFFFFE (−2); `lbu` zero-extends to 0x000000FE (254).

Key rule: The byte is identical; extension determines the full register value.

Incorrect options: A makes both unsigned. C reverses the rules. D makes both signed.

Checking criteria: Explain why the chosen option works and why each distractor fails.

### CP-009

Answer:

Integer: 0x2014 with `lw`. Character: 0x3005 with `lb`.

Explanation: The integer offset is 5 × 4 = 20 decimal = 0x14. The character offset is five bytes.

Key rule: Address = base + index × element size.

Common mistakes: Twenty decimal is not hexadecimal 0x20. Multiplying a char index by four skips characters.

Checking criteria: Index zero must give the base; adjacent integer addresses differ by four.

### CP-010

Answer:

```mips
mul $t1, $t0, 4
la  $t2, numbers
add $t2, $t2, $t1
sw  $t3, 0($t2)
```

Explanation: Scale the index by four, then store. The original also overwrites the proposed new value by loading into its register.

Key rule: Correct address calculation and correct transfer direction are separate requirements.

Common mistakes: Fixing only the instruction still uses the wrong address; fixing only the offset still reads instead of writes.

Checking criteria: For index 2 and value 91, only the word eight bytes after the base should become 91.

### CP-011

Answer:

x = 19, y = 6. The load reads *p into `$t1`.

Explanation: The pointer identifies x. The earlier read copied 6 into y; changing x through p does not change that independent copy.

Key rule: Distinguish a pointer from the value obtained by dereferencing it.

Common mistakes: Changing y to 19 treats a copied integer as a live reference.

Checking criteria: Draw p pointing to x and y in its own box.

### CP-012

Answer:

1: integer in `$a0`; 4: string address in `$a0`; 5: result in `$v0`; 11: character code in `$a0`; 12: result in `$v0`; 8: buffer address `$a0`, capacity `$a1`. Put the service number in `$v0` before syscall.

Explanation: Each operation has its own interface: printing a character takes a code, printing a string takes an address.

Key rule: Know the service and its register contract together.

Common mistakes: Read-integer returns in `$v0`, not `$a0`. A string pointer is not the string’s first character.

Checking criteria: Give separate setups for printing integer 25 and the string at label prompt.

### CP-013

Answer:

It prints 1. Preserve the read before changing `$v0`:
```mips
li   $v0, 5
syscall
move $t0, $v0
li   $v0, 1
move $a0, $t0
syscall
```

Explanation: Selecting service 1 overwrites the input result. The original then copies the service number into the print argument.

Key rule: Preserve a result before reusing its register.

Common mistakes: Moving `$v0` after selecting another service is too late.

Checking criteria: Inputs −4, 0 and 23 must each be echoed exactly; this snippet adds no newline.

### CP-014

Answer:

D

Explanation: Service 11 prints the character with code 10, which is newline.

Key rule: Printing a code as an integer differs from printing its character.

Incorrect options: A prints digits 10. B treats address 10 as a string pointer. C prints the digit 1.

Checking criteria: Explain why the chosen option works and why each distractor fails.

### CP-015

Answer:

13 bytes without the newline, 14 with it.

Explanation: Count each stored character and the terminator. A bounded line read may truncate rather than keep the full line when capacity is insufficient.

Key rule: Capacity includes the terminating zero; account separately for a retained newline.

Common mistakes: Twelve bytes leaves no terminator slot after twelve content characters. Do not assume every input API strips newline.

Checking criteria: Number the positions for twelve letters, newline and zero; identify the last valid index.

### CP-016

Answer:

B

Explanation: The sum is 21. Integer division by two gives 10, discarding the fractional part.

Key rule: Integer division returns an integer.

Incorrect options: A uses floating-point division. C rounds instead of truncating. D ignores the division.

Checking criteria: Explain why the chosen option works and why each distractor fails.

### CP-017

Answer:

−3, −1 and 0. Even: x % 2 == 0. Odd: x % 2 != 0.

Explanation: Use x = quotient × divisor + remainder: −7 = (−3) × 2 + (−1). Multiples have zero remainder regardless of sign.

Key rule: Odd means nonzero remainder, not necessarily +1.

Common mistakes: The notes’ “odd → 1” shortcut needs nonnegative inputs. Floor division would give −4, not the required truncation.

Checking criteria: Test −7, −8, 0, 7 and 8; retain x if later code needs it.

### CP-018

Answer:

Simplified C: `if (x > 9) goto done; y += 3; done: ;`
```mips
bgt $t0, 9, done
add $t1, $t1, 3
done:
```

Explanation: x > 9 is precisely the complement of x <= 9, so only those values skip the body.

Key rule: Invert a condition when branching to the skipped-body path.

Common mistakes: `bge` incorrectly excludes x = 9.

Checking criteria: With y = 2, x = 8, 9, 10 must produce y = 5, 5, 2.

### CP-019

Answer:

== → != / bne; != → == / beq; < → >= / bge; <= → > / bgt; > → <= / ble; >= → < / blt.

Explanation: The opposite must cover every case excluded by the original, including equality when needed.

Key rule: Negating strict inequality makes non-strict inequality, and vice versa.

Common mistakes: The opposite of < is not >: that omits equality.

Checking criteria: For equal operands, exactly one relation in every original/opposite pair must be true.

### CP-020

Answer:

A

Explanation: The specified destination is reached when x is greater than limit, so branch directly on that relation.

Key rule: The branch destination determines whether to use the condition or its opposite.

Incorrect options: B includes equality incorrectly. C reverses the condition. D swaps the operands and tests limit > x.

Checking criteria: Explain why the chosen option works and why each distractor fails.

### CP-021

Answer:

C

Explanation: Reject x < 3 or x >= 8; the remaining integers are 3 through 7.

Key rule: For AND, leave when either required condition fails.

Incorrect options: A wrongly excludes 3. B wrongly includes 8. D wrongly excludes 3 and includes 8.

Checking criteria: Explain why the chosen option works and why each distractor fails.

### CP-022

Answer:

```mips
blt $t0, -2, outside
bgt $t0, 4, outside
b   inside
```

Explanation: Either true comparison is sufficient. If neither succeeds, x belongs to the closed interval [−2,4].

Key rule: For OR, one true operand establishes the true result.

Common mistakes: Requiring both conditions makes the outside case impossible. Endpoints belong inside.

Checking criteria: Test −3, −2, 0, 4, 5: outside, inside, inside, inside, outside.

### CP-023

Answer:

First reject x = 0; only then divide and compare. Results: false, true, false.

Explanation: C skips the right side of && when the left is false. Eager division would divide by zero. With x = 3 the quotient is 4; with x = 6 it is 2.

Key rule: Short-circuit order can protect an invalid operation.

Common mistakes: Calculating both operands and combining the results later is not equivalent when operations can fail or have side effects.

Checking criteria: The zero-input path must reach false without performing division.

### CP-024

Answer:

D

Explanation: Any value other than −1 is a valid index, including zero.

Key rule: Compare with the specified sentinel rather than generic truthiness.

Incorrect options: A rejects index 0 and accepts −1. B rejects index 0. C recognises only index 1.

Checking criteria: Explain why the chosen option works and why each distractor fails.

### CP-025

Answer:

0, 6, 5. `power += change; if (power < 0) power = 0; if (power > 6) power = 6;`.

Explanation: 2−5 goes below zero; 0+10 exceeds six; 6−1 remains in range.

Key rule: Clamping stops at an endpoint and occurs at the specified step.

Common mistakes: Combining all changes before clamping changes the process. Wraparound is a different operation.

Checking criteria: Test zero change, both endpoints and overshoots in both directions.

### CP-026

Answer:

5, 0, 1. At zero the expression gives −1, not 5.

Explanation: Apply the wrap after each single step. C’s remainder for −1 divided by 6 is negative, so explicit negative-boundary handling is needed.

Key rule: Signed remainder does not automatically normalise to a nonnegative range.

Common mistakes: Clamping would keep the first result at zero. These endpoint rules describe single steps, not arbitrary jumps.

Checking criteria: Trace both directions from both endpoints.

### CP-027

Answer:

Body: 4, 7, 10, 13. Failed test: i = 16.

Explanation: Initialise once, test before the body and add three afterward. Sixteen fails the bound.

Key rule: The final counter need not equal the bound.

Common mistakes: Including 16 ignores the test; claiming final i = 13 ignores the last update.

Checking criteria: Write all five condition checks, including the failed one.

### CP-028

Answer:

A

Explanation: The while fails before its first body; the do-while first increments to 8, then fails.

Key rule: A do-while tests after the body; a while tests before it.

Incorrect options: B makes both pre-test loops. C makes both post-test loops. D reverses the rules.

Checking criteria: Explain why the chosen option works and why each distractor fails.

### CP-029

Answer:

1, bgt, 1, cond. Total = 10; i = 5.

Explanation: Allow i = 4, so exit only above four. Running totals are 1, 3, 6, 10.

Key rule: Keep initialisation, condition, body and step distinct.

Common mistakes: `bge` omits four. Jumping back to initialisation resets progress.

Checking criteria: Trace every check, including i = 5.

### CP-030

Answer:

Change the equality branch target to step. The total is 8.

Explanation: At i = 2 the original returns to the test without changing i, so it never progresses. The skip path must execute the update.

Key rule: A translated for-loop continue normally targets the step.

Common mistakes: Removing the comparison adds the excluded value. Updating only on the normal path leaves the skipped path stuck.

Checking criteria: Show that i becomes 3 after the skipped iteration.

### CP-031

Answer:

B

Explanation: Only 1, 2 and 3 are added. At four, break exits before addition and increment.

Key rule: Break exits the loop immediately.

Incorrect options: A adds the break value. C increments after break. D ignores break.

Checking criteria: Explain why the chosen option works and why each distractor fails.

### CP-032

Answer:

(0,0), (1,0), (1,1), (2,0), (2,1), (2,2): six visits.

Explanation: Reset col each row. Rows have one, two and three visits respectively.

Key rule: Inner bounds determine the shape of nested iteration.

Common mistakes: 3×3 assumes a constant width. Starting at col = 1 omits the zero column.

Checking criteria: Generalise the count for n rows as 1+2+…+n.

### CP-033

Answer:

Move `col=0` inside the outer body before the inner while.

Explanation: After row zero, col is three. Without resetting it, the next inner loop is already finished.

Key rule: Initialise an inner counter once per outer iteration.

Common mistakes: Resetting inside the inner body can prevent termination.

Checking criteria: Both rows must start with col = 0 and each execute three inner bodies.

### CP-034

Answer:

Original: `+++\n+++\n`. Changed: `+\n` repeated six times.

Explanation: The original newline runs once per row; the moved newline runs once per cell.

Key rule: Output placement is part of loop semantics.

Common mistakes: Ignoring whitespace can hide a difference that exact-output testing detects.

Checking criteria: Count six plus signs in both versions, but two versus six newlines.

### CP-035

Answer:

Sum 11, four reads. `sum=0; while (true) { read x; if (x<0) break; sum+=x; }`.

Explanation: Read and add 4, 0 and 7. Read −2 to detect termination, but do not add it. Leave 9 unprocessed.

Key rule: Test the sentinel before treating it as data.

Common mistakes: Stopping at zero confuses negative with nonpositive. Adding before testing includes the sentinel.

Checking criteria: A first value of −1 must yield sum zero after one read.

### CP-036

Answer:

```mips
.text
main:
retry:
    li   $v0, 5
    syscall
    move $t0, $v0
    blt  $t0, 2, retry
    bgt  $t0, 6, retry
    move $a0, $t0
    li   $v0, 1
    syscall
    li   $a0, '\n'
    li   $v0, 11
    syscall
    li   $v0, 0
    jr   $ra
```

Explanation: Both invalid cases go back to a fresh read. Falling through establishes both inclusive bounds, so print once and return.

Key rule: Every rejected-input retry must obtain a new value.

Common mistakes: `ble`/`bge` reject endpoints. Returning to the comparisons without rereading can loop forever.

Checking criteria: −1,0,7,2 → `2\n`; 6 → `6\n`. This is a syscall-only leaf main, not a template for nested helper calls.

### CP-037

Answer:

```mips
inside_box:
    li   $v0, 0
    bltz $a0, box_done
    bge  $a0, 7, box_done
    bltz $a1, box_done
    bge  $a1, 3, box_done
    li   $v0, 1
box_done:
    jr   $ra
```

Explanation: Default to false; reject each failed requirement; set true only after every check passes. No nested calls or saved-register changes require a stack frame here.

Key rule: Dimensions are exclusive upper bounds for zero-based coordinates.

Common mistakes: Accepting x = 7 or y = 3 is out of bounds. Checking only upper limits accepts negatives.

Checking criteria: Accept (0,0),(6,2); reject (−1,0),(7,0),(0,−1),(0,3). Preserve `$sp`, `$ra` and `$s` registers.

### CP-038

Answer:

```mips
larger:
    move $v0, $a0
    bge  $a0, $a1, larger_done
    move $v0, $a1
larger_done:
    jr   $ra
```
(5,5) → 5; (−8,−3) → −3.

Explanation: Keep the first value when it is at least the second; otherwise replace it. Equality may return either copy.

Key rule: Use signed comparisons for signed ordering.

Common mistakes: Returning zero for two negatives invents a candidate. Unsigned comparison does not implement general signed ordering.

Checking criteria: Also test (2,9),(9,2),(−1,0). Return the value, not an address.

### CP-039

Answer:

```mips
rem $t1, $t0, 2
bne $t1, $zero, odd
```

Explanation: A separate destination preserves x. Nonzero remainder handles both positive and negative odd inputs.

Key rule: Do not overwrite a value that remains live.

Common mistakes: Comparing remainder to 2 cannot detect parity; comparing only with +1 misses negative odds.

Checking criteria: For −5, keep `$t0=-5` and take the branch; for −4, do not take it.

### CP-040

Answer:

```mips
beq $t0, '+', increase
beq $t0, '-', decrease
beq $t0, 'q', quit
b   invalid
```
The character '1' has ASCII code 49, not numeric value 1.

Explanation: Compare encoded character values and define a fallback for every unmatched input.

Key rule: A register holds bits; their interpretation comes from the operation and specification.

Common mistakes: Missing the fallback allows accidental fall-through. Newline is a character unless explicitly skipped.

Checking criteria: Trace +, -, q, 1 and newline; exactly one handler is chosen. Each handler must avoid unintended fall-through afterward.

### CP-041

Answer:

B

Explanation: Flag the discrepancy and explicitly say which source the question traces, so its expected bytes are unambiguous.

Key rule: A source conflict needs an explicit basis for exact-output marking.

Incorrect options: A hides the discrepancy. C calls distinct strings identical. D changes unrelated arithmetic.

Checking criteria: Explain why the chosen option works and why each distractor fails.

### CP-042

Answer:

```sh
1521 fetch lab03
1521 mipsy practice.s < cases.txt
1521 autotest print_bigger
diff -s c.out mips.out
```
A separate give command submits, e.g. `give cs1521 lab03_print_bigger print_bigger.s` from the sheet.

Explanation: Fetching obtains files; redirection supplies repeatable input; autotest checks; diff compares; give submits.

Key rule: Testing and submission are separate operations.

Common mistakes: Passing autotests neither submits your file nor proves every case correct. `<` supplies input; `>` writes output.

Checking criteria: Explain which files each command reads or writes. These are the supplied course command patterns, not a claim they are locally installed.

### CP-043

Answer:

Use one rejected value followed by a valid one. Trace instruction/label, input, counter, bound, branch result and next label. Candidates: retry skips reading; continue skips update; back-edge resets initialisation; wrong branch direction or endpoint.

Explanation: If the decision is wrong for the recorded operands, inspect the comparison. If the decision is correct but unchanged values recur, inspect reads, updates and back-edges.

Key rule: Find the earliest divergence in state transitions.

Common mistakes: Changing many branches at once hides the cause. Testing only ordinary values does not isolate the rejected path.

Checking criteria: Show the exact instruction that prevents progress; remove diagnostic output before exact-output comparison.

### CP-044

Answer:

Only y_off = 0 is processed. Returning to `render_impacts__y_off_cond` would match the C loop.

Explanation: After incrementing to one, the branch exits instead of checking whether another row remains. C processes offsets 0, 1 and 2.

Key rule: A loop back-edge returns to the condition unless exit is intended.

Common mistakes: Comments or “provided” status do not establish semantic equivalence. Changing the height to one changes the reference behaviour.

Checking criteria: For an in-bounds 5×3 impact, compare five cell writes with the C’s fifteen. This diagnosis is not an instruction to alter provided assignment functions.

### CP-045

Answer:

```mips
.text
main:
    li   $v0, 5
    syscall
    move $t0, $v0
    li   $v0, 5
    syscall
    move $t1, $v0
    mul  $t2, $t1, 2
    add  $t2, $t0, $t2
    div  $t2, $t2, 3
    move $a0, $t2
    li   $v0, 1
    syscall
    li   $a0, '\n'
    li   $v0, 11
    syscall
    li   $v0, 0
    jr   $ra
```
For −8,2: numerator −4, quotient −1; output `-1\n`.

Explanation: Preserve each input, multiply before adding, divide last, and put the result into the print argument before selecting the syscall.

Key rule: Preserve lifetimes, arithmetic order and exact output.

Common mistakes: Dividing terms separately truncates at different points. Negative integer division is toward zero.

Checking criteria: (1,4) → `3\n`; (0,0) → `0\n`; (−8,2) → `-1\n`; (2,0) → `0\n`. No prompts or spaces.

### CP-046

Answer:

```mips
.text
main:
    li   $v0, 5
    syscall
    move $t0, $v0
    li   $v0, 5
    syscall
    move $t1, $v0
    li   $t2, 0
row_cond:
    bge  $t2, $t0, rectangle_done
    li   $t3, 0
col_cond:
    bge  $t3, $t1, row_newline
    li   $a0, '@'
    li   $v0, 11
    syscall
    add  $t3, $t3, 1
    b    col_cond
row_newline:
    li   $a0, '\n'
    li   $v0, 11
    syscall
    add  $t2, $t2, 1
    b    row_cond
rectangle_done:
    li   $v0, 0
    jr   $ra
```
(0,3): empty output. (2,0): two newlines. (2,3): `@@@\n@@@\n`.

Explanation: Save dimensions, reset columns each row and put the newline after the inner loop, including when it is empty.

Key rule: An empty inner loop does not make the outer loop empty.

Common mistakes: Printing newline only after a character loses zero-width rows. Resetting columns outside the outer loop loses later rows.

Checking criteria: Across all 25 dimension pairs: @ count = rows×columns; newline count = rows. Verify ordering as well.

### CP-047

Answer:

Simplified C:
```c
i=lo+1;
cond:
if (i>=hi) goto done;
if (i%3==0) goto step;
printf("%d\n", i);
step:
i++;
goto cond;
done: ;
```
MIPS:
```mips
.text
main:
    li   $v0, 5
    syscall
    move $t0, $v0
    li   $v0, 5
    syscall
    move $t1, $v0
    add  $t2, $t0, 1
range_cond:
    bge  $t2, $t1, range_done
    rem  $t3, $t2, 3
    beqz $t3, range_step
    move $a0, $t2
    li   $v0, 1
    syscall
    li   $a0, '\n'
    li   $v0, 11
    syscall
range_step:
    add  $t2, $t2, 1
    b    range_cond
range_done:
    li   $v0, 0
    jr   $ra
```
Map: `$t0=lo`, `$t1=hi`, `$t2=i`, `$t3=remainder`.

Explanation: At the condition, values from lo+1 up to but excluding i have each been considered once; exactly their nonmultiples of three have been printed. Every path advances i or exits. A zero remainder identifies negative multiples too.

Key rule: Combine exclusive bounds, a non-destructive predicate and a shared step.

Common mistakes: Starting at lo includes an endpoint. Skipping directly to the condition can freeze the loop. Zero is a multiple of three.

Checking criteria: (4,4),(4,5): empty. (−4,5): `-2\n-1\n1\n2\n4\n`. (−7,−2): −5 and −4 only. Explain why the invariant proves more than passing these samples.

### CP-048

Answer:

```mips
.data
none_message: .asciiz "none\n"
.text
main:
    li   $t0, 0
attempt_cond:
    bge  $t0, 4, no_success
    li   $v0, 5
    syscall
    move $t1, $v0
    add  $t0, $t0, 1
    blt  $t1, 1, attempt_cond
    bgt  $t1, 5, attempt_cond
    move $a0, $t1
    li   $v0, 1
    syscall
    li   $a0, '\n'
    li   $v0, 11
    syscall
    b    entry_done
no_success:
    la   $a0, none_message
    li   $v0, 4
    syscall
entry_done:
    li   $v0, 0
    jr   $ra
```

Explanation: At attempt_cond, `$t0` counts rejected values already read, from zero to four. Guard before reading prevents a fifth read. Validate each result before returning to that guard, so a fourth input can succeed.

Key rule: An attempt limit counts reads, including rejected ones.

Common mistakes: Counting only successes cannot enforce the limit. Checking the count before validating the fourth result wrongly discards it. Falling into no_success prints two answers.

Checking criteria: [1] → `1\n`, one read; [0,6,−2,5] → `5\n`, four reads; [0,6,−2,9,3] → `none\n`, four reads, leaving 3 unread. Adapt the limit to two and identify the exact change.

### CP-049

Answer:

Output 7,9,7 in that order. Read all n values; threshold=a[n-1]; scan i=0..n-1 and print a[i] if a[i]>=threshold.

Explanation: The threshold is not known until the final read. Preserve original order and include equality.

Key rule: The threshold is not known until the final read. Preserve original order and include equality.

Common mistakes: Sorting changes output order; comparing only > loses equal values.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-050

Answer:

```mips
move $t4,$a0
li $t0,0
filter_loop:
 bge $t0,$a1,filter_done
 mul $t1,$t0,4
 add $t1,$t1,$t4
 lw $t2,0($t1)
 blt $t2,$a2,filter_step
 move $a0,$t2
 li $v0,1
 syscall
 li $a0,10
 li $v0,11
 syscall
filter_step:
 add $t0,$t0,1
 b filter_loop
filter_done:
 jr $ra
```
This syscall-only leaf keeps the base in $t4; arbitrary helper calls would require additional preservation.

Explanation: Printing reuses $a0, so the array base cannot remain only in that argument register.

Key rule: Printing reuses $a0, so the array base cannot remain only in that argument register.

Common mistakes: Blindly using $a0 as both pointer and printed value breaks the second iteration.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-051

Answer:

flag=0; for(int i=1;i<n;i++) if(a[i]<a[i-1]) flag=1; Final flag 1; equality at 4,4 is allowed.

Explanation: Once any inversion is found, later ordered pairs cannot undo it.

Key rule: Once any inversion is found, later ordered pairs cannot undo it.

Common mistakes: Assigning flag=(a[i]<a[i-1]) each iteration incorrectly forgets earlier inversions.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-052

Answer:

[1,5,4,2], [1,4,5,2], [1,4,2,5]. Not sorted. Use tmp=a[i-1]; a[i-1]=a[i]; a[i]=tmp when a[i]<a[i-1].

Explanation: One pass carries the largest encountered value rightward but does not sort every earlier pair.

Key rule: One pass carries the largest encountered value rightward but does not sort every earlier pair.

Common mistakes: Overwriting a[i-1] before retaining it duplicates a value.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-053

Answer:

Store [8,0,3], count=3; output 3,0,8. while(count>0){count--; print(a[count]);} Immediate negative stores nothing and prints nothing.

Explanation: Count is the number of populated elements, not the last valid index.

Key rule: Count is the number of populated elements, not the last valid index.

Common mistakes: Reading a[count] before decrement accesses the unpopulated slot.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-054

Answer:

Accepted prefix [3,1,2,5]; stop after reading 5, leaving 9 unread. For each x: i=0; while(i<n_seen && a[i]!=x)i++; if(i==n_seen)a[n_seen++]=x.

Explanation: Only search the populated prefix; duplicates consume input but not a new slot.

Key rule: Only search the populated prefix; duplicates consume input but not a new slot.

Common mistakes: Searching full capacity reads uninitialised elements; incrementing on duplicates stops too early.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-055

Answer:

Integer offset=(4*9+7)*4=172=0xAC, address 0x10AC. Screen byte offset=3*60+8=188.

Explanation: Row-major offset is (row*declared_columns+column)*element_size.

Key rule: Row-major offset is (row*declared_columns+column)*element_size.

Common mistakes: Multiplying by row count or using screen[x][y] transposes the intended coordinates.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-056

Answer:

Print 2,3,5,7,11. At 2 mark 4,6,8,10; at 3 mark 6,9. Flags are bytes; sb changes one flag.

Explanation: Outer i starts at two, inner j starts at 2*i and advances by i while below the limit.

Key rule: Outer i starts at two, inner j starts at 2*i and advances by i while below the limit.

Common mistakes: sw corrupts neighbouring flags; replacing the algorithm may violate exact translation requirements.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-057

Answer:

C: for(int l=0,r=n-1;l<r;l++,r--){int t=a[l];a[l]=a[r];a[r]=t;}
MIPS core:
 li $t0,0
 add $t1,$a1,-1
rev_cond:
 bge $t0,$t1,rev_end
 mul $t2,$t0,4
 add $t2,$t2,$a0
 mul $t3,$t1,4
 add $t3,$t3,$a0
 lw $t4,0($t2)
 lw $t5,0($t3)
 sw $t5,0($t2)
 sw $t4,0($t3)
 add $t0,$t0,1
 add $t1,$t1,-1
 b rev_cond
rev_end:
 jr $ra

Explanation: The endpoints move inward; every swap preserves all values and finalises two positions.

Key rule: The endpoints move inward; every swap preserves all values and finalises two positions.

Common mistakes: Looping while l<=r is unnecessary; unsigned comparison on r=-1 can break the empty case.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-058

Answer:

push $ra
push $s0
move $s0,$a0
jal g
add $v0,$s0,$v0
pop $s0
pop $ra
jr $ra

Explanation: x is live across the call, so keep it in a preserved register and restore that register for the caller. jal overwrites ra.

Key rule: x is live across the call, so keep it in a preserved register and restore that register for the caller. jal overwrites ra.

Common mistakes: Keeping x in $t0 assumes g will preserve a caller-saved register.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-059

Answer:

Pop s1,s0,ra. Three four-byte pushes allocate twelve bytes; three matching pops restore the original sp.

Explanation: A stack is last-in-first-out; each saved value must return to its own register.

Key rule: A stack is last-in-first-out; each saved value must return to its own register.

Common mistakes: Balanced byte count alone does not guarantee the correct registers were restored.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-060

Answer:

int sum(int n){if(n==0)return 0;return n+sum(n-1);} Results return 0,1,3,6. Each non-base invocation preserves its original n and return address, plus any saved registers it modifies.

Explanation: Each invocation owns distinct state; the same physical register is reused by deeper calls.

Key rule: Each invocation owns distinct state; the same physical register is reused by deeper calls.

Common mistakes: A global scratch n cannot safely represent every active invocation.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-061

Answer:

Save value in a saved register/stack slot; call rand with 65535; add returned value to saved value; restore frame. rand(n) returns a residue below n, so 65535 is excluded.

Explanation: Arguments and temporary registers may be overwritten by a call; modulus defines an exclusive upper bound.

Key rule: Arguments and temporary registers may be overwritten by a call; modulus defines an exclusive upper bound.

Common mistakes: Calling rand again while checking a result changes the random sequence.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-062

Answer:

Value progresses 5→7→11→12. Preserve value, limit=3 and loop index across each add_rand.

Explanation: Call rand(100) once for the limit, then exactly limit calls to add_rand.

Key rule: Call rand(100) once for the limit, then exactly limit calls to add_rand.

Common mistakes: Recomputing the limit on each iteration changes both the loop and the random state.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-063

Answer:

Save value, call rand(value), then return saved_value-result. rand requires value>0. The provided seed mixes with OFFLINE_SEED using XOR; unsigned state multiplication/addition wraps to 32 bits before subsequent operations.

Explanation: Follow the supplied unsigned algorithm and call order rather than replacing it with a different generator.

Key rule: Follow the supplied unsigned algorithm and call order rather than replacing it with a different generator.

Common mistakes: Using signed overflow reasoning or remainder with zero is invalid.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-064

Answer:

Address=0x2000+3*8+4=0x201C. Compute index*8 first, add base, then field offset.

Explanation: Only the index is scaled; the base is already a byte address.

Key rule: Only the index is scaled; the base is already a byte address.

Common mistakes: (base+index)*8 multiplies the base and accesses unrelated memory.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-065

Answer:

li $t0,0
la $t1,students
find_loop:
 bge $t0,CLASS_SIZE,not_found
 lw $t2,0($t1)
 beq $t2,$a0,found
 add $t1,$t1,8
 add $t0,$t0,1
 b find_loop
found:
 move $v0,$t1
 jr $ra
not_found:
 li $v0,0
 jr $ra

Explanation: Return the record address so the caller can read or update its fields.

Key rule: Return the record address so the caller can read or update its fields.

Common mistakes: Returning the id value instead of its address makes later field access invalid.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-066

Answer:

Update: find id; if NULL print missing message and return before asking/storing mark; otherwise retain pointer, read new mark and store at offset4. Report: print id, tab, then ? for -1 or integer mark otherwise, newline. Zero prints 0.

Explanation: NULL is a pointer sentinel; UNKNOWN_MARK is a field-value sentinel.

Key rule: NULL is a pointer sentinel; UNKNOWN_MARK is a field-value sentinel.

Common mistakes: Treating every nonpositive mark as unknown misprints zero; dereferencing NULL is invalid.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-067

Answer:

main calls setup; ERROR returns 1 immediately, with no play. Otherwise call play and return0. play tests game_over before each do_something, then calls render_end_screen followed by display.

Explanation: A pre-test loop can execute zero turns; calls after the loop still occur.

Key rule: A pre-test loop can execute zero turns; calls after the loop still occur.

Common mistakes: Unconditionally calling play after setup failure uses invalid state.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-068

Answer:

Valid x=0..59,y=0..19. Test (-1,0),(0,-1),(60,0),(0,20) false and (0,0),(59,19) true. get_input prints the prompt address passed in a0, reads an integer and returns it in v0.

Explanation: Check lower and exclusive upper bounds; preserve return values when a later syscall reuses v0.

Key rule: Check lower and exclusive upper bounds; preserve return values when a later syscall reuses v0.

Common mistakes: Checking only x<WIDTH accepts negative x.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-069

Answer:

screen address=base+y*WIDTH+x, byte store. worms[i] base=worms+i*SIZEOF_WORM; load x,y and alive by named offsets. Every nonzero alive value is true. Clear every screen cell, then render only living worms.

Explanation: Storage order is row-major even if the C traverses x in the outer loop.

Key rule: Storage order is row-major even if the C traverses x in the outer loop.

Common mistakes: Using sw on the screen damages neighbouring characters; requiring alive==1 is narrower than C truthiness.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-070

Answer:

Two nonzero flags: false. Zero or one survivor: true. Aim23 clockwise wraps0; aim0 anticlockwise wraps23. Then render(TRUE), display.

Explanation: game_over counts living worms among nworms and returns count<=1; aim uses the specified direction comparison and wrap boundaries.

Key rule: game_over counts living worms among nworms and returns count<=1; aim uses the specified direction comparison and wrap boundaries.

Common mistakes: Counting MAX_WORMS instead of nworms can read inactive entries; clamping is not wraparound.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-071

Answer:

(4,6),(4,7),(4,8),(5,6),(5,7),(5,8), until the first collision. Return TRUE for any helper result !=-1; otherwise FALSE. Preserve rectangle limits and both counters across helper calls.

Explanation: Terrain index0 is a collision; nested-loop state is live across calls.

Key rule: Terrain index0 is a collision; nested-loop state is live across calls.

Common mistakes: Testing result!=0 confuses index0 and sentinel-1; failing to reset inner y misses a column.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-072

Answer:

Compute dx from LEFT versus other direction; reject newx outside bounds. If same-height cell is occupied, require y>0 and the cell at y-1 empty; otherwise return. On success update position, call let_worms_fall, render(TRUE), display. At y0 a blocked move cannot step up.

Explanation: Short-circuit y>0 avoids the upper-cell test when it cannot succeed; helper calls may modify global state.

Key rule: Short-circuit y>0 avoids the upper-cell test when it cannot succeed; helper calls may modify global state.

Common mistakes: Updating x before rejection changes failed-move behaviour; a collision index is not a Boolean.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-073

Answer:

For pos.y>=0, draw . for pointer equal to &aim_guide, otherwise X. Above screen, draw ^ at row0 only for non-guide projectile. For each trail point, call in_bounds before drawing .; skip invalid trail coordinates.

Explanation: Pointer identity compares addresses, not identical struct contents. Follow the C preconditions for the projectile x coordinate.

Key rule: Pointer identity compares addresses, not identical struct contents. Follow the C preconditions for the projectile x coordinate.

Common mistakes: Drawing a negative-y array element writes before the buffer; copying a guide struct does not make its address equal to &aim_guide.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-074

Answer:

init; render(FALSE), render_projectile, display, wait at least once; then move_projectile and repeat unless COLLIDED. Check impact capacity; append both x/y of projectile.pos and increment count once; render(FALSE),display; save active turn; let_worms_fall; call next_turn only if active_worm still equals saved turn; render(TRUE),display.

Explanation: The falling helper may already advance the active worm; duplicating that advance skips a player.

Key rule: The falling helper may already advance the active worm; duplicating that advance skips a player.

Common mistakes: A pre-test loop omits the first frame; copying only one word loses y; incrementing before capacity checking can overflow.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-075

Answer:

Clear screen. Scan living worms and stop at the first; reaching nworms selects NOONE wins text. Copy exactly10 bytes for Game Over! at row HEIGHT/2,column WIDTH/2-5 and12 bytes for selected message on the next row.

Explanation: Fixed-length screen copies are not C-string printing; lengths and padding affect display.

Key rule: Fixed-length screen copies are not C-string printing; lengths and padding affect display.

Common mistakes: Copying a terminator as an extra character changes the screen; indexing msg_for_worm after no survivor goes past the active range.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-076

Answer:

ESC[38;2;007;042;255mAESC[0m. For each nonnegative component below10 print two zeros, below100 print one zero, otherwise none; then print its decimal value. Retain all components while reusing syscall argument registers.

Explanation: %03d means a minimum width of three padded with zeros; escape and separator bytes are observable output.

Key rule: %03d means a minimum width of three padded with zeros; escape and separator bytes are observable output.

Common mistakes: Printing 7;42;255 lacks padding; calling a helper without preserving later components loses them.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-077

Answer:

Truncating division gives -123/10=-12; units become -4512; dy becomes -117 because67/10=6. To shift trail right, copy highest occupied source toward lower indices, then put old position at trail0.

Explanation: Integer truncation occurs at each division; reverse copying prevents overwriting sources still needed.

Key rule: Integer truncation occurs at each division; reverse copying prevents overwriting sources still needed.

Common mistakes: Using floating 6.7 changes physics; copying forward duplicates the first trail point.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-078

Answer:

An impact hole returns NO_TERRAIN before terrain lookup. Render background→terrain→impacts→optional guide→worms. Rejected placement retries the same logical slot, preserving random-call order. A local y loaded before increment remains the old value until explicitly reloaded.

Explanation: Order and snapshots are part of the reference semantics, not implementation details to freely reorder.

Key rule: Order and snapshots are part of the reference semantics, not implementation details to freely reorder.

Common mistakes: Testing death against a newly reloaded y can change which animation iteration kills a worm.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-079

Answer:

uint32_t changed=(value & ~(UINT32_C(1)<<4)) | (UINT32_C(1)<<7);
unsigned bit=(value>>n)&1u;
255→239;58→170.

Explanation: Clear with AND complemented mask, set with OR, normalise extracted bit by shifting and masking.

Key rule: Clear with AND complemented mask, set with OR, normalise extracted bit by shifting and masking.

Common mistakes: XOR toggles rather than sets; value&(1u<<n) returns a power of two, not necessarily1; shift32 is invalid.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-080

Answer:

Accumulate unsigned u=0; for16 chars: u=u*2+(s[i]-'0'); result = u>=32768 ? (int)u-65536 : (int)u; return result as int16_t. Here65533→-3. Range -32768..32767.

Explanation: The top bit contributes -32768 in signed two’s complement; arithmetic on the unsigned accumulator remains defined.

Key rule: The top bit contributes -32768 in signed two’s complement; arithmetic on the unsigned accumulator remains defined.

Common mistakes: Treating ASCII codes as0/1 or returning65533 as the signed meaning is wrong.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-081

Answer:

char *out=malloc(17); if(!out)return NULL; uint16_t u=(uint16_t)value; for(int i=0;i<16;i++)out[i]='0'+((u>>(15-i))&1u); out[16]='\0'; return out;
-2 → 1111111111111110. Caller frees the result.

Explanation: Convert to unsigned for bit extraction and allocate one extra byte for the terminator.

Key rule: Convert to unsigned for bit extraction and allocate one extra byte for the terminator.

Common mistakes: Returning a local array leaves a dangling pointer; allocating16 writes the terminator past the allocation.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-082

Answer:

Unpacked: ((x>>8)&0xFF)*10+(x&0xFF)=37. Packed: extract low nibbles successively and accumulate digit*decimal_weight; weights1,10,100,1000 produce3057.

Explanation: Unpacked digits occupy bytes; packed digits occupy four-bit nibbles. Place weights for the result are decimal.

Key rule: Unpacked digits occupy bytes; packed digits occupy four-bit nibbles. Place weights for the result are decimal.

Common mistakes: Multiplying by16 reconstructs the binary encoded number rather than its decimal digit meaning.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-083

Answer:

Result[0,0,0,1]. For i up to max lengths: s=ai+bi+carry; out[i]=s%10; carry=s/10; append final carry if nonzero. Allocate maxlen+1 digits.

Explanation: Carry flows from low to high decimal places.

Key rule: Carry flows from low to high decimal places.

Common mistakes: Dropping final carry turns999+1 into0; reading beyond the shorter operand must supply0 rather than memory garbage.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-084

Answer:

Digits: [0,0,0,1]-[1] → [9,9,9,0], normalised to[9,9,9]. For each place d=ai-bi-borrow; if d<0 add10 and set borrow1, else borrow0. Retain a single zero digit for zero.

Explanation: Borrow propagates through zeros; the source task assumes a nonnegative result.

Key rule: Borrow propagates through zeros; the source task assumes a nonnegative result.

Common mistakes: Removing all zero digits gives an invalid empty representation unless explicitly defined.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-085

Answer:

Allocate zeroed na+nb digits. For each i, carry0; for each j compute t=out[i+j]+a[i]*b[j]+carry; store t%10 and carry=t/10; propagate carry afterward. 27*34=918, digits[8,1,9].

Explanation: Existing partial products must be included and each cell normalised to0..9.

Key rule: Existing partial products must be included and each cell normalised to0..9.

Common mistakes: Overwriting out[i+j] discards earlier rows; na+nb-1 may be too short.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-086

Answer:

Read dividend digits high-to-low, remainder=remainder*10+digit; choose quotient digit0..9 such that q*divisor<=remainder<(q+1)*divisor; subtract q*divisor. 1234=102*12+10.

Explanation: Maintain remainder<divisor after each digit; quotient digits are bounded.

Key rule: Maintain remainder<divisor after each digit; quotient digits are bounded.

Common mistakes: Whole-number repeated subtraction can require enormous iterations; zero divisor has no valid quotient.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-087

Answer:

Check a+0=a, a+b=b+a, (a+b)-b=a, a*0=0,a*1=a; division a=q*b+r with0<=r<b. Test carry chains, borrow chains, unequal lengths and zero. Actual arbitrary-BCD struct fields and orientation were not uploaded; adapt practice algorithms to the real header before implementation.

Explanation: A correct mathematical method still needs the actual memory representation and permitted allocation API.

Key rule: A correct mathematical method still needs the actual memory representation and permitted allocation API.

Common mistakes: Inventing field names as supplied facts produces code that may not compile against the task.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-088

Answer:

Reserve4096 bytes aligned for words; read until sentinel, checking capacity before each store; print start message; save loader ra; call instruction-buffer address indirectly using jalr; restore ra; print finish message. Input code returns via jr ra.

Explanation: Instructions are stored words, but execution transfers control to their address.

Key rule: Instructions are stored words, but execution transfers control to their address.

Common mistakes: Storing sentinel as an instruction or losing the loader return address breaks execution. Executable-data behaviour is simulator-specific.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-089

Answer:

Cannot reconstruct its exact algorithm from sample output. Map register roles; identify syscalls and loop edges; infer element sizes from offsets; translate branches; compare varied input traces. A loop loading bytes at base+i and counting equality with ASCII1 counts characters, not integer-array elements.

Explanation: Reverse engineering requires instruction evidence and tests that distinguish hypotheses.

Key rule: Reverse engineering requires instruction evidence and tests that distinguish hypotheses.

Common mistakes: A visually matching sample output does not establish the general algorithm.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-090

Answer:

Place a at lowest argument address, then b then c. Allocate argument space before stores and release it after return. Use only permitted registers zero,v0,a0,ra,sp,fp, with the specified single a1 use; no push/pop/begin/end. Preserve sp/fp and save live caller-saved state explicitly.

Explanation: This is a special task convention, not the ordinary a0-a3 interface. Exact frame offsets depend on missing starter/prologue code.

Key rule: This is a special task convention, not the ordinary a0-a3 interface. Exact frame offsets depend on missing starter/prologue code.

Common mistakes: Writing below unallocated sp can be overwritten by a callee; assuming ordinary argument registers violates the challenge.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-091

Answer:

jalr $t0 performs the indirect call. The wrapper must preserve its own ra and any object/name/result state needed across lookup/call. Resolve the requested method by name before invoking its address with the expected object argument.

Explanation: A method pointer is an address of code; object data and function address are distinct.

Key rule: A method pointer is an address of code; object data and function address are distinct.

Common mistakes: Using jal with a register name is not the intended indirect call; missing implementation files mean the original object layout cannot be assumed.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-092

Answer:

Original=[10,20,30,40]. Observed positions correspond to original indices[2,0,3,1]; invert that mapping. Use unsigned byte loads and stores into the recovered positions.

Explanation: Recover the permutation from the known marker and apply the inverse to the unknown bytes; memory order must be stated separately from numeric display.

Key rule: Recover the permutation from the known marker and apply the inverse to the unknown bytes; memory order must be stated separately from numeric display.

Common mistakes: Applying the forward permutation again is not generally its inverse; assuming every scrambling is byte reversal misses other permutations.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-093

Answer:

move $t0,$a0
node_loop:
 beqz $t0,node_end
 lw $t1,0($t0)
 beq $t1,$a1,node_end
 lw $t0,4($t0)
 b node_loop
node_end:
 move $v0,$t0
 jr $ra

Explanation: Nodes need not be contiguous; load next rather than adding a stride. Assume an acyclic valid list.

Key rule: Nodes need not be contiguous; load next rather than adding a stride. Assume an acyclic valid list.

Common mistakes: Adding8 walks imaginary contiguous nodes; loading value before checking NULL dereferences an invalid pointer.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-094

Answer:

Prepend: new->next=head; head=new. Delete: track prev=NULL and cur=head; find target; if absent return unchanged; if prev isNULL head=cur->next else prev->next=cur->next; then free(cur), returning the possibly changed head.

Explanation: Relink before freeing, and retain the new head for the caller.

Key rule: Relink before freeing, and retain the new head for the caller.

Common mistakes: Reading cur->next after freeing is use-after-free; treating head deletion like an interior node dereferences NULL prev.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-095

Answer:

C: int count=0;for(int i=0;i<n;i++)if(a[i].score!=-1 && a[i].score>=limit)count++;return count;
MIPS core: keep base,n,limit and index; address=base+8*i; lw score,4(address); skip -1 then skip score<limit; increment count. Return count in v0. Leaf solution needs no saved-register changes; any calling version must preserve live state.

Explanation: Combines populated arrays, field offsets, sentinel distinction and a reduction invariant: count equals qualifying records in processed prefix.

Key rule: Combines populated arrays, field offsets, sentinel distinction and a reduction invariant: count equals qualifying records in processed prefix.

Common mistakes: Treating -1 as a valid score for negative thresholds violates the unknown-score rule.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-096

Answer:

for(int dy=0;dy<h;dy++)for(int dx=0;dx<w;dx++){int px=x+dx,py=y+dy;if(px>=0&&px<8&&py>=0&&py<5)board[py][px]='#';} Six cells: x0..2,y3..4. MIPS uses byte offset py*8+px and sb after bounds checks.

Explanation: The rectangle coordinate system and physical array coordinate system are distinct; clipping precedes storage.

Key rule: The rectangle coordinate system and physical array coordinate system are distinct; clipping precedes storage.

Common mistakes: Clamping the starting coordinate without adjusting extent paints a different rectangle.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-097

Answer:

Accumulate u=u*2+(ch-'0'); then packed=0,shift=0; do{packed|=(u%10)<<shift;u/=10;shift+=4;}while(u); Input42 becomes packed0x42. Sixteen unsigned bits max65535 require at most5 nibbles.

Explanation: Binary place value during parsing and decimal extraction before nibble packing are separate operations.

Key rule: Binary place value during parsing and decimal extraction before nibble packing are separate operations.

Common mistakes: Copying the binary bit pattern directly into the packed result produces hexadecimal digits, not decimal BCD.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

### CP-098

Answer:

Save ra,s0,s1. read_value→s0; pass s0 to transform→s1; pass s0,s1 to log_result; move s1 to v0; restore s1,s0,ra and return. Test helpers deliberately overwrite t and a registers and return distinctive values.

Explanation: Both the original input and transformed result remain live across later calls.

Key rule: Both the original input and transformed result remain live across later calls.

Common mistakes: A wrapper that works only because the current logger happens to preserve t0 violates the calling contract.

Checking criteria: Test the stated example, an empty or smallest valid case, equality/boundary cases and the largest permitted case. Explain why each memory access is valid. For MIPS, also verify saved registers and stack restoration.

## Independence checklist

For every task in the coverage table:

- [ ] I can explain its input/output contract and assumptions.
- [ ] I can derive addresses and bounds without copying an example.
- [ ] I can write the implementation from a blank page.
- [ ] I can explain loop invariants and termination.
- [ ] I can preserve values correctly across calls.
- [ ] I can test normal, empty, equality, boundary and capacity cases.
- [ ] I can diagnose a deliberately broken variation.
- [ ] I can solve a fresh variation and explain why it works.

For a failed attempt record the mistaken assumption, a counterexample and a later reattempt. Missing-starter challenges require comparison with the real starter before claiming original-task completion. Completion of this workbook is evidence to assess, not a guarantee of mastery.
