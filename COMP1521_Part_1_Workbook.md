COMP1521 mastery quizzes — Part 1 of 10
Coverage map
All nine supplied files were reviewed before planning this path. This is the first study part, not the completed whole-course question bank. The number of questions in later parts will follow their learning objectives rather than an arbitrary cap. The Student Helper companion contains this part’s multiple-choice questions in your requested import format. Use this workbook for the full range of practical exercises and separated answers.
Part	Topics and related work	Skills to demonstrate independently	Status
1	Notes §§1–38; Week 3 minimum/not13/square foundations; Week 4 not_negative; Worms input/bounds/loop foundations	Registers, memory, directives, syscalls, arithmetic, conditions, loop translation, exact output and debugging	Delivered here
2	print_bigger, unordered, swap_numbers, reverse_negative, different10, lookup, sieve; notes §§39–43	Array addressing, populated prefixes, filtering, flags, adjacent comparisons/swaps, reverse traversal, duplicates, 2D stride and byte flags	Planned
3	Notes §§44–62; Week 4 mathematics and CMS	Calls, liveness, stack frames, recursion, seeded random call order, structs, pointers, sentinels and calling conventions	Planned
4	Worms subsets 0–1: main, in_bounds, get_input, play, render_background, game_over, aim, render_worms	Whole-function translation, globals, struct arrays, screen indexing, nonzero truth, wraparound and function tests	Planned
5	Worms subsets 2–3: overlaps_with_terrain, move, render_projectile, fire, render_end_screen, print_rgb; provided helpers	Geometry, short-circuit calls, state changes, pointer identity, trails, do-while, capacity, copies, rendering and exact formatting	Planned
6	Week 5 set_bits, get_nth_bit, sixteen_in, sixteen_out	Unsigned masks, bit numbering, shifts, two’s complement, parsing, allocation, ownership and terminators	Planned
7	Week 5 bcd, packed_bcd, bcd_add, bcd_arithmetic	Byte/nibble digits, place weights, arbitrary-length carry/borrow, multiplication/division and normalisation	Planned
8	dynamic_load, unmips, Monster MIPS, Polymipsism, NUXI; notes §§64–79	Instruction buffers, indirect calls, reverse engineering, special stack rules, method dispatch, byte permutations and endianness	Planned; starter-dependent details limited by missing files
9	Cumulative task-sized practice across Weeks 3–5 and Worms	Combine arrays, calls, records, state, bits and strings; detect interaction failures and build meaningful tests	Planned
10	Mixed unfamiliar mastery assessment	Produce, explain, adapt and debug solutions at the original tasks’ difficulty; complete-course independence checklist	Planned


Detailed task-to-skill map
- Week 3 tests: minimum requires signed comparisons and equality handling; not13 requires exclusive endpoints and a skip path that still advances; square requires two counters, inner reset and one newline per row.
- Week 3 ordinary labs: print_bigger preserves the final input before a second scan using >=; unordered compares neighbours, allows equality and retains a detected inversion; swap_numbers uses a temporary for each swap and performs one forward pass, not a full sort.
- Week 4 tests: not_negative retries negative values and accepts zero; reverse_negative checks the sentinel before storage and decrements before reverse loading; different10 searches the populated prefix and advances only for a new value.
- Week 4 lookup/sieve: lookup uses the declared 24-column row stride; sieve uses byte flags, starts outer i at 2 and each crossing-out loop at 2*i, and preserves the specified algorithm rather than substituting another sieve.
- Week 4 mathematics: seed_rand/rand/add_rand/sub_rand/seq_rand require argument and loop-state preservation across calls, unsigned random-state arithmetic, the correct number/order of random calls and a positive modulus. The original functions and calls are part of the requirements.
- Week 4 CMS: find_student_by_id/update_student_mark/print_report require the two-int record layout, pointer returns, NULL checks, mark stores and UNKNOWN_MARK formatting. Preserve supplied signatures, data and individually tested calling conventions.
- Worms representation: the supplied 32-bit layouts give point size 8, terrain size 16, worm size 16 and projectile size 68. The screen is char[20][60]. Address structs, fields and pointer-array entries correctly using named offsets; distinguish active counts from maximum capacities.
- Worms provided helpers: understand aim tables/quadrant reversal; integer fixed-point movement, division and gravity; backward trail copies; impact holes checked before terrain; rendering order; seeded random retries; turn cycling; changed globals versus old local snapshots during falling; strength clamping; command dispatch and newline skipping.
- Worms later subsets: overlap is a nested scan with early return; move combines horizontal bounds and step-up tests; projectile rendering uses pointer identity and above-screen cases; fire combines a do-while frame loop, impact capacity, struct copy, postincrement and possible turn changes; end-screen text uses fixed-length copies; print_rgb needs exact escape bytes and three-digit zero padding.
- Week 5 conversions: masks preserve unrelated bits; get_nth_bit must return 0 or 1; sixteen_in reads exactly sixteen ASCII bits into a signed result; sixteen_out allocates room for sixteen characters and a terminator. Respect each task’s permitted-library-function list.
- Week 5 BCD: bcd stores one digit per byte; packed_bcd stores one per nibble. Arbitrary-length work requires carry, borrow, product accumulation, quotient/remainder reasoning, allocation and normalisation. Exact missing starter layouts must not be invented as though supplied.
- Advanced challenges: dynamic_load needs bounded storage, a sentinel and a preserved return path; unmips requires instruction-level evidence rather than guesses from output; Monster MIPS has restricted registers, stack arguments, caller cleanup and no push/pop/begin/end; Polymipsism requires named-method lookup and function-pointer calls; NUXI recovers a shared byte permutation using a known marker.
- Workflow: simplify C; make a register map; identify values live across calls; preserve call order and observable side effects; run repeatable input, autotests and output comparisons; test empty, equal, boundary, duplicate and capacity cases; distinguish tests from submission.
Source audit and limitations
Reviewed files:
1. Pasted text(3).txt: 80-section notes, including diagrams, code examples and the partial unmips discussion.
2. COMP1521 26T3 — Week 03 Laboratory Exercises(3).pdf: 9 pages.
3. COMP1521 26T3 — Week 03 Weekly Test Questions(1).pdf: 4 pages.
4. COMP1521 26T3 — Week 04 Laboratory Exercises(1).pdf: 15 pages.
5. COMP1521 26T3 — Week 04 Weekly Test Questions(1).pdf: 5 pages.
6. COMP1521 26T3 — Week 05 Laboratory Exercises(1).pdf: 10 pages.
7. COMP1521 26T3 — Assignment 1_ Worms in MIPS(1).pdf: 7 pages.
8. worms(1).c: reference program, including helper implementations.
9. worms(2).s: constants, data, 14 empty assignment-function stubs and provided helper implementations.
All uploaded files were readable. Referenced external lecture slides, the assignment video, downloadable starter bundles and interactive “click to toggle” content were not supplied and are not claimed as reviewed. In particular, the actual unmips.s, dynamic_load.s, Monster MIPS code, Polymipsism support files and arbitrary-length BCD struct/header are missing. The assignment’s worms.simple.c, example input.txt and make fragment were not uploaded. Ordinary lab/test starters were not supplied separately; the task descriptions and visible code excerpts were reviewed. The notes’ partial unmips guess is not a reliable substitute for the missing program.

