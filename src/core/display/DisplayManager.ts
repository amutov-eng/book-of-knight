// @ts-nocheck
import DISPLAY_CONFIG from '../../config/displayConfig';

export default class DisplayManager {
    constructor(variant) {
        this.variant = variant || 'desktop';
    }

    getDevicePixelRatio() {
        if (typeof window === 'undefined') {
            return 1;
        }

        const ratio = Number(window.devicePixelRatio);
        if (!Number.isFinite(ratio) || ratio <= 0) {
            return 1;
        }

        // Keep text crisp on high-density screens without exploding GPU cost.
        return Math.min(ratio, 2);
    }

    getTargetResolution() {
        if (this.variant !== 'mobile') {
            return DISPLAY_CONFIG.desktop.fixed;
        }

        const isLandscape = window.innerWidth >= window.innerHeight;
        return isLandscape
            ? DISPLAY_CONFIG.mobile.landscape
            : DISPLAY_CONFIG.mobile.portrait;
    }

    applyRendererResolution(renderer) {
        if (!renderer) {
            return;
        }

        const { width, height } = this.getTargetResolution();
        const resolution = this.getDevicePixelRatio();

        if (renderer.resolution !== resolution) {
            renderer.resolution = resolution;
        }

        renderer.resize(width, height);
    }

    applyViewport(renderer) {
        if (!renderer) {
            return;
        }

        const view = renderer.canvas || renderer.view;
        if (!view) {
            return;
        }

        const target = this.getTargetResolution();
        const scale = this.variant === 'mobile'
            ? Math.min(window.innerWidth / target.width, window.innerHeight / target.height)
            : Math.min(window.innerWidth / target.width, window.innerHeight / target.height, 1);

        const displayWidth = Math.floor(target.width * scale);
        const displayHeight = Math.floor(target.height * scale);

        document.body.style.margin = '0';
        document.body.style.overflow = 'hidden';
        document.body.style.backgroundColor = '#000';

        view.style.position = 'absolute';
        view.style.width = `${displayWidth}px`;
        view.style.height = `${displayHeight}px`;
        view.style.left = `${Math.floor((window.innerWidth - displayWidth) / 2)}px`;
        view.style.top = `${Math.floor((window.innerHeight - displayHeight) / 2)}px`;
        view.style.imageRendering = 'auto';
        view.style.transform = 'translateZ(0)';
    }

    attachResizeHandling(renderer) {
        const onResize = () => {
            this.applyRendererResolution(renderer);
            this.applyViewport(renderer);
        };

        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);
        onResize();
    }
}
