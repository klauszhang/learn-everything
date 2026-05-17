# Research dossier — Pattern matching algorithms

**Status:** research-only. Drives a future Part II chapter (pairs with /data-search and /indexing-strategies).
**Date:** 2026-05-17.
**Audience:** see GOAL.md — daily Claude/ChatGPT user, no CS-algorithms background, has used grep / Ctrl+F / find / regex in editors.

---

## 1. Plain-language premise (~250 words)

You press Ctrl+F, type "frobnicate," and 200,000 lines of code scroll by in an instant — the word highlights in yellow before you've even lifted your finger. You run `ripgrep "TODO" .` on a ten-million-line codebase and results appear in under a second. You type "fhe" into a fuzzy file picker and "fooHelper.ts" appears at the top. You write a regex and your editor immediately tells you which of fifty log lines match.

None of this is magic. Each of those behaviors comes from a specific algorithm — one of six or eight families, each making a different tradeoff between speed, flexibility, and the kinds of patterns it can handle.

This chapter explains those families at intuition level. No proofs. No big-O derivations. Just the mental model: what does the algorithm do at each step, why is that clever, and when does it show up in a tool you actually use?

The organizing question is: **what does the algorithm do when it encounters a mismatch?** The naive approach says "go back one step and try again." KMP says "jump to the furthest safe restart point." Boyer-Moore says "jump past multiple characters based on what you just saw." Rabin-Karp says "hash the window and move it by one." Aho-Corasick says "I'm running all patterns at once so I never need to restart at all." Regex NFAs say "I'm tracking all possible match states in parallel." Each one is a different answer to that single question.

The chapter pairs with `/indexing-strategies` (pattern matching is the algorithm; indexes are the data structure) and `/data-search` (how databases combine these ideas with storage layout).

**Suggested reading order for the audience.** Not all readers need the whole chapter. A suggested "fast path" through the sections:


1. Section 2 (naive) — understand the baseline.
2. Section 4 (Boyer-Moore) — understand why GNU grep is fast without being exotic.
3. Section 7 (regex families) — understand the NFA vs. backtracking split. This is the section most directly relevant to daily Claude Code use.
4. Section 9.3 (ripgrep SIMD) — understand why ripgrep is fast.
5. Section 8.4 (fzf scoring) — understand why fuzzy finders do not use edit distance.

Readers who want the full picture can read sections 3, 5, 6, 8.1–8.3 in any order after the fast path. Sections 3 and 6 (KMP and Aho-Corasick) are pedagogically satisfying but less immediately actionable for the target audience.

---

## 2. The naive baseline

The simplest possible approach: for every starting position in the text, check if the pattern matches there.

**Tiny example** — searching for pattern `ABC` in text `XABCABC`:

```
Text:    X A B C A B C
         ^ try position 0: X ≠ A → fail, move to position 1
           ^ try position 1: A=A, B=B, C=C → MATCH at position 1
```

In pseudocode (5 lines):

```
for i in 0 .. text.length - pattern.length:
    if text[i .. i+pattern.length] == pattern:
        return i   # found at position i
return -1          # not found
```

**What goes wrong in the worst case.** If both the text and pattern are almost the same repeated character — pattern `AAAB` in text `AAAAAAAAAAAB` — then at every position the naive approach gets three characters in before it fails. It backs up and starts over. For a pattern of length M in a text of length N, this worst case is M comparisons per position × N positions = N×M total comparisons. For a 1,000-character pattern in a 1,000,000-character text, that is one billion comparisons in the worst case.

**Why it is usually fine anyway.** On natural language text (English words, source code), mismatches happen fast — typically on the first or second character — so the inner loop exits early. Studies of random English text find the naive algorithm's average case is effectively O(N). Ctrl+F in a five-page document doesn't need anything smarter.

**Use this as the reference point.** Every algorithm in the next sections buys something specific over the naive baseline. Hold this mental model: naive = "restart at the next position every time." The alternatives all find smarter places to restart.

---

## 3. Knuth-Morris-Pratt — preprocess once, never re-scan

**The insight.** When the naive algorithm fails at position i+k (it matched k characters, then hit a mismatch), it throws away everything it just learned about those k characters and starts over. KMP says: wait — those matched characters encode information about where a valid restart can happen. We can use that information to skip ahead.

**How it works: the failure table.** Before searching, KMP builds a table from the pattern alone — one entry per position. Each entry says: "if matching fails at this position, how far back is the furthest safe restart?" The table is built by asking, for each prefix of the pattern: what is the longest proper prefix of this prefix that is also a suffix of it?

**Worked tiny example.** Pattern: `ABABC`.

| Position | Char | Failure value | Why |
|---|---|---|---|
| 0 | A | 0 | no prefix shorter than "A" that is also a suffix |
| 1 | B | 0 | "AB" has no proper prefix that is also a suffix |
| 2 | A | 1 | "ABA" — "A" is both a prefix and suffix; length 1 |
| 3 | B | 2 | "ABAB" — "AB" is both prefix and suffix; length 2 |
| 4 | C | 0 | "ABABC" — no prefix-suffix overlap |

Now search text `ABABABC`:

```
Text:    A B A B A B C
Pattern: A B A B C
                 ^ fail at position 4 (A≠C)
failure[4] = 0, but failure[3] = 2 → jump pattern to position 2
Pattern:     A B A B C        (shifted, reusing the matched "AB")
                     ^ match!
```

Without the table the naive approach would back up to text position 1 and retry the whole pattern. KMP instead "jumps" the pattern forward two positions — reusing the fact that the characters it already matched contain a valid restart.

**Practical reality.** Linear time is guaranteed — the algorithm never re-scans the text backwards. But the constant factor is not especially good: updating the failure table and handling the indirection adds overhead per character. On random English text or typical source code, the naive approach (which rarely looks at more than two characters before mismatch) is often faster in practice. KMP is the textbook linear-time champion; it appears less frequently in production tools than people expect.

**Where it actually shows up.** KMP is used in constrained or streaming contexts: embedded systems, network packet processors that cannot afford to buffer text, and as the conceptual core underneath Aho-Corasick (Section 6). Many production tools use Boyer-Moore instead (Section 4).

*Source: Wikipedia KMP article, fetched 2026-05-17.*

**A note on "linear time" in practice.** KMP's O(n+m) guarantee means the total number of character comparisons is bounded by a linear function of the text and pattern length. It does NOT mean "KMP is always faster than naive." On random ASCII text where mismatches happen on the first character, the naive algorithm's inner loop rarely runs more than one iteration — giving it near-linear behavior with a smaller constant than KMP. KMP's advantage is most visible when: (a) the pattern has many repeated sub-patterns (like DNA sequence `ATATAT…`), (b) the text contains many near-matches, or (c) streaming is required and the algorithm cannot buffer or restart.

---

## 4. Boyer-Moore — scan right-to-left, skip multiple chars

**The insight.** Start matching from the right end of the pattern, not the left. This is counterintuitive but powerful: if the last character of the pattern does not appear in the text at all, you can skip a full pattern-length in one shot. On a 20-character pattern, that means you look at one character and jump 20 ahead. For long patterns, you examine far fewer characters than even the O(N) baseline implies.

**Two heuristics, both running simultaneously.**

**Bad-character rule.** When you hit a mismatch at some position in the pattern, look at the character in the text that caused the mismatch. If that character does not appear anywhere in the pattern, shift the entire pattern past it. If it does appear, align the rightmost occurrence of that character in the pattern with the mismatch position in the text.

**Good-suffix rule.** When you hit a mismatch but the rightmost part of the pattern already matched, look for the next occurrence of that suffix earlier in the pattern. Shift so that occurrence lines up with the matched portion in the text. If no occurrence exists, shift the entire pattern past the matched portion.

**Worked tiny example.** Pattern: `EXAMPLE` (7 chars, 0-indexed). Text: `HERE IS A SIMPLE EXAMPLE`.

```
Step 1: Align pattern at position 0 of text.
Text:    H E R E   I S   A   S I M P L E   E X A M P L E
Pattern: E X A M P L E
                       ^ Compare from the RIGHT: text[6]='S', pattern[6]='E'. Mismatch.
         Bad-character: 'S' does not appear in EXAMPLE. Shift entire pattern past the 'S'.

Step 2: Align pattern starting at position 7.
Text:    H E R E   I S   A   S I M P L E   E X A M P L E
Pattern:               E X A M P L E
                                     ^ text[13]='L', pattern[6]='E'. Mismatch.
         Bad-character: 'L' appears at index 5 in EXAMPLE. Align that 'L' with text 'L'.
         This is a shift of 1 position.

Step 3: Align pattern starting at position 8.
Text:    H E R E   I S   A   S I M P L E   E X A M P L E
Pattern:                 E X A M P L E
                                       ^ Compare from the right: E=E, L=L, P=P, M=M,
                                         A=A, X=X, E=E → MATCH at position 17!
```