The supplied Worms assembly is a starter, not a completed student solution. No assignment source was edited. Practice uses fresh examples, with source-specific reading exercises where the supplied details matter.
Corrections and assumptions to keep visible
- Negative remainder: “odd means remainder 1” needs a nonnegative-input assumption. Signed negative odd inputs may have remainder −1; use != 0. This is labelled additional explanation.
- Byte extension and storage prerequisites: signed/unsigned byte extension, alignment, newline capacity and short-circuit safety receive explicitly labelled additional explanation beyond the notes’ simplified treatment.
- Provided-code discrepancy: the uploaded MIPS render_impacts row step branches to the row-loop end instead of its condition. With a fully in-bounds impact, it writes one row while the C visits three. P1-044 diagnoses this without editing provided code. The C is the intended-behaviour reference for that question.
- Other ambiguities: different10’s transcript includes a colon absent from its displayed C output. The Week 5 bit diagram labels a position “32” where descending 32-bit indices should show 30 after 31; its examples establish zero-based bit indices 4 and 7. Exact-output questions specify the source they follow.
- Execution limits: the reference arithmetic and expected outputs were checked with executable calculations. MIPS solutions were manually traced and checked, but a mipsy executable was not available here; these are not claimed as simulator-tested.
How to study this part
Attempt each block before opening the answer section. For code, first make a register map and predict a boundary case. Record confidence separately from correctness. A guessed MCQ is not evidence of understanding until you can explain the answer and reject the distractors.

Suggested sessions: P1-001–011 memory; P1-012–017 input/arithmetic; P1-018–026 conditions/state; P1-027–040 loops and implementation; P1-041–046 testing/cumulative work; P1-047–048 closed-notes assessment. The MCQ import supplements rather than replaces practical work.

Assume course mipsy syntax and pseudoinstructions, 32-bit registers, four-byte ints/pointers and one-byte chars. Comparisons are signed unless stated. Part 1 arithmetic does not overflow. Input consists of valid tokens under each question’s stated guarantees. Use the course execution model without delayed-branch modelling. Snippets are independent; labels may repeat between solutions. Sample mains have no helper calls: later parts teach preservation across jal, so do not generalise temporary-register use here to arbitrary calls. Escaped output such as 2\n denotes a digit followed by a newline, not a literal backslash and n.

The learning stages are distributed across blocks: recall and understanding establish concepts; application and debugging test their use; transfer and integration combine them in new tasks. Difficulty is not a time limit. No quiz score guarantees mastery.
Part 1 — Questions
Registers and memory
P1-001 · Foundation · Recall
Question: Match $zero, $t0, $s0, $a0, $v0, $sp, $fp, $ra to their roles. Explain a register versus a memory location.
P1-002 · Foundation · Understanding
Question: Given value: .word 37, which instruction puts the ADDRESS of value in $t0?

Answer choices:

A. li $t0, 37

B. la $t0, value

C. lw $t0, value

D. move $t0, $t1
P1-003 · Foundation · Application
Question: Initially score: .word 12. Give final $t1, $t2 and the word at score.
la   $t0, score
lw   $t1, 0($t0)
add  $t1, $t1, 5
lw   $t2, 0($t0)
sw   $t1, 0($t0)
P1-004 · Foundation · Recall
Question: Give directives for (a) instructions, (b) data, (c) integers 2, 4, 6, (d) 28 reserved bytes, (e) one character Q, (f) a 16-bit value 9. How much storage does (c) use?
P1-005 · Foundation · Understanding
Question: How many bytes does .asciiz "cat\n" occupy?

Answer choices:

