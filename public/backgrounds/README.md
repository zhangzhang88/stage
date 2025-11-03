# Background Images

Place your static background images in this directory.

## Supported Formats
- JPG/JPEG
- PNG
- WEBP

## Recommended Size
- 1920x1080 (Full HD) or similar aspect ratio
- Larger sizes will be automatically scaled to fit the canvas

## How to Use

1. Add your image files to this directory (`public/backgrounds/`)
2. Open `components/canvas/CanvasToolbar.tsx`
3. Add the image paths to the `staticBackgrounds` array:
   ```typescript
   const staticBackgrounds: string[] = [
     "/backgrounds/nature1.jpg",
     "/backgrounds/abstract1.png",
     "/backgrounds/city1.webp",
     // Add more paths here...
   ];
   ```
4. The images will appear as preset options in the Background Settings dialog

## Notes
- Paths should start with `/backgrounds/` (relative to the `public` directory)
- Images are served statically by Next.js
- No API calls or external dependencies needed

