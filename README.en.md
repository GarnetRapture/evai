<p align="right">
  <a href="README.md"><img src="https://flagcdn.com/20x15/kr.png" width="20" height="15" alt="KR" /> 한국어</a> &nbsp;|&nbsp;
  <img src="https://flagcdn.com/20x15/us.png" width="20" height="15" alt="US" /> <strong>English</strong> &nbsp;|&nbsp;
  <a href="README.zh-CN.md"><img src="https://flagcdn.com/20x15/cn.png" width="20" height="15" alt="CN" /> 简体中文</a>
</p>

<p align="center">
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_Castle_Aurelia.png" width="960" alt="EverSoul AI Chat Banner" />
</p>

<h1 align="center">EverSoul AI Chat</h1>
<p align="center"><i>A fully local AI chat client that carries the voices of the spirits</i></p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.0.23-blue?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/license-Apache_2.0-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/Tauri-2-FFC107?style=flat-square&logo=tauri" alt="Tauri" />
  <img src="https://img.shields.io/badge/React-19.1-61DAFB?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Rust-2021_edition-000000?style=flat-square&logo=rust" alt="Rust" />
  <img src="https://img.shields.io/badge/SQLite-bundled-003B57?style=flat-square&logo=sqlite" alt="SQLite" />
  <img src="https://img.shields.io/badge/spirits-95-9b5de5?style=flat-square" alt="Spirits" />
  <img src="https://img.shields.io/badge/talk_backgrounds-522-f15bb5?style=flat-square" alt="Backgrounds" />
  <img src="https://img.shields.io/badge/languages-ko%20%7C%20en%20%7C%20zh__cn-00bbf9?style=flat-square" alt="Languages" />
</p>

<p align="center">
  <a href="https://github.com/GarnetRapture/eversoul-ai-chat/fork"><img src="https://img.shields.io/badge/1.%20Fork-238636?style=for-the-badge&logo=github&logoColor=white" alt="Fork" /></a>
  <a href="https://github.com/GarnetRapture/eversoul-ai-chat/stargazers"><img src="https://img.shields.io/badge/2.%20Star-e3b341?style=for-the-badge&logo=github&logoColor=white" alt="Star" /></a>
  <a href="https://github.com/GarnetRapture/eversoul-ai-chat/watchers"><img src="https://img.shields.io/badge/3.%20Watch-1f6feb?style=for-the-badge&logo=github&logoColor=white" alt="Watch" /></a>
  <a href="https://github.com/GarnetRapture/eversoul-ai-chat/actions/workflows/build-portable.yml"><img src="https://img.shields.io/badge/4.%20Build%20on%20Actions-8957e5?style=for-the-badge&logo=githubactions&logoColor=white" alt="Actions" /></a>
</p>

<p align="center">
  <sub>Hit <b>Fork</b> → <b>Star</b> → <b>Watch</b>, then one <b>Run workflow</b> click in <b>your own</b> fork's Actions tab builds the app for you. No Rust, CMake, or Clang on your machine.</sub>
</p>

---

## 🌟 Overview

**EverSoul AI Chat** is a new local AI chat project made to keep EverSoul close. It was built with one idea in mind: preserving the memories of the spirits. It brings all 95 spirits from EverSoul to life using the real game data, so you can talk with each of them in their own personality and voice.

The AI that generates every reply runs entirely on your own computer (using local GGUF models), keeping your privacy completely secure. Additionally, for environments where running heavy local models is challenging, a hybrid architecture is designed to integrate with external APIs (like OpenAI, Gemini), transmitting only the context for lightweight and smart communication.

That's why the full official artwork of all 95 spirits, 522 conversation backgrounds, and the UI that EverTalk itself used are all bundled directly into this project. Each spirit's name, personality, and speech patterns are organized one file at a time under `data/personas/`, prepared in Korean, English, and Chinese (Traditional/Simplified) in advance — so switching languages never breaks what makes that spirit feel like itself.

