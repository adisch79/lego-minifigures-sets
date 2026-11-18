# V2-17 Owner steps: Ko-fi, Amazon Associates, LEGO.com affiliate, LEGO question

Date 2026-11-18. Owner decisions (2026-11-17): plan approved, Ko-fi, affiliate sign-ups yes, ask LEGO yes.
Do the four parts in order. Each part ends with one thing to send back to the agent.

## 1. Ko-fi (donations)
1. Open https://ko-fi.com/ and sign up (email or Google).
2. Choose the page name `minifighunt` (the link becomes `https://ko-fi.com/minifighunt`). If taken, pick another short name.
3. Page settings > Payment tab > Connect PayPal (or Stripe). Connecting is free.
   SOURCE: https://help.ko-fi.com/hc/en-us/articles/360007522474-Connect-your-Stripe-account-and-start-earning
4. Stay on the Free plan. One-off tips cost 0% platform fee; PayPal/Stripe processing fees still apply.
   SOURCE: https://ko-fi.com/pricing , https://help.ko-fi.com/hc/en-us/articles/360002506494-Does-Ko-fi-take-a-fee
5. Send back: the page link. The agent puts it in `app/src/kofi.ts` (`KOFI_URL`); the "Coming soon" button becomes "Buy me a coffee".

## 2. Amazon Associates (affiliate, first shop)
1. Open https://affiliate-program.amazon.com/ and click Sign up. Use your normal Amazon account.
2. Website list: enter `https://minifighunt.com/`. Apps: none.
3. Profile: store ID `minifighunt` (Amazon adds `-20`), topic Toys / Hobbies, short description: "Fan catalogue of LEGO Collectible Minifigures series with a personal collection tracker."
4. Traffic questions: answer honestly (free, organic, small).
5. Fill tax and payment details when asked. These are yours only; do not send them to the agent.
6. Rules that matter (SOURCE: Amazon help center and operating agreement, https://affiliate-program.amazon.com/help/operating/policies ):
   - Amazon reviews the account only after 3 qualifying sales within 180 days of sign-up. Without them the application is closed; you may reapply later.
   - Your own purchases do not count.
   - Every page with links must show: "As an Amazon Associate I earn from qualifying purchases."
   - Toys rate: 3.00% (SOURCE: https://affiliate-program.amazon.com/help/node/topic/GRXPHT8U84RAYDXZ?lang=en ).
7. Send back: the store ID (for example `minifighunt-20`). It is not secret.

## 3. LEGO.com affiliate (apply in parallel)
1. You must be 18 or older. SOURCE: https://lego.com/page/affiliate-program
2. Open https://signup.linkshare.com/publishers/registration/landing (the LEGO page's Sign up button; LinkShare = Rakuten Advertising).
3. Register as a publisher with website `https://minifighunt.com/`, then search for the LEGO advertiser and apply.
4. Commission rate and cookie length are not published; they show after approval. SOURCE: https://lego.com/page/affiliate-program
5. Send back: approved or rejected, and the terms page (copy or screenshot) once approved. No links go live before the agent reads those terms.

## 4. Question to LEGO (removes the biggest UNKNOWN)
LEGO Fair Play allows the LEGO name only "in a non-commercial manner" and is silent on donations and affiliate links. The Fair Play page lists no fan-site contact; use the general form at https://www.lego.com/en-us/service ("Contact us").
SOURCE: https://www.lego.com/en-us/legal/notices-and-policies/fair-play/

Text to paste (edit freely):

> Subject: Fan site question: donations and affiliate links under Fair Play
>
> Hello,
>
> I run Minifig Hunt (https://minifighunt.com/), a free, unofficial fan site that lists the LEGO(R) Collectible Minifigures series and lets collectors track which figures they own. The site follows your Fair Play guidelines: no LEGO logo and no LEGO in the domain name. I am adding the (R) symbol and a footer disclaimer that the site is not sponsored or endorsed by the LEGO Group.
>
> To cover hosting costs I would like to add:
> 1. a voluntary "Buy me a coffee" donation link (Ko-fi), and
> 2. affiliate links to LEGO.com (through your affiliate program) and to Amazon on series pages.
>
> Is this acceptable under Fair Play? If not, which of the two is acceptable, or what should I change?
>
> The site shows official product images of the figures. Is that acceptable on a site with donation or affiliate links?
>
> Thank you,
> [your name]

Send back: LEGO's answer when it arrives. Until then: no affiliate links on live pages; Ko-fi link may go live (low risk, owner decision 2026-11-17).

## Gap found 2026-11-18
The live site has no Fair Play disclaimer and no (R) mark (`git grep` for "endorsed", "not sponsored", "®" in `app/src` on origin/dev: no hits). Backlog story V2-18 fixes this before any money link goes live.

## After the owner's answers
Backlog story V2-19: affiliate links (Amazon first): link placement mockups, disclosure line, click count.
