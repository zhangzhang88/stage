/**
 * Export service for handling image exports
 * Uses html2canvas for backgrounds, Konva for user-uploaded images,
 * and modern-screenshot for 3D perspective transforms
 */

import html2canvas from 'html2canvas';
import Konva from 'konva';
import { domToCanvas } from 'modern-screenshot';
import {
  convertStylesToRGB,
  injectRGBOverrides,
  generateNoiseTexture,
} from './export-utils';
import { addWatermarkToCanvas } from './watermark';
import { getBackgroundCSS } from '@/lib/constants/backgrounds';
import { getFontCSS } from '@/lib/constants/fonts';

export interface ExportOptions {
  format: 'png';
  quality: number;
  scale: number;
  exportWidth: number;
  exportHeight: number;
}

export interface ExportResult {
  dataURL: string;
  blob: Blob;
}

/**
 * Convert oklch color to RGB
 */
function convertOklchToRGB(oklchColor: string): string {
  // If it's not oklch, return as-is
  if (!oklchColor.includes('oklch')) {
    return oklchColor;
  }
  
  // Extract oklch values using regex
  const oklchMatch = oklchColor.match(/oklch\(([^)]+)\)/);
  if (!oklchMatch) {
    return oklchColor;
  }
  
  const values = oklchMatch[1].split(/\s+/).map(v => parseFloat(v.trim()));
  if (values.length < 3) {
    return oklchColor;
  }
  
  const [L, C, H] = values;
  const alpha = values[3] !== undefined ? values[3] : 1;
  
  // Convert oklch to RGB (simplified conversion)
  // This is a basic approximation - for production, consider using a library
  // For now, we'll use the browser's computed style to convert
  const tempEl = document.createElement('div');
  tempEl.style.color = oklchColor;
  document.body.appendChild(tempEl);
  const computed = window.getComputedStyle(tempEl).color;
  document.body.removeChild(tempEl);
  
  return computed || oklchColor;
}

/**
 * Convert CSS string that may contain oklch to RGB
 */
function convertCSSStringToRGB(cssString: string): string {
  // Handle gradients with oklch colors
  if (cssString.includes('oklch')) {
    // Replace oklch colors in the string
    return cssString.replace(/oklch\([^)]+\)/g, (match) => {
      return convertOklchToRGB(match);
    });
  }
  return cssString;
}

/**
 * Create a background-only DOM element for html2canvas to capture
 */
function createBackgroundElement(
  width: number,
  height: number,
  backgroundConfig: any,
  borderRadius: number,
  backgroundBlur: number = 0
): HTMLElement {
  const bgElement = document.createElement('div');
  bgElement.id = 'export-background-temp';
  bgElement.style.width = `${width}px`;
  bgElement.style.height = `${height}px`;
  bgElement.style.position = 'absolute';
  bgElement.style.top = '0';
  bgElement.style.left = '0';
  bgElement.style.margin = '0';
  bgElement.style.padding = '0';
  bgElement.style.borderRadius = `${borderRadius}px`;
  bgElement.style.overflow = 'hidden';
  
  // Apply blur effect if specified
  if (backgroundBlur > 0) {
    bgElement.style.filter = `blur(${backgroundBlur}px)`;
  }
  
  // Apply background styles
  const backgroundStyle = getBackgroundCSS(backgroundConfig);
  
  // Convert oklch colors to RGB before applying
  const convertedStyle: React.CSSProperties = {};
  Object.keys(backgroundStyle).forEach((key) => {
    const value = (backgroundStyle as any)[key];
    if (typeof value === 'string') {
      // Check if value contains oklch
      if (value.includes('oklch')) {
        // Convert oklch to RGB using browser's computed style
        const tempEl = document.createElement('div');
        (tempEl.style as any)[key] = value;
        document.body.appendChild(tempEl);
        const computed = window.getComputedStyle(tempEl).getPropertyValue(key);
        document.body.removeChild(tempEl);
        (convertedStyle as any)[key] = computed || value;
      } else {
        // Check for CSS variables that might resolve to oklch
        const tempEl = document.createElement('div');
        (tempEl.style as any)[key] = value;
        document.body.appendChild(tempEl);
        const computed = window.getComputedStyle(tempEl).getPropertyValue(key);
        document.body.removeChild(tempEl);
        // Use computed value if it doesn't contain oklch, otherwise use original
        if (computed && !computed.includes('oklch')) {
          (convertedStyle as any)[key] = computed;
        } else {
          (convertedStyle as any)[key] = value;
        }
      }
    } else {
      (convertedStyle as any)[key] = value;
    }
  });
  
  // Apply styles to element
  Object.assign(bgElement.style, convertedStyle);
  
  // Ensure element is visible
  bgElement.style.visibility = 'visible';
  bgElement.style.display = 'block';
  bgElement.style.zIndex = '1';
  
  return bgElement;
}