<p align="center">
  <img src="public/eversoul-assets/spirits/GarnetRapture/base/GarnetRapture_1024.png" width="120" alt="GarnetRapture" />
  <img src="public/eversoul-assets/spirits/Adrianne/base/Adrianne_1024.png" width="120" alt="Adrianne" />
  <img src="public/eversoul-assets/spirits/Naomi/base/Naomi_1024.png" width="120" alt="Naomi" />
  <img src="public/eversoul-assets/spirits/Laura/base/Laura_1024.png" width="120" alt="Laura" />
  <img src="public/eversoul-assets/spirits/Weiss/base/Weiss_1024.png" width="120" alt="Weiss" />
  <img src="public/eversoul-assets/spirits/Lilith/base/Lilith_1024.png" width="120" alt="Lilith" />
</p>

---

## 🎨 Full Spirit Gallery (95 Spirits)

A complete gallery built by looking through all 95 `data/personas/*.json` files, listing each spirit's artwork alongside its real Korean (ko), English (en), and Simplified Chinese (zh_cn) names exactly as stored in the data. The artwork folder names are taken exactly the way `resolveSpiritAssetFolder` in `src/domains/persona/logic.ts` looks them up (26 spirits whose in-game display name differs from their actual artwork folder name follow the `explicitAssetFolders` mapping as-is).