A. 3

B. 4

C. 5

D. 6
P1-006 · Developing · Application
Question: Additional explanation: the next free address is 0x1001. What does .align 2 do in this assembler, and where does a following word begin?
P1-007 · Foundation · Application
Question: Choose instructions and transfer directions for reading a signed byte, writing a byte, reading a 32-bit integer and writing a 32-bit integer.
P1-008 · Developing · Transfer
Question: Additional explanation: memory at $t0 contains byte 0xFE. What signed decimal register values result from lb $t1, 0($t0) and lbu $t2, 0($t0)?

Answer choices:

A. 254 and 254

B. −2 and 254

C. 254 and −2

D. −2 and −2
P1-009 · Developing · Application
Question: An int array starts at 0x2000 and a separate char array starts at 0x3000. Find the addresses of element 5 in each and the appropriate loads (signed characters).
P1-010 · Developing · Debugging
Question: $t0 is a valid index into int numbers[]; $t3 is the new value. Repair both errors.
la  $t2, numbers
add $t2, $t2, $t0
lw  $t3, 0($t2)
P1-011 · Developing · Understanding
Question: Trace int x=6; int *p=&x; int y=*p; *p=19;. What are x and y afterward? If $t0=p, what does lw $t1, 0($t0) do?
I/O and arithmetic
P1-012 · Foundation · Recall
Question: State syscall numbers and argument/result registers for print integer, print string, read integer, print character, read character and read string in mipsy.
P1-013 · Developing · Debugging
Question: Input is 23. What is printed, and how do you fix it?
li   $v0, 5
syscall
li   $v0, 1
move $a0, $v0
syscall
P1-014 · Foundation · Understanding
Question: Which sequence prints exactly one newline?

Answer choices:

A. li $v0, 1; li $a0, 10; syscall

B. li $v0, 4; li $a0, 10; syscall

C. li $v0, 11; li $a0, '1'; syscall

D. li $v0, 11; li $a0, 10; syscall
P1-015 · Developing · Transfer
Question: Additional explanation: how many bytes hold 12 content characters plus a zero terminator? How many if a retained newline must also fit? Why is char buf[12] insufficient?
P1-016 · Developing · Application
Question: Assume no overflow. What is $t2 at the end?
li  $t0, 8
li  $t1, 13
add $t2, $t0, $t1
div $t2, $t2, 2
Answer choices:

A. 10.5

B. 10

C. 11

D. 21
P1-017 · Developing · Transfer
Question: Additional explanation: signed division truncates toward zero. Find −7 / 2, −7 % 2 and −8 % 2. Give even and odd tests valid for negative inputs too.
Branches and state
P1-018 · Developing · Application
Question: Translate if (x <= 9) { y = y + 3; } into labelled simplified C and MIPS with $t0=x, $t1=y. Branch to skip the body. Assume no overflow.
P1-019 · Foundation · Recall
Question: Write the opposite relation and corresponding branch for ==, !=, <, <=, > and >=. Keep operand order unchanged.
P1-020 · Foundation · Understanding
Question: Translate the literal statement if (x > limit) goto too_large;, with x in $t0 and limit in $t1.

Answer choices:

A. bgt $t0, $t1, too_large

B. bge $t0, $t1, too_large

C. ble $t0, $t1, too_large

D. bgt $t1, $t0, too_large
P1-021 · Developing · Application
Question: To execute a body only for 3 <= x && x < 8, which pair skips to done for invalid x? x is $t0.

Answer choices:

A. ble $t0, 3, done then bge $t0, 8, done

B. blt $t0, 3, done then bgt $t0, 8, done

C. blt $t0, 3, done then bge $t0, 8, done

D. ble $t0, 3, done then bgt $t0, 8, done
P1-022 · Developing · Application
Question: Write branches to outside exactly when x < -2 || x > 4; otherwise go to inside. x is $t0.
P1-023 · Developing · Debugging
Question: Additional explanation: why is evaluating 12 / x before testing x != 0 && 12 / x > 2 unsafe? Give a correct evaluation order and results for x = 0, 3, 6.
P1-024 · Developing · Understanding
Question: A helper returns −1 for no match and indices 0, 1, 2 for matches. Which test recognises a match?

Answer choices:

A. result != 0

B. result > 0

C. result == 1

D. result != -1
P1-025 · Developing · Application
Question: A fresh power setting is clamped to [0,6] after each change. Starting at 2, apply −5, +10, −1 in order. Give results and pseudocode.
P1-026 · Developing · Transfer
Question: A dial has positions 0 through 5. Clockwise adds one; anticlockwise subtracts one; going beyond either endpoint wraps to the other. From 0, perform anticlockwise, clockwise, clockwise. Why is (position - 1) % 6 insufficient at zero in signed C?
Loops
P1-027 · Developing · Application
Question: For for (int i=4; i<15; i+=3), list body values and the counter value at the final failed test. Ignore its out-of-loop scope for this tracing question.
P1-028 · Developing · Understanding
Question: With i initially 7, how many bodies execute in while (i<3) { i++; } and, independently resetting i to 7, do { i++; } while (i<3);?

Answer choices:

A. 0 and 1

B. 0 and 0

C. 1 and 1

