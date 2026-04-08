'use client';

import { useState, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import {
  Loader2, CheckCircle, Send, Inbox, Clock, FileText,
  Radio, CalendarClock, Sparkles, ShieldAlert, UserCheck,
  Trophy, RefreshCcw, TrendingUp, Megaphone,
} from 'lucide-react';
import type { Tables } from '@/types';
import { NIGERIAN_STATES, MAJOR_CITIES } from '@/types/location.types';

// ─── Types ────────────────────────────────────────────────────────────────────

type InboxRow = Pick<
  Tables<'notifications'>,
  'id' | 'type' | 'title' | 'message' | 'is_read' | 'created_at'
> & {
  scheduled_at?:    string | null;
  delivery_method?: string | null;
};

type SentRow = Pick<
  Tables<'admin_action_logs'>,
  'id' | 'action_type' | 'reason' | 'created_at' | 'target_user_id'
>;

interface MessagingClientProps {
  inbox:           InboxRow[];
  sentLog:         SentRow[];
  onSendDirect:    (fd: FormData) => Promise<void>;
  onSendBroadcast: (fd: FormData) => Promise<void>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTIF_TYPES = [
  'admin_warning',
  'level_1_advisory',
  'level_2_warning',
  'account_under_review',
  'account_suspended',
  'account_reinstated',
  'verification_reminder',
  'milestone',
  'trust_score_alert',
  'reengagement',
  'general_announcement',
  'account_update',
  'platform_notice',
  'new_feature',
];

const AUDIENCES = [
  { value: 'all',        label: 'All active users'                  },
  { value: 'freelancer', label: 'Freelancers only'                  },
  { value: 'client',     label: 'Clients only'                      },
  { value: 'both',       label: 'Dual-role users'                   },
  { value: 'inactive',   label: 'Inactive users (re-engagement)'    },
  { value: 'low_trust',  label: 'Users below trust score threshold' },
  { value: 'unverified', label: 'Unverified accounts'               },
  { value: 'state',      label: 'Users by state / city'             },
];

const DELIVERY_METHODS = [
  { value: 'both',   label: 'In-App + Inbox' },
  { value: 'in_app', label: 'In-App only'    },
  { value: 'inbox',  label: 'F9 Inbox only'  },
];

// Canonical state list sourced from location.types.ts (DB-aligned, 'FCT' not 'FCT (Abuja)')
const NG_STATES = [...NIGERIAN_STATES] as string[];

// ─── Template library ─────────────────────────────────────────────────────────

type TemplateCategory =
  | 'enforcement'
  | 'verification'
  | 'milestone'
  | 'seasonal'
  | 'reengagement'
  | 'trust'
  | 'platform';

interface Template {
  id:       string;
  label:    string;
  category: TemplateCategory;
  type:     string;
  title:    string;
  message:  string;
}

const TEMPLATES: Template[] = [

  // ── Enforcement ─────────────────────────────────────────────────────────────

  {
    id:       'level_1_advisory',
    label:    'Level 1 Advisory Notice',
    category: 'enforcement',
    type:     'level_1_advisory',
    title:    'Advisory Notice — We Noticed Something',
    message:
`We want to be upfront with you: our systems flagged some recent activity on your account that we'd like you to be aware of. Specifically, [DESCRIBE BEHAVIOUR — e.g. "a pattern of late order deliveries" / "a client dispute that was escalated"].

This isn't an accusation — it's an early heads-up, given before anything formal happens. F9 works because our community holds itself to a high standard, and we believe you're fully capable of meeting that standard.

No action has been taken on your account at this time. Please review our Community Guidelines and, if you have any context or questions, reach out to our support team. We'd rather talk than escalate.`,
  },

  {
    id:       'level_2_warning',
    label:    'Level 2 Formal Warning',
    category: 'enforcement',
    type:     'level_2_warning',
    title:    'Formal Warning — Action Required',
    message:
`This is a Level 2 Formal Warning issued to your F9 account.

Following a previous advisory notice regarding [DESCRIBE BEHAVIOUR], our team has observed that the conduct in question has continued. This constitutes a direct violation of F9's Terms of Service (Section [X]) and/or our Marketplace Guidelines.

This warning is now a permanent record on your account. Any further violations will result in account suspension without an additional warning stage.

We take no pleasure in issuing this notice — our obligation is to protect every member of this community equally. If you believe this warning was issued in error, please raise a formal dispute within 48 hours of receiving this message and our review team will assess your case.`,
  },

  {
    id:       'account_under_review',
    label:    'Account Under Review',
    category: 'enforcement',
    type:     'account_under_review',
    title:    'Your Account is Currently Under Review',
    message:
`We're writing to let you know that your F9 account has been placed under a temporary administrative review.

During this period, some platform features may be restricted while our team examines [REASON — or leave as "a flagged activity on your account"]. This is standard procedure and does not mean any final decision has been made — a review is exactly that: a review.

We aim to complete all account reviews within 72 hours. You do not need to take any action right now. If our team requires additional information from you, we will reach out directly through this channel.

Thank you for your patience. We understand this is inconvenient, and we commit to resolving it as quickly as possible.`,
  },

  {
    id:       'account_suspended',
    label:    'Account Suspended',
    category: 'enforcement',
    type:     'account_suspended',
    title:    'Your Account Has Been Suspended',
    message:
`Your F9 account has been suspended [for X days / until further notice] following a review of your recent activity on the platform.

Reason for suspension: [REASON]

During your suspension:
— You will not be able to post services, apply for jobs, or accept new orders.
— Active orders already in progress will be managed by our dispute resolution team.
— You will not be able to initiate withdrawals.
— Any funds in your wallet are fully safe and will remain intact throughout.

If you believe this decision was made in error, you have 48 hours from the date of this notice to file a formal appeal by raising a support ticket. Our team reviews every appeal personally.

We do not take suspension lightly — it is always a last resort, taken only when the integrity of the platform requires it.`,
  },

  {
    id:       'account_reinstated',
    label:    'Account Reinstated',
    category: 'enforcement',
    type:     'account_reinstated',
    title:    'Your Account Has Been Reinstated — Welcome Back',
    message:
`Good news: your F9 account is now fully active again.

After a thorough review of your case, we have lifted the suspension and restored full access to all platform features — your profile, your wallet, your service listings, and your order history are all exactly as you left them.

We're glad to have you back, and we want this to feel like a genuine fresh start. The F9 community is stronger with you in it.

A reminder that our Community Guidelines remain in full effect, applied consistently and fairly to everyone on the platform. If you have any outstanding questions about your case or anything you'd like to discuss, our support team is here.

Welcome back.`,
  },

  // ── Verification ─────────────────────────────────────────────────────────

  {
    id:       'verification_reminder',
    label:    'Verification Reminder (General)',
    category: 'verification',
    type:     'verification_reminder',
    title:    "Complete Your Verification — You're Leaving Value on the Table",
    message:
`Your F9 account currently has [pending / incomplete] verification steps, and it's worth taking ten minutes to finish them.

What completing your verification unlocks:
— Your Trust Score increases immediately (up to +25 points depending on verification type).
— Your withdrawal limit rises from ₦50,000 to ₦500,000.
— Your profile displays verified badges that clients actively look for when comparing freelancers.
— You gain access to higher-value job categories and premium platform features.

Verified freelancers receive significantly more client enquiries than unverified accounts — the difference in profile views is measurable. The platform was built to reward trust, and verification is how you signal it.

Tap below to complete your remaining steps. It takes under ten minutes, and it unlocks everything.`,
  },

  {
    id:       'verification_student',
    label:    'Student Verification Reminder',
    category: 'verification',
    type:     'verification_reminder',
    title:    'Verify Your Student Status — F9 Was Built for You',
    message:
`F9 exists, in part, because of Nigerian university students. You are exactly the person this platform was designed to support — ambitious, skilled, in need of a legitimate marketplace that takes you seriously and pays you fairly.

Completing your student verification unlocks:
— The Student Verified badge on your public profile.
— Access to the F9 Student Marketplace, where clients specifically look for student talent.
— Eligibility for F9's campus ambassador programme (launching soon).
— A Trust Score boost that puts you ahead of unverified competitors from day one.

All you need is a valid student ID from a recognised Nigerian university. The process takes under five minutes and is entirely free.

Your degree is not just a certificate — it's a signal. Let's make sure the marketplace sees it.`,
  },

  {
    id:       'verification_identity',
    label:    'Identity / Liveness Verification',
    category: 'verification',
    type:     'verification_reminder',
    title:    'One Final Step: Verify Your Identity',
    message:
`Your F9 account is almost fully verified — there's one step remaining, and it's the most important one.

Identity verification is how F9 guarantees that every person on this platform is who they say they are. It protects you from impersonators, builds client confidence, and makes the entire marketplace safer for everyone involved.

What it involves:
1. A short liveness check (under 60 seconds, done directly in your browser — no app required).
2. A photo of any valid Nigerian government-issued ID (NIN slip, voter's card, driver's licence, or international passport).

What you get in return:
— Your Trust Score increases by up to 20 points immediately.
— Your daily withdrawal limit doubles.
— The Identity Verified badge appears on your profile — one of the most trusted signals clients look for.

Your data is processed securely using industry-standard encryption and is never shared with third parties. This is purely about trust — yours and ours.

It takes less than three minutes. Tap below to complete this final step.`,
  },

  // ── Milestone ────────────────────────────────────────────────────────────

  {
    id:       'milestone_first_order',
    label:    'First Order Completed',
    category: 'milestone',
    type:     'milestone',
    title:    "Your First Order on F9 — That's a Big Deal \uD83C\uDF89",
    message:
`You just completed your first order on F9. We don't say this lightly: that matters.

Starting anything new takes a kind of courage that doesn't get enough credit. You put your skills in front of a stranger, made a commitment, and delivered on it. That's the whole game — and you've already started playing it.

Your Trust Score has been updated. Your completed jobs count is on the board. Your profile is now the profile of someone who has done this — not just someone who signed up.

From here, each order builds your reputation, your rating, and your earning power on the platform. The compounding effect of consistent quality work on F9 is real, and it starts with exactly what you just did.

Keep going.`,
  },

  {
    id:       'milestone_earnings',
    label:    'Earnings Milestone',
    category: 'milestone',
    type:     'milestone',
    title:    '\u20A6[AMOUNT] Earned on F9 \uD83D\uDCB0',
    message:
`\u20A6[AMOUNT] earned on F9. Let that sit for a moment.

That is real money — generated by your skill, your reliability, and your decision to show up consistently on this platform. Not a salary someone handed you. Not a favour. Something you built.

You've joined a growing group of Nigerian professionals creating genuine, sustainable income through the digital economy — on their own terms, on their own schedule. That group is still small enough that being in it means something.

This milestone has been noted on your account record. Your next threshold is \u20A6[NEXT AMOUNT].

There's more where that came from. Keep building.`,
  },

  {
    id:       'milestone_trust_tier',
    label:    'Trust Tier Upgrade',
    category: 'milestone',
    type:     'milestone',
    title:    "You've Been Promoted — [NEW TIER] Trust Tier \uD83C\uDFC5",
    message:
`Your Trust Score has crossed into the [NEW TIER] tier, and we want to make sure you understand what that means: you earned this.

Trust tier upgrades on F9 are not automatic or time-based. They reflect a sustained pattern of quality — completing orders on time, maintaining strong client ratings, keeping your account in good standing, and demonstrating the kind of integrity the platform was built to reward.

What the [NEW TIER] tier unlocks for you:
[LIST BENEFITS — e.g. "— Lower commission rate (X% → Y%)" / "— Withdrawal limit increased to \u20A6X" / "— Priority dispute resolution" / "— Featured placement in search results"]

Clients who browse F9 actively filter by Trust Tier. Moving up is not just a badge — it is a measurable commercial advantage. This is a significant milestone.

You've earned it.`,
  },

  {
    id:       'milestone_jobs_count',
    label:    'Jobs Completed Milestone',
    category: 'milestone',
    type:     'milestone',
    title:    '[X] Jobs Completed on F9 \uD83C\uDFAF',
    message:
`[X] jobs. Not started — completed. There's a real difference, and you know it.

That number represents [X] clients whose problems you solved, [X] deadlines you met, and [X] instances where someone trusted you with their work and you came through. That track record doesn't happen by accident.

You're now in the top [X%] of active freelancers on F9 by total orders completed. Clients browsing the marketplace notice numbers like this — it's often the first thing they look at when comparing profiles.

Your profile has been updated to reflect this achievement. The next milestone is [NEXT NUMBER].

Keep the streak alive.`,
  },

  {
    id:       'milestone_perfect_rating',
    label:    'Perfect Rating Streak',
    category: 'milestone',
    type:     'milestone',
    title:    '[X] Consecutive 5-Star Reviews \u2B50',
    message:
`[X] five-star reviews in a row. Not one client, across [X] separate transactions, found a reason to give you anything less than perfect.

That is genuinely hard to do — and it tells us something about you that goes beyond skill. It means you communicate. You manage expectations. You deliver what you promised, on time, and people feel taken care of when they work with you. That's a complete package, and it's rare.

F9 exists to surface talent like yours and connect it with the people who need it. Your rating streak is doing that work for you every time a client loads your profile.

This achievement has been noted on your account. We thought you should know that we noticed.`,
  },

  // ── Seasonal ─────────────────────────────────────────────────────────────

  {
    id:       'seasonal_ramadan',
    label:    'Ramadan Kareem',
    category: 'seasonal',
    type:     'general_announcement',
    title:    'Ramadan Kareem from the F9 Family \uD83C\uDF19',
    message:
`As the blessed month of Ramadan begins, the entire F9 team extends our warmest greetings to every member of our community who is observing the fast.

Ramadan Kareem.

This is a month of spiritual depth, communal generosity, and extraordinary endurance — and we see that endurance reflected every day in the way our community shows up to do great work, even under conditions most people wouldn't manage.

We hope this month brings you clarity, barakah, and genuine rest alongside the work. From all of us: Ramadan Kareem. \uD83C\uDF19`,
  },

  {
    id:       'seasonal_eid_al_fitr',
    label:    'Eid al-Fitr Greetings',
    category: 'seasonal',
    type:     'general_announcement',
    title:    'Eid Mubarak from All of Us at F9 \uD83C\uDF19\u2728',
    message:
`As the holy month of Ramadan draws to a close, the entire F9 team wishes you and your loved ones a joyful and deeply peaceful Eid al-Fitr.

You fasted, you worked, you delivered — and today you celebrate. That combination of discipline and joy is exactly the spirit that F9 was built around.

May this Eid bring you rest, gratitude, and the kind of quiet happiness that comes from knowing you showed up fully for something. And may the year ahead bring everything you've been working toward — on this platform and far beyond it.

Eid Mubarak — from every person on the F9 team to every person in this community. \uD83C\uDF19\u2728`,
  },

  {
    id:       'seasonal_eid_al_adha',
    label:    'Eid al-Adha / Sallah Greetings',
    category: 'seasonal',
    type:     'general_announcement',
    title:    'Eid al-Adha Mubarak — Sallah Greetings from F9 \uD83D\uDC11',
    message:
`To our Muslim community members marking Eid al-Adha — Sallah Mubarak from the entire F9 family.

This is a season rooted in sacrifice, gratitude, and the willingness to give what is precious in service of something greater. Those are not just religious virtues — they are the values at the heart of every honest piece of work done on this platform.

We are grateful to share a community with people who carry those values into their professional lives every day.

May your celebration be filled with blessings, your homes with warmth and laughter, and the year ahead with every kind of prosperity — on F9 and far beyond it.

Eid Mubarak. \uD83D\uDC11`,
  },

  {
    id:       'seasonal_christmas',
    label:    'Christmas Greetings',
    category: 'seasonal',
    type:     'general_announcement',
    title:    'Merry Christmas from the F9 Team \uD83C\uDF84',
    message:
`To everyone in our community celebrating Christmas — Merry Christmas from the entire F9 family.

This has been a year of real work, real growth, and real money earned by real people on this platform. Before the new year arrives with its fresh ambitions, we wanted to stop and say: we are proud of the community we are building together, and we do not take your presence in it for granted.

We hope this season gives you exactly what you need — whether that's laughter with family, rest you've genuinely earned, a good meal, or simply a few quiet days before the next chapter begins.

Thank you for choosing F9 as part of your year. See you on the other side.

Merry Christmas. \uD83C\uDF84`,
  },

  {
    id:       'seasonal_new_year',
    label:    'New Year Greetings',
    category: 'seasonal',
    type:     'general_announcement',
    title:    "Happy New Year — Here's to [YEAR] \uD83E\uDD42",
    message:
`A new year is a rare thing: a clean slate, a new chapter, and the permission — if you choose to take it — to do things differently.

The F9 team is deeply grateful for what we built together in [PREVIOUS YEAR]. The freelancers who delivered excellence under pressure. The clients who trusted our escrow with their money and our community with their projects. The students who chose this platform as the place to start their professional lives. Every person who gave us a chance — thank you.

In [YEAR], we're going further. More features, more opportunities, more ways to earn and grow. We have every intention of making F9 the most trusted freelance marketplace in Nigeria — because you deserve that infrastructure.

Happy New Year. Here's to [YEAR]. \uD83E\uDD42`,
  },

  {
    id:       'seasonal_independence',
    label:    'Independence Day (Oct 1)',
    category: 'seasonal',
    type:     'general_announcement',
    title:    'Happy Independence Day — October 1st \uD83C\uDDF3\uD83C\uDDEC',
    message:
`On this day in 1960, Nigeria declared itself to the world. The declaration continues — not just in government buildings, but in the work of millions of ordinary Nigerians who refuse to let their circumstances define their ceiling.

F9 was built on a single belief: that Nigerian talent is world-class, and that it deserves a platform built to match that standard. Every order completed on this platform, every skill sold, every naira earned, every trust tier crossed — that is Nigeria's future announcing itself.

To every freelancer, every client, every student entrepreneur who chose to build something real on F9: you are not waiting for Nigeria to become great. You are the evidence that it already is.

Happy Independence Day. \uD83C\uDDF3\uD83C\uDDEC`,
  },

  // ── Re-engagement ─────────────────────────────────────────────────────────

  {
    id:       'reengagement_general',
    label:    "We've Missed You (General)",
    category: 'reengagement',
    type:     'reengagement',
    title:    "We've Missed You on F9",
    message:
`It's been a while since we've seen you active on F9, and we genuinely wanted to check in.

The platform has grown since your last visit — [LIST 1-2 NEW THINGS, e.g. "we've improved dispute resolution turnaround times and added new freelancer categories"]. There are currently [X] open opportunities in your area of the platform, and your account is still live and in good standing.

If something about your experience wasn't working for you, we want to know. Reply to this message or open a support ticket, and a real person from our team will respond. F9 is built in direct response to community feedback — your input changes things.

And if life simply got in the way — that's fine too. Come back when you're ready. Everything is exactly as you left it.`,
  },

  {
    id:       'reengagement_freelancer',
    label:    'Dormant Freelancer Win-Back',
    category: 'reengagement',
    type:     'reengagement',
    title:    'Your Skills Are Still in Demand on F9',
    message:
`You built a profile on F9, and then — for whatever reason — the momentum paused. We get it. Life is not a straight line.

But here's what hasn't paused: there are clients on this platform right now, actively searching for someone with your skills in [SKILL AREA / LOCATION]. Your profile is still live. Your reviews are still visible. You can start accepting work again today without setting anything up from scratch.

The Nigerian freelance market is moving faster than it ever has, and F9 is at the centre of it. New clients join every week. New job categories are opening. The window to establish a strong reputation is still open — but it won't stay open forever.

Don't let your spot go to someone else. Log in and pick up where you left off.`,
  },

  {
    id:       'reengagement_client',
    label:    'Dormant Client Win-Back',
    category: 'reengagement',
    type:     'reengagement',
    title:    'Ready to Get Things Done? F9 Is Here',
    message:
`It's been a while since you posted a job on F9. Whether your last project wrapped up, your priorities shifted, or life simply got busy — we're here when you're ready for what's next.

The platform is better than when you left it. We've added [X] new verified freelancers, improved our dispute resolution process, and strengthened our escrow system so your money is protected at every stage of a project.

Whatever you're building next — your next product, campaign, idea, or event — F9 has the talent to help you make it happen. Nigerian professionals with the skills to deliver, screened through our Trust Score system, protected by escrow from start to finish.

Post a job today. It takes five minutes, and the right person might respond by tomorrow morning.`,
  },

  // ── Trust ─────────────────────────────────────────────────────────────────

  {
    id:       'trust_score_warning',
    label:    'Trust Score Warning',
    category: 'trust',
    type:     'trust_score_alert',
    title:    'Your Trust Score Needs Attention',
    message:
`We're reaching out because your Trust Score has dropped to [SCORE] — below the [THRESHOLD] threshold F9 uses to determine unrestricted platform access.

This may have been triggered by one or more of: late order delivery, an escalated client dispute, account inactivity, or a pattern of cancelled orders. If you're not sure what happened, open a support ticket and we'll walk you through the specific events that affected your score.

What a low Trust Score affects:
— Your visibility in marketplace search results.
— Your withdrawal limits.
— Your eligibility for certain premium features and job categories.

The important thing: Trust Scores are designed to recover. They are not permanent judgements. Completing your next order on time, resolving any open disputes, and finishing pending verification steps will move your score back in the right direction — visibly, within days.

You built a reputation on this platform. Let's rebuild it.`,
  },

  {
    id:       'trust_score_recovery',
    label:    'Trust Score Recovery Notice',
    category: 'trust',
    type:     'trust_score_alert',
    title:    'Your Trust Score Is Moving in the Right Direction \u2197',
    message:
`We wanted you to know: your Trust Score has improved to [NEW SCORE] and is trending upward.

Whatever you've been doing — completing orders reliably, earning strong reviews, resolving previous issues, finishing verification steps — it's working. The system is seeing it, and it's responding.

F9's Trust Score is designed to do exactly this: punish nothing permanently, and reward sustained, honest effort. You've demonstrated that effort, and your score reflects it.

At [NEXT THRESHOLD], you'll unlock [NEXT BENEFIT — e.g. "the Standard trust tier" / "an increased withdrawal limit" / "priority search placement"]. You're [X points] away.

Keep it up. You're heading in the right direction.`,
  },

  // ── Platform ─────────────────────────────────────────────────────────────

  {
    id:       'maintenance',
    label:    'Scheduled Maintenance',
    category: 'platform',
    type:     'platform_notice',
    title:    'Scheduled Platform Maintenance — [DATE]',
    message:
`F9 will undergo scheduled maintenance on [DATE] from [START TIME] to [END TIME] WAT.

During this window, the following may be temporarily unavailable:
— The marketplace (job postings, service listings, order creation)
— Payment processing and withdrawal requests
— The in-app messaging system

Your data, wallet balance, and active orders are completely safe throughout. No transactions will be lost or affected during the maintenance window.

We've scheduled this work during off-peak hours to minimise disruption. If the maintenance extends beyond [END TIME], we'll send an update immediately.

We apologise in advance for any inconvenience, and appreciate your patience as we keep the platform at its best.`,
  },

  {
    id:       'policy_update',
    label:    'Policy / Terms Update',
    category: 'platform',
    type:     'platform_notice',
    title:    'Important Update to Our Terms of Service',
    message:
`We've updated F9's Terms of Service and Marketplace Guidelines, effective [DATE].

The key changes are:
— [CHANGE 1 — be specific, e.g. "Updated commission rates for Gold and above trust tiers"]
— [CHANGE 2 — e.g. "Revised dispute resolution timeline from 7 to 5 business days"]
— [CHANGE 3 — e.g. "New prohibited service categories added to Marketplace Guidelines"]

You can read the full updated Terms at [LINK]. We've written them to be as readable as possible — not the kind of legal document you need a lawyer to interpret.

If you have questions about how these changes affect your account specifically, our support team is here. Continued use of the platform after [DATE] constitutes acceptance of the revised terms.

We believe in being upfront about how we operate. That's why we're telling you exactly what changed — not just that something did.`,
  },

  {
    id:       'new_feature',
    label:    'New Feature Announcement',
    category: 'platform',
    type:     'new_feature',
    title:    'Something New Just Landed on F9 \u2728',
    message:
`We're excited to introduce [FEATURE NAME] — [ONE CLEAR SENTENCE: what it does and who it's for].

[2-3 SENTENCES: How it works, how to access it, what problem it solves. Be specific. "You can find it under Settings > [X]" is more useful than "explore the new feature today."]

This came directly from feedback submitted by our community. We build F9 in response to what you tell us — and this is proof that it works.

If you find something that isn't working the way it should, we want to hear it. Open a support ticket or reply to this message. A real person will respond.`,
  },

  {
    id:       'promo',
    label:    'Promotional Broadcast',
    category: 'platform',
    type:     'general_announcement',
    title:    '[HEADLINE — specific, not generic]',
    message:
`[OPENING — one sentence that earns the reader's next 20 seconds. Start with the value, not the announcement. Avoid "We're excited to announce."]

[BODY — 2-3 sentences. What is it? Who is it for? What does it change for them? Be concrete: \u20A6 amounts, percentages, dates, numbers. Vague promotions don't land.]

[CTA — one clear action. "Post a job today." / "Withdraw your earnings now." / "Upgrade your profile before [DATE]." Not "Learn more" — that's a deferral, not an action.]

[OPTIONAL CLOSING — one human sentence. Not a disclaimer. Something that makes opening this message feel worth it.]`,
  },
];

// ─── Category display metadata ─────────────────────────────────────────────────

const CATEGORY_META: Record<
  TemplateCategory,
  { label: string; colour: string; icon: React.ElementType }
> = {
  enforcement:  { label: 'Enforcement',   colour: 'bg-red-100 text-red-700',       icon: ShieldAlert },
  verification: { label: 'Verification',  colour: 'bg-blue-100 text-blue-700',     icon: UserCheck   },
  milestone:    { label: 'Milestone',     colour: 'bg-green-100 text-green-700',   icon: Trophy      },
  seasonal:     { label: 'Seasonal',      colour: 'bg-amber-100 text-amber-700',   icon: Sparkles    },
  reengagement: { label: 'Re-engagement', colour: 'bg-purple-100 text-purple-700', icon: RefreshCcw  },
  trust:        { label: 'Trust',         colour: 'bg-cyan-100 text-cyan-700',     icon: TrendingUp  },
  platform:     { label: 'Platform',      colour: 'bg-gray-100 text-gray-700',     icon: Megaphone   },
};

const CATEGORY_ORDER: TemplateCategory[] = [
  'enforcement', 'verification', 'milestone', 'seasonal', 'reengagement', 'trust', 'platform',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dt(s: string | null | undefined) {
  if (!s) return 'N/A';
  return new Date(s).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' });
}

function nowLocal() {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

type FeedbackState = 'idle' | 'pending' | 'ok' | 'error';

// ─── Compose Tab ──────────────────────────────────────────────────────────────

function ComposeTab({
  onSendDirect,
  onSendBroadcast,
  seed,
}: {
  onSendDirect:    (fd: FormData) => Promise<void>;
  onSendBroadcast: (fd: FormData) => Promise<void>;
  seed: { type: string; title: string; message: string } | null;
}) {
  const [mode,           setMode]           = useState<'direct' | 'broadcast'>('direct');
  const [feedback,       setFeedback]       = useState<FeedbackState>('idle');
  const [isPending,      start]             = useTransition();

  const [type,           setType]           = useState(seed?.type    ?? NOTIF_TYPES[0]);
  const [title,          setTitle]          = useState(seed?.title   ?? '');
  const [message,        setMessage]        = useState(seed?.message ?? '');
  const [link,           setLink]           = useState('');
  const [recipient,      setRecipient]      = useState('');
  const [audience,       setAudience]       = useState('all');
  const [deliveryMethod, setDeliveryMethod] = useState('both');
  const [scheduledAt,    setScheduledAt]    = useState('');

  // audience-specific filter fields
  const [trustThreshold, setTrustThreshold] = useState('40');
  const [selectedState,  setSelectedState]  = useState<string>(NG_STATES[0]);
  // selectedCity: '' means "All cities" — no city filter applied
  const [selectedCity,   setSelectedCity]   = useState<string>('');
  // inactive threshold: days since last login
  const [inactiveDays,   setInactiveDays]   = useState('30');

  const isScheduled        = scheduledAt.trim().length > 0;
  const hasUnfilledBracket = message.includes('[') && message.includes(']');

  // Cities available for the currently selected state (may be empty for states
  // not in MAJOR_CITIES, which is fine — city dropdown will only show "All")
  const citiesForState: string[] = MAJOR_CITIES[selectedState] ?? [];

  const applyTemplate = (t: Template) => {
    setType(t.type);
    setTitle(t.title);
    setMessage(t.message);
  };

  const handleStateChange = (newState: string) => {
    setSelectedState(newState);
    // Reset city selection whenever state changes — avoids stale city values
    setSelectedCity('');
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    // Append audience-specific filter values so the server action can apply them
    if (mode === 'broadcast') {
      if (audience === 'low_trust') fd.set('trust_threshold', trustThreshold);
      if (audience === 'inactive')  fd.set('inactive_days',   inactiveDays);
      if (audience === 'state') {
        fd.set('state', selectedState);
        // Only send 'city' when a specific city is chosen — empty string means
        // "all cities in this state", which the server action interprets as no
        // city-level filter.
        if (selectedCity) fd.set('city', selectedCity);
      }
    }

    const action = mode === 'direct' ? onSendDirect : onSendBroadcast;
    setFeedback('pending');
    start(async () => {
      try {
        await action(fd);
        setFeedback('ok');
        setTitle(''); setMessage(''); setLink('');
        setRecipient(''); setScheduledAt(''); setDeliveryMethod('both');
        setTimeout(() => setFeedback('idle'), 3000);
      } catch (err) {
        console.error(err);
        setFeedback('error');
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {(['direct', 'broadcast'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              mode === m ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {m === 'direct' ? <Send size={14} /> : <Radio size={14} />}
            {m === 'direct' ? 'Direct Message' : 'Broadcast'}
          </button>
        ))}
      </div>

      {mode === 'broadcast' && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
          Broadcast sends to the selected audience segment (up to 500 users per batch). This action is logged and irreversible.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'direct' ? (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Recipient Email</label>
            <input
              name="recipient_email" type="email" required value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Audience Segment</label>
              <select
                name="audience" value={audience} onChange={(e) => setAudience(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>

            {/* Trust score threshold — shown when audience is low_trust */}
            {audience === 'low_trust' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Trust Score Threshold (send to users <em>below</em> this value)
                </label>
                <input
                  type="number" min={0} max={100} value={trustThreshold}
                  onChange={(e) => setTrustThreshold(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Users with a trust score strictly below <strong>{trustThreshold}</strong> will receive this message.
                </p>
              </div>
            )}

            {/* State + city selectors — shown when audience is state */}
            {audience === 'state' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Target State</label>
                  <select
                    value={selectedState}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {NG_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Only users whose profile state matches <strong>{selectedState}</strong> will
                    be considered. Optionally narrow further by city below.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Target City <span className="text-gray-400 font-normal">(optional &mdash; leave as &ldquo;All cities&rdquo; to target the entire state)</span>
                  </label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">All cities in {selectedState}</option>
                    {citiesForState.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {citiesForState.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      No major cities are listed for <strong>{selectedState}</strong> — state-wide broadcast only.
                    </p>
                  )}
                  {selectedCity && (
                    <p className="text-xs text-blue-600 mt-1 font-medium">
                      Broadcast will be limited to users in <strong>{selectedCity}</strong>, {selectedState}.
                    </p>
                  )}
                  {!selectedCity && citiesForState.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      All {citiesForState.length} listed cities in {selectedState} are included.
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Inactivity window — shown when audience is inactive */}
            {audience === 'inactive' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Inactivity Window (days since last login)
                </label>
                <input
                  type="number" min={7} max={365} value={inactiveDays}
                  onChange={(e) => setInactiveDays(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Users who have not logged in for at least <strong>{inactiveDays} days</strong> will receive this message.
                </p>
              </div>
            )}
          </>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Method</label>
          <select
            name="delivery_method" value={deliveryMethod}
            onChange={(e) => setDeliveryMethod(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {DELIVERY_METHODS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notification Type</label>
          <select
            name="type" value={type} onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {NOTIF_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
          <input
            name="title" type="text" required value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Notification title"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
          <textarea
            name="message" required value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={9} placeholder="Notification body text…"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          {hasUnfilledBracket && (
            <p className="text-xs text-amber-600 mt-1 font-medium">
              This message contains unfilled [BRACKET] placeholders. Replace all of them before sending.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Link (optional)</label>
          <input
            name="link" type="text" value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="/some/page or https://..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            <span className="flex items-center gap-1.5">
              <CalendarClock size={12} />
              Schedule Delivery (optional — leave blank to send immediately)
            </span>
          </label>
          <input
            name="scheduled_at" type="datetime-local" value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            min={nowLocal()}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          {isScheduled && (
            <p className="text-xs text-blue-600 mt-1 font-medium">
              Will be queued and delivered at{' '}
              {new Date(scheduledAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })} WAT
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit" disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {isPending
              ? <Loader2 size={14} className="animate-spin" />
              : isScheduled ? <CalendarClock size={14} /> : <Send size={14} />}
            {mode === 'direct'
              ? (isScheduled ? 'Schedule Message' : 'Send Message')
              : (isScheduled ? 'Schedule Broadcast' : 'Broadcast Now')}
          </button>
          {feedback === 'ok' && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle size={12} />
              {isScheduled ? 'Scheduled successfully' : 'Sent successfully'}
            </span>
          )}
          {feedback === 'error' && (
            <span className="text-xs text-red-600 font-medium">Failed — check recipient and try again</span>
          )}
        </div>
      </form>

      <div className="pt-4 border-t border-gray-100 space-y-3">
        <p className="text-xs font-semibold text-gray-500 uppercase">Quick-fill from Template</p>
        {CATEGORY_ORDER.map((cat) => {
          const items = TEMPLATES.filter((t) => t.category === cat);
          if (!items.length) return null;
          const meta = CATEGORY_META[cat];
          return (
            <div key={cat} className="flex flex-wrap items-center gap-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${meta.colour}`}>
                {meta.label}
              </span>
              {items.map((t) => (
                <button
                  key={t.id} type="button" onClick={() => applyTemplate(t)}
                  className="px-3 py-1 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                  {t.label}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Inbox Tab ────────────────────────────────────────────────────────────────

function InboxTab({ inbox }: { inbox: InboxRow[] }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">
        Notifications received by your admin account. Scheduled messages appear once their delivery time has passed.
      </p>
      {inbox.length === 0 ? (
        <p className="text-sm text-gray-400 italic">Inbox is empty.</p>
      ) : (
        <ul className="space-y-2">
          {inbox.map((n) => (
            <li key={n.id} className={`p-3 rounded-lg border text-sm ${n.is_read ? 'bg-white border-gray-100' : 'bg-blue-50 border-blue-200'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{n.title}</p>
                  <p className="text-gray-600 mt-0.5 whitespace-pre-line">{n.message}</p>
                  {n.delivery_method && (
                    <p className="text-xs text-gray-400 mt-1">
                      via <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">{n.delivery_method}</span>
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <span className="block text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                    {n.type.replace(/_/g, ' ')}
                  </span>
                  <p className="text-xs text-gray-400">{dt(n.created_at)}</p>
                  {n.scheduled_at && (
                    <p className="text-xs text-blue-500 flex items-center gap-1 justify-end">
                      <CalendarClock size={10} /> {dt(n.scheduled_at)}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Broadcast History Tab ────────────────────────────────────────────────────

function BroadcastHistoryTab({ sentLog }: { sentLog: SentRow[] }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">
        All direct messages and broadcasts sent by admin accounts, sourced from{' '}
        <code className="bg-gray-100 px-1 rounded">admin_action_logs</code>.
        Scheduled entries appear here at submission time; delivery fires at the scheduled time.
      </p>
      {sentLog.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No sent messages yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-gray-50">
              <tr>
                {['Type', 'Details', 'Recipient / Segment', 'Sent At'].map((h) => (
                  <th key={h} className="px-4 py-2 text-xs font-medium text-gray-500 border-b">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sentLog.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${log.action_type === 'broadcast' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {log.action_type === 'broadcast' ? 'Broadcast' : 'Direct'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-700 max-w-xs truncate">{log.reason ?? '—'}</td>
                  <td className="px-4 py-2 text-xs text-gray-500 font-mono">
                    {log.target_user_id ? log.target_user_id.slice(0, 8) + '…' : 'All / Filtered'}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400">{dt(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab({ onUse }: { onUse: (t: Template) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const grouped = CATEGORY_ORDER.reduce<Record<TemplateCategory, Template[]>>(
    (acc, cat) => { acc[cat] = TEMPLATES.filter((t) => t.category === cat); return acc; },
    {} as Record<TemplateCategory, Template[]>,
  );

  return (
    <div className="space-y-8">
      <p className="text-xs text-gray-500">
        Click <strong>Use Template</strong> to pre-fill the Compose form. Replace all{' '}
        <span className="font-mono bg-gray-100 px-1 rounded">[BRACKET]</span> placeholders before
        sending. To add a new template or seasonal occasion, append an entry to the{' '}
        <span className="font-mono bg-gray-100 px-1 rounded">TEMPLATES</span> array — no other code changes required.
      </p>

      {CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat];
        if (!items?.length) return null;
        const meta = CATEGORY_META[cat];
        const Icon = meta.icon;

        return (
          <div key={cat}>
            <div className="flex items-center gap-2 mb-3">
              <Icon size={13} className="text-gray-400" />
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.colour}`}>
                {meta.label}
              </span>
              <span className="text-xs text-gray-400">{items.length} template{items.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-2">
              {items.map((t) => {
                const isExpanded = expanded === t.id;
                return (
                  <Card key={t.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 text-sm">{t.label}</p>
                          <span className="text-xs text-gray-400 font-mono">{t.type}</span>
                        </div>
                        <p className="text-xs font-medium text-gray-500 mt-0.5 italic">{t.title}</p>
                        <p className={`text-sm text-gray-600 mt-1.5 whitespace-pre-line ${isExpanded ? '' : 'line-clamp-2'}`}>
                          {t.message}
                        </p>
                        <button
                          type="button"
                          onClick={() => setExpanded(isExpanded ? null : t.id)}
                          className="text-xs text-blue-600 hover:underline mt-1"
                        >
                          {isExpanded ? 'Collapse' : 'Expand full message'}
                        </button>
                      </div>
                      <button
                        type="button" onClick={() => onUse(t)}
                        className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        Use Template
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'compose',   label: 'Compose',           icon: Send     },
  { id: 'inbox',     label: 'Inbox',             icon: Inbox    },
  { id: 'history',   label: 'Broadcast History', icon: Clock    },
  { id: 'templates', label: 'Templates',         icon: FileText },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function MessagingClient({
  inbox, sentLog, onSendDirect, onSendBroadcast,
}: MessagingClientProps) {
  const [active, setActive]             = useState<TabId>('compose');
  const [templateSeed, setTemplateSeed] = useState<Template | null>(null);

  const handleUseTemplate = (t: Template) => {
    setTemplateSeed(t);
    setActive('compose');
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id} type="button" onClick={() => setActive(id)}
            className={`shrink-0 flex items-center gap-1.5 px-5 py-3 text-sm font-medium transition-colors ${
              active === id ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Icon size={14} />
            {label}
            {id === 'templates' && (
              <span className="ml-1 text-xs bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 font-mono">
                {TEMPLATES.length}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="p-6">
        {active === 'compose'   && <ComposeTab onSendDirect={onSendDirect} onSendBroadcast={onSendBroadcast} seed={templateSeed} />}
        {active === 'inbox'     && <InboxTab inbox={inbox} />}
        {active === 'history'   && <BroadcastHistoryTab sentLog={sentLog} />}
        {active === 'templates' && <TemplatesTab onUse={handleUseTemplate} />}
      </div>
    </Card>
  );
}