/**
 * Mac Wallpapers - 精选的 Apple Mac 风格壁纸
 * High-quality abstract and scenic wallpapers optimized for Stage
 */

export const MAC_WALLPAPERS = [
  '/mac/mac-asset-1.jpeg',
  '/mac/mac-asset-2.jpg',
  '/mac/mac-asset-3.jpg',
  '/mac/mac-asset-4.jpg',
  '/mac/mac-asset-5.jpg',
  '/mac/mac-asset-6.jpeg',
  '/mac/mac-asset-7.png',
  '/mac/mac-asset-8.jpg',
  '/mac/mac-asset-9.jpg',
  '/mac/mac-asset-10.jpg',
] as const

export type MacWallpaperPath = typeof MAC_WALLPAPERS[number]