D. 1 and 0
P1-029 · Developing · Application
Question: Fill the blanks for summing i = 1 through 4 inclusive. Give final total and i.
li  $t0, ___
li  $t1, 0
cond:
___ $t0, 4, end
add $t1, $t1, $t0
add $t0, $t0, ___
b   ___
end:
P1-030 · Developing · Debugging
Question: This should sum 1 through 4 except 2. Repair it.
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
P1-031 · Developing · Understanding
Question: What are total and i afterward?
int total=0, i=1;
while (i<=5) {
    if (i==4) break;
    total += i;
    i++;
}
Answer choices:

A. total = 10, i = 4

B. total = 6, i = 4

C. total = 6, i = 5

D. total = 15, i = 6
P1-032 · Developing · Application
Question: List visited (row,col) pairs for for (row=0; row<3; row++) containing for (col=0; col<=row; col++). Give the count.
P1-033 · Developing · Debugging
Question: Why are only three cells printed, rather than six? Repair the initialisation.
int col=0;
for (int row=0; row<2; row++) {
    while (col<3) {
        /* print one cell */
        col++;
    }
}
P1-034 · Developing · Application
Question: Give the exact output, including newlines. What changes if the newline moves into the inner body?
for (int row=0; row<2; row++) {
    for (int col=0; col<3; col++) putchar('+');
    putchar('\n');
}
P1-035 · Developing · Transfer
Question: A fresh input loop stops at any negative integer and sums earlier values. Input: 4, 0, 7, −2, 9. Give the sum, number of reads and pseudocode excluding the sentinel.
P1-036 · Challenging · Implementation
Question: Write complete mipsy main code that reads until an integer belongs to [2,6], then prints it and one newline. No prompts or other output. Assume valid integer input eventually supplies an accepted value; use no helper calls.
Branches and state
P1-037 · Challenging · Implementation
Question: Write a leaf function inside_box for a fresh 7-column, 3-row board: x in $a0, y in $a1; return exactly 1 for 0<=x<7 && 0<=y<3, otherwise 0. Do not change saved registers.
P1-038 · Developing · Implementation
Question: Write leaf function larger returning the larger signed integer from $a0,$a1 in $v0. Include equal-input and two-negative-input tests.
I/O and arithmetic
P1-039 · Developing · Debugging
Question: You still need x after testing parity, but x is in $t0 and you wrote rem $t0, $t0, 2. Repair it and branch to odd for every signed odd x.
Branches and state
P1-040 · Challenging · Transfer
Question: Dispatch a character in $t0: + to increase, - to decrease, q to quit, all others to invalid. Explain why integer 1 differs from character 1.
Testing and source reading
P1-041 · Developing · Understanding
Question: A displayed C program prints Result 9\n, but a transcript shows Result: 9\n. How should an exact-output quiz handle this?

Answer choices:

A. Silently assume the transcript is always authoritative

B. Flag the discrepancy and specify the source being traced

C. Treat both outputs as byte-for-byte identical

D. Change the arithmetic to remove the discrepancy
P1-042 · Foundation · Application
Question: Give course commands to fetch Week 3 files, run practice.s with cases.txt as input, run print_bigger autotests, and compare c.out with mips.out. Which separate action submits work? Do not submit anything.
P1-043 · Challenging · Debugging
Question: A translation loops forever only after a rejected input. Describe a smallest useful test, a trace table and at least three candidate mistakes. Distinguish a bad comparison from missing progress.
P1-044 · Challenging · Debugging
Question: The uploaded provided MIPS contains:
render_impacts__y_off_step:
    add $s1, $s1, 1
    b   render_impacts__y_off_end
The C reference loops y_off from 0 while y_off < IMPACT_HEIGHT (3). For one fully in-bounds impact, what rows does this branch permit? Which target would match C? Read only; do not edit the supplied file.
Cumulative practice
P1-045 · Challenging · Integration
Question: Write complete mipsy main: read signed a,b, print (a+2*b)/3 then newline, no prompts. Assume intermediates fit signed 32 bits. No helper calls. Explain a = −8, b = 2.
P1-046 · Challenging · Integration
Question: Write complete mipsy main: read rows and columns, each guaranteed in [0,4]. Print columns @ characters plus newline for each row, no prompts. Explain (0,3),(2,0),(2,3).
Part 1 mastery assessment
P1-047 · Challenging · Transfer + integration
Question: Closed notes: read lo,hi with −20<=lo<=hi<=20. Print every integer strictly between them except multiples of three, increasing, one per line, no prompts. Write simplified C, complete mipsy main, a register map and an invariant. Test equal bounds, adjacent bounds and a range crossing zero.
P1-048 · Challenging · Transfer + integration
Question: Closed notes: read at most four integers. Accept the first in [1,5], print it plus newline, and stop reading. If all four are rejected, print none plus newline. No prompts. Write complete mipsy main, state an invariant and test fourth-attempt success and an unread fifth value.
Part 1 — Answers and explanations
Attempt the questions before reading further. These are valid example solutions; equivalent solutions must meet the same specification and conventions.
P1-001
Answer:

Zero constant; temporary; callee-saved register; first ordinary argument; return value / syscall selector or result; stack pointer; frame pointer; return address, respectively.

Explain: Registers are CPU storage named in instructions. Memory consists of addressed bytes. A register can contain an integer or an address; holding an address does not automatically read its contents.

Key rule: Track both the location of a value and what its bits represent.

Common mistakes: Saved registers are not automatically saved by hardware. A function changing one must restore it. $v0 is not permanent storage for a result.

Check your solution: Name all eight roles and explain why a pointer in $t0 differs from the word at that address.
P1-002
Answer:

B

Explain: la gives the location of the labelled object, not its stored integer.

