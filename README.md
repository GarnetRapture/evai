<p align="right">
  <img src="https://flagcdn.com/20x15/kr.png" width="20" height="15" alt="KR" /> <strong>한국어</strong> &nbsp;|&nbsp;
  <a href="README.en.md"><img src="https://flagcdn.com/20x15/us.png" width="20" height="15" alt="US" /> English</a>
</p>

<p align="center">
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_Castle_Aurelia.png" width="960" alt="EverSoul AI Chat Banner" />
</p>

<h1 align="center">EverSoul AI Chat</h1>
<p align="center"><i>PC Chrome 온디바이스 AI로만 동작하는 서버리스 웹 AI 채팅</i></p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.0.1-blue?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/license-Apache_2.0-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/Chrome-Prompt_API-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Prompt API" />
  <img src="https://img.shields.io/badge/React-19.3-61DAFB?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-7.0-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-8.3-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/IndexedDB-idb_8-003B57?style=flat-square" alt="IndexedDB" />
  <img src="https://img.shields.io/badge/spirits-99-9b5de5?style=flat-square" alt="Spirits" />
  <img src="https://img.shields.io/badge/talk_backgrounds-522-f15bb5?style=flat-square" alt="Backgrounds" />
  <img src="https://img.shields.io/badge/languages-ko%20%7C%20en%20%7C%20zh__cn-00bbf9?style=flat-square" alt="Languages" />
</p>

<p align="center">
  <a href="https://ai.everlib.pro/"><img src="https://img.shields.io/badge/서비스-ai.everlib.pro-8957e5?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Service" /></a>
  <a href="https://github.com/GarnetRapture/evai/fork"><img src="https://img.shields.io/badge/Fork-238636?style=for-the-badge&logo=github&logoColor=white" alt="Fork" /></a>
  <a href="https://github.com/GarnetRapture/evai/stargazers"><img src="https://img.shields.io/badge/Star-e3b341?style=for-the-badge&logo=github&logoColor=white" alt="Star" /></a>
  <a href="https://github.com/GarnetRapture/evai/watchers"><img src="https://img.shields.io/badge/Watch-1f6feb?style=for-the-badge&logo=github&logoColor=white" alt="Watch" /></a>
</p>

<p align="center">
  <sub><b>PC의 Google Chrome 브라우저</b>에서만 이용할 수 있습니다. 모바일 기기와 Chrome 이외의 브라우저는 접속이 차단됩니다.</sub>
</p>

---

## 🌟 개요

**EverSoul AI Chat**은 에버소울을 간직할 새로운 AI 채팅 프로젝트입니다. 정령들의 기억을 보존한다는 의미로 만들었습니다. 에버소울에 등장하는 정령 99명을 실제 게임 데이터 그대로 불러와, 각자의 성격과 말투로 자유롭게 대화할 수 있습니다.

이 프로젝트는 서버가 없는 정적 웹 앱입니다. 대화를 만들어내는 AI는 PC Chrome 브라우저에 내장된 온디바이스 AI(Prompt API · Gemini Nano)이고, 대화·기억·설정은 모두 그 PC 브라우저의 IndexedDB에만 저장됩니다. 대화 내용이 외부 서버로 나가지 않으며, 저장된 데이터는 PC 파일로 내보내거나 PC 폴더에 자동 백업할 수 있습니다.

정령 99명 전원의 실제 게임 그림, 대화 배경 522장, 에버톡 화면에서 쓰던 UI까지 프로젝트 안에 그대로 담아뒀습니다. 각 정령의 이름과 성격, 말투는 `data/personas/`에 정령마다 하나씩 정리되어 있고, 한국어·영어·중국어(번체/간체) 언어별 값이 미리 준비되어 있어서 언어를 바꿔도 그 정령다움은 그대로 유지됩니다.

