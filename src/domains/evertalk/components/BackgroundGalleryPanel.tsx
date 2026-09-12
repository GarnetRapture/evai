import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { ASSET_ROOT } from '../../persona';
import { BACKGROUND_ASSET_FILES } from '../backgroundAssets';
import type { BackgroundGalleryPanelProps } from '../types';
import { ImageViewerOverlay } from './ImageViewerOverlay';

const PAGE_SIZE = 60;

export function BackgroundGalleryPanel({ open, labels, onClose, onSelectBackground, selectedBackground }: BackgroundGalleryPanelProps) {
  const [zoomedFile, setZoomedFile] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(BACKGROUND_ASSET_FILES.length / PAGE_SIZE));
  const pageFiles = useMemo(
    () => BACKGROUND_ASSET_FILES.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [page]
  );

  if (!open) {
    return null;
  }

  function handleClose() {
    setZoomedFile(null);
    setPage(0);
    onClose();
  }

  function goToPage(next: number) {
    setPage(Math.min(Math.max(next, 0), totalPages - 1));
  }

  return (
    <div className="ever-settings-overlay" role="dialog" aria-modal="true">
      <div className="ever-background-gallery-modal">
        <header className="ever-settings-modal__header">
          <h2>{labels.backgroundGallery} ({BACKGROUND_ASSET_FILES.length})</h2>
          {onSelectBackground && (
            <button type="button" className="ever-background-gallery-default" onClick={() => onSelectBackground(null)}>
              {labels.lobbyDefaultBackground}
            </button>
          )}
          <button type="button" aria-label={labels.close} onClick={handleClose}>
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        <div className="ever-background-gallery-grid">
          {pageFiles.map((file) => (
            <div key={file} className={`ever-gallery-tile ever-gallery-tile--button ${selectedBackground === file ? 'is-selected' : ''}`}>
              <button
                type="button"
                className="ever-gallery-tile__image-button"
                aria-label={onSelectBackground ? labels.lobbyPickBackground : `${file} ${labels.zoomImage}`}
                onClick={() => (onSelectBackground ? onSelectBackground(file) : setZoomedFile(file))}
              >
                <img src={`${ASSET_ROOT}/backgrounds/talk/${file}`} alt={file} loading="lazy" />
                <span className="ever-gallery-tile__zoom-hint" aria-hidden="true">
                  {onSelectBackground ? <Check size={18} /> : <ZoomIn size={18} />}
                </span>
              </button>
            </div>
          ))}
        </div>
        <div className="ever-background-gallery-pager">
          <button
            type="button"
            aria-label={labels.previousPage}
            disabled={page === 0}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <span>{page + 1} / {totalPages} {labels.page}</span>
          <button
            type="button"
            aria-label={labels.nextPage}
            disabled={page >= totalPages - 1}
            onClick={() => goToPage(page + 1)}
          >
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>
      </div>

      <ImageViewerOverlay
        open={zoomedFile !== null}
        candidates={zoomedFile ? [`${ASSET_ROOT}/backgrounds/talk/${zoomedFile}`] : []}
        alt={zoomedFile ?? ''}
        caption={zoomedFile ?? ''}
        labels={labels}
        onClose={() => setZoomedFile(null)}
      />
    </div>
  );
}