/**
 * Apply blur effect to a canvas using Canvas 2D context filter
 * This is more reliable than relying on html2canvas to capture CSS filters
 * 
 * @param canvas - The canvas to apply blur to
 * @param blurAmount - Blur amount in pixels (should be scaled for high-DPI exports)
 * @returns A new canvas with the blur effect applied
 */
function applyBlurToCanvas(
  canvas: HTMLCanvasElement,
  blurAmount: number
): HTMLCanvasElement {
  if (blurAmount <= 0) {
    return canvas;
  }

  const blurredCanvas = document.createElement('canvas');
  blurredCanvas.width = canvas.width;
  blurredCanvas.height = canvas.height;
  const ctx = blurredCanvas.getContext('2d');
  
  if (!ctx) {
    return canvas;
  }

  // Apply blur filter using Canvas 2D context
  // This is the most reliable way to ensure blur is captured in exports
  ctx.filter = `blur(${blurAmount}px)`;
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = 'none';

  return blurredCanvas;
}

/**
 * Extract noise texture from preview element
 * This ensures the exported noise matches the preview exactly
 */
async function getNoiseTextureFromPreview(): Promise<HTMLCanvasElement | null> {
  // Find the noise overlay element by ID (most reliable)
  let noiseOverlay = document.getElementById('canvas-noise-overlay') as HTMLElement | null;
  
  // Fallback: try to find it by characteristics if ID doesn't exist
  if (!noiseOverlay) {
    const canvasBackground = document.getElementById('canvas-background');
    if (!canvasBackground) return null;
    
    const parent = canvasBackground.parentElement;
    if (!parent) return null;
    
    // Look for the noise overlay div - it has:
    // - backgroundImage with a data URL
    // - mixBlendMode: 'overlay'
    // - pointerEvents: 'none'
    const found = Array.from(parent.children).find((child) => {
      if (child instanceof HTMLElement) {
        const style = window.getComputedStyle(child);
        const bgImage = style.backgroundImage;
        const mixBlendMode = style.mixBlendMode;
        const pointerEvents = style.pointerEvents;
        
        // Match the noise overlay characteristics
        return bgImage && 
               bgImage.includes('data:image') && 
               bgImage.includes('base64') &&
               mixBlendMode === 'overlay' &&
               pointerEvents === 'none';
      }
      return false;
    }) as HTMLElement | undefined;
    
    if (!found) return null;
    noiseOverlay = found;
  }
  
  if (!noiseOverlay) return null;
  
  // Extract the data URL from the background image
  const style = window.getComputedStyle(noiseOverlay);
  const bgImage = style.backgroundImage;
  const urlMatch = bgImage.match(/url\(['"]?(.+?)['"]?\)/);
  
  if (!urlMatch || !urlMatch[1]) return null;
  
  const dataURL = urlMatch[1];
  
  // Convert data URL to canvas
  return new Promise<HTMLCanvasElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataURL;
  });
}

/**
 * Apply noise overlay to a canvas
 * The noise is composited on top of the existing canvas content
 * Matches preview exactly: same texture size, opacity, and blend mode
 * 
 * @param canvas - The canvas to apply noise to
 * @param noiseIntensity - Noise intensity (0-1), converted from percentage
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @param scale - Export scale factor
 * @returns A new canvas with the noise overlay applied
 */
async function applyNoiseToCanvas(
  canvas: HTMLCanvasElement,
  noiseIntensity: number,
  width: number,
  height: number,
  scale: number
): Promise<HTMLCanvasElement> {
  if (noiseIntensity <= 0) {
    return canvas;
  }

  // Use the actual canvas dimensions (html2canvas may have scaled it)
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = canvasWidth;
  finalCanvas.height = canvasHeight;
  const ctx = finalCanvas.getContext('2d');
  
  if (!ctx) {
    return canvas;
  }

  // Draw the existing canvas first (this includes the blurred background)
  ctx.drawImage(canvas, 0, 0);

  // Try to extract the noise texture from the preview element first
  // This ensures we use the exact same noise pattern the user sees
  let noiseCanvas: HTMLCanvasElement | null = null;
  
  const previewNoiseTexture = await getNoiseTextureFromPreview();
  if (previewNoiseTexture) {
    noiseCanvas = previewNoiseTexture;
  } else {
    // Fallback: Generate noise texture if we can't extract from preview
    // This should rarely happen, but ensures export still works
    noiseCanvas = generateNoiseTexture(200, 200, noiseIntensity);
  }
  
  // Apply noise with overlay blend mode (matching preview's mix-blend-mode: overlay)
  // Use the exact same opacity calculation as preview: backgroundNoise / 100
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = noiseIntensity; // This matches preview's opacity: backgroundNoise / 100
  
  // Tile the noise texture across the canvas
  // Use imageSmoothingEnabled: false to preserve noise grain sharpness
  ctx.imageSmoothingEnabled = false;
  const pattern = ctx.createPattern(noiseCanvas, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }
  ctx.imageSmoothingEnabled = true; // Restore for future operations
  
  ctx.restore();

  return finalCanvas;
}

/**
 * Export background and text overlays using html2canvas
 */
async function exportBackground(
  width: number,
  height: number,
  scale: number,
  backgroundConfig: any,
  borderRadius: number,
  textOverlays: any[],
  imageOverlays: any[] = [],
  backgroundBlur: number = 0,
  backgroundNoise: number = 0
): Promise<HTMLCanvasElement> {
  // Get the existing canvas-background element from the DOM - required for export
  const existingBgElement = document.getElementById('canvas-background');
  
  if (!existingBgElement) {
    throw new Error('Canvas background element not found. Please ensure the canvas is properly initialized.');
  }

  // Create export container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.overflow = 'visible';
  container.style.isolation = 'isolate';
  container.style.background = 'transparent';
  container.style.zIndex = '999999';
  container.style.visibility = 'visible';
  container.style.opacity = '1';
  
  document.body.appendChild(container);
  
  try {
    // Clone the background element and resize to export dimensions
    const bgElement = existingBgElement.cloneNode(true) as HTMLElement;
    bgElement.style.width = `${width}px`;
    bgElement.style.height = `${height}px`;
    bgElement.style.position = 'absolute';
    bgElement.style.top = '0';
    bgElement.style.left = '0';
    bgElement.id = 'export-background-temp';
    
    // Remove blur from CSS - we'll apply it via canvas after capture
    // This ensures we can blur background without blurring noise
    bgElement.style.setProperty('filter', 'none', 'important');
    
    container.appendChild(bgElement);
    
    // Get actual canvas container dimensions for proper scaling
    const canvasContainer = document.getElementById('image-render-card');
    if (!canvasContainer) {
      throw new Error('Canvas container not found. Please ensure the canvas is properly initialized.');
    }
    
    const canvasRect = canvasContainer.getBoundingClientRect();
    let scaleX = 1;
    let scaleY = 1;
    if (canvasRect.width > 0 && canvasRect.height > 0) {
      scaleX = width / canvasRect.width;
      scaleY = height / canvasRect.height;
    }

    // Add text overlays
    for (const overlay of textOverlays) {
      if (!overlay.isVisible) continue;
      
      const textElement = document.createElement('div');
      textElement.style.position = 'absolute';
      // Text overlays use percentage positions (0-100)
      textElement.style.left = `${(overlay.position.x / 100) * width}px`;
      textElement.style.top = `${(overlay.position.y / 100) * height}px`;
      textElement.style.transform = 'translate(-50%, -50%)';
      // Scale font size for export
      textElement.style.fontSize = `${overlay.fontSize * scaleX}px`;
      textElement.style.fontWeight = overlay.fontWeight;
      textElement.style.fontFamily = getFontCSS(overlay.fontFamily);
      
      // Convert oklch color to RGB
      let textColor = overlay.color;
      if (textColor && textColor.includes('oklch')) {
        const tempEl = document.createElement('div');
        tempEl.style.color = textColor;
        document.body.appendChild(tempEl);
        const computed = window.getComputedStyle(tempEl).color;
        document.body.removeChild(tempEl);
        textColor = computed || textColor;
      }
      textElement.style.color = textColor;
      
      textElement.style.opacity = overlay.opacity.toString();
      textElement.style.whiteSpace = 'nowrap';
      textElement.style.pointerEvents = 'none';
      textElement.style.zIndex = '1000';
      textElement.style.visibility = 'visible';
      textElement.style.display = 'block';
      textElement.textContent = overlay.text;
      
      if (overlay.orientation === 'vertical') {
        textElement.style.writingMode = 'vertical-rl';
      }
      
      if (overlay.textShadow?.enabled) {
        // Convert shadow color if it contains oklch
        let shadowColor = overlay.textShadow.color;
        if (shadowColor && shadowColor.includes('oklch')) {
          const tempEl = document.createElement('div');
          tempEl.style.color = shadowColor;
          document.body.appendChild(tempEl);
          const computed = window.getComputedStyle(tempEl).color;
          document.body.removeChild(tempEl);
          shadowColor = computed || shadowColor;
        }
        // Scale shadow offsets for export
        textElement.style.textShadow = `${overlay.textShadow.offsetX * scaleX}px ${overlay.textShadow.offsetY * scaleY}px ${overlay.textShadow.blur * scaleX}px ${shadowColor}`;
      }
      
      container.appendChild(textElement);
    }

    // Add image overlays
    for (const overlay of imageOverlays) {
      if (!overlay.isVisible) continue;

      const overlayElement = document.createElement('div');
      overlayElement.style.position = 'absolute';
      // Image overlays use pixel positions relative to preview canvas
      // Scale them to export dimensions
      overlayElement.style.left = `${overlay.position.x * scaleX}px`;
      overlayElement.style.top = `${overlay.position.y * scaleY}px`;
      overlayElement.style.width = `${overlay.size * scaleX}px`;
      overlayElement.style.height = `${overlay.size * scaleY}px`;
      overlayElement.style.opacity = overlay.opacity.toString();
      overlayElement.style.transform = `
        rotate(${overlay.rotation}deg)
        scaleX(${overlay.flipX ? -1 : 1})
        scaleY(${overlay.flipY ? -1 : 1})
      `;
      overlayElement.style.transformOrigin = 'center center';
      overlayElement.style.pointerEvents = 'none';
      overlayElement.style.overflow = 'hidden';
      overlayElement.style.zIndex = '1001';
      overlayElement.style.visibility = 'visible';
      overlayElement.style.display = 'block';

      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.style.display = 'block';
      
      // Wait for image to load before appending
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          overlayElement.appendChild(img);
          resolve();
        };
        img.onerror = () => reject(new Error(`Failed to load overlay image: ${overlay.src}`));
        img.src = overlay.src;
      });

      container.appendChild(overlayElement);
    }
    
    // Wait for background image to load if it's an image background
    if (backgroundConfig.type === 'image' && backgroundConfig.value) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          setTimeout(() => resolve(), 100);
        };
        img.onerror = () => resolve();
        const bgStyle = getBackgroundCSS(backgroundConfig);
        if (bgStyle.backgroundImage) {
          const urlMatch = bgStyle.backgroundImage.match(/url\(['"]?(.+?)['"]?\)/);
          if (urlMatch && urlMatch[1]) {
            img.src = urlMatch[1];
          } else {
            resolve();
          }
        } else {
          resolve();
        }
      });
    }
    
    // Convert all oklch colors in the container to RGB before capture
    const allElements = container.querySelectorAll('*');
    allElements.forEach((el) => {
      if (el instanceof HTMLElement) {
        const computedStyle = window.getComputedStyle(el);
        const styleProps = ['color', 'backgroundColor', 'background', 'backgroundImage', 'textShadow'];
        
        styleProps.forEach((prop) => {
          try {
            const value = (computedStyle as any)[prop];
            if (value && typeof value === 'string' && value.includes('oklch')) {
              const computed = window.getComputedStyle(el).getPropertyValue(prop);
              if (computed && !computed.includes('oklch')) {
                (el.style as any)[prop] = computed;
              }
            }
          } catch (e) {
            // Ignore errors
          }
        });
      }
    });
    
    // Wait for fonts to load and styles to apply
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    // Wait longer for all elements to render properly
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Force a reflow to ensure all styles are applied
    void container.offsetHeight;
    
    // Capture background and text overlays with html2canvas
    // Exclude noise overlay - we'll apply it via canvas after blur
    const canvas = await html2canvas(container, {
      backgroundColor: null,
      scale: scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: width,
      height: height,
      windowWidth: width,
      windowHeight: height,
      removeContainer: false,
      ignoreElements: (element) => {
        // Ignore noise overlay if it exists - we'll apply it via canvas
        return element.id === 'export-noise-overlay' || element.id === 'canvas-noise-overlay';
      },
      onclone: (clonedDoc, clonedElement) => {
        // Disable stylesheets that contain oklch
        try {
          const stylesheets = Array.from(clonedDoc.styleSheets);
          stylesheets.forEach((sheet) => {
            try {
              if (sheet.href && (sheet.href.includes('globals.css') || sheet.href.includes('tailwind'))) {
                (sheet as any).disabled = true;
              }
            } catch (e) {
              // Ignore cross-origin errors
            }
          });
        } catch (e) {
          // Ignore errors
        }
        
        // Inject RGB overrides to prevent oklch colors
        injectRGBOverrides(clonedDoc);
        
        // Preserve filter styles (blur, etc.) in cloned document
        const clonedBgElement = clonedElement.querySelector('#export-background-temp') as HTMLElement;
        if (clonedBgElement) {
          // Ensure filter is preserved in cloned document
          if (backgroundBlur > 0) {
            clonedBgElement.style.setProperty('filter', `blur(${backgroundBlur}px)`, 'important');
          } else {
            // Clear filter if blur is 0
            clonedBgElement.style.setProperty('filter', 'none', 'important');
          }
        }
        
        // Convert any remaining oklch colors in the cloned document
        const clonedElements = clonedElement.querySelectorAll('*');
        clonedElements.forEach((el) => {
          if (el instanceof HTMLElement) {
            convertStylesToRGB(el, clonedDoc);
          }
        });
        convertStylesToRGB(clonedElement as HTMLElement, clonedDoc);
        
        // Force recompute all styles to ensure RGB conversion
        clonedElements.forEach((el) => {
          if (el instanceof HTMLElement) {
            void clonedDoc.defaultView?.getComputedStyle(el);
          }
        });
        void clonedDoc.defaultView?.getComputedStyle(clonedElement);
      },
    });
    
    document.body.removeChild(container);
    
    // Step 1: Apply blur to background (noise was excluded from capture)
    const blurredCanvas = backgroundBlur > 0 
      ? applyBlurToCanvas(canvas, backgroundBlur * scale)
      : canvas;
    
    // Step 2: Apply noise overlay on top of blurred background
    // This matches the preview exactly: sharp noise on top of blurred background
    if (backgroundNoise > 0) {
      const noiseIntensity = backgroundNoise / 100;
      return await applyNoiseToCanvas(blurredCanvas, noiseIntensity, width, height, scale);
    }
    
    return blurredCanvas;
  } catch (error) {
    // Clean up container on error
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    throw error;
  }
}