Key rule: li = immediate; la = address; lw = word read from memory.

Why other options are wrong: A loads 37. C reads the stored 37. D copies an unspecified register.
P1-003
Answer:

17, 12 and 17, respectively.

Explain: The addition changes only $t1. The second load still reads 12 because the store has not happened yet. Only the final instruction changes memory.

Key rule: A load copies a value; register arithmetic does not implicitly store it.

Common mistakes: Making $t2 equal 17 assumes a store that has not happened.

Check your solution: Record memory after each instruction: 12, 12, 12, 12, 17.
P1-004
Answer:

.text; .data; .word 2, 4, 6; .space 28; .byte 'Q'; .half 9. The three words use 12 bytes.

Explain: A word occupies four bytes; three words therefore occupy 3 × 4 bytes. Directives describe assembly layout rather than runtime actions.

Key rule: .space counts bytes, not array elements.

Common mistakes: .space 7 is insufficient for seven four-byte integers.

Check your solution: Explain how to reserve seven words without assuming initial values.
P1-005
Answer:

C

Explain: Three letters + one newline + one terminating zero = five bytes.

Key rule: An escaped newline is one byte here; .asciiz adds one zero byte.

Why other options are wrong: A counts only letters. B omits the terminator. D counts backslash and n as separate stored characters.
P1-006
Answer:

It aligns to a multiple of 2² = 4 bytes; the word starts at 0x1004.

Explain: 0x1001, 0x1002 and 0x1003 are not multiples of four. Padding brings the next object to the required boundary.

Key rule: The alignment operand is an exponent in this course assembler.

Common mistakes: Two-byte alignment confuses the exponent with the boundary. Do not assume a preceding character array ends on a word boundary.

Check your solution: Verify the resulting address modulo four is zero.
P1-007
Answer:

lb: memory → register; sb: register → memory; lw: memory → register; sw: register → memory.

Explain: Select load/store by direction, then byte/word by object size. A byte load still produces a full register value.

Key rule: L = load, S = store, B = one byte, W = four bytes.

Common mistakes: Using sw for one character may overwrite three neighbouring bytes.

Check your solution: Explain why sb writes the source register’s low eight bits.
P1-008
Answer:

B

Explain: lb sign-extends to 0xFFFFFFFE (−2); lbu zero-extends to 0x000000FE (254).

Key rule: The byte is identical; extension determines the full register value.

Why other options are wrong: A makes both unsigned. C reverses the rules. D makes both signed.
P1-009
Answer:

Integer: 0x2014 with lw. Character: 0x3005 with lb.

Explain: The integer offset is 5 × 4 = 20 decimal = 0x14. The character offset is five bytes.

Key rule: Address = base + index × element size.

Common mistakes: Twenty decimal is not hexadecimal 0x20. Multiplying a char index by four skips characters.

Check your solution: Index zero must give the base; adjacent integer addresses differ by four.
P1-010
Answer:
mul $t1, $t0, 4
la  $t2, numbers
add $t2, $t2, $t1
sw  $t3, 0($t2)
Explain: Scale the index by four, then store. The original also overwrites the proposed new value by loading into its register.

Key rule: Correct address calculation and correct transfer direction are separate requirements.

Common mistakes: Fixing only the instruction still uses the wrong address; fixing only the offset still reads instead of writes.

Check your solution: For index 2 and value 91, only the word eight bytes after the base should become 91.
P1-011
Answer:

x = 19, y = 6. The load reads *p into $t1.

Explain: The pointer identifies x. The earlier read copied 6 into y; changing x through p does not change that independent copy.

Key rule: Distinguish a pointer from the value obtained by dereferencing it.

Common mistakes: Changing y to 19 treats a copied integer as a live reference.

Check your solution: Draw p pointing to x and y in its own box.
P1-012
Answer:

1: integer in $a0; 4: string address in $a0; 5: result in $v0; 11: character code in $a0; 12: result in $v0; 8: buffer address $a0, capacity $a1. Put the service number in $v0 before syscall.

Explain: Each operation has its own interface: printing a character takes a code, printing a string takes an address.

Key rule: Know the service and its register contract together.

Common mistakes: Read-integer returns in $v0, not $a0. A string pointer is not the string’s first character.

Check your solution: Give separate setups for printing integer 25 and the string at label prompt.
P1-013
Answer:

It prints 1. Preserve the read before changing $v0:
li   $v0, 5
syscall
move $t0, $v0
li   $v0, 1
move $a0, $t0
syscall
Explain: Selecting service 1 overwrites the input result. The original then copies the service number into the print argument.

Key rule: Preserve a result before reusing its register.

Common mistakes: Moving $v0 after selecting another service is too late.

Check your solution: Inputs −4, 0 and 23 must each be echoed exactly; this snippet adds no newline.
P1-014
Answer:

D

Explain: Service 11 prints the character with code 10, which is newline.

Key rule: Printing a code as an integer differs from printing its character.

Why other options are wrong: A prints digits 10. B treats address 10 as a string pointer. C prints the digit 1.
P1-015
Answer:

13 bytes without the newline, 14 with it.

Explain: Count each stored character and the terminator. A bounded line read may truncate rather than keep the full line when capacity is insufficient.

Key rule: Capacity includes the terminating zero; account separately for a retained newline.

Common mistakes: Twelve bytes leaves no terminator slot after twelve content characters. Do not assume every input API strips newline.

Check your solution: Number the positions for twelve letters, newline and zero; identify the last valid index.
P1-016
Answer:

B

Explain: The sum is 21. Integer division by two gives 10, discarding the fractional part.

Key rule: Integer division returns an integer.

Why other options are wrong: A uses floating-point division. C rounds instead of truncating. D ignores the division.
P1-017
Answer:

−3, −1 and 0. Even: x % 2 == 0. Odd: x % 2 != 0.

Explain: Use x = quotient × divisor + remainder: −7 = (−3) × 2 + (−1). Multiples have zero remainder regardless of sign.

Key rule: Odd means nonzero remainder, not necessarily +1.

Common mistakes: The notes’ “odd → 1” shortcut needs nonnegative inputs. Floor division would give −4, not the required truncation.

Check your solution: Test −7, −8, 0, 7 and 8; retain x if later code needs it.
P1-018
Answer:

Simplified C: if (x > 9) goto done; y += 3; done: ;
bgt $t0, 9, done
add $t1, $t1, 3
done:
Explain: x > 9 is precisely the complement of x <= 9, so only those values skip the body.

Key rule: Invert a condition when branching to the skipped-body path.

Common mistakes: bge incorrectly excludes x = 9.

Check your solution: With y = 2, x = 8, 9, 10 must produce y = 5, 5, 2.
P1-019
Answer:

== → != / bne; != → == / beq; < → >= / bge; <= → > / bgt; > → <= / ble; >= → < / blt.

Explain: The opposite must cover every case excluded by the original, including equality when needed.

Key rule: Negating strict inequality makes non-strict inequality, and vice versa.

Common mistakes: The opposite of < is not >: that omits equality.

Check your solution: For equal operands, exactly one relation in every original/opposite pair must be true.
P1-020
Answer:

A

Explain: The specified destination is reached when x is greater than limit, so branch directly on that relation.

Key rule: The branch destination determines whether to use the condition or its opposite.

Why other options are wrong: B includes equality incorrectly. C reverses the condition. D swaps the operands and tests limit > x.
P1-021
Answer:

C

Explain: Reject x < 3 or x >= 8; the remaining integers are 3 through 7.

Key rule: For AND, leave when either required condition fails.

Why other options are wrong: A wrongly excludes 3. B wrongly includes 8. D wrongly excludes 3 and includes 8.
P1-022
Answer:
blt $t0, -2, outside
bgt $t0, 4, outside
b   inside
Explain: Either true comparison is sufficient. If neither succeeds, x belongs to the closed interval [−2,4].

Key rule: For OR, one true operand establishes the true result.

Common mistakes: Requiring both conditions makes the outside case impossible. Endpoints belong inside.

Check your solution: Test −3, −2, 0, 4, 5: outside, inside, inside, inside, outside.
P1-023
Answer:

First reject x = 0; only then divide and compare. Results: false, true, false.

Explain: C skips the right side of && when the left is false. Eager division would divide by zero. With x = 3 the quotient is 4; with x = 6 it is 2.

Key rule: Short-circuit order can protect an invalid operation.

Common mistakes: Calculating both operands and combining the results later is not equivalent when operations can fail or have side effects.

Check your solution: The zero-input path must reach false without performing division.
P1-024
Answer:

D

Explain: Any value other than −1 is a valid index, including zero.

Key rule: Compare with the specified sentinel rather than generic truthiness.

Why other options are wrong: A rejects index 0 and accepts −1. B rejects index 0. C recognises only index 1.
P1-025
Answer:

0, 6, 5. power += change; if (power < 0) power = 0; if (power > 6) power = 6;.

Explain: 2−5 goes below zero; 0+10 exceeds six; 6−1 remains in range.

Key rule: Clamping stops at an endpoint and occurs at the specified step.

Common mistakes: Combining all changes before clamping changes the process. Wraparound is a different operation.

Check your solution: Test zero change, both endpoints and overshoots in both directions.
P1-026
Answer:

5, 0, 1. At zero the expression gives −1, not 5.

Explain: Apply the wrap after each single step. C’s remainder for −1 divided by 6 is negative, so explicit negative-boundary handling is needed.

Key rule: Signed remainder does not automatically normalise to a nonnegative range.

Common mistakes: Clamping would keep the first result at zero. These endpoint rules describe single steps, not arbitrary jumps.

Check your solution: Trace both directions from both endpoints.
P1-027
Answer:

Body: 4, 7, 10, 13. Failed test: i = 16.

Explain: Initialise once, test before the body and add three afterward. Sixteen fails the bound.

Key rule: The final counter need not equal the bound.

Common mistakes: Including 16 ignores the test; claiming final i = 13 ignores the last update.

Check your solution: Write all five condition checks, including the failed one.
P1-028
Answer:

A

Explain: The while fails before its first body; the do-while first increments to 8, then fails.

Key rule: A do-while tests after the body; a while tests before it.

Why other options are wrong: B makes both pre-test loops. C makes both post-test loops. D reverses the rules.
P1-029
Answer:

1, bgt, 1, cond. Total = 10; i = 5.

Explain: Allow i = 4, so exit only above four. Running totals are 1, 3, 6, 10.

Key rule: Keep initialisation, condition, body and step distinct.

Common mistakes: bge omits four. Jumping back to initialisation resets progress.

Check your solution: Trace every check, including i = 5.
P1-030
Answer:

Change the equality branch target to step. The total is 8.

Explain: At i = 2 the original returns to the test without changing i, so it never progresses. The skip path must execute the update.

Key rule: A translated for-loop continue normally targets the step.

