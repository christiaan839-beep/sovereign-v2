# The 20-minute qualification call

One call, twenty minutes, five of them across the week. The call has three jobs, in this
order: find out which half of the problem is real for this merchant, find out whether $2,500
is a number this person can approve, and find out whether they would work with you closely
enough to be a design partner. Selling the audit is the fourth job and it happens on its own
if the first three go well.

Take notes in the scoreboard at the end. Five calls only produce a decision if the answers
are written down in the same shape.

---

## Before the call

Two minutes. Open their storefront. Find one true, specific thing: a category with a
confusing structure, a size chart that contradicts itself, a policy page that answers a
question badly, a product family with fifteen variants. You will use it once, as evidence
you actually looked, and never again.

Do not rehearse a pitch. You are trying to learn something you do not currently know.

---

## 0-2 min · Frame

Say what this is and what it is not.

> "Twenty minutes, and I'm not going to pitch you. Anthropic and Shopify both published
> commerce-agent code in the last week and I'm trying to work out which end of it actually
> matters to merchants your size. I'll tell you what I do at the end if it's relevant. If
> it isn't, I'll say so."

Then: **"Before I ask anything, is there a version of this you've already looked at?"**
Their answer tells you whether you are educating or competing.

---

## 2-9 min · Which pain is real

This is the part the audit could not resolve on its own. The shopping agent serves customers.
The merchant agent serves staff. They are different products, different buyers and different
sales cycles, and you do not yet know which one merchants will pay for. Five calls will tell
you if you ask the same questions each time.

Ask about last month, not about the future. People describe the future they would like and
the past they actually had.

**Operations side:**

1. "Walk me through the last time you changed prices on more than ten items. Who decided,
   who made the change, and how long from decision to live?"
2. "Who in the business is allowed to change a price without asking anyone?"
3. "When something's out of stock or a supplier is late, how do you find out? Does someone
   check, or does something tell you?"
4. "How much of your week goes into working out why a number moved?"

**Customer side:**

5. "Roughly what share of your support volume is order status, returns and policy questions?"
6. "Where do customers ask you things today: email, WhatsApp, live chat, phone?"
7. "When someone can't find the right product on the site, what happens to them?"

**The separator.** Ask both of these and compare:

8. "If you could hand one repetitive thing to software tomorrow and have it done correctly,
   what would you pick?"
9. "Which one, if it got it wrong, would cost you the most?"

Answers to 8 and 9 that both land on the back office mean merchant-side pain. Both on the
customer means shopper-side. Split answers mean the risk is on one side and the labour on
the other, which is a real and useful finding — write down which is which.

**Scoring rule.** After the call, mark the merchant as MERCHANT-SIDE, SHOPPER-SIDE, BOTH or
NEITHER, based on questions 1-9 only, not on what they said they were excited about. If
three of five land on the same side, you have your answer for what to build next. If they
scatter, you do not have a market yet, and that is also an answer.

---

## 9-13 min · What price clears

Do not ask whether they would pay $2,500. Nobody answers that question honestly. Ask what
they have already paid, and who signs.

10. "Have you spent money on anything AI-related in the past year? What did it cost and what
    did you actually get out of it?"
11. "If you decided to spend $2,500 on a five-day assessment, is that something you approve
    yourself or does it go somewhere?"
12. "What's the smallest thing you've bought this year without needing anyone else's sign-off?"

Then state the offer plainly, once:

> "What I do is a five-day paid assessment. Fixed price, $2,500 or R40,000. Four documents:
> a map of which of the 27 methods in that reference implementation your systems can already
> answer, an assessment against the safety rules it enforces, a plan with effort, and a
> written go/no-go. No code, no demo. The recommendation is allowed to be don't build this."

And then the question that actually tests the offer:

13. **"If it came back and said don't build this, would that have been worth $2,500 to you?"**

A yes to 13 means they value the decision. A no means they want implementation and are using
you to price it, and the audit will never sell to them at any price.

**Do not discount.** Not in the first five calls, not for anyone. A yes at $1,200 tells you
nothing about whether the larger engagement above this one sells. If someone pushes on price,
write down the number they name and hold your own. The number they name is data.

---

## 13-17 min · Design partner

You want two things that are not money: permission to be named, and enough access to do the
work properly. Offer something real in exchange, and do not make it a discount.

14. "If this went well, would you be willing to be named as the first one? I'd want to
    publish a redacted version of the coverage map, with your systems anonymised."
15. "Would you want a say in what gets built after the assessment, or would you rather just
    be handed a result?"
16. "Could you give me a 90-minute call and two half-hours during the week, with whoever
    actually knows how your catalog works?"

What they get for saying yes: first access to whatever gets built, influence over its scope,
and the raw working files rather than a summary. Say it in those terms. A design partner who
is offered a discount understands the relationship as a discount.

A no to 14 is not a disqualifier. A no to 16 is, because the work cannot be done without it.

---

## 17-20 min · Close