/**
 * Capture 3D transformed element using modern-screenshot
 * This properly captures CSS 3D transforms including perspective
 */
async function capture3DTransformWithModernScreenshot(
  elementId: string,
  scale: number
): Promise<HTMLCanvasElement> {
  // Find the 3D overlay element
  const container = document.getElementById(elementId);
  if (!container) {
    throw new Error(`Element with id "${elementId}" not found`);
  }

  const overlayElement = container.querySelector('[data-3d-overlay="true"]') as HTMLElement;
  if (!overlayElement) {
    throw new Error('3D overlay element not found');
  }

  // Get the bounding box of the overlay element
  const rect = overlayElement.getBoundingClientRect();
  const overlayComputedStyle = window.getComputedStyle(overlayElement);
  
  // Create a temporary container for capture
  // Position it off-screen to avoid affecting the viewport
  const tempContainer = document.createElement('div');
  tempContainer.style.position = 'absolute';
  tempContainer.style.left = '-9999px';
  tempContainer.style.top = '-9999px';
  tempContainer.style.width = `${rect.width}px`;
  tempContainer.style.height = `${rect.height}px`;
  tempContainer.style.overflow = 'visible';
  
  // Clone the overlay element with all its styles
  // The overlay element itself has perspective, which applies to its children
  const clonedOverlay = overlayElement.cloneNode(true) as HTMLElement;
  
  // Preserve all computed styles from the original overlay
  clonedOverlay.style.position = 'relative';
  clonedOverlay.style.left = '0';
  clonedOverlay.style.top = '0';
  clonedOverlay.style.width = overlayComputedStyle.width;
  clonedOverlay.style.height = overlayComputedStyle.height;
  clonedOverlay.style.perspective = overlayComputedStyle.perspective;
  clonedOverlay.style.transformStyle = overlayComputedStyle.transformStyle;
  
  // Clone the image inside with all its transform styles
  const originalImg = overlayElement.querySelector('img');
  if (originalImg) {
    const clonedImg = originalImg.cloneNode(true) as HTMLImageElement;
    const imgComputedStyle = window.getComputedStyle(originalImg);
    
    // Preserve all image styles including the 3D transform
    clonedImg.style.width = imgComputedStyle.width;
    clonedImg.style.height = imgComputedStyle.height;
    clonedImg.style.objectFit = imgComputedStyle.objectFit;
    clonedImg.style.opacity = imgComputedStyle.opacity;
    clonedImg.style.borderRadius = imgComputedStyle.borderRadius;
    clonedImg.style.transform = imgComputedStyle.transform; // This contains the 3D transform
    clonedImg.style.transformOrigin = imgComputedStyle.transformOrigin;
    clonedImg.style.willChange = imgComputedStyle.willChange;
    
    // Clear the cloned overlay and add the cloned image
    clonedOverlay.innerHTML = '';
    clonedOverlay.appendChild(clonedImg);
  }
  
  tempContainer.appendChild(clonedOverlay);
  document.body.appendChild(tempContainer);
  
  try {
    // Wait for any images to load and styles to apply
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Use modern-screenshot to capture the 3D transformed element
    // Capture the overlay element which has perspective and contains the transformed image
    // modern-screenshot properly handles CSS 3D transforms including perspective
    const canvas = await domToCanvas(clonedOverlay, {
      width: rect.width * scale,
      height: rect.height * scale,
    });
    
    return canvas;
  } finally {
    // Clean up temporary container
    document.body.removeChild(tempContainer);
  }
}

