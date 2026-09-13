<p align="right">
  <img src="https://flagcdn.com/20x15/kr.png" width="20" height="15" alt="KR" /> <strong>한국어</strong> &nbsp;|&nbsp;
  <a href="README.en.md"><img src="https://flagcdn.com/20x15/us.png" width="20" height="15" alt="US" /> English</a>
</p>

<p align="center">
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_Castle_Aurelia.png" width="960" alt="EverSoul AI Chat Banner" />
</p>

<h1 align="center">EverSoul AI Chat</h1>
<p align="center"><i>Chrome 온디바이스 AI와 내 PC의 Ollama로 돌아가는 에버소울 정령 채팅</i></p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.0.4-blue?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/license-Apache_2.0-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/Chrome-Prompt_API-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Prompt API" />
  <img src="https://img.shields.io/badge/Ollama-local-000000?style=flat-square&logo=ollama&logoColor=white" alt="Ollama" />
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
  <a href="https://github.com/GarnetRapture/evai/actions/workflows/build-web.yml"><img src="https://img.shields.io/badge/Actions-Build_Web-0969da?style=for-the-badge&logo=githubactions&logoColor=white" alt="Build Web workflow" /></a>
  <a href="https://github.com/GarnetRapture/evai/actions/workflows/build-local-server.yml"><img src="https://img.shields.io/badge/Actions-Build_Local_Server-0969da?style=for-the-badge&logo=githubactions&logoColor=white" alt="Build Local Server workflow" /></a>
  <a href="https://github.com/GarnetRapture/evai/releases"><img src="https://img.shields.io/badge/Releases-릴리스_노트-6e7781?style=for-the-badge&logo=github&logoColor=white" alt="Releases" /></a>
</p>

<p align="center">
  <sub>Chrome에서는 브라우저에 내장된 AI를, 그 밖의 브라우저에서는 내 PC에 설치한 Ollama를 대화 엔진으로 씁니다.</sub>
</p>

---

## 개요

**EverSoul AI Chat**은 에버소울을 간직하려고 만든 AI 채팅 프로젝트입니다. 정령들의 기억을 남겨 두자는 마음으로 시작했습니다. 게임에 나오는 정령 99명을 실제 게임 데이터 그대로 불러와서, 정령마다 자기 성격과 말투로 대화합니다.

서버에 대화를 보내지 않는 로컬 우선 웹 앱입니다. Chrome에서는 브라우저에 내장된 Prompt API 모델을 쓰고, Firefox 같은 다른 브라우저에서는 내 PC에서 돌고 있는 Ollama에 직접 연결합니다. 대화와 기억, 설정은 브라우저 IndexedDB에만 저장되고, 필요하면 PC 파일로 내보내거나 PC 폴더에 자동으로 백업할 수 있습니다.

웹 서버를 따로 띄우기 번거로우면 `evai-server` 실행기를 쓰면 됩니다. 빌드된 웹 파일 옆에 두고 실행하면 이 PC에서만 접속할 수 있는 주소로 앱을 열어 줍니다.

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

## 전체 정령 갤러리 (99종)

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

## 어떤 브라우저에서 쓰나요

PC 데스크톱 브라우저라면 들어갈 수 있습니다. 차이는 대화 엔진을 어디서 가져오느냐뿐입니다. 모바일 웹은 지원하지 않습니다.

| 브라우저 | 대화 엔진 | 따로 준비할 것 |
| --- | --- | --- |
| <img src="https://img.shields.io/badge/Chrome-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome" /> | Chrome 내장 AI(Gemini Nano, 플래그를 켜면 Gemma 4) 또는 로컬 Ollama | 설정에서 모델 "다운로드 및 준비" 한 번 |
| <img src="https://img.shields.io/badge/Firefox-FF7139?style=flat-square&logo=firefoxbrowser&logoColor=white" alt="Firefox" /> | 로컬 Ollama | Ollama 설치와 모델 하나 |
| <img src="https://img.shields.io/badge/Edge-0078D7?style=flat-square&logo=microsoftedge&logoColor=white" alt="Edge" /> | 로컬 Ollama (브라우저가 `LanguageModel` API를 노출하면 내장 AI도 목록에 나옵니다) | Ollama 설치와 모델 하나 |
| <img src="https://img.shields.io/badge/Whale-00C73C?style=flat-square&logo=naver&logoColor=white" alt="Whale" /> | 로컬 Ollama | Ollama 설치와 모델 하나 |
| <img src="https://img.shields.io/badge/Brave-FB542B?style=flat-square&logo=brave&logoColor=white" alt="Brave" /> <img src="https://img.shields.io/badge/Opera-FF1B2D?style=flat-square&logo=opera&logoColor=white" alt="Opera" /> | 로컬 Ollama | Ollama 설치와 모델 하나 |