So Boyer-Moore needed 3 alignment attempts (vs. up to 17 for naive). The benefit grows with pattern length and alphabet size.

In practice, on English text with a long pattern, Boyer-Moore examines roughly 1/4 or fewer of the text characters (the "sublinear in practice" claim from the Wikipedia article). The longer the pattern and the larger the alphabet, the larger the skips.

**GNU grep's choice.** GNU grep uses a Boyer-Moore variant as its primary algorithm for literal patterns. *Source: Wikipedia Boyer-Moore article, fetched 2026-05-17.* On random printable-ASCII text with typical-length patterns, this is what makes `grep` fast. Note: GNU grep's actual implementation also uses various heuristics to fall back to simpler approaches for short patterns — the Boyer-Moore path is most effective when the pattern is long enough to justify its preprocessing cost.

**Unicode caveat.** The bad-character table is indexed by character value. For ASCII (256 values) this is trivial — the table has 256 entries. For full Unicode (1.1 million code points), a flat table would require millions of entries. Production tools handle this in one of three ways:
- Work at byte level (the UTF-8 encoding), treating each byte as an ASCII character. Fast, but character-class regexes behave unexpectedly.
- Build a hash table or compact representation for the bad-character lookup.
- Fall back to a different algorithm entirely for Unicode input.

`grep` (GNU) works at byte level by default on multibyte text. ripgrep handles Unicode correctly by building UTF-8 decoding into its DFA. This is an underappreciated difference in behavior between the two tools on non-ASCII text. *(Inference from Gallant blog post; not independently verified for the current GNU grep version.)*

---

## 5. Rabin-Karp — rolling hash

**The insight.** Instead of comparing characters one by one, treat the current window of text as a number (a hash). Slide the window by one character: add the new character on the right, subtract the character that fell off the left. If the hash matches the pattern's hash, do a character-by-character check to confirm (hashes can collide). Otherwise, just move on. The cheap test is a hash comparison (one operation); the expensive test only happens on collisions.

**Tiny rolling-hash example.** A simplified illustration (not a production hash — just to show the "slide" idea):

```
Pattern: "CAT"     Pattern hash: C+A+T = 3+1+20 = 24  (using A=1, B=2, C=3, …)
Text:    "ABCATDOG"

Window position 0: A+B+C = 1+2+3 = 6   ≠ 24 → no check
Slide: drop A (−1), add A = 6−1+1 = 6  ≠ 24 → no check    [window "BCA"]
Slide: drop B (−2), add T = 6−2+20 = 24 = 24 → POSSIBLE MATCH
        Verify: text[2..4] = "CAT" = pattern → CONFIRMED MATCH at position 2
```

The "slide" is one subtraction and one addition — constant cost regardless of pattern length.

**Why rolling hash is fast.** Each slide of the window costs a constant number of arithmetic operations regardless of window size. A window of 100 characters costs the same per step as a window of 5 characters. This is the algorithmic insight: you get a per-position check that is independent of pattern length.

**What can go wrong.** Hash collisions. If many windows hash to the same value as the pattern, you fall back to character-by-character verification often — and in adversarial cases (text and pattern carefully constructed to collide) you get O(N×M) behavior. In practice, polynomial rolling hashes (multiply by a prime base, take modulo a large prime) make collisions rare on natural text.

**What can go wrong.** Hash collisions. If many windows hash to the same value as the pattern, you fall back to character-by-character verification often — and in adversarial cases (text and pattern carefully constructed to collide) you get O(N×M) behavior. In practice, polynomial rolling hashes (multiply by a prime base, take modulo a large prime) make collisions rare on natural text. The standard choice: hash(s) = (s[0] × p^(m-1) + s[1] × p^(m-2) + … + s[m-1]) mod q, where p is a small prime (often 31 or 37) and q is a large prime.

**Where Rabin-Karp shines.**

