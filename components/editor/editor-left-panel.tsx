'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { TextOverlayControls } from '@/components/text-overlay/text-overlay-controls';
import { OverlayGallery, OverlayControls } from '@/components/overlays';
import { StyleTabs } from './style-tabs';
import { Button } from '@/components/ui/button';
import { Download, Trash2, Copy } from 'lucide-react';
import { useImageStore } from '@/lib/store';
import { ExportDialog } from '@/components/canvas/dialogs/ExportDialog';
import { useExport } from '@/hooks/useExport';
import { PresetSelector } from '@/components/presets/PresetSelector';
import { FaXTwitter } from 'react-icons/fa6';

export function EditorLeftPanel() {
  const { 
    uploadedImageUrl, 
    selectedAspectRatio, 
    clearImage,
  } = useImageStore();
  
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
  const [copySuccess, setCopySuccess] = React.useState(false);

  const {
    settings: exportSettings,
    isExporting,
    updateScale,
    exportImage,
    copyImage,
  } = useExport(selectedAspectRatio);

  return (
    <>
      <div className="w-full h-full bg-muted flex flex-col overflow-hidden md:w-80 border-r border-border">
        {/* Header */}
        <div className="p-4 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
              <Image 
                src="/logo.png" 
                alt="Stage" 
                width={32} 
                height={32}
                className="h-8 w-8"
              />
            </Link>
            <div className="flex-1">
              <PresetSelector />
            </div>
            <a
              href="https://x.com/code_kartik"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-accent rounded-lg transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Twitter/X"
            >
              <FaXTwitter className="h-5 w-5" />
            </a>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Overlay Gallery */}
            <OverlayGallery />
            
            {/* Image Overlays Section */}
            <OverlayControls />
            
            {/* Text Overlays Section */}
            <TextOverlayControls />
            
            {/* Style Controls */}
            <StyleTabs />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-background space-y-2">
          <div className="flex gap-2">
            <Button
              onClick={() => setExportDialogOpen(true)}
              disabled={!uploadedImageUrl}
              className="flex-1 h-11 justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm hover:shadow-md transition-all font-medium"
            >
              <Download className="size-4" />
              <span>Download</span>
            </Button>
            <Button
              onClick={() => {
                copyImage()
                  .then(() => {
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2000);
                  })
                  .catch((error) => {
                    console.error('Failed to copy:', error);
                    alert('Failed to copy image to clipboard. Please try again.');
                  });
              }}
              disabled={!uploadedImageUrl || isExporting}
              className="flex-1 h-11 justify-center gap-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground shadow-sm hover:shadow-md transition-all font-medium border border-border"
            >
              <Copy className="size-4" />
              <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
            </Button>
          </div>
          <Button
            onClick={clearImage}
            disabled={!uploadedImageUrl}
            variant="outline"
            className="w-full h-10 justify-center gap-2 rounded-xl border-border hover:bg-accent text-foreground transition-all"
          >
            <Trash2 className="size-4" />
            <span>Remove Image</span>
          </Button>
        </div>
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={() => exportImage().then(() => {})}
        scale={exportSettings.scale}
        isExporting={isExporting}
        onScaleChange={updateScale}
      />
    </>
  );
}