<table>
<tr>
<td align="center"><img src="public/eversoul-assets/spirits/Oyome/base/Oyome_1024.png" width="64"/><br/><sub>아야메<br/>Ayame<br/>綾織</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/AyameTsukuyomi/base/AyameTsukuyomi_1024.png" width="64"/><br/><sub>아야메(츠쿠요미)<br/>Ayame (Tsukuyomi)<br/>綾織（月讀）</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Aki/base/Aki_1024.png" width="64"/><br/><sub>아키<br/>Aki<br/>秋</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Alisha/base/Alisha_1024.png" width="64"/><br/><sub>알리샤<br/>Alisha<br/>艾麗西雅</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Adrianne/base/Adrianne_1024.png" width="64"/><br/><sub>아드리안<br/>Adrianne<br/>阿德里安</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Aira/base/Aira_1024.png" width="64"/><br/><sub>아이라<br/>Aira<br/>艾拉</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/ClaudiaArchangel/base/ClaudiaArchangel_1024.png" width="64"/><br/><sub>클라우디아(대천사)<br/>Claudia (Archangel)<br/>克勞迪婭（大天使）</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Beatrice/base/Beatrice_1024.png" width="64"/><br/><sub>클레르<br/>Claire<br/>克萊兒</sub></td>
</tr>
<tr>
<td align="center"><img src="public/eversoul-assets/spirits/Catarina/base/Catarina_1024.png" width="64"/><br/><sub>셰리<br/>Cherrie<br/>雪莉</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Chloe/base/Chloe_1024.png" width="64"/><br/><sub>클로이<br/>Chloe<br/>克羅伊</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/CherrieRoman/base/CherrieRoman_1024.png" width="64"/><br/><sub>셰리(낭만)<br/>Cherrie (Romantic)<br/>雪莉（浪漫）</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Clara/base/Clara_1024.png" width="64"/><br/><sub>클라라<br/>Clara<br/>克拉拉</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Claudia/base/Claudia_1024.png" width="64"/><br/><sub>클라우디아<br/>Claudia<br/>克勞迪婭</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Olivia/base/Olivia_1024.png" width="64"/><br/><sub>가넷<br/>Garnet<br/>佳妮特</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/CatherineBrave/base/CatherineBrave_1024.png" width="64"/><br/><sub>캐서린(광휘)<br/>Catherine (Radiance)<br/>凱瑟琳（光輝）</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Dominique/base/Dominique_1024.png" width="64"/><br/><sub>도미니크<br/>Dominique<br/>多米尼克</sub></td>
</tr>
<tr>
<td align="center"><img src="public/eversoul-assets/spirits/Eileen/base/Eileen_1024.png" width="64"/><br/><sub>에일린<br/>Eileen<br/>艾琳</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Ina/base/Ina_1024.png" width="64"/><br/><sub>이나<br/>Ina<br/>伊娜</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Hazel/base/Hazel_1024.png" width="64"/><br/><sub>헤이즐<br/>Hazel<br/>黑伊茲爾</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Catherine/base/Catherine_1024.png" width="64"/><br/><sub>캐서린<br/>Catherine<br/>凱瑟琳</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Dora/base/Dora_1024.png" width="64"/><br/><sub>도라<br/>Dora<br/>朵菈</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/GarnetRapture/base/GarnetRapture_1024.png" width="64"/><br/><sub>가넷(열락)<br/>Garnet (Rapture)<br/>佳妮特（狂喜）</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Honglan/base/Honglan_1024.png" width="64"/><br/><sub>홍란<br/>Honglan<br/>紅蘭</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Hanul/base/Hanul_1024.png" width="64"/><br/><sub>한울<br/>Hanul<br/>韓羽</sub></td>
</tr>
<tr>
<td align="center"><img src="public/eversoul-assets/spirits/Edith/base/Edith_1024.png" width="64"/><br/><sub>이디스<br/>Edith<br/>伊迪絲</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Milia/base/Milia_1024.png" width="64"/><br/><sub>플린<br/>Flynn<br/>弗林</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Erusha/base/Erusha_1024.png" width="64"/><br/><sub>에루샤<br/>Erusha<br/>艾魯莎</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/HonglanCombat/base/HonglanCombat_1024.png" width="64"/><br/><sub>홍란(무쌍)<br/>Honglan (Peerless)<br/>紅蘭（無雙）</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Erika/base/Erika_1024.png" width="64"/><br/><sub>에리카<br/>Erika<br/>艾麗卡</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/HaruKamuy/base/HaruKamuy_1024.png" width="64"/><br/><sub>하루(카무이)<br/>Haru (Kamuy)<br/>河路（神威）</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Carnelian/base/Carnelian_1024.png" width="64"/><br/><sub>카넬리안<br/>Carnelian<br/>卡內莉安</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Karen/base/Karen_1024.png" width="64"/><br/><sub>카렌<br/>Karen<br/>卡倫</sub></td>
</tr>
<tr>
<td align="center"><img src="public/eversoul-assets/spirits/Joanne/base/Joanne_1024.png" width="64"/><br/><sub>조앤<br/>Joanne<br/>瓊</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Daphne/base/Daphne_1024.png" width="64"/><br/><sub>다프네<br/>Daphne<br/>達芙妮</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Eve/base/Eve_1024.png" width="64"/><br/><sub>이브<br/>Eve<br/>夏娃</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Jade/base/Jade_1024.png" width="64"/><br/><sub>제이드<br/>Jade<br/>潔依德</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Tokisaki/base/Tokisaki_1024.png" width="64"/><br/><sub>토키사키 쿠루미<br/>Kurumi Tokisaki<br/>時崎狂三</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Jacqueline/base/Jacqueline_1024.png" width="64"/><br/><sub>재클린<br/>Jacqueline<br/>潔克琳</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Larimar/base/Larimar_1024.png" width="64"/><br/><sub>라리마<br/>Larimar<br/>拉利瑪</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Mia/base/Mia_1024.png" width="64"/><br/><sub>하루<br/>Haru<br/>河路</sub></td>
</tr>
<tr>
<td align="center"><img src="public/eversoul-assets/spirits/Jiho/base/Jiho_1024.png" width="64"/><br/><sub>지호<br/>Jiho<br/>智河</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Lewayne/base/Lewayne_1024.png" width="64"/><br/><sub>르웨인<br/>Lewayne<br/>樂溫</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Blyce/base/Blyce_1024.png" width="64"/><br/><sub>브라이스<br/>Bryce<br/>布萊斯</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Kanna/base/Kanna_1024.png" width="64"/><br/><sub>칸나<br/>Kanna<br/>坎納</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/JihoMir/base/JihoMir_1024.png" width="64"/><br/><sub>지호(미르)<br/>Jiho (Mir)<br/>智河（米爾）</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Beleth/base/Beleth_1024.png" width="64"/><br/><sub>벨레드<br/>Beleth<br/>貝萊德</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Linzy/base/Linzy_1024.png" width="64"/><br/><sub>린지<br/>Linzy<br/>琳賽</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Laura/base/Laura_1024.png" width="64"/><br/><sub>라우라<br/>Laura<br/>蘿拉</sub></td>
</tr>
<tr>
<td align="center"><img src="public/eversoul-assets/spirits/LinzyThanatos/base/LinzyThanatos_1024.png" width="64"/><br/><sub>린지(타나토스)<br/>Linzy (Thanatos)<br/>琳賽（桑納托斯）</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Lilith/base/Lilith_1024.png" width="64"/><br/><sub>릴리트<br/>Lilith<br/>莉莉絲</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Lizelotte/base/Lizelotte_1024.png" width="64"/><br/><sub>리젤로테<br/>Lizelotte<br/>莉澤洛特</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Lute/base/Lute_1024.png" width="64"/><br/><sub>루테<br/>Lute<br/>魯特</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Manon/base/Manon_1024.png" width="64"/><br/><sub>마농<br/>Manon<br/>瑪儂</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Melfice/base/Melfice_1024.png" width="64"/><br/><sub>멜피스<br/>Melfice<br/>梅爾菲斯</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Mephisto/base/Mephisto_1024.png" width="64"/><br/><sub>메피스토펠레스<br/>Mephistopheles<br/>梅菲斯托佩萊斯</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Meryl/base/Meryl_1024.png" width="64"/><br/><sub>메릴<br/>Meryl<br/>梅莉兒</sub></td>
</tr>
<tr>
<td align="center"><img src="public/eversoul-assets/spirits/Mica/base/Mica_1024.png" width="64"/><br/><sub>미카<br/>Mica<br/>米卡</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/MephistoDawn/base/MephistoDawn_1024.png" width="64"/><br/><sub>메피스토펠레스(여명)<br/>Mephistopheles (Dawn)<br/>梅菲斯托佩萊斯（黎明）</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Miriam/base/Miriam_1024.png" width="64"/><br/><sub>미리암<br/>Miriam<br/>米里昂</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Nameless/base/Nameless_1024.png" width="64"/><br/><sub>무명<br/>Nameless<br/>無名</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Nyah/base/Nyah_1024.png" width="64"/><br/><sub>나이아<br/>Naiah<br/>娜伊雅</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Naomi/base/Naomi_1024.png" width="64"/><br/><sub>나오미<br/>Naomi<br/>直美</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/MiriamMirage/base/MiriamMirage_1024.png" width="64"/><br/><sub>미리암(잔영)<br/>Miriam (Afterimage)<br/>米里昂（殘影）</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Nicole/base/Nicole_1024.png" width="64"/><br/><sub>니콜<br/>Nicole<br/>妮可</sub></td>
</tr>
<tr>
<td align="center"><img src="public/eversoul-assets/spirits/Nia/base/Nia_1024.png" width="64"/><br/><sub>니아<br/>Nia<br/>妮亞</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Onyx/base/Onyx_1024.png" width="64"/><br/><sub>오닉스<br/>Onyx<br/>歐妮絲</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Nini/base/Nini_1024.png" width="64"/><br/><sub>니니<br/>Nini<br/>妮妮</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Otoha/base/Otoha_1024.png" width="64"/><br/><sub>오토하<br/>Otoha<br/>乙葉</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/PetraAwaken/base/PetraAwaken_1024.png" width="64"/><br/><sub>페트라(각혼)<br/>Petra (Awakened Soul)<br/>佩特拉（覺魂）</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Rebecca/base/Rebecca_1024.png" width="64"/><br/><sub>레베카<br/>Rebecca<br/>瑞貝卡</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Rose/base/Rose_1024.png" width="64"/><br/><sub>로제<br/>Rose<br/>蘿絲</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Leah/base/Leah_1024.png" width="64"/><br/><sub>르네<br/>Renee<br/>勒內</sub></td>
</tr>
<tr>
<td align="center"><img src="public/eversoul-assets/spirits/Rita/base/Rita_1024.png" width="64"/><br/><sub>리타<br/>Rita<br/>麗塔</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/RoseCrimson/base/RoseCrimson_1024.png" width="64"/><br/><sub>로제(홍염)<br/>Rose (Prominence)<br/>蘿絲（紅焰）</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/ReneeSilver/base/ReneeSilver_1024.png" width="64"/><br/><sub>르네(백은)<br/>Renee (Argent)<br/>勒內（白銀）</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Tasha/base/Tasha_1024.png" width="64"/><br/><sub>타샤<br/>Tasha<br/>塔莎</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Petra/base/Petra_1024.png" width="64"/><br/><sub>페트라<br/>Petra<br/>佩特拉</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Prim/base/Prim_1024.png" width="64"/><br/><sub>프림<br/>Prim<br/>弗里姆</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/SakuyoShin/base/SakuyoShin_1024.png" width="64"/><br/><sub>사쿠요(업화)<br/>Sakuyo (Inferno)<br/>櫻世（業火）</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Sunny/base/Sunny_1024.png" width="64"/><br/><sub>순이<br/>Soonie<br/>順伊</sub></td>
</tr>
<tr>
<td align="center"><img src="public/eversoul-assets/spirits/Sharing/base/Sharing_1024.png" width="64"/><br/><sub>샤링<br/>Sharinne<br/>夏琳</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Amelia/base/Amelia_1024.png" width="64"/><br/><sub>비올레트<br/>Violette<br/>薇奧蕾特</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Yatogami/base/Yatogami_1024.png" width="64"/><br/><sub>야토가미 토카<br/>Tohka Yatogami<br/>夜刀神十香</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Talia/base/Talia_1024.png" width="64"/><br/><sub>탈리아<br/>Talia<br/>塔利亞</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Sigrid/base/Sigrid_1024.png" width="64"/><br/><sub>시그리드<br/>Sigrid<br/>希格莉德</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Seeha/base/Seeha_1024.png" width="64"/><br/><sub>시하<br/>Seeha<br/>西荷</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Ruri/base/Ruri_1024.png" width="64"/><br/><sub>루리<br/>Ruri<br/>魯莉</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Weiss/base/Weiss_1024.png" width="64"/><br/><sub>바이스<br/>Weiss<br/>拜斯</sub></td>
</tr>
<tr>
<td align="center"><img src="public/eversoul-assets/spirits/Velanna/base/Velanna_1024.png" width="64"/><br/><sub>벨라나<br/>Velanna<br/>貝拉納</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Vivienne/base/Vivienne_1024.png" width="64"/><br/><sub>비비안<br/>Vivienne<br/>薇薇安</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Xiaolian/base/Xiaolian_1024.png" width="64"/><br/><sub>소연<br/>Xiaolian<br/>小蓮</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Yuria/base/Yuria_1024.png" width="64"/><br/><sub>유리아<br/>Yuria<br/>尤里婭</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Sakuyo/base/Sakuyo_1024.png" width="64"/><br/><sub>사쿠요<br/>Sakuyo<br/>櫻世</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/YuriaApollyon/base/YuriaApollyon_1024.png" width="64"/><br/><sub>유리아(아폴리온)<br/>Yuria (Apollyon)<br/>尤里婭（阿巴頓）</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Wheri/base/Wheri_1024.png" width="64"/><br/><sub>웨리<br/>Wheri<br/>威里</sub></td>
<td></td>
</tr>
</table>