One of three, decided by what you heard:

- **Qualified and interested.** "I'll send you the one-page scope within the hour. Read it,
  and tell me yes or no by [specific day]. A no is a fine answer and I'd rather have it fast."
- **Qualified, not now.** "When would be the right time to come back? Give me a month and
  I'll put it in the calendar and leave you alone until then." Get a date or treat it as a no.
- **Not qualified.** Say so and end early. "I don't think this is for you, and here's why."
  Then tell them the one useful thing you learned about their situation. It costs you two
  minutes and it is the only part of the call they will remember.

Never end with "let me send you some information."

---

## Disqualifiers: end the call early

Any of these, and the call stops being a qualification call. Say so kindly and use the
remaining minutes to give them something useful.

- **No named owner.** Nobody in the business owns the outcome of an agent project. It will
  be a committee, and a committee will not buy a five-day assessment from one person.
- **No system access, no path to it.** Their catalog and orders live somewhere with no API
  and no export, or on a platform they cannot read programmatically. There is nothing to map.
- **They want you to build it and will not pay to assess it.** Ask question 13. If the answer
  is no, this call is over.
- **They are collecting free proposals.** Signal: they ask you to put the coverage map in
  writing before there is an engagement. Answer once: "That's the deliverable." If they push
  again, end it.
- **Their problem is demand, not operations.** They want more traffic and more conversion.
  That is a real problem and it is not this one.
- **Timeline is next year.** Not a no, but not one of your five. Log the date and move on.
- **They cannot approve $2,500 and will not name who can.** If they will name the person,
  that is a different call with a different person, not a disqualification.

Asking for a discount is not a disqualifier. It is a data point about your price.

---

## The three objections you will actually get

Answer these by conceding what is true first. A prospect who catches you minimising a real
weakness stops believing the rest of the call, and all three of these weaknesses are real.

### "You don't have any reference customers."

**Concede it fully.** "That's true. You'd be the first for this. I have no case studies, no
clients I can put you on the phone with, and no logos. If reference customers are how you
make this decision, you should not buy this."

**Then redirect to what is actually checkable.** The exposure is $2,500 and five days, fixed,
with half of it payable only after you have read the documents. The deliverable is a document
you own outright, which you can hand to any implementer, including one who is not me. And
while you cannot check my clients, you can check my work: nine open-source compliance evidence
exporters, and a receipts library with 74 tests that I will tell you is not published to npm
yet, because it isn't. Read the code and judge from that.

**Do not** claim your other projects are equivalent experience. They are evidence you can
build and document carefully. They are not evidence you have done this audit before.

### "You don't have SOC 2."

**Concede it fully.** "No SOC 2, no ISO certification, no third-party security attestation.
One person, no audit programme."

**Then redirect to the design of the engagement.** The audit is deliberately built to require
neither production credentials nor customer data. Documentation, or read access to a sandbox,
is enough. If your security review is about what a vendor can reach, the answer here is
nothing, and that is a structural property of the work rather than a promise.

If it helps, say the sharper version: "I wrote the open-source exporters that assemble a SOC 2
evidence binder, which means I know exactly what's in one and exactly why I don't have one."
Say it once. It is a good line and it becomes a bad one if you lean on it.

**Do not** offer to "get SOC 2 if we work together." You will not, and they know it.

### "You're one person, and you're in another timezone."

**Concede both.** "Correct. One person, Cape Town, UTC+2. If I get sick in week one, there is
no second person, and the schedule slips."

**Then be concrete about the timezone,** which is the smaller of the two problems. UTC+2 is
the same clock as central Europe in summer and one hour ahead of the UK. For the US East
Coast the gap is six hours in September, so a 15:00 call here is 09:00 there, and there is a
usable window every afternoon. Say the actual hours you will hold rather than "flexible."

**Then bound the real risk honestly.** The bus-factor problem is genuine, and the reason it is
tolerable here is that the engagement is five days long and produces a document. If it goes
wrong, you have lost a week and $1,250. The place where single-operator risk becomes serious
is implementation, and this is not implementation. If we get to implementation and you need
continuity guarantees, that is a conversation about a different structure, and you should
raise it then.

**Do not** claim solo means faster or more focused. They have heard it and it is not why they
asked.

---

## Scoreboard: fill this in within ten minutes of each call

Same fields every time, or the five calls will not compare.

| Field | |
|---|---|
| Merchant, person, role | |
| Passed the disqualifier list? | yes / no + which one |
| Pain side (Q1-9) | merchant / shopper / both / neither |
| Their answer to Q8 (one thing to hand over) | |
| Their answer to Q9 (costliest to get wrong) | |
| Approves $2,500 alone? | yes / no / named the person who does |
| Answer to Q13 (worth it if the answer is no) | yes / no |
| Price they named, if they pushed | |
| Design partner: named reference / access / both / neither | |
| Outcome | scope sent / date set / dead |
| The one thing I did not expect | |

The last row is the reason to do five of these rather than one.