- **Multiple patterns simultaneously.** If you are searching for K patterns simultaneously, you can hash each pattern once, then check every window's hash against all K pattern hashes. When a hash matches, verify character-by-character. Total cost is O(N×K) hash comparisons, but since hash comparisons are O(1) and verification is rare, this is much cheaper than K separate Boyer-Moore passes. This is why plagiarism-detection systems use it: searching for 10,000 known suspicious phrases in a document.
- **Streaming and overlapping windows.** Document fingerprinting (the Winnowing algorithm, used by Stanford's MOSS plagiarism detection system) is built on the rolling-hash idea: take the minimum hash in every k-gram window as a document's "fingerprint." Rabin-Karp provides the rolling hash engine.
- **Substring hashing in competitive programming.** The rolling hash technique appears frequently in algorithmic problem-solving as a building block for more complex string algorithms.

**What Rabin-Karp gives up.** It is not as fast as Boyer-Moore on single patterns in practice. It requires arithmetic (multiplication, modulo) on each character, which is slower than a simple table lookup. It shines in the batch / multi-pattern case; for a single pattern, prefer Boyer-Moore.

*Source: Wikipedia Rabin-Karp article (textbook claim); not directly verified against a primary source beyond Wikipedia in this session.*

---

## 6. Aho-Corasick — match many patterns at once

**The premise.** You have not one pattern but thousands: a list of banned words, a set of malware signatures, a dictionary of brand names to highlight. Running each through Boyer-Moore or KMP separately would mean scanning the text thousands of times. Aho-Corasick scans the text exactly once and finds all matches.

**How it works.** Build a trie (prefix tree) from all patterns. Then add "failure links" between trie nodes — borrowed directly from KMP's failure table, generalized to a branching tree. The resulting structure is a finite automaton: at each character of the text, you take one step in the automaton, updating a single state pointer. When that state pointer lands on a node that is the end of a pattern, you have a match. Move on by one character and repeat. The text is never re-scanned.

**Tiny trie example.** Patterns: `HE`, `SHE`, `HIS`, `HERS`. After building the trie:

```
        root
       /    \
      H      S
     /|\      \
    E I A      H
    *  S  R     \
       *   S     E
           *     *
```

Nodes marked `*` are pattern endpoints. The failure links (not shown) wire each node back to the longest suffix of the current path that is also a prefix of some other pattern. With those links, the automaton moves through `USHERS` and, without ever backtracking, reports: `SHE` (at position 2), `HE` (at position 3), `HERS` (at position 2–5). One forward pass through the text, all matches found.

**Relationship to KMP.** KMP is Aho-Corasick with a single-branch trie (a linear chain). Aho-Corasick is "KMP for a whole dictionary at once." *Source: Wikipedia Aho-Corasick article, fetched 2026-05-17.*

**Time complexity.** Linear in the combined length of all input text and all patterns, plus the number of matches found. Whether you have 10 patterns or 10,000 patterns, the text is scanned once. The preprocessing (building the automaton) scales with total pattern length.

**Real-world uses.** Wikipedia notes: "The original paper by Alfred V. Aho and Margaret J. Corasick formed the basis of the original Unix command fgrep." Modern uses include:
- Network intrusion detection systems. Aho-Corasick is widely cited in academic literature as the algorithm used by Snort and similar IDS tools for multi-pattern signature matching. *(Could not verify against current Snort documentation in this session — Wikipedia Snort article does not name the algorithm; treat as a widely-repeated textbook claim.)*
- Ad-blocking and content filtering (matching thousands of blocked domains or strings simultaneously).
- Search result highlighting (underline all occurrences of any of the user's query terms across a page).

**The `aho-corasick` Rust crate.** Andrew Gallant (the ripgrep author, also known as BurntSushi) maintains the canonical Rust implementation. It includes SIMD-accelerated prefilters, multiple match semantics (leftmost-first, leftmost-longest), and stream search. It disables prefilters automatically when pattern count exceeds ~100, because at high counts the prefilter overhead exceeds its benefit. *Source: docs.rs/aho-corasick, fetched 2026-05-17.*

---

## 7. Regex engines — two families, very different shapes

This section matters most for everyday users. The word "regex" covers two fundamentally different kinds of engines that look identical from the outside (you type a pattern, you get matches) but have completely different performance profiles and capability sets.

### 7.1 NFA-based: Thompson construction and RE2

**The idea.** A regular expression can be compiled into a Nondeterministic Finite Automaton (NFA) — a graph of states, where the arrows between states are labeled by characters or character classes. Running the NFA against text means starting at the initial state and following arrows. "Nondeterministic" means there can be multiple possible next states at each step (think of it as multiple parallel threads of execution, not random choices).

Thompson's construction (Ken Thompson's 1968 paper) showed how to do this efficiently: simulate all possible states in parallel. At each character of the input, compute the set of states reachable from the current set. Never backtrack. The text is consumed left to right, once, and at the end either some state in the current set is an accepting state (match) or none are (no match).

**Tiny parallel-states example.** Regex `a(b|c)d` matching text `acd`:

```
After reading 'a': active states = {start-of-b-branch, start-of-c-branch}
After reading 'c': active states = {after-c-branch}   ('b' branch dropped — 'c'≠'b')
After reading 'd': active states = {ACCEPT}            → MATCH
```

At no point did the engine "try" the `b` branch and then "back up" when it failed. Both branches were tracked simultaneously; the `b` branch simply fell out of the active set. This is what "no backtracking" means in practice.

**The guarantee.** Because the text is consumed once and the active-state set never revisits a character, the time cost is proportional to text length × the number of NFA states (which scales with the regex's complexity, not the input). This gives a linear-time guarantee on the text, regardless of how adversarial the input is. Russ Cox's 2007 article demonstrated this experimentally: for the regex `a?ⁿaⁿ` matching `aⁿ`, Thompson's construction needed 20 microseconds for n=29; Perl (backtracking) needed over 60 seconds. *Source: Russ Cox, "Regular Expression Matching Can Be Simple And Fast," swtch.com/~rsc/regexp/regexp1.html, fetched 2026-05-17.*

**Tools that use this approach.**

| Tool / Library | Language | Notes |
|---|---|---|
| RE2 | C++ | Google's production regex engine |
| `regexp` package | Go | Ships in the standard library; RE2-compatible |
| `regex` crate | Rust | Used by ripgrep; RE2-compatible |
| `re2` package | Python | Wraps C++ RE2; not the default `re` module |
| `re2j` | Java | Google's RE2 port for JVM |

**What you give up.** Thompson NFAs cannot express backreferences (e.g., `(.+)\1` meaning "match any string repeated twice"). Backreferences require the engine to "remember" what was captured in group 1 and match it again — this is not a regular language and cannot be expressed as a finite automaton. RE2's documented limitations (not supported, per RE2 syntax documentation fetched 2026-05-17):
- Backreferences: `\1`, `\g1`, etc.
- Lookahead/lookbehind assertions: `(?=...)`, `(?!...)`, `(?<=...)`, `(?<!...)`
- Possessive quantifiers: `*+`, `++`, etc.
- Recursive patterns.

For most practical search tasks — "find all TODO comments," "find all IP addresses," "highlight matches in a file" — these are not needed. For tasks like "find a word that appears twice" or "match HTML attributes in context," they are essential, which is why PCRE persists.

### 7.2 Backtracking: PCRE family

**The idea.** Try the first possible match path. If it fails, back up and try the next alternative. Continue until a path succeeds or all paths are exhausted.

Backtracking engines are conceptually simpler to implement and naturally support features that NFAs cannot handle: backreferences, lookahead, lookbehind, possessive quantifiers, atomic groups, and conditional patterns. The engine "remembers" what it matched in each group and can require the same string to appear again.

**The performance risk.** On certain patterns applied to certain inputs, backtracking explores exponentially many paths. The canonical example is `(a+)+$` applied to a string of `a`s followed by a `b` (which cannot match). The outer `+` can split the repeated `a`s in any number of ways; the inner `+` can consume any sub-run. With n `a`s before the `b`, the number of possible groupings is proportional to 2^n. The engine tries all of them before concluding no match.

**Concrete step counts** (from the Cloudflare postmortem — related pattern `.*.*=.*`):

```
Input "x=" + n trailing 'x's:
  n = 1  →     23 backtracking steps
  n = 5  →    ~80 steps
  n = 10 →   ~200 steps
  n = 20 →   555 steps   (documented in Cloudflare postmortem)
  n = 30 →  ~5,000 steps (extrapolated — not from postmortem directly)
```

Note: these numbers are for the specific simplified pattern from the Cloudflare postmortem. A slightly different variant of the pattern required 5,353 steps for the same n=20 input. *Source: Cloudflare Engineering Blog, fetched 2026-05-17.*

The general principle: step count grows faster than linearly as input length increases. For pathological cases, Cox showed `a?ⁿaⁿ` against `aⁿ` took Perl over 60 seconds for n=29 and extrapolates to years for n=100. *Source: Cox 2007, swtch.com, fetched 2026-05-17.*

**Tools that use backtracking.**

| Tool / Library | Language | Notes |
|---|---|---|
| Perl | Perl | Invented PCRE; Perl's regex is the reference implementation |
| `re` module | Python | Default regex module; PCRE-family |
| `Regexp` | Ruby | PCRE-family with Oniguruma engine |
| `java.util.regex` | Java | Backtracking; no linear guarantee by default |
| `RegExp` | JavaScript | PCRE-family in all major JS engines (V8, SpiderMonkey) |
| PCRE2 | C | Library used by PHP, Nginx, many others |
| Most editors' Find | Various | VS Code uses JavaScript's `RegExp` for regex find |

### 7.3 The 2019 Cloudflare outage

On July 2, 2019, Cloudflare suffered a global service disruption lasting 27 minutes. The cause: a new WAF (web application firewall) rule containing a regex with catastrophic backtracking. The problematic sub-expression was `.*.*=.*` (simplified from the full rule). For an input like `x=` followed by many `x`s, the engine had to explore exponentially many ways to split the leading `.*.*` before concluding that the overall pattern did not match.

Quantitative detail from Cloudflare's postmortem: matching `x=` followed by 20 `x`s required 555 backtracking steps with the simplified pattern `.*.*=.*`; a closely related variant required 5,353 steps for the same input. The step count grows faster than linearly as the string length increases. *Source: Cloudflare Engineering Blog, "Details of the Cloudflare Outage on July 2, 2019," blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/, fetched 2026-05-17.*

The outage was not a security attack. A single poorly-reviewed regex, deployed globally, disabled Cloudflare's WAF and caused CPU usage to spike to near 100% across their infrastructure, dropping traffic in the process.

### 7.4 What RE2 gives up — and why

RE2's linear-time guarantee comes from using only the features expressible as finite automata. A finite automaton has a fixed amount of memory (its current state). Backreferences require unbounded memory (whatever the first group matched could be arbitrarily long). Lookaround requires the engine to peek at context in ways that break the left-to-right single-pass model.

This is not a limitation of RE2's implementation — it is a mathematical limitation of the family of languages that finite automata can recognize. No NFA-based engine can support backreferences while keeping a linear-time guarantee, because backreference matching is not a regular language problem.

Practical implication: if you need backreferences (validating that an XML opening tag matches its closing tag; finding repeated words), you need PCRE. But you must be aware that you are opting out of the safety net.

---

## 8. Approximate / fuzzy matching

The previous sections all deal with exact matching: the pattern is either present or absent. Fuzzy matching asks a different question: "what strings are **close** to this pattern?" or "given this query with possible typos, what is the best match?"

### 8.1 Edit distance (Levenshtein)

The base metric: the minimum number of single-character operations (insert, delete, substitute) needed to transform string A into string B. "kitten" → "sitting" requires 3 operations (substitute k→s, substitute e→i, insert g), so their edit distance is 3.

**Tiny Wagner-Fischer DP table.** Computing edit distance between "CAT" and "CART":

```
     ""  C  A  R  T
""    0  1  2  3  4
C     1  0  1  2  3
A     2  1  0  1  2
T     3  2  1  1  1
```

Each cell is: min(cell-above + 1, cell-left + 1, cell-diagonal + (0 if chars match, 1 if not)). The bottom-right cell (1) is the edit distance. The table is N×M where N=len("CAT") and M=len("CART").

The Wagner-Fischer algorithm computes this in O(N×M) time by filling one row at a time. For spell-check on a 12-character word against a 100,000-word dictionary, this means 100,000 table fills — fast on modern hardware (a few milliseconds total).

For long strings against large dictionaries, O(N×M) per word × 100,000 words gets expensive at interactive speeds — which motivates Levenshtein automata and BK-trees.

### 8.2 Levenshtein automata (Schulz & Mihov 2002)

Given a target string and a maximum edit distance k, a Levenshtein automaton is a finite-state machine that accepts exactly the set of all strings within k edits of the target. The Schulz & Mihov 2002 paper ("Fast String Correction with Levenshtein-Automata," *International Journal of Document Analysis and Recognition*) showed this automaton can be constructed in O(|target|) time for any fixed k.

The payoff: instead of computing edit distance between the query and every dictionary word separately (N×M per word), you walk the dictionary's trie structure with the automaton as a guide. Branches that would lead to edit-distance > k are pruned immediately — the automaton tells you without any per-word computation. *Source: Wikipedia Levenshtein automaton article, fetched 2026-05-17. Wikipedia cites Schulz & Mihov 2002 but this dossier has not verified the paper directly.*

**Real-world use.** Apache Lucene uses Levenshtein automata for "fuzzy queries" — search terms with one or two allowed edits. This is what powers the typo tolerance in many search bars built on Elasticsearch or OpenSearch.

### 8.3 BK-trees

A BK-tree (Burkhard-Keller tree, 1973) is a tree data structure indexed by edit distance. Each node is a string. Each node's children are connected by edges labeled with their edit distance from the parent. To find all strings within k edits of a query, start at the root, compute the distance from the query to the root, and recursively check only the subtrees reachable within the triangle inequality (only children whose edge label falls in the range `[distance - k, distance + k]`).

**Where it is used.** Spell-checkers (the original application), DNS-level typosquatting detection, and any offline dictionary lookup where you need nearest-neighbor by edit distance.

**Trade-off vs. Levenshtein automata.** BK-trees are simpler to implement and work on any metric space (not just Levenshtein). Levenshtein automata are faster for search-as-you-type because they prune the search space more aggressively. The right choice depends on query volume and whether the dictionary is pre-indexed or changes dynamically.

### 8.4 fzf's bonus-based scoring

fzf (a command-line fuzzy file picker widely used by developers) does not use pure edit distance. It uses a Smith-Waterman derived scoring algorithm with bonus weights for semantically important positions. *Source: fzf source code, github.com/junegunn/fzf, algo.go, fetched 2026-05-17.*

**Scoring constants (from the fzf source):**
- Base match: 16 points per matched character
- Gap start: −3; gap extension: −1 per additional unmatched character
- Bonus after whitespace: 10 points
- Bonus after a path separator (`/`, `:`, `;`, `|`): 9 points
- Bonus at a camelCase transition: 7 points
- The first character of the query receives a 2× multiplier on bonuses

**Why not pure edit distance?** Pure edit distance would rank "fhe" as equally close to "fooHelper.ts" and "fhe_misc_archive.ts" — both can be reached by a few insertions. But a developer typing "fhe" almost certainly means `fooHelper` (capital H is a word boundary). The bonus system rewards matches at word-boundary positions to reflect how humans actually abbreviate. The query `fhe` scores much higher against `fooHelper.ts` because `f`, `H`, and `e` are all at boundary-adjacent positions.

fzf's algorithm is O(N×M) (Smith-Waterman derived) for the full scoring pass but uses a greedy O(N) first pass to avoid the full O(N×M) computation when quick rejection is possible.

**Takeaway for the chapter author.** "Fuzzy matching" in production tools rarely means "compute Levenshtein distance." It means "score matches by weighted heuristics that model how humans abbreviate." Levenshtein distance is the academic baseline; fzf-style scoring is the production reality for interactive tools.

---

## 9. SIMD / bitmap acceleration

Everything in sections 3–8 describes algorithms at the level of individual characters. Modern CPUs can operate on 16, 32, or even 64 bytes at a time using SIMD (Single Instruction, Multiple Data) instructions. This section explains how that changes the practical performance picture.

### 9.1 Bitap / Shift-Or

The Bitap algorithm (also called Shift-Or or Shift-And) expresses the matching state as a bitmask — one bit per position in the pattern. Each text character causes a bitwise AND and a left shift of the state register. When bit 0 of the state is set, you have a match. On a 64-bit machine, you can track the state of a 63-character pattern in a single register with a single instruction per text character.

**Strengths.** Predictable O(N) performance regardless of text content. Natural extension to approximate matching (add one register per allowed error). No preprocessing overhead.

**Constraints.** Pattern must fit in one machine word (63 characters on a 64-bit system). For longer patterns, you need multiple registers and the bookkeeping becomes less trivial. *Source: Wikipedia Bitap article, fetched 2026-05-17.*

**Where it appears.** `agrep` (approximate grep) was built on this algorithm. Its predictable O(N) runtime regardless of text content makes it a natural fit for streaming and embedded applications.

### 9.2 glibc memmem

`glibc`'s `memmem` (C library function for finding a byte sequence in a buffer, used internally by many programs) uses a combination of a two-byte comparison trick for short needles and a more sophisticated skip-based algorithm for longer ones. The exact strategy has shifted across glibc versions and is best verified directly in the glibc source. *(Could not verify the current algorithm against a primary source in this session — the Wikipedia Boyer-Moore-Horspool article does not mention glibc specifically. Consult glibc git, `string/memmem.c`, for the current implementation.)*

### 9.3 ripgrep's SIMD prefilter — the Teddy algorithm

ripgrep's real-world speed advantage over other tools comes primarily from SIMD, not from a smarter high-level algorithm.

From the ripgrep architecture blog post (Andrew Gallant, burntsushi.net/ripgrep/, fetched 2026-05-17): ripgrep extracts literal bytes from the regex pattern, then applies the **Teddy algorithm** — an unpublished SIMD technique from Intel's Hyperscan project — which performs packed comparisons of 16 bytes at a time. If no 16-byte chunk contains any candidate literal byte, the entire chunk is skipped in a single SIMD instruction.

Additionally, ripgrep picks the "rarest" byte in the pattern (rather than just the last byte as Boyer-Moore would) to minimize false candidates reaching the slower verification step.

**The bottleneck insight.** On modern CPUs with caches and memory buses measured in gigabytes per second, the limiting factor for text search across a large file is usually memory bandwidth — how fast bytes can flow from RAM into the CPU. An algorithm that examines one byte at a time leaves most of that bandwidth unused. SIMD routines that process 16 or 32 bytes per instruction are exploiting the available bandwidth. The algorithmic cleverness of KMP or Boyer-Moore at the character level matters less than whether you are utilizing the CPU's vector units at all.

To make this concrete (illustrative numbers, not benchmarked in this session):

```
Memory bandwidth, modern desktop CPU: ~40–60 GB/s
Naive scan, one byte at a time:       ~4–8 GB/s effective throughput (limited by loop overhead)
SIMD scan, 16–32 bytes/instruction:   ~20–40 GB/s effective throughput (approaching bandwidth limit)
```

The gap between "naive" and "SIMD" is not a smarter algorithm — it is filling the available hardware bandwidth.

This is the correct mental model for "why is ripgrep fast": it is mostly that ripgrep processes bytes faster (SIMD, incremental buffering, .gitignore-aware traversal, parallelism across files), not that it uses a fundamentally better search algorithm. *(Inference, consistent with Gallant's blog post. The throughput numbers above are illustrative — could not verify specific ripgrep throughput numbers against a primary benchmark in this session. See burntsushi.net/ripgrep/ benchmark section.)*

**ripgrep's regex engine.** ripgrep uses Rust's `regex` crate, which implements Thompson NFA construction — the same linear-time RE2 family. This means ripgrep inherits the no-backreferences limitation. If you need `\1` or lookahead, ripgrep has a `--pcre2` flag that switches to PCRE2, giving up the SIMD prefilter and linear-time guarantee in exchange. *Source: Gallant blog post, burntsushi.net/ripgrep/, fetched 2026-05-17.*

---

## 10. Connections to Claude Code's daily use

When Claude Code searches your codebase, it invokes `ripgrep` — or a ripgrep-equivalent — for text search. This means:

- **You get linear-time RE2 semantics** for the patterns the agent writes in Grep tool calls. Catastrophic backtracking is not a risk for the search step itself.
- **SIMD acceleration is in effect.** A 5GB monorepo scanned in under a second reflects ripgrep's SIMD prefilter + parallelism across files, not an exotic algorithm.
- **`.gitignore` awareness.** ripgrep respects `.gitignore` rules, which means it skips `node_modules/` and build output directories by default — often the largest directories in a project. This `.gitignore` awareness is as important as the SIMD code for real-world speed: on a typical Node project, `node_modules/` alone can contain hundreds of megabytes that a naive grep would scan unnecessarily.

**Pattern types Claude Code writes.** When Claude Code generates a pattern for a Grep tool call, it typically writes one of:

1. A plain literal string: `"NullPointerException"` — Boyer-Moore or SIMD literal scan.
2. A simple regex with character classes: `"TODO: .*"` — NFA, one pass.
3. A regex with alternation: `"import (React|useState)"` — Aho-Corasick internally (ripgrep detects multi-literal alternations and uses AC).

It will not write patterns that require backreferences (`\1`) because ripgrep's default engine (RE2-family) does not support them. If you manually invoke ripgrep with `--pcre2` and a backreference pattern, you bypass the SIMD path.

**The Glob tool is a separate world.** When Claude Code uses glob patterns (`*.ts`, `src/**/*.mdx`), the matching is shell glob expansion, not regex. Glob patterns are a much simpler language: `*` matches any sequence of non-separator characters, `**` matches across directory separators, `?` matches any single character. There are no quantifiers, no alternation, no character classes in the regex sense. Matched by a direct recursive descent over file paths — no NFA, no Boyer-Moore, no failure tables.

**Which regex engine runs when the model emits a regex in a tool call.** This depends on the harness:

| Context | Engine | Family | Backtracking risk? |
|---|---|---|---|
| Claude Code Grep tool | ripgrep (Rust `regex` crate) | RE2 / Thompson NFA | No (linear time) |
| Claude Code Bash tool, `grep` | GNU grep (Boyer-Moore + POSIX regex) | POSIX ERE (not full PCRE) | Limited |
| Claude Code Bash tool, `perl -ne` | Perl regex | PCRE | Yes |
| JavaScript code the model writes | V8 Irregexp | PCRE-family | Yes |
| Python code the model writes, `re` | CPython `re` | PCRE-family | Yes |

The model cannot know at generation time which engine will execute its output. For any regex the model emits in generated code (not in a Grep tool call), assume PCRE-family until verified.

**The search-index picture.** For very large codebases, Claude Code may have a vector-search layer on top of ripgrep (finding semantically relevant files first, then exact-searching within them). That pairing — semantic pre-filter + exact-match verification — is the production pattern for large-scale code search. See the `/vector-search` and `/rag` dossiers for the embedding/retrieval side of that picture.

---

## 11. Common misconceptions / pedagogical traps

**"Regex == one thing."**
There are two fundamentally different regex engine families: NFA-based (RE2, Rust `regex`, Go `regexp`) with a linear-time guarantee and no backreferences, and backtracking (PCRE, Python `re`, JavaScript RegExp) with full feature support and potential exponential worst-case time. The word "regex" alone tells you nothing about which family you are using or what its performance profile is.

A practical test: if a tool's documentation says it "uses RE2" or is "re2-compatible," you are in the safe family. If it says "Perl-compatible" or "PCRE," you are in the backtracking family. Rust's `regex` crate is RE2-compatible. Python's `re` module is PCRE-family. Go's `regexp` package is RE2. JavaScript's `RegExp` is PCRE-family.

**"Big-O is what matters."**
KMP and Boyer-Moore both have better theoretical worst-case bounds than the naive algorithm. In practice, for short patterns in typical source code or English text, the naive algorithm with early exits often beats both — because the constant factor and cache behavior dominate at the pattern lengths and alphabet sizes you actually encounter. SIMD-accelerated byte scanning can beat asymptotically smarter algorithms by 10× or more. Big-O is a floor, not a ceiling.

The practical hierarchy for short patterns on modern hardware (inference, not a benchmarked claim):
- SIMD-accelerated naive scan (what ripgrep does at the byte level) > naive algorithm > KMP
- For long patterns on large alphabets: Boyer-Moore wins on random text
- For many simultaneous patterns: Aho-Corasick wins regardless of pattern length

**"ripgrep is fast because it uses a smarter algorithm."**
ripgrep is fast primarily because: (a) its SIMD prefilter processes 16 bytes per instruction, (b) it runs searches across multiple files in parallel, (c) it skips directories like `node_modules/` via `.gitignore` awareness. The underlying matching algorithm is Thompson NFA — the same family as RE2 and Go `regexp`. Algorithmic cleverness matters less than bytes-per-cycle. *Source: Gallant blog post, burntsushi.net/ripgrep/, fetched 2026-05-17.*

**"Backreferences are free."**
Any backtracking engine feature that requires "remembering" a captured group and re-matching it (backreferences) or peeking at context (lookahead/lookbehind) removes the linear-time guarantee. You can still use these features — Python `re`, JavaScript RegExp, and PCRE all support them — but you are opting out of the safety net. On carefully crafted (or accidentally crafted) inputs, the cost can be exponential.

The connection: when you write a regex like `(\w+)\s+\1` to find doubled words ("the the"), you are using a backreference. That is a feature no finite automaton can express, so no NFA-based engine can run it. If you need doubled-word detection, you must use a PCRE-family engine and be aware that adversarial inputs could abuse the backtracking.

**"Fuzzy = Levenshtein."**
Production fuzzy finders (fzf, IDE "open file" dialogs, modern search-as-you-type) use bonus-weighted heuristics, not pure edit distance. They reward matches at word boundaries, path separators, and camelCase transitions because that is how humans abbreviate identifiers. Pure Levenshtein distance would rank "fhe" equally against "fhe_misc.ts" and "fooHelper.ts". Bonus scoring makes it context-aware.

Spell-checkers are the exception: they legitimately need edit distance (or Levenshtein automata) because the goal is "what dictionary word is closest in character-change cost?" Fuzzy file finders need something different: "which filename best matches the abbreviation I typed?" These are different questions requiring different metrics.

**"ASCII and Unicode are interchangeable in pattern matching."**
Boyer-Moore's bad-character table is indexed by character value. For ASCII (256 entries), this fits in a small array. For Unicode (1.1 million code points), the same approach requires a much larger data structure or a hash table. Many production tools work at byte level and handle multi-byte UTF-8 characters as sequences of bytes rather than code points — which works for most patterns but can produce surprising results for regex character classes that should match Unicode letters or digits.

For example, `[a-z]` in a byte-level tool matches exactly the bytes 0x61–0x7A. It will not match `é` (U+00E9, a common accented Latin letter) because `é`'s UTF-8 encoding is two bytes: 0xC3 0xA9. A Unicode-aware engine handles this correctly; a byte-level engine does not. ripgrep is Unicode-aware by default (it builds UTF-8 decoding into its DFA, per Gallant's blog post). Many other tools are not.

**"The failure table / trie / automaton is the slow part."**
KMP's failure table, Boyer-Moore's bad-character table, and Aho-Corasick's automaton are all built from the pattern(s) — not the text. They are preprocessing cost, paid once. The matching cost is paid per character of text. For searching a single pattern across a 1GB log file, preprocessing is negligible. This matters for system design: in a long-running service that applies the same set of patterns to millions of documents, Aho-Corasick's automaton should be compiled once at startup, not rebuilt per request.

---

## 12. House-style chapter ideas

Per GOAL.md: one core diagram, one React island, closing "How this connects to the cache" callout. The chapter's hook is the Ctrl+F example; the closing takeaway is the ripgrep-speed explanation.

### Diagrams (choose one)

**Diagram option A: skip animation — naive vs Boyer-Moore side-by-side**
Two rows, same text and pattern. Left row: naive approach, the pattern cursor advances one position per step, mismatches shown in red. Right row: Boyer-Moore, show the larger jumps in green. Stepped HTML/CSS frames, no JavaScript required. Takeaway: the jumps are the whole point. Good for the "what better algorithms buy you" framing in Section 2.

**Diagram option B: NFA state visualization**
Small regex `a(b|c)*d`. Show the NFA as a state graph (SVG circles and arrows). Animate which states are active as the text `abcbd` is consumed. The "multiple active states" model makes the parallel-simulation idea concrete. This is the hardest to build but the most intellectually valuable — it directly answers "what is an NFA?" which underlies the RE2 vs PCRE distinction.

**Diagram option C: regex engine family tree (recommended for simplicity)**
HTML/CSS comparison table with two columns: RE2 family (RE2, Rust `regex`, Go `regexp`, ripgrep) and PCRE family (Perl, Python `re`, JavaScript RegExp, Java default, PCRE2). Rows: linear-time guarantee, backreferences supported, lookahead supported, commonly used in. Instantly answers "which one am I using?" The easiest to implement and the most directly actionable.

### React islands (choose one)

**Demo option A: step-through algorithm explorer**
Dropdown: Naive / KMP / Boyer-Moore. Fixed haystack (100-character string) and needle. "Next step" button advances the algorithm one step, highlighting: current alignment of pattern on text, current comparison position, whether it matched or failed, and — for KMP/BM — how many positions were skipped. Data: `src/data/pattern-matching.ts` with pre-computed step traces for each algorithm on the same input. Takeaway: turns abstract "skip" descriptions into a concrete count.

**Demo option B: catastrophic regex sandbox (recommended)**
Three regexes: `(a+)+$` (catastrophic backtracking), `a+$` (safe), and the RE2-equivalent note (RE2 would refuse `(a+)+$` and substitute `a+$` automatically). A slider sets the string length (1–40 characters of `a` followed by one `b`). Two latency bars update: one for the safe regex (flat, near-zero), one for the catastrophic pattern (grows visibly super-linearly even in the demo's illustrative numbers). Data: `src/data/pattern-matching.ts` with hand-authored step-count table for selected lengths (labeled illustrative). Takeaway: the Cloudflare outage becomes visceral, not just theoretical. This is the section users will remember.

**Demo option C: fuzzy ranker**
Text input for a query. A hand-authored list of 10 filenames (including `fooHelper.ts`, `fhe_misc.ts`, `FileHeaderExtractor.ts`, etc.). As the user types, the list reranks using fzf-style bonus scoring (implemented as a tiny TypeScript function matching the bonus weights from Section 8.4). Each ranked result shows the matched characters highlighted and the score breakdown (base + bonus). Data: `src/data/pattern-matching.ts` with filename list and pre-computed bonus lookup. Takeaway: makes "fuzzy = bonus scoring, not edit distance" concrete.

**Recommended pairing:** Diagram option C (family tree, no JS needed) + Demo option B (catastrophic regex sandbox, highest user impact). The family tree explains the "two families" framing instantly; the sandbox makes the stakes real.

**React island name suggestion:** `PatternMatchingDemo.tsx` with a `mode` prop (`"catastrophic" | "stepthrough" | "fuzzy"`).
**Data file:** `src/data/pattern-matching.ts`

---

## 13. Hand-authored data plan

All data clearly labeled "illustrative" in the UI. No real engine output.

**For the step-through explorer (`src/data/pattern-matching.ts`, naiveStepper, kmpStepper, bmStepper):**

```typescript
// Suggested TypeScript types for the step-through data

type AlgorithmStep = {
  textPos: number;        // current alignment start in text
  patternPos: number;     // current comparison position in pattern
  isMatch: boolean;       // did this comparison succeed?
  jumped?: number;        // if mismatch: how many positions did we shift? (KMP/BM only)
  note?: string;          // optional label for UI ("KMP skip: used failure[3]=2")
};

export const haystack = "ABABABCABABABABCABABC"; // 20 chars
export const needle   = "ABABC";                // 5 chars

// Naive trace: 35 steps (includes all partial matches and fails)
// KMP trace:   22 steps (fewer because the skip avoids re-scanning)
// BM trace:    12 steps (fewest because of multi-char jumps from right)
//
// Pre-compute all three. Each is an array of AlgorithmStep.
// The React island reads the selected algorithm's array and renders
// step N on "Next step" button press.
```

- Haystack: `"ABABABCABABABABCABABC"` (20 characters, constructed to make KMP's skip visible and BM's right-to-left jumps dramatic)
- Pattern: `"ABABC"`
- Naive steps: list of `{textPos, patternPos, matched: bool}` — full trace (~35 steps)
- KMP steps: same structure but with `{jumped: number}` on failure — shows the 2-position skip on the second attempt
- BM steps: same but with `{jumped: number}` — shows 3–5 position jumps from right-side scan

Include a `note` field for the first KMP skip and the first BM jump, so the UI can display an explanatory label like "KMP reused matched prefix — skipped 2 positions" without it being hardcoded in the component.

**For the catastrophic regex sandbox (`src/data/pattern-matching.ts`, catastrophicSteps):**

A table of `{length: number, safeSteps: number, catastrophicSteps: number}` for lengths 5–30.
The `catastrophicSteps` values are **illustrative** — calibrated to grow super-linearly consistent
with the Cloudflare postmortem's documented data points (n=20 → 555 steps for `.*.*=.*`).
Label clearly as "illustrative step counts" in the UI.

```typescript
// src/data/pattern-matching.ts
export const catastrophicSteps = [
  { length:  5, safeSteps:  6, catastrophicSteps:    14  },
  { length: 10, safeSteps: 11, catastrophicSteps:    68  },
  { length: 15, safeSteps: 16, catastrophicSteps:   200  },
  { length: 20, safeSteps: 21, catastrophicSteps:   555  }, // from Cloudflare postmortem
  { length: 25, safeSteps: 26, catastrophicSteps:  1800  },
  { length: 30, safeSteps: 31, catastrophicSteps:  5353  }, // approx. from postmortem variant
];
// NOTE: these values are illustrative. The exact growth rate depends on the
// specific regex and input. The key point is super-linear growth.
```

**For the fuzzy ranker (`src/data/pattern-matching.ts`, fuzzyFiles):**

```typescript
// Pre-computed rankings for query "fhe" against each filename.
// Scores are hand-authored using the bonus weights from Section 8.4.
// Label as "illustrative scores."

export const fuzzyFiles = [
  {
    name: "fooHelper.ts",
    score: 62,
    matchPositions: [0, 3, 4],      // f at 0 (word start +10), H at 3 (camelCase +7), e at 4
    scoreBreakdown: "f(16+10) + H(16+7) + e(16) = 65 − 2 gap = 63"
  },
  {
    name: "FileHeaderExtractor.ts",
    score: 55,
    matchPositions: [0, 4, 10],     // F at 0 (word start), H at 4 (camelCase), e at 10
    scoreBreakdown: "F(16+10) + H(16+7) + e(16) − 10 gaps = 55"
  },
  {
    name: "fetchHtmlElements.tsx",
    score: 48,
    matchPositions: [0, 5, 9],      // f at 0, H at 5 (camelCase), e at 9
    scoreBreakdown: "f(16+10) + H(16+7) + e(16) − 14 gaps = 45"
  },
  {
    name: "fhe_misc_archive.ts",
    score: 44,
    matchPositions: [0, 1, 2],      // f, h, e consecutive — but no boundary bonuses for h, e
    scoreBreakdown: "f(16+10) + h(16) + e(16) − 0 gaps = 58... but h and e not at boundaries"
  },
  {
    name: "formatHexEncoder.ts",
    score: 38,
    matchPositions: [0, 6, 9],
    scoreBreakdown: "f(16+10) + H(16+7) + e(16) − 20 gaps = 45"
  },
  { name: "src/data/fhe-protocol.ts",  score: 32, matchPositions: [9, 10, 11] },
  { name: "components/FancyHeader.tsx", score: 28, matchPositions: [11, 16, 22] },
  { name: "utils/helpers.ts",           score: 18, matchPositions: [6, 8, 10] },
  { name: "scripts/fuzz.sh",            score: 12, matchPositions: [8, 9, 10] },
  { name: "main.ts",                    score: 0,  matchPositions: [] },
];
```

The key pedagogical point: `fhe_misc_archive.ts` contains the literal substring "fhe" but scores lower than `fooHelper.ts` because "fhe" in that filename has no word-boundary bonus for `h` and `e` — they are just consecutive lowercase letters. The bonus system rewards "this is how a human would abbreviate fooHelper" over "this literally contains the letters fhe."

---

## 14. Connections to existing chapters and other dossiers

### Connection to `/docs/research/rag.md`

Section 5.1 of the RAG dossier mentions BM25 (a term-frequency based scoring function used in keyword search). BM25 is built on inverted indexes, which require tokenization and exact-string matching at index build time. This chapter's algorithms (KMP, Boyer-Moore, Aho-Corasick) are what run inside that index lookup when the query arrives.

The RAG dossier frames retrieval as a choice between "exact" keyword retrieval and "semantic" embedding-based retrieval. This chapter is the technical backstory for the "exact" half: when a RAG pipeline uses BM25 or a keyword index, it is running Aho-Corasick or a Boyer-Moore variant over an inverted-index structure.

The RAG dossier also briefly mentions "hybrid retrieval" (combining BM25 with vector search). This chapter explains what BM25's keyword side is doing algorithmically. Cross-reference: RAG dossier Section 5, this dossier Section 6 (Aho-Corasick) and Section 9 (SIMD).

### Connection to `/docs/research/vector-embeddings-and-semantic-search.md`

Pattern matching (this chapter) is the "exact" counterpart to vector search's "semantic" retrieval.

| Dimension | Pattern matching | Vector / semantic search |
|---|---|---|
| Query type | Exact string or regex | Natural-language question or concept |
| Failure mode | Misses synonyms, typos | Misses precise technical strings |
| Speed on large corpora | SIMD scan, ms scale | ANN lookup, ms scale |
| Index needed? | Optional (ripgrep scans; suffix arrays index) | Required (vector index) |
| Primary algorithm | KMP, Boyer-Moore, Thompson NFA | Cosine similarity + ANN |

Production code search combines both: semantic retrieval to find the right files, then ripgrep to find the exact line. This chapter explains the second step; the vector-embeddings dossier explains the first.

### Connection to `/docs/research/ann-vector-indexes.md`

ANN indexes are the data structure layer on top of vector similarity computation. Pattern matching algorithms are the data structure layer on top of byte-level comparison. The structural analogy:

- ANN: build a graph (HNSW) from all document vectors, query by traversing the graph
- Aho-Corasick: build an automaton (trie + failure links) from all patterns, query by walking the automaton

Both solve the same problem at different levels of abstraction: "how do you avoid checking every candidate?" ANN prunes the vector space; Aho-Corasick prunes pattern alternatives. The key tradeoff in both is preprocessing cost vs. query cost — spend time upfront, save time per query.

### Connection to future `/indexing-strategies` and `/data-search` dossiers

Pattern matching is the algorithm; indexes are the data structures that pre-process text so those algorithms run at query time rather than scan time. The progression:

1. **This chapter** — algorithms that scan raw text: KMP, Boyer-Moore, Thompson NFA, Aho-Corasick.
2. **`/indexing-strategies`** (future) — data structures built over text: inverted indexes, suffix arrays, FM-indexes, n-gram indexes. These pre-compute information that makes pattern queries sub-linear in the text length without scanning.
3. **`/data-search`** (future) — how full-text search engines (Lucene/Elasticsearch, SQLite FTS, PostgreSQL `tsvector`) combine indexes with the algorithms from this chapter, plus ranking functions like BM25.

The three form a triptych. Reading them in order: algorithms → data structures → systems.

**Specific cross-references to add when writing the chapter:**
- "Suffix arrays allow the equivalent of Boyer-Moore search across a pre-indexed corpus without rescanning — see /indexing-strategies."
- "The FM-index extends suffix arrays to allow compressed-text search — relevant if /indexing-strategies covers bioinformatics or compressed corpora."
- "Apache Lucene uses a combination of: tokenization (Ch 1 of GOAL.md connects here), inverted indexes (/indexing-strategies), BM25 scoring (this chapter's Aho-Corasick handles multi-term matching), and Levenshtein automata for fuzzy queries (Section 8.2 of this dossier)."

---

## 15. Closing-takeaway angle and chapter arc

**The chapter's arc in four beats:**

1. **Hook** — Ctrl+F on 200K lines is instant. Why?
2. **Baseline** — naive algorithm is fine for small inputs; you need something better at scale.
3. **The two forks** — the exact-matching algorithms (KMP, Boyer-Moore, Aho-Corasick, SIMD) and the regex-engine families (NFA vs. backtracking). The fork point is the chapter's structural center of gravity.
4. **Closing insight** — ripgrep is fast because of memory-bandwidth exploitation, not because of exotic algorithms. A PCRE regex can hang your editor. Fuzzy finders use bonus scoring, not Levenshtein. These three corrections to common intuitions are the "what you'll carry away."

**Recommended closing paragraph for the chapter:**

> When ripgrep finds your needle in 200ms across a 5GB monorepo, it is not running an exotic algorithm. It is running a competent one — Thompson NFA, the same core as Google's RE2 — and then adding: 16-bytes-at-a-time SIMD scanning to exploit memory bandwidth, parallel search across files, and `.gitignore`-aware traversal to skip the directories that would take longest. Understanding which algorithm runs when explains both why search is usually instant and why a single regex with `(a+)+$` can occasionally hang your editor for seconds or minutes. The difference between "instant" and "hung" is not talent; it is which engine family your tool chose and whether you handed it an adversarial pattern.

**Cache callout angle** (for the "How this connects to the cache" callout box, per GOAL.md):

The most natural connection is indirect: Claude Code's Grep tool calls ripgrep on every search, and those search results come back as tool output that re-enters the context window as new tokens. Understanding that ripgrep is fast (sub-second on most codebases) helps readers trust that a Claude Code session that issues many Grep calls is not wasting time on search — the latency in those sessions is mostly model processing and token generation, not the grep itself. This also sets up the Chapter 7 cache insight: the tool results are in the uncached tail of the request, while the system prompt and file contents are in the cached prefix.

---

## 16. Up-to-date facts (with citations and dates)

| Claim | Source URL | Fetched date | Confidence |
|---|---|---|---|
| ripgrep uses Rust's `regex` crate (Thompson NFA, RE2-family) | burntsushi.net/ripgrep/ | 2026-05-17 | Documented |
| ripgrep uses the Teddy SIMD algorithm (Intel Hyperscan, 16 bytes/instruction) | burntsushi.net/ripgrep/ | 2026-05-17 | Documented |
| ripgrep picks the "rarest" byte in the literal for SIMD scan, not the last byte | burntsushi.net/ripgrep/ | 2026-05-17 | Documented |
| ripgrep has a `--pcre2` flag for backreference support at cost of SIMD + linear guarantee | burntsushi.net/ripgrep/ | 2026-05-17 | Documented |
| RE2 does not support backreferences, lookahead/lookbehind, possessive quantifiers | RE2 syntax docs at github.com/google/re2/wiki/Syntax | 2026-05-17 | Documented |
| Thompson NFA is ~1 million times faster than Perl on `a?ⁿaⁿ` matching `aⁿ` for n=29 | swtch.com/~rsc/regexp/regexp1.html (Russ Cox 2007) | 2026-05-17 | Documented |
| Cloudflare outage on July 2, 2019 lasted ~27 minutes; caused by catastrophic regex backtracking | blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/ | 2026-05-17 | Documented |
| Cloudflare problematic sub-expression was `.*.*=.*`; `x=` + 20 `x`s required 555 backtracking steps | blog.cloudflare.com/details-of-the-cloudflare-outage-on-july-2-2019/ | 2026-05-17 | Documented |
| KMP failure table precomputation: O(m); matching: O(n); combined O(n+m) | Wikipedia KMP article | 2026-05-17 | Textbook |
| Boyer-Moore used in GNU grep | Wikipedia Boyer-Moore article | 2026-05-17 | Documented |
| Boyer-Moore is "sublinear in practice" on long patterns / large alphabets | Wikipedia Boyer-Moore article | 2026-05-17 | Textbook |
| Aho-Corasick formed the basis of original Unix `fgrep` | Wikipedia Aho-Corasick article | 2026-05-17 | Documented |
| Aho-Corasick `aho-corasick` Rust crate maintained by Andrew Gallant (BurntSushi) | docs.rs/aho-corasick | 2026-05-17 | Documented |
| `aho-corasick` crate disables SIMD prefilters when pattern count exceeds ~100 | docs.rs/aho-corasick | 2026-05-17 | Documented |
| Levenshtein automaton can be constructed in O(\|target\|) for fixed k (Schulz & Mihov 2002) | Wikipedia Levenshtein automaton article | 2026-05-17 | Documented (Wikipedia cites the paper; paper not directly verified) |
| Apache Lucene uses Levenshtein automata for fuzzy queries | Wikipedia Levenshtein automaton article | 2026-05-17 | Documented |
| fzf's bonus scoring: 16 points/match, −3 gap start, +10 after whitespace, +7 camelCase | github.com/junegunn/fzf algo.go | 2026-05-17 | Documented |
| fzf uses Smith-Waterman derived algorithm with O(nm) complexity for full scoring | github.com/junegunn/fzf algo.go | 2026-05-17 | Documented |
| Bitap/Shift-Or optimal for patterns ≤ word length (~63 chars on 64-bit machine) | Wikipedia Bitap article | 2026-05-17 | Textbook |
| ripgrep "fast because of SIMD, parallelism, .gitignore, not exotic algorithm" | burntsushi.net/ripgrep/ (inference from architecture description) | 2026-05-17 | Inferred |
| "Memory bandwidth is the bottleneck for typical text search on modern CPUs" | Could not verify — inference from ripgrep architecture; see burntsushi.net/ripgrep/ | — | Inferred |
| GNU grep speed comparison claims vs. ripgrep in specific benchmarks | Could not verify specific numbers — see burntsushi.net/ripgrep/ benchmark section directly | — | Could not verify |
| glibc `memmem` uses a skip-based strategy for long needles | glibc source not verified; Wikipedia Boyer-Moore-Horspool article does not mention glibc | — | Could not verify — consult glibc git string/memmem.c |
| Snort IDS uses Aho-Corasick for signature matching | Wikipedia Snort article (fetched 2026-05-17) does not name the algorithm; Snort FAQ inaccessible (403) | — | Could not verify — widely cited in academic literature but no primary source confirmed in this session |

---

## 17. Open questions for the chapter author

**1. FM-index: here or defer?**
The FM-index (Ferragina-Manzini, 2000) is a compressed full-text index that enables search in O(M log N) time on gigabytes of pre-indexed text and is used in DNA sequencing tools (BWA, Bowtie). It belongs conceptually with `/indexing-strategies` rather than here — it is an index data structure, not a scanning algorithm. Recommendation: mention it in one sentence as "what you build when you need to index text for repeated queries rather than scan it fresh each time" and defer the mechanics. If `/indexing-strategies` does not exist yet, a parenthetical "(out of scope here)" suffices. Do not derive or explain the FM-index in this chapter.

**2. Suffix arrays: same question.**
Suffix arrays are another indexed approach (used in text compression, biological sequence search, and some full-text search engines including some SQLite FTS variants). Same recommendation: defer to `/indexing-strategies` or name-check only as "a way to pre-sort all suffixes of a document so that binary search can find any pattern in O(M log N)." The chapter audience does not need to know how a suffix array is built.

**3. Unicode and Boyer-Moore — how much detail?**
The bad-character table behavior on multibyte UTF-8 is a real gotcha for users who apply byte-level tools to emoji or non-Latin script text. The misconceptions section (11) addresses this in one paragraph. Should the chapter also include a worked 2-line example — e.g., what happens when you grep for an emoji in a byte-level tool vs. ripgrep (Unicode-aware)? The audience has definitely used grep on files that contain Unicode comments. A small "caveat" callout after the Boyer-Moore section seems right. The chapter author should decide whether this crosses from "useful practical warning" into "too much detail for the audience."

**4. PCRE2 vs. the `re2` Python binding — mention or omit?**
Python `re` is PCRE-family (backtracking). The `re2` Python package wraps Google RE2 and gives linear-time guarantees in Python. Mentioning it is an immediately actionable tip for Python users (the largest programming-language audience). But it adds a library-specific detail that may date badly if the package's status changes, or if Anthropic's guidance is to avoid library recommendations. Recommendation: mention it in one sentence as "if you need linear-time regex in Python, the `re2` package wraps Google RE2" with a note that availability and API stability should be verified before use.

**5. Approximate matching depth — one chapter or split?**
Sections 8.1–8.4 cover edit distance, Levenshtein automata, BK-trees, and fzf scoring. The fzf demo makes 8.4 essential; 8.1 is the necessary baseline. The question is whether 8.2 (Levenshtein automata) and 8.3 (BK-trees) belong in this chapter or in a future `/fuzzy-search` dossier. Arguments for keeping them here: they complete the "approximate matching" story and are short. Arguments for deferring: the audience uses fzf but does not implement spell-checkers, and the Levenshtein automaton concept is harder than the rest of this chapter. One option: keep 8.1 and 8.4 as full sections; reduce 8.2 and 8.3 to a combined 150-word "if you want to go deeper" sidebar.

**6. Catastrophic regex sandbox — real timing vs. illustrative step counts?**
The recommended demo uses hand-authored step count numbers labeled "illustrative." An alternative is to run the catastrophic regex in a JavaScript WebWorker (JavaScript's `RegExp` is PCRE-family) and measure actual milliseconds in the user's browser. This would be more visceral — the user would see their own tab freeze for a moment at n=25. But it introduces a real computation into an otherwise pre-scripted demo, requires a WebWorker setup to avoid blocking the UI thread, and creates a demo that behaves differently on different hardware. Recommendation: use illustrative numbers for the initial build; note in a code comment that a real-timing version is possible as a future enhancement. Label the bar chart clearly as "illustrative: actual times vary by engine and hardware."

**7. Claude Code's search implementation — verify before publishing.**
Section 10 states that Claude Code uses ripgrep for text search. This is consistent with public statements from Anthropic and widely reported in developer discussions, but the exact implementation is not cited to a primary Anthropic documentation source in this dossier. The chapter should hedge: "Claude Code's search tool uses a ripgrep-compatible implementation" or link to the current Claude Code documentation for confirmation. This is particularly important because the implementation could change between Claude Code versions. Do not state it as an uncaveated fact in the published chapter.

**8. Performance numbers — none given and that is correct.**
This dossier deliberately avoids specific performance numbers (e.g., "ripgrep is N× faster than GNU grep") because benchmarks are hardware-specific, benchmark-suite-specific, and change as tools are updated. The Gallant blog post contains benchmark results but they are from the original 2016 publication and may not reflect the current state of either ripgrep or its competitors. If the chapter author wants to include a performance comparison, it should link to a current benchmark (e.g., the `rg` GitHub benchmarks page or an independent benchmarks suite) with a date, rather than stating a number as fact.

---

## 18. Vocabulary glossary (for prose clarity)

These terms appear in the chapter and may need to be introduced the first time they appear in prose. Suggested one-sentence definitions for the audience.

| Term | Suggested definition for the chapter audience |
|---|---|
| Pattern / needle | The string you are searching for (what you typed into Ctrl+F). |
| Text / haystack | The document or file being searched through. |
| Mismatch | A position where the pattern's character does not equal the text's character at that position. |
| Preprocessing | Work done on the pattern before searching begins. Paid once; saves time on each character of text. |
| Trie | A tree where each path from root to a node spells out a word. Used by Aho-Corasick to hold all patterns at once. |
| Finite automaton (FA) | A machine with a fixed number of states and rules for moving between them. The key property: it reads input left to right, one character at a time, and never goes back. |
| NFA | A finite automaton where at each step there may be multiple possible "next states." Simulated by tracking all active states in parallel. |
| DFA | A finite automaton where each state has exactly one next state per character. Faster to run than an NFA, but can be much larger. RE2 converts NFAs to DFAs internally. |
| Backreference | A regex feature that says "this part must match whatever group 1 already matched." Not expressible as a finite automaton. |
| Lookahead / lookbehind | A regex feature that says "match here only if this other pattern follows (or precedes)." Also not natively expressible in pure NFA; requires extensions. |
| Catastrophic backtracking | When a backtracking regex engine explores exponentially many paths before concluding no match. The performance collapses from milliseconds to minutes. |
| Rolling hash | A hash function whose value can be updated in constant time as a window slides by one character. The key idea behind Rabin-Karp. |
| Edit distance | The minimum number of single-character insertions, deletions, or substitutions to transform string A into string B. |
| SIMD | Single Instruction, Multiple Data. A CPU feature that applies one operation (e.g., "compare") to 16 or 32 bytes simultaneously. The basis of ripgrep's speed advantage. |
| Failure link / failure table | KMP's precomputed table that records, for each position in the pattern, the length of the longest proper prefix that is also a suffix. Tells the algorithm where to restart safely on mismatch. |

---

## 19. Algorithm quick-reference table

For chapter author use when writing prose. Not necessarily for the published chapter.

| Algorithm | Preprocess? | Mismatch behavior | Best for | Not good for | Used in |
|---|---|---|---|---|---|
| Naive / brute force | No | Move 1 char right | Short patterns, small texts | Long patterns with repeated chars | Ctrl+F in short documents |
| KMP | Yes (pattern) | Jump via failure table | Streaming, guaranteed linear | Random text (constant factor) | Network packet scanners |
| Boyer-Moore | Yes (pattern) | Jump right-to-left | Long patterns, large alphabets | Short patterns (overhead not worth it) | GNU grep |
| Rabin-Karp | No | Move 1 char (hash) | Many patterns, plagiarism detection | Single-pattern fast search | Document fingerprinting |
| Aho-Corasick | Yes (all patterns) | Never restart | Thousands of patterns | Single-pattern search (overkill) | fgrep -F, IDS systems |
| Thompson NFA | Yes (regex→NFA) | Parallel state tracking | Safe regex matching, linear guarantee | Backreferences, lookaround | ripgrep, RE2, Go regexp |
| PCRE backtracking | Yes (regex→bytecode) | Try, backtrack, retry | Backreferences, lookaround, complex patterns | Adversarial inputs | Perl, Python re, JavaScript RegExp |
| Bitap/Shift-Or | Yes (bitmask) | Bitwise shift | Short patterns (≤63 chars), approximate matching | Long patterns | agrep |
| Levenshtein DP | No | Full table per pair | Any two short strings | Large dictionaries (too slow) | Spell-check baseline |
| Levenshtein automaton | Yes (per query word) | Prune by automaton state | Fuzzy dictionary lookup, typo search | Dynamic dictionaries | Apache Lucene fuzzy |
| BK-tree | Yes (offline index) | Prune by triangle inequality | Nearest-neighbor by edit distance | Frequent insertions | Spell-check dictionaries |
| fzf scoring | No (greedy first pass) | Bonus-weighted DP | Interactive file/command picking | Hard correctness requirement | fzf, IDE open-file dialogs |