Each spirit's artwork doesn't stop at a single picture. It's split across folders — `base` (everyday look), `costume`, `raid`, `gacha`, `srg` — so the same spirit has several different pictures on hand.

<p align="center">
  <img src="public/eversoul-assets/spirits/Adrianne/base/Adrianne_1024.png" width="110" alt="Adrianne base" />
  <img src="public/eversoul-assets/spirits/Adrianne/costume/Adrianne_Costume02_2048.png" width="110" alt="Adrianne costume" />
  <img src="public/eversoul-assets/spirits/Adrianne/gacha/Adrianne_Gacha_2048.png" width="110" alt="Adrianne gacha" />
  <img src="public/eversoul-assets/spirits/Adrianne/raid/Adrianne_Raid_2048.png" width="110" alt="Adrianne raid" />
</p>
<p align="center"><sub>What's in Adrianne's folder — from left, base, costume, gacha, raid</sub></p>

---

## 🚀 Key Features

- 💻 **AI that runs on your computer alone**: Built on `llama.cpp`, generating replies without a GPU. Threads are sized to your CPU's physical core count, so it stays stable without overloading your machine.
- 🎭 **95 spirits, each with their own personality**: Name, grade, race, class, voice actor, birthday, likes — everything organized per spirit gets loaded and assembled so every spirit speaks like themselves.
- 🧠 **A spirit that remembers talking with you**: After every exchange, the spirit checks itself for anything worth remembering and keeps it. Those memories get re-summarized from time to time, so the spirit carries them into the next conversation too.
- 🌐 **Switch languages, the spirit stays the same**: Names, introductions, and speech patterns are all ready in Korean, English, and Chinese (Traditional/Simplified), so changing the app language instantly changes the spirit's name and introduction too.
- 🧬 **Fine-tuning that makes a spirit more itself over time**: A Qwen2 model built from scratch in pure Rust (`candle`), no Python involved — you can run local fine-tuning (LoRA) right on your own machine, trained on that spirit's own conversations.
- 📂 **Everything stays on your computer**: Conversations, spirit profiles, and speech-pattern settings all stay in a lightweight SQLite database.
- 🖼️ **Backgrounds stay too**: All 522 official EverSoul illustration backgrounds are ready to pull up and change the mood of the conversation whenever you like.