앱은 처음 들어올 때 이 브라우저에 Chrome 내장 AI가 있는지 확인합니다. 없으면 초기 설정 화면에 Ollama 연결 가이드가 바로 뜨고, 연결이 되면 그때부터 Ollama가 대화를 맡습니다.

---

## 주요 기능

- **정령 99명, 각자의 성격 그대로**: 이름, 등급, 종족, 직업, 생일, 좋아하는 것, 대표 대사, 에버톡 대화 예시까지 불러와 정령마다 시스템 프롬프트를 따로 만듭니다.
- **대화 엔진 두 갈래**: Chrome에서는 브라우저 내장 모델을, 다른 브라우저에서는 내 PC의 Ollama를 씁니다. Ollama는 어떤 모델이든 쓸 수 있고, 실행 중인 모델을 먼저 잡습니다.
- **정령이 나와의 대화를 기억함**: 매 턴의 대화를 응답과 함께 정령별 기억으로 저장하고, 다음 대화에서 관련된 기억을 꺼내 함께 넘깁니다. 아직 정리하지 않은 기억이 8개 쌓이면 모델이 요약을 다시 만들어 시스템 프롬프트에 넣습니다.
- **지금 대화하는 정령에게만 집중**: 다른 정령으로 바꾸면 이전 정령의 응답 생성을 멈추고, 모델 세션도 지금 정령 하나만 유지합니다.
- **언어를 바꿔도 그 정령 그대로**: 화면 문구, 안내, 오류 메시지, 정령 원본 데이터가 한국어·영어·중국어(간체)로 바뀝니다.
- **선호정령**: 목록의 별로 선호정령을 지정하면 친밀도 탭 맨 위에 올라가고, 앱을 다시 켤 때 먼저 선택됩니다.
- **Risu 모듈**: `.risum` 모듈을 가져와 켜고 끌 수 있고, 켠 모듈의 설명과 로어북이 시스템 프롬프트에 붙습니다.
- **내 PC에 저장과 백업**: 모든 데이터는 브라우저 IndexedDB에 있고, PC 파일로 내보내기와 불러오기, 백업 폴더 자동 백업, 시점 복원을 지원합니다.
- **대화 배경**: 에버소울 정식 일러스트 배경 522장으로 대화창 분위기를 바꿀 수 있습니다.

<p align="center">
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_Castle.png" width="150" alt="Talk BG Castle" />
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_Library.png" width="150" alt="Talk BG Library" />
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_Galaxy.png" width="150" alt="Talk BG Galaxy" />
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_CherryBlossom.png" width="150" alt="Talk BG CherryBlossom" />
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_Sanctum.png" width="150" alt="Talk BG Sanctum" />
  <img src="public/eversoul-assets/backgrounds/talk/Talk_BG_SkyArk.png" width="150" alt="Talk BG SkyArk" />
</p>

---

## 아키텍처

