import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Check, X, ZoomIn } from "lucide-react";
import { cropImage } from "@/lib/imageUtils";

interface AvatarCropDialogProps {
  open: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropDone: (blob: Blob) => void;
}

export default function AvatarCropDialog({
  open,
  imageSrc,
  onClose,
  onCropDone,
}: AvatarCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleValidate = async () => {
    if (!croppedAreaPixels) return;
    setIsProcessing(true);
    try {
      const blob = await cropImage(imageSrc, croppedAreaPixels);
      onCropDone(blob);
    } catch {
      // Error handled by parent via upload mutation
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm p-4 gap-3">
        <DialogHeader>
          <DialogTitle>Recadrer la photo</DialogTitle>
          <DialogDescription>Déplacez et zoomez pour ajuster.</DialogDescription>
        </DialogHeader>

        <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>

        <div className="flex items-center gap-3 px-1">
          <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.1}
            onValueChange={([v]) => setZoom(v)}
          />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={onClose}
            disabled={isProcessing}
          >
            <X className="h-4 w-4" />
            Annuler
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleValidate}
            disabled={isProcessing || !croppedAreaPixels}
          >
            <Check className="h-4 w-4" />
            {isProcessing ? "Traitement..." : "Valider"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
