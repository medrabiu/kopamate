/**
 * The NYSC checklist guide (/nysc-checklist): the default content. Admins edit a copy saved in the
 * settings table (lib/pcm-guide.ts); this file is used until the first save and whenever a saved copy is
 * invalid. Ticks refer to slugs, so editing text never breaks anyone's progress.
 *
 * Conditions are matched against the 6 answers (lib/pcm-rules.ts appliesTo): {} means everyone,
 * {"married":"yes"} means only people who answered yes.
 */

export type AnswerKey = "studied" | "qual" | "married" | "over30" | "health" | "stage";
export type Answers = Partial<Record<AnswerKey, string>>;
export type Conditions = Answers;

export type Question = { key: AnswerKey; label: string; options: { value: string; label: string }[] };

/** The 6 quick questions. Fixed in code: conditions, pre-ticking and the admin dropdowns depend on them. */
export const QUESTIONS: Question[] = [
  { key: "studied", label: "Where did you study?", options: [{ value: "ng", label: "In Nigeria" }, { value: "abroad", label: "Abroad" }] },
  { key: "qual", label: "What did you graduate with?", options: [{ value: "uni", label: "University degree" }, { value: "poly", label: "Polytechnic HND" }] },
  { key: "married", label: "Are you a married woman?", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
  { key: "over30", label: "Were you 30 or older when you graduated?", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] },
  {
    key: "health",
    label: "Any health condition or disability?",
    options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "skip", label: "Prefer not to say" }],
  },
  {
    key: "stage",
    label: "Where are you right now?",
    options: [
      { value: "s0", label: "Not on senate list yet" },
      { value: "s1", label: "Registering" },
      { value: "s2", label: "Waiting for call-up" },
      { value: "s3", label: "Have my call-up letter" },
    ],
  },
];

export type Step = {
  slug: string;
  title: string;
  short: string;
  what: string;
  why: string;
  how: string[];
  bring: string[];
  cost: string;
  time: string;
  mistakes: string[];
  /** camp_docs / camp_packing steps are done when every applicable Camp Pack item on that tab is ticked. */
  opens: "step" | "camp_docs" | "camp_packing";
  conditions: Conditions;
  show: boolean;
};

export type Situation = {
  slug: string;
  title: string;
  /** 1–2 characters shown on the card, like "M". */
  badge: string;
  tint: string;
  subtitle: string;
  intro: string;
  items: string[];
  notes: string[];
  conditions: Conditions;
  alwaysShow: boolean;
  show: boolean;
};

export type FixField = "name" | "dob" | "course" | "any";
export type FixDocument = "nin" | "jamb" | "sor" | "senate" | "any";

export type FixPath = {
  slug: string;
  /** Which mismatch it covers; "any" matches every field. */
  field: FixField;
  /** Which document is different; "any" matches every document. The first matching path is used. */
  document: FixDocument;
  who: string;
  line: string;
  steps: string[];
  hasLetter: boolean;
  /** Placeholders: {name} {school} {matric} {field} {correct} */
  letterTemplate: string;
  show: boolean;
};

export type PackItem = {
  slug: string;
  text: string;
  note: string;
  qty: string;
  tag: "required" | "for_you";
  conditions: Conditions;
  show: boolean;
};

export type Tip = { stepSlug: string; authorLabel: string; text: string };

export type Guide = {
  version: 1;
  batchLabel: string;
  /** YYYY-MM-DD */
  lastReviewed: string;
  steps: Step[];
  situations: Situation[];
  fixPaths: FixPath[];
  documents: PackItem[];
  packing: PackItem[];
  tips: Tip[];
};

/** Tints for situation cards (the app's palette). */
export const TINTS = ["#ff4fa3", "#5aa9ff", "#f2c230", "#b9a6ff", "#7ff0d8", "#ff8a3d", "#c6f432"];

