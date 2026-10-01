// Static MAL ID and AniList ID mappings to AnimeGG slugs
// This provides 0ms instant lookup and 100% accuracy for popular/complex anime franchises.

export const MAL_TO_ANIMEGG = {
  // Attack on Titan (Shingeki no Kyojin)
  16498: "attack-on-titan",
  25777: "attack-on-titan-season-2",
  35760: "shingeki-no-kyojin-3",
  38524: "shingeki-no-kyojin-3-part-2",
  40028: "shingeki-no-kyojin-the-final-season",
  48583: "shingeki-no-kyojin-the-final-season-part-2",
  51535: "shingeki-no-kyojin-the-final-season---kanketsu-hen",

  // Bleach
  269: "bleach",
  41467: "bleach-sennen-kessen-hen",
  53580: "bleach-sennen-kessen-hen---ketsubetsu-tan",
  53998: "bleach-sennen-kessen-hen---ketsubetsu-tan",
  56784: "bleach-sennen-kessen-hen---soukoku-tan",

  // Jujutsu Kaisen
  40748: "jujutsu-kaisen-tv",
  51009: "jujutsu-kaisen-2nd-season",
  48561: "jujutsu-kaisen-0-movie",

  // Naruto / Boruto
  20: "naruto",
  1735: "naruto-shippuden",
  34566: "boruto-naruto-next-generations",

  // One Piece
  21: "one-piece",

  // Demon Slayer (Kimetsu no Yaiba)
  38000: "kimetsu-no-yaiba",
  40456: "kimetsu-no-yaiba-movie-mugen-ressha-hen",
  47778: "kimetsu-no-yaiba-yuukaku-hen",
  51019: "kimetsu-no-yaiba-katanakaji-no-sato-hen",
  55701: "kimetsu-no-yaiba-hashira-geiko-hen",

  // Frieren
  52991: "sousou-no-frieren",

  // Solo Leveling
  52299: "ore-dake-level-up-na-ken",
  58567: "solo-leveling-season-2-arise-from-the-shadow",

  // Spy x Family
  50273: "spy-x-family",
  50602: "spy-x-family-part-2",
  53887: "spy-x-family-season-2",
  55536: "spy-x-family-movie-code-white",

  // Chainsaw Man
  44511: "chainsaw-man",

  // Vinland Saga
  37521: "vinland-saga",
  49387: "vinland-saga-season-2",

  // Re:Zero
  31240: "rezero-kara-hajimeru-isekai-seikatsu",
  39587: "rezero-kara-hajimeru-isekai-seikatsu-2nd-season",
  42203: "rezero-kara-hajimeru-isekai-seikatsu-2nd-season-part-2",
  54857: "rezero-kara-hajimeru-isekai-seikatsu-3rd-season",

  // My Hero Academia (Boku no Hero Academia)
  31964: "boku-no-hero-academia",
  33486: "boku-no-hero-academia-2nd-season",
  36456: "boku-no-hero-academia-3rd-season",
  38408: "boku-no-hero-academia-4th-season",
  42282: "boku-no-hero-academia-5th-season",
  49918: "boku-no-hero-academia-6th-season",
  54492: "boku-no-hero-academia-7th-season",

  // Hunter x Hunter (2011)
  11061: "hunter-x-hunter-2011",

  // Death Note
  1535: "death-note",

  // Fullmetal Alchemist: Brotherhood
  5114: "fullmetal-alchemist-brotherhood",

  // Steins;Gate
  9253: "steinsgate",

  // Sword Art Online
  11757: "sword-art-online",
  21881: "sword-art-online-ii",
  36474: "sword-art-online-alicization",
  39597: "sword-art-online-alicization---war-of-underworld",

  // Black Clover
  34572: "black-clover-tv",

  // Haikyuu!!
  20583: "haikyuu",
  28891: "haikyuu-second-season",
  32935: "haikyuu-karasuno-koukou-vs-shiratorizawa-gakuen-koukou",
  40776: "haikyuu-to-the-top",
  42364: "haikyuu-to-the-top-part-2",

  // Mob Psycho 100
  32182: "mob-psycho-100",
  37510: "mob-psycho-100-ii",
  50172: "mob-psycho-100-iii",

  // Kaguya-sama
  37999: "kaguya-sama-wa-kokurasetai-tensai-tachi-no-renai-zunousen",
  40591: "kaguya-sama-wa-kokurasetai-tensai-tachi-no-renai-zunousen-2",
  43608: "kaguya-sama-wa-kokurasetai-ultra-romantic",

  // Oshi no Ko
  52034: "oshi-no-ko",
  55791: "oshi-no-ko-season-2",

  // Kaiju No. 8
  52588: "kaijuu-8-gou",

  // Dandadan
  57334: "dandadan",
};

// AniList ID overrides if needed directly
export const ANILIST_TO_ANIMEGG = {
  // Can be mapped directly if MAL ID is unknown or distinct
};

/**
 * Get pre-mapped AnimeGG slug by MAL ID or AniList ID
 */
export function getMappedSlug(malId, anilistId) {
  if (anilistId && ANILIST_TO_ANIMEGG[anilistId]) {
    return ANILIST_TO_ANIMEGG[anilistId];
  }
  if (malId && MAL_TO_ANIMEGG[malId]) {
    return MAL_TO_ANIMEGG[malId];
  }
  return null;
}