React 웹 앱 하나가 전부입니다. 데이터는 IndexedDB에 두고, 대화 엔진은 Chrome 내장 AI나 Chrome이 받아 둔 모델 파일, 또는 로컬 Ollama 중 하나를 씁니다. `evai-server`는 빌드된 웹 파일을 `127.0.0.1`에서 서빙하는 역할만 하고, 데이터나 모델에는 관여하지 않습니다.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': {'primaryColor': '#cde2fb', 'primaryBorderColor': '#2a78d6', 'primaryTextColor': '#0b0b0b', 'lineColor': '#52514e', 'clusterBkg': '#fcfcfb', 'clusterBorder': '#c3c2b7', 'fontFamily': 'system-ui, -apple-system, Segoe UI, sans-serif'}}}%%
flowchart TB
    subgraph UI["UI · src/domains/evertalk"]
        direction LR
        UI1["EnvironmentLayer · PlatformGuideGate<br/>SetupWizard"]
        UI2["SpiritRoster · ChatStage<br/>SpiritProfilePanel"]
        UI3["SettingsPanel · ModuleManagementPanel<br/>i18n (ko · en · zh_cn)"]
    end

    subgraph DOMAIN["도메인 서비스 · src/domains"]
        direction LR
        D1["persona · chat · style<br/>knowledge · modules"]
        D2["llm<br/>engine · catalog · chrome<br/>chromeInstalled · ollama"]
        D3["settings · sync · auth"]
        D4["ollama<br/>HTTP client · 연결 가이드"]
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
    S1 -- "대화방 · 메시지 · 정령 · 기억 · 설정 · 모듈" --> DB[("IndexedDB<br/>eversoul-ai-chat")]
    S2 -- "JSON 내보내기·불러오기<br/>백업 폴더 자동 백업" --> PC[("PC 파일 / 백업 폴더")]
    D2 -- "availability · create · clone<br/>promptStreaming" --> LLM["Chrome Prompt API<br/>Gemini Nano · Gemma 4"]
    D2 -- "LiteRT-LM · WebGPU" --> CHROMEFILE["Chrome 설치 모델 파일<br/>OptGuide 폴더 연결"]
    D2 --> D4
    D4 -- "HTTP /api/chat · /api/tags · /api/ps" --> OLLAMA["로컬 Ollama<br/>127.0.0.1:11434"]
    SERVER["evai-server (C++26)<br/>127.0.0.1:47831 정적 서빙"] -- "index.html · assets" --> UI

    classDef uiStyle fill:#cde2fb,stroke:#2a78d6,stroke-width:2px,color:#0b0b0b
    classDef domainStyle fill:#e3ddf7,stroke:#4a3aa7,stroke-width:2px,color:#0b0b0b
    classDef sharedStyle fill:#fff4cc,stroke:#ffb703,stroke-width:2px,color:#0b0b0b
    classDef dbStyle fill:#c9f0d8,stroke:#008300,stroke-width:2px,color:#0b0b0b
    classDef llmStyle fill:#fbdcc9,stroke:#eb6834,stroke-width:2px,color:#0b0b0b

    class UI1,UI2,UI3 uiStyle
    class D1,D2,D3,D4 domainStyle
    class S1,S2,S3,PACK sharedStyle
    class DB,PC dbStyle
    class LLM,CHROMEFILE,OLLAMA,SERVER llmStyle
