export type Img = { src: string; w: number; h: number; alt: string };

const work = (name: string, w: number, h: number, alt: string): Img => ({
  src: `/images/work/${name}.jpg`,
  w,
  h,
  alt,
});

export const WORK = {
  masonSmiling: work("mason-scaffold-smiling", 590, 1281, "Mason in orange coveralls smiling while finishing a block wall from a scaffold"),
  trench: work("block-laying-foundation-trench", 589, 1280, "Mason laying hollow blocks along a foundation trench"),
  reinforcement: work("mason-wall-reinforcement", 607, 1080, "Mason in a hard hat working beside a block wall with steel reinforcement"),
  plastered: work("mason-plastered-wall", 840, 1049, "Mason standing on a scaffold beside a freshly pointed block wall"),
  interior: work("block-walls-interior", 912, 420, "Interior block walls under construction"),
  corner: work("block-wall-corner", 589, 1280, "Block wall corner with neat mortar joints"),
  formwork: work("foundation-formwork", 1280, 589, "Foundation formwork with steel reinforcement bars"),
  safety: work("safety-briefing-crew", 1152, 648, "Crew in hard hats and high-visibility coveralls at a site safety briefing"),
  stairsPour: work("concrete-staircase-pour", 589, 1280, "Freshly poured concrete staircase"),
  stairsForm: work("staircase-formwork", 1280, 589, "Concrete staircase being formed beside a block wall"),
  wallSite: work("block-wall-site", 912, 420, "Completed block wall on a building site"),
  trenchBending: work("mason-trench-bending-mortar", 589, 1280, "Mason in orange coveralls spreading mortar on a block course in a trench"),
  trenchMortar: work("mason-trench-mortar-trowel", 589, 1280, "Mason in orange coveralls laying hollow blocks with mortar and a trowel"),
  trenchSide: work("mason-trench-wall-side", 589, 1280, "Mason building a hollow block foundation wall with reinforcement bars"),
  trenchPointing: work("mason-trench-pointing", 720, 1280, "Mason pointing the joints of a block foundation wall"),
  wallsLevel: work("block-walls-trowel-level", 1280, 589, "Block walls with a trowel and spirit level resting on top"),
  boundary: work("boundary-wall", 912, 420, "Boundary wall built from sandcrete blocks"),
  night: work("night-block-walls", 589, 1280, "Block walls with reinforcement columns at dusk"),
  rooftop: work("block-walls-rooftop", 592, 1280, "Block walls rising on an upper floor"),
  rebar: work("foundation-rebar-cage", 589, 1280, "Steel reinforcement cage prepared in a foundation trench"),
  level: work("block-wall-spirit-level", 1280, 589, "Block walls built to line with a spirit level on site"),
} as const;

export type Cert = Img & { title: string; issuer: string; date: string };

const cert = (name: string, w: number, h: number, title: string, issuer: string, date: string): Cert => ({
  src: `/images/credentials/${name}.jpg`,
  w,
  h,
  alt: `${title} certificate`,
  title,
  issuer,
  date,
});

export const CERTS: Cert[] = [
  cert("masonry-training-certificate", 1080, 760, "Masonry Skills, three years of hands-on training", "Jude Group of Companies", "Nov 2012 to Nov 2015"),
  cert("nebosh-process-safety", 786, 1116, "NEBOSH HSE Certificate in Process Safety Management", "NEBOSH", "12 Nov 2024"),
  cert("prince2-foundation", 916, 1280, "PRINCE2 7 Foundation in Project Management", "PeopleCert", "19 Nov 2024"),
  cert("uci-managing-project-risks", 1079, 833, "Managing Project Risks and Changes", "University of California, Irvine, via Coursera", "7 Jun 2021"),
  cert("uci-initiating-planning-projects", 1080, 831, "Initiating and Planning Projects", "University of California, Irvine, via Coursera", "2 Mar 2021"),
];
