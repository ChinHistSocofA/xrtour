import { useEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClosedCaptioning as faCC } from '@fortawesome/free-regular-svg-icons';
import { faBars, faClosedCaptioning as faCCFilled, faLocationDot, faPause, faPlay } from '@fortawesome/free-solid-svg-icons';
import classNames from 'classnames';
import colors from 'simple-color-functions';

import ImageOverlay from './ImageOverlay';
import ImageSphere from './ImageSphere';
import Map from './Map';
import ModelOverlay from './ModelOverlay';
import Scrubber from './Scrubber';
import Toc from './Toc';

import './StopViewer.scss';

function getVariantFile(files, variant, fallbackVariant, variantSuffix = '') {
  let file = files.find((f) => f.variant === `${variant?.code}${variantSuffix}`);
  if (!file?.key) {
    file = files.find((f) => f.variant === `${fallbackVariant?.code}${variantSuffix}`);
  }
  return file;
}

function StopViewer({
  autoPlay,
  controls,
  mapboxAccessToken,
  position,
  team,
  tour,
  tourStops,
  stop,
  transition,
  variant,
  fallbackVariant,
  variants,
  onSelectVariant,
  onEnded,
  onPause,
  onSelect,
  onTimeUpdate,
}) {
  const [duration, setDuration] = useState(0);
  const [stopIndex, setStopIndex] = useState(0);

  const [tracks, setTracks] = useState();
  const [images, setImages] = useState();
  const [overlays, setOverlays] = useState();

  const [currentTrack, setCurrentTrack] = useState();
  const [prevImageURL, setPrevImageURL] = useState();
  const [prevImageOptions, setPrevImageOptions] = useState();
  const [imageStart, setImageStart] = useState();
  const [imageURL, setImageURL] = useState();
  const [imageOptions, setImageOptions] = useState();
  const [currentOverlay, setCurrentOverlay] = useState();
  const [selectedOverlay, setSelectedOverlay] = useState();

  const ref = useRef({});

  const subtitlesRef = useRef({});
  const [subtitleText, setSubtitleText] = useState();

  const [isPlaying, setPlaying] = useState(autoPlay || false);
  const [isTocOpen, setTocOpen] = useState(false);
  const [isMapOpen, setMapOpen] = useState(false);
  const [isCC, setCC] = useState(false);
  const [isShowingVariants, setShowingVariants] = useState(false);

  useEffect(() => {
    if (stop?.Resources) {
      let newDuration = 0;
      let newImages = [];
      let newTracks = [];
      let newOverlays = [];
      for (const sr of stop.Resources) {
        if (Number.isInteger(sr.end)) {
          newDuration = Math.max(newDuration, sr.end);
        } else if (Number.isInteger(sr.start)) {
          newDuration = Math.max(newDuration, sr.start);
        }
        if (sr.Resource.type === 'AUDIO') {
          newDuration = Math.max(newDuration, sr.start + getVariantFile(sr.Resource.Files, variant, fallbackVariant)?.duration ?? 0);
          newTracks.push(sr);
        } else if (sr.Resource.type === 'IMAGE') {
          newImages.push({ ...sr });
          // preload image
          const img = new Image();
          img.src = getVariantFile(sr.Resource.Files, variant, fallbackVariant)?.URL;
        } else if (
          sr.Resource.type === '3D_MODEL' ||
          sr.Resource.type === 'AR_LINK' ||
          sr.Resource.type === 'IMAGE_OVERLAY' ||
          sr.Resource.type === 'IMAGE_SPHERE'
        ) {
          newOverlays.push({ ...sr });
        }
      }
      if (transition?.Resources) {
        const offset = newDuration;
        for (const ir of newImages) {
          if (!Number.isInteger(ir.end)) {
            ir.end = offset;
          }
        }
        for (const ir of newOverlays) {
          if (!Number.isInteger(ir.end)) {
            ir.end = offset;
          }
        }
        for (const sr of transition.Resources) {
          if (Number.isInteger(sr.end)) {
            newDuration = Math.max(newDuration, offset + sr.end);
          } else if (Number.isInteger(sr.start)) {
            newDuration = Math.max(newDuration, offset + sr.start);
          }
          if (sr.Resource.type === 'AUDIO') {
            newDuration = Math.max(
              newDuration,
              offset + sr.start + getVariantFile(sr.Resource.Files, variant, fallbackVariant)?.duration ?? 0
            );
            newTracks.push({ ...sr, start: offset + sr.start });
          } else if (sr.Resource.type === 'IMAGE') {
            newImages.push({ ...sr, start: offset + sr.start, end: Number.isInteger(sr.end) ? offset + sr.end : null });
            // preload image
            const img = new Image();
            img.src = getVariantFile(sr.Resource.Files, variant, fallbackVariant)?.URL;
          } else if (
            sr.Resource.type === '3D_MODEL' ||
            sr.Resource.type === 'AR_LINK' ||
            sr.Resource.type === 'IMAGE_OVERLAY' ||
            sr.Resource.type === 'IMAGE_SPHERE'
          ) {
            newOverlays.push({ ...sr, start: offset + sr.start, end: Number.isInteger(sr.end) ? offset + sr.end : null });
          }
        }
      }
      setDuration(newDuration);
      setImages(newImages);
      setTracks(newTracks);
      setOverlays(newOverlays);
      ref.current = {};

      const newIndex = tourStops?.findIndex((ts) => ts.StopId === stop.id);
      setStopIndex(newIndex === undefined ? undefined : newIndex + 1);
    }
  }, [autoPlay, stop, tourStops, transition, variant]);

  useEffect(() => {
    if (images && overlays && tracks && Number.isInteger(position)) {
      let newImageURL;
      let newImageOptions;
      for (const sr of images) {
        if (((position === 0 && sr.start <= position) || sr.start < position) && (sr.end ?? Number.MAX_SAFE_INTEGER) >= position) {
          newImageURL = getVariantFile(sr.Resource.Files, variant, fallbackVariant)?.URL;
          newImageOptions = sr.options;
          break;
        }
      }
      if (newImageURL !== imageURL) {
        setPrevImageURL(imageURL);
        setPrevImageOptions(imageOptions);
        setImageStart(position);
        setImageURL(newImageURL);
        setImageOptions(newImageOptions);
      }
      let newOverlay;
      for (const sr of overlays) {
        if (((position === 0 && sr.start <= position) || sr.start < position) && (sr.end ?? Number.MAX_SAFE_INTEGER) >= position) {
          newOverlay = sr;
          break;
        }
      }
      if (newOverlay !== currentOverlay) {
        setCurrentOverlay(newOverlay);
      }
      for (const sr of tracks) {
        const end = sr.start + getVariantFile(sr.Resource.Files, variant, fallbackVariant)?.duration ?? 0;
        if (sr.start <= position && position < end) {
          const audio = ref.current[sr.id];
          if (!isPlaying && audio?.paused) {
            audio.currentTime = position - sr.start;
          }
          if (sr !== currentTrack) {
            if (isPlaying && !currentTrack?.pauseAtEnd) {
              audio?.play();
            }
            setCurrentTrack(sr);
          }
          break;
        }
      }
    }
  }, [variant, images, imageURL, overlays, currentOverlay, tracks, currentTrack, isPlaying, position]);

  function onPlayPause() {
    if (isPlaying) {
      for (const audio of Object.values(ref.current)) {
        audio.pause();
      }
      onPause?.();
    } else {
      if (currentTrack) {
        let audio = ref.current[currentTrack.id];
        if (audio.currentTime < audio.duration) {
          audio?.play();
        } else {
          const index = tracks.indexOf(currentTrack);
          if (index >= tracks.length - 1) {
            onEnded?.(true);
            return;
          } else {
            const nextTrack = tracks[index + 1];
            setCurrentTrack(nextTrack);
            audio = ref.current[nextTrack.id];
            audio?.play();
          }
        }
      }
    }
    setPlaying(!isPlaying);
  }

  function onTimeUpdateInternal(event) {
    const { target: audio } = event;
    if (audio.id === currentTrack?.id) {
      onTimeUpdate?.(Math.ceil(audio.currentTime) + currentTrack.start);
    }
  }

  function onEndedInternal(event) {
    const { target: audio } = event;
    const { id } = audio;
    const sr = tracks.find((sr) => sr.id === id);
    const index = tracks.indexOf(sr);
    if (sr.pauseAtEnd || index >= tracks.length - 1) {
      for (const audio of Object.values(ref.current)) {
        audio.pause();
      }
      if (isPlaying) {
        setPlaying(false);
        if (index >= tracks.length - 1) {
          onEnded?.(!sr.pauseAtEnd);
        } else {
          setCurrentTrack(tracks[index + 1]);
          onPause?.();
        }
      }
    } else {
      const nextTrack = tracks[index + 1];
      setCurrentTrack(nextTrack);
      ref.current[nextTrack.id]?.play();
    }
  }

  function onSeek(newPosition) {
    if (isPlaying) {
      for (const audio of Object.values(ref.current)) {
        audio.pause();
      }
      setPlaying(false);
      setCurrentTrack();
    }
    onTimeUpdate?.(Math.ceil(newPosition));
  }

  function onSelectInternal(ts) {
    if (isPlaying) {
      onPlayPause();
      onTimeUpdate?.(0);
    }
    setTocOpen(false);
    if (ts && ts.StopId !== stop?.id) {
      onSelect?.(ts);
    } else if (!ts && stop?.id !== tour?.IntroStopId) {
      onSelect?.(ts);
    }
  }

  function onClickOverlay(event) {
    event.preventDefault();
    switch (currentOverlay?.Resource?.type) {
      case '3D_MODEL':
        setSelectedOverlay(currentOverlay);
        break;
      case 'AR_LINK':
        window.open(getVariantFile(currentOverlay.Resource.Files, variant, fallbackVariant)?.URL, '_blank');
        break;
      case 'IMAGE_OVERLAY':
        setSelectedOverlay(currentOverlay);
        break;
      case 'IMAGE_SPHERE':
        setSelectedOverlay(currentOverlay);
        break;
      default:
        break;
    }
  }

  function onToggleCC() {
    if (!isCC && variants?.length > 1) {
      setShowingVariants(true);
    }
    setCC(!isCC);
  }

  function onSelectVariantInternal(v) {
    onSelectVariant?.(v);
    setShowingVariants(false);
  }

  let hasCC = false;
  const audio = tracks?.map((sr, i) => (
    <audio
      autoPlay={autoPlay && i === 0}
      crossOrigin="anonymous"
      onPlay={() => !isPlaying && setPlaying(true)}
      id={sr.id}
      key={sr.id}
      ref={(el) => el && (ref.current[el.id] = el)}
      src={getVariantFile(sr.Resource.Files, variant, fallbackVariant)?.URL}
      onTimeUpdate={onTimeUpdateInternal}
      onEnded={onEndedInternal}>
      {(() => {
        const subtitles = getVariantFile(sr.Resource.Files, variant, undefined, '-vtt');
        if (subtitles?.URL) {
          hasCC = true;
          return (
            <track
              ref={(el) => {
                if (el && subtitlesRef.current[subtitles.id] !== el) {
                  el.addEventListener('cuechange', function (event) {
                    const text = event.target?.track?.activeCues?.[0]?.text;
                    setSubtitleText(text);
                  });
                  subtitlesRef.current[subtitles.id] = el;
                }
              }}
              id={subtitles.id}
              default={true}
              kind="captions"
              src={subtitles.URL}></track>
          );
        }
      })()}
    </audio>
  ));

  const style = {};
  if (team?.font) {
    style.fontFamily = team.font.family;
  }
  style['--bs-btn-bg-custom-primary'] = team.colorPrimary ?? '#951330';
  style['--bs-btn-bg-custom-primary-hover'] = colors(style['--bs-btn-bg-custom-primary']).darken(0.15);
  style['--bs-btn-bg-custom-primary-active'] = colors(style['--bs-btn-bg-custom-primary']).darken(0.25);
  style['--bs-btn-bg-custom-secondary'] = team.colorSecondary ?? '#ffdd55';
  style['--bs-btn-bg-custom-secondary-hover'] = colors(style['--bs-btn-bg-custom-secondary']).darken(0.15);
  style['--bs-btn-bg-custom-secondary-active'] = colors(style['--bs-btn-bg-custom-secondary']).darken(0.25);

  return (
    <div className="stop-viewer" style={style}>
      <>
        {prevImageURL && (
          <div
            className={classNames('stop-viewer__image stop-viewer__image--hidden', {
              'stop-viewer__image--fade-out': position <= imageStart + 1,
            })}
            style={{ backgroundImage: `url(${prevImageURL})`, backgroundSize: prevImageOptions?.fit ?? 'cover' }}></div>
        )}
        <div
          className={classNames('stop-viewer__image', { 'stop-viewer__image--fade-in': position <= imageStart + 1 })}
          style={{ backgroundImage: imageURL ? `url(${imageURL})` : 'none', backgroundSize: imageOptions?.fit ?? 'cover' }}></div>
        {currentOverlay && <a tabIndex={0} onClick={onClickOverlay} className="stop-viewer__ar-link"></a>}
        {!!controls && (
          <div className="stop-viewer__toc">
            <button onClick={() => setTocOpen(true)} className="btn btn-custom-primary btn-lg btn-round">
              <FontAwesomeIcon icon={faBars} />
            </button>
          </div>
        )}
        {!!controls && (
          <div className="stop-viewer__map">
            <button onClick={() => setMapOpen(true)} className="btn btn-custom-primary btn-lg btn-round">
              <FontAwesomeIcon icon={faLocationDot} />
            </button>
          </div>
        )}
        <div className="stop-viewer__title h5">
          {stopIndex ?? '#'}. {stop?.names[variant?.code] || stop?.names[fallbackVariant?.code]}
        </div>
        <div className="stop-viewer__controls">
          <Scrubber onSeek={onSeek} position={position} duration={duration} className="stop-viewer__scrubber mb-2" />
          <div className="d-flex justify-content-between">
            <button className="btn btn-round invisible">&nbsp;</button>
            <button onClick={onPlayPause} type="button" className="btn btn-custom-secondary btn-lg btn-round">
              {!isPlaying && <FontAwesomeIcon icon={faPlay} />}
              {isPlaying && <FontAwesomeIcon icon={faPause} />}
            </button>
            <button
              onClick={onToggleCC}
              type="button"
              className={classNames('btn btn-lg btn-transparent btn-round', { invisible: !hasCC })}>
              {!isCC && <FontAwesomeIcon icon={faCC} />}
              {isCC && <FontAwesomeIcon icon={faCCFilled} />}
            </button>
          </div>
        </div>
        {audio}
      </>
      {selectedOverlay && (
        <>
          {selectedOverlay.Resource?.type === '3D_MODEL' && (
            <ModelOverlay onClose={() => setSelectedOverlay()} resource={selectedOverlay.Resource} variant={variant} />
          )}
          {selectedOverlay.Resource?.type === 'IMAGE_OVERLAY' && (
            <ImageOverlay onClose={() => setSelectedOverlay()} resource={selectedOverlay.Resource} variant={variant} />
          )}
          {selectedOverlay.Resource?.type === 'IMAGE_SPHERE' && (
            <ImageSphere onClose={() => setSelectedOverlay()} resource={selectedOverlay.Resource} variant={variant} />
          )}
        </>
      )}
      {isCC && subtitleText && <div className="stop-viewer__subtitles">{subtitleText}</div>}
      {isShowingVariants && (
        <ul className="stop-viewer__variants list-group">
          {variants?.map((v) => (
            <li key={v.code} onClick={() => onSelectVariantInternal(v)} className="list-group-item">
              {v.displayName}
            </li>
          ))}
        </ul>
      )}
      <>
        <Toc
          isOpen={isTocOpen}
          onClose={() => setTocOpen(false)}
          onSelect={onSelectInternal}
          onSelectVariant={onSelectVariant}
          tour={tour}
          tourStops={tourStops}
          variant={variant}
        />
        <Map
          mapboxAccessToken={mapboxAccessToken}
          isOpen={isMapOpen}
          onClose={() => setMapOpen(false)}
          stop={stop}
          tourStops={tourStops}
          variant={variant}
        />
      </>
    </div>
  );
}
export default StopViewer;