Common mistakes: Removing the comparison adds the excluded value. Updating only on the normal path leaves the skipped path stuck.

Check your solution: Show that i becomes 3 after the skipped iteration.
P1-031
Answer:

B

Explain: Only 1, 2 and 3 are added. At four, break exits before addition and increment.

Key rule: Break exits the loop immediately.

Why other options are wrong: A adds the break value. C increments after break. D ignores break.
P1-032
Answer:

(0,0), (1,0), (1,1), (2,0), (2,1), (2,2): six visits.

Explain: Reset col each row. Rows have one, two and three visits respectively.

Key rule: Inner bounds determine the shape of nested iteration.

Common mistakes: 3×3 assumes a constant width. Starting at col = 1 omits the zero column.

Check your solution: Generalise the count for n rows as 1+2+…+n.
P1-033
Answer:

Move col=0 inside the outer body before the inner while.

Explain: After row zero, col is three. Without resetting it, the next inner loop is already finished.

Key rule: Initialise an inner counter once per outer iteration.

Common mistakes: Resetting inside the inner body can prevent termination.

Check your solution: Both rows must start with col = 0 and each execute three inner bodies.
P1-034
Answer:

Original: +++\n+++\n. Changed: +\n repeated six times.

Explain: The original newline runs once per row; the moved newline runs once per cell.

Key rule: Output placement is part of loop semantics.

Common mistakes: Ignoring whitespace can hide a difference that exact-output testing detects.

Check your solution: Count six plus signs in both versions, but two versus six newlines.
P1-035
Answer:

Sum 11, four reads. sum=0; while (true) { read x; if (x<0) break; sum+=x; }.

Explain: Read and add 4, 0 and 7. Read −2 to detect termination, but do not add it. Leave 9 unprocessed.

Key rule: Test the sentinel before treating it as data.

Common mistakes: Stopping at zero confuses negative with nonpositive. Adding before testing includes the sentinel.

Check your solution: A first value of −1 must yield sum zero after one read.
P1-036
Answer:
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
Explain: Both invalid cases go back to a fresh read. Falling through establishes both inclusive bounds, so print once and return.

Key rule: Every rejected-input retry must obtain a new value.

Common mistakes: ble/bge reject endpoints. Returning to the comparisons without rereading can loop forever.

Check your solution: −1,0,7,2 → 2\n; 6 → 6\n. This is a syscall-only leaf main, not a template for nested helper calls.
P1-037
Answer:
inside_box:
    li   $v0, 0
    bltz $a0, box_done
    bge  $a0, 7, box_done
    bltz $a1, box_done
    bge  $a1, 3, box_done
    li   $v0, 1
box_done:
    jr   $ra
Explain: Default to false; reject each failed requirement; set true only after every check passes. No nested calls or saved-register changes require a stack frame here.

Key rule: Dimensions are exclusive upper bounds for zero-based coordinates.

Common mistakes: Accepting x = 7 or y = 3 is out of bounds. Checking only upper limits accepts negatives.

Check your solution: Accept (0,0),(6,2); reject (−1,0),(7,0),(0,−1),(0,3). Preserve $sp, $ra and $s registers.
P1-038
Answer:
larger:
    move $v0, $a0
    bge  $a0, $a1, larger_done
    move $v0, $a1
larger_done:
    jr   $ra
(5,5) → 5; (−8,−3) → −3.

Explain: Keep the first value when it is at least the second; otherwise replace it. Equality may return either copy.

Key rule: Use signed comparisons for signed ordering.

Common mistakes: Returning zero for two negatives invents a candidate. Unsigned comparison does not implement general signed ordering.

Check your solution: Also test (2,9),(9,2),(−1,0). Return the value, not an address.
P1-039
Answer:
rem $t1, $t0, 2
bne $t1, $zero, odd
Explain: A separate destination preserves x. Nonzero remainder handles both positive and negative odd inputs.

Key rule: Do not overwrite a value that remains live.

Common mistakes: Comparing remainder to 2 cannot detect parity; comparing only with +1 misses negative odds.

Check your solution: For −5, keep $t0=-5 and take the branch; for −4, do not take it.
P1-040
Answer:
beq $t0, '+', increase
beq $t0, '-', decrease
beq $t0, 'q', quit
b   invalid
The character '1' has ASCII code 49, not numeric value 1.

Explain: Compare encoded character values and define a fallback for every unmatched input.

Key rule: A register holds bits; their interpretation comes from the operation and specification.

Common mistakes: Missing the fallback allows accidental fall-through. Newline is a character unless explicitly skipped.

Check your solution: Trace +, -, q, 1 and newline; exactly one handler is chosen. Each handler must avoid unintended fall-through afterward.
P1-041
Answer:

B

Explain: Flag the discrepancy and explicitly say which source the question traces, so its expected bytes are unambiguous.

Key rule: A source conflict needs an explicit basis for exact-output marking.

Why other options are wrong: A hides the discrepancy. C calls distinct strings identical. D changes unrelated arithmetic.
P1-042
Answer:
1521 fetch lab03
1521 mipsy practice.s < cases.txt
1521 autotest print_bigger
diff -s c.out mips.out
A separate give command submits, e.g. give cs1521 lab03_print_bigger print_bigger.s from the sheet.

Explain: Fetching obtains files; redirection supplies repeatable input; autotest checks; diff compares; give submits.

Key rule: Testing and submission are separate operations.

Common mistakes: Passing autotests neither submits your file nor proves every case correct. < supplies input; > writes output.

