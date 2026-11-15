/**
 * Shelves the AI sorts games onto. Each shelf is described by several sentences
 * ("prototypes"); their averaged embedding is what a game is compared against.
 * Colours for each key live in the theme (src/theme/themes/*.js).
 */

export const PLATFORMS = /** @type {const} */ (["PS5", "PS4", "PS2", "PC"]);

export const GENRES = /** @type {const} */ ({
  action: {
    label: "Action",
    prototypes: [
      "Fast, cinematic combat and intense fights against powerful enemies",
      "Boss battles, combos and reflex-driven high-energy gameplay",
      "A hero fighting through waves of enemies with weapons and special powers",
    ],
  },
  adventure: {
    label: "Adventure",
    prototypes: [
      "A long story-driven journey with memorable characters",
      "Exploring ruins, solving puzzles and discovering secrets",
      "An emotional narrative adventure across beautiful places",
    ],
  },
  "open-world": {
    label: "Open world",
    prototypes: [
      "A huge open world to roam freely with side quests everywhere",
      "Riding, driving or climbing across a vast living map",
      "Sandbox freedom in a detailed city or wilderness",
    ],
  },
  horror: {
    label: "Horror",
    prototypes: [
      "A terrifying game full of dread and jump scares",
      "Survival against zombies and monsters in the dark with scarce ammo",
      "Psychological fear and a disturbing, oppressive atmosphere",
    ],
  },
  shooter: {
    label: "Shooter",
    prototypes: [
      "First-person or third-person gunfights and tactical shooting",
      "Competitive online multiplayer battles with guns and squads",
      "Battle royale: drop in, loot weapons and be the last one standing",
    ],
  },
  fighting: {
    label: "Fighting",
    prototypes: [
      "One-on-one fighting game with combos, special moves and a roster of fighters",
      "Martial arts, wrestling or MMA matches in a ring or arena",
      "Competitive versus battles that reward timing and execution",
    ],
  },
  racing: {
    label: "Racing",
    prototypes: [
      "High-speed street racing in fast cars",
      "Drifting, nitro boosts and police chases",
      "Driving and vehicle competitions with tuning and upgrades",
    ],
  },
  sports: {
    label: "Sports",
    prototypes: [
      "A realistic sports simulation of football, cricket or other team sports",
      "Managing a team and playing matches in leagues and tournaments",
      "Athletes competing in an official licensed sport",
    ],
  },
  rpg: {
    label: "RPG",
    prototypes: [
      "A role-playing game with levels, skill trees, loot and choices",
      "Quests, dialogue decisions and a fantasy world full of lore",
      "Building a character over a long epic campaign",
    ],
  },
});

export const MOODS = /** @type {const} */ ({
  peace: {
    label: "Peace",
    prototypes: [
      "Calm, slow and peaceful moments",
      "Riding quietly through beautiful nature at sunrise",
      "Kindness, warmth and gentle reflection",
    ],
  },
  fear: {
    label: "Fear",
    prototypes: ["Constant tension and being afraid of what is around the corner", "Helpless against something that hunts you"],
  },
  adrenaline: {
    label: "Adrenaline",
    prototypes: ["Heart-pounding speed, chaos and explosions", "Non-stop intense excitement and competition"],
  },
  grief: {
    label: "Grief",
    prototypes: ["Loss, sadness and saying goodbye", "A story about revenge, family and pain that makes you cry"],
  },
  wonder: {
    label: "Wonder",
    prototypes: ["Awe at a strange, beautiful world full of myth and magic", "Curiosity, discovery and spectacle"],
  },
});

export const GENRE_KEYS = Object.keys(GENRES);
export const MOOD_KEYS = Object.keys(MOODS);

/** Heuristic mood when embeddings are unavailable (build without network). */
export const GENRE_TO_MOOD = {
  action: "adrenaline",
  adventure: "wonder",
  "open-world": "peace",
  horror: "fear",
  shooter: "adrenaline",
  fighting: "adrenaline",
  racing: "adrenaline",
  sports: "adrenaline",
  rpg: "wonder",
};