/**
 * Export Konva stage as canvas (excluding background layer)
 */
async function exportKonvaStage(
  stage: Konva.Stage | null,
  targetWidth: number,
  targetHeight: number,
  scale: number,
  format: 'png',
  quality: number
): Promise<HTMLCanvasElement> {
  if (!stage) {
    throw new Error('Konva stage not found');
  }
  
  // Get current stage dimensions (display dimensions)
  const originalWidth = stage.width();
  const originalHeight = stage.height();
  
  // Get all layers
  const layers = stage.getLayers();
  
  // Find background layer (first layer typically contains backgrounds)
  const backgroundLayer = layers[0];
  const wasBackgroundVisible = backgroundLayer ? backgroundLayer.visible() : true;
  
  try {
    // Temporarily hide background layer
    if (backgroundLayer) {
      backgroundLayer.visible(false);
    }
    
    // Calculate scale factor to match export dimensions
    const scaleX = targetWidth / originalWidth;
    const scaleY = targetHeight / originalHeight;
    
    // Export Konva stage at its current dimensions with high pixelRatio
    // This preserves exact positioning
    const exportPixelRatio = scale * Math.max(scaleX, scaleY);
    const dataURL = stage.toDataURL({
      mimeType: 'image/png',
      quality: quality,
      pixelRatio: exportPixelRatio,
    });
    
    // Convert data URL to canvas
    const tempCanvas = document.createElement('canvas');
    const tempImg = new Image();
    await new Promise<void>((resolve, reject) => {
      tempImg.onload = () => {
        tempCanvas.width = tempImg.width;
        tempCanvas.height = tempImg.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        tempCtx.drawImage(tempImg, 0, 0);
        resolve();
      };
      tempImg.onerror = reject;
      tempImg.src = dataURL;
    });
    
    // Now scale the canvas to match export dimensions
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = targetWidth * scale;
    finalCanvas.height = targetHeight * scale;
    const ctx = finalCanvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    // Use high-quality image scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw the scaled image
    ctx.drawImage(
      tempCanvas,
      0, 0, tempCanvas.width, tempCanvas.height,
      0, 0, targetWidth * scale, targetHeight * scale
    );
    
    return finalCanvas;
  } finally {
    // Restore visibility
    if (backgroundLayer) {
      backgroundLayer.visible(wasBackgroundVisible);
    }
    stage.getLayers().forEach(layer => layer.draw());
  }
}


