'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Application } from '@splinetool/runtime';
import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import {
  ENABLE_SCENE_INSPECTOR,
  SPLINE_LOAD_TIMEOUT_MS,
  SPLINE_SCENE_URL,
  SPLINE_STATE_TRIGGERS,
} from '@/lib/splineConfig';
import type { RobotState } from '@/lib/types';

interface RobotSceneProps {
  /** State percakapan saat ini untuk memicu animasi Spline secara terprogram */
  robotState: RobotState;
  /** Callback opsional saat scene selesai dimuat */
  onSceneReady?: () => void;
}

export default function RobotScene({ robotState, onSceneReady }: RobotSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const splineRef = useRef<Application | null>(null);
  const hasInteractedRef = useRef(false);

  // Simpan callback di ref agar re-render chat tidak memicu reload scene 3D
  const onSceneReadyRef = useRef(onSceneReady);
  useEffect(() => {
    onSceneReadyRef.current = onSceneReady;
  }, [onSceneReady]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(12);
  const [hasError, setHasError] = useState(false);
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  /**
   * Simulasi smooth progress bar hingga scene `.splinecode` selesai dimuat.
   */
  useEffect(() => {
    if (isLoaded || hasError) return;

    setLoadProgress(12);
    setIsSlowLoading(false);

    const progressTimer = window.setInterval(() => {
      setLoadProgress((prev) => {
        if (prev >= 92) return 92;
        const step = prev < 50 ? 9 : prev < 78 ? 4 : 1.5;
        return Math.min(92, Number((prev + step).toFixed(1)));
      });
    }, 260);

    const slowTimer = window.setTimeout(() => {
      setIsSlowLoading(true);
    }, SPLINE_LOAD_TIMEOUT_MS);

    return () => {
      window.clearInterval(progressTimer);
      window.clearTimeout(slowTimer);
    };
  }, [isLoaded, hasError, retryKey]);

  /**
   * Inisialisasi runtime Spline langsung pada elemen <canvas> (aman untuk Next.js 14).
   */
  useEffect(() => {
    if (hasError) return;

    let isCancelled = false;
    let appInstance: Application | null = null;
    let revealTimer: number | null = null;

    const loadSplineScene = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        const { Application } = await import('@splinetool/runtime');
        if (isCancelled || !canvasRef.current) return;

        appInstance = new Application(canvasRef.current);
        await appInstance.load(SPLINE_SCENE_URL);

        if (isCancelled) {
          try {
            appInstance.dispose();
          } catch {
            // Abaikan error cleanup saat Strict Mode unmount
          }
          return;
        }

        splineRef.current = appInstance;
        setLoadProgress(100);

        revealTimer = window.setTimeout(() => {
          if (isCancelled) return;
          setIsLoaded(true);
          onSceneReadyRef.current?.();
        }, 220);

        // Dev Scene Inspector: cetak daftar nama object & variable di Browser Console
        if (ENABLE_SCENE_INSPECTOR) {
          try {
            const allObjects =
              typeof appInstance.getAllObjects === 'function'
                ? appInstance.getAllObjects()
                : [];

            const objectList = allObjects
              .filter((obj) => obj && obj.name)
              .map((obj) => ({ name: obj.name, uuid: obj.uuid }));

            console.groupCollapsed(
              '%c[Spline Inspector] Scene dimuat — klik untuk lihat nama Object & Variables',
              'color: #22d3ee; font-weight: bold;'
            );
            console.log('Scene URL:', SPLINE_SCENE_URL);
            console.log('Daftar Objects (salin ke lib/splineConfig.ts):');
            console.table(objectList);

            if (typeof appInstance.getVariables === 'function') {
              console.log('Daftar Variables:', appInstance.getVariables());
            }
            console.groupEnd();
          } catch {
            // Abaikan jika inspeksi tidak didukung
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('[RobotScene] Gagal memuat scene Spline:', err);
          setHasError(true);
        }
      }
    };

    loadSplineScene();

    return () => {
      isCancelled = true;
      if (revealTimer) {
        window.clearTimeout(revealTimer);
      }
      if (appInstance) {
        try {
          appInstance.dispose();
        } catch {
          // Abaikan error cleanup
        }
        appInstance = null;
      }
      splineRef.current = null;
    };
  }, [hasError, retryKey]);

  /**
   * Trigger event & variable Spline saat state chat berubah.
   */
  useEffect(() => {
    const splineApp = splineRef.current;
    if (!splineApp || !isLoaded) return;

    if (robotState !== 'idle') {
      hasInteractedRef.current = true;
    } else if (!hasInteractedRef.current) {
      return;
    }

    const action = SPLINE_STATE_TRIGGERS[robotState];
    if (!action) return;

    if (action.events && action.events.length > 0) {
      for (const trigger of action.events) {
        try {
          const target =
            typeof splineApp.findObjectByName === 'function'
              ? splineApp.findObjectByName(trigger.targetObject)
              : null;

          if (!target) continue;

          if (trigger.reverse && typeof splineApp.emitEventReverse === 'function') {
            splineApp.emitEventReverse(trigger.eventName, trigger.targetObject);
          } else if (typeof splineApp.emitEvent === 'function') {
            splineApp.emitEvent(trigger.eventName, trigger.targetObject);
          }
        } catch (err) {
          if (ENABLE_SCENE_INSPECTOR) {
            console.debug(
              `[Spline Trigger] Gagal memicu event "${trigger.eventName}" pada "${trigger.targetObject}":`,
              err
            );
          }
        }
      }
    }

    if (action.variables && action.variables.length > 0) {
      for (const variable of action.variables) {
        try {
          if (typeof splineApp.setVariable === 'function') {
            splineApp.setVariable(variable.name, variable.value);
          }
        } catch {
          // Variable tidak ada di scene ini — aman untuk diabaikan
        }
      }
    }
  }, [robotState, isLoaded]);

  const handleRetry = useCallback(() => {
    splineRef.current = null;
    hasInteractedRef.current = false;
    setHasError(false);
    setIsLoaded(false);
    setIsSlowLoading(false);
    setRetryKey((k) => k + 1);
  }, []);

  const stateAmbientGlow: Record<RobotState, string> = {
    idle: 'from-cyan-500/10 via-indigo-500/5 to-transparent',
    listening: 'from-cyan-400/20 via-sky-500/10 to-transparent',
    talking: 'from-indigo-400/25 via-cyan-400/15 to-transparent',
    error: 'from-rose-500/20 via-orange-500/10 to-transparent',
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-space-950 select-none">
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,var(--tw-gradient-stops))] transition-all duration-700 ${stateAmbientGlow[robotState]}`}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(56,189,248,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(56,189,248,0.4) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(circle at 50% 45%, black 20%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(circle at 50% 45%, black 20%, transparent 75%)',
        }}
      />

      {!hasError && (
        <div
          className={`spline-canvas-host relative z-10 w-full h-[calc(100%+64px)] transition-opacity duration-700 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <canvas
            key={retryKey}
            ref={canvasRef}
            className="block w-full h-full outline-none"
          />
        </div>
      )}


      {!isLoaded && !hasError && (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-space-950/90 backdrop-blur-md px-6 text-center"
        >
          <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 border-r-indigo-400 animate-spin" />
            <div className="absolute inset-2.5 rounded-full border border-indigo-400/30 animate-pulse-soft" />
            <Sparkles className="h-7 w-7 text-cyan-300" />
          </div>

          <h2 className="font-display text-lg sm:text-xl font-semibold tracking-wide text-white">
            Menyiapkan Robot 3D HD
          </h2>
          <p className="mt-1.5 max-w-xs text-xs sm:text-sm text-slate-400">
            Memuat scene interaktif AJA𝕏-22 dan menginisialisasi sistem AI...
          </p>

          <div className="mt-5 w-full max-w-[260px]">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 transition-all duration-300 ease-out"
                style={{ width: `${loadProgress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-slate-400">
              <span>AJA𝕏 3D ENGINE</span>
              <span className="text-cyan-300">{Math.round(loadProgress)}%</span>
            </div>
          </div>

          {isSlowLoading && (
            <div className="mt-5 flex flex-col items-center gap-2">
              <p className="text-xs text-amber-300/90">
                Koneksi agak lambat memuat aset 3D. Anda bisa menunggu sebentar atau muat ulang.
              </p>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-white/20 transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Muat Ulang Scene
              </button>
            </div>
          )}
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-space-950/95 px-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/15 text-rose-300">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="font-display text-lg font-semibold text-white">
            Visual 3D Tidak Dapat Dimuat
          </h2>
          <p className="mt-1.5 max-w-sm text-xs sm:text-sm text-slate-400">
            Pastikan browser mendukung WebGL dan koneksi internet stabil. Anda tetap bisa
            menggunakan chat AI di bawah.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/15 px-4 py-2 text-xs sm:text-sm font-medium text-cyan-200 hover:bg-cyan-500/25 transition"
          >
            <RefreshCw className="h-4 w-4" />
            Coba Muat Ulang 3D
          </button>
        </div>
      )}
    </div>
  );
}