const step = (s: Omit<Step, "opens" | "conditions" | "show"> & Partial<Pick<Step, "opens" | "conditions" | "show">>): Step => ({
  opens: "step",
  conditions: {},
  show: true,
  ...s,
});

const doc = (slug: string, text: string, note: string, conditions: Conditions = {}): PackItem => ({
  slug,
  text,
  note,
  qty: "",
  tag: Object.keys(conditions).length ? "for_you" : "required",
  conditions,
  show: true,
});

const pack = (slug: string, text: string, qty: string): PackItem => ({ slug, text, note: "", qty, tag: "required", conditions: {}, show: true });

export const DEFAULT_GUIDE: Guide = {
  version: 1,
  batchLabel: "Batch C 2026",
  lastReviewed: "2026-10-07",
  steps: [
    step({
      slug: "senate",
      title: "Confirm you’re on the senate list",
      short: "Your school uploads graduating students to NYSC. Make sure your name and details are correct before registration opens.",
      what: "Your school sends NYSC the list of students cleared to serve. If you’re not on it, or your details are wrong, you can’t register.",
      why: "Wrong or missing details here follow you through registration and camp, and some can’t be changed later.",
      how: [
        "Ask your Student Affairs office when your school’s list for this batch will be uploaded.",
        "Check your name, date of birth, course and graduation date on the list your school shares.",
        "Compare them with your NIN slip, JAMB record and statement of result.",
        "Report any error to Student Affairs right away, in writing.",
      ],
      bring: ["Statement of result", "JAMB registration number", "NIN slip"],
      cost: "Free",
      time: "Depends on your school",
      mistakes: [
        "Waiting until registration opens to check your details.",
        "Ignoring a small spelling difference in your name. Small differences cause big problems.",
      ],
    }),
    step({
      slug: "nerd",
      title: "Get your NERD clearance",
      short: "Upload your final-year project to the National Education Repository and Databank and print your clearance slip.",
      what: "Your final-year project must be uploaded and verified on the National Education Repository and Databank (NERD). You then print a clearance slip.",
      why: "The NERD clearance slip is now among the documents you need at camp registration.",
      how: [
        "Get the final soft copy (PDF) of your project, matching what your department approved.",
        "Follow your school’s NERD instructions. Many schools share a notice with the steps.",
        "Upload your project and wait for verification.",
        "Download and print your clearance slip. Print 2 copies and keep one on your phone.",
      ],
      bring: ["Final project as a PDF", "Matric number", "Your school’s NERD notice"],
      cost: "Check your school’s notice",
      time: "Allow a few days for verification",
      mistakes: ["Leaving it until the last week before camp.", "Uploading a draft instead of your final approved project."],
    }),
    step({
      slug: "register",
      title: "Register online and do your biometrics",
      short: "Register at an accredited centre while the window is open. Check every detail before you submit.",
      what: "You complete NYSC online registration and fingerprint capture during the registration window.",
      why: "Details like your date of birth, graduation date and course generally can’t be corrected after camp.",
      how: [
        "Go to an accredited registration centre during the official window.",
        "Make sure your NIN matches your statement of result exactly.",
        "Do your own fingerprints. Never let anyone thumbprint for you.",
        "Read every detail on screen before you submit, then keep your printout.",
      ],
      bring: ["NIN slip", "Statement of result", "JAMB registration number", "Passport photo on white background", "Working email and phone number"],
      cost: "Café charges vary",
      time: "1 visit, if prepared",
      mistakes: ["Letting someone thumbprint on your behalf.", "Rushing past the summary screen without checking dates and course."],
    }),
    step({
      slug: "callup",
      title: "Print your green card and call-up letter",
      short: "Print your green card after registration, then your call-up letter when it’s released.",
      what: "After registration you get your call-up number and green card. Your call-up letter, which shows your state, comes out later.",
      why: "Both are required at camp registration, and your call-up letter tells you where you’re going.",
      how: [
        "Print your green card once your call-up number is ready.",
        "When call-up letters are released, log in to the official portal and print yours.",
        "Print 2–3 copies and keep a photo of it on your phone.",
        "Update your NYSC stage on Kopamate to see corpers in your new state.",
      ],
      bring: [],
      cost: "Printing only",
      time: "Minutes",
      mistakes: ["Paying anyone who claims they can “influence” your posting.", "Carrying only one copy to camp."],
    }),
    step({
      slug: "medical",
      title: "Get your medical certificate",
      short: "Get a medical certificate of fitness from a government or military hospital.",
      what: "A medical certificate of fitness confirms you’re fit for camp activities.",
      why: "Certificates from private clinics are commonly rejected at camp.",
      how: [
        "Visit a government or military hospital and ask for the NYSC medical fitness certificate.",
        "Bring passport photos and be ready for basic tests.",
        "Collect it before you travel, and make a photocopy.",
      ],
      bring: ["Passport photographs", "A valid ID"],
      cost: "Varies by hospital",
      time: "Usually 1–3 days",
      mistakes: ["Using a private clinic.", "Waiting until the night before you travel."],
    }),
    step({
      slug: "docs",
      title: "Gather your camp documents",
      short: "Tick off every document on your personal list.",
      what: "Your personal document list is built from your answers.",
      why: "Missing documents can delay or stop your camp registration.",
      how: ["Open My Camp Pack and tick off each document.", "Make photocopies of everything important.", "Keep originals and copies in a waterproof folder."],
      bring: [],
      cost: "Printing and photocopies",
      time: "A day",
      mistakes: ["Packing documents in the same bag as wet items.", "Bringing only originals without photocopies."],
      opens: "camp_docs",
    }),
    step({
      slug: "pack",
      title: "Pack for camp",
      short: "Use the packing list past corpers recommend.",
      what: "A checklist of what to bring, based on what past corpers found useful.",
      why: "Camp markets have most things, but they cost more and you’ll be busy.",
      how: ["Open My Camp Pack, then the Packing tab.", "Tick items as you pack.", "Ask corpers who just passed out if they have camp kit to give away or sell cheaply."],
      bring: [],
      cost: "Depends on what you have",
      time: "A day",
      mistakes: ["Overpacking. You’ll carry it yourself.", "Forgetting a padlock for your locker."],
      opens: "camp_packing",
    }),
  ],
  situations: [
    {
      slug: "married",
      title: "Married woman",
      badge: "M",
      tint: "#ff4fa3",
      subtitle: "Extra documents and posting near your husband",
      intro: "You serve like everyone else, but NYSC asks for a few extra documents so your records match your married name.",
      items: [
        "Marriage certificate",
        "Change of name publication (newspaper)",
        "Your husband’s domicile letter or details, if you’ll request posting near him",
        "Recent utility bill showing your address",
        "NIN that matches your current name",
      ],
      notes: [
        "If your certificate is in your maiden name, carry evidence of the change of name everywhere.",
        "Upload the required documents during online registration when asked.",
      ],
      conditions: { married: "yes" },
      alwaysShow: false,
      show: true,
    },
    {
      slug: "abroad",
      title: "Studied abroad",
      badge: "A",
      tint: "#5aa9ff",
      subtitle: "Foreign-trained path and physical verification",
      intro: "Foreign-trained graduates go through extra checks, including physical verification, before mobilization.",
      items: [
        "International passport (data page and visas)",
        "Original certificate (not a statement of result)",
        "O-level result",
        "Evaluation or accreditation evidence for your school and course",
        "Residence permit for your study country",
        "Certified English translation if documents aren’t in English",
      ],
      notes: [
        "Keep both originals and copies. You’ll be asked for originals at verification.",
        "Watch the dates for physical verification closely. Missing it can delay you to another batch.",
      ],
      conditions: { studied: "abroad" },
      alwaysShow: false,
      show: true,
    },
    {
      slug: "poly",
      title: "Polytechnic graduate",
      badge: "P",
      tint: "#f2c230",
      subtitle: "Bring your OND certificate too",
      intro: "HND graduates are usually asked for their OND certificate alongside the HND statement of result.",
      items: ["OND certificate or statement of result", "HND statement of result", "Evidence of industrial training (SIWES), if your school asks"],
      notes: ["Make sure your names are identical on your OND and HND documents."],
      conditions: { qual: "poly" },
      alwaysShow: false,
      show: true,
    },
    {
      slug: "over30",
      title: "30 or older at graduation",
      badge: "30",
      tint: "#b9a6ff",
      subtitle: "You don’t go to camp",
      intro: "If you were 30 or older when you graduated, you don’t serve. You’re issued a certificate of exemption instead.",
      items: ["Statement of result showing your graduation date", "Birth certificate or age declaration", "NIN that matches your date of birth"],
      notes: ["You still need to complete registration to get your exemption certificate.", "Confirm the latest process with official NYSC instructions."],
      conditions: { over30: "yes" },
      alwaysShow: false,
      show: true,
    },
    {
      slug: "health",
      title: "Health condition",
      badge: "+",
      tint: "#7ff0d8",
      subtitle: "Medical evidence for camp and posting",
      intro: "If you have a health condition or disability, you can submit medical evidence so it’s considered during camp and posting.",
      items: ["Medical report from a government hospital", "Any prescriptions or treatment records", "Enough medication for camp, in original packaging"],
      notes: ["Upload your medical evidence during online registration when asked.", "Tell the camp clinic on arrival and keep a copy of your report with you."],
      conditions: { health: "yes" },
      alwaysShow: false,
      show: true,
    },
    {
      slug: "senate-list",
      title: "Not on the senate list",
      badge: "!",
      tint: "#ff8a3d",
      subtitle: "What to check and who to see",
      intro: "If you can’t find your name, don’t panic. It’s usually a timing or spelling issue your school can fix.",
      items: [
        "Confirm your school has uploaded the list for this batch",
        "Check spelling variants of your name and your matric number",
        "Confirm you’re on the JAMB matriculation list",
        "Write to Student Affairs with your statement of result",
      ],
      notes: ["Schools upload in batches. Your name may come in a later upload.", "If you miss this batch, you can be mobilized in the next one."],
      conditions: {},
      alwaysShow: true,
      show: true,
    },
  ],
  fixPaths: [
    {
      slug: "nimc",
      field: "any",
      document: "nin",
      who: "NIMC fixes your NIN",
      line: "Your NIN record is managed by the National Identity Management Commission.",
      steps: [
        "Visit an NIMC enrolment centre and ask for data modification.",
        "Bring documents that prove the correct details (for example a birth certificate or your other records).",
        "Some changes take time, so start immediately and keep your receipts.",
      ],
      hasLetter: false,
      letterTemplate: "",
      show: true,
    },
    {
      slug: "jamb",
      field: "any",
      document: "jamb",
      who: "JAMB fixes your JAMB record",
      line: "Your JAMB registration and matriculation records are managed by JAMB.",
      steps: [
        "Contact a JAMB office or use JAMB’s official correction service.",
        "Bring your admission letter, statement of result and ID.",
        "Tell Student Affairs once it’s corrected, so your school’s records match.",
      ],
      hasLetter: false,
      letterTemplate: "",
      show: true,
    },
    {
      slug: "school",
      field: "any",
      document: "any",
      who: "Your school fixes this",
      line: "Your statement of result and the senate list come from your school.",
      steps: [
        "Write to your Student Affairs office explaining the error.",
        "Attach copies of your NIN slip, JAMB record and statement of result.",
        "Follow up until you see the corrected details before registration.",
      ],
      hasLetter: true,
      letterTemplate: [
        "The Dean,",
        "Student Affairs Division,",
        "{school}.",
        "",
        "Dear Sir/Madam,",
        "",
        "REQUEST FOR CORRECTION OF MY DETAILS ON THE SENATE LIST AND STATEMENT OF RESULT",
        "",
        "I am {name}, a graduate of this institution with matriculation number {matric}. I am writing to respectfully request a correction of my {field} on the school's records submitted to NYSC (the senate list and my statement of result).",
        "",
        "My correct {field} is: {correct}. This matches my NIN slip and JAMB record, copies of which I have attached.",
        "",
        "I would be grateful if this could be corrected before NYSC registration closes, so that my records are consistent across all documents.",
        "",
        "Thank you for your kind assistance.",
        "",
        "Yours faithfully,",
        "",
        "{name}",
        "{matric}",
      ].join("\n"),
      show: true,
    },
  ],
  documents: [
    doc("callup", "Call-up letter", "Print 2–3 copies"),
    doc("green", "Green card", "Your signed registration printout"),
    doc("sor", "Statement of result", "With your school’s endorsement"),
    doc("schoolid", "Final-year school ID card", ""),
    doc("medical", "Medical certificate of fitness", "Government or military hospital only"),
    doc("nerd", "NERD clearance slip", "Print 2 copies"),
    doc("photos", "Passport photographs", "White background, at least 8"),
    doc("ond", "OND certificate", "Polytechnic graduates", { qual: "poly" }),
    doc("marriage", "Marriage certificate and change of name", "Married women", { married: "yes" }),
    doc("intl", "International passport and original certificate", "Foreign-trained graduates", { studied: "abroad" }),
  ],
  packing: [
    pack("whites", "White round-neck T-shirts", "x4"),
    pack("shorts", "White shorts", "x3"),
    pack("sneakers", "White sneakers and socks", "1 pair + socks"),
    pack("bucket", "Bucket", "1"),
    pack("padlock", "Padlock", "1"),
    pack("net", "Mosquito net or repellent", "1"),
    pack("toiletries", "Toiletries and towel", ""),
    pack("plate", "Plate, cup and cutlery", "1 set"),
    pack("torch", "Torch and power bank", ""),
    pack("slippers", "Slippers", "1 pair"),
    pack("cash", "Small cash in smaller notes", ""),
    pack("folder", "Waterproof document folder", "1"),
  ],
  tips: [
    { stepSlug: "senate", authorLabel: "Tobi · Unilag, Batch B", text: "My middle name was missing. Student Affairs fixed it in a week because I reported early." },
    { stepSlug: "senate", authorLabel: "Hauwa · BUK, Batch A", text: "Get a printed copy or screenshot of your entry for your records." },
    { stepSlug: "nerd", authorLabel: "Chidi · UNN, Batch C", text: "Do it the day your school opens it. Verification queues get long." },
    { stepSlug: "nerd", authorLabel: "Amina · ABU, Batch C", text: "Name the PDF properly before uploading, and keep the confirmation." },
    { stepSlug: "register", authorLabel: "Femi · OAU, Batch A", text: "Go early in the window. The last days are packed and the network is slow." },
    { stepSlug: "register", authorLabel: "Grace · UniBen, Batch B", text: "Take a photo of your summary screen before you submit." },
    { stepSlug: "callup", authorLabel: "Bisi · UI, Batch C", text: "Screenshot everything. The portal gets slow when letters drop." },
    { stepSlug: "medical", authorLabel: "Kemi · LASU, Batch B", text: "Ask other PCMs which government hospital near you is fastest." },
    { stepSlug: "docs", authorLabel: "Ibrahim · UDUS, Batch A", text: "A cheap transparent file folder saved me during the rain at camp." },
    { stepSlug: "pack", authorLabel: "Zainab · KSU, Batch C", text: "Bring small cash in smaller notes. Change is always a problem at camp." },
  ],
};
