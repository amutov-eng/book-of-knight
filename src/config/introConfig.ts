export interface SpineIntroConfig {
  kind: 'legacy-spine-3.8';
  skeletonJsonPath: string;
  atlasPath: string;
  animationName: string;
  loop: boolean;
  backgroundColor: number;
}

export const BOOT_INTRO_CONFIG: SpineIntroConfig = Object.freeze({
  kind: 'legacy-spine-3.8',
  skeletonJsonPath: 'assets/spine/intro/600_felix_logo.json',
  atlasPath: 'assets/spine/intro/600_felix_logo.atlas',
  animationName: 'animation',
  loop: true,
  backgroundColor: 0x000000
});