<p align="center">
  <img src="public/eversoul-assets/spirits/GarnetRapture/base/GarnetRapture_1024.png" width="120" alt="GarnetRapture" />
  <img src="public/eversoul-assets/spirits/Adrianne/base/Adrianne_1024.png" width="120" alt="Adrianne" />
  <img src="public/eversoul-assets/spirits/Naomi/base/Naomi_1024.png" width="120" alt="Naomi" />
  <img src="public/eversoul-assets/spirits/Laura/base/Laura_1024.png" width="120" alt="Laura" />
  <img src="public/eversoul-assets/spirits/Weiss/base/Weiss_1024.png" width="120" alt="Weiss" />
  <img src="public/eversoul-assets/spirits/Lilith/base/Lilith_1024.png" width="120" alt="Lilith" />
</p>

---

## 🎨 전체 정령 갤러리 (99종)

`data/personas/*.json` 99개 파일을 전부 살펴서 정령 그림과 한국어(ko)·영어(en)·중국어 간체(zh_cn) 이름을 실제 데이터 그대로 나열한 도감입니다. 그림 폴더 이름은 `src/domains/persona/logic.ts`의 `resolveSpiritAssetFolder`가 찾는 방식 그대로 가져왔습니다(게임 내 표시명과 실제 그림 폴더명이 다른 27명은 `explicitAssetFolders` 매핑을, 그림 파일 접두사가 폴더명과 다른 Canney·Casper·Irene은 `assetFilePrefixes` 매핑을 그대로 따랐습니다).

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
<td align="center"><img src="public/eversoul-assets/spirits/Canney/base/Beast_1024.png" width="64"/><br/><sub>Canney<br/>Canney<br/>Canney</sub></td>
</tr>
<tr>
<td align="center"><img src="public/eversoul-assets/spirits/Casper/base/Ghost_1024.png" width="64"/><br/><sub>Casper<br/>Casper<br/>Casper</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Irene/base/Apprentice_1024.png" width="64"/><br/><sub>Irene<br/>Irene<br/>Irene</sub></td>
<td align="center"><img src="public/eversoul-assets/spirits/Pixie/base/Pixie_1024.png" width="64"/><br/><sub>Pixie<br/>Pixie<br/>Pixie</sub></td>
<td></td>
<td></td>
<td></td>
<td></td>
<td></td>
</tr>
</table>

정령마다 그림이 한 장으로 끝나지 않습니다. `base`(평소 모습), `costume`(의상), `raid`, `gacha`, `srg` 폴더로 나뉘어서 같은 정령이라도 여러 장의 그림이 준비되어 있습니다. 앱은 `base`·`costume`·`raid` 그림을 스킨으로 보여주며, 정령마다 고른 스킨은 설정에 저장됩니다.

<p align="center">
  <img src="public/eversoul-assets/spirits/Adrianne/base/Adrianne_1024.png" width="110" alt="Adrianne base" />
  <img src="public/eversoul-assets/spirits/Adrianne/costume/Adrianne_Costume02_2048.png" width="110" alt="Adrianne costume" />
  <img src="public/eversoul-assets/spirits/Adrianne/gacha/Adrianne_Gacha_2048.png" width="110" alt="Adrianne gacha" />
  <img src="public/eversoul-assets/spirits/Adrianne/raid/Adrianne_Raid_2048.png" width="110" alt="Adrianne raid" />
</p>
<p align="center"><sub>아드리안 폴더에 있는 그림들 — 왼쪽부터 base, costume, gacha, raid</sub></p>

---

## 🚀 주요 기능