<p align="center">
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_Castle.png" width="150" alt="Talk BG Castle" />
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_Library.png" width="150" alt="Talk BG Library" />
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_Galaxy.png" width="150" alt="Talk BG Galaxy" />
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_CherryBlossom.png" width="150" alt="Talk BG CherryBlossom" />
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_Sanctum.png" width="150" alt="Talk BG Sanctum" />
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_SkyArk.png" width="150" alt="Talk BG SkyArk" />
</p>

---

## 🏗 Architecture

The React frontend and Rust backend are structured as symmetric domain modules of the same name, communicating exclusively through Tauri IPC (`invoke`).

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#cde2fb', 'primaryBorderColor': '#2a78d6', 'primaryTextColor': '#0b0b0b', 'lineColor': '#52514e', 'clusterBkg': '#fcfcfb', 'clusterBorder': '#c3c2b7', 'fontFamily': 'system-ui, -apple-system, Segoe UI, sans-serif'}}}%%
flowchart TB
    subgraph FE["Frontend · src/domains"]
        direction LR
        FE1["auth · chat · knowledge"]
        FE2["llm · persona · settings"]
        FE3["style · sync · training"]
        FE4["evertalk<br/>SpiritRoster · ChatStage · SettingsPanel"]
    end

    FE == "Tauri invoke<br/>67 commands" ==> BE

    subgraph BE["Backend · src-tauri/src/domains + infrastructure"]
        direction LR
        BE1["auth · chat · knowledge"]
        BE2["llm · persona · settings"]
        BE3["style · sync · training"]
    end

    BE -- "rooms · messages · spirit profiles · memories" --> DB[("SQLite<br/>eversoul.db")]
    BE -- "Shared-prefix reuse<br/>Persistent session KV state" --> CACHE[("KV Cache<br/>ai/cache/*.bin")]
    BE -- "Local context assembly inference" --> LLM["Local GGUF model<br/>gemma-2-2b-it Q4_K_M<br/>llama.cpp"]

    classDef feStyle fill:#cde2fb,stroke:#2a78d6,stroke-width:2px,color:#0b0b0b
    classDef beStyle fill:#e3ddf7,stroke:#4a3aa7,stroke-width:2px,color:#0b0b0b
    classDef dbStyle fill:#c9f0d8,stroke:#008300,stroke-width:2px,color:#0b0b0b
    classDef llmStyle fill:#fbdcc9,stroke:#eb6834,stroke-width:2px,color:#0b0b0b
    classDef cacheStyle fill:#fff4cc,stroke:#ffb703,stroke-width:2px,color:#0b0b0b

    class FE1,FE2,FE3,FE4 feStyle
    class BE1,BE2,BE3 beStyle
    class DB dbStyle
    class LLM llmStyle
    class CACHE cacheStyle