```

- **이용 환경 판별**: PC 데스크톱 브라우저는 들어갈 수 있습니다. `LanguageModel`이 있으면 Chrome 내장 AI를 쓰고, 없으면 초기 설정에서 Ollama 연결 가이드를 보여 줍니다. 상단 `EnvironmentLayer`는 프로필, 브라우저와 버전, 플랫폼, `requestAdapter()`로 확인한 WebGPU 정보를 보여 줍니다.
- **정령 데이터**: `src/domains/persona/archive.ts`가 `import.meta.glob`으로 `data/personas/*.json`을 불러오고, 초기 설정 때 IndexedDB `persona_profile`에 설치합니다. 언어별 시스템 프롬프트는 `persona_localized_prompt`에 캐시합니다.
- **시스템 프롬프트**: 정령 원본의 프로필·성격·인사, 전체 말투/스토리/에버톡 말뭉치에서 분산 표집한 정령 발화 12개와 실제 `구원자 → 정령` 반응쌍 4개를 시작 정체성으로 조립합니다. 매 턴에는 현재 발화와 관련된 실제 반응쌍 최대 2개, 최근 대화 최대 18개, 관련 기억 최대 4개(후보 200개 중), 지식 데이터 최대 1개가 동적으로 추가됩니다. 누적된 digest·명시 기억·semantic 관계 상태·습관·인연 수치는 실제 기록이 생긴 뒤에만 시작값을 변화시킵니다. `zh_cn`은 OpenCC로 간체화하고 출력 이모지를 제거합니다.
- **Chrome 세션**: 지금 대화하는 정령 하나의 세션만 유지합니다. 시스템 프롬프트를 `initialPrompts`의 첫 `system`으로 넣고, 정령 JSON의 실제 `구원자 → 정령` 반응쌍을 이어지는 `user/assistant` 예시 대화로 넣습니다. 요청마다 세션을 `clone()`하고 `contextWindow`·`contextUsage`·`measureContextUsage()`로 응답용 384토큰을 남긴 채 최근 대화를 고릅니다.
- **Ollama 세션**: 같은 시스템 프롬프트와 예시 대화를 `/api/chat`으로 보냅니다. Mistral 계열처럼 user/assistant 교대를 강제하는 템플릿이 있어서, 연속된 같은 역할 메시지는 내용을 그대로 합쳐 보냅니다. Ollama가 넘친 대화를 조용히 잘라내지 않도록 `truncate: false`, `shift: false`를 주고, 생성 전에 1토큰짜리 측정 요청으로 실제 프롬프트 길이를 잽니다. 넘치면 오래된 맥락부터 빼고, 시스템 프롬프트와 예시 대화, 이번 턴 지시는 끝까지 남깁니다. 컨텍스트 크기는 Ollama가 실제로 올린 값(`/api/ps`의 `context_length`)을 따릅니다.
- **응답 검사**: 모든 엔진의 결과를 같은 JSON 스키마로 받고, 말투와 언어를 어기면 한 번 다시 생성합니다.
- **언어 선언**: `availability()`와 `create()`에 같은 옵션을 사용합니다. 시스템 지시문 언어인 영어와 앱 언어를 `expectedInputs`에, 앱 언어만 `expectedOutputs`에 선언하며, 해당 조합을 지원하지 않으면 모델의 기본 다국어 능력으로 전환합니다.
- **기억**: 응답 메시지와 매 턴의 `구원자/정령` 에피소드 기억은 하나의 IndexedDB 트랜잭션으로 저장됩니다. 1~3글자 n-gram을 FNV-1a로 512차원에 희소 저장한 어휘 벡터와 코사인 유사도로 관련 기억을 찾고, 마지막 성공 이후 기억이 8개 쌓이면 최근 30개를 대화 모델로 통합합니다. 최근 원문 범위를 벗어날 대화가 6개 이상 쌓이면 먼저 압축해 같은 턴의 시스템 프롬프트에 고정합니다.
- **저장소**: IndexedDB `eversoul-ai-chat` 하나에 모든 데이터를 두고, 시작할 때 영구 저장을 요청합니다. SQL 서버 연동은 아직 없습니다.
- **백업**: File System Access API로 전체 데이터(`file_handle` 제외)를 JSON 파일로 내보내고 불러옵니다. PC 폴더를 연결하면 응답 완료, 메시지·대화방 삭제, 모듈 변경, 언어·추론 표시·스킨·선호정령·대화 모델·안내 확인 변경 후 5초 뒤(연속 변경은 마지막 기준) `eversoul-ai-chat-backup-<시각>.json`과 `eversoul-ai-chat-backup-latest.json`을 쓰고, 시각별 백업은 최근 10개만 남깁니다. 폴더 핸들은 IndexedDB `file_handle`에 보관되며, 목록에서 원하는 시점으로 복원할 수 있습니다.
- **다국어**: UI 문구, 안내, 차단 화면, 상태·오류 메시지는 `src/domains/evertalk/i18n.ts`의 한국어·영어·중국어(간체) 라벨로 표시됩니다. 도메인 오류는 코드(`DomainError`)로 전달되고 화면에서 라벨로 바뀝니다.

---

## 기술 스택

### 웹 앱

- **프레임워크**: `React 19.3` + `TypeScript 7.0` + `Vite 8.3` (`base: './'` 정적 빌드)
- **상태 관리**: `TanStack React Query v5`, `Zustand v5`
- **스타일**: `Tailwind CSS v4`(`@tailwindcss/vite`) + `clsx`
- **아이콘**: `lucide-react`
- **검사**: `oxlint`

### 브라우저 쪽

- **대화 엔진**: Chrome Prompt API(`LanguageModel`), Chrome 설치 모델 파일(`@litert-lm/core`, WebGPU), 로컬 Ollama(HTTP)
- **저장소**: IndexedDB(`idb` 8)
- **중국어 간체 고정**: `opencc-js`의 번체→간체 변환
- **PC 파일과 폴더**: File System Access API(`showOpenFilePicker`, `showSaveFilePicker`, `showDirectoryPicker`)
- **실행 환경 판별**: User-Agent Client Hints와 UA 문자열, `navigator.gpu.requestAdapter()`

### 로컬 서버 실행기

- **언어**: C++26, CMake 없이 컴파일러로 바로 빌드 (`server/build.sh`, GCC 16 기준 `-std=c++26`)
- **윈도우**: MSYS2 UCRT64 MinGW-w64, `windres`로 아이콘과 버전 정보를 넣고 정적 링크해 exe 하나로 동작

---

## 대화 모델

### Chrome 내장 AI

- **준비**: 설정 > 온디바이스 모델 목록에서 "다운로드 및 준비"를 누르면 Chrome이 모델을 받습니다. 사용자가 직접 클릭해야 받기가 시작됩니다.
- **모델 선택**: Gemini Nano의 크기와 GPU/CPU 실행 방식은 Chrome이 기기에 맞춰 고릅니다. `chrome://flags/#gemma4-for-built-in-ai`를 켜고 재시작하면 Gemma 4로 바뀌고, 앱은 Local State 파일로 실제 플래그 상태를 확인합니다.
- **Chrome 요구 사항**([Chrome 공식 문서](https://developer.chrome.com/docs/ai/prompt-api)): Windows 10/11, macOS 13 이상, Linux, ChromeOS(Chromebook Plus). Chrome 프로필이 있는 드라이브에 22GB 이상 여유 공간, GPU VRAM 4GB 초과 또는 RAM 16GB 이상과 CPU 4코어 이상, 데이터 무제한 네트워크가 필요합니다. Android·iOS용 Chrome에서는 동작하지 않습니다.
- **진단**: 모델 상태는 `chrome://on-device-internals`에서 볼 수 있습니다. 일반 웹 페이지는 `chrome://flags` 값을 바꿀 수 없습니다.

### 로컬 Ollama

Chrome 내장 AI가 없는 브라우저에서는 Ollama가 대화를 맡습니다. Chrome에서도 설정의 "로컬 Ollama 모델 목록"에서 직접 고를 수 있습니다. 모델은 PC 사양에 맞춰 무엇이든 쓰면 됩니다. 작은 3B 모델부터 30B, 120B 모델까지 Ollama가 돌릴 수 있으면 앱도 씁니다.

1. [ollama.com](https://ollama.com/download)에서 Ollama를 설치하고 실행합니다.
2. 쓸 모델을 받습니다.

   ```bash
   ollama --version
   ollama pull <모델이름:태그>
   ollama pull hf.co/<사용자>/<저장소>:<양자화>
   ```

   이미 가지고 있는 GGUF 파일로 모델을 만들 수도 있습니다. 윈도우 PowerShell 기준입니다.

   ```powershell
   Set-Content "$env:TEMP\Modelfile.evai" 'FROM D:\model\내모델.gguf'
   ollama create 내모델이름 -f "$env:TEMP\Modelfile.evai"
   Remove-Item "$env:TEMP\Modelfile.evai" -Force
   ```

3. 모델을 한 번 실행해 보고 목록을 확인합니다. 앱은 `ollama ps`에 떠 있는 모델을 먼저 연결하고, 없으면 가장 최근에 받은 모델을 씁니다.

   ```bash
   ollama run 내모델이름
   ollama ls
   ollama ps
   ```

4. 앱을 열면 초기 설정 화면(또는 설정 > 로컬 Ollama 모델 목록)에서 "연결 확인"을 누릅니다. 모델 이름을 입력하면 그 이름으로 받기, 실행, 삭제 명령을 만들어 줍니다.

**주소에 따라 한 가지를 더 해야 할 수 있습니다.** Ollama는 기본적으로 `localhost`, `127.0.0.1`, `0.0.0.0`에서 온 요청만 받습니다. `evai-server`나 `npm run dev`로 이 PC에서 열었다면 그대로 연결됩니다. [ai.everlib.pro](https://ai.everlib.pro/)처럼 다른 주소에서 열었다면 Ollama를 켜기 전에 `OLLAMA_ORIGINS`에 그 주소를 넣어야 합니다. 연결 가이드가 지금 페이지 주소에 맞는 명령을 보여 줍니다.

```powershell
[Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', 'https://ai.everlib.pro', 'User')
```

macOS는 `launchctl setenv OLLAMA_ORIGINS "주소"`, systemd를 쓰는 리눅스는 `systemctl edit ollama.service`에 `Environment="OLLAMA_ORIGINS=주소"`를 넣고 Ollama를 다시 시작합니다. 공개 사이트에서 Chrome이 로컬 네트워크 접근 권한을 물으면 허용해야 합니다.

---

## 로컬 서버 실행기 (evai-server)

윈도우, 리눅스, macOS에서 모두 돌아갑니다. 웹 빌드 결과물(`index.html`과 `assets/` 등)과 같은 폴더에 실행 파일을 두고 실행하면 됩니다.

| OS | 실행 파일 | 실행 방법 |
| --- | --- | --- |
| <img src="https://img.shields.io/badge/Windows-0078D6?style=flat-square&logo=windows&logoColor=white" alt="Windows" /> x86_64 | `evai-server.exe` | 더블클릭하면 명령 창이 뜹니다. 창을 닫으면 서버도 꺼집니다. |
| <img src="https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black" alt="Linux" /> x86_64 | `evai-server` | 터미널에서 `./evai-server` |
| <img src="https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white" alt="macOS" /> Apple Silicon | `evai-server` | 터미널에서 `./evai-server`. 인터넷에서 받은 파일이면 처음 한 번 `xattr -d com.apple.quarantine evai-server`가 필요할 수 있습니다. |

```text
EVAI local server
root: C:\EVAI
open: http://127.0.0.1:47831/
close this window to stop the server.
```

- 항상 실행 파일이 있는 폴더를 기준으로 파일을 서빙합니다. 어디서 실행했든 상관없고, 그 폴더에 `index.html`이 없으면 바로 종료합니다.
- `127.0.0.1`에만 열리므로 다른 PC에서는 접속할 수 없습니다. Host 헤더가 `127.0.0.1:포트`나 `localhost:포트`가 아니면 거절합니다.
- 기본 포트는 `47831`이고 `evai-server --port 48000`처럼 바꿀 수 있습니다.
- 앱이 쓰는 `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` 헤더를 개발 서버와 똑같이 붙입니다.
- 폴더 밖 경로로 나가는 요청은 막고, `GET`과 `HEAD`만 받습니다. 데이터베이스 기능은 아직 없습니다.

GitHub Actions의 Build Local Server가 OS마다 웹 빌드와 실행 파일을 한 묶음으로 만들어 주니, 압축을 풀고 실행하면 끝입니다.

---

## 실행 및 빌드

필요한 것은 [Node.js](https://nodejs.org/)와 PC 데스크톱 브라우저입니다. 실행기를 직접 빌드하려면 `-std=c++26`을 받는 C++ 컴파일러가 필요합니다.

- 윈도우: [MSYS2](https://www.msys2.org/) UCRT64 셸에서 `pacman -S mingw-w64-ucrt-x86_64-gcc`
- 리눅스: GCC 14 이상 (예: `CXX=g++-14`)
- macOS: Homebrew GCC (예: `brew install gcc` 후 `CXX=g++-15`)

```bash
npm install          # 의존성 설치
npm run dev          # Vite 개발 서버 (http://localhost:5173)
npm run lint         # oxlint 검사
npm run build        # tsc -b 타입 검사 + vite build (dist/)
npm run server:build # server/build/evai-server(.exe) 빌드
```

세 OS 모두 같은 `server/build.sh`로 빌드하고, 컴파일러는 `CXX=g++-14 npm run server:build`처럼 지정합니다. 윈도우에서는 이 스크립트가 `windres`로 아이콘과 버전 정보(`package.json`의 버전, 제작사 everlib)를 exe에 넣습니다.

`dist/`는 정적 파일뿐이라 어떤 정적 호스팅에도 올릴 수 있습니다. 운영 주소는 [ai.everlib.pro](https://ai.everlib.pro/)입니다. File System Access API는 HTTPS나 localhost에서만 동작합니다.

---

## GitHub Actions로 빌드하기

포크하면 워크플로 파일도 같이 따라옵니다. 내 포크의 **Actions** 탭에서 버튼만 누르면 GitHub가 빌드해서 zip으로 올려 줍니다. PC에 Node.js나 컴파일러를 설치할 필요가 없습니다.

<p align="center">
  <a href="https://github.com/GarnetRapture/evai/fork"><img src="https://img.shields.io/badge/STEP_0-Fork_먼저_하기-238636?style=for-the-badge&logo=github&logoColor=white" alt="Fork" /></a>
  <a href="https://github.com/GarnetRapture/evai/actions/workflows/build-web.yml"><img src="https://img.shields.io/badge/워크플로-Build_Web-0969da?style=for-the-badge&logo=githubactions&logoColor=white" alt="Build Web workflow" /></a>
  <a href="https://github.com/GarnetRapture/evai/actions/workflows/build-local-server.yml"><img src="https://img.shields.io/badge/워크플로-Build_Local_Server-0969da?style=for-the-badge&logo=githubactions&logoColor=white" alt="Build Local Server workflow" /></a>
</p>

| 워크플로 | 결과물 | 쓰는 곳 |
| --- | --- | --- |
| [Build Web](.github/workflows/build-web.yml) | `evai-web-v<버전>-<커밋7자리>.zip` (`dist/`) | 정적 호스팅에 올릴 때 |
| [Build Local Server](.github/workflows/build-local-server.yml) | `evai-local-server-windows-x86_64-v<버전>-<커밋7자리>.zip`<br/>`evai-local-server-linux-x86_64-v<버전>-<커밋7자리>.tar.gz`<br/>`evai-local-server-macos-arm64-v<버전>-<커밋7자리>.tar.gz` | 내 PC에서 실행기로 바로 열 때 (`dist/` + 실행 파일) |

### 1단계 — 내 포크에서 Actions 켜기

포크된 저장소는 워크플로가 꺼진 상태로 시작합니다. 내 포크의 **Actions** 탭에 들어가 초록 버튼 **`I understand my workflows, go ahead and enable them`** 을 한 번 누르면 켜집니다. 포크당 최초 한 번이면 끝입니다.

<p align="center">
  <img src="docs/images/actions/ko/1-enable-actions.svg" width="880" alt="포크한 저장소의 Actions 탭에서 초록 버튼을 눌러 워크플로를 켜는 화면" />
</p>

### 2단계 — `Run workflow` 버튼 누르기

왼쪽 목록에서 **Build Web**이나 **Build Local Server**를 고르고, 오른쪽의 **`Run workflow`** 를 연 다음 초록 **`Run workflow`** 버튼을 누릅니다. 입력할 값은 없고 브랜치는 기본값 그대로 두면 됩니다. 아래 그림은 Build Web 기준이고, Build Local Server도 누르는 곳은 같습니다.

<p align="center">
  <img src="docs/images/actions/ko/2-run-workflow.svg" width="880" alt="Build Web 워크플로를 고르고 Run workflow 버튼을 누르는 화면" />
</p>

### 3단계 — 완성된 zip 내려받기

실행이 끝나면 초록 체크가 뜹니다. 그 실행을 눌러 들어가 맨 아래 **Artifacts**에서 필요한 파일을 받으면 됩니다. Build Web의 zip은 `dist/` 정적 파일 그대로이고, Build Local Server의 묶음은 여기에 내 OS용 실행 파일이 함께 들어 있습니다.

<p align="center">
  <img src="docs/images/actions/ko/3-download-artifact.svg" width="880" alt="빌드가 끝난 실행 화면에서 Artifacts의 zip 파일을 내려받는 화면" />
</p>

### 워크플로가 실제로 하는 일

**Build Web**

| 단계 | 내용 |
| --- | --- |
| 실행 환경 | `ubuntu-latest` + Node.js 24 |
| 의존성 설치 | `npm install` (`package-lock.json`을 배포하지 않아서 `npm ci` 대신 씁니다) |
| 빌드 | `npm run build` = `tsc -b` 타입 검사 + `vite build` (`dist/`) |
| 포장과 업로드 | `dist/`를 zip으로 묶어 Artifacts에 올립니다 (보관 90일) |

**Build Local Server**

| 단계 | 내용 |
| --- | --- |
| 웹 빌드 | `ubuntu-latest`에서 `npm run build`로 `dist/`를 만들어 다음 단계에 넘깁니다 |
| 윈도우 | `windows-latest` + MSYS2 UCRT64 GCC로 `sh server/build.sh`, `dist/`와 `evai-server.exe`를 zip으로 묶음 |
| 리눅스 | `ubuntu-24.04` + `g++-14`로 빌드, `dist/`와 `evai-server`를 tar.gz로 묶음 (실행 권한 유지) |
| macOS | `macos-15` (Apple Silicon) + Homebrew `g++-15`로 빌드, tar.gz로 묶음 |
| 업로드 | 세 묶음을 각각 Artifacts에 올립니다 (보관 90일) |

### 알아둘 점

- 워크플로를 수동 실행하는 **`Run workflow` 버튼은 기본 브랜치에 워크플로 파일이 있을 때만** 나타납니다([GitHub 공식 문서](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)). 포크 직후에는 그대로 있으니 신경 쓰지 않아도 됩니다.
- 빌드는 각자의 저장소에서 각자의 계정으로 돌아갑니다. 공개 저장소에서 GitHub 제공 표준 러너를 쓰면 [Actions 사용료는 무료](https://docs.github.com/en/billing/concepts/product-billing/github-actions)입니다. 비공개 포크는 계정 플랜의 무료 분에서 차감되고, 윈도우와 macOS 러너는 리눅스보다 분이 더 많이 깎입니다.
- 원본 저장소에 푸시 권한이 없어도 됩니다. 빌드 결과물은 내 저장소의 Artifacts에만 올라갑니다.
- 공식 Releases에는 빌드 파일을 첨부하지 않습니다. 실행 파일과 웹 파일은 위 워크플로로 직접 받아 주세요.
- 안드로이드 앱 빌드는 지금 워크플로에 없습니다. 아래 안드로이드 항목을 참고하세요.

---

## 안드로이드 앱

`android/`에 AICore Gemini Nano와 LiteRT-LM을 쓰는 안드로이드 앱 코드가 있지만, 지금은 개발을 잠시 멈춘 상태입니다. 빌드 워크플로와 배포도 당분간 하지 않습니다.

---

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
- 정령별 원화는 `public/eversoul-assets/spirits/{영문명}/` 하위에 `base`(기본 일러스트 512/1024/2048), `costume`(코스튬), `gacha`(가챠 연출), `raid`(레이드 연출), `srg`(스토리) 등 카테고리 폴더로 분리되어 있으며, `LoadableAssetImage` 컴포넌트(`src/domains/evertalk/components/LoadableAssetImage.tsx`)가 후보 경로 배열을 순차 시도(`useFirstLoadableImage`)해 존재하는 첫 이미지를 렌더링합니다.

---

## 버전 관리

버전은 `package.json`의 `version` 하나로 관리하고, 윈도우 실행 파일의 버전 정보도 여기서 가져갑니다. Tauri 데스크톱 앱에서 웹 앱으로 옮기면서 `0.0.0`부터 다시 시작했고, 지금 버전은 `0.0.4`입니다.

---

## 라이선스

이 저장소의 **Apache License 2.0**은 이 프로젝트가 직접 작성한 소스 코드(`src/`, `server/`)에만 적용됩니다. 아래 제3자 저작물에 대한 권리는 이 프로젝트에 없습니다.

- **Gemini Nano, Gemma 4** — Google이 Chrome을 통해 제공하는 모델입니다. 이 저장소는 모델 가중치를 담거나 재배포하지 않고, 모델은 사용자 PC의 Chrome이 직접 받아서 관리합니다.
- **Ollama와 Ollama에서 쓰는 모델** — 사용자가 직접 설치하며, 각 모델은 그 모델의 라이선스를 따릅니다. 이 저장소는 어떤 모델도 포함하지 않습니다.
- **에버소울 게임 리소스** — 정령 일러스트, 대화 배경, 정령 프로필 원본 데이터, 음성의 저작권은 원저작권자에게 있습니다. 이 프로젝트는 해당 저작물의 권리를 주장하지 않으며 비상업적 팬 프로젝트로 이용합니다.