- 💻 **PC Chrome 온디바이스 AI**: Chrome에 내장된 Prompt API(`LanguageModel`, Gemini Nano)로 대답을 만듭니다. 서버나 외부 API를 쓰지 않으며, 모델 내려받기와 준비는 설정 > 온디바이스 모델 목록에서 진행합니다.
- 🔒 **이용 환경 제한과 첫 진입 안내**: PC의 Google Chrome이 아니면(모바일 기기, 다른 브라우저) 접속이 차단됩니다. 처음 들어올 때는 "PC Chrome 온디바이스 AI로만 동작한다"는 안내를 확인하고 체크해야 입장할 수 있습니다.
- 🎭 **99명의 정령, 각자의 성격 그대로**: 이름과 등급, 종족, 직업은 물론 성우, 생일, 좋아하는 것, 대표 대사와 에버톡 대화 예시까지 불러와 정령마다 시스템 프롬프트를 만들고, 그 정령답게 말하도록 합니다.
- 🧠 **정령이 나와의 대화를 기억함**: 매 턴의 대화를 정령별 기억으로 남기고, 다음 대화에서 관련된 기억을 떠올려 함께 전달합니다. 기억이 10개 쌓일 때마다 온디바이스 AI가 다시 정리한 요약을 시스템 프롬프트에 넣습니다.
- 🎯 **지금 채팅 중인 정령에만 집중**: 대화는 매 턴 바로 저장되므로, 다른 정령으로 바꾸면 이전 정령의 생성 중인 응답을 멈추고 모델 세션도 지금 정령 하나만 유지합니다.
- 🌐 **언어를 바꿔도 그 정령 그대로**: UI·안내·오류 메시지가 한국어·영어·중국어(간체) 라벨로 준비되어 있고, 정령의 이름과 소개, 시스템 프롬프트도 선택한 언어로 바뀝니다.
- ⭐ **선호정령**: 목록의 별로 선호정령을 지정·해제하고, 친밀도 탭 맨 위에 선호정령으로 표시됩니다. 앱을 다시 켜면 선호정령이 먼저 선택됩니다.
- 🧩 **Risu 모듈**: `.risum` 모듈을 가져와 켜고 끌 수 있고, 활성 모듈의 설명과 로어북이 시스템 프롬프트에 추가됩니다.
- 📂 **내 PC에 저장·백업**: 대화, 기억, 설정, 모듈은 브라우저 IndexedDB에 저장되고, PC 파일로 내보내기·불러오기와 PC 백업 폴더 자동 백업·시점 복원을 지원합니다.
- 🖼️ **대화 배경도 그대로**: 에버소울 정식 일러스트 배경 522장을 언제든 꺼내서 대화창 분위기를 바꿀 수 있습니다.

<p align="center">
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_Castle.png" width="150" alt="Talk BG Castle" />
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_Library.png" width="150" alt="Talk BG Library" />
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_Galaxy.png" width="150" alt="Talk BG Galaxy" />
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_CherryBlossom.png" width="150" alt="Talk BG CherryBlossom" />
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_Sanctum.png" width="150" alt="Talk BG Sanctum" />
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_SkyArk.png" width="150" alt="Talk BG SkyArk" />
</p>

---

## 🏗 아키텍처