```

- **Local DB path**: `database/eversoul.db` under the OS app-data directory (reset on every launch in debug builds).
- **Settings file**: `config/settings.ini` under the app-data directory (read/written via `rust-ini`; stores default spirit, active style, and language).
- **KV Cache storage**: `ai/cache/` under the app directory (per-spirit KV state saved as `.bin` files on session eviction, spirit warm-up, app exit, and engine unload; the next turn then skips recomputing whatever prefix the prompt still shares).
- **Async Runtime Architecture**: LLM computation runs on a dedicated worker thread, and Tauri commands await it through `tauri::async_runtime::spawn_blocking`, guaranteeing a non-blocking main UI thread.
- **Token streaming**: Replies arrive token by token over the `chat-stream-token` / `chat-stream-done` events and render immediately, and generation can be cancelled mid-flight with the stop button.

More detailed diagrams — the spirit-data build pipeline, the conversation sequence, the LoRA training flow, and the database structure — are in [docs/wiki/ARCHITECTURE.en.md](docs/wiki/ARCHITECTURE.en.md).

---

## 🛠 Tech Stack

### Frontend Stack
- **Framework**: `React 19.1` + `TypeScript 6.0` + `Vite 8`
- **State Management**: `TanStack React Query v5` (async server state), `Zustand v5` (global client state)
- **Styling**: `Tailwind CSS v4` (`@tailwindcss/vite`) + `clsx` (class composition)
- **Icons**: `lucide-react`
- **Tauri Plugins**: `@tauri-apps/plugin-dialog`, `plugin-fs`, `plugin-opener`, `plugin-shell`

### Desktop Runtime & Backend Stack
- **Core Runtime**: `Tauri v2` (Rust 2021 edition); release builds are optimized with `codegen-units=1` + `lto=true` + `opt-level=3` + `panic=abort` + `strip`.
- **Local Database**: `SQLite3` (`rusqlite` bundled)
- **HTTP Client**: `reqwest` (rustls, json, stream features)
- **AI Inference Engine**: `llama.cpp` (`llama-cpp-2` C-bindings, GGUF format) + `num_cpus` (physical-core-based thread sizing)
- **On-device Fine-tuning**: `candle-core` / `candle-nn` 0.8 (Qwen2 architecture + hand-built LoRA adapter), `hf-hub`, `tokenizers` (BPE, `onig` feature)
- **Serialization / Utilities**: `serde`, `serde_json`, `anyhow`, `thiserror`, `tracing` + `tracing-subscriber`, `uuid`, `directories`, `sha2`, `hex`, `flate2`, `rust-ini`

---

## 📦 Local Model

A single fixed model that runs on CPU alone. It is too large to ship in the repository, so the first-run setup wizard downloads it for you.

- **Name**: `gemma-2-2b-it Q4_K_M` (GGUF)
- **Source**: [`bartowski/gemma-2-2b-it-GGUF`](https://huggingface.co/bartowski/gemma-2-2b-it-GGUF)
- **Location**: `ai/model/gemma-2-2b-it-Q4_K_M.gguf`
- **Verification**: SHA-256 is computed after the download and, when a `.sha256` sidecar file is present, checked against it.

---

## 💻 Run & Build Guide

### ⭐ Easiest path — build in your own fork with GitHub Actions

GitHub builds it for you, so you never install Rust, CMake, or Clang locally.

1. Press **Fork** at the top right of this repository to copy it into your account.
2. Press **Star** ⭐ and **Watch** 👁 so you don't miss later updates.
3. Open the **Actions** tab of **your own** fork and pick the `Build Portable` workflow.
4. Press **Run workflow**. (Right after forking you have to enable Actions once before the button shows up.)
5. When the run finishes, download `eversoul-ai-chat-portable-*` from the **Artifacts** section at the bottom of the run page and unzip it.
6. Launch `eversoul-ai-chat.exe`; the setup wizard downloads the local model.

Push a `v*` tag such as `v0.0.21` to your fork and the same workflow zips the build and publishes it to **your fork's Releases**.

### Building locally

The frontend is TypeScript and the backend is Rust + Tauri v2, so both toolchains are required.

- [Node.js](https://nodejs.org/) 22 or later (frontend build and `npm` scripts)
- [Rust](https://rustup.rs/) stable toolchain (2021 edition, includes `cargo`)

The `llama-cpp-2` crate used for local inference is not pure Rust — it is a binding (`llama-cpp-sys-2`) that builds llama.cpp's C/C++ sources alongside it. That means `cargo build` invokes all three of the following, and fails without them.

- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) — the MSVC compiler that compiles llama.cpp's C++ code
- [CMake](https://cmake.org/download/) 3.20 or later — llama.cpp is a CMake project, so this configures its build
- [Clang](https://releases.llvm.org/download.html) — `bindgen` needs `libclang` to parse llama.cpp headers and generate the Rust FFI bindings

If you build through GitHub Actions instead, the workflow installs all three on the runner, so nothing lands on your machine.

```bash
npm install        # install dependencies
npm run tauri dev  # run in development mode
npm run build      # portable build (tauri build + build/ packaging)
```

---

## 🧩 Spirit (Persona) Data Schema

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

When the app is actually chatting, it reads a spirit's name, personality, and speech patterns from the SQLite `persona_profile.raw_json` column. Every time the spirit list is queried, `PersonaService::get_available_personas` reloads it from `personas.bin` and upserts it into that column, and the system prompt actually sent to the LLM is assembled by `PersonaService::build_localized_system_prompt` parsing that same `raw_json`.

The source of that data is the 95 `data/personas/*.json` files. `tools/build_complete_personas.cjs` normalizes them into the 4-language array (`LANGUAGES = ['ko', 'en', 'zh_tw', 'zh_cn']`) and builds them into `personas.bin`. Below is the real field structure of one of those source files (Adrianne's).

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
- For display, `parseSpiritDetail` in `src/domains/persona/logic.ts` parses this same `raw_json` and picks the right language. The system prompt actually sent to the LLM is assembled separately — the Rust backend's `PersonaService::build_localized_system_prompt` re-parses `raw_json` on its own — but both ultimately read from SQLite's `raw_json`.
- Each spirit's artwork lives under `public/eversoul-assets/spirits/{EnglishName}/`, split into category folders: `base` (base illustration at 512/1024/2048), `costume`, `gacha`, `raid`, and `srg` (story). The `LoadableAssetImage` component (`src/domains/evertalk/components/LoadableAssetImage.tsx`) tries a list of candidate paths in order (`useFirstLoadableImage`) and renders the first one that actually loads.

---

## 📌 Versioning Rule

This repository follows the principle of **incrementing the patch version by 1 for every commit**. The `version` field in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` must always stay in sync, and all three files are updated together whenever a commit containing a functional change is created.

| Version | Commit |
| --- | --- |
| 0.0.1 | `first` |
| 0.0.2 | `초기세팅` |
| 0.0.3 | `초기세팅2` |
| 0.0.4 | `초기세팅3` |
| 0.0.5 | `초기셋팅4` |
| 0.0.6 | `update_i18n : en , kr , zh_tw , zh_cn` |
| 0.0.7 | Trilingual README overhaul + versioning rule documentation |
| 0.0.7 | `up` |
| 0.0.8 | `bugfix` |
| 0.0.9 | `up` |
| 0.0.10 | `fix` |
| 0.0.11 | `1` |
| 0.0.12 | `초기릴리즈` |
| 0.0.13 | `클린` |
| 0.0.14 | `feat:` |
| 0.0.15 | `feat: 로컬 LLM 및 외부 API 연동 하이브리드 구동 모드 추가 및 설정 UI/다국어 적용` |
| 0.0.17 | `Merge pull request #1 from GarnetRapture/codex/setup-from-v0.0.11` |
| 0.0.18 | `fix` |
| 0.0.19 | `ㅇ` |
| 0.0.20 | `버그수정` |
| 0.0.20 | `도메인 컨트롤러 분리 및 다국어 에러 통일, 프론트-백엔드 정합화` |
| 0.0.21 | `Fix local inference correctness, wire streaming chat, add fork-and-build CI` |
| 0.0.22 | `Untrack local runtime config` |
| 0.0.23 | `Keep Cargo.lock in sync with the version bump` |

---

## 📄 License

The **Apache License 2.0** in this repository covers only the source code this project wrote itself — the frontend (`src/`) and the backend (`src-tauri/src/`, `scripts/`, `tools/`). This project holds no rights to the third-party works below.

- **Local model `gemma-2-2b-it`** — a Google work governed by the [Gemma Terms of Use](https://ai.google.dev/gemma/terms). This repository neither bundles nor redistributes the model weights; the app downloads them on the user's own machine from [Hugging Face](https://huggingface.co/bartowski/gemma-2-2b-it-GGUF). Obligations that come with using the model rest with the user who downloads it.
- **EverSoul game resources** — spirit illustrations, talk backgrounds, source persona data, and voice lines remain the property of their original rights holders. This project claims no rights to them and uses them as a non-commercial fan project.

See [NOTICE](NOTICE) for the full attribution and [LICENSE-THIRD-PARTY.md](LICENSE-THIRD-PARTY.md) for the per-item breakdown.
