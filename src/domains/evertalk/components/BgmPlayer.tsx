import { ListOrdered, Music, Pause, Play, Shuffle, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { bgmArrangeOf, bgmTitleOf, bgmUrl, filterBgmTracks, loadBgmIndex, orderBgmTracks } from "../../bgm/client";
import { ambientBgmSuspended, subscribeAmbientBgm } from "../../bgm/session";
import type { BgmOrder, BgmTrack } from "../../bgm/types";
import type { AppLanguage } from "../../../shared/types";
import type { EverTalkLabels } from "../i18n";

const ENABLED_KEY = "evai.bgm.enabled";
const VOLUME_KEY = "evai.bgm.volume";
const ORDER_KEY = "evai.bgm.order";

function readStored(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    return;
  }
}

interface BgmPlayerProps {
  labels: EverTalkLabels;
  language: AppLanguage;
}

export function BgmPlayer({ labels, language }: BgmPlayerProps) {
  const [tracks, setTracks] = useState<BgmTrack[]>([]);
  const [enabled, setEnabled] = useState(() => readStored(ENABLED_KEY, "off") === "on");
  const [paused, setPaused] = useState(false);
  const [position, setPosition] = useState(0);
  const [order, setOrder] = useState<BgmOrder>(() => readStored(ORDER_KEY, "listed") as BgmOrder);
  const [volume, setVolume] = useState(() => Number(readStored(VOLUME_KEY, "0.4")));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [seed, setSeed] = useState(1);
  const [suspended, setSuspended] = useState(() => ambientBgmSuspended());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => subscribeAmbientBgm(setSuspended), []);

  useEffect(() => {
    let cancelled = false;
    loadBgmIndex()
      .then((index) => {
        if (!cancelled) {
          setTracks(index.tracks);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const ordered = useMemo(() => orderBgmTracks(tracks, order, language, seed), [tracks, order, language, seed]);
  const listed = useMemo(() => filterBgmTracks(ordered, query, language), [ordered, query, language]);
  const current = ordered[position] ?? null;

  useEffect(() => {
    writeStored(ENABLED_KEY, enabled ? "on" : "off");
  }, [enabled]);
  useEffect(() => {
    writeStored(ORDER_KEY, order);
  }, [order]);
  useEffect(() => {
    writeStored(VOLUME_KEY, String(volume));
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio !== null) {
      audio.volume = volume;
    }
  }, [volume, current]);

  const playing = enabled && !paused && !suspended && current !== null;

  useEffect(() => {
    const audio = audioRef.current;
    if (audio === null || current === null) {
      return;
    }
    if (playing) {
      void audio.play().catch(() => setPaused(true));
      return;
    }
    audio.pause();
  }, [playing, current]);

  function step(delta: number) {
    if (ordered.length === 0) {
      return;
    }
    setPosition((value) => (value + delta + ordered.length) % ordered.length);
  }

  function selectTrack(track: BgmTrack) {
    const index = ordered.findIndex((entry) => entry.id === track.id);
    if (index < 0) {
      return;
    }
    setPosition(index);
    setEnabled(true);
    setPaused(false);
  }

  function cycleOrder() {
    setOrder((value) => {
      if (value === "listed") return "title";
      if (value === "title") return "shuffle";
      return "listed";
    });
    setSeed((value) => value + 7919);
    setPosition(0);
  }

  const orderLabel =
    order === "listed" ? labels.bgmOrderListed : order === "title" ? labels.bgmOrderTitle : labels.bgmOrderShuffle;

  return (
    <div className={`ever-bgm${enabled ? " is-enabled" : ""}`}>
      <button
        type="button"
        className="ever-bgm__toggle"
        aria-pressed={enabled}
        title={enabled ? labels.bgmOff : labels.bgmOn}
        onClick={() => setEnabled((value) => !value)}
      >
        <Music size={14} aria-hidden="true" />
        <span>{labels.bgmPlayer}</span>
      </button>
      {enabled ? (
        <div className="ever-bgm__transport">
          <button type="button" title={labels.bgmPrevious} onClick={() => step(-1)}>
            <SkipBack size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            title={playing ? labels.bgmPause : labels.bgmPlay}
            onClick={() => setPaused((value) => !value)}
          >
            {playing ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
          </button>
          <button type="button" title={labels.bgmNext} onClick={() => step(1)}>
            <SkipForward size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="ever-bgm__title"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {current === null ? labels.bgmEmpty : bgmTitleOf(current, language)}
          </button>
          <button type="button" title={orderLabel} onClick={cycleOrder}>
            {order === "shuffle" ? <Shuffle size={13} aria-hidden="true" /> : <ListOrdered size={13} aria-hidden="true" />}
          </button>
        </div>
      ) : null}
      {enabled && open ? (
        <div className="ever-bgm__panel" role="dialog" aria-label={labels.bgmPlayer}>
          <header>
            <input
              type="search"
              value={query}
              placeholder={labels.bgmSearch}
              onChange={(event) => setQuery(event.target.value)}
            />
            <label className="ever-bgm__volume">
              <Volume2 size={13} aria-hidden="true" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                aria-label={labels.bgmVolume}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
            </label>
          </header>
          <ul>
            {listed.length === 0 ? (
              <li className="ever-bgm__empty">{labels.bgmEmpty}</li>
            ) : (
              listed.map((track) => {
                const arrange = bgmArrangeOf(track, language);
                return (
                  <li key={track.id}>
                    <button
                      type="button"
                      className={current?.id === track.id ? "is-active" : ""}
                      onClick={() => selectTrack(track)}
                    >
                      <strong>{bgmTitleOf(track, language)}</strong>
                      {arrange.length > 0 ? <small>{arrange}</small> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <footer>{listed.length} / {ordered.length}</footer>
        </div>
      ) : null}
      {current === null ? null : (
        <audio
          ref={audioRef}
          key={current.clip}
          src={bgmUrl(current)}
          onEnded={() => step(1)}
          onError={() => step(1)}
        />
      )}
    </div>
  );
}