/**
 * Composite background and Konva stage into final canvas
 */
function compositeCanvases(
  backgroundCanvas: HTMLCanvasElement,
  konvaCanvas: HTMLCanvasElement,
  width: number,
  height: number,
  scale: number
): HTMLCanvasElement {
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = width * scale;
  finalCanvas.height = height * scale;
  const ctx = finalCanvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  
  // Use high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  
  // Draw background first
  ctx.drawImage(backgroundCanvas, 0, 0, width * scale, height * scale);
  
  // Draw Konva canvas on top
  ctx.drawImage(konvaCanvas, 0, 0, width * scale, height * scale);
  
  return finalCanvas;
}

/**
 * Export element using hybrid approach: html2canvas for background, Konva for images
 */
export async function exportElement(
  elementId: string,
  options: ExportOptions,
  konvaStage: Konva.Stage | null,
  backgroundConfig: any,
  backgroundBorderRadius: number,
  textOverlays: any[] = [],
  imageOverlays: any[] = [],
  perspective3D?: any,
  imageSrc?: string,
  screenshotRadius?: number,
  backgroundBlur: number = 0,
  backgroundNoise: number = 0
): Promise<ExportResult> {
  // Wait a bit to ensure DOM is ready
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error('Image render card not found. Please ensure an image is uploaded.');
  }

  if (!konvaStage) {
    throw new Error('Konva stage not found');
  }

  try {
    // Step 1: Export background and text overlays using html2canvas
    const backgroundCanvas = await exportBackground(
      options.exportWidth,
      options.exportHeight,
      options.scale,
      backgroundConfig,
      backgroundBorderRadius,
      textOverlays,
      imageOverlays,
      backgroundBlur,
      backgroundNoise
    );

    // Step 2: Export Konva stage (user images, frames, patterns, etc.) - excluding backgrounds
    let konvaCanvas = await exportKonvaStage(
      konvaStage,
      options.exportWidth,
      options.exportHeight,
      options.scale,
      options.format,
      options.quality
    );

    // Step 2.5: If 3D transforms are active, capture using modern-screenshot
    if (perspective3D && imageSrc) {
      const has3DTransform = 
        perspective3D.rotateX !== 0 ||
        perspective3D.rotateY !== 0 ||
        perspective3D.rotateZ !== 0 ||
        perspective3D.translateX !== 0 ||
        perspective3D.translateY !== 0 ||
        perspective3D.scale !== 1;

      if (has3DTransform) {
        try {
          // Find the 3D transformed image overlay to get dimensions
          const overlayContainer = element.querySelector('[data-3d-overlay="true"]') as HTMLElement;
          
          if (overlayContainer) {
            // Get the displayed dimensions from the overlay
            const overlayRect = overlayContainer.getBoundingClientRect();
            const innerContainer = element.querySelector('div[style*="position: relative"]') as HTMLElement;
            
            if (innerContainer) {
              const innerRect = innerContainer.getBoundingClientRect();
              
              // Capture 3D transform using modern-screenshot
              const transformedCanvas = await capture3DTransformWithModernScreenshot(
                elementId,
                options.scale
              );
              
              // Calculate position relative to inner container
              const relativeX = overlayRect.left - innerRect.left;
              const relativeY = overlayRect.top - innerRect.top;
              
              // Scale to export dimensions
              const scaleX = (options.exportWidth * options.scale) / innerRect.width;
              const scaleY = (options.exportHeight * options.scale) / innerRect.height;
              
              const scaledX = relativeX * scaleX;
              const scaledY = relativeY * scaleY;
              const scaledWidth = transformedCanvas.width;
              const scaledHeight = transformedCanvas.height;
              
              // Composite the transformed canvas onto the Konva canvas
              const compositeCtx = konvaCanvas.getContext('2d');
              if (compositeCtx && transformedCanvas.width > 0 && transformedCanvas.height > 0) {
                compositeCtx.imageSmoothingEnabled = true;
                compositeCtx.imageSmoothingQuality = 'high';
                compositeCtx.save();
                compositeCtx.drawImage(
                  transformedCanvas,
                  0, 0, transformedCanvas.width, transformedCanvas.height,
                  scaledX, scaledY, scaledWidth, scaledHeight
                );
                compositeCtx.restore();
              }
            }
          }
        } catch (error) {
          console.warn('Failed to capture 3D transform with modern-screenshot, using Konva image instead:', error);
          console.error('Error details:', error);
        }
      }
    }

    // Step 3: Composite both canvases
    const finalCanvas = compositeCanvases(
      backgroundCanvas,
      konvaCanvas,
      options.exportWidth,
      options.exportHeight,
      options.scale
    );

    // Step 4: Add watermark
    addWatermarkToCanvas(finalCanvas, {
      text: 'stage',
      position: 'bottom-right',
      backgroundColor: 'transparent',
      textColor: 'rgba(255, 255, 255, 0.7)',
    });

    // Step 5: Convert to blob and data URL
    const mimeType = 'image/png';
  
    const blob = await new Promise<Blob>((resolve, reject) => {
      finalCanvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob from canvas'));
          return;
        }
        resolve(blob);
      }, mimeType, options.quality);
    });
  
    const dataURL = finalCanvas.toDataURL(mimeType, options.quality);
  
  if (!dataURL || dataURL === 'data:,') {
    throw new Error('Failed to generate image data URL');
  }

  return { dataURL, blob };
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}

