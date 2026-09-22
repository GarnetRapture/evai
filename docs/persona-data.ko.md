# 정령(페르소나) 데이터 스키마

<p align="right"><a href="../README.md">← README</a></p>

## 정령(페르소나) 데이터 스키마

정령은 종족(`race`)에 따라 일곱 갈래로 나뉩니다.

<table>
<tr>
<td align="center"><img src="public/eversoul-assets/ui/race-badges/beast.svg" width="64" alt="야수형" /><br/><sub>야수형</sub></td>
<td align="center"><img src="public/eversoul-assets/ui/race-badges/human.svg" width="64" alt="인간형" /><br/><sub>인간형</sub></td>
<td align="center"><img src="public/eversoul-assets/ui/race-badges/elf.svg" width="64" alt="요정형" /><br/><sub>요정형</sub></td>
<td align="center"><img src="public/eversoul-assets/ui/race-badges/undead.svg" width="64" alt="불사형" /><br/><sub>불사형</sub></td>
<td align="center"><img src="public/eversoul-assets/ui/race-badges/chaos.svg" width="64" alt="혼돈형" /><br/><sub>혼돈형</sub></td>
<td align="center"><img src="public/eversoul-assets/ui/race-badges/angel.svg" width="64" alt="천사형" /><br/><sub>천사형</sub></td>
<td align="center"><img src="public/eversoul-assets/ui/race-badges/demon.svg" width="64" alt="악마형" /><br/><sub>악마형</sub></td>
</tr>
</table>

앱이 실제로 대화할 때 정령의 이름·성격·말투를 읽어오는 곳은 IndexedDB `persona_profile` 스토어 레코드의 `raw_json` 필드입니다. `src/domains/persona/archive.ts`가 `import.meta.glob`으로 번들에 포함한 `data/personas/*.json`을 읽고, `personaService.installPreset`이 아직 설치되지 않은 정령을 이 스토어에 저장합니다. 실제 시스템 프롬프트는 `src/domains/persona/prompt.ts`의 `buildLocalizedPersonaPrompt`·`wrapAssembledPersonaPrompt`가 `raw_json`을 파싱해 조립하고, 언어별 결과는 `persona_localized_prompt`에 캐시됩니다.

이 데이터의 원본은 `data/personas/*.json` 99개 파일입니다. 아래는 그 원본 JSON 하나(아드리안)의 실제 필드 구조입니다.

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
    "name": {
      "ko": "아드리안",
      "en": "Adrianne",
      "zh_tw": "阿德里安",
      "zh_cn": "阿德里安"
    },
    "grade": { "ko": "에픽", "en": "Epic", "zh_tw": "史詩", "zh_cn": "史詩" },
    "race": {
      "ko": "천사형",
      "en": "Angel",
      "zh_tw": "天使型",
      "zh_cn": "天使型"
    },
    "class": {
      "ko": "디펜더",
      "en": "Defender",
      "zh_tw": "捍衛者",
      "zh_cn": "捍衛者"
    },
    "profile": {
      "nick_name": {
        "ko": "정의의 빛",
        "en": "Light of Justice",
        "zh_tw": "正義之光",
        "zh_cn": "正義之光"
      },
      "constellation": {
        "ko": "천칭자리",
        "en": "Libra",
        "zh_tw": "天秤座",
        "zh_cn": "天秤座"
      }
    }
  }
}
```

- `i18n` 블록은 필드 이름을 키로 두고 그 아래 `{ ko, en, zh_tw, zh_cn }` 4개 언어 값을 나란히 갖는 **필드-우선 구조**이며, `name` · `grade` · `race` · `class` · `sub_class` · `stat`은 물론 `profile.nick_name` · `profile.constellation` · `profile.union` · `profile.cv_ko` · `profile.cv_jp` · `profile.like` · `profile.dislike` · `profile.hobby` · `profile.speciality`까지 세부 필드 단위로 번역이 존재합니다.
- 화면에 보여줄 때는 `src/domains/persona/logic.ts`의 `parseSpiritDetail`이 이 `raw_json`을 파싱해 언어별로 골라내고, 대화 모델에 보낼 시스템 프롬프트는 `src/domains/persona/prompt.ts`가 `raw_json`을 따로 파싱해 조립합니다. 두 곳 모두 IndexedDB의 `raw_json`을 원본으로 씁니다.
- `dialogues`의 에버톡·스토리 대사는 말투 표본이면서 정령 기질의 측정 원본입니다. `src/domains/persona/temperament.ts`가 정령 자신의 대사에서 다정함·표현력·주도성 신호를 세어 99명 안의 백분위로 바꿉니다. 대사 안의 게임 시스템 알림(대괄호·괄호로 감싼 안내문, "(정령 이름) 님이 …")은 정령의 말이 아니므로 제외합니다.
- `yuria.json`은 플레이어블 정령 유리아 퀸(SNO 5030)의 데이터입니다. `third_party/tbl_json`에서 SNO를 따라 다른 정령과 같은 방식으로 채웠고, 에버톡 대사 285줄을 갖습니다.
- 정령별 원화는 `public/eversoul-assets/spirits/{영문명}/` 하위에 `base`(기본 일러스트 512/1024/2048), `costume`(코스튬), `gacha`(가챠 연출), `raid`(레이드 연출), `srg`(스토리) 등 카테고리 폴더로 분리되어 있으며, `LoadableAssetImage` 컴포넌트(`src/domains/evertalk/components/LoadableAssetImage.tsx`)가 후보 경로 배열을 순차 시도(`useFirstLoadableImage`)해 존재하는 첫 이미지를 렌더링합니다.

---

## 버전 관리

버전은 `package.json`의 `version` 하나로 관리하고, 윈도우 실행 파일의 버전 정보도 여기서 가져갑니다. Tauri 데스크톱 앱에서 웹 앱으로 옮기면서 `0.0.0`부터 다시 시작했고, 지금 버전은 `0.0.5`입니다.

---
