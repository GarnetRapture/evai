import { useEffect, useMemo, useRef, useState } from "react";
import { suspendAmbientBgm } from "../../bgm/session";
import { StoryButton } from "../../story/StoryButton";
import { StoryCast } from "../../story/StoryCast";
import { StoryText } from "../../story/StoryText";
import { parseStoryText } from "../../story/markup";
import {
  buildStorySteps,
  resolveStoryAmbience,
  resolveStoryBackground,
  resolveStoryBgm,
  resolveStoryCast,
  pickStoryBackground,
  resolveStoryCutscene,
  resolveStoryMovie,
  resolveStoryStage,
  storyActorPortraitUrl,
  storyAmbienceUrl,
  storyBgmUrl,
  storyClipUrl,
  storyCutsceneUrl,
  storyBackgroundUrl,
  storyClient,
  storyPortraitUrl,
  storyUiUrl,
  storyVideoUrl,
  storyVoiceUrl,
} from "../../story/client";
import { storyTextOf } from "../../story/types";
import type {
  StoryActor,
  StoryCollection,
  StoryEpisode,
  StoryIndex,
  StoryKind,
  StoryVoiceLanguage,
} from "../../story/types";
import type { EverTalkController } from "../types";

interface StorySelection {
  kind: StoryKind;
  key: string;
}