Check your solution: Explain which files each command reads or writes. These are the supplied course command patterns, not a claim they are locally installed.
P1-043
Answer:

Use one rejected value followed by a valid one. Trace instruction/label, input, counter, bound, branch result and next label. Candidates: retry skips reading; continue skips update; back-edge resets initialisation; wrong branch direction or endpoint.

Explain: If the decision is wrong for the recorded operands, inspect the comparison. If the decision is correct but unchanged values recur, inspect reads, updates and back-edges.

Key rule: Find the earliest divergence in state transitions.

Common mistakes: Changing many branches at once hides the cause. Testing only ordinary values does not isolate the rejected path.

Check your solution: Show the exact instruction that prevents progress; remove diagnostic output before exact-output comparison.
P1-044
Answer:

Only y_off = 0 is processed. Returning to render_impacts__y_off_cond would match the C loop.

Explain: After incrementing to one, the branch exits instead of checking whether another row remains. C processes offsets 0, 1 and 2.

Key rule: A loop back-edge returns to the condition unless exit is intended.

Common mistakes: Comments or “provided” status do not establish semantic equivalence. Changing the height to one changes the reference behaviour.

Check your solution: For an in-bounds 5×3 impact, compare five cell writes with the C’s fifteen. This diagnosis is not an instruction to alter provided assignment functions.
P1-045
Answer:
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
For −8,2: numerator −4, quotient −1; output -1\n.

Explain: Preserve each input, multiply before adding, divide last, and put the result into the print argument before selecting the syscall.

Key rule: Preserve lifetimes, arithmetic order and exact output.

Common mistakes: Dividing terms separately truncates at different points. Negative integer division is toward zero.

Check your solution: (1,4) → 3\n; (0,0) → 0\n; (−8,2) → -1\n; (2,0) → 0\n. No prompts or spaces.
P1-046
Answer:
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
(0,3): empty output. (2,0): two newlines. (2,3): @@@\n@@@\n.

Explain: Save dimensions, reset columns each row and put the newline after the inner loop, including when it is empty.

Key rule: An empty inner loop does not make the outer loop empty.

Common mistakes: Printing newline only after a character loses zero-width rows. Resetting columns outside the outer loop loses later rows.

Check your solution: Across all 25 dimension pairs: @ count = rows×columns; newline count = rows. Verify ordering as well.
P1-047
Answer:

Simplified C:
i=lo+1;
cond:
if (i>=hi) goto done;
if (i%3==0) goto step;
printf("%d\n", i);
step:
i++;
goto cond;
done: ;
MIPS:
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
Map: $t0=lo, $t1=hi, $t2=i, $t3=remainder.

Explain: At the condition, values from lo+1 up to but excluding i have each been considered once; exactly their nonmultiples of three have been printed. Every path advances i or exits. A zero remainder identifies negative multiples too.

Key rule: Combine exclusive bounds, a non-destructive predicate and a shared step.

Common mistakes: Starting at lo includes an endpoint. Skipping directly to the condition can freeze the loop. Zero is a multiple of three.

Check your solution: (4,4),(4,5): empty. (−4,5): -2\n-1\n1\n2\n4\n. (−7,−2): −5 and −4 only. Explain why the invariant proves more than passing these samples.
P1-048
Answer:
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
Explain: At attempt_cond, $t0 counts rejected values already read, from zero to four. Guard before reading prevents a fifth read. Validate each result before returning to that guard, so a fourth input can succeed.

Key rule: An attempt limit counts reads, including rejected ones.

Common mistakes: Counting only successes cannot enforce the limit. Checking the count before validating the fourth result wrongly discards it. Falling into no_success prints two answers.

Check your solution: [1] → 1\n, one read; [0,6,−2,5] → 5\n, four reads; [0,6,−2,9,3] → none\n, four reads, leaving 3 unread. Adapt the limit to two and identify the exact change.
Part 1 — Independence checklist
- [ ] Explain immediate values, addresses, loads, stores and copied values without relying on a mnemonic alone.
- [ ] Choose byte/word access, calculate offsets and explain sign versus zero extension.
- [ ] Count string storage, terminators and newline bytes; explain alignment.
- [ ] Use the syscall interfaces and preserve results before reusing registers.
- [ ] Trace signed division and remainder, including negative inputs.
- [ ] Translate direct and opposite branches without losing equality cases.
- [ ] Implement short-circuit paths, distinguish sentinels from truthiness, and explain clamp versus wrap.
- [ ] Trace while, do-while and nested loops, including break and continue.
- [ ] Write correct leaf functions and syscall-only mains from fresh specifications.
- [ ] Handle empty loops, endpoints, rejected input and the final permitted attempt.
- [ ] Compare exact output, state a loop invariant and identify the first divergent state in a bug.
- [ ] Solve P1-047 and P1-048 from a blank page, explain them, and adapt their bounds or predicates without copying the key.
For each gap, record the question ID, mistaken assumption, corrected explanation, a new counterexample and a later closed-notes reattempt. After a fix, rerun earlier cases too. Copying an answer is not yet independent performance.

Covered: Part 1 foundations, 48 questions and separate worked answers, including a local mastery check. Remaining: Parts 2–10 in the coverage map. The final whole-course mixed assessment and complete-course checklist belong to Part 10; they have not been delivered yet. Next is Part 2: arrays, filtering, adjacent swaps, reverse traversal, distinct inputs, 2D indexing and sieve.