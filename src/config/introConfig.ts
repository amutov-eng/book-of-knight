export interface SpineIntroConfig {
  kind: 'legacy-spine-3.8';
  skeletonJsonPath: string;
  atlasPath: string;
  animationName: string;
  loop: boolean;
  backgroundColor: number;
  backgroundImagePath?: string;
  layoutMode?: 'fit-center' | 'native-center-top';
  viewport?: {
    background?: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    };
    spine?: {
      x?: number;
      y?: number;
      offsetX?: number;
      offsetY?: number;
      scale?: number;
    };
    loadingBar?: {
      atlasPath?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      sweepSpeed?: number;
      chunkFraction?: number;
    };
  };
}

export const BOOT_INTRO_CONFIG: SpineIntroConfig = Object.freeze({
  kind: 'legacy-spine-3.8',
  skeletonJsonPath: 'assets/spine/intro/600_felix_logo.json',
  atlasPath: 'assets/spine/intro/600_felix_logo.atlas',
  animationName: 'animation',
  loop: false,
  backgroundColor: 0x000000,
  layoutMode: 'fit-center',
  viewport: {
    spine: {
      x: 960,
      y: 420,
      offsetX: -360,
      offsetY: 0,
      scale: 0.58
    },
    loadingBar: {
      atlasPath: 'assets/spine/intro/loading.json',
      x: 0,
      y: 36,
      width: 440,
      height: 10,
      sweepSpeed: 420,
      chunkFraction: 0.25
    }
  }
});

export const GAMEPLAY_INTRO_CONFIG: SpineIntroConfig = Object.freeze({
  kind: 'legacy-spine-3.8',
  skeletonJsonPath: 'assets/spine/intro/1920_intro_v1.json',
  atlasPath: 'assets/spine/intro/1920_intro_v1.atlas',
  animationName: 'animation3',
  loop: false,
  backgroundColor: 0x000000,
  backgroundImagePath: 'assets/backgrounds/bg.jpg',
  layoutMode: 'native-center-top',
  viewport: {
    background: {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080
    },
    spine: {
      x: 960,
      y: 0
    }
  }
});