서버 없이 브라우저 안에서만 동작하는 React 정적 웹 앱입니다. UI 도메인(`evertalk`)이 각 도메인 서비스를 부르고, 도메인 서비스는 공용 모듈(`src/shared`)을 통해 IndexedDB, PC 파일, Chrome 온디바이스 AI에 접근합니다. Chrome `LanguageModel` API를 직접 다루는 곳은 `src/domains/llm/chrome/languageModel.ts` 한 곳뿐입니다.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#cde2fb', 'primaryBorderColor': '#2a78d6', 'primaryTextColor': '#0b0b0b', 'lineColor': '#52514e', 'clusterBkg': '#fcfcfb', 'clusterBorder': '#c3c2b7', 'fontFamily': 'system-ui, -apple-system, Segoe UI, sans-serif'}}}%%
flowchart TB
    subgraph UI["UI · src/domains/evertalk"]
        direction LR
        UI1["PlatformBlockedPanel · PlatformGuideGate<br/>SetupWizard"]
        UI2["SpiritRoster · ChatStage<br/>SpiritProfilePanel"]
        UI3["SettingsPanel · ModuleManagementPanel<br/>i18n (ko · en · zh_cn)"]
    end

    subgraph DOMAIN["도메인 서비스 · src/domains"]
        direction LR
        D1["persona · chat · style<br/>knowledge · modules"]
        D2["llm<br/>runtime · catalog · chrome"]
        D3["settings · sync · auth"]
    end

    subgraph SHARED["공용 모듈 · src/shared"]
        direction LR
        S1["storage (idb)"]
        S2["files (File System Access)"]
        S3["platform (UA Client Hints)<br/>i18n · errors · time"]
    end

    UI --> DOMAIN
    DOMAIN --> SHARED
    PACK["data/personas/*.json<br/>99개 · import.meta.glob"] --> D1
    S1 -- "대화방 · 메시지 · 정령 · 기억 · 설정 · 모듈" --> DB[("IndexedDB<br/>eversoul-ai-chat v2")]
    S2 -- "JSON 내보내기·불러오기<br/>백업 폴더 자동 백업" --> PC[("PC 파일 / 백업 폴더")]
    D2 -- "availability · create · clone<br/>promptStreaming" --> LLM["Chrome Prompt API<br/>LanguageModel · Gemini Nano"]

    classDef uiStyle fill:#cde2fb,stroke:#2a78d6,stroke-width:2px,color:#0b0b0b
    classDef domainStyle fill:#e3ddf7,stroke:#4a3aa7,stroke-width:2px,color:#0b0b0b
    classDef sharedStyle fill:#fff4cc,stroke:#ffb703,stroke-width:2px,color:#0b0b0b
    classDef dbStyle fill:#c9f0d8,stroke:#008300,stroke-width:2px,color:#0b0b0b
    classDef llmStyle fill:#fbdcc9,stroke:#eb6834,stroke-width:2px,color:#0b0b0b

    class UI1,UI2,UI3 uiStyle
    class D1,D2,D3 domainStyle
    class S1,S2,S3,PACK sharedStyle
    class DB,PC dbStyle
    class LLM llmStyle
