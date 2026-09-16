# Spirit (persona) data schema

<p align="right"><a href="../README.en.md">← README</a></p>

## Spirit (Persona) Data Schema

Spirits fall into seven races (`race`).

<table>
<tr>
<td align="center"><img src="public/eversoul-assets/ui/race-badges/beast.svg" width="64" alt="Beast" /><br/><sub>Beast</sub></td>
<td align="center"><img src="public/eversoul-assets/ui/race-badges/human.svg" width="64" alt="Human" /><br/><sub>Human</sub></td>
<td align="center"><img src="public/eversoul-assets/ui/race-badges/elf.svg" width="64" alt="Elf" /><br/><sub>Elf</sub></td>
<td align="center"><img src="public/eversoul-assets/ui/race-badges/undead.svg" width="64" alt="Undead" /><br/><sub>Undead</sub></td>
<td align="center"><img src="public/eversoul-assets/ui/race-badges/chaos.svg" width="64" alt="Chaos" /><br/><sub>Chaos</sub></td>
<td align="center"><img src="public/eversoul-assets/ui/race-badges/angel.svg" width="64" alt="Angel" /><br/><sub>Angel</sub></td>
<td align="center"><img src="public/eversoul-assets/ui/race-badges/demon.svg" width="64" alt="Demon" /><br/><sub>Demon</sub></td>
</tr>
</table>

When the app is actually chatting, it reads a spirit's name, personality, and speech patterns from the `raw_json` field of the records in the IndexedDB `persona_profile` store. `src/domains/persona/archive.ts` reads the `data/personas/*.json` files bundled through `import.meta.glob`, and `personaService.installPreset` stores any spirit that is not installed yet into that store. The system prompt is assembled by `buildLocalizedPersonaPrompt` and `wrapAssembledPersonaPrompt` in `src/domains/persona/prompt.ts` parsing that `raw_json`, and the per-language result is cached in `persona_localized_prompt`.

The source of that data is the 99 `data/personas/*.json` files. Below is the real field structure of one of those source files (Adrianne's).

```json
{
  "id": "5020",
  "name": "아드리안",
  "name_en": "Adrianne",
  "grade": "에픽",
  "race": "천사형",
  "class": "디펜더",
  "sub_class": "광역",
  "stat": "힘",
  "profile": {
    "nick_name": "정의의 빛",
    "constellation": "천칭자리",
    "union": "에델 가드",
    "birthday": "1017",
    "height": 167,
    "weight": 51,
    "cv_ko": "이명호",
    "cv_jp": "Eri Kitamura",
    "like": ["강아지", "감동 실화"],
    "dislike": ["범죄", "악인"],
    "hobby": ["영지 순찰"],
    "speciality": ["멋진 포즈 연구"]
  },
  "personality": { "description": "...", "greeting": "..." },
  "speech_patterns": ["...", "..."],
  "i18n": {
    "name": { "ko": "아드리안", "en": "Adrianne", "zh_tw": "阿德里安", "zh_cn": "阿德里安" },
    "grade": { "ko": "에픽", "en": "Epic", "zh_tw": "史詩", "zh_cn": "史詩" },
    "race": { "ko": "천사형", "en": "Angel", "zh_tw": "天使型", "zh_cn": "天使型" },
    "class": { "ko": "디펜더", "en": "Defender", "zh_tw": "捍衛者", "zh_cn": "捍衛者" },
    "profile": {
      "nick_name": { "ko": "정의의 빛", "en": "Light of Justice", "zh_tw": "正義之光", "zh_cn": "正義之光" },
      "constellation": { "ko": "천칭자리", "en": "Libra", "zh_tw": "天秤座", "zh_cn": "天秤座" }
    }
  }
}
```

- The `i18n` block is a **field-first structure**: each field name is the key, and beneath it sit the 4 language values `{ ko, en, zh_tw, zh_cn }`. Translations exist down to the individual field level for `name` · `grade` · `race` · `class` · `sub_class` · `stat`, as well as `profile.nick_name` · `profile.constellation` · `profile.union` · `profile.cv_ko` · `profile.cv_jp` · `profile.like` · `profile.dislike` · `profile.hobby` · `profile.speciality`.
- For display, `parseSpiritDetail` in `src/domains/persona/logic.ts` parses this `raw_json` and picks the right language. The system prompt for the chat model is built separately by `src/domains/persona/prompt.ts`, which parses `raw_json` on its own. Both read the `raw_json` stored in IndexedDB.
- Each spirit's artwork lives under `public/eversoul-assets/spirits/{EnglishName}/`, split into category folders: `base` (base illustration at 512/1024/2048), `costume`, `gacha`, `raid`, and `srg` (story). The `LoadableAssetImage` component (`src/domains/evertalk/components/LoadableAssetImage.tsx`) tries a list of candidate paths in order (`useFirstLoadableImage`) and renders the first one that actually loads.

---

## Versioning

The version lives in the single `version` field of `package.json`, and the Windows executable's version info is taken from it too. The project restarted at `0.0.0` when it moved from the Tauri desktop app to a web app, and the current version is `0.0.5`.

---
