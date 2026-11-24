import React, { useEffect, useRef } from 'react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import type { StudioTab } from './StudioView';

interface StudioTutorialProps {
  open: boolean;
  onClose: (markSeen: boolean) => void;
  onJumpTab: (tab: StudioTab) => void;
  onFlipPreview: (side: 'front' | 'back') => void;
  onSetDemoSpin?: (spinning: boolean) => void;
}

export const StudioTutorial: React.FC<StudioTutorialProps> = ({
  open,
  onClose,
  onJumpTab,
  onFlipPreview,
  onSetDemoSpin,
}) => {
  const driverRef = useRef<Driver | null>(null);
  const callbacksRef = useRef({
    onClose,
    onJumpTab,
    onFlipPreview,
    onSetDemoSpin,
  });

  useEffect(() => {
    callbacksRef.current = {
      onClose,
      onJumpTab,
      onFlipPreview,
      onSetDemoSpin,
    };
  }, [onClose, onJumpTab, onFlipPreview, onSetDemoSpin]);

  useEffect(() => {
    if (!open) {
      if (driverRef.current?.isActive()) {
        driverRef.current.destroy();
      }
      driverRef.current = null;
      return;
    }

    // Mark tour as seen on first launch so it only auto-runs once per user browser
    try {
      localStorage.setItem('kromacard_studio_tour_v1_seen', '1');
    } catch {
      // ignore storage errors
    }

    let cancelled = false;
    const startTimer = window.setTimeout(() => {
      if (cancelled) return;
      const previewEl = document.querySelector('#studio-3d-preview-stage');
      if (!previewEl) {
        callbacksRef.current.onClose(true);
        return;
      }

      const tour = driver({
        animate: true,
        smoothScroll: true,
        allowClose: true,
        overlayColor: '#06080E',
        overlayOpacity: 0.78,
        stagePadding: 10,
        stageRadius: 20,
        popoverClass: 'kromacard-driver-popover',
        showProgress: true,
        progressText: 'Paso {{current}} de {{total}}',
        nextBtnText: 'Siguiente →',
        prevBtnText: '← Anterior',
        doneBtnText: '¡Empezar a crear!',
        closeBtnLabel: 'Cerrar guía',
        steps: [
          {
            element: '#studio-3d-preview-stage',
            popover: {
              title: '1. Área de Previsualización 3D',
              description:
                'Mueve el cursor o desliza tu dedo sobre la tarjeta para apreciar los efectos holográficos en 3D, voltear al reverso o soltar stickers directamente encima.',
              side: 'right',
              align: 'start',
              onNextClick: (_el, _step, opts) => {
                callbacksRef.current.onSetDemoSpin?.(false);
                callbacksRef.current.onFlipPreview('front');
                callbacksRef.current.onJumpTab('frame');
                window.setTimeout(() => {
                  if (!cancelled && opts.driver.isActive()) {
                    opts.driver.moveNext();
                  }
                }, 90);
              },
            },
            onHighlightStarted: () => {
              callbacksRef.current.onFlipPreview('front');
              callbacksRef.current.onSetDemoSpin?.(true);
            },
          },
          {
            element: '#studio-textures-panel',
            waitForElement: 1200,
            popover: {
              title: '2. Panel de Texturas y Láminas',
              description:
                'Aplica texturas base (Prisma, Estadio, Oro, Carbono), láminas holográficas HD o crea y sube tus propias texturas desde tu dispositivo o Google Drive.',
              side: 'left',
              align: 'start',
              onPrevClick: (_el, _step, opts) => {
                callbacksRef.current.onFlipPreview('front');
                callbacksRef.current.onSetDemoSpin?.(true);
                opts.driver.movePrevious();
              },
              onNextClick: (_el, _step, opts) => {
                callbacksRef.current.onFlipPreview('front');
                callbacksRef.current.onJumpTab('stickers');
                window.setTimeout(() => {
                  if (!cancelled && opts.driver.isActive()) {
                    opts.driver.moveNext();
                  }
                }, 90);
              },
            },
            onHighlightStarted: () => {
              callbacksRef.current.onFlipPreview('front');
              callbacksRef.current.onSetDemoSpin?.(false);
            },
          },
          {
            element: '#studio-stickers-drag-panel',
            waitForElement: 1200,
            popover: {
              title: '3. Controles de Arrastre de Stickers',
              description:
                'Arrastra cualquier sticker de las categorías directamente hacia la tarjeta 3D (o tócalo para añadirlo) y ajusta su posición, tamaño o rotación.',
              side: 'left',
              align: 'start',
              onPrevClick: (_el, _step, opts) => {
                callbacksRef.current.onFlipPreview('front');
                callbacksRef.current.onJumpTab('frame');
                window.setTimeout(() => {
                  if (!cancelled && opts.driver.isActive()) {
                    opts.driver.movePrevious();
                  }
                }, 90);
              },
            },
            onHighlightStarted: () => {
              callbacksRef.current.onFlipPreview('front');
              callbacksRef.current.onSetDemoSpin?.(false);
            },
          },
        ],
        onDestroyed: () => {
          driverRef.current = null;
          callbacksRef.current.onSetDemoSpin?.(false);
          if (!cancelled) {
            callbacksRef.current.onClose(true);
          }
        },
      });

      driverRef.current = tour;
      tour.drive(0);
    }, 240);

    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      if (driverRef.current?.isActive()) {
        driverRef.current.destroy();
      }
      driverRef.current = null;
      callbacksRef.current.onSetDemoSpin?.(false);
    };
  }, [open]);

  return null;
};