```

- **이용 환경 판별**: `src/shared/platform`이 `navigator.userAgentData`의 브랜드·모바일 여부·플랫폼을 읽어, 브랜드에 `Google Chrome`이 있고 모바일이 아니며 Windows·macOS·Linux·ChromeOS일 때만 앱을 엽니다. 그 밖의 환경은 `PlatformBlockedPanel`만 보여주고 초기화도 하지 않습니다. 첫 진입 안내 확인 여부(`platform_guide_acknowledged`)는 설정에 저장됩니다.
- **정령 데이터**: `src/domains/persona/archive.ts`가 `import.meta.glob`으로 `data/personas/*.json`을 불러오고, 초기 설정 때 IndexedDB `persona_profile`에 설치합니다. 언어별 시스템 프롬프트는 `persona_localized_prompt`에 캐시합니다.
- **시스템 프롬프트**: 원본 Rust 구현을 그대로 옮겼습니다. 정령 프로필·성격·대표 대사(12개)·에버톡 대화 예시(16개)·다른 정령의 평가 + 이름·호칭 규칙에, 말투 스타일, 활성 Risu 모듈, 통합 기억 요약을 이어 붙입니다. 매 턴에는 최근 대화 6개, 관련 기억 최대 5개(후보 200개 중), 지식 데이터 최대 2개, `<think>` 지침이 함께 전달됩니다.
- **온디바이스 세션**: 지금 채팅 중인 정령 하나의 세션만 유지합니다(시스템 프롬프트를 `initialPrompts`로 넣은 세션). 요청마다 세션을 `clone()`하고, `measureContextUsage`로 컨텍스트 창에 맞게 대화 기록을 고른 뒤(응답용 96토큰 예약) `promptStreaming`으로 한 조각씩 화면에 표시합니다. 중지 버튼과 정령 전환은 `AbortSignal`로 생성을 멈춥니다.
- **언어 선언**: 앱 언어의 언어 태그로 `availability()`를 확인해 사용할 수 있으면 `expectedInputs`/`expectedOutputs`에 선언하고, 그렇지 않으면 언어 선언 없이 세션을 만듭니다. Prompt API 공식 지원 언어는 en·ja·es·de·fr입니다.
- **기억**: 매 턴 `구원자/정령` 대화를 에피소드 기억으로 저장합니다. Prompt API에는 임베딩이 없으므로 1~3글자 n-gram을 FNV-1a로 512차원에 해싱한 어휘 벡터와 코사인 유사도로 관련 기억을 찾습니다. 에피소드 기억이 10개 쌓일 때마다 최근 30개를 온디바이스 AI로 요약해 통합 기억으로 갱신합니다.
- **저장소**: IndexedDB `eversoul-ai-chat`(버전 2)의 스토어는 `auth_session`, `chat_room`, `chat_message`, `persona_profile`, `persona_localized_prompt`, `persona_memory`, `style_profile`, `knowledge_chunk`, `sync_metadata`, `general_settings`, `imported_module`, `file_handle`입니다. 시작할 때 `navigator.storage.persist()`로 영구 저장소를 요청합니다.
- **백업**: File System Access API로 전체 데이터(`file_handle` 제외)를 JSON 파일로 내보내고 불러옵니다. PC 폴더를 연결하면 응답 완료, 메시지·대화방 삭제, 모듈 변경, 언어·추론 표시·스킨·선호정령·대화 모델·안내 확인 변경 후 5초 뒤(연속 변경은 마지막 기준) `eversoul-ai-chat-backup-<시각>.json`과 `eversoul-ai-chat-backup-latest.json`을 쓰고, 시각별 백업은 최근 10개만 남깁니다. 폴더 핸들은 IndexedDB `file_handle`에 보관되며, 목록에서 원하는 시점으로 복원할 수 있습니다.
- **다국어**: UI 문구, 안내, 차단 화면, 상태·오류 메시지는 `src/domains/evertalk/i18n.ts`의 한국어·영어·중국어(간체) 라벨로 표시됩니다. 도메인 오류는 코드(`DomainError`)로 전달되고 화면에서 라벨로 바뀝니다.

---

## 🛠 기술 스택

### Web App

- **Framework**: `React 19.3` + `TypeScript 7.0` + `Vite 8.3` (`base: './'` 정적 빌드)
- **State Management**: `TanStack React Query v5`, `Zustand v5`
- **Styling**: `Tailwind CSS v4`(`@tailwindcss/vite`) + `clsx`
- **Icons**: `lucide-react`
- **Lint**: `oxlint`

### Browser Platform

- **On-device AI**: Chrome Prompt API(`LanguageModel`, Gemini Nano) — 타입 `@types/dom-chromium-ai`
- **Storage**: IndexedDB(`idb` 8)
- **PC 파일·폴더**: File System Access API(`showOpenFilePicker`, `showSaveFilePicker`, `showDirectoryPicker`) — 타입 `@types/wicg-file-system-access`
- **이용 환경 판별**: User-Agent Client Hints(`navigator.userAgentData`) — 타입 `user-agent-data-types`

---

## 📦 온디바이스 모델

모델 파일을 저장소에 넣거나 직접 내려받지 않습니다. Chrome이 제공하는 Gemini Nano를 Prompt API로 씁니다.

- **준비**: 설정 > 온디바이스 모델 목록에서 "다운로드 및 준비"를 누르면 Chrome이 모델을 내려받고 진행률이 표시됩니다. 내려받기는 사용자 클릭(user activation)이 있어야 시작됩니다.
- **모델 선택**: Gemini Nano의 크기와 GPU/CPU 실행 방식은 Chrome이 기기 성능에 맞춰 고르며, 웹 페이지가 직접 고를 수 없습니다.
- **Chrome 요구 사항**([Chrome 공식 문서](https://developer.chrome.com/docs/ai/prompt-api)): Windows 10/11, macOS 13 이상, Linux, ChromeOS(Chromebook Plus). Chrome 프로필이 있는 볼륨에 22GB 이상 여유 공간, GPU VRAM 4GB 초과 또는 RAM 16GB 이상·CPU 4코어 이상, 데이터 무제한 네트워크. Android·iOS용 Chrome에서는 동작하지 않습니다.

---

## 💻 실행 및 빌드 가이드

- [Node.js](https://nodejs.org/)와 PC용 [Google Chrome](https://www.google.com/chrome/)이 필요합니다.
- 개발 서버도 반드시 PC Chrome으로 열어야 합니다. 다른 브라우저에서는 차단 화면만 보입니다.

```bash
npm install      # 의존성 설치
npm run dev      # Vite 개발 서버 실행 후 PC Chrome으로 접속
npm run lint     # oxlint 검사
npm run build    # tsc -b 타입 검사 + vite build 정적 빌드(dist/)
```

`dist/`는 서버 코드 없이 정적 파일만 담고 있으므로 어떤 정적 호스팅에도 그대로 올릴 수 있습니다. 운영 주소는 [ai.everlib.pro](https://ai.everlib.pro/)입니다. `navigator.userAgentData`와 File System Access API는 보안 컨텍스트(HTTPS 또는 localhost)에서만 동작합니다.

---

## 🧩 정령(페르소나) 데이터 스키마

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
- 화면에 보여줄 때는 `src/domains/persona/logic.ts`의 `parseSpiritDetail`이 이 `raw_json`을 파싱해 언어별로 골라내고, 온디바이스 AI에게 보낼 시스템 프롬프트는 이것과 별개로 `src/domains/persona/prompt.ts`가 `raw_json`을 다시 파싱해 조립합니다 — 두 곳 다 최종적으로는 IndexedDB의 `raw_json`을 소스로 씁니다.
- 정령별 원화는 `public/eversoul-assets/spirits/{영문명}/` 하위에 `base`(기본 일러스트 512/1024/2048), `costume`(코스튬), `gacha`(가챠 연출), `raid`(레이드 연출), `srg`(스토리) 등 카테고리 폴더로 분리되어 있으며, `LoadableAssetImage` 컴포넌트(`src/domains/evertalk/components/LoadableAssetImage.tsx`)가 후보 경로 배열을 순차 시도(`useFirstLoadableImage`)해 존재하는 첫 이미지를 렌더링합니다.

---

## 📌 버전 관리 규칙

이 저장소는 **커밋 1회당 patch 버전 +1**을 원칙으로 합니다. 버전은 `package.json`의 `version` 필드 하나로 관리합니다. Tauri 데스크톱 앱에서 Chrome 온디바이스 AI 웹 앱으로 전환하면서 새 프로젝트로 초기화해 `0.0.0`부터 다시 시작했으며, 현재 버전은 `0.0.1`입니다.

---

## 📄 라이선스

이 저장소의 **Apache License 2.0**은 이 프로젝트가 직접 작성한 웹 앱 소스 코드(`src/`)에만 적용됩니다. 아래 제3자 저작물에 대한 권리는 이 프로젝트가 보유하지 않습니다.

- **온디바이스 모델 Gemini Nano** — Google이 Chrome을 통해 제공하는 모델입니다. 이 저장소는 모델 가중치를 포함하거나 재배포하지 않으며, 모델은 사용자 PC의 Chrome이 직접 내려받아 관리합니다.
- **에버소울 게임 리소스** — 정령 일러스트, 대화 배경, 정령 프로필 원본 데이터, 음성의 저작권은 원저작권자에게 있습니다. 이 프로젝트는 해당 저작물의 권리를 주장하지 않으며 비상업적 팬 프로젝트로 이용합니다.