export function StoryPage({ controller }: { controller: EverTalkController }) {
  const { labels } = controller;
  const language = controller.appSettings?.language ?? "ko";
  const [index, setIndex] = useState<StoryIndex | null>(null);
  const [selection, setSelection] = useState<StorySelection | null>(null);
  const [collection, setCollection] = useState<StoryCollection | null>(null);
  const [episode, setEpisode] = useState<StoryEpisode | null>(null);
  const [position, setPosition] = useState(0);
  const [selections, setSelections] = useState<Record<number, number>>({});
  const [category, setCategory] = useState<StoryKind>("main");
  const [autoPlay, setAutoPlay] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceLanguage, setVoiceLanguage] = useState<StoryVoiceLanguage>(language === "ko" ? "ko" : "ja");
  const [logOpen, setLogOpen] = useState(false);
  const [reveal, setReveal] = useState({ text: "", count: 0 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [movieEnded, setMovieEnded] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    storyClient
      .readIndex()
      .then((loaded) => {
        if (active) {
          setIndex(loaded);
          setFailed(false);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selection === null) {
      return;
    }
    let active = true;
    storyClient
      .readCollection(selection.kind, selection.key)
      .then((loaded) => {
        if (active) {
          setCollection(loaded);
          setFailed(false);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [selection]);

  const steps = useMemo(() => (episode === null ? [] : buildStorySteps(episode, selections)), [episode, selections]);
  const current = steps[position] ?? null;
  const background = useMemo(() => resolveStoryBackground(steps, position), [steps, position]);
  const stage = useMemo(() => resolveStoryStage(steps, position), [steps, position]);
  const movie = useMemo(() => resolveStoryMovie(steps, position), [steps, position]);
  const sceneBgm = useMemo(() => resolveStoryBgm(steps, position), [steps, position]);
  const sceneAmbience = useMemo(() => resolveStoryAmbience(steps, position), [steps, position]);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const ambienceRef = useRef<HTMLAudioElement | null>(null);
  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const movieRef = useRef<HTMLVideoElement | null>(null);
  const movieKey = movie === null ? null : `${movie.kind}/${movie.key}/${movie.clip}`;
  const choosing = current !== null && current.choices.length > 0;
  const waitingForMovie = movie?.fullscreen === true && movieEnded !== movieKey;
  const cutscene = useMemo(() => resolveStoryCutscene(steps, position), [steps, position]);
  const episodeArt = useMemo(() => {
    const picked = new Map<number, string>();
    for (const entry of collection?.episodes ?? []) {
      const art = pickStoryBackground(entry.backgrounds, entry.background);
      if (art !== null) {
        picked.set(entry.id, art);
      }
    }
    return picked;
  }, [collection]);
  const shelfArt = useMemo(() => {
    const picked = new Map<string, string>();
    for (const kind of ["main", "love"] as StoryKind[]) {
      for (const entry of index?.[kind] ?? []) {
        const art = pickStoryBackground(entry.backgrounds, entry.background);
        if (art !== null) {
          picked.set(`${kind}/${entry.key}`, art);
        }
      }
    }
    return picked;
  }, [index]);
  const cast = useMemo(
    () => resolveStoryCast(stage, collection?.actors ?? {}, current?.line.speaker),
    [stage, collection, current],
  );

  function actorOf(actorId: number | undefined): StoryActor | null {
    if (actorId === undefined || collection === null) {
      return null;
    }
    return collection.actors[String(actorId)] ?? null;
  }

  useEffect(() => {
    if (!voiceEnabled || current === null || episode === null || choosing) {
      return;
    }
    const source = storyVoiceUrl(episode.media, voiceLanguage, current.line);
    if (source === null) {
      return;
    }
    const audio = new Audio(source);
    voiceRef.current = audio;
    audio.volume = 0.85;
    let active = true;
    void audio.play().catch((error: unknown) => {
      if (active) setMediaError(error instanceof Error ? error.message : String(error));
    });
    return () => {
      active = false;
      audio.pause();
      voiceRef.current = null;
      audio.src = "";
    };
  }, [voiceEnabled, voiceLanguage, current, episode, choosing]);

  const rawText = current === null ? "" : storyTextOf(current.line.text, language);
  const parsed = useMemo(() => parseStoryText(rawText), [rawText]);
  const lineText = parsed.plain;
  const revealed = reveal.text === lineText ? reveal.count : 0;
  const typing = revealed < lineText.length;

  useEffect(() => {
    if (lineText.length === 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setReveal((value) => {
        const count = value.text === lineText ? value.count : 0;
        if (count >= lineText.length) {
          return value;
        }
        return { text: lineText, count: count + 1 };
      });
    }, 24);
    return () => window.clearInterval(timer);
  }, [lineText]);

  function advance() {
    if (choosing || waitingForMovie) return;
    if (typing) {
      setReveal({ text: lineText, count: lineText.length });
      return;
    }
    setPosition((value) => Math.min(value + 1, steps.length - 1));
  }

  useEffect(() => {
    if (!autoPlay || typing || choosing || waitingForMovie || mediaError !== null || steps.length === 0 || position >= steps.length - 1) {
      return;
    }
    const timer = window.setTimeout(() => setPosition((value) => value + 1), 1600);
    return () => window.clearTimeout(timer);
  }, [autoPlay, typing, choosing, waitingForMovie, mediaError, position, steps.length]);

  useEffect(() => {
    if (episode === null) {
      return;
    }
    suspendAmbientBgm(true);
    return () => suspendAmbientBgm(false);
  }, [episode]);

  useEffect(() => {
    const background = bgmRef.current;
    if (background !== null) {
      background.volume = 0.32;
    }
    const ambience = ambienceRef.current;
    if (ambience !== null) {
      ambience.volume = 0.22;
    }
  }, [sceneBgm, sceneAmbience]);

  function endingLabel(ending: StoryEpisode["ending"]): string | null {
    if (ending === "bad") return labels.storyEndingBad;
    if (ending === "normal") return labels.storyEndingNormal;
    if (ending === "true") return labels.storyEndingTrue;
    return null;
  }

  function openEpisode(entry: StoryEpisode) {
    setEpisode(entry);
    setSelections({});
    setPosition(0);
    setReveal({ text: "", count: 0 });
    setMediaError(null);
    setMovieEnded(null);
    setLogOpen(false);
  }

  function rewind(target: number) {
    const targetLine = steps[target]?.line;
    if (targetLine === undefined) return;
    setSelections((values) => Object.fromEntries(Object.entries(values).filter(([key]) => Number(key) < targetLine.index)));
    setPosition(target);
    setReveal({ text: "", count: 0 });
    setMovieEnded(null);
  }

  function openCollection(kind: StoryKind, key: string) {
    setLoading(true);
    setSelection({ kind, key });
  }

  function closeCollection() {
    setSelection(null);
    setCollection(null);
  }

  if (failed) {
    return (
      <section className="ever-story">
        <p className="ever-story__notice">{labels.storyLoadFailed}</p>
      </section>
    );
  }

  if (episode !== null) {
    const episodeIndex = collection?.episodes.findIndex((entry) => entry.id === episode.id) ?? -1;
    const nextEpisode = collection?.episodes[episodeIndex + 1];
    const atEnd = position === steps.length - 1 && !choosing;
    const shelfEntry = selection === null
      ? null
      : (index?.[selection.kind].find((entry) => entry.key === selection.key) ?? null);
    const sceneBackground = background ?? episode.background ?? shelfEntry?.background ?? null;
    const cutsceneSource = cutscene === null || cutscene.cutscene_clip === undefined
      || cutscene.cutscene_available !== true
      ? null
      : storyCutsceneUrl(episode.media, cutscene.cutscene_clip);
    const cutsceneStaged = cutscene !== null && cutsceneSource === null;
    const castHidden = movie?.fullscreen === true || cutscene !== null;
    const portrait = storyActorPortraitUrl(actorOf(current?.line.small_port));
    const speaker = current === null || current.line.gameplay === true
      ? ""
      : storyTextOf(actorOf(current.line.speaker)?.name, language);
    return (
      <section className="ever-story ever-story--viewer">
        {sceneBgm === null ? null : (
          <audio ref={bgmRef} key={sceneBgm} src={storyBgmUrl(sceneBgm)} loop autoPlay
            onError={() => setMediaError(storyBgmUrl(sceneBgm))} />
        )}
        {sceneAmbience === null ? null : (
          <audio ref={ambienceRef} key={sceneAmbience} src={storyAmbienceUrl(sceneAmbience)} loop autoPlay
            onError={() => setMediaError(storyAmbienceUrl(sceneAmbience))} />
        )}
        <header className="ever-story__bar">
          <StoryButton onClick={() => setEpisode(null)}>← {labels.storyBackToList}</StoryButton>
          <h1>{storyTextOf(episode.title, language)}</h1>
          <span>{labels.storyProgress} {position + 1}</span>
        </header>
        <div className="ever-story__stage">
          <div className={"ever-story__scene" + (cutsceneStaged ? " is-cutscene" : "")}
            style={sceneBackground === null ? undefined : { backgroundImage: "url(" + storyBackgroundUrl(sceneBackground) + ")" }}>
            {movie === null ? null : (
              <video ref={movieRef} key={movieKey}
                className={"ever-story__movie" + (movie.fullscreen ? " is-fullscreen" : "")}
                src={storyClipUrl(movie)} autoPlay loop={!movie.fullscreen}
                muted={!movie.fullscreen || !voiceEnabled} controls={movie.fullscreen} playsInline
                onEnded={() => setMovieEnded(movieKey)}
                onError={() => setMediaError(storyClipUrl(movie))}
              />
            )}
            {cutsceneSource === null ? null : (
              <video key={cutsceneSource} className="ever-story__movie" src={cutsceneSource}
                autoPlay loop muted playsInline onError={() => setMediaError(cutsceneSource)} />
            )}
            {castHidden ? null : (
              <StoryCast cast={cast} language={language} onMediaError={setMediaError} />
            )}
            {choosing ? (
              <div className="ever-story__choices" role="group" aria-label={labels.storyChoicePrompt}>
                <span className="ever-story__choices-title">{labels.storyChoicePrompt}</span>
                {current.choices.map((choice) => (
                  <button key={choice.id} type="button" className="ever-story__choice"
                    onClick={() => {
                      setSelections((value) => ({ ...value, [choice.index]: choice.id }));
                      setPosition((value) => value + 1);
                      setReveal({ text: "", count: 0 });
                    }}>
                    <span className="ever-story__choice-label">
                      <StoryText parsed={parseStoryText(storyTextOf(choice.text, language))} />
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="ever-story__dialogue-layer">
            {current === null ? (
              <p className="ever-story__notice">{labels.storyEmpty}</p>
            ) : (
              <button type="button"
                className={"ever-story__bubble" + (current.line.gameplay ? " is-gameplay" : "")
                  + (current.line.ui_type === "Narration" ? " is-narration" : "")}
                disabled={choosing || waitingForMovie} onClick={advance}
                style={{ backgroundImage: "url(" + storyUiUrl("TalkBG") + ")" }}>
                {portrait === null ? null : (
                  <img className="ever-story__portrait" src={portrait} alt=""
                    onError={() => setMediaError(portrait)} />
                )}
                <span className="ever-story__dialogue">
                  {speaker.length === 0 ? null : (
                    <strong className="ever-story__speaker">{speaker}</strong>
                  )}
                  <span className="ever-story__text" aria-live="polite">
                    <StoryText parsed={parsed} reveal={revealed} />
                    {typing ? null : <i className="ever-story__cursor" />}
                  </span>
                </span>
              </button>
            )}
          </div>
          {logOpen ? (
            <div className="ever-story__log">
              <div className="ever-story__log-head">
                <StoryButton icon="icon_log2" onClick={() => setLogOpen(false)}>{labels.storyLog}</StoryButton>
              </div>
              {steps.slice(0, position + 1).map((entry, entryIndex) => (
                <p key={entry.line.id}>
                  <strong>{storyTextOf(actorOf(entry.line.speaker)?.name, language)}</strong>
                  <button type="button" onClick={() => { rewind(entryIndex); setLogOpen(false); }}>
                    <StoryText parsed={parseStoryText(storyTextOf(entry.line.text, language))} />
                  </button>
                </p>
              ))}
            </div>
          ) : null}
        </div>
        <footer className="ever-story__controls">
          <StoryButton icon="icon_autobattle" active={autoPlay} aria-pressed={autoPlay}
            onClick={() => setAutoPlay((value) => !value)}>{labels.storyAuto}</StoryButton>
          <StoryButton active={voiceEnabled} aria-pressed={voiceEnabled}
            onClick={() => setVoiceEnabled((value) => !value)}>{labels.storyVoice}</StoryButton>
          <StoryButton disabled={!voiceEnabled}
            onClick={() => setVoiceLanguage((value) => value === "ko" ? "ja" : "ko")}>
            {voiceLanguage === "ko" ? labels.storyVoiceKorean : labels.storyVoiceJapanese}
          </StoryButton>
          <StoryButton icon="icon_log2" active={logOpen} aria-pressed={logOpen}
            onClick={() => setLogOpen((value) => !value)}>{labels.storyLog}</StoryButton>
          <span className="ever-story__spacer" />
          <StoryButton disabled={position === 0} onClick={() => rewind(position - 1)}>{labels.storyPrevious}</StoryButton>
          <StoryButton disabled={choosing || waitingForMovie || (atEnd && nextEpisode === undefined)}
            onClick={() => {
              if (atEnd && !typing && nextEpisode !== undefined) openEpisode(nextEpisode);
              else advance();
            }}>
            {atEnd && nextEpisode !== undefined ? labels.storyEpisodeLabel + " " + nextEpisode.episode + " →" : labels.storyNext}
          </StoryButton>
        </footer>
        {mediaError === null ? null : (
          <div className="ever-story__media-error" role="alert">
            <span>{labels.storyLoadFailed} {mediaError}</span>
            <StoryButton onClick={() => {
              const media = [voiceRef.current, bgmRef.current, ambienceRef.current, movieRef.current];
              setMediaError(null);
              for (const element of media) {
                if (element !== null) void element.play().catch((error: unknown) =>
                  setMediaError(error instanceof Error ? error.message : String(error)));
              }
            }}>{labels.storyVoice}</StoryButton>
          </div>
        )}
      </section>
    );
  }

  if (collection !== null) {
    const indexEntry = index?.[collection.kind].find((entry) => entry.key === collection.key) ?? null;
    const collectionTitle = indexEntry?.name
      ? storyTextOf(indexEntry.name, language)
      : collection.kind === "main"
        ? `${labels.storyChapterLabel} ${collection.key.replace("chapter", "")}`
        : collection.key;
    return (
      <section className="ever-story">
        <header className="ever-story__bar">
          <StoryButton onClick={closeCollection}>← {labels.storyBackToList}</StoryButton>
          <h1>{collectionTitle}</h1>
          <span>
            {collection.episodes.length} {labels.storyEpisodeLabel}
          </span>
        </header>
        <ul className="ever-story__episodes">
          {collection.episodes.map((entry) => (
            <li key={entry.id}>
              <button type="button" className="ever-story__episode" onClick={() => openEpisode(entry)}>
                <span
                  className="ever-story__episode-art"
                  style={(() => {
                    const art = episodeArt.get(entry.id);
                    return art === undefined
                      ? undefined
                      : { backgroundImage: `url(${storyBackgroundUrl(art)})` };
                  })()}
                >
                  <b>{entry.episode}</b>
                  {entry.ending === null ? null : (
                    <em className={`is-${entry.ending}`}>{endingLabel(entry.ending)}</em>
                  )}
                  {entry.gameplay === true ? (
                    <i className="ever-story__episode-mark">{labels.storyGameplay}</i>
                  ) : null}
                </span>
                <span className="ever-story__episode-text">
                  <strong>{storyTextOf(entry.title, language)}</strong>
                  {entry.summary === null ? null : (
                    <span className="ever-story__episode-summary">{storyTextOf(entry.summary, language)}</span>
                  )}
                  <small>
                    {entry.required_affinity === null
                      ? `${entry.lines.length} ${labels.storyProgress}`
                      : `${labels.storyRequiredAffinity} ${entry.required_affinity}`}
                  </small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const shelf = index === null ? [] : index[category];
  const categoryIcon = category === "main" ? "ICON_MainStory" : "Icon_LoveStory";

  return (
    <section className="ever-story ever-story--gallery">
      <video
        key={category}
        className="ever-story__backdrop"
        src={storyVideoUrl(category === "main" ? "BG_StoryMain" : "BG_StoryLove")}
        poster={storyUiUrl(category === "main" ? "bg_story_main" : "bg_story_love")}
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="ever-story__banner">
        <img src={storyUiUrl("bg_StoryTitle")} alt="" />
        <strong>{category === "main" ? labels.storyMainTitle : labels.storyLoveTitle}</strong>
      </div>
      <div className="ever-story__gallery">
        <nav className="ever-story__tabs">
          {(["main", "love"] as StoryKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              className={`ever-story__tab${category === kind ? " is-active" : ""}`}
              onClick={() => setCategory(kind)}
            >
              <img src={storyUiUrl(kind === "main" ? "ICON_MainStory" : "Icon_LoveStory")} alt="" />
              <span>{kind === "main" ? labels.storyMainTitle : labels.storyLoveTitle}</span>
            </button>
          ))}
          {loading ? <span className="ever-story__notice">{labels.storyLoading}</span> : null}
        </nav>
        <ul className="ever-story__books">
          {shelf.map((entry) => {
            const portrait = storyPortraitUrl(entry.asset_folder, entry.asset_prefix);
            const art = shelfArt.get(`${category}/${entry.key}`);
            const scene = art === undefined ? null : storyBackgroundUrl(art);
            const cover = portrait ?? scene;
            const title = entry.name
              ? storyTextOf(entry.name, language)
              : category === "main"
                ? `${labels.storyChapterLabel} ${entry.key.replace("chapter", "")}`
                : entry.key;
            return (
              <li key={entry.key}>
                <button
                  type="button"
                  className="ever-story__book"
                  onClick={() => openCollection(category, entry.key)}
                >
                  <img className="ever-story__book-badge" src={storyUiUrl(categoryIcon)} alt="" />
                  <span
                    className={`ever-story__book-art${portrait === null ? " is-scene" : ""}`}
                    style={{
                      backgroundImage: `url(${cover ?? storyUiUrl(category === "main" ? "bg_story_main" : "bg_story_love")})`,
                    }}
                  />
                  <span className="ever-story__book-label">
                    <strong>{title}</strong>
                    <small>
                      {entry.episode_count} {labels.storyEpisodeLabel}
                    </small>
                  </span>
                  {entry.endings.length > 0 ? <em className="ever-story__book-mark" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
