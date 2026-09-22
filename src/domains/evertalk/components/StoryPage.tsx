import { useEffect, useMemo, useRef, useState } from "react";
import { suspendAmbientBgm } from "../../bgm/session";
import {
  buildStorySteps,
  resolveStoryAmbience,
  resolveStoryBackground,
  resolveStoryBgm,
  resolveStoryMovie,
  resolveStoryStage,
  storyAmbienceUrl,
  storyBgmUrl,
  storyClipUrl,
  storyBackgroundUrl,
  storyClient,
  storyPortraitUrl,
  storySpiritUrl,
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
  StoryStageSlot,
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
  const [category, setCategory] = useState<StoryKind>("main");
  const [autoPlay, setAutoPlay] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceLanguage, setVoiceLanguage] = useState<StoryVoiceLanguage>(language === "ko" ? "ko" : "ja");
  const [logOpen, setLogOpen] = useState(false);
  const [reveal, setReveal] = useState({ text: "", count: 0 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

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

  const steps = useMemo(() => (episode === null ? [] : buildStorySteps(episode)), [episode]);
  const current = steps[position] ?? null;
  const background = useMemo(() => resolveStoryBackground(steps, position), [steps, position]);
  const stage = useMemo(() => resolveStoryStage(steps, position), [steps, position]);
  const movie = useMemo(() => resolveStoryMovie(steps, position), [steps, position]);
  const sceneBgm = useMemo(() => resolveStoryBgm(steps, position), [steps, position]);
  const sceneAmbience = useMemo(() => resolveStoryAmbience(steps, position), [steps, position]);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const ambienceRef = useRef<HTMLAudioElement | null>(null);

  function actorOf(actorId: number | undefined): StoryActor | null {
    if (actorId === undefined || collection === null) {
      return null;
    }
    return collection.actors[String(actorId)] ?? null;
  }

  useEffect(() => {
    if (!voiceEnabled || current === null || selection === null) {
      return;
    }
    const source = storyVoiceUrl(selection.kind, selection.key, voiceLanguage, current.line);
    if (source === null) {
      return;
    }
    const audio = new Audio(source);
    audio.volume = 0.85;
    void audio.play().catch(() => undefined);
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [voiceEnabled, voiceLanguage, current, selection]);

  const lineText = current === null ? "" : storyTextOf(current.line.text, language);
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
    if (typing) {
      setReveal({ text: lineText, count: lineText.length });
      return;
    }
    setPosition((value) => Math.min(value + 1, steps.length - 1));
  }

  useEffect(() => {
    if (!autoPlay || typing || steps.length === 0 || position >= steps.length - 1) {
      return;
    }
    const timer = window.setTimeout(() => setPosition((value) => value + 1), 1600);
    return () => window.clearTimeout(timer);
  }, [autoPlay, typing, position, steps.length]);

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
    setPosition(0);
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
    return (
      <section className="ever-story ever-story--viewer">
        {sceneBgm === null ? null : (
          <audio ref={bgmRef} key={sceneBgm} src={storyBgmUrl(sceneBgm)} loop autoPlay />
        )}
        {sceneAmbience === null ? null : (
          <audio ref={ambienceRef} key={sceneAmbience} src={storyAmbienceUrl(sceneAmbience)} loop autoPlay />
        )}
        <header className="ever-story__bar">
          <button type="button" onClick={() => setEpisode(null)}>
            ← {labels.storyBackToList}
          </button>
          <button
            type="button"
            onClick={() => {
              setEpisode(null);
              closeCollection();
            }}
          >
            {labels.navStory}
          </button>
          <h1>{storyTextOf(episode.title, language)}</h1>
          <span>
            {labels.storyProgress} {Math.min(position + 1, steps.length)} / {steps.length}
          </span>
        </header>
        <div
          className="ever-story__stage"
          role="presentation"
          onClick={advance}
          style={background === null ? undefined : { backgroundImage: `url(${storyBackgroundUrl(background)})` }}
        >
          {movie === null ? null : (
            <video
              key={`${movie.kind}/${movie.key}/${movie.clip}`}
              className="ever-story__movie"
              src={storyClipUrl(movie)}
              autoPlay
              loop
              muted
              playsInline
            />
          )}
          <div className="ever-story__cast">
            {(["left", "center", "right"] as StoryStageSlot[]).map((slot) => {
              const placed = stage[slot];
              const actor = actorOf(placed?.id);
              const source = actor === null ? null : storySpiritUrl(actor);
              if (actor === null || source === null) {
                return null;
              }
              const speaking = current?.line.speaker === actor.id;
              return (
                <img
                  key={slot}
                  className={`ever-story__actor ever-story__actor--${slot}${speaking ? " is-speaking" : ""}`}
                  src={source}
                  alt=""
                  style={{ transform: `scale(${actor.scale}) scaleX(${actor.flip ? -1 : 1})` }}
                />
              );
            })}
          </div>
          {current === null ? (
            <p className="ever-story__notice">{labels.storyEmpty}</p>
          ) : (
            <div
              className="ever-story__bubble"
              style={{ backgroundImage: `url(${storyUiUrl("TalkBG")})` }}
            >
              {actorOf(current.line.speaker)?.name ? (
                <strong>{storyTextOf(actorOf(current.line.speaker)?.name, language)}</strong>
              ) : null}
              <p>
                {lineText.slice(0, revealed)}
                {typing ? null : <i className="ever-story__cursor" />}
              </p>
            </div>
          )}
        </div>
        {current !== null && current.choices.length > 0 ? (
          <div className="ever-story__choices">
            <span>{labels.storyChoicePrompt}</span>
            {current.choices.map((choice) => (
              <button
                key={choice.index}
                type="button"
                onClick={() => setPosition((value) => Math.min(value + 1, steps.length - 1))}
              >
                {storyTextOf(choice.text, language)}
              </button>
            ))}
          </div>
        ) : null}
        {logOpen ? (
          <div className="ever-story__log">
            {steps.slice(0, position + 1).length === 0 ? (
              <p className="ever-story__notice">{labels.storyLogEmpty}</p>
            ) : (
              steps.slice(0, position + 1).map((entry, entryIndex) => (
                <p key={entry.line.id}>
                  {actorOf(entry.line.speaker)?.name ? (
                    <strong>{storyTextOf(actorOf(entry.line.speaker)?.name, language)}</strong>
                  ) : null}
                  <button type="button" onClick={() => setPosition(entryIndex)}>
                    {storyTextOf(entry.line.text, language)}
                  </button>
                </p>
              ))
            )}
          </div>
        ) : null}
        <footer className="ever-story__controls">
          <button
            type="button"
            className={autoPlay ? "is-active" : ""}
            onClick={() => setAutoPlay((value) => !value)}
          >
            {labels.storyAuto}
          </button>
          <button
            type="button"
            className={voiceEnabled ? "is-active" : ""}
            onClick={() => setVoiceEnabled((value) => !value)}
          >
            {labels.storyVoice}
          </button>
          <button
            type="button"
            className="ever-story__voice-language"
            disabled={!voiceEnabled}
            onClick={() => setVoiceLanguage((value) => (value === "ko" ? "ja" : "ko"))}
          >
            {voiceLanguage === "ko" ? labels.storyVoiceKorean : labels.storyVoiceJapanese}
          </button>
          <button type="button" className={logOpen ? "is-active" : ""} onClick={() => setLogOpen((value) => !value)}>
            {labels.storyLog}
          </button>
          <span className="ever-story__spacer" />
          <button type="button" disabled={position === 0} onClick={() => setPosition((value) => Math.max(value - 1, 0))}>
            {labels.storyPrevious}
          </button>
          <button
            type="button"
            disabled={position >= steps.length - 1}
            onClick={() => setPosition((value) => Math.min(value + 1, steps.length - 1))}
          >
            {labels.storyNext}
          </button>
        </footer>
      </section>
    );
  }

  if (collection !== null) {
    const indexEntry = index?.[collection.kind].find((entry) => entry.key === collection.key) ?? null;
    const collectionTitle = indexEntry?.name
      ? storyTextOf(indexEntry.name, language)
      : `${labels.storyChapterLabel} ${collection.key.replace("chapter", "")}`;
    return (
      <section className="ever-story">
        <header className="ever-story__bar">
          <button type="button" onClick={closeCollection}>
            {labels.storyBackToList}
          </button>
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
                  style={
                    entry.background
                      ? { backgroundImage: `url(${storyBackgroundUrl(entry.background)})` }
                      : undefined
                  }
                >
                  <b>{entry.episode}</b>
                  {entry.ending === null ? null : (
                    <em className={`is-${entry.ending}`}>{endingLabel(entry.ending)}</em>
                  )}
                </span>
                <span className="ever-story__episode-text">
                  <strong>{storyTextOf(entry.title, language)}</strong>
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
            const scene = entry.background ? storyBackgroundUrl(entry.background) : null;
            const cover = portrait ?? scene;
            const title = entry.name
              ? storyTextOf(entry.name, language)
              : `${labels.storyChapterLabel} ${entry.key.replace("chapter", "")}`;
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
